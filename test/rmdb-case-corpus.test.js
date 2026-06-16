import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_CASE_IDS } from '../scripts/lib/sample-case-ids.mjs';
import { parseTsv } from '../scripts/lib/rmdb-case-corpus.mjs';
import { selectDisplayableCases, buildIndexRow } from '../scripts/lib/rmdb-case-corpus.mjs';
import {
  groupReactivityByProfile,
  buildReactivitySummary,
  sliceReactivityWindows,
  slugifyProfileKey
} from '../scripts/lib/rmdb-case-corpus.mjs';

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

// pdb_axis_reactivity 行：pdb_pos, pdb_base, reactivity, bundle_profile_id ...
const reacRows = [
  ...Array.from({ length: 200 }, (_, i) => ({ pdb_pos: String(i + 1), pdb_base: 'G', reactivity: String((i % 10) / 10), bundle_profile_id: 'p1', reactivity_error: '0.1' })),
  ...Array.from({ length: 200 }, (_, i) => ({ pdb_pos: String(i + 1), pdb_base: 'A', reactivity: String((i % 7) / 10), bundle_profile_id: 'p2', reactivity_error: '0.2' }))
];

test('groupReactivityByProfile splits rows by bundle_profile_id preserving per-profile pos sequence', () => {
  const groups = groupReactivityByProfile(reacRows);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.profileId).sort(), ['p1', 'p2']);
  const p1 = groups.find((g) => g.profileId === 'p1');
  assert.equal(p1.rows.length, 200);
  assert.ok(p1.rows.every((r) => r.bundle_profile_id === 'p1'));
  // 同一 pdb_pos 在 p1/p2 各出现一次，分组后两组互不串行（钉死交错失真风险）
  const p2 = groups.find((g) => g.profileId === 'p2');
  assert.ok(p2.rows.every((r) => r.bundle_profile_id === 'p2'));
  assert.equal(p1.rows.filter((r) => r.pdb_pos === '1').length, 1);
});

test('slugifyProfileKey makes filesystem-safe key', () => {
  assert.equal(slugifyProfileKey('RMDB_ID:profile/1'), 'rmdb-id-profile-1');
});

test('slugifyProfileKey handles real bundle_profile_id with lane + rdat path', () => {
  const key = slugifyProfileKey('top_x_279::data-eterna/data-eterna/OK3TST_2A3_0000.rdat#64272');
  assert.match(key, /^[a-z0-9-]+$/);
  assert.ok(!key.startsWith('-') && !key.endsWith('-'));
});

test('buildReactivitySummary downsamples to <=64 points and keeps pos range (single profile group)', () => {
  const group = groupReactivityByProfile(reacRows).find((g) => g.profileId === 'p1');
  const s = buildReactivitySummary(group.rows);
  assert.ok(s.trackPreview.length <= 64);
  assert.equal(s.minPos, 1);
  assert.equal(s.maxPos, 200);
  assert.ok(s.trackPreview.every((p) => Number.isInteger(p.pdbPos)));
});

test('buildReactivitySummary tolerates NaN reactivity strings from real data', () => {
  const rows = [
    { pdb_pos: '1', pdb_base: 'G', reactivity: 'NaN', reactivity_error: 'NaN', bundle_profile_id: 'p1' },
    { pdb_pos: '2', pdb_base: 'U', reactivity: '0.5', reactivity_error: '0.1', bundle_profile_id: 'p1' }
  ];
  const s = buildReactivitySummary(rows);
  assert.equal(s.minPos, 1);
  assert.equal(s.maxPos, 2);
  // NaN 反应性映射为 null，不破坏降采样
  const p1 = s.trackPreview.find((p) => p.pdbPos === 1);
  assert.equal(p1.reactivity, null);
});

test('sliceReactivityWindows splits a single profile group by fixed position window', () => {
  const group = groupReactivityByProfile(reacRows).find((g) => g.profileId === 'p1');
  const windows = sliceReactivityWindows(group.rows, 100);
  assert.equal(windows.length, 2);
  assert.equal(windows[0].start, 1);
  assert.equal(windows[0].end, 100);
  assert.ok(windows[0].rows.length > 0);
});
