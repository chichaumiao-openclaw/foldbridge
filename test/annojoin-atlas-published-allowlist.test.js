import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePublishedCaseKeyAllowlist,
  filterCasesToPublishedAllowlist
} from '../scripts/lib/annojoin-atlas-published-allowlist.mjs';

test('parsePublishedCaseKeyAllowlist reads atlas_case_key column into a Set', () => {
  const tsv = [
    'atlas_case_key\tsource_report',
    'RMDB2PDB:5GAG\tpages',
    'RASP2PDB:10FZ\t2275_pages',
    '', // blank line tolerated
    'RASP2PDB:1EHZ\t2275_pages'
  ].join('\n');
  const allow = parsePublishedCaseKeyAllowlist(tsv);
  assert.equal(allow instanceof Set, true);
  assert.equal(allow.size, 3);
  assert.equal(allow.has('RMDB2PDB:5GAG'), true);
  assert.equal(allow.has('RASP2PDB:10FZ'), true);
  assert.equal(allow.has('RASP2PDB:1EHZ'), true);
});

test('parsePublishedCaseKeyAllowlist trims whitespace and ignores header-only/empty input', () => {
  assert.equal(parsePublishedCaseKeyAllowlist('').size, 0);
  assert.equal(parsePublishedCaseKeyAllowlist('atlas_case_key\n').size, 0);
  const allow = parsePublishedCaseKeyAllowlist('atlas_case_key\n  RMDB2PDB:5GAG  \n');
  assert.equal(allow.has('RMDB2PDB:5GAG'), true);
});

test('filterCasesToPublishedAllowlist drops case rows whose atlasCaseKey is not published', () => {
  const cases = [
    { asset_family: 'RMDB2PDB', pdb_id: '5GAG', case_id: '5GAG' },
    { asset_family: 'RASP2PDB', pdb_id: '10FZ', case_id: '10FZ' },
    { asset_family: 'RASP2PDB', pdb_id: '1GSG', case_id: '1GSG' } // not published
  ];
  const allow = new Set(['RMDB2PDB:5GAG', 'RASP2PDB:10FZ']);
  const result = filterCasesToPublishedAllowlist(cases, allow);
  assert.equal(result.kept.length, 2);
  assert.equal(result.removedCount, 1);
  assert.deepEqual(result.kept.map((r) => r.pdb_id), ['5GAG', '10FZ']);
});

test('filterCasesToPublishedAllowlist is a no-op when allowlist is empty (unconfigured build)', () => {
  const cases = [
    { asset_family: 'RMDB2PDB', pdb_id: '5GAG', case_id: '5GAG' },
    { asset_family: 'RASP2PDB', pdb_id: '1GSG', case_id: '1GSG' }
  ];
  const result = filterCasesToPublishedAllowlist(cases, new Set());
  assert.equal(result.kept.length, 2);
  assert.equal(result.removedCount, 0);
  assert.equal(result.applied, false);
});

test('filterCasesToPublishedAllowlist reports applied=true when allowlist has entries', () => {
  const result = filterCasesToPublishedAllowlist(
    [{ asset_family: 'RMDB2PDB', pdb_id: '5GAG', case_id: '5GAG' }],
    new Set(['RMDB2PDB:5GAG'])
  );
  assert.equal(result.applied, true);
  assert.equal(result.removedCount, 0);
});
