import test from 'node:test';
import assert from 'node:assert/strict';
import { createSiteStatsStore } from '../src/siteStatsStore.js';

test('createSiteStatsStore loads stats.json via injected fetch + caches', async () => {
  let calls = 0;
  const fakeStats = { pdb_total: 2386, tier_distribution: { STRONG: 1 } };
  const fetchImpl = async (url) => {
    calls += 1;
    assert.match(url, /site-stats\/stats\.json$/);
    return { ok: true, json: async () => fakeStats };
  };
  const store = createSiteStatsStore({ assetBase: './assets/generated/site-stats', fetchImpl });
  const first = await store.loadStats();
  assert.equal(first.pdb_total, 2386);
  const second = await store.loadStats();
  assert.equal(second, first); // same ref = cache hit
  assert.equal(calls, 1);
});

test('createSiteStatsStore returns null on failed fetch (degrades, never throws)', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404 });
  const store = createSiteStatsStore({ assetBase: './x', fetchImpl });
  const result = await store.loadStats();
  assert.equal(result, null);
});

test('createSiteStatsStore peek returns cached stats after load, undefined before', async () => {
  const fakeStats = { pdb_total: 2386 };
  const fetchImpl = async () => ({ ok: true, json: async () => fakeStats });
  const store = createSiteStatsStore({ assetBase: './assets/generated/site-stats', fetchImpl });
  assert.equal(store.peek(), undefined);
  await store.loadStats();
  assert.equal(store.peek().pdb_total, 2386);
});
