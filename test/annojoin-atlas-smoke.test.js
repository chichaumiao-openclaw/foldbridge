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
