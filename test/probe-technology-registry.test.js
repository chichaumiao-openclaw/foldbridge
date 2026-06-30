import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = JSON.parse(
  fs.readFileSync(new URL('../src/assets/data/probe-technology-registry.json', import.meta.url), 'utf8')
);
const articlesIndex = JSON.parse(
  fs.readFileSync(new URL('../src/assets/generated/probing-articles/index.json', import.meta.url), 'utf8')
);

test('registry carries all 34 technologies', () => {
  assert.equal(registry.technologies.length, 34);
});

test('threshold_basis tier counts match TSV ground truth', () => {
  const counts = { SUPPORTED: 0, INFORMED: 0, PENDING: 0 };
  for (const row of registry.technologies) {
    counts[row.threshold_basis] += 1;
  }
  assert.deepEqual(counts, { SUPPORTED: 1, INFORMED: 10, PENDING: 23 });
  // declared counts block agrees with the rows
  assert.deepEqual(registry.threshold_basis_counts, { SUPPORTED: 1, INFORMED: 10, PENDING: 23 });
});

test('every family is one of A–F', () => {
  const allowed = new Set(['A', 'B', 'C', 'D', 'E', 'F']);
  for (const row of registry.technologies) {
    assert.ok(allowed.has(row.family), `unexpected family ${row.family} for ${row.technology}`);
  }
});

test('article_slug, when present, exists in the probing articles index', () => {
  const known = new Set((articlesIndex.articles || []).map((a) => a.slug));
  const linked = registry.technologies.filter((r) => r.article_slug);
  assert.ok(linked.length >= 1, 'expected at least one linked technology');
  for (const row of linked) {
    assert.ok(known.has(row.article_slug), `dangling slug ${row.article_slug} for ${row.technology}`);
  }
});
