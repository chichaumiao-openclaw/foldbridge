import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildEntryRowsWithTechniqueEvidence,
  filterEntryRowsByTechniqueSelection,
  mergeEntryTechniqueEvidence
} from '../src/entryTable.js';
import { renderEntryTablePage } from '../src/entryTableView.js';
import { buildMechanismFilterModel } from '../src/techniqueFilterModel.js';

const entryRows = [
  { pdbId: '1DMS', auth: 'A', probingCategory: 'dms-based-probing' },
  { pdbId: '1SHP', auth: 'A', probingCategory: 'shape-based-probing' },
  { pdbId: '1CLV', auth: 'A', probingCategory: 'cleavage-footprinting' }
];

const evidenceRows = [
  { pdbId: '1DMS', chains: ['A'], techniqueFamilies: ['dms-based-probing'], techniqueNames: ['DMS', 'DMS-seq'] },
  { pdbId: '1SHP', chains: ['A'], techniqueFamilies: ['shape-based-probing'], techniqueNames: ['SHAPE', 'SHAPE-MaP'] },
  { pdbId: '1CLV', chains: ['A'], techniqueFamilies: ['cleavage-footprinting'], techniqueNames: ['Lead-seq', 'PARS'] }
];

test('Entry renders the original five-family filter with detailed techniques', () => {
  const model = buildMechanismFilterModel();
  const techniqueCount = model.families.reduce((sum, family) => sum + family.techniques.length, 0);
  const html = renderEntryTablePage({
    rows: entryRows,
    techniqueSelection: {
      families: new Set(['cleavage']),
      techniques: new Set(['PARS'])
    }
  });

  assert.equal((html.match(/data-technique-family=/g) || []).length, 5);
  assert.equal((html.match(/data-technique-name=/g) || []).length, techniqueCount);
  for (const family of model.families) {
    assert.match(html, new RegExp(family.label));
    for (const technique of family.techniques) assert.match(html, new RegExp(`>${technique}<`));
  }
  assert.match(html, /data-technique-family="cleavage" checked/);
  assert.match(html, /data-technique-name="PARS" checked/);
});

test('Entry reuses original family and detailed-technique OR filtering', () => {
  const rows = mergeEntryTechniqueEvidence(entryRows, evidenceRows);

  assert.deepEqual(
    filterEntryRowsByTechniqueSelection(rows, { families: new Set(['dms']), techniques: new Set() }).map((row) => row.pdbId),
    ['1DMS']
  );
  assert.deepEqual(
    filterEntryRowsByTechniqueSelection(rows, { families: new Set(), techniques: new Set(['SHAPE-MaP']) }).map((row) => row.pdbId),
    ['1SHP']
  );
  assert.deepEqual(
    filterEntryRowsByTechniqueSelection(rows, { families: new Set(['dms']), techniques: new Set(['PARS']) }).map((row) => row.pdbId),
    ['1DMS', '1CLV']
  );
});

test('Entry technique evidence join fails on missing, duplicate, or extra chain rows', () => {
  assert.throws(
    () => mergeEntryTechniqueEvidence(entryRows, evidenceRows.slice(0, 2)),
    /missing technique evidence/i
  );
  assert.throws(
    () => mergeEntryTechniqueEvidence(entryRows, [...evidenceRows, evidenceRows[0]]),
    /duplicate technique evidence/i
  );
  assert.throws(
    () => mergeEntryTechniqueEvidence(entryRows, [...evidenceRows, { pdbId: '9EXT', chains: ['A'], techniqueFamilies: [], techniqueNames: [] }]),
    /unexpected technique evidence/i
  );
});

test('Entry production asset contract rejects empty or synchronously truncated inventories', () => {
  assert.throws(
    () => buildEntryRowsWithTechniqueEvidence(
      { schemaVersion: 'entry-table.v1', rowCount: 0, rows: [] },
      { schemaVersion: 'annojoin-atlas.v2', totalCaseCount: 0, totalSourceCaseCount: 0, displayCases: [] }
    ),
    /17,843/
  );
  assert.throws(
    () => buildEntryRowsWithTechniqueEvidence(
      { schemaVersion: 'entry-table.v1', rowCount: 1, rows: [{ pdb_id: '1DMS', auth: 'A' }] },
      { schemaVersion: 'annojoin-atlas.v2', totalCaseCount: 1, totalSourceCaseCount: 1, displayCases: [evidenceRows[0]] }
    ),
    /17,843/
  );
});

test('published Entry and ANNOJOIN assets satisfy the strict 17,843-row contract', () => {
  const entryPayload = JSON.parse(fs.readFileSync('src/assets/generated/entry-table/entry-table.json', 'utf8'));
  const atlasIndex = JSON.parse(fs.readFileSync('src/assets/generated/annojoin-atlas/index.json', 'utf8'));
  assert.equal(buildEntryRowsWithTechniqueEvidence(entryPayload, atlasIndex).length, 17843);
});
