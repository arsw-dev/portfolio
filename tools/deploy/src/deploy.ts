// Deploy a Vite build to S3 behind CloudFront. The sequence itself lives in pipeline.ts.
//
//   S3_BUCKET=... CLOUDFRONT_DISTRIBUTION_ID=... node tools/deploy/src/deploy.ts site/dist
//
// Optional env: KEEP_BUILDS (default 3), KEEP_DAYS (default 7), DRY_RUN=1 (log writes instead of making them).

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { createCloudFrontCdn, createS3Store } from './aws.ts';
import { readDeployConfig } from './env.ts';
import { deploy } from './pipeline.ts';

const listLocalFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
};

const config = readDeployConfig();

await deploy({
  build: {
    keys: await listLocalFiles(config.distDir),
    read: key => readFile(join(config.distDir, key)),
  },
  store: createS3Store(config.region, config.bucket),
  cdn: createCloudFrontCdn(config.region, config.distributionId),
  policy: config.policy,
  dryRun: config.dryRun,
  sha: config.sha,
});

console.log('==> Done');
