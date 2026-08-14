import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStatsPage } from '../src/siteChrome.js';

const STATS = {
  pdb_total: 2386, probing_entries: 4664, high_confidence_entries: 510, strong_entries: 176,
  source_cases: 2386, technologies: 26, families: 5, articles: 26,
  pdb_tier_distribution: { high: 2689, low: 1210, not_supported: 1422 },
  rna_chain_partitions: { rRNA: 8794, tRNA: 3763, other_RNA: 1629, mRNA: 1544, ribozyme: 493, riboswitch: 492, snRNA: 489, viral: 304, aptamer: 128, synthetic_RNA: 92, SRP_RNA: 75, designed_RNA: 34 },
  data_source_distribution: { rasp: 3904, rmdb: 760 },
  measurement_family_distribution: { base_specific: 2202, shape_flexibility: 2027, enzymatic_cleavage: 711, solvent_accessibility: 1073, contact_mapping: 0 },
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
});

test('renderStatsPage keeps the entry definition concise', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /Each entry groups PDB chains with the same biological-molecule name within one structure\./);
  assert.doesNotMatch(html, /An entry is a set of published PDB chains/);
  assert.doesNotMatch(html, /How these statistics are counted/);
  assert.doesNotMatch(html, /stats-footnote/);
  assert.doesNotMatch(html, /Source:/);
  assert.doesNotMatch(html, /annojoin-atlas-published-case-keys\.tsv/);
});

test('renderStatsPage uses the curated method, family, and article counts', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, />26<\/span>\s*<span class="stats-metric-label">Probe technologies/);
  assert.match(html, />5<\/span>\s*<span class="stats-metric-label">Measurement families/);
  assert.match(html, />26<\/span>\s*<span class="stats-metric-label">Probing articles/);
  assert.doesNotMatch(html, /stats-metric-note/);
});

test('renderStatsPage renders RNA types as the full-width statistics chart', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /RNA types/);
  assert.match(html, /class="stats-section stats-rna-types"/);
  assert.doesNotMatch(html, /PDB tier distribution/);
  assert.doesNotMatch(html, /stats-pdb-tier-pie/);
  assert.doesNotMatch(html, /stats-distribution-grid/);
});

test('renderStatsPage renders the RNA chain partition distribution', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /RNA types/);
  assert.match(html, /17,837 chains/);
  assert.match(html, /tRNA/);
  assert.match(html, /rRNA/);
  assert.match(html, /riboswitch/);
  assert.match(html, /synthetic_RNA/);
  assert.match(html, /designed_RNA/);
  assert.match(html, /8,794/);
  assert.match(html, /style="--stats-rna-fill:#D5A52B"/);
  assert.doesNotMatch(html, /441 entries carry a/);
});

test('renderStatsPage renders RNA chain partitions as vertical bars', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /class="stats-rna-chain-column"/);
  assert.match(html, /style="height:100%"/);
  assert.match(html, /stats-rna-chain-value">8,794<\/span>\s*<span class="stats-rna-chain-track">/);
  assert.match(html, /stats-rna-chain-fill" style="height:100%"><span class="stats-rna-chain-pct">49\.3%/);
  assert.doesNotMatch(html, /class="stats-rna-chain-row"/);
  assert.doesNotMatch(html, /style="width:100%"/);
});

test('renderStatsPage omits the data source and measurement family chart sections', () => {
  const html = renderStatsPage(STATS);
  assert.doesNotMatch(html, /Data source composition/);
  assert.doesNotMatch(html, /Measurement family distribution/);
  assert.doesNotMatch(html, /stats-family-chart/);
});

test('renderStatsPage omits the SASA-based probing coverage detail', () => {
  const html = renderStatsPage(STATS);
  assert.doesNotMatch(html, /SASA-based probing coverage/);
  assert.doesNotMatch(html, /Lead-seq/);
  assert.doesNotMatch(html, /icLASER/);
});

test('renderStatsPage omits the technology threshold basis summary', () => {
  const html = renderStatsPage(STATS);
  assert.doesNotMatch(html, /Technology threshold basis/);
  assert.doesNotMatch(html, /Honesty on thresholds/);
  assert.doesNotMatch(html, /operating value pending calibration/);
});

test('renderStatsPage degrades to shell when stats missing', () => {
  const html = renderStatsPage(null);
  assert.match(html, /<h1[^>]*>Statistics<\/h1>/);
  assert.doesNotMatch(html, /undefined/);
});
