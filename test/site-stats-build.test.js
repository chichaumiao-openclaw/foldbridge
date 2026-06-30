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
  for (const k of ['pdb_total', 'probing_entries', 'high_confidence_entries', 'strong_entries', 'tier_distribution', 'lss_calibrated_entries', 'sasa_probe_coverage', 'rna_biology', 'families', 'technologies', 'provenance']) {
    assert.ok(k in stats, `missing ${k}`);
  }
  assert.equal(stats.probing_entries, 4664);
  assert.equal(stats.high_confidence_entries, 510);
  assert.equal(stats.strong_entries, 176);
});

test('tier_distribution is entry-caliber (sums to LSS-calibrated published entries, NOT full-run 218638 segments)', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  const t = stats.tier_distribution;
  const sum = t.STRONG + t.MODERATE + t.WEAK + t.DISCORDANT + t.UNDERPOWERED + t.NOT_SUPPORTED;
  // Entry caliber: tiers are parsed per published entry, so the total equals the
  // count of calibrated entries — never the full-run segment total.
  assert.equal(sum, stats.lss_calibrated_entries);
  assert.notEqual(sum, 218638);
  // Each tier is a published-entry subset → can never exceed pdb_total.
  assert.ok(sum <= stats.pdb_total, `tier sum ${sum} exceeds pdb_total ${stats.pdb_total}`);
  assert.equal(stats.provenance.tier_source, 'published-entry confidenceDisplayLabel');
});

test('sasa_probe_coverage counts published entries by SASA footprinting probe (entry caliber)', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  const cov = stats.sasa_probe_coverage;
  assert.ok(Number.isFinite(cov.entries));
  assert.ok(cov.entries > 0 && cov.entries <= stats.pdb_total);
  // Only SASA-based Family-D probes appear; the legacy segment-level keys are gone.
  for (const k of Object.keys(cov.technologies)) {
    assert.ok(['RL-Seq', 'Lead-seq', 'icLASER', 'HRF'].includes(k), `unexpected SASA probe ${k}`);
  }
  assert.ok(!('family_d_sasa' in stats), 'legacy segment-level family_d_sasa must be removed');
});

test('rna_biology derives structural classes / families / technologies (entry caliber)', () => {
  const stats = deriveStats({ index, allowlistTsv: tsv });
  const bio = stats.rna_biology;
  assert.ok(bio.classified_entries > 0 && bio.classified_entries <= stats.pdb_total);
  assert.ok(bio.distinct_families > 0);
  assert.ok(bio.probe_technologies_present > 0);
  // Common RNA classes must be present and noise/pending placeholders excluded.
  assert.ok(bio.structure_classes.tRNA > 0);
  assert.ok(bio.structure_classes.rRNA > 0);
  for (const k of Object.keys(bio.structure_classes)) {
    assert.ok(!/^pending|^URS|^pdbmol_|^pdbreg_|未注释/i.test(k), `noise class leaked: ${k}`);
  }
});
