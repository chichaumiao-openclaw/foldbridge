import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildEntryRowsWithTechniqueEvidence,
  filterEntryRowsByTechniqueSelection,
  mergeEntryTechniqueEvidence,
  normalizeEntryRows
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

// 现网路径：normalizeEntryRows 直接从 entry-table.json 的 tech_filter 派生 techniqueNames/
// techniqueFamilies，两级 filter（filterEntryRowsByTechniqueSelection）在其上工作。这是
// 线上真实数据链，与上面的 evidence-join 路径无关。
test('normalizeEntryRows derives technique families/names from tech_filter', () => {
  const rows = normalizeEntryRows({
    schemaVersion: 'entry-table.v1',
    rows: [
      { pdb_id: '1MIX', auth: 'A', tech_filter: 'DMS;SHAPE;PARS;MOHCA;Mutate-and-map methods;CIRS-seq' },
      { pdb_id: '1EMP', auth: 'B', tech_filter: '' }
    ]
  });
  // MOHCA / Mutate-and-map 归 interaction；CIRS-seq 不入五类（保留在 names，不进 families）。
  assert.deepEqual(rows[0].techniqueNames,
    ['DMS', 'SHAPE', 'PARS', 'MOHCA', 'Mutate-and-map methods', 'CIRS-seq']);
  assert.deepEqual([...rows[0].techniqueFamilies].sort(),
    ['cleavage', 'dms', 'interaction', 'shape']);
  assert.deepEqual(rows[1].techniqueNames, []);
  assert.deepEqual(rows[1].techniqueFamilies, []);
});

test('two-level filter over tech_filter-derived rows (family + detail OR)', () => {
  const rows = normalizeEntryRows({
    schemaVersion: 'entry-table.v1',
    rows: [
      { pdb_id: '1DMS', auth: 'A', tech_filter: 'DMS;DMS-seq' },
      { pdb_id: '1SHP', auth: 'A', tech_filter: 'SHAPE;SHAPE-MaP' },
      { pdb_id: '1CLV', auth: 'A', tech_filter: 'Lead-seq;PARS' },
      { pdb_id: '1INT', auth: 'A', tech_filter: 'MOHCA;Mutate-and-map methods' },
      { pdb_id: '1OFF', auth: 'A', tech_filter: 'CIRS-seq;Glyoxal;Terbium' }
    ]
  });
  assert.deepEqual(
    filterEntryRowsByTechniqueSelection(rows, { families: new Set(['dms']), techniques: new Set() }).map((r) => r.pdbId),
    ['1DMS']
  );
  // MOHCA/Mutate-and-map 归 interaction。
  assert.deepEqual(
    filterEntryRowsByTechniqueSelection(rows, { families: new Set(['interaction']), techniques: new Set() }).map((r) => r.pdbId),
    ['1INT']
  );
  // 只在五类之外的行不被任一 family 命中（但空筛选时仍全量展示）。
  assert.deepEqual(
    filterEntryRowsByTechniqueSelection(rows, { families: new Set(['dms', 'shape', 'cleavage', 'nucleotide', 'interaction']), techniques: new Set() }).map((r) => r.pdbId),
    ['1DMS', '1SHP', '1CLV', '1INT']
  );
  assert.equal(filterEntryRowsByTechniqueSelection(rows, {}).length, 5);
});
