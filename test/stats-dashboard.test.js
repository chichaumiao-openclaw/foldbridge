import assert from 'node:assert/strict';
import test from 'node:test';

import * as dashboard from '../src/statsDashboard.js';

const ROWS = [
  { pdb_id: '1AAA', chain_key: 'A[A]', partition: 'rRNA', n_profiles: 3, entry_confidence_class: 'high', source_lanes: 'geo,rmdb' },
  { pdb_id: '1AAA', chain_key: 'B[B]', partition: 'rRNA', n_profiles: 0, entry_confidence_class: 'low', source_lanes: 'rmdb' },
  { pdb_id: '2BBB', chain_key: 'A[A]', partition: '', n_profiles: 2, entry_confidence_class: 'not_supported', source_lanes: 'geo,rasp' },
  { pdb_id: '3CCC', chain_key: 'A[A]', partition: 'tRNA', n_profiles: 0, entry_confidence_class: 'low', source_lanes: '' }
];

function requireApi(name) {
  assert.equal(typeof dashboard[name], 'function', `${name} should be exported`);
  return dashboard[name];
}

test('empty filters keep every chain and summarize distinct PDBs', () => {
  const emptyStatsFilters = requireApi('emptyStatsFilters');
  const filterStatsRows = requireApi('filterStatsRows');
  const summarizeStatsRows = requireApi('summarizeStatsRows');
  const filters = emptyStatsFilters();

  assert.deepEqual(filters, { rna_class: null, confidence: null, source: null });
  assert.equal(filterStatsRows(ROWS, filters).length, 4);
  assert.deepEqual(summarizeStatsRows(ROWS, filters), { chain_count: 4, pdb_count: 3 });
});

test('toggleStatsFilter replaces one dimension and toggles the same value off', () => {
  const emptyStatsFilters = requireApi('emptyStatsFilters');
  const toggleStatsFilter = requireApi('toggleStatsFilter');
  const start = emptyStatsFilters();
  const selected = toggleStatsFilter(start, 'confidence', 'high');

  assert.deepEqual(start, { rna_class: null, confidence: null, source: null });
  assert.deepEqual(selected, { rna_class: null, confidence: 'high', source: null });
  assert.deepEqual(toggleStatsFilter(selected, 'confidence', 'high'), start);
});

test('filters combine across dimensions with AND logic', () => {
  const emptyStatsFilters = requireApi('emptyStatsFilters');
  const toggleStatsFilter = requireApi('toggleStatsFilter');
  const filterStatsRows = requireApi('filterStatsRows');
  let filters = emptyStatsFilters();
  filters = toggleStatsFilter(filters, 'rna_class', 'rRNA');
  filters = toggleStatsFilter(filters, 'confidence', 'high');
  filters = toggleStatsFilter(filters, 'source', 'rmdb');

  assert.deepEqual(filterStatsRows(ROWS, filters).map((row) => row.chain_key), ['A[A]']);
});

test('source filters use membership and empty partition maps to Unclassified RNA', () => {
  const filterStatsRows = requireApi('filterStatsRows');
  const unclassified = filterStatsRows(ROWS, { rna_class: 'Unclassified RNA', confidence: null, source: 'rasp' });
  assert.deepEqual(unclassified.map((row) => row.pdb_id), ['2BBB']);
});

test('clearStatsFilters resets all dimensions', () => {
  const clearStatsFilters = requireApi('clearStatsFilters');
  assert.deepEqual(clearStatsFilters(), { rna_class: null, confidence: null, source: null });
});

test('unknown dimensions and invalid fixed values fail explicitly', () => {
  const emptyStatsFilters = requireApi('emptyStatsFilters');
  const toggleStatsFilter = requireApi('toggleStatsFilter');
  assert.throws(() => toggleStatsFilter(emptyStatsFilters(), 'family', 'A'), /unknown stats filter dimension/i);
  assert.throws(() => toggleStatsFilter(emptyStatsFilters(), 'source', 'mystery'), /source.*mystery/i);
});

test('filterStatsRows rejects unknown filter fields and invalid direct values', () => {
  const filterStatsRows = requireApi('filterStatsRows');
  assert.throws(
    () => filterStatsRows(ROWS, { rna_class: null, confidence: null, source: null, family: 'A' }),
    /unknown stats filter dimension.*family/i
  );
  assert.throws(
    () => filterStatsRows(ROWS, { rna_class: null, confidence: null, source: 'mystery' }),
    /source.*mystery/i
  );
});
