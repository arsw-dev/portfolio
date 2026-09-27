// The deploy sequence, written against small Store/Cdn interfaces so it runs the same against S3 (aws.ts) and
// against the in-memory fake in pipeline.test.ts.
//
// 1. Hashed assets (assets/) are uploaded with a one-year immutable cache and never deleted on upload,
//    so tabs still running an older build can lazy-load their chunks.
// 2. Everything else (index.html, public/ files) is uploaded with no-cache.
// 3. A build record (_deploys/<build id>.txt) lists every key uploaded. It's written only after all uploads
//    succeed, so a failed deploy never counts as a build that went live.
// 4. Root files the previous record lists but this build doesn't are deleted. Files nobody deployed are never
//    touched.
// 5. CloudFront is invalidated (not waited on; see aws.ts).
// 6. Old assets are pruned (see selectKeptBuilds and assetsToDelete in plan.ts).

import type { PrunePolicy, StoredObject } from './plan.ts';
import {
  ASSET_PREFIX,
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

type Upload = {
  key: string;
  body: Uint8Array | string;
  contentType: string;
  cacheControl: string;
};

type Store = {
  list: (prefix: string) => Promise<StoredObject[]>;
  getText: (key: string) => Promise<string>;
  put: (upload: Upload) => Promise<void>;
  delete: (keys: string[]) => Promise<void>;
};

type Cdn = {
  invalidateAll: (reference: string) => Promise<void>;
};

type LocalBuild = {
  keys: string[];
  read: (key: string) => Promise<Uint8Array>;
};

type DeployOptions = {
  build: LocalBuild;
  store: Store;
  cdn: Cdn;
  policy: PrunePolicy;
  dryRun: boolean;
  sha?: string;
  now?: () => Date;
  log?: (message: string) => void;
  recentUploadGraceMs?: number;
};

type DeployResult = {
  buildId: string;
  uploaded: string[];
  staleDeleted: string[];
  pruned: string[];
};

const UPLOAD_CONCURRENCY = 8;
const RECENT_UPLOAD_GRACE_MS = 60 * 60 * 1000;

const forEachConcurrently = async <T>(items: T[], limit: number, action: (item: T) => Promise<void>): Promise<void> => {
  const queue = [...items];
  const worker = async (): Promise<void> => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await action(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
};

const deploy = async ({
  build,
  store,
  cdn,
  policy,
  dryRun,
  sha,
  now = () => new Date(),
  log = console.log,
  recentUploadGraceMs = RECENT_UPLOAD_GRACE_MS,
}: DeployOptions): Promise<DeployResult> => {
  // Every write goes through here so a dry run can log it instead
  const write = async (description: string, action: () => Promise<unknown>): Promise<void> => {
    if (dryRun) {
      log(`    [dry-run] ${description}`);
      return;
    }
    await action();
  };

  const upload = (keys: string[]): Promise<void> =>
    forEachConcurrently(keys, UPLOAD_CONCURRENCY, async (key) => {
      const body = await build.read(key);
      await write(`put ${key} (${cacheControlFor(key)})`, () => store.put({
        key,
        body,
        contentType: contentTypeFor(key),
        cacheControl: cacheControlFor(key),
      }));
    });

  const keys = build.keys.filter(shouldUpload).toSorted();
  if (!keys.includes('index.html')) {
    throw new Error('index.html not found in the build; build the site first');
  }

  const assets = keys.filter(isAsset);
  const rootFiles = keys.filter(key => !isAsset(key));
  const buildId = createBuildId(now(), sha);

  log(`==> Build ${buildId}: ${assets.length} assets, ${rootFiles.length} other files`);

  const previousIds: string[] = [];
  for (const { key } of await store.list(RECORD_PREFIX)) {
    const id = buildIdFromRecordKey(key);
    if (id) {
      previousIds.push(id);
    }
    else {
      log(`    ignoring ${key}: not a build record`);
    }
  }
  previousIds.sort();

  log('==> Uploading assets (immutable)');
  await upload(assets);

  log('==> Uploading everything else (no-cache)');
  await upload(rootFiles);

  log('==> Recording build');
  await write(`put ${recordKey(buildId)}`, () => store.put({
    key: recordKey(buildId),
    body: formatRecord(keys),
    contentType: 'text/plain; charset=utf-8',
    cacheControl: 'no-cache',
  }));

  const previousId = previousIds.at(-1);
  const previousRecord = previousId ? parseRecord(await store.getText(recordKey(previousId))) : [];
  const staleDeleted = staleRootKeys(previousRecord, new Set(rootFiles));
  if (staleDeleted.length > 0) {
    log(`==> Removing ${staleDeleted.length} files the previous deploy uploaded that this build no longer has`);
    await write(`delete ${staleDeleted.join(', ')}`, () => store.delete(staleDeleted));
  }

  log('==> Invalidating CloudFront');
  await write('invalidate /*', () => cdn.invalidateAll(buildId));

  log(`==> Pruning assets (keep last ${policy.keepBuilds} builds, plus any replaced within ${policy.keepDays} days)`);
  const selection = selectKeptBuilds([...previousIds, buildId], now(), policy);
  if (selection.skip) {
    log(`    skipping: ${selection.reason}`);
    return { buildId, uploaded: keys, staleDeleted, pruned: [] };
  }

  // This build's keys come from memory: its record may not be readable yet, and in a dry run it doesn't exist
  const keptAssets = new Set(keys);
  for (const id of selection.ids) {
    log(`    keeping ${id}`);
    if (id !== buildId) {
      parseRecord(await store.getText(recordKey(id))).forEach(key => keptAssets.add(key));
    }
  }

  const pruned = assetsToDelete(await store.list(ASSET_PREFIX), keptAssets, now(), recentUploadGraceMs);
  if (pruned.length > 0) {
    await write(`delete ${pruned.join(', ')}`, () => store.delete(pruned));
  }
  log(`    pruned ${pruned.length}`);

  return { buildId, uploaded: keys, staleDeleted, pruned };
};

export { deploy };

export type { Cdn, DeployOptions, DeployResult, LocalBuild, Store, Upload };
