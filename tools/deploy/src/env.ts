/* eslint-disable node/no-process-env -- the one place the deploy tool reads its configuration */
import type { PrunePolicy } from './plan.ts';

type DeployConfig = {
  distDir: string;
  bucket: string;
  distributionId: string;
  region: string;
  sha: string | undefined;
  dryRun: boolean;
  policy: PrunePolicy;
};

type SmokeConfig = {
  siteUrl: string;
  distDir: string;
};

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const positiveInteger = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  }
  return value;
};

// Strict so that DRY_RUN=false or DRY_RUN=0 doesn't read as "set" and silently skip a real deploy (or vice versa)
const parseFlag = (name: string, raw: string | undefined): boolean => {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '' || value === '0' || value === 'false') {
    return false;
  }
  if (value === '1' || value === 'true') {
    return true;
  }
  throw new Error(`${name} must be 1/true or 0/false, got "${raw}"`);
};

const readDeployConfig = (): DeployConfig => {
  const distDir = process.argv[2];
  if (!distDir) {
    throw new Error('usage: deploy.ts <dist dir>');
  }

  return {
    distDir,
    bucket: required('S3_BUCKET'),
    distributionId: required('CLOUDFRONT_DISTRIBUTION_ID'),
    region: process.env.AWS_REGION ?? 'us-east-1',
    sha: process.env.GITHUB_SHA,
    dryRun: parseFlag('DRY_RUN', process.env.DRY_RUN),
    policy: {
      keepBuilds: positiveInteger('KEEP_BUILDS', 3),
      keepDays: positiveInteger('KEEP_DAYS', 7),
    },
  };
};

const readSmokeConfig = (): SmokeConfig => {
  const distDir = process.argv[2];
  if (!distDir) {
    throw new Error('usage: smoke.ts <dist dir>');
  }
  return { siteUrl: required('SITE_URL').replace(/\/$/, ''), distDir };
};

export { parseFlag, readDeployConfig, readSmokeConfig };

export type { DeployConfig, SmokeConfig };
