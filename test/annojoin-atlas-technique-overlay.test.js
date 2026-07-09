import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCaseTechniques } from '../scripts/lib/annojoin-atlas-technique-overlay.mjs';

test('single case gets techniqueNames + techniqueFamilies from its atlas key', () => {
  const index = { displayCases: [{ atlasCaseKey: 'RASP2PDB:1GID', profileCount: 52 }] };
  const techniques = new Map([['RASP2PDB:1GID', { families: ['A', 'B'], names: ['2A3', 'DMS'] }]]);
  const out = applyCaseTechniques(index, techniques);
  assert.deepEqual(out.displayCases[0].techniqueFamilies, ['A', 'B']);
  assert.deepEqual(out.displayCases[0].techniqueNames, ['2A3', 'DMS']);
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
  const techniques = new Map([['RASP2PDB:5GAG', { families: ['B', 'A', 'B'], names: ['DMS', '2A3', 'DMS'] }]]);
  const out = applyCaseTechniques(index, techniques);
  assert.deepEqual(out.displayCases[0].techniqueFamilies, ['A', 'B']);
  assert.deepEqual(out.displayCases[0].techniqueNames, ['2A3', 'DMS']);
});

test('merged row (sourceCaseKeys) unions techniques from published half', () => {
  const index = { displayCases: [{
    sourceCaseKeys: ['RASP2PDB:10FZ', 'RMDB2PDB:10FZ'],
    atlasCaseKey: 'RASP2PDB:10FZ'
  }] };
  const techniques = new Map([['RASP2PDB:10FZ', { families: ['A', 'D'], names: ['DMS', 'RL-Seq'] }]]);
  const out = applyCaseTechniques(index, techniques);
  assert.deepEqual(out.displayCases[0].techniqueFamilies, ['A', 'D']);
  assert.deepEqual(out.displayCases[0].techniqueNames, ['DMS', 'RL-Seq']);
});

test('returns patchedCount when returnStats is set', () => {
  const index = { displayCases: [
    { atlasCaseKey: 'RASP2PDB:1GID' },
    { atlasCaseKey: 'RMDB2PDB:1AM0' }
  ] };
  const techniques = new Map([['RASP2PDB:1GID', { families: ['A'], names: ['DMS'] }]]);
  const { patchedCount } = applyCaseTechniques(index, techniques, { returnStats: true });
  assert.equal(patchedCount, 1);
});
