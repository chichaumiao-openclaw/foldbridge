import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateEvidenceTechniques } from '../scripts/build-annojoin-atlas-technique-enrichment.mjs';

test('aggregates distinct technologies into Probing-page categories and keeps measurement families separate', () => {
  const evidence = { rows: [
    { technology: 'DMS', family: 'A' },
    { technology: '2A3', family: 'B' },
    { technology: 'DMS', family: 'A' }
  ] };
  const out = aggregateEvidenceTechniques(evidence);
  assert.deepEqual(out.names, ['2A3', 'DMS']);
  assert.deepEqual(out.families, ['dms', 'shape']);
  assert.deepEqual(out.measurementFamilies, ['A', 'B']);
});

test('rows missing technology or family are skipped defensively', () => {
  const evidence = { rows: [
    { technology: 'DMS', family: 'A' },
    { technology: '', family: 'A' },
    { family: 'B' },
    { technology: 'PARS' }
  ] };
  const out = aggregateEvidenceTechniques(evidence);
  assert.deepEqual(out.names, ['DMS', 'PARS']);
  assert.deepEqual(out.families, ['dms', 'cleavage']);
  assert.deepEqual(out.measurementFamilies, ['A', 'B']);
});

test('empty or rows-less evidence yields empty sets', () => {
  assert.deepEqual(aggregateEvidenceTechniques({}), { names: [], families: [], measurementFamilies: [] });
  assert.deepEqual(aggregateEvidenceTechniques({ rows: [] }), { names: [], families: [], measurementFamilies: [] });
});
