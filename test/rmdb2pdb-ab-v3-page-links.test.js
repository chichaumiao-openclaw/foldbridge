import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRmdb2pdbAbV3DetailPage,
  resolveRmdb2pdbAbV3DetailHref
} from '../src/rmdb2pdbAbV3PageLinks.js';

test('rmdb2pdb A/B V3 page registry resolves completed RMDB case pages only', () => {
  assert.equal(
    resolveRmdb2pdbAbV3DetailHref('RMDB2PDB:10ZT'),
    './src/assets/generated/v3-case-pages/rmdb2pdb_ab_v3_launch_132_centered/20260628T193700Z_retry/cases/RMDB2PDB%3A10ZT/index.html'
  );
  assert.equal(
    resolveRmdb2pdbAbV3DetailHref({ assetFamily: 'RMDB2PDB', caseId: '10ZT' }),
    './src/assets/generated/v3-case-pages/rmdb2pdb_ab_v3_launch_132_centered/20260628T193700Z_retry/cases/RMDB2PDB%3A10ZT/index.html'
  );
  assert.equal(
    resolveRmdb2pdbAbV3DetailHref({ caseUid: 'RMDB2PDB|10ZT', atlasCaseKey: '10ZT' }),
    './src/assets/generated/v3-case-pages/rmdb2pdb_ab_v3_launch_132_centered/20260628T193700Z_retry/cases/RMDB2PDB%3A10ZT/index.html'
  );
  assert.equal(hasRmdb2pdbAbV3DetailPage('RMDB2PDB:10ZT'), true);
  assert.equal(hasRmdb2pdbAbV3DetailPage('RMDB2PDB:10FZ'), false);
  assert.equal(resolveRmdb2pdbAbV3DetailHref('RASP2PDB:10ZT'), '');
});
