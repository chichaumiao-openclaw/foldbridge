import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchDocuments, renderSearchDocumentHtml } from '../src/search/searchCorpus.js';

test('search corpus exposes probing-article and pdb-case docs, no dead routes', () => {
  const docs = buildSearchDocuments();

  assert.ok(docs.length >= 8);
  assert.ok(docs.every((doc) => doc.id && doc.title && doc.href && doc.type));

  assert.ok(docs.some((doc) => doc.type === 'pdb-case' && doc.href === '#pdb-case?pdbId=9ELY'));

  const articles = docs.filter((doc) => doc.type === 'probing-article');
  assert.equal(articles.length, 27);
  assert.ok(articles.every((doc) => doc.href.startsWith('#detail?tech=')));

  assert.ok(!docs.some((doc) => ['#browse', '#home', '#publications'].includes(doc.href)));
  assert.ok(!docs.some((doc) => doc.type === 'technology'));
});

test('renderSearchDocumentHtml writes Pagefind metadata and filters', () => {
  const doc = buildSearchDocuments().find((item) => item.id === 'pdb-case-9ely');
  const html = renderSearchDocumentHtml(doc);

  assert.match(html, /data-pagefind-body/);
  assert.match(html, /data-pagefind-filter="type:pdb-case"/);
  assert.match(html, /data-pagefind-meta="href:#pdb-case\?pdbId=9ELY"/);
  assert.match(html, /raiA RNA motif/);
});
