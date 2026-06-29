import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCAL_PAGES_BRIDGE_MANIFEST } from '../src/assets/generated/local_pages_bridge_manifest.js';
import {
  hasLocalPagesBridgeDetailPage,
  resolveLocalPagesBridgeDetailHref
} from '../src/localPagesBridgeLinks.js';

test('local pages bridge resolver upgrades unique cases and routes duplicates to selector pages', () => {
  const originalOrigin = LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl;
  LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl = 'https://pages.example.test';
  assert.equal(
    resolveLocalPagesBridgeDetailHref('RMDB2PDB:10ZT'),
    'https://pages.example.test/rmdb/current/cases/RMDB2PDB%3A10ZT/index.html'
  );
  assert.equal(
    resolveLocalPagesBridgeDetailHref({ assetFamily: 'RASP2PDB', caseId: '10FZ' }),
    'https://pages.example.test/rasp/family-d/current/cases/RASP2PDB%3A10FZ/index.html'
  );
  assert.equal(
    resolveLocalPagesBridgeDetailHref({ atlasCaseKey: 'RASP2PDB:8EWB', assetFamily: 'RASP2PDB' }),
    'https://pages.example.test/selector/rasp/RASP2PDB%3A8EWB/index.html'
  );
  assert.equal(hasLocalPagesBridgeDetailPage('RMDB2PDB:10ZT'), true);
  assert.equal(hasLocalPagesBridgeDetailPage('RASP2PDB:10FZ'), true);
  assert.equal(hasLocalPagesBridgeDetailPage('RASP2PDB:8EWB'), true);
  assert.equal(resolveLocalPagesBridgeDetailHref('RASP2PDB:10ZT'), '');
  LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl = originalOrigin;
});

test('local pages bridge resolver falls back when origin base URL is still placeholder', () => {
  const originalOrigin = LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl;
  LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl = 'https://LOCAL_PAGES_HOST_TODO';
  assert.equal(resolveLocalPagesBridgeDetailHref('RMDB2PDB:10ZT'), '');
  assert.equal(hasLocalPagesBridgeDetailPage('RASP2PDB:10FZ'), false);
  LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl = originalOrigin;
});
