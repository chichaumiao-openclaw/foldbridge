import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const SAFE_RDAT_NAME = /^(?!\.\.?(?:\.rdat)?$)[^/\\]+\.rdat$/i;

async function collectRdatFiles(dir, index) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectRdatFiles(fullPath, index);
    } else if (entry.isFile() && SAFE_RDAT_NAME.test(entry.name)) {
      // RMDB filenames are the stable join key exposed in profile_id. Keep
      // lookup basename-only so data-general/data-general/foo.rdat and the
      // other source prefixes do not need to be reconstructed in the browser.
      index.set(entry.name, fullPath);
    }
  }
}

export async function createRmdbRdatResolver(root) {
  const index = new Map();
  try {
    await collectRdatFiles(root, index);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return (filename) => {
    const safeName = decodeURIComponent(String(filename || ''));
    if (!SAFE_RDAT_NAME.test(safeName)) return null;
    return index.get(safeName) || null;
  };
}

export function isRmdbRdatRequest(urlPath) {
  return String(urlPath || '').startsWith('/api/rmdb/rdat/');
}

export function rmdbRdatFilenameFromRequest(urlPath) {
  return String(urlPath || '').slice('/api/rmdb/rdat/'.length).split('?')[0];
}
