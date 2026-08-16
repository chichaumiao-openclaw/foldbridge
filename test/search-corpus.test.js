import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchDocuments, renderSearchDocumentHtml } from '../src/search/searchCorpus.js';

test('search corpus exposes probing-article and pdb-case docs, no dead routes', () => {
  const docs = buildSearchDocuments();

  assert.ok(docs.length >= 8);
  assert.ok(docs.every((doc) => doc.id && doc.title && doc.href && doc.type));

  // pdb-case docs route to the in-app #annojoin-case handler (atlas case assets
  // exist for every displayCase, unlike the partially-materialized static pages).
  const cases = docs.filter((doc) => doc.type === 'pdb-case');
  assert.ok(cases.length > 0);
  assert.ok(cases.every((doc) => doc.href.startsWith('#annojoin-case?caseId=')));

  const entryCase = cases.find((doc) => doc.href.includes('caseId=10FZ'));
  assert.ok(entryCase, '10FZ entry_atlas case should be indexed from the atlas');
  assert.equal(entryCase.href, '#annojoin-case?caseId=10FZ&caseKey=ENTRY%3A10FZ%3AA');
  // The molecule title is no longer echoed into the summary line (old corpus did
  // `${pdbId} ${title}. ${subtitle}`), which is what stacked the excerpt text.
  assert.ok(!entryCase.summary.includes(entryCase.title));
  assert.match(entryCase.summary, /^PDB 10FZ · /);

  const articles = docs.filter((doc) => doc.type === 'probing-article');
  assert.equal(articles.length, 37);
  assert.ok(articles.every((doc) => doc.href.startsWith('#probing?tech=')));

  assert.ok(!docs.some((doc) => ['#browse', '#home', '#publications'].includes(doc.href)));
  assert.ok(!docs.some((doc) => doc.type === 'technology'));
  // The obsolete #pdb-case route must no longer be emitted.
  assert.ok(!docs.some((doc) => doc.href.startsWith('#pdb-case')));
});

test('renderSearchDocumentHtml writes Pagefind metadata and filters', () => {
  const doc = buildSearchDocuments().find((item) => item.href.includes('caseId=10FZ'));
  const html = renderSearchDocumentHtml(doc);

  assert.match(html, /data-pagefind-body/);
  assert.match(html, /data-pagefind-filter="type:pdb-case"/);
  assert.match(html, /data-pagefind-meta="href:#annojoin-case\?caseId=10FZ&amp;caseKey=ENTRY%3A10FZ%3AA/);
  assert.match(html, /16S rRNA/);
});
