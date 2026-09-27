// Deploy a Vite build to S3 behind CloudFront.
//
//   S3_BUCKET=... CLOUDFRONT_DISTRIBUTION_ID=... node tools/deploy/src/deploy.ts site/dist
//
// 1. Hashed assets (assets/) are uploaded with a one-year immutable cache and never deleted on upload,
//    so tabs still running an older build can lazy-load their chunks.
// 2. A build record (_deploys/<build id>.txt) lists the assets this build uses.
// 3. Everything else (index.html, public/ files) is uploaded with no-cache; stale root files are removed.
// 4. CloudFront is invalidated, and the deploy waits for it to finish.
// 5. Old assets are pruned (see selectKeptBuilds in plan.ts).
//
// Optional env: KEEP_BUILDS (default 3), KEEP_DAYS (default 7), DRY_RUN=1 (log writes instead of making them).

import type { Clients } from './aws.ts';
import type { DeployConfig } from './env.ts';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { createClients, deleteKeys, getText, invalidateAll, listKeys, putObject, waitForInvalidation } from './aws.ts';
import { readDeployConfig } from './env.ts';
import {
  assetsToDelete,
  buildIdFromRecordKey,
  cacheControlFor,
  contentTypeFor,
  createBuildId,
  formatRecord,
  isAsset,
  parseRecord,
  RECORD_PREFIX,
  recordKey,
  selectKeptBuilds,
  shouldUpload,
  staleRootKeys,
} from './plan.ts';

const UPLOAD_CONCURRENCY = 8;

const listLocalFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter(shouldUpload)
    .toSorted();
};

const forEachConcurrently = async <T>(items: T[], limit: number, action: (item: T) => Promise<void>): Promise<void> => {
  const queue = [...items];
  const worker = async (): Promise<void> => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await action(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
};

const deploy = async (config: DeployConfig, clients: Clients): Promise<void> => {
  const { bucket, distDir, dryRun } = config;

  // Every write goes through here so DRY_RUN can log it instead
  const write = async (description: string, action: () => Promise<unknown>): Promise<void> => {
    if (dryRun) {
      console.log(`    [dry-run] ${description}`);
      return;
    }
    await action();
  };

  const uploadFiles = (keys: string[]): Promise<void> =>
    forEachConcurrently(keys, UPLOAD_CONCURRENCY, async (key) => {
      const body = await readFile(join(distDir, key));
      await write(`put ${key} (${cacheControlFor(key)})`, () => putObject(clients, bucket, {
        key,
        body,
        contentType: contentTypeFor(key),
        cacheControl: cacheControlFor(key),
      }));
    });

  const localKeys = await listLocalFiles(distDir);
  if (!localKeys.includes('index.html')) {
    throw new Error(`${distDir}/index.html not found; build the site first`);
  }

  const assets = localKeys.filter(isAsset);
  const rootFiles = localKeys.filter(key => !isAsset(key));
  const buildId = createBuildId(new Date(), config.sha);
  const record = formatRecord(assets);

  console.log(`==> Build ${buildId}: ${assets.length} assets, ${rootFiles.length} other files`);

  console.log('==> Uploading assets (immutable)');
  await uploadFiles(assets);

  console.log('==> Recording build');
  await write(`put ${recordKey(buildId)}`, () => putObject(clients, bucket, {
    key: recordKey(buildId),
    body: record,
    contentType: 'text/plain; charset=utf-8',
    cacheControl: 'no-cache',
  }));

  console.log('==> Uploading everything else (no-cache)');
  await uploadFiles(rootFiles);

  const stale = staleRootKeys(await listKeys(clients, bucket), new Set(rootFiles));
  if (stale.length > 0) {
    console.log(`==> Removing ${stale.length} stale files`);
    await write(`delete ${stale.join(', ')}`, () => deleteKeys(clients, bucket, stale));
  }

  console.log('==> Invalidating CloudFront');
  await write('invalidate /* and wait', async () => {
    const invalidationId = await invalidateAll(clients, config.distributionId, buildId);
    console.log(`    ${invalidationId}; waiting for it to complete`);
    await waitForInvalidation(clients, config.distributionId, invalidationId);
  });

  console.log(`==> Pruning assets (keep last ${config.policy.keepBuilds} builds, plus any replaced within ${config.policy.keepDays} days)`);
  const recordKeys = await listKeys(clients, bucket, RECORD_PREFIX);
  const buildIds = recordKeys.map(buildIdFromRecordKey);
  // In a dry run the record wasn't uploaded, so add this build as the newest
  if (dryRun) {
    buildIds.push(buildId);
  }

  const selection = selectKeptBuilds(buildIds, new Date(), config.policy);
  if (selection.skip) {
    console.log(`    skipping: ${selection.reason}`);
    return;
  }

  const keptAssets = new Set(parseRecord(record));
  for (const id of selection.ids) {
    console.log(`    keeping ${id}`);
    if (id !== buildId) {
      parseRecord(await getText(clients, bucket, recordKey(id))).forEach(key => keptAssets.add(key));
    }
  }

  const toDelete = assetsToDelete(await listKeys(clients, bucket, 'assets/'), keptAssets);
  if (toDelete.length > 0) {
    await write(`delete ${toDelete.join(', ')}`, () => deleteKeys(clients, bucket, toDelete));
  }
  console.log(`    pruned ${toDelete.length}`);
};

const config = readDeployConfig();
await deploy(config, createClients(config.region));
console.log('==> Done');
