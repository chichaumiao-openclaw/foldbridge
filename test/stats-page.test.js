import test from 'node:test';
import assert from 'node:assert/strict';
import { renderStatsPage } from '../src/siteChrome.js';

const STATS = {
  pdb_total: 2386, probing_entries: 4664, high_confidence_entries: 510, strong_entries: 176,
  source_cases: 4070, technologies: 34, families: 6, articles: 27,
  tier_distribution: { STRONG: 283, MODERATE: 1191, WEAK: 18635, DISCORDANT: 33876, UNDERPOWERED: 50062, NOT_SUPPORTED: 114591 },
  provenance: { tier: 'run-record 2026-06-27' }
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

test('renderStatsPage renders tier bar chart as inline svg', () => {
  const html = renderStatsPage(STATS);
  assert.match(html, /<svg/);
  assert.match(html, /STRONG/);
});

test('renderStatsPage degrades to shell when stats missing', () => {
  const html = renderStatsPage(null);
  assert.match(html, /<h1[^>]*>Statistics<\/h1>/);
  assert.doesNotMatch(html, /undefined/);
});
