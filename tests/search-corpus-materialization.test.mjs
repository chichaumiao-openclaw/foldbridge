import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSearchDocuments, hasMaterializedCasePage } from '../src/search/searchCorpus.js';

test('excludes a chain whose case page is not materialized', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'foldbridge-search-'));
  await mkdir(path.join(root, 'entry-cases', 'cases', '28NT', 'chains', 'A'), { recursive: true });
  await writeFile(path.join(root, 'entry-cases', 'cases', '28NT', 'index.html'), '');
  await writeFile(path.join(root, 'entry-cases', 'cases', '28NT', 'chains', 'A', 'index.html'), '');

  assert.equal(hasMaterializedCasePage({ caseId: '28NT', chains: ['A'] }, root), true);
  assert.equal(hasMaterializedCasePage({ caseId: '28NT', chains: ['B'] }, root), false);
});

test('search corpus omits the unmaterialized 28NT/B display case', () => {
  const publicRoot = path.resolve('../public');
  const docs = buildSearchDocuments({ publicRoot });
  const broken = docs.filter((doc) => doc.content.includes('28NT') && doc.content.includes('5S rRNA'));
  assert.equal(broken.length, 0);
});

test('search results use the materialized entry-case route', () => {
  const publicRoot = path.resolve('../public');
  const docs = buildSearchDocuments({ publicRoot });
  const doc = docs.find((item) => item.content.includes('3DIQ'));
  assert.ok(doc);
  assert.match(doc.href, /^#entry-case\?pdb=3DIQ&chain=A$/);
});
