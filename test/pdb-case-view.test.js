import test from 'node:test';
import assert from 'node:assert/strict';
import { pdbCaseRows, getPdbCaseDetail } from '../src/data.js';
import { renderPdbCaseIndexPage, renderPdbCasePage } from '../src/pdbCaseView.js';

test('PDB case index presents case grain instead of molecule grain', () => {
  const html = renderPdbCaseIndexPage(pdbCaseRows);

  assert.match(html, /PDB case index/);
  assert.match(html, /One PDB case can contain multiple PDB references/);
  assert.match(html, /#pdb-case\?pdbId=5KPY/);
  assert.match(html, /Profiles/);
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
