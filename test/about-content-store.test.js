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

test('loadContent returns null and does not cache on !ok, so a retry re-fetches', async () => {
  // 这是 main.js loadAboutContent 失败终态(|| 'error')所依赖的契约：失败既不缓存、
  // 又返回 falsy。main.js 把这个 null 翻成终态 'error' 阻断 aboutPage() 的无限重试循环。
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: false, status: 404 }; };
  const store = createAboutContentStore({ assetBase: '/x/', fetchImpl });
  const a = await store.loadContent();
  assert.equal(a, null);
  assert.equal(store.peek(), null);   // 失败不污染缓存
  const b = await store.loadContent(); // 重试会再次打 fetch（store 自身无终态记忆）
  assert.equal(b, null);
  assert.equal(calls, 2);
});

