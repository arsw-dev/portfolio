// Checks a deployed site: home page headers, the SPA fallback for deep links, and asset caching.
//
//   SITE_URL=https://arsw.dev node tools/deploy/src/smoke.ts

import type { ResponseSnapshot } from './smoke-checks.ts';
import { readSmokeConfig } from './env.ts';
import { checkAsset, checkDeepLink, checkHomePage, DEEP_LINK_PATH, findAssetPath } from './smoke-checks.ts';

const request = async (url: string): Promise<{ snapshot: ResponseSnapshot; body: string }> => {
  const response = await fetch(url, { redirect: 'manual' });
  return {
    snapshot: { status: response.status, header: name => response.headers.get(name) },
    body: await response.text(),
  };
};

const { siteUrl } = readSmokeConfig();
const failures: string[] = [];

const run = (name: string, results: string[]): void => {
  console.log(`${results.length === 0 ? 'pass' : 'FAIL'}  ${name}`);
  results.forEach(result => console.log(`      ${result}`));
  failures.push(...results.map(result => `${name}: ${result}`));
};

const home = await request(`${siteUrl}/`);
run('home page', checkHomePage(home.snapshot));

const deepLink = await request(`${siteUrl}${DEEP_LINK_PATH}`);
run('deep link', checkDeepLink(deepLink.snapshot));

const assetPath = findAssetPath(home.body);
if (assetPath) {
  const asset = await request(`${siteUrl}${assetPath}`);
  run(`asset ${assetPath}`, checkAsset(asset.snapshot));
}
else {
  run('asset', ['no /assets/ reference found in the home page']);
}

if (failures.length > 0) {
  process.exitCode = 1;
}
