import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveStats } from '../scripts/build-site-stats.mjs';
import { filterCasesToPublishedAllowlist, parsePublishedCaseKeyAllowlist } from '../scripts/lib/annojoin-atlas-published-allowlist.mjs';
import { renderStatsPage } from '../src/siteChrome.js';

const index = JSON.parse(fs.readFileSync(new URL('../src/assets/generated/annojoin-atlas/index.json', import.meta.url), 'utf8'));
const tsv = fs.readFileSync(new URL('../scripts/data/annojoin-atlas-published-case-keys.tsv', import.meta.url), 'utf8');
const committedStats = JSON.parse(fs.readFileSync(new URL('../src/assets/generated/site-stats/stats.json', import.meta.url), 'utf8'));

test('derived pdb_total matches allowlist AND ground-truth 2386', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  const allow = parsePublishedCaseKeyAllowlist(tsv);
  assert.equal(stats.pdb_total, filterCasesToPublishedAllowlist(index.displayCases, allow).kept.length);
  assert.equal(stats.pdb_total, 2386);
});

test('source_cases is visible-caliber (allowlist-derived), never the raw 3401', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  const allow = parsePublishedCaseKeyAllowlist(tsv);
  const kept = filterCasesToPublishedAllowlist(index.displayCases, allow).kept;
  const visibleSum = kept.reduce((sum, c) => sum + (Number(c.sourceCaseCount) || 0), 0);
  // Locked to the SAME allowlist-filtered set as pdb_total, not a hand-written constant.
  assert.equal(stats.source_cases, visibleSum);
  assert.equal(stats.source_cases, 2386);
  // §2.2 red line: the pre-filter raw 3401 must never be the surfaced source_cases.
  assert.notEqual(stats.source_cases, 3401);
  assert.notEqual(stats.source_cases, index.totalSourceCaseCount);
});

test('renderStatsPage never leaks the raw 3401 to user-facing output', () => {
  const html = renderStatsPage(committedStats);
  assert.ok(!html.includes('3401'), 'rendered stats must not contain 3401');
  assert.ok(!html.includes('3,401'), 'rendered stats must not contain 3,401');
  assert.ok(!html.includes('annojoin-atlas-published-case-keys.tsv'), 'rendered stats must not expose an internal source path');
});

test('stats schema has required fields', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  for (const k of ['pdb_total', 'probing_entries', 'high_confidence_entries', 'strong_entries', 'pdb_tier_distribution', 'rna_chain_partitions', 'data_source_distribution', 'measurement_family_distribution', 'families', 'technologies', 'provenance']) {
    assert.ok(k in stats, `missing ${k}`);
  }
  assert.equal(stats.probing_entries, 4664);
  assert.equal(stats.high_confidence_entries, 510);
  assert.equal(stats.strong_entries, 176);
});

test('PDB tier distribution matches the supplied strongest-chain source table', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  const tiers = stats.pdb_tier_distribution;
  assert.deepEqual(tiers, { high: 2689, low: 1210, not_supported: 1422 });
  assert.equal(Object.values(tiers).reduce((sum, count) => sum + count, 0), 5321);
});

test('rna chain partitions match the supplied chain-level source table', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  const partitions = stats.rna_chain_partitions;
  assert.equal(partitions.rRNA, 8794);
  assert.equal(partitions.tRNA, 3763);
  assert.equal(partitions.viral, 304);
  assert.equal(Object.values(partitions).reduce((sum, count) => sum + count, 0), 17837);
});

test('data source distribution matches the chemical-probing entry total', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  const sources = stats.data_source_distribution;
  assert.deepEqual(sources, { rasp: 3904, rmdb: 760 });
  assert.equal(Object.values(sources).reduce((sum, count) => sum + count, 0), stats.probing_entries);
});

test('measurement family distribution counts published entries with each family', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  assert.deepEqual(stats.measurement_family_distribution, {
    base_specific: 2202,
    shape_flexibility: 2027,
    enzymatic_cleavage: 711,
    solvent_accessibility: 1073,
    contact_mapping: 0
  });
});
