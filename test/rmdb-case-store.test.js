import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaseStore, DEFAULT_ASSET_BASE } from '../src/rmdbCaseStore.js';

test('DEFAULT_ASSET_BASE is the relative generated path', () => {
  assert.equal(DEFAULT_ASSET_BASE, './src/assets/generated/rmdb-pdb-cases');
});

test('store loads and caches index via injected fetch', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, json: async () => ({ cases: [{ pdbId: '8CBL' }] }) }; };
  const store = createCaseStore({ fetchImpl });
  const a = await store.loadCaseIndex();
  await store.loadCaseIndex();
  assert.equal(a.cases[0].pdbId, '8CBL');
  assert.equal(calls, 1); // cached
});

test('store throws on non-ok response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404 });
  const store = createCaseStore({ fetchImpl });
  await assert.rejects(() => store.loadCase('NOPE'));
});

test('loadCase fetches the case.json under the pdb id and caches per id', async () => {
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return { ok: true, json: async () => ({ pdbId: '8CBL' }) }; };
  const store = createCaseStore({ fetchImpl, assetBase: '/base' });
  await store.loadCase('8CBL');
  await store.loadCase('8CBL');
  assert.equal(urls.length, 1);
  assert.equal(urls[0], '/base/cases/8CBL/case.json');
});

test('loadAlignmentPage zero-pads page number to 4 digits', async () => {
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return { ok: true, json: async () => ({ rows: [] }) }; };
  const store = createCaseStore({ fetchImpl, assetBase: '/base' });
  await store.loadAlignmentPage('8CBL', 3);
  assert.equal(urls[0], '/base/cases/8CBL/alignments/page-0003.json');
});

test('loadReactivitySummary and loadReactivityWindow build profile-scoped paths', async () => {
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return { ok: true, json: async () => ({}) }; };
  const store = createCaseStore({ fetchImpl, assetBase: '/base' });
  await store.loadReactivitySummary('8CBL', 'pf1');
  await store.loadReactivityWindow('8CBL', 'pf1', 1, 100);
  assert.equal(urls[0], '/base/cases/8CBL/reactivity/pf1/summary.json');
  assert.equal(urls[1], '/base/cases/8CBL/reactivity/pf1/pdb-pos-1-100.json');
});
