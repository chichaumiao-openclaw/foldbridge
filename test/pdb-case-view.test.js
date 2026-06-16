import test from 'node:test';
import assert from 'node:assert/strict';
import { getPdbCaseDetail } from '../src/data.js';
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
  const html = renderPdbCasePage(getPdbCaseDetail('5KPY'), {
    pdbId: '5KPY',
    bundleProfileId: 'RMDB_RNAPZ9_1M7_0001'
  });

  assert.match(html, /PDB case page/);
  assert.match(html, /projection_status=pass only means the projection workflow completed/);
  assert.match(html, /pdb_pos is a PDB reference sequence position/);
  assert.match(html, /3D residue coloring is disabled/);
  assert.match(html, /RMDB_RNAPZ9_1M7_0001/);
  assert.match(html, /selected-profile/);
});
