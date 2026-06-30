import { cp, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await cp(path.join(root, 'index.html'), path.join(dist, 'index.html'));
await cp(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });

const pdbfilesSrc = path.join(root, 'pdbfiles');
const pdbfilesDist = path.join(dist, 'pdbfiles');
await copyOptionalDir(pdbfilesSrc, pdbfilesDist);

const publicSrc = path.join(root, 'public');
const publicDist = path.join(dist, 'public');
await copyOptionalDir(publicSrc, publicDist);

console.log('Build complete: dist/');

// Copy a directory that may legitimately be absent. ENOENT (folder not present)
// is ignored; any other error is a real failure (partial copy, disk full,
// permissions) and must fail the build rather than ship an incomplete tree.
async function copyOptionalDir(src, destination) {
  try {
    await cp(src, destination, { recursive: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
}
