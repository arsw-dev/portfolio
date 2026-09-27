// Checks a deployed site against the build that was just deployed: the live index.html is this build's, every
// asset it references is served with the right cache and content type, .well-known files are served as-is,
// security headers are present, and deep links reach the SPA shell.
//
//   SITE_URL=https://arsw.dev node tools/deploy/src/smoke.ts site/dist

import type { ResponseSnapshot } from './smoke-checks.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { readSmokeConfig } from './env.ts';
import { listLocalFiles, readHashedAssets } from './files.ts';
import {
  BUILD_RECORD_PATH,
  checkDeepLink,
  checkFile,
  checkFileBody,
  checkHomePage,
  checkNotFound,
  checkServedIndex,
  DEEP_LINK_PATH,
  findAssetPaths,
  MISSING_ASSET_PATH,
} from './smoke-checks.ts';

// The deploy doesn't wait for its invalidation, and the edge may hold index.html for CachingOptimized's 1s
// minimum TTL, so give the new index.html up to a minute to appear
const INDEX_ATTEMPTS = 12;
const INDEX_RETRY_MS = 5000;

type Fetched = { snapshot: ResponseSnapshot; body: string };

const request = async (url: string): Promise<Fetched> => {
  const response = await fetch(url, { redirect: 'manual' });
  return {
    snapshot: { status: response.status, header: name => response.headers.get(name) },
    body: await response.text(),
  };
};

const { siteUrl, distDir } = readSmokeConfig();
const failures: string[] = [];

const run = (name: string, results: string[]): void => {
  console.log(`${results.length === 0 ? 'pass' : 'FAIL'}  ${name}`);
  results.forEach(result => console.log(`      ${result}`));
  failures.push(...results.map(result => `${name}: ${result}`));
};

const localIndex = await readFile(join(distDir, 'index.html'), 'utf8');
const hashedAssets = await readHashedAssets(distDir);

let home = await request(`${siteUrl}/`);
for (let attempt = 1; attempt < INDEX_ATTEMPTS && home.body !== localIndex; attempt++) {
  console.log(`      waiting for the new index.html (attempt ${attempt} of ${INDEX_ATTEMPTS - 1})`);
  await sleep(INDEX_RETRY_MS);
  home = await request(`${siteUrl}/`);
}

run('home page is this build', checkServedIndex(home.body, localIndex));
run('home page headers', checkHomePage(home.snapshot));

const deepLink = await request(`${siteUrl}${DEEP_LINK_PATH}`);
run('deep link', checkDeepLink(deepLink.snapshot));

run('missing file is a 404', checkNotFound((await request(`${siteUrl}${MISSING_ASSET_PATH}`)).snapshot));
run('build records are not served', checkNotFound((await request(`${siteUrl}${BUILD_RECORD_PATH}`)).snapshot));

const assetPaths = findAssetPaths(home.body);
if (assetPaths.length === 0) {
  run('assets', ['no /assets/ reference found in the home page']);
}
for (const path of assetPaths) {
  const asset = await request(`${siteUrl}${path}`);
  run(`asset ${path}`, checkFile(path.slice(1), asset.snapshot, hashedAssets));
}

for (const key of (await listLocalFiles(distDir)).filter(key => key.startsWith('.well-known/'))) {
  const served = await request(`${siteUrl}/${key}`);
  const local = await readFile(join(distDir, key), 'utf8');
  run(key, [...checkFile(key, served.snapshot, hashedAssets), ...checkFileBody(key, served.body, local)]);
}

if (failures.length > 0) {
  process.exitCode = 1;
}
