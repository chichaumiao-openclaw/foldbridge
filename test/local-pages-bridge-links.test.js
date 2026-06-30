import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasLocalPagesBridgeDetailPage,
  resolveLocalPagesBridgeDetailHref
} from '../src/localPagesBridgeLinks.js';

// Case directories are named with a literal `%3A`; static servers decode the URL
// once, so the href is double-encoded (`%253A`) to resolve to that literal name.

test('RASP key resolves to in-site relative rasp-v3 path', () => {
  assert.equal(
    resolveLocalPagesBridgeDetailHref('RASP2PDB:10FZ'),
    'public/rasp-v3/cases/RASP2PDB%253A10FZ/index.html'
  );
});

test('RMDB key resolves to in-site relative rmdb-v3 path', () => {
  assert.equal(
    resolveLocalPagesBridgeDetailHref('RMDB2PDB:10ZT'),
    'public/rmdb-v3/cases/RMDB2PDB%253A10ZT/index.html'
  );
});

test('object input with assetFamily+caseId resolves', () => {
  assert.equal(
    resolveLocalPagesBridgeDetailHref({ assetFamily: 'RASP2PDB', caseId: '10FZ' }),
    'public/rasp-v3/cases/RASP2PDB%253A10FZ/index.html'
  );
});

test('unknown universe returns empty', () => {
  assert.equal(resolveLocalPagesBridgeDetailHref('OTHER:XXXX'), '');
});

test('hasLocalPagesBridgeDetailPage true for rasp/rmdb', () => {
  assert.equal(hasLocalPagesBridgeDetailPage('RASP2PDB:10FZ'), true);
  assert.equal(hasLocalPagesBridgeDetailPage('RMDB2PDB:10ZT'), true);
});
