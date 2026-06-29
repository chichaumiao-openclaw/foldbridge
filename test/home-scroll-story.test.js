import test from 'node:test';
import assert from 'node:assert/strict';
import { reactivityColor, renderReactivityAlignment } from '../src/siteChrome.js';
import { pickFeaturedCase, renderHomeScrollStory } from '../src/siteChrome.js';

const SAMPLE_CASE = {
  pdb_id: '1OB5', chain: 'F', molecule_label: 'tRNA-Phe (yeast)',
  source_family: 'RMDB', confidence_label: 'A REFERENCE',
  norm_ceiling: 2.5, sequence: ['G', 'A', 'C'], reactivity: [0, 1.25, 2.5],
  positions: [27, 28, 29], paired_state: [],
  svg_2d: '1ob5-2d.svg', png_3d: '1ob5-3d.png',
  scenes: [
    { n: '01', title: 'Probing signal, aligned to a structure', body: 'A.' },
    { n: '02', title: 'The same residues fold into 2D', body: 'B.' },
    { n: '03', title: 'And collapse into the 3D fold', body: 'C.' },
  ],
};

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

test('pickFeaturedCase is deterministic and wraps by visitIndex', () => {
  const cases = [{ pdb_id: 'A' }, { pdb_id: 'B' }];
  assert.equal(pickFeaturedCase(cases, 0).pdb_id, 'A');
  assert.equal(pickFeaturedCase(cases, 1).pdb_id, 'B');
  assert.equal(pickFeaturedCase(cases, 2).pdb_id, 'A');
  assert.equal(pickFeaturedCase(cases, 5).pdb_id, 'B');
});

test('pickFeaturedCase tolerates bad input', () => {
  assert.equal(pickFeaturedCase([], 0), null);
  assert.equal(pickFeaturedCase(null, 0), null);
  assert.equal(pickFeaturedCase([{ pdb_id: 'A' }], NaN).pdb_id, 'A');
});

test('renderHomeScrollStory emits 3 scenes + 3 state layers + legend', () => {
  const html = renderHomeScrollStory(SAMPLE_CASE, { assetBase: './assets/hss' });
  const scenes = html.match(/class="hss-scene"/g) || [];
  const layers = html.match(/class="hss-layer/g) || [];
  assert.equal(scenes.length, 3);
  assert.equal(layers.length, 3);
  assert.match(html, /hss-legend/);
  assert.match(html, /hss-alignment/);
  assert.match(html, /\.\/assets\/hss\/1ob5-2d\.svg/);
  assert.match(html, /\.\/assets\/hss\/1ob5-3d\.png/);
  assert.match(html, /tRNA-Phe \(yeast\)/);
  assert.match(html, /And collapse into the 3D fold/);
  assert.match(html, /class="hss-layer is-active"/);
});

test('renderHomeScrollStory returns placeholder shell on empty input', () => {
  const html = renderHomeScrollStory(null, { assetBase: './assets/hss' });
  assert.match(html, /hss-placeholder/);
  assert.doesNotMatch(html, /hss-layer is-active/);
});
