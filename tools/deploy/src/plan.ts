// Pure deploy decisions: build IDs, cache headers, content types, and which objects to delete.
// Nothing here touches AWS or the filesystem, so all of it is unit tested.

const ASSET_PREFIX = 'assets/';
const RECORD_PREFIX = '_deploys/';
const DAY_MS = 24 * 60 * 60 * 1000;

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

const CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  css: 'text/css; charset=utf-8',
  gif: 'image/gif',
  html: 'text/html; charset=utf-8',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json',
  map: 'application/json',
  mjs: 'text/javascript; charset=utf-8',
  mp4: 'video/mp4',
  otf: 'font/otf',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
  wasm: 'application/wasm',
  webm: 'video/webm',
  webmanifest: 'application/manifest+json',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  xml: 'application/xml',
};

type PrunePolicy = {
  keepBuilds: number;
  keepDays: number;
};

type KeptBuilds
  = | { skip: true; reason: string }
    | { skip: false; ids: string[] };

// OS metadata that can end up in a local build directory (a macOS Finder visit, a Windows thumbnail cache)
const JUNK_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

const isAsset = (key: string): boolean => key.startsWith(ASSET_PREFIX);

const shouldUpload = (key: string): boolean => !JUNK_FILES.has(key.slice(key.lastIndexOf('/') + 1));

const recordKey = (buildId: string): string => `${RECORD_PREFIX}${buildId}.txt`;

const buildIdFromRecordKey = (key: string): string => key.slice(RECORD_PREFIX.length).replace(/\.txt$/, '');

// Build IDs start with a compact UTC timestamp (20260926T235452Z) so they sort chronologically as strings
const createBuildId = (now: Date, sha?: string): string => {
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return sha ? `${timestamp}-${sha.slice(0, 7)}` : timestamp;
};

const parseBuildTime = (buildId: string): Date => {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(buildId);
  if (!match) {
    throw new Error(`Invalid build ID: ${buildId}`);
  }
  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
};

const cacheControlFor = (key: string): string => (isAsset(key) ? IMMUTABLE : REVALIDATE);

const contentTypeFor = (key: string): string => {
  const name = key.slice(key.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  const extension = dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
};

// A build's assets are kept while it's one of the last `keepBuilds` builds, or while the build that replaced it
// went live less than `keepDays` ago: tabs opened before the replacement may still lazy-load its chunks.
// Assets uploaded before build records existed belong to no record, so nothing is pruned until the first
// record is itself older than `keepDays`, giving the build it replaced the same grace period.
const selectKeptBuilds = (buildIds: string[], now: Date, policy: PrunePolicy): KeptBuilds => {
  const ids = buildIds.toSorted();
  const cutoff = now.getTime() - policy.keepDays * DAY_MS;

  if (ids.length === 0) {
    return { skip: true, reason: 'no build records' };
  }
  if (parseBuildTime(ids[0]!).getTime() > cutoff) {
    return { skip: true, reason: `first build record is newer than ${policy.keepDays} days` };
  }

  const kept = ids.filter((_, index) => {
    const isRecent = index >= ids.length - policy.keepBuilds;
    const next = ids[index + 1];
    const replacedRecently = next !== undefined && parseBuildTime(next).getTime() > cutoff;
    return isRecent || replacedRecently;
  });

  return { skip: false, ids: kept };
};

const assetsToDelete = (remoteKeys: string[], keptAssets: ReadonlySet<string>): string[] =>
  remoteKeys.filter(key => isAsset(key) && !keptAssets.has(key));

// Root files (index.html, public/ files) that are no longer in the build. Assets and build records are
// managed by pruning, never here.
const staleRootKeys = (remoteKeys: string[], localKeys: ReadonlySet<string>): string[] =>
  remoteKeys.filter(key => !isAsset(key) && !key.startsWith(RECORD_PREFIX) && !localKeys.has(key));

const parseRecord = (text: string): string[] => text.split('\n').map(line => line.trim()).filter(Boolean);

const formatRecord = (assetKeys: string[]): string => `${assetKeys.toSorted().join('\n')}\n`;

export {
  assetsToDelete,
  buildIdFromRecordKey,
  cacheControlFor,
  contentTypeFor,
  createBuildId,
  formatRecord,
  isAsset,
  parseBuildTime,
  parseRecord,
  RECORD_PREFIX,
  recordKey,
  selectKeptBuilds,
  shouldUpload,
  staleRootKeys,
};

export type { KeptBuilds, PrunePolicy };
