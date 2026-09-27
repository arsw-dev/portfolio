// Pure deploy decisions: build IDs, cache headers, content types, and which objects to delete.
// Nothing here touches AWS or the filesystem, so all of it is unit tested.

const ASSET_PREFIX = 'assets/';
const RECORD_PREFIX = '_deploys/';
const DAY_MS = 24 * 60 * 60 * 1000;

const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'no-cache';

// With nosniff (from the security headers policy) browsers trust Content-Type, so a wrong or generic type
// breaks the file (e.g. <track> refuses captions that aren't text/vtt)
const CONTENT_TYPES: Record<string, string> = {
  aac: 'audio/aac',
  atom: 'application/atom+xml',
  avif: 'image/avif',
  csv: 'text/csv; charset=utf-8',
  css: 'text/css; charset=utf-8',
  flac: 'audio/flac',
  gif: 'image/gif',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  htm: 'text/html; charset=utf-8',
  html: 'text/html; charset=utf-8',
  ico: 'image/x-icon',
  ics: 'text/calendar; charset=utf-8',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json',
  jsonld: 'application/ld+json',
  m4a: 'audio/mp4',
  map: 'application/json',
  md: 'text/markdown; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  ogv: 'video/ogg',
  opus: 'audio/opus',
  otf: 'font/otf',
  pdf: 'application/pdf',
  png: 'image/png',
  rss: 'application/rss+xml',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
  vtt: 'text/vtt; charset=utf-8',
  wasm: 'application/wasm',
  wav: 'audio/wav',
  webm: 'video/webm',
  webmanifest: 'application/manifest+json',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  xml: 'application/xml',
  zip: 'application/zip',
};

// Well-known files with no extension, matched by name
const CONTENT_TYPES_BY_NAME: Record<string, string> = {
  'apple-app-site-association': 'application/json',
};

// Vite names hashed files <name>-<8 base64url chars>.<ext>. Requiring a digit, uppercase letter, _ or - in the
// hash keeps names like icon-download.svg (an 8-letter word) from being cached forever; the rare all-lowercase
// real hash just gets no-cache, which is the safe way to be wrong.
const HASHED_NAME_PATTERN = /-(?=[\w-]{0,7}[A-Z0-9_-])[\w-]{8}\.[A-Za-z0-9]+$/;

type PrunePolicy = {
  keepBuilds: number;
  keepDays: number;
};

type StoredObject = {
  key: string;
  lastModified: Date;
};

type KeptBuilds
  = | { skip: true; reason: string }
    | { skip: false; ids: string[] };

// OS metadata that can end up in a local build directory (a macOS Finder visit, a Windows thumbnail cache)
const JUNK_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

const isAsset = (key: string): boolean => key.startsWith(ASSET_PREFIX);

const shouldUpload = (key: string): boolean => !JUNK_FILES.has(key.slice(key.lastIndexOf('/') + 1));

const recordKey = (buildId: string): string => `${RECORD_PREFIX}${buildId}.txt`;

// Anything else under _deploys/ (a console folder marker, a README) is not a build record
const RECORD_KEY_PATTERN = /^_deploys\/(\d{8}T\d{6}Z(?:-[0-9a-f]{7})?)\.txt$/;

const buildIdFromRecordKey = (key: string): string | undefined => RECORD_KEY_PATTERN.exec(key)?.[1];

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

// Only content-hashed build output is safe to cache forever. Unhashed files under assets/ (copied from
// public/assets/) keep their name when their content changes, so they must revalidate.
const isHashedAsset = (key: string): boolean => isAsset(key) && HASHED_NAME_PATTERN.test(key);

const cacheControlFor = (key: string): string => (isHashedAsset(key) ? IMMUTABLE : REVALIDATE);

const contentTypeFor = (key: string): string => {
  const name = key.slice(key.lastIndexOf('/') + 1);
  const byName = CONTENT_TYPES_BY_NAME[name];
  if (byName) {
    return byName;
  }
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

// Assets no kept build references. Anything uploaded within `graceMs` is left alone regardless: it may belong
// to a deploy that's still in progress and hasn't written its record yet.
const assetsToDelete = (
  remote: StoredObject[],
  keptAssets: ReadonlySet<string>,
  now: Date,
  graceMs: number,
): string[] =>
  remote
    .filter(({ key, lastModified }) =>
      isAsset(key) && !keptAssets.has(key) && now.getTime() - lastModified.getTime() >= graceMs)
    .map(({ key }) => key);

// Root files (index.html, public/ files) the previous deploy uploaded that aren't in this build. Only files a
// deploy recorded are ever candidates, so anything placed in the bucket by hand is never deleted.
const staleRootKeys = (previousRecord: string[], currentRootKeys: ReadonlySet<string>): string[] =>
  previousRecord.filter(key => !isAsset(key) && !key.startsWith(RECORD_PREFIX) && !currentRootKeys.has(key));

const parseRecord = (text: string): string[] => text.split('\n').map(line => line.trim()).filter(Boolean);

// A record lists every key its deploy uploaded (assets and root files). Records written before root files were
// included list assets only, which simply means nothing at the root is treated as stale.
const formatRecord = (keys: string[]): string => `${keys.toSorted().join('\n')}\n`;

export {
  ASSET_PREFIX,
  assetsToDelete,
  buildIdFromRecordKey,
  cacheControlFor,
  contentTypeFor,
  createBuildId,
  formatRecord,
  isAsset,
  isHashedAsset,
  parseBuildTime,
  parseRecord,
  RECORD_PREFIX,
  recordKey,
  selectKeptBuilds,
  shouldUpload,
  staleRootKeys,
};

export type { KeptBuilds, PrunePolicy, StoredObject };
