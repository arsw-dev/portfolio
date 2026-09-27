// S3 and CloudFront implementations of the pipeline's Store and Cdn interfaces.

import type { Cdn, Store, Upload } from './pipeline.ts';
import type { StoredObject } from './plan.ts';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const DELETE_BATCH_SIZE = 1000;

const listObjects = async (s3: S3Client, bucket: string, prefix: string): Promise<StoredObject[]> => {
  const objects: StoredObject[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }));
    for (const object of page.Contents ?? []) {
      if (object.Key && object.LastModified) {
        objects.push({ key: object.Key, lastModified: object.LastModified });
      }
    }
    continuationToken = page.NextContinuationToken;
  } while (continuationToken);

  return objects;
};

const getText = async (s3: S3Client, bucket: string, key: string): Promise<string> => {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return (await object.Body?.transformToString()) ?? '';
};

const putObject = async (s3: S3Client, bucket: string, upload: Upload): Promise<void> => {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: upload.key,
    Body: upload.body,
    ContentType: upload.contentType,
    CacheControl: upload.cacheControl,
  }));
};

const deleteKeys = async (s3: S3Client, bucket: string, keys: string[]): Promise<void> => {
  for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
    const batch = keys.slice(start, start + DELETE_BATCH_SIZE);
    const result = await s3.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: batch.map(key => ({ Key: key })), Quiet: true },
    }));
    if (result.Errors?.length) {
      throw new Error(`Failed to delete: ${result.Errors.map(error => `${error.Key} (${error.Code})`).join(', ')}`);
    }
  }
};

const createS3Store = (region: string, bucket: string): Store => {
  const s3 = new S3Client({ region });
  return {
    list: prefix => listObjects(s3, bucket, prefix),
    getText: key => getText(s3, bucket, key),
    put: upload => putObject(s3, bucket, upload),
    delete: keys => deleteKeys(s3, bucket, keys),
  };
};

const createCloudFrontCdn = (region: string, distributionId: string): Cdn => {
  const cloudfront = new CloudFrontClient({ region });
  return {
    invalidateAll: async (reference) => {
      const result = await cloudfront.send(new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: reference,
          Paths: { Quantity: 1, Items: ['/*'] },
        },
      }));
      const id = result.Invalidation?.Id;
      if (!id) {
        throw new Error('CloudFront did not return an invalidation ID');
      }
      // Not waited on: root files are no-cache (the edge revalidates them) and assets are content-hashed, so new
      // content is served without it. The smoke test confirms the new index.html is live.
      console.log(`    ${id}`);
    },
  };
};

export { createCloudFrontCdn, createS3Store };
