import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStatsPage } from '../src/siteChrome.js';

const STATS = {
  pdb_total: 2386, probing_entries: 4664, high_confidence_entries: 510, strong_entries: 176,
  source_cases: 2386, technologies: 34, families: 6, articles: 27,
  lss_calibrated_entries: 1671,
  tier_distribution: { STRONG: 91, MODERATE: 280, WEAK: 847, DISCORDANT: 340, UNDERPOWERED: 56, NOT_SUPPORTED: 57 },
  sasa_probe_coverage: { entries: 1247, technologies: { 'Lead-seq': 729, icLASER: 518, 'RL-Seq': 478 } },
  rna_biology: {
    structure_classes: { tRNA: 129, rRNA: 89, other_RNA: 70, riboswitch: 44, viral_genomic_RNA: 40, ribozyme: 25, snRNA: 13, SRP_RNA: 9, aptamer: 9, mRNA: 6, designed_RNA: 4, synthetic_RNA: 3 },
    classified_entries: 441, distinct_families: 339, probe_technologies_present: 24
  },
  technology_threshold_basis: { LITERATURE_SUPPORTED: 1, LITERATURE_INFORMED: 10, OPERATING_VALUE_PENDING_CALIBRATION: 23 },
  provenance: { tier: 'per-entry LSS recall tier from confidenceDisplayLabel', tier_source: 'published-entry confidenceDisplayLabel' }
};

test('renderStatsPage shows 2386 and never leaks 3401', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /2386/);
  assert.doesNotMatch(html, /3401/);
});

test('renderStatsPage surfaces the 4,664 chemical probing entries caliber', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /4,664/);
  assert.match(html, /Chemical probing entries/);
});

test('renderStatsPage surfaces high-confidence + strong entry calibers', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /510/);
  assert.match(html, /High-confidence entries/);
  assert.match(html, /176/);
});

test('renderStatsPage renders tier bar chart as inline svg (entry caliber)', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /<svg/);
  assert.match(html, /STRONG/);
  // Entry-caliber caption references calibrated entries, not full-run segments.
  assert.match(html, /1,671 calibrated entries/);
  assert.doesNotMatch(html, /218,638/);
  assert.doesNotMatch(html, /RMDB ABC segments/);
});

test('renderStatsPage renders RNA biology section (structural classes + families)', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /RNA biology/);
  assert.match(html, /tRNA/);
  assert.match(html, /rRNA/);
  assert.match(html, /riboswitch/);
  // distinct families + classified entries surfaced in the lede
  assert.match(html, /339 distinct RNA families/);
  assert.match(html, /441 entries carry a/);
});

test('renderStatsPage renders SASA-based probing coverage (entry caliber, no segment fallback)', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /SASA-based probing coverage/);
  assert.match(html, /1,247 published entries/);
  assert.match(html, /Lead-seq/);
  assert.match(html, /icLASER/);
  // Legacy Family-D segment language must be gone.
  assert.doesNotMatch(html, /Family D SASA reference/);
  assert.doesNotMatch(html, /Pairing-proxy fallback/);
});

test('renderStatsPage degrades to shell when stats missing', () => {
  const html = renderStatsPage(null);
  assert.match(html, /<h1[^>]*>Statistics<\/h1>/);
  assert.doesNotMatch(html, /undefined/);
});
