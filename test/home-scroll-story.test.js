import test from 'node:test';
import assert from 'node:assert/strict';
import { reactivityColor, renderReactivityAlignment } from '../src/siteChrome.js';
import { pickFeaturedCase, renderHomeScrollStory } from '../src/siteChrome.js';
import { createHomeScrollStoryStore } from '../src/homeScrollStoryStore.js';

const SAMPLE_CASE = {
  pdb_id: '1OB5', chain: 'F', molecule_label: 'tRNA-Phe (yeast)',
  source_family: 'RMDB', confidence_label: 'A REFERENCE',
  norm_ceiling: 2.5, sequence: ['G', 'A', 'C'], reactivity: [0, 1.25, 2.5],
  positions: [27, 28, 29], paired_state: [],
  svg_2d: '1ob5-2d.svg', png_3d: '1ob5-3d.png',
  scenes: [
    { n: '01', title: 'Probing signal, aligned to a structure', body: 'A.', chip: 'warm = flexible / unpaired · cool = constrained / paired' },
    { n: '02', title: 'The same residues fold into 2D', body: 'B.', chip: 'color is conserved across every view' },
    { n: '03', title: 'And collapse into the 3D fold', body: 'C.', chip: 'probing ↔ structure, one continuous thread' },
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

test('renderReactivityAlignment emits a signal bar + a colored cell per residue', () => {
  const caseData = { sequence: ['G','A','C'], reactivity: [0, 1.25, 2.5], norm_ceiling: 2.5, pdb_id: '1OB5', chain: 'F' };
  const html = renderReactivityAlignment(caseData);
  // bottom row: one colored chain cell per residue
  const cells = html.match(/class="hss-cell"/g) || [];
  assert.equal(cells.length, 3);
  // top row: one per-base reactivity bar per residue
  const bars = html.match(/class="hss-bar"/g) || [];
  assert.equal(bars.length, 3);
  // connector: one '|' tick per residue, locked between this residue's bar and cell
  const ticks = html.match(/class="hss-match-tick"/g) || [];
  assert.equal(ticks.length, 3);
  assert.match(html, />G</);
  assert.match(html, /rgb\(23, 75, 58\)/);   // 第一个残基 reactivity 0 → 冷绿
  // row labels present (signal-over-structure framing)
  assert.match(html, /Probing signal \(reactivity\)/);
  assert.match(html, /chain F/);              // PDB row label carries the chain
});

test('renderReactivityAlignment renders empty alignment when no residues', () => {
  const html = renderReactivityAlignment({ sequence: [], reactivity: [], norm_ceiling: 1 });
  assert.match(html, /hss-alignment/);
  assert.doesNotMatch(html, /class="hss-cell"/);
});

test('renderReactivityAlignment colors missing-datum residues neutral grey, not cold-green', () => {
  // 数据诚实（spec §3）：无反应性数据的残基不得用色标外推，须落中性灰 #E9EDEA，
  // 与 2D/3D 离线渲染器一致——绝不能与真实低反应性(0→冷绿)残基混淆。
  const caseData = {
    sequence: ['G', 'A', 'C', 'U'],
    reactivity: [0, null, undefined, 2.5], // 第2/3个残基缺数据
    norm_ceiling: 2.5,
  };
  const html = renderReactivityAlignment(caseData);
  const cells = html.match(/class="hss-cell\b/g) || [];
  assert.equal(cells.length, 4);
  // 真实 0 → 冷绿；缺数据 → 中性灰；满值 → 暖橙
  const neutral = html.match(/#E9EDEA/gi) || [];
  assert.equal(neutral.length, 4, 'each missing-datum residue is neutral grey in both its bar and its cell');
  assert.match(html, /rgb\(23, 75, 58\)/);   // 真实 reactivity 0 仍冷绿（不被误判为缺数据）
  assert.match(html, /rgb\(232, 116, 62\)/); // 满值暖橙
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
  const scenes = html.match(/class="hss-scene(?:"| )/g) || [];
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
  // 首个场景初始即 is-active：CSS/JS 都只认 .is-active 类，渲染层须先点亮 scene 0，
  // 否则桌面端首屏所有场景暗着(opacity .35)直到首次 intersection 才亮（初始渲染闪烁）。
  assert.match(html, /class="hss-scene is-active" data-scene="0"/);
  assert.doesNotMatch(html, /data-scene-active/); // 旧死属性应已移除
  const chips = html.match(/class="hss-chip"/g) || [];
  assert.equal(chips.length, 3);
  assert.match(html, /warm = flexible \/ unpaired/);
  assert.match(html, /one continuous thread/);
    // hero intro
    assert.match(html, /class="hss-intro"/);
    assert.match(html, /class="hss-kicker"/);
    assert.match(html, /A FoldBridge story · tRNA-Phe \(yeast\) \(PDB 1OB5\)/);
    assert.match(html, /Follow one RNA from/);
    assert.match(html, /class="hss-headline-grad"/);  // gradient span on second line
    assert.match(html, /Scroll to watch it transform/);
    assert.match(html, /class="hss-scrollcue"/);
    // closing CTA
    assert.match(html, /class="hss-closing"/);
    assert.match(html, /Every record in FoldBridge tells this story/);
    assert.match(html, /3,610 structure-linked records/);
    assert.match(html, /data-route="entry"/);
    assert.match(html, /Browse the Entry table/);
});

test('renderHomeScrollStory returns placeholder shell on empty input', () => {
  const html = renderHomeScrollStory(null, { assetBase: './assets/hss' });
  assert.match(html, /hss-placeholder/);
  assert.doesNotMatch(html, /hss-layer is-active/);
  assert.doesNotMatch(html, /hss-intro/);
  assert.doesNotMatch(html, /hss-closing/);
});

test('renderHomeScrollStory falls back to hss-missing when snapshots absent', () => {
  const noSnaps = {
    pdb_id: '1OB5', molecule_label: 'tRNA-Phe (yeast)', confidence_label: 'A REFERENCE',
    norm_ceiling: 2.5, sequence: ['G', 'A'], reactivity: [0, 1.25],
    scenes: [
      { n: '01', title: 'one', body: 'a' },
      { n: '02', title: 'two', body: 'b' },
      { n: '03', title: 'three', body: 'c' },
    ],
    // 故意不给 svg_2d / png_3d
  };
  const html = renderHomeScrollStory(noSnaps, { assetBase: './assets/hss' });
  const missing = html.match(/class="hss-missing"/g) || [];
  assert.equal(missing.length, 2);            // 态1 + 态2 都缺
  assert.doesNotMatch(html, /class="hss-snapshot"/);  // 无 img 快照
  assert.match(html, /hss-alignment/);         // 态0 1D 仍正常渲染
});

test('createHomeScrollStoryStore loads story.json via injected fetch + caches', async () => {
  let calls = 0;
  const fakeStory = { schemaVersion: 1, cases: [{ pdb_id: '1OB5' }] };
  const fetchImpl = async (url) => {
    calls += 1;
    assert.match(url, /story\.json$/);
    return { ok: true, json: async () => fakeStory };
  };
  const store = createHomeScrollStoryStore({ assetBase: './assets/hss', fetchImpl });
  const first = await store.loadStory();
  assert.equal(first.cases[0].pdb_id, '1OB5');
  const second = await store.loadStory();
  assert.equal(second, first);     // 同引用 = 命中缓存
  assert.equal(calls, 1);          // 只 fetch 一次
});

test('createHomeScrollStoryStore throws on non-ok response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404 });
  const store = createHomeScrollStoryStore({ assetBase: './x', fetchImpl });
  await assert.rejects(() => store.loadStory(), /404/);
});
