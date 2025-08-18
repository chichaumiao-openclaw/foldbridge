import test from 'node:test';
import assert from 'node:assert/strict';
import {
  browseRows,
  detailEvidenceRows,
  detailRecord,
  featuredRecords,
  provenanceHistory,
  recentPublications,
  siteSummaries,
  DATA_VERSION,
  DETERMINISTIC_SEED
} from '../src/data.js';

test('featured placeholder records include confidence labels', () => {
  assert.equal(featuredRecords.length, 3);
  assert.ok(featuredRecords.every((record) => typeof record.confidence === 'string' && record.confidence.length > 0));
});

test('browse rows expose required columns', () => {
  for (const row of browseRows) {
    assert.ok(row.id && row.name && row.species && row.ligand && row.evidence);
  }
});

test('detail evidence scores are parseable numbers', () => {
  assert.ok(detailEvidenceRows.every((row) => Number.isFinite(Number(row.score))));
});

test('provenance history is chronological', () => {
  const years = provenanceHistory.map((event) => Number(event.slice(0, 4)));
  const sorted = [...years].sort((a, b) => a - b);
  assert.deepEqual(years, sorted);
});

test('site summaries expose deterministic scope stats', () => {
  assert.equal(siteSummaries.length, 3);
  assert.ok(siteSummaries.every((row) => row.site && row.scope && Number.isInteger(row.records) && row.records > 0));
});

test('recent publications include doi-like identifiers and years', () => {
  assert.ok(recentPublications.every((paper) => paper.doi.startsWith('10.') && Number.isInteger(paper.year)));
});

test('detail record includes minimum scientific context fields', () => {
  assert.ok(detailRecord.id && detailRecord.name && detailRecord.organism);
  assert.ok(Number.isInteger(detailRecord.sequenceLength));
});

test('data versioning metadata is present for reproducibility', () => {
  assert.match(DATA_VERSION, /^\d{4}-\d{2}-\d{2}\./);
  assert.equal(DETERMINISTIC_SEED, 20260307);
});
