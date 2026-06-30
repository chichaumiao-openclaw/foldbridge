import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCasePageProfileCounts
} from '../scripts/lib/annojoin-atlas-profile-count-overlay.mjs';

test('single-source row takes the case-page profile_count for its atlas key', () => {
  const index = {
    displayCases: [
      {
        atlasCaseKey: 'RMDB2PDB:2L1V',
        assetFamily: 'RMDB2PDB',
        profileCount: 34,
        sourceCaseCount: 1,
        sourceCaseKeys: ['RMDB2PDB:2L1V'],
        sourceCaseAssetPaths: [
          { assetFamily: 'RMDB2PDB', atlasCaseKey: 'RMDB2PDB:2L1V', profileCount: 34 }
        ]
      }
    ]
  };
  const counts = new Map([['RMDB2PDB:2L1V', 52]]);
  const out = applyCasePageProfileCounts(index, counts);
  assert.equal(out.displayCases[0].profileCount, 52);
  assert.equal(out.displayCases[0].sourceCaseAssetPaths[0].profileCount, 52);
});

test('single-source row without sourceCaseAssetPaths still gets patched by atlas key', () => {
  const index = {
    displayCases: [
      { atlasCaseKey: 'RASP2PDB:1P5P', assetFamily: 'RASP2PDB', profileCount: 9 }
    ]
  };
  const counts = new Map([['RASP2PDB:1P5P', 2]]);
  const out = applyCasePageProfileCounts(index, counts);
  assert.equal(out.displayCases[0].profileCount, 2);
});

test('merged PDB row sums case-page counts across its source keys', () => {
  const index = {
    displayCases: [
      {
        atlasCaseKey: 'PDB:10FZ',
        isMergedDisplayRow: true,
        profileCount: 5,
        sourceCaseCount: 2,
        sourceCaseKeys: ['RMDB2PDB:10FZ', 'RASP2PDB:10FZ'],
        sourceCaseAssetPaths: [
          { assetFamily: 'RMDB2PDB', atlasCaseKey: 'RMDB2PDB:10FZ', profileCount: 2 },
          { assetFamily: 'RASP2PDB', atlasCaseKey: 'RASP2PDB:10FZ', profileCount: 3 }
        ]
      }
    ]
  };
  const counts = new Map([
    ['RMDB2PDB:10FZ', 7],
    ['RASP2PDB:10FZ', 11]
  ]);
  const out = applyCasePageProfileCounts(index, counts);
  assert.equal(out.displayCases[0].sourceCaseAssetPaths[0].profileCount, 7);
  assert.equal(out.displayCases[0].sourceCaseAssetPaths[1].profileCount, 11);
  assert.equal(out.displayCases[0].profileCount, 18);
});

test('rows with no case-page entry (unpublished) are left unchanged', () => {
  const index = {
    displayCases: [
      {
        atlasCaseKey: 'RMDB2PDB:1AM0',
        assetFamily: 'RMDB2PDB',
        profileCount: 4,
        sourceCaseKeys: ['RMDB2PDB:1AM0'],
        sourceCaseAssetPaths: [
          { assetFamily: 'RMDB2PDB', atlasCaseKey: 'RMDB2PDB:1AM0', profileCount: 4 }
        ]
      }
    ]
  };
  const out = applyCasePageProfileCounts(index, new Map());
  assert.equal(out.displayCases[0].profileCount, 4);
  assert.equal(out.displayCases[0].sourceCaseAssetPaths[0].profileCount, 4);
});

test('returns a count of how many display rows were patched', () => {
  const index = {
    displayCases: [
      { atlasCaseKey: 'RMDB2PDB:2L1V', sourceCaseKeys: ['RMDB2PDB:2L1V'], profileCount: 34 },
      { atlasCaseKey: 'RMDB2PDB:1AM0', sourceCaseKeys: ['RMDB2PDB:1AM0'], profileCount: 4 }
    ]
  };
  const counts = new Map([['RMDB2PDB:2L1V', 52]]);
  const { patchedCount } = applyCasePageProfileCounts(index, counts, { returnStats: true });
  assert.equal(patchedCount, 1);
});
