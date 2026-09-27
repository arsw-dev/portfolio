import { readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

// Every file under dir, as forward-slash keys relative to it (the S3 keys they deploy to)
const listLocalFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
};

export { listLocalFiles };
