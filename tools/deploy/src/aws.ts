import { CloudFrontClient, CreateInvalidationCommand, waitUntilInvalidationCompleted } from '@aws-sdk/client-cloudfront';
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

type Clients = {
  s3: S3Client;
  cloudfront: CloudFrontClient;
};

type Upload = {
  key: string;
  body: Uint8Array | string;
  contentType: string;
  cacheControl: string;
};

const DELETE_BATCH_SIZE = 1000;
const INVALIDATION_TIMEOUT_SECONDS = 15 * 60;

const createClients = (region: string): Clients => ({
  s3: new S3Client({ region }),
  cloudfront: new CloudFrontClient({ region }),
});

const listKeys = async ({ s3 }: Clients, bucket: string, prefix = ''): Promise<string[]> => {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }));
    for (const object of page.Contents ?? []) {
      if (object.Key) {
        keys.push(object.Key);
      }
    }
    continuationToken = page.NextContinuationToken;
  } while (continuationToken);

  return keys;
};

const getText = async ({ s3 }: Clients, bucket: string, key: string): Promise<string> => {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return (await object.Body?.transformToString()) ?? '';
};

const putObject = async ({ s3 }: Clients, bucket: string, upload: Upload): Promise<void> => {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: upload.key,
    Body: upload.body,
    ContentType: upload.contentType,
    CacheControl: upload.cacheControl,
  }));
};

const deleteKeys = async ({ s3 }: Clients, bucket: string, keys: string[]): Promise<void> => {
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

const invalidateAll = async ({ cloudfront }: Clients, distributionId: string, reference: string): Promise<string> => {
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
  return id;
};

const waitForInvalidation = async ({ cloudfront }: Clients, distributionId: string, invalidationId: string): Promise<void> => {
  await waitUntilInvalidationCompleted(
    { client: cloudfront, maxWaitTime: INVALIDATION_TIMEOUT_SECONDS },
    { DistributionId: distributionId, Id: invalidationId },
  );
};

export { createClients, deleteKeys, getText, invalidateAll, listKeys, putObject, waitForInvalidation };

export type { Clients, Upload };
