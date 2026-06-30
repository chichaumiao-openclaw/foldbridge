import test from 'node:test';
import assert from 'node:assert/strict';
import { createAboutContentStore } from '../src/aboutContentStore.js';

test('loadContent fetches once and caches', async () => {
  let calls = 0;
  const fake = { schema_version: 'about.v1', hero: { title: 'X' }, sections: [] };
  const fetchImpl = async () => { calls += 1; return { ok: true, json: async () => fake }; };
  const store = createAboutContentStore({ assetBase: '/x/', fetchImpl });
  const a = await store.loadContent();
  const b = await store.loadContent();
  assert.equal(a.hero.title, 'X');
  assert.equal(b, a);
  assert.equal(calls, 1);
});

test('loadContent returns null on fetch failure', async () => {
  const fetchImpl = async () => { throw new Error('net'); };
  const store = createAboutContentStore({ assetBase: '/x/', fetchImpl });
  const a = await store.loadContent();
  assert.equal(a, null);
});
