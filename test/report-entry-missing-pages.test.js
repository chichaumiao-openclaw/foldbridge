import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMissing } from '../scripts/report-entry-missing-pages.mjs';

test('computeMissing lists entry PDBs with no built page', () => {
  const entryRows = [
    { pdb_id: 'A', auth: 'X' }, { pdb_id: 'A', auth: 'Y' },
    { pdb_id: 'B', auth: 'X' }, { pdb_id: 'C', auth: 'X' }
  ];
  const built = new Set(['A', 'B']);
  const missing = computeMissing(entryRows, built);
  assert.deepEqual(missing.map(m => m.pdbId), ['C']);
  assert.equal(missing[0].chainCount, 1);
});

test('computeMissing aggregates distinct chains per missing pdb', () => {
  const entryRows = [
    { pdb_id: 'Z', auth: 'A' }, { pdb_id: 'Z', auth: 'B' }, { pdb_id: 'Z', auth: 'A' },
    { pdb_id: 'Y', auth: 'A' }
  ];
  const built = new Set(['Y']);
  const missing = computeMissing(entryRows, built);
  assert.deepEqual(missing.map(m => m.pdbId), ['Z']);
  assert.equal(missing[0].chainCount, 2); // distinct auth A,B (duplicate A collapses)
});

test('computeMissing returns [] when all entry PDBs are built', () => {
  const entryRows = [
    { pdb_id: 'A', auth: 'X' }, { pdb_id: 'B', auth: 'Y' }
  ];
  const built = new Set(['A', 'B']);
  assert.deepEqual(computeMissing(entryRows, built), []);
});

test('computeMissing sorts missing pdbIds ascending and does not mutate inputs', () => {
  const entryRows = [
    { pdb_id: 'C', auth: 'X' }, { pdb_id: 'A', auth: 'X' }, { pdb_id: 'B', auth: 'X' }
  ];
  const frozen = entryRows.map((r) => Object.freeze({ ...r }));
  const built = new Set();
  const missing = computeMissing(frozen, built);
  assert.deepEqual(missing.map(m => m.pdbId), ['A', 'B', 'C']);
  // inputs untouched
  assert.equal(frozen.length, 3);
  assert.equal(built.size, 0);
});

test('computeMissing uses exact-match membership (no case folding)', () => {
  const entryRows = [
    { pdb_id: '10fz', auth: 'A' }, { pdb_id: '10FZ', auth: 'A' }
  ];
  const built = new Set(['10FZ']); // only upper-case is built
  const missing = computeMissing(entryRows, built);
  assert.deepEqual(missing.map(m => m.pdbId), ['10fz']); // lower-case is still missing
});
