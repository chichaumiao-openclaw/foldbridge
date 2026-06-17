import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnnojointAtlasStore } from '../src/annojoinAtlasStore.js';

test('annojoin atlas store loads index and per-case assets lazily', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    let body;
    if (url.endsWith('/index.json')) {
      body = { cases: [{ caseId: '10ZT', caseAssetPath: 'cases/10ZT.json' }] };
    } else if (url.endsWith('/cases/10ZT.json')) {
      body = {
        case: { caseId: '10ZT' },
        trackRoutes: { path: 'cases/10ZT/track-routes/page-0001.json', preview: [{ trackRouteId: 'annojoin:track:10ZT' }] }
      };
    } else {
      body = { rows: [{ trackRouteId: 'annojoin:track:10ZT' }] };
    }
    return {
      ok: true,
      status: 200,
      json: async () => body
    };
  };
  const store = createAnnojointAtlasStore({ baseUrl: './atlas', fetcher });

  const index = await store.loadIndex();
  const detail = await store.loadCase('10ZT');
  const detailAgain = await store.loadCase('10ZT');
  const page = await store.loadRoutePage('cases/10ZT/track-routes/page-0001.json');
  const pageAgain = await store.loadRoutePage('cases/10ZT/track-routes/page-0001.json');

  assert.equal(index.cases.length, 1);
  assert.equal(detail.case.caseId, '10ZT');
  assert.equal(detailAgain, detail);
  assert.equal(page.rows.length, 1);
  assert.equal(pageAgain, page);
  assert.deepEqual(calls, [
    './atlas/index.json',
    './atlas/cases/10ZT.json',
    './atlas/cases/10ZT/track-routes/page-0001.json'
  ]);
});
