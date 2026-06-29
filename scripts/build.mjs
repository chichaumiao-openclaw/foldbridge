import { cp, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await cp(path.join(root, 'index.html'), path.join(dist, 'index.html'));
await cp(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });

const pdbfilesSrc = path.join(root, 'pdbfiles');
const pdbfilesDist = path.join(dist, 'pdbfiles');
try {
  await cp(pdbfilesSrc, pdbfilesDist, { recursive: true });
} catch {
  // optional folder
}

console.log('Build complete: dist/');
