import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPdbCaseIndexPage, renderPdbCasePage } from '../src/pdbCaseView.js';

const indexRows = [
  { pdbId: '8CBL', title: 'Group I intron', confidenceClass: 'high', confidenceScore: 1, profileCount: 1, residueCount: 218, detailHref: '#pdb-case?pdbId=8CBL' },
  { pdbId: '8A57', title: 'Ribozyme <hack>', confidenceClass: 'medium', confidenceScore: 0.5359, profileCount: 10, residueCount: 80, detailHref: '#pdb-case?pdbId=8A57' },
  { pdbId: '9QQQ', title: 'Aptamer', confidenceClass: 'low', confidenceScore: 0.4953, profileCount: 3, residueCount: 40, detailHref: '#pdb-case?pdbId=9QQQ' }
];

test('PDB case index renders case grain rows with detail links', () => {
  const html = renderPdbCaseIndexPage(indexRows);
  assert.match(html, /PDB case index/);
  assert.match(html, /#pdb-case\?pdbId=8CBL/);
  assert.match(html, /Group I intron/);
});

test('PDB case index shows three-tier confidence badges', () => {
  const html = renderPdbCaseIndexPage(indexRows);
  assert.match(html, /pdb-case-badge--high/);
  assert.match(html, /pdb-case-badge--medium/);
  assert.match(html, /pdb-case-badge--low/);
});

test('PDB case index exposes confidence filter controls and per-row class', () => {
  const html = renderPdbCaseIndexPage(indexRows);
  assert.match(html, /data-confidence-filter="all"/);
  assert.match(html, /data-confidence-filter="high"/);
  assert.match(html, /data-confidence-filter="medium"/);
  assert.match(html, /data-confidence-filter="low"/);
  assert.match(html, /data-confidence-class="high"/);
});

test('PDB case index escapes HTML in titles', () => {
  const html = renderPdbCaseIndexPage(indexRows);
  assert.match(html, /Ribozyme &lt;hack&gt;/);
  assert.doesNotMatch(html, /Ribozyme <hack>/);
});

test('PDB case index handles empty list without crashing', () => {
  const html = renderPdbCaseIndexPage([]);
  assert.match(html, /PDB case index/);
});

test('PDB case page explains projection semantics and residue-map boundary', () => {
  const detail = {
    pdbId: '8CBL', title: 'Group I intron', confidenceClass: 'high', confidenceScore: 1,
    profileCount: 1, residueCount: 218, projectionStatus: 'pass',
    projectionIsStructuralEvidence: false, observedResidueAxis: false,
    reactivityAxis: 'pdb_reference_sequence_position', residueMappingStatus: 'not-ready',
    baseMismatchRows: 2, alignmentRows: 109, reactivityRows: 218,
    rmdbUniqueSequenceCount: 1, rmdbProfileCount: 2, pdbReferenceIdCount: 1,
    identityPct: 99.083, queryCoveragePct: 52.657, subjectCoveragePct: 85.156,
    evalue: '2.88e-49', bitscore: 193,
    reactivity: [{ profileId: 'pf-2a3', profileKey: 'pf-2a3', summaryPath: 'reactivity/pf-2a3/summary.json', windows: [{ start: 1, end: 100, path: 'reactivity/pf-2a3/pdb-pos-1-100.json' }] }],
    alignmentPageCount: 5
  };
  const profiles = [
    { bundleProfileId: 'top_x_279::OK3TST_2A3', profileKey: 'pf-2a3', rmdbUniqueId: 'rmdbseq_0f3', rdatFile: 'data-eterna/OK3TST_2A3_0000.rdat', sequenceLength: 207, identityFraction: 0.99083 }
  ];
  const alignmentPage = { page: 1, pageSize: 25, rows: [{ alignment_column: '1', rmdb_query_pos: '47', pdb_pos: '1', rmdb_base: 'G', pdb_base: 'G', match_state: 'match' }] };
  const reactivitySummary = { profileKey: 'pf-2a3', minPos: 1, maxPos: 109, pointCount: 109, trackPreview: [{ pdbPos: 1, pdbBase: 'G', reactivity: null }, { pdbPos: 2, pdbBase: 'U', reactivity: 0.5 }] };

  const html = renderPdbCasePage(detail, { pdbId: '8CBL' }, { profiles, alignmentPage, reactivitySummary });

  assert.match(html, /PDB case page/);
  assert.match(html, /projection_status=pass only means the projection workflow completed/);
  assert.match(html, /pdb_pos is a PDB reference sequence position/);
  assert.match(html, /3D residue coloring is disabled/);
});

test('PDB case page renders all four modules with confidence badge', () => {
  const detail = {
    pdbId: '8CBL', title: 'Group I intron', confidenceClass: 'high', confidenceScore: 1,
    profileCount: 1, residueCount: 218, projectionStatus: 'pass',
    projectionIsStructuralEvidence: false, observedResidueAxis: false,
    reactivityAxis: 'pdb_reference_sequence_position', residueMappingStatus: 'not-ready',
    baseMismatchRows: 2, identityPct: 99.083, queryCoveragePct: 52.657, subjectCoveragePct: 85.156,
    rmdbUniqueSequenceCount: 1, rmdbProfileCount: 2, pdbReferenceIdCount: 1,
    reactivity: [{ profileId: 'pf-2a3', profileKey: 'pf-2a3', windows: [{ start: 1, end: 100, path: 'x' }] }],
    alignmentPageCount: 5
  };
  const profiles = [{ bundleProfileId: 'top_x_279::OK3TST_2A3', profileKey: 'pf-2a3', rmdbUniqueId: 'rmdbseq_0f3', rdatFile: 'data-eterna/OK3TST_2A3_0000.rdat', sequenceLength: 207, identityFraction: 0.99083 }];
  const alignmentPage = { page: 1, pageSize: 25, rows: [{ alignment_column: '1', rmdb_query_pos: '47', pdb_pos: '1', rmdb_base: 'G', pdb_base: 'G', match_state: 'match' }] };
  const reactivitySummary = { profileKey: 'pf-2a3', minPos: 1, maxPos: 109, pointCount: 109, trackPreview: [{ pdbPos: 1, pdbBase: 'G', reactivity: 0.3 }] };

  const html = renderPdbCasePage(detail, { pdbId: '8CBL' }, { profiles, alignmentPage, reactivitySummary });

  // Module 1: overview + quality
  assert.match(html, /pdb-case-badge--high/);
  assert.match(html, /99\.083/);
  // Module 2: profile/provenance
  assert.match(html, /OK3TST_2A3_0000\.rdat/);
  assert.match(html, /pdb-case-profile-section/);
  // Module 3: reactivity track
  assert.match(html, /pdb-case-track/);
  // Module 4: base-level alignment
  assert.match(html, /pdb-case-alignment-section/);
  assert.match(html, /match_state|Match state/i);
  assert.match(html, /data-alignment-page/);
  // accessibility caption on alignment table
  assert.match(html, /<caption/);
});

test('PDB case page handles missing detail gracefully', () => {
  const html = renderPdbCasePage(null, { pdbId: '8ZZZ' });
  assert.match(html, /not found/i);
  assert.match(html, /8ZZZ/);
});

test('PDB case page renders without optional assets (loading state)', () => {
  const detail = {
    pdbId: '8CBL', title: 'X', confidenceClass: 'low', confidenceScore: 0.4,
    projectionStatus: 'pass', projectionIsStructuralEvidence: false, observedResidueAxis: false,
    residueMappingStatus: 'not-ready', reactivity: [], alignmentPageCount: 0
  };
  const html = renderPdbCasePage(detail, { pdbId: '8CBL' }, {});
  assert.match(html, /PDB case page/);
  assert.match(html, /3D residue coloring is disabled/);
});
