import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveStats } from '../scripts/build-site-stats.mjs';
import { renderStatsPage } from '../src/siteChrome.js';

const committedStats = JSON.parse(fs.readFileSync(new URL('../src/assets/generated/site-stats/stats.json', import.meta.url), 'utf8'));

test('pdb_total is the fixed entry_atlas entry total 5321', () => {
  const stats = deriveStats();
  assert.equal(stats.pdb_total, 5321);
  assert.equal(stats.source_cases, 5321);
});

test('renderStatsPage does not expose internal source paths', () => {
  const html = renderStatsPage(committedStats);
  assert.ok(!html.includes('annojoin-atlas-published-case-keys.tsv'), 'rendered stats must not expose an internal source path');
});

test('stats schema has required fields', () => {
  const stats = deriveStats();
  for (const k of ['pdb_total', 'probing_entries', 'high_confidence_entries', 'strong_entries', 'pdb_tier_distribution', 'rna_chain_partitions', 'data_source_distribution', 'measurement_family_distribution', 'families', 'technologies', 'provenance']) {
    assert.ok(k in stats, `missing ${k}`);
  }
  assert.equal(stats.probing_entries, 4664);
  assert.equal(stats.high_confidence_entries, 510);
  assert.equal(stats.strong_entries, 176);
});

test('PDB tier distribution matches the supplied strongest-chain source table', () => {
  const stats = deriveStats();
  const tiers = stats.pdb_tier_distribution;
  assert.deepEqual(tiers, { high: 2689, low: 1210, not_supported: 1422 });
  assert.equal(Object.values(tiers).reduce((sum, count) => sum + count, 0), 5321);
});

test('rna chain partitions match the supplied chain-level source table', () => {
  const stats = deriveStats();
  const partitions = stats.rna_chain_partitions;
  assert.equal(partitions.rRNA, 8794);
  assert.equal(partitions.tRNA, 3763);
  assert.equal(partitions.viral, 304);
  assert.equal(Object.values(partitions).reduce((sum, count) => sum + count, 0), 17837);
});

test('data source distribution matches the chemical-probing entry total', () => {
  const stats = deriveStats();
  const sources = stats.data_source_distribution;
  assert.deepEqual(sources, { rasp: 3904, rmdb: 760 });
  assert.equal(Object.values(sources).reduce((sum, count) => sum + count, 0), stats.probing_entries);
});

test('measurement family distribution is the fixed entry_atlas distribution', () => {
  const stats = deriveStats();
  assert.deepEqual(stats.measurement_family_distribution, {
    base_specific: 5306,
    shape_flexibility: 5320,
    enzymatic_cleavage: 2206,
    solvent_accessibility: 1027,
    contact_mapping: 840
  });
});
