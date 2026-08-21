import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const MAIN_SOURCE = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const STYLES_SOURCE = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('main wires dashboard loading, filter toggles, chips, and reset', () => {
  assert.match(MAIN_SOURCE, /siteStatsStore\.loadDashboard\(/);
  assert.match(MAIN_SOURCE, /function initStatsDashboard\(/);
  assert.match(MAIN_SOURCE, /\[data-stats-filter-dimension\]/);
  assert.match(MAIN_SOURCE, /\[data-stats-filter-chip\]/);
  assert.match(MAIN_SOURCE, /\[data-stats-reset\]/);
  assert.match(MAIN_SOURCE, /toggleStatsFilter\(/);
  assert.match(MAIN_SOURCE, /clearStatsFilters\(/);
});

test('styles provide the required responsive and accessible dashboard states', () => {
  assert.match(STYLES_SOURCE, /\.stats-chart-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(STYLES_SOURCE, /\.stats-chart-panel--wide\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
  assert.match(STYLES_SOURCE, /\.stats-chart-row\.is-selected/);
  assert.match(STYLES_SOURCE, /\.stats-chart-row:focus-visible/);
  assert.match(STYLES_SOURCE, /@media\s*\(max-width:\s*760px\)[\s\S]*\.stats-chart-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
});
