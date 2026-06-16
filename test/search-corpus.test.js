import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchDocuments, renderSearchDocumentHtml } from '../src/search/searchCorpus.js';

test('search corpus exposes lightweight documents with filters and target hrefs', () => {
  const docs = buildSearchDocuments();

  assert.ok(docs.length >= 8);
  assert.ok(docs.every((doc) => doc.id && doc.title && doc.href && doc.type));
  assert.ok(docs.some((doc) => doc.type === 'pdb-case' && doc.href === '#pdb-case?pdbId=5KPY'));
  assert.ok(docs.some((doc) => doc.tags.includes('technology')));
});

test('renderSearchDocumentHtml writes Pagefind metadata and filters', () => {
  const doc = buildSearchDocuments().find((item) => item.id === 'pdb-case-5kpy');
  const html = renderSearchDocumentHtml(doc);

  assert.match(html, /data-pagefind-body/);
  assert.match(html, /data-pagefind-filter="type:pdb-case"/);
  assert.match(html, /data-pagefind-filter="tag:aptamer"/);
  assert.match(html, /data-pagefind-meta="href:#pdb-case\?pdbId=5KPY"/);
  assert.match(html, /5-hydroxytryptophan RNA aptamer/);
});
