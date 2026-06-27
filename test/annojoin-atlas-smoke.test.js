import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runAnnojointAtlasSmoke } from '../scripts/lib/annojoin-atlas-smoke.mjs';

async function writeJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data)}\n`);
}

test('annojoin atlas smoke verifies at least 20 case assets across required panes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'annojoin-smoke-'));
  const cases = Array.from({ length: 20 }, (_, index) => {
    const caseId = `C${String(index + 1).padStart(4, '0')}`;
    return {
      caseId,
      pdbId: caseId,
      parentClassLabel: `Parent ${index % 4}`,
      childClassLabel: `Child ${index % 7}`,
      biologicalMoleculeName: `Biological molecule ${index + 1}`,
      pdbMoleculeName: `PDB molecule ${index + 1}`,
      confidenceDisplayLabel: 'B_CONTEXT_STRATIFIED (1)',
      profileCount: 1,
      caseAssetPath: `cases/${caseId}.json`,
      assayFamilies: ['rmdb_chemical_probing'],
      searchText: caseId
    };
  });
  await writeJson(path.join(root, 'index.json'), {
    version: 'V2.1_RMDB_LINE_A_20260617',
    source: { entryRoot: 'ANNOJOIN', annotationRoot: 'ANNOCONFIDENCE', browserLoadsAnnoconfidenceBigTables: false },
    totalCaseCount: 20,
    caseHierarchy: [
      { id: 'parent-0', label: 'Parent 0', caseCount: 5, children: [{ id: 'parent-0-child-0', label: 'Child 0', caseCount: 3, cases: ['C0001', 'C0008', 'C0015'] }] }
    ],
    cases,
    facets: Array.from({ length: 12 }, (_, index) => ({ name: `facet-${index}` })),
    presets: Array.from({ length: 6 }, (_, index) => ({ id: `preset-${index}` })),
    downloads: [{ id: 'download:case_search', filePath: 'ANNOJOIN/anno_case_search_index.tsv' }]
  });
  for (const row of cases) {
    await writeJson(path.join(root, row.caseAssetPath), {
      case: row,
      summary: { summaryRouteId: `summary:${row.caseId}` },
      detailRoutes: { detailRouteId: `/atlas/${row.caseId}`, mappingTableRouteId: `mapping:${row.caseId}` },
      memberships: { totalRows: 1, preview: [{ pairId: `${row.caseId}:pair`, profileId: 'profile-a' }] },
      trackRoutes: { totalRows: 1, preview: [{ trackRouteId: `track:${row.caseId}`, trackDataPath: 'ANNOCONFIDENCE/assay_numeric_usability_annotation.tsv' }] },
      pairContextRoutes: { totalRows: 1, preview: [{ contextRouteId: `2d:${row.caseId}`, pairContextDataPath: 'ANNOCONFIDENCE/lss_structure_context_annotation.tsv', supportsPairArcView: true }] },
      structureRoutes: { totalRows: 1, preview: [{ structureFilePath: `CONFIDENCE/10_structure_context/${row.caseId}.cif`, structureUrl: `/api/annojoin/structure?path=CONFIDENCE%2F10_structure_context%2F${row.caseId}.cif`, coordinateKeyColumn: 'pdb_residue_coordinate_key' }] },
      conflicts: { totalRows: 0, preview: [] },
      visualPreview: {
        browserLoadsAnnoconfidenceBigTables: false,
        reactivity1d: { points: [{ pdbResidue: 'A:1 G', reactivityValue: 0.4 }] },
        pairArcs: [{ segmentLabel: `${row.caseId}:1-10`, start: 1, end: 10 }],
        structureColoring: { structureUrl: `/api/annojoin/structure?path=CONFIDENCE%2F10_structure_context%2F${row.caseId}.cif`, points: [{ coordinateKey: `${row.caseId}|1|A|1`, colorBin: 'mid' }] },
        mappedResidues: [{ pdbResidue: 'A:1 G', reactivityValue: 0.4, coordinateKey: `${row.caseId}|1|A|1` }]
      },
      routeAssets: {
        visualPreview: { path: `cases/${row.caseId}/visual-preview/page-0001.json`, totalRows: 1 }
      },
      annotationPayloadRowsCopied: 0
    });
  }

  const result = await runAnnojointAtlasSmoke({ assetRoot: root, sampleSize: 20 });

  assert.equal(result.status, 'pass');
  assert.equal(result.sampledCaseCount, 20);
  assert.equal(result.source.entryRoot, 'ANNOJOIN');
  assert.equal(result.browserLoadsAnnoconfidenceBigTables, false);
  assert.equal(result.checkedCapabilities.includes('download-current-filter'), true);
  assert.equal(result.failures.length, 0);
});

test('annojoin atlas smoke accepts declared RASP visual blockers without 3D URL or preview points', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'annojoin-smoke-blocked-'));
  const cases = Array.from({ length: 20 }, (_, index) => {
    const caseId = `R${String(index + 1).padStart(4, '0')}`;
    return {
      caseId,
      pdbId: caseId,
      parentClassLabel: 'RASP public current',
      childClassLabel: 'raw-hit case',
      biologicalMoleculeName: `RASP molecule ${index + 1}`,
      pdbMoleculeName: `RASP PDB molecule ${index + 1}`,
      confidenceDisplayLabel: 'RASP public current; positive confidence not active',
      profileCount: 1,
      caseAssetPath: `cases/${caseId}.json`,
      assayFamilies: ['rasp_public_current'],
      searchText: caseId
    };
  });
  await writeJson(path.join(root, 'index.json'), {
    source: { entryRoot: 'ANNOJOIN', annotationRoot: 'ANNOCONFIDENCE', browserLoadsAnnoconfidenceBigTables: false },
    totalCaseCount: 20,
    caseHierarchy: [{ id: 'rasp', label: 'RASP', caseCount: 20, children: [{ id: 'rasp-current', label: 'current', caseCount: 20, cases: cases.map((row) => row.caseId) }] }],
    cases,
    facets: Array.from({ length: 12 }, (_, index) => ({ name: `facet-${index}` })),
    presets: Array.from({ length: 6 }, (_, index) => ({ id: `preset-${index}` })),
    downloads: [{ id: 'download:case_search', filePath: 'ANNOJOIN/anno_case_search_index.tsv' }]
  });
  for (const row of cases) {
    await writeJson(path.join(root, row.caseAssetPath), {
      case: row,
      summary: { summaryRouteId: `summary:${row.caseId}` },
      detailRoutes: { detailRouteId: `/atlas/${row.caseId}`, mappingTableRouteId: `mapping:${row.caseId}` },
      memberships: { totalRows: 1, preview: [{ pairId: `${row.caseId}:pair`, profileId: 'rasp-profile-a' }] },
      trackRoutes: { totalRows: 1, preview: [{ trackRouteId: `track:${row.caseId}`, trackDataPath: `rasp_public_residue_tracks/${row.caseId}.tsv`, supports1d: true }] },
      pairContextRoutes: {
        totalRows: 1,
        preview: [{
          contextRouteId: `2d:${row.caseId}`,
          routeAvailabilityStatus: 'blocked',
          blockerCode: 'RASP_PUBLIC_2D_CONTEXT_NOT_MATERIALIZED_BLOCKER'
        }]
      },
      structureRoutes: {
        totalRows: 1,
        preview: [{
          routeAvailabilityStatus: 'blocked',
          blockerCode: 'RASP_PUBLIC_3D_STRUCTURE_ROUTE_NOT_MATERIALIZED_BLOCKER'
        }]
      },
      conflicts: { totalRows: 0, preview: [] },
      visualPreview: {
        browserLoadsAnnoconfidenceBigTables: false,
        reactivity1d: { points: [] },
        pairArcs: [],
        structureColoring: { structureUrl: '', points: [] },
        mappedResidues: []
      },
      routeAssets: {
        visualPreview: { path: `cases/${row.caseId}/visual-preview/page-0001.json`, totalRows: 0 }
      },
      annotationPayloadRowsCopied: 0
    });
  }

  const result = await runAnnojointAtlasSmoke({ assetRoot: root, sampleSize: 20 });

  assert.equal(result.status, 'pass');
  assert.equal(result.failures.length, 0);
});
