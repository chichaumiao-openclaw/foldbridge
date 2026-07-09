import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTechniqueFilterModel,
  matchesTechniqueFilter,
  toggleTechniqueSelection
} from '../src/techniqueFilterModel.js';

const CASES = [
  { pdbId: '1GID', techniqueFamilies: ['A', 'B'], techniqueNames: ['2A3', 'DMS'] },
  { pdbId: '5GAG', techniqueFamilies: ['A'], techniqueNames: ['DMS'] },
  { pdbId: '1P5P', techniqueFamilies: ['C'], techniqueNames: ['PARS'] }
];

test('model lists only families present in data, techniques nested + sorted, A-D only', () => {
  const model = buildTechniqueFilterModel(CASES);
  assert.deepEqual(model.families.map((f) => f.id), ['A', 'B', 'C']);
  const a = model.families.find((f) => f.id === 'A');
  assert.deepEqual(a.techniques, ['2A3', 'DMS']);
});

test('E/F families are never surfaced even if present in data', () => {
  const model = buildTechniqueFilterModel([
    { techniqueFamilies: ['E', 'F'], techniqueNames: ['MCA', 'M2'] }
  ]);
  assert.deepEqual(model.families, []);
});

test('empty selection matches every row', () => {
  const empty = { families: new Set(), techniques: new Set() };
  assert.ok(CASES.every((row) => matchesTechniqueFilter(row, empty)));
});

test('family selection matches rows carrying that family', () => {
  const sel = { families: new Set(['C']), techniques: new Set() };
  assert.deepEqual(CASES.filter((r) => matchesTechniqueFilter(r, sel)).map((r) => r.pdbId), ['1P5P']);
});

test('cross-level selection is a pure OR union', () => {
  const sel = { families: new Set(['B']), techniques: new Set(['PARS']) };
  assert.deepEqual(CASES.filter((r) => matchesTechniqueFilter(r, sel)).map((r) => r.pdbId), ['1GID', '1P5P']);
});

test('toggle adds then removes immutably', () => {
  const s0 = { families: new Set(), techniques: new Set() };
  const s1 = toggleTechniqueSelection(s0, 'families', 'A');
  assert.ok(s1.families.has('A'));
  assert.equal(s0.families.has('A'), false);
  const s2 = toggleTechniqueSelection(s1, 'families', 'A');
  assert.equal(s2.families.has('A'), false);
});
