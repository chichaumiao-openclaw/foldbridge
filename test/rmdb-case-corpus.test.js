import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_CASE_IDS } from '../scripts/lib/sample-case-ids.mjs';
import { parseTsv } from '../scripts/lib/rmdb-case-corpus.mjs';
import { selectDisplayableCases, buildIndexRow } from '../scripts/lib/rmdb-case-corpus.mjs';

test('sample case ids: 20 unique uppercase pdb ids', () => {
  assert.equal(SAMPLE_CASE_IDS.length, 20);
  assert.equal(new Set(SAMPLE_CASE_IDS).size, 20);
  assert.ok(SAMPLE_CASE_IDS.every((id) => /^[A-Z0-9]{4}$/.test(id)));
});

test('parseTsv: header keyed rows, tab split, trailing newline tolerated', () => {
  const rows = parseTsv('a\tb\tc\n1\t2\t3\n4\t5\t6\n');
  assert.deepEqual(rows, [
    { a: '1', b: '2', c: '3' },
    { a: '4', b: '5', c: '6' }
  ]);
});

test('parseTsv: preserves empty trailing fields', () => {
  const rows = parseTsv('a\tb\tc\n1\t\t\n');
  assert.deepEqual(rows, [{ a: '1', b: '', c: '' }]);
});

const linkRows = [
  { pdb_id: '8CBL', pdb_reference_id: '8CBL_A', detail_route_id: 'pdb:8CBL', rmdb2pdb_available: 'true', filtered_pair_count: '1', filtered_profile_count: '1', filtered_residue_count: '218', confidence_score: '1.000000', confidence_class: 'high_confidence', confidence_summary: 's' },
  { pdb_id: '10FZ', pdb_reference_id: '10FZ_A', rmdb2pdb_available: 'false', confidence_class: 'no_displayable_confidence', confidence_score: '0', filtered_profile_count: '0' }
];

test('selectDisplayableCases keeps only high/medium/low and dedupes by pdb_id', () => {
  const out = selectDisplayableCases(linkRows);
  assert.deepEqual(out.map((r) => r.pdb_id), ['8CBL']);
});

test('selectDisplayableCases dedupes multiple reference rows keeping first', () => {
  const dup = [
    { pdb_id: '8A57', pdb_reference_id: '8A57_A', rmdb2pdb_available: 'true', confidence_class: 'medium_confidence', confidence_score: '0.54', filtered_profile_count: '10' },
    { pdb_id: '8A57', pdb_reference_id: '8A57_B', rmdb2pdb_available: 'true', confidence_class: 'medium_confidence', confidence_score: '0.54', filtered_profile_count: '10' }
  ];
  const out = selectDisplayableCases(dup);
  assert.equal(out.length, 1);
  assert.equal(out[0].pdb_reference_id, '8A57_A');
});

test('buildIndexRow normalizes class label and numeric counts', () => {
  const overviewByPdb = { '8CBL': { display_name: 'Group I intron', display_subtitle: '', pdb_struct_title: 'Group I intron' } };
  const row = buildIndexRow(linkRows[0], overviewByPdb['8CBL']);
  assert.equal(row.pdbId, '8CBL');
  assert.equal(row.confidenceClass, 'high');
  assert.equal(row.confidenceScore, 1);
  assert.equal(row.profileCount, 1);
  assert.equal(row.title, 'Group I intron');
  assert.equal(row.detailHref, '#pdb-case?pdbId=8CBL');
});

test('buildIndexRow falls back through title sources and tolerates missing overview', () => {
  const row = buildIndexRow(linkRows[0], undefined);
  assert.equal(row.title, '8CBL'); // no overview -> pdbId
  const row2 = buildIndexRow(linkRows[0], { display_name: '', display_subtitle: '', pdb_struct_title: 'Crystal structure' });
  assert.equal(row2.title, 'Crystal structure');
});
