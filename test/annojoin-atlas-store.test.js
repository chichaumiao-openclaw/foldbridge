import test from 'node:test';
import assert from 'node:assert/strict';
import { brotliCompressSync, brotliDecompressSync, gzipSync } from 'node:zlib';
import { createAnnojointAtlasStore } from '../src/annojoinAtlasStore.js';

function asArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

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

test('annojoin atlas store can load a detail asset by explicit caseAssetPath', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    const body = url.endsWith('/cases/RASP2PDB%253A10FZ.json')
      ? { case: { atlasCaseKey: 'RASP2PDB:10FZ', caseId: '10FZ' } }
      : { case: { caseId: 'unexpected' } };
    return {
      ok: true,
      status: 200,
      json: async () => body
    };
  };
  const store = createAnnojointAtlasStore({ baseUrl: './atlas', fetcher });

  const detail = await store.loadCaseAssetPath('cases/RASP2PDB%3A10FZ.json');
  const detailAgain = await store.loadCaseAssetPath('cases/RASP2PDB%3A10FZ.json');

  assert.equal(detail.case.atlasCaseKey, 'RASP2PDB:10FZ');
  assert.equal(detailAgain, detail);
  assert.deepEqual(calls, ['./atlas/cases/RASP2PDB%253A10FZ.json']);
});

test('annojoin atlas store can load supplemental sidecars by explicit asset path', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ status: 'materialized', atlasCaseKey: 'RMDB2PDB:5GAG' }),
    };
  };
  const store = createAnnojointAtlasStore({ baseUrl: './atlas', fetcher });

  const asset = await store.loadAssetPath('cases/RMDB2PDB%3A5GAG/confidence-summary.json');
  const again = await store.loadAssetPath('cases/RMDB2PDB%3A5GAG/confidence-summary.json');

  assert.equal(asset.status, 'materialized');
  assert.equal(again, asset);
  assert.deepEqual(calls, ['./atlas/cases/RMDB2PDB%253A5GAG/confidence-summary.json']);
});

test('annojoin atlas store loads detail route and case assets from brotli sidecars', async () => {
  const calls = [];
  const detailRouteIndex = {
    schemaVersion: 'annojoin-atlas.detail-routes.v1',
    lookup: {
      'RMDB2PDB:5GAG': {
        asset: { caseAssetPath: 'cases/RMDB2PDB%3A5GAG.json' }
      }
    }
  };
  const caseAsset = {
    case: { atlasCaseKey: 'RMDB2PDB:5GAG', caseId: '5GAG' },
    trackRoutes: { path: 'cases/RMDB2PDB%3A5GAG/track-routes/page-0001.json' }
  };
  const payloads = new Map([
    ['./atlas/detail-route-index.json.br', brotliCompressSync(`${JSON.stringify(detailRouteIndex)}\n`)],
    ['./atlas/cases/RMDB2PDB%253A5GAG.json.br', brotliCompressSync(`${JSON.stringify(caseAsset)}\n`)]
  ]);
  const fetcher = async (url) => {
    calls.push(url);
    const buffer = payloads.get(url);
    return {
      ok: Boolean(buffer),
      status: buffer ? 200 : 404,
      arrayBuffer: async () => asArrayBuffer(buffer || Buffer.alloc(0))
    };
  };
  const store = createAnnojointAtlasStore({
    baseUrl: './atlas',
    fetcher,
    brotliDecoder: async (bytes) => brotliDecompressSync(Buffer.from(bytes))
  });

  const index = await store.loadDetailRouteIndex();
  const detail = await store.loadCaseAssetPath('cases/RMDB2PDB%3A5GAG.json', { compressed: true });

  assert.equal(index.lookup['RMDB2PDB:5GAG'].asset.caseAssetPath, 'cases/RMDB2PDB%3A5GAG.json');
  assert.equal(detail.case.caseId, '5GAG');
  assert.deepEqual(calls, [
    './atlas/detail-route-index.json.br',
    './atlas/cases/RMDB2PDB%253A5GAG.json.br'
  ]);
});

test('annojoin atlas store falls back from brotli to gzip sidecars', async () => {
  const calls = [];
  const caseAsset = { case: { atlasCaseKey: 'RASP2PDB:10FZ', caseId: '10FZ' } };
  const gzipPayload = gzipSync(`${JSON.stringify(caseAsset)}\n`);
  const fetcher = async (url) => {
    calls.push(url);
    if (!url.endsWith('.json.gz')) {
      return { ok: false, status: 404, arrayBuffer: async () => asArrayBuffer(Buffer.alloc(0)) };
    }
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => asArrayBuffer(gzipPayload)
    };
  };
  const store = createAnnojointAtlasStore({ baseUrl: './atlas', fetcher });

  const detail = await store.loadCaseAssetPath('cases/RASP2PDB%3A10FZ.json', { compressed: true });

  assert.equal(detail.case.caseId, '10FZ');
  assert.deepEqual(calls, [
    './atlas/cases/RASP2PDB%253A10FZ.json.br',
    './atlas/cases/RASP2PDB%253A10FZ.json.gz'
  ]);
});
