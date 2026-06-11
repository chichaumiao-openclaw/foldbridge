import { cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const site = path.join(root, '_site');

await rm(site, { recursive: true, force: true });

await cp(path.join(root, 'dist'), path.join(site, 'dist'), { recursive: true });

for (const rel of ['CNAME', '.nojekyll']) {
  const src = path.join(root, rel);
  if (existsSync(src)) await cp(src, path.join(site, rel));
}

console.log('Pages artifact complete: _site/');
