import test from 'node:test';
import assert from 'node:assert/strict';
import {
  browseRows,
  detailEvidenceRows,
  detailRecord,
  featuredRecords,
  provenanceHistory,
  recentPublications,
  siteSummaries,
  DATA_VERSION,
  DETERMINISTIC_SEED,
  SOURCE_PACKAGE_ID,
  PDB_CASE_SCHEMA_VERSION,
  pdbCaseManifest,
  pdbCaseRows,
  getPdbCaseDetail
} from '../src/data.js';

test('featured placeholder records include confidence labels', () => {
  assert.equal(featuredRecords.length, 3);
  assert.ok(featuredRecords.every((record) => typeof record.confidence === 'string' && record.confidence.length > 0));
});

test('browse rows expose required columns', () => {
  for (const row of browseRows) {
    assert.ok(row.id && row.name && row.species && row.ligand && row.evidence);
  }
});

test('detail evidence scores are parseable numbers', () => {
  assert.ok(detailEvidenceRows.every((row) => Number.isFinite(Number(row.score))));
});

test('provenance history is chronological', () => {
  const years = provenanceHistory.map((event) => Number(event.slice(0, 4)));
  const sorted = [...years].sort((a, b) => a - b);
  assert.deepEqual(years, sorted);
});

test('site summaries expose deterministic scope stats', () => {
  assert.equal(siteSummaries.length, 3);
  assert.ok(siteSummaries.every((row) => row.site && row.scope && Number.isInteger(row.records) && row.records > 0));
});

test('recent publications include doi-like identifiers and years', () => {
  assert.ok(recentPublications.every((paper) => paper.doi.startsWith('10.') && Number.isInteger(paper.year)));
});

test('detail record includes minimum scientific context fields', () => {
  assert.ok(detailRecord.id && detailRecord.name && detailRecord.organism);
  assert.ok(Number.isInteger(detailRecord.sequenceLength));
});

test('data versioning metadata is present for reproducibility', () => {
  assert.match(DATA_VERSION, /^\d{4}-\d{2}-\d{2}\./);
  assert.equal(DETERMINISTIC_SEED, 20260307);
});

test('PDB case manifest records the remote package boundary', () => {
  assert.equal(SOURCE_PACKAGE_ID, 'rmdb_pdb_sequence_cases_rasp_params_besthit_20260610');
  assert.equal(PDB_CASE_SCHEMA_VERSION, 'pdb-case.v1');
  assert.equal(pdbCaseManifest.sourcePackageId, SOURCE_PACKAGE_ID);
  assert.equal(pdbCaseManifest.schemaVersion, PDB_CASE_SCHEMA_VERSION);
  assert.match(pdbCaseManifest.publicRoot, /FoldBridgeShare/);
  assert.match(pdbCaseManifest.supportRoot, /03_foldbridge_rmdb_rasp/);
});

test('PDB case index exposes page-grain and quality fields', () => {
  assert.ok(pdbCaseRows.length >= 5);

  for (const row of pdbCaseRows) {
    assert.ok(row.caseId);
    assert.match(row.detailHref, /^#pdb-case\?pdbId=[A-Z0-9]+/);
    assert.equal(row.axisType, 'pdb_reference_sequence_position');
    assert.ok(['not-ready', 'partial', 'ready'].includes(row.residueMappingStatus));
    assert.equal(row.projectionStatus, 'pass');
    assert.equal(typeof row.baseMismatchRows, 'number');
    assert.equal(typeof row.identityPct, 'number');
    assert.equal(typeof row.queryCoveragePct, 'number');
    assert.equal(typeof row.subjectCoveragePct, 'number');
    assert.ok(row.profileCount >= 1);
  }
});

test('PDB case detail keeps profile-level summaries lightweight', () => {
  const detail = getPdbCaseDetail('5KPY');

  assert.equal(detail.pdbId, '5KPY');
  assert.ok(detail.profileSummaries.length > 1);
  assert.ok(detail.profileSummaries.every((profile) => profile.bundleProfileId && profile.rmdbUniqueId));
  assert.ok(detail.reactivityTrackPreview.length > 0);
  assert.ok(detail.reactivityTrackPreview.length <= 64);
  assert.ok(detail.reactivityTrackPreview.every((point) => Number.isInteger(point.pdbPos)));
});
