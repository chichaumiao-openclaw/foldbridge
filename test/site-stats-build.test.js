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
});

test('stats schema has required fields', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  for (const k of ['pdb_total', 'tier_distribution', 'families', 'technologies', 'provenance']) {
    assert.ok(k in stats, `missing ${k}`);
  }
});

test('tier_distribution falls back to run-record constants when no calibration provided', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  // No calibration tables passed in => fallback to run-record 2026-06-27 constants.
  assert.equal(stats.provenance.tier_source, 'run-record 2026-06-27');
  const t = stats.tier_distribution;
  assert.equal(t.STRONG + t.MODERATE + t.WEAK + t.DISCORDANT + t.UNDERPOWERED + t.NOT_SUPPORTED, 218638);
});

test('tier_distribution derives from calibration rows when provided', () => {
  const calibration = {
    rmdbAbcRows: [
      { lss_tier_calibrated: 'LSS_STRONG' },
      { lss_tier_calibrated: 'LSS_MODERATE' },
      { lss_tier_calibrated: 'LSS_NOT_SUPPORTED' }
    ],
    raspDRows: [
      { sasa_reference_status: 'SASA_PRESENT' },
      { sasa_reference_status: 'PAIRING_PROXY_FALLBACK' }
    ],
    source: 'calibration-table 2026-06-27'
  };
  const stats = deriveStats({ index, allowlistTsv: tsv, calibration });
  assert.equal(stats.provenance.tier_source, 'calibration-table 2026-06-27');
  assert.equal(stats.tier_distribution.STRONG, 1);
  assert.equal(stats.tier_distribution.MODERATE, 1);
  assert.equal(stats.tier_distribution.NOT_SUPPORTED, 1);
  assert.equal(stats.family_d_sasa.SASA_PRESENT, 1);
  assert.equal(stats.family_d_sasa.PAIRING_PROXY_FALLBACK, 1);
});
