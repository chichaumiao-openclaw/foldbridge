// test/efHeatmap.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndices, assertContract, cellFromXY, colorForValue, buildMolstarSelectPayload, buildVarnaColorMap, buildHoverTargets } from '../src/efHeatmap.js';

const PAYLOAD = {
  header: { n_rows: 3, n_cols: 3, symmetric: false, family: 'E', chain: 'A', value_min: -10, value_max: 10, bg_mean: 0, bg_sd: 2 },
  axis_i: [
    { matrix_index: 0, pdb_pos: 83, observed: true, base: 'G' },
    { matrix_index: 1, pdb_pos: 84, observed: true, base: 'C' },
  ],
  axis_j: [
    { matrix_index: 0, pdb_pos: 90, observed: true, base: 'A' },
    { matrix_index: 1, pdb_pos: 91, observed: false, base: 'U' },
  ],
  cells: [[0, 0, 12.3], [0, 1, -3.1], [1, 0, 5.0]],
};

test('buildIndices builds cellMap keyed by "i,j"', () => {
  const idx = buildIndices(PAYLOAD);
  assert.equal(idx.cellMap.get('0,0'), 12.3);
  assert.equal(idx.cellMap.get('0,1'), -3.1);
  assert.equal(idx.cellMap.has('2,2'), false);
});

test('buildIndices rowIndex/colIndex give whole row/col', () => {
  const idx = buildIndices(PAYLOAD);
  assert.deepEqual(idx.rowIndex.get(0), [{ j: 0, value: 12.3 }, { j: 1, value: -3.1 }]);
  assert.deepEqual(idx.colIndex.get(0), [{ i: 0, value: 12.3 }, { i: 1, value: 5.0 }]);
});

test('buildIndices axisByIndex + axisByPdbPos both directions', () => {
  const idx = buildIndices(PAYLOAD);
  assert.equal(idx.axisByIndex.i.get(0).pdb_pos, 83);
  assert.equal(idx.axisByPdbPos.i.get(83), 0);
  assert.equal(idx.axisByPdbPos.j.get(90), 0);
});

test('assertContract throws on cell index out of axis range', () => {
  const bad = { ...PAYLOAD, cells: [[0, 9, 1.0]] };
  assert.throws(() => assertContract(bad), /out of range/);
});

test('cellFromXY reverse-maps by per-dimension cellW/cellH (non-square F)', () => {
  const hdr = { n_rows: 3, n_cols: 4 };
  assert.deepEqual(cellFromXY(30, 25, 100, 60, hdr), { i: 1, j: 1 });
  assert.deepEqual(cellFromXY(0, 0, 100, 60, hdr), { i: 0, j: 0 });
  assert.deepEqual(cellFromXY(99, 59, 100, 60, hdr), { i: 2, j: 3 });
});

test('colorForValue E diverging: bg-centered, positive warm negative cool', () => {
  const hdr = { family: 'E', value_min: -10, value_max: 10, bg_mean: 0, bg_sd: 2 };
  const pos = colorForValue(8, hdr);
  const neg = colorForValue(-8, hdr);
  const mid = colorForValue(0, hdr);
  assert.ok(pos.r > pos.b, 'positive is warm (r>b)');
  assert.ok(neg.b > neg.r, 'negative is cool (b>r)');
  assert.ok(Math.abs(mid.r - mid.b) < 40, 'bg-centered near neutral');
});

test('select payload: skip pdb_pos=null and observed=false partners', () => {
  const idx = buildIndices(PAYLOAD);
  const payload = buildMolstarSelectPayload(0, 'i', idx, PAYLOAD.header);
  assert.equal(payload.length, 1);
  assert.equal(payload[0].start_residue_number, 90);
  assert.equal(payload[0].struct_asym_id, 'A');
  assert.ok('color' in payload[0]);
});

test('select payload by j axis uses colIndex', () => {
  const idx = buildIndices(PAYLOAD);
  const payload = buildMolstarSelectPayload(0, 'j', idx, PAYLOAD.header);
  assert.equal(payload.length, 2);
});

test('varna color map: partner matrix_index -> rgb string', () => {
  const idx = buildIndices(PAYLOAD);
  const m = buildVarnaColorMap(0, 'i', idx, PAYLOAD.header);
  assert.ok(m.has(0));
  assert.match(m.get(0), /^rgb\(/);
});

test('hover targets: two bases (i and j)', () => {
  const idx = buildIndices(PAYLOAD);
  const t = buildHoverTargets(0, 0, idx, PAYLOAD.header);
  assert.equal(t.length, 2);
  assert.deepEqual(t.map((x) => x.start_residue_number).sort(), [83, 90]);
});
