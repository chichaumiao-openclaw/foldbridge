import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchDocuments, renderSearchDocumentHtml } from '../src/search/searchCorpus.js';

test('pdb-case docs carry a techniques field derived from atlas index', () => {
  const cases = buildSearchDocuments().filter((d) => d.type === 'pdb-case');
  assert.ok(cases.length > 0);
  // every pdb-case doc has a techniques array (techniqueFamilies if present, else assayFamilies fallback)
  assert.ok(cases.every((d) => Array.isArray(d.techniques)));
  // at least one case has a non-empty technique set (holds today via assayFamilies fallback)
  assert.ok(cases.some((d) => d.techniques.length > 0));
});

test('renderSearchDocumentHtml emits technique Pagefind facet', () => {
  const doc = buildSearchDocuments().find((d) => d.type === 'pdb-case' && d.techniques.length > 0);
  assert.ok(doc, 'expected a pdb-case doc with techniques');
  const html = renderSearchDocumentHtml(doc);
  assert.match(html, /data-pagefind-filter="technique:/);
});
