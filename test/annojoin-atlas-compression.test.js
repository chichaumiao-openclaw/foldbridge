import test from 'node:test';
import assert from 'node:assert/strict';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import {
  buildCompressedJsonSidecars,
  buildDetailRouteIndexAsset,
  compressedAssetDescriptor
} from '../scripts/lib/annojoin-atlas-compression.mjs';

test('annojoin atlas compression builds brotli and gzip JSON sidecars', async () => {
  const payload = {
    schemaVersion: 'annojoin-atlas.v1',
    case: { atlasCaseKey: 'RMDB2PDB:5GAG', caseId: '5GAG' },
    rows: [{ base: 'A' }, { base: 'C' }, { base: 'G' }, { base: 'U' }]
  };

  const sidecars = await buildCompressedJsonSidecars('cases/RMDB2PDB%3A5GAG.json', payload);

  assert.equal(sidecars.raw.path, 'cases/RMDB2PDB%3A5GAG.json');
  assert.equal(sidecars.brotli.path, 'cases/RMDB2PDB%3A5GAG.json.br');
  assert.equal(sidecars.gzip.path, 'cases/RMDB2PDB%3A5GAG.json.gz');
  assert.deepEqual(JSON.parse(brotliDecompressSync(sidecars.brotli.bytes).toString('utf8')), payload);
  assert.deepEqual(JSON.parse(gunzipSync(sidecars.gzip.bytes).toString('utf8')), payload);
});

test('annojoin atlas detail route index is a small detail-only lookup', () => {
  const rows = [
    {
      atlasCaseKey: 'RMDB2PDB:5GAG',
      caseId: '5GAG',
      pdbId: '5GAG',
      assetFamily: 'RMDB2PDB',
      caseAssetPath: 'cases/RMDB2PDB%3A5GAG.json',
      isMergedDisplayRow: false
    },
    {
      atlasCaseKey: 'PDB:5GAG',
      caseId: '5GAG',
      pdbId: '5GAG',
      isMergedDisplayRow: true,
      sourceCaseAssetPaths: [
        {
          atlasCaseKey: 'RMDB2PDB:5GAG',
          caseId: '5GAG',
          pdbId: '5GAG',
          assetFamily: 'RMDB2PDB',
          caseAssetPath: 'cases/RMDB2PDB%3A5GAG.json'
        },
        {
          atlasCaseKey: 'RASP2PDB:5GAG',
          caseId: '5GAG',
          pdbId: '5GAG',
          assetFamily: 'RASP2PDB',
          caseAssetPath: 'cases/RASP2PDB%3A5GAG.json'
        }
      ]
    }
  ];
  const assetInfo = new Map([
    ['cases/RMDB2PDB%3A5GAG.json', compressedAssetDescriptor({
      path: 'cases/RMDB2PDB%3A5GAG.json',
      rawBytes: 1000,
      brotliBytes: 100,
      gzipBytes: 200
    })],
    ['cases/RASP2PDB%3A5GAG.json', compressedAssetDescriptor({
      path: 'cases/RASP2PDB%3A5GAG.json',
      rawBytes: 1500,
      brotliBytes: 150,
      gzipBytes: 250
    })]
  ]);

  const index = buildDetailRouteIndexAsset({
    generatedAt: '2026-06-26T00:00:00.000Z',
    source: { viewId: 'annojoin-atlas' },
    cases: rows,
    displayCases: rows.filter((row) => row.isMergedDisplayRow),
    compressedAssetsByPath: assetInfo
  });

  assert.equal(index.schemaVersion, 'annojoin-atlas.detail-routes.v1');
  assert.equal(index.source.browserLoadsAnnoconfidenceBigTables, false);
  assert.equal(index.caseCount, 2);
  assert.equal(index.displayCaseCount, 1);
  assert.deepEqual(index.lookup['RMDB2PDB:5GAG'].asset.caseAssetPath, 'cases/RMDB2PDB%3A5GAG.json');
  assert.deepEqual(index.lookup['5GAG'].asset.caseAssetPath, 'cases/RMDB2PDB%3A5GAG.json');
  assert.equal(index.lookup['PDB:5GAG'].sources.length, 2);
  assert.equal(index.lookup['PDB:5GAG'].sources[1].compressed.brotli.path, 'cases/RASP2PDB%3A5GAG.json.br');
  assert.equal(JSON.stringify(index).includes('caseHierarchy'), false);
  assert.equal(JSON.stringify(index).includes('facets'), false);
});
