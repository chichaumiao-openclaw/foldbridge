import assert from 'node:assert/strict';
import test from 'node:test';

import { renderStatsPage } from '../src/siteChrome.js';
import { deriveEntryStatsContract, emptyStatsFilters } from '../src/statsDashboard.js';

const ROWS = [
  { pdb_id: '1AAA', chain_key: 'A[A]', partition: 'rRNA', n_profiles: 3, entry_confidence_class: 'high', source_lanes: 'geo,rmdb' },
  { pdb_id: '1AAA', chain_key: 'B[B]', partition: 'rRNA', n_profiles: 0, entry_confidence_class: 'low', source_lanes: 'rmdb' },
  { pdb_id: '2BBB', chain_key: 'A[A]', partition: 'tRNA', n_profiles: 2, entry_confidence_class: 'not_supported', source_lanes: 'rasp' }
];
const CONTRACT = deriveEntryStatsContract(ROWS);
const STATS = {
  schema_version: 'site-stats.v2',
  entry_schema_version: 'entry-table.v1',
  entry_contract: CONTRACT,
  metrics: { ...CONTRACT.metrics, registered_technologies: 2, explainer_articles: 1 },
  distributions: CONTRACT.distributions
};

test('renderStatsPage renders six derived headline metrics', () => {
  const html = renderStatsPage({ status: 'ready', stats: STATS, rows: ROWS, filters: emptyStatsFilters() });
  for (const label of [
    'RNA chains',
    'PDB structures',
    'Chains with probing profiles',
    'PDBs with ≥1 high-confidence chain',
    'Registered technologies',
    'Explainer articles'
  ]) assert.match(html, new RegExp(label));
  assert.match(html, />3<\/span>[\s\S]*RNA chains/);
  assert.doesNotMatch(html, /Chemical probing entries|Measurement families/);
});

test('renderStatsPage exposes three accessible filter panels with global counts', () => {
  const html = renderStatsPage({ status: 'ready', stats: STATS, rows: ROWS, filters: emptyStatsFilters() });
  assert.match(html, /data-stats-panel="rna_class"/);
  assert.match(html, /data-stats-panel="confidence"/);
  assert.match(html, /data-stats-panel="source"/);
  assert.match(html, /data-stats-filter-dimension="rna_class"/);
  assert.match(html, /data-stats-filter-dimension="confidence"/);
  assert.match(html, /data-stats-filter-dimension="source"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /Source categories overlap/);
});

test('renderStatsPage renders active chips, reset, and filtered chain/PDB summary', () => {
  const filters = { rna_class: null, confidence: null, source: 'rmdb' };
  const html = renderStatsPage({ status: 'ready', stats: STATS, rows: ROWS, filters });
  assert.match(html, /data-stats-filter-chip="source"/);
  assert.match(html, /data-stats-reset/);
  assert.match(html, /Showing <strong>2<\/strong> of 3 RNA chains across <strong>1<\/strong> of 2 PDB structures/);
  assert.match(html, /data-stats-filter-value="rmdb"[\s\S]*aria-pressed="true"/);
  assert.match(html, /href="#entry"/);
});

test('renderStatsPage shows an explicit unavailable state without stale numbers', () => {
  const html = renderStatsPage({ status: 'error', error: 'entry table contract does not match stats' });
  assert.match(html, /Statistics unavailable/);
  assert.match(html, /entry table contract does not match stats/);
  assert.doesNotMatch(html, /4,664|5,321|undefined/);
});

test('renderStatsPage keeps a loading shell while assets are in flight', () => {
  const html = renderStatsPage({ status: 'loading' });
  assert.match(html, /<h1>Statistics<\/h1>/);
  assert.match(html, /Loading the current published statistics/);
  assert.doesNotMatch(html, /undefined/);
});
