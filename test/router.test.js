import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPdbCaseHash, normalizeRoute, parseHashRoute, routeFromHash } from '../src/router.js';

test('normalizeRoute accepts supported routes only', () => {
  assert.equal(normalizeRoute('HOME'), 'home');
  assert.equal(normalizeRoute('browse'), 'browse');
  assert.equal(normalizeRoute('detail'), 'detail');
  assert.equal(normalizeRoute('pdb-case'), 'pdb-case');
  assert.equal(normalizeRoute('annojoin-case'), 'annojoin-case');
  assert.equal(normalizeRoute('annojoin-confidence'), 'annojoin-confidence');
  assert.equal(normalizeRoute('unknown'), 'home');
});

test('routeFromHash parses url hash safely', () => {
  assert.equal(routeFromHash('#browse'), 'browse');
  assert.equal(routeFromHash('#DETAIL'), 'detail');
  assert.equal(routeFromHash(''), 'home');
  assert.equal(routeFromHash('#not-a-route'), 'home');
});

test('parseHashRoute preserves PDB case query parameters', () => {
  const parsed = parseHashRoute('#pdb-case?pdbId=4QLM&pdbReferenceId=4QLM_A&bundleProfileId=RMDB_1');

  assert.equal(parsed.route, 'pdb-case');
  assert.equal(parsed.params.get('pdbId'), '4QLM');
  assert.equal(parsed.params.get('pdbReferenceId'), '4QLM_A');
  assert.equal(parsed.params.get('bundleProfileId'), 'RMDB_1');
});

test('buildPdbCaseHash creates stable external case URLs', () => {
  assert.equal(
    buildPdbCaseHash({
      pdbId: '4qlm',
      pdbReferenceId: '4QLM_A',
      bundleProfileId: 'profile 1',
      rmdbUniqueId: 'RMDB unique'
    }),
    '#pdb-case?pdbId=4QLM&pdbReferenceId=4QLM_A&bundleProfileId=profile+1&rmdbUniqueId=RMDB+unique'
  );
});
