import { mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildSearchDocuments, renderSearchDocumentHtml } from '../src/search/searchCorpus.js';

const root = process.cwd();
const dist = path.join(root, 'dist');
const searchDocsDir = path.join(dist, 'search-docs');

if (!existsSync(dist)) {
  console.error('Missing dist/. Run npm run build:site after the static site build step.');
  process.exit(1);
}

await rm(searchDocsDir, { recursive: true, force: true });
await mkdir(searchDocsDir, { recursive: true });

const docs = buildSearchDocuments();

for (const doc of docs) {
  await writeFile(path.join(searchDocsDir, `${doc.id}.html`), renderSearchDocumentHtml(doc));
}

await writeFile(
  path.join(searchDocsDir, 'manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      count: docs.length,
      ids: docs.map((doc) => doc.id)
    },
    null,
    2
  )
);

console.log(`Search corpus complete: ${docs.length} documents in dist/search-docs/`);
