import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnnojointCurrentFilterExport,
  buildAnnojointCurrentFilterResponse
} from '../scripts/lib/annojoin-atlas-export.mjs';

const indexAsset = {
  version: 'V2.1_RMDB_LINE_A_20260617',
  source: {
    entryRoot: 'ANNOJOIN',
    annotationRoot: 'ANNOCONFIDENCE',
    browserLoadsAnnoconfidenceBigTables: false
  },
  totalCaseCount: 2,
  cases: [
    {
      caseId: '10ZT',
      pdbId: '10ZT',
      rnaFamily: 'Group I intron',
      motif: 'P4-P6 domain',
      structureClass: 'ribozyme',
      assayFamilies: ['rmdb_chemical_probing'],
      profileCount: 1,
      conflictCandidateCount: 2,
      searchText: '10ZT Group I intron ribozyme SHAPE'
    },
    {
      caseId: '10ZU',
      pdbId: '10ZU',
      rnaFamily: '',
      motif: '',
      structureClass: '',
      assayFamilies: ['rmdb_chemical_probing'],
      profileCount: 3,
      conflictCandidateCount: 0,
      searchText: '10ZU chemical probing'
    }
  ]
};

test('current-filter export filters ANNOJOIN case universe and records source metadata', () => {
  const result = buildAnnojointCurrentFilterExport(indexAsset, {
    q: 'ribozyme',
    structureClass: 'ribozyme'
  });

  assert.equal(result.source.entryRoot, 'ANNOJOIN');
  assert.equal(result.source.annotationRoot, 'ANNOCONFIDENCE');
  assert.equal(result.source.browserLoadsAnnoconfidenceBigTables, false);
  assert.equal(result.filterExpression, 'q=ribozyme&structureClass=ribozyme');
  assert.equal(result.totalRows, 1);
  assert.equal(result.rows[0].case_id, '10ZT');
});

test('current-filter export response can emit CSV with filter and version columns', () => {
  const response = buildAnnojointCurrentFilterResponse(indexAsset, {
    q: 'ribozyme',
    format: 'csv'
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.equal(response.headers['X-FoldBridge-Entry-Root'], 'ANNOJOIN');
  assert.match(response.headers['Content-Disposition'], /annojoin-current-filter/);
  assert.match(response.body, /filter_expression,source_version,case_id,pdb_id/);
  assert.match(response.body, /q=ribozyme,V2\.1_RMDB_LINE_A_20260617,10ZT,10ZT/);
  assert.doesNotMatch(response.body, /10ZU/);
});

test('current-filter export response can emit JSON for API consumers', () => {
  const response = buildAnnojointCurrentFilterResponse(indexAsset, {
    probeType: 'chemical',
    format: 'json'
  });
  const body = JSON.parse(response.body);

  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
  assert.equal(body.totalRows, 2);
  assert.equal(body.filterExpression, 'probeType=chemical');
  assert.deepEqual(body.rows.map((row) => row.case_id), ['10ZT', '10ZU']);
});
