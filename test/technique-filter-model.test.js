import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTechniqueFilterModel,
  buildMechanismFilterModel,
  mechanismFamilyForTechnique,
  matchesTechniqueFilter,
  toggleTechniqueSelection
} from '../src/techniqueFilterModel.js';

const CASES = [
  { pdbId: '1GID', techniqueFamilies: ['dms', 'shape'], techniqueNames: ['2A3', 'DMS'] },
  { pdbId: '5GAG', techniqueFamilies: ['dms'], techniqueNames: ['DMS'] },
  { pdbId: '1P5P', techniqueFamilies: ['cleavage'], techniqueNames: ['PARS'] }
];

test('maps the Entry technology names to the five Probing-page categories', () => {
  assert.equal(mechanismFamilyForTechnique('2A3')?.id, 'shape');
  assert.equal(mechanismFamilyForTechnique('DMS-MaPseq')?.id, 'dms');
  assert.equal(mechanismFamilyForTechnique('RL-Seq')?.id, 'cleavage');
  assert.equal(mechanismFamilyForTechnique('icLASER')?.id, 'nucleotide');
  assert.equal(mechanismFamilyForTechnique('PARIS')?.id, 'interaction');
});

test('Entry filter always exposes all five Probing-page categories', () => {
  assert.deepEqual(
    buildMechanismFilterModel(CASES).families.map((family) => family.id),
    ['dms', 'shape', 'cleavage', 'nucleotide', 'interaction']
  );
});

test('Entry filter exposes only the same method options shown on the Probing page', () => {
  const shape = buildMechanismFilterModel(CASES).families.find((family) => family.id === 'shape');
  assert.deepEqual(shape.techniques, ['SHAPE', 'SHAPE-Seq', 'SHAPE-MaP', 'icSHAPE', 'icSHAPE-MaP', 'NAI-MaP', 'smartSHAPE']);
  assert.ok(!shape.techniques.includes('2A3'));
});

test('model lists only Probing-page categories present in data, with nested techniques', () => {
  const model = buildTechniqueFilterModel(CASES);
  assert.deepEqual(model.families.map((f) => f.id), ['dms', 'shape', 'cleavage']);
  const shape = model.families.find((f) => f.id === 'shape');
  assert.deepEqual(shape.techniques, ['2A3']);
});

test('legacy measurement-family letters are never surfaced as Entry categories', () => {
  const model = buildTechniqueFilterModel([
    { techniqueFamilies: ['E', 'F'], techniqueNames: ['MCA', 'M2'] }
  ]);
  assert.deepEqual(model.families, []);
});

test('empty selection matches every row', () => {
  const empty = { families: new Set(), techniques: new Set() };
  assert.ok(CASES.every((row) => matchesTechniqueFilter(row, empty)));
});

test('category selection matches rows carrying that category', () => {
  const sel = { families: new Set(['cleavage']), techniques: new Set() };
  assert.deepEqual(CASES.filter((r) => matchesTechniqueFilter(r, sel)).map((r) => r.pdbId), ['1P5P']);
});

test('cross-level selection is a pure OR union', () => {
  const sel = { families: new Set(['shape']), techniques: new Set(['PARS']) };
  assert.deepEqual(CASES.filter((r) => matchesTechniqueFilter(r, sel)).map((r) => r.pdbId), ['1GID', '1P5P']);
});

test('toggle adds then removes immutably', () => {
  const s0 = { families: new Set(), techniques: new Set() };
  const s1 = toggleTechniqueSelection(s0, 'families', 'dms');
  assert.ok(s1.families.has('dms'));
  assert.equal(s0.families.has('dms'), false);
  const s2 = toggleTechniqueSelection(s1, 'families', 'dms');
  assert.equal(s2.families.has('dms'), false);
});
