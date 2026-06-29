import test from 'node:test';
import assert from 'node:assert/strict';
import { reactivityColor, renderReactivityAlignment } from '../src/siteChrome.js';

test('reactivityColor maps scale anchors to the single-authority colors', () => {
  assert.equal(reactivityColor(0), 'rgb(23, 75, 58)');     // #174B3A 冷绿
  assert.equal(reactivityColor(1), 'rgb(232, 116, 62)');   // #E8743E 暖橙
  assert.equal(reactivityColor(0.5), 'rgb(230, 194, 96)'); // #E6C260 金锚点精确值
});

test('reactivityColor clamps out-of-range input', () => {
  assert.equal(reactivityColor(-5), reactivityColor(0));
  assert.equal(reactivityColor(99), reactivityColor(1));
});

test('renderReactivityAlignment emits one colored cell per residue', () => {
  const caseData = { sequence: ['G','A','C'], reactivity: [0, 1.25, 2.5], norm_ceiling: 2.5 };
  const html = renderReactivityAlignment(caseData);
  const cells = html.match(/class="hss-cell"/g) || [];
  assert.equal(cells.length, 3);
  assert.match(html, />G</);
  assert.match(html, /rgb\(23, 75, 58\)/);   // 第一个残基 reactivity 0 → 冷绿
});

test('renderReactivityAlignment renders empty alignment when no residues', () => {
  const html = renderReactivityAlignment({ sequence: [], reactivity: [], norm_ceiling: 1 });
  assert.match(html, /hss-alignment/);
  assert.doesNotMatch(html, /class="hss-cell"/);
});
