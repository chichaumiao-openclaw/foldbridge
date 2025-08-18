import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCaseTechniques } from '../scripts/lib/annojoin-atlas-technique-overlay.mjs';

test('single case gets techniqueNames + Probing-page categories from its atlas key', () => {
  const index = { displayCases: [{ atlasCaseKey: 'RASP2PDB:1GID', profileCount: 52 }] };
  const techniques = new Map([['RASP2PDB:1GID', { families: ['dms', 'shape'], names: ['2A3', 'DMS'], measurementFamilies: ['A', 'B'] }]]);
  const out = applyCaseTechniques(index, techniques);
  assert.deepEqual(out.displayCases[0].techniqueFamilies, ['dms', 'shape']);
  assert.deepEqual(out.displayCases[0].techniqueNames, ['2A3', 'DMS']);
  assert.deepEqual(out.displayCases[0].measurementFamilies, ['A', 'B']);
  assert.equal(out.displayCases[0].profileCount, 52);
});

test('cases with no technique entry (unpublished) are left unchanged', () => {
  const index = { displayCases: [{ atlasCaseKey: 'RMDB2PDB:1AM0', profileCount: 4 }] };
  const out = applyCaseTechniques(index, new Map());
  assert.equal(out.displayCases[0].techniqueFamilies, undefined);
  assert.equal(out.displayCases[0].techniqueNames, undefined);
  assert.equal(out.displayCases[0].profileCount, 4);
});

test('families and names are sorted + deduped', () => {
  const index = { displayCases: [{ atlasCaseKey: 'RASP2PDB:5GAG' }] };
  const techniques = new Map([['RASP2PDB:5GAG', { families: ['shape', 'dms', 'shape'], names: ['DMS', '2A3', 'DMS'], measurementFamilies: ['B', 'A', 'B'] }]]);
  const out = applyCaseTechniques(index, techniques);
  assert.deepEqual(out.displayCases[0].techniqueFamilies, ['dms', 'shape']);
  assert.deepEqual(out.displayCases[0].techniqueNames, ['2A3', 'DMS']);
  assert.deepEqual(out.displayCases[0].measurementFamilies, ['A', 'B']);
});

test('merged row (sourceCaseKeys) unions techniques from published half', () => {
  const index = { displayCases: [{
    sourceCaseKeys: ['RASP2PDB:10FZ', 'RMDB2PDB:10FZ'],
    atlasCaseKey: 'RASP2PDB:10FZ'
  }] };
  const techniques = new Map([['RASP2PDB:10FZ', { families: ['dms', 'cleavage'], names: ['DMS', 'RL-Seq'], measurementFamilies: ['A', 'D'] }]]);
  const out = applyCaseTechniques(index, techniques);
  assert.deepEqual(out.displayCases[0].techniqueFamilies, ['cleavage', 'dms']);
  assert.deepEqual(out.displayCases[0].techniqueNames, ['DMS', 'RL-Seq']);
  assert.deepEqual(out.displayCases[0].measurementFamilies, ['A', 'D']);
});

test('returns patchedCount when returnStats is set', () => {
  const index = { displayCases: [
    { atlasCaseKey: 'RASP2PDB:1GID' },
    { atlasCaseKey: 'RMDB2PDB:1AM0' }
  ] };
  const techniques = new Map([['RASP2PDB:1GID', { families: ['dms'], names: ['DMS'], measurementFamilies: ['A'] }]]);
  const { patchedCount } = applyCaseTechniques(index, techniques, { returnStats: true });
  assert.equal(patchedCount, 1);
});
