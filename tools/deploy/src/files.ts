import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { hashedAssetsFromManifest, MANIFEST_PATH } from './plan.ts';

// Every file under dir, as forward-slash keys relative to it (the S3 keys they deploy to)
const listLocalFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
};

// The hashed files Vite emitted, from dist/.vite/manifest.json. Without a manifest (build.manifest not enabled)
// nothing is treated as hashed: every file revalidates and is re-uploaded, which is slower but never stale.
const readHashedAssets = async (dir: string): Promise<Set<string>> => {
  let text: string;
  try {
    text = await readFile(join(dir, MANIFEST_PATH), 'utf8');
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Set();
    }
    throw error;
  }
  return hashedAssetsFromManifest(JSON.parse(text));
};

export { listLocalFiles, readHashedAssets };
