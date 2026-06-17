import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAtlasCaseAsset,
  buildAtlasIndexAsset,
  buildPagedRouteAssets,
  groupByCaseId,
  parseTsv
} from '../scripts/lib/annojoin-atlas-corpus.mjs';

test('parseTsv keeps empty trailing columns', () => {
  assert.deepEqual(parseTsv('a\tb\tc\n1\t\t\n'), [{ a: '1', b: '', c: '' }]);
});

test('groupByCaseId indexes rows by case_id', () => {
  const grouped = groupByCaseId([
    { case_id: '10ZT', value: 'a' },
    { case_id: '10ZU', value: 'b' },
    { case_id: '10ZT', value: 'c' }
  ]);
  assert.equal(grouped.get('10ZT').length, 2);
  assert.equal(grouped.get('10ZU').length, 1);
});

test('buildAtlasIndexAsset keeps ANNOJOIN tables as browser entry and omits large annotation payloads', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      { case_id: '10ZT', case_uid: 'RMDB2PDB|10ZT', pdb_id: '10ZT', profile_count: '1', profile_ids: 'profile-a', profile_ids_complete: 'true', search_text: '10ZT ribozyme', route_id: 'annojoin:case:10ZT' }
    ],
    facets: [{ facet_name: 'PDB ID', source_table: 'anno_case_search_index.tsv', source_column: 'pdb_id', display_label: 'PDB ID' }],
    summaries: [{ case_id: '10ZT', recommended_default_preset: 'balanced_segment_view' }],
    routes: [{ case_id: '10ZT', detail_route_id: '/atlas/rmdb2pdb/10ZT' }],
    presets: [{ preset_id: 'balanced_segment_view', preset_name: 'Balanced segment view' }],
    downloads: [{ download_id: 'download:case_search', download_label: 'case search', file_path: 'ANNOJOIN/anno_case_search_index.tsv', row_count: '1126' }]
  });

  assert.equal(asset.source.entryRoot, 'ANNOJOIN');
  assert.equal(asset.source.browserLoadsAnnoconfidenceBigTables, false);
  assert.equal(asset.cases.length, 1);
  assert.equal(asset.cases[0].caseAssetPath, 'cases/10ZT.json');
  assert.equal(asset.cases[0].recommendedDefaultPreset, 'balanced_segment_view');
  assert.equal(asset.cases[0].detailRouteId, '/atlas/rmdb2pdb/10ZT');
  assert.equal(asset.presets.length, 1);
  assert.deepEqual(Object.keys(asset).sort(), ['cases', 'downloads', 'facets', 'generatedAt', 'presets', 'schemaVersion', 'source', 'totalCaseCount', 'version'].sort());
});

test('buildAtlasCaseAsset writes route-backed detail without copying ANNOCONFIDENCE table contents', () => {
  const asset = buildAtlasCaseAsset({
    caseId: '10ZT',
    cases: [{ case_id: '10ZT', pdb_id: '10ZT', profile_count: '1', profile_ids: 'profile-a', profile_ids_complete: 'true' }],
    summaries: [{ case_id: '10ZT', profile_count: '1', pair_count: '1', recommended_default_preset: 'balanced_segment_view' }],
    routes: [{ case_id: '10ZT', assay_numeric_route_id: 'annojoin:numeric:10ZT', mapping_table_route_id: 'annojoin:mapping:10ZT' }],
    memberships: [{ case_id: '10ZT', pair_id: '10ZT:sequence_000001', profile_id: 'profile-a' }],
    tracks: [{ case_id: '10ZT', track_route_id: 'annojoin:track:10ZT', track_data_path: 'ANNOCONFIDENCE/assay_numeric_usability_annotation.tsv' }],
    pairs2d: [{ case_id: '10ZT', context_route_id: 'annojoin:2d:10ZT', pair_context_data_path: 'ANNOCONFIDENCE/lss_structure_context_annotation.tsv' }],
    lssContexts: [{ case_id: '10ZT', pair_id: '10ZT:sequence_000001', residue_key_or_segment_key: '10ZT:2-69', n_paired_evaluable: '54', n_unpaired_evaluable: '5', lss_status: 'LSS_MODERATE_CANDIDATE' }],
    colors3d: [{
      case_id: '10ZT',
      structure_file_path: 'CONFIDENCE/10_structure_context/x/10zt.cif',
      structure_url: '/api/annojoin/structure?path=CONFIDENCE%2F10_structure_context%2Fx%2F10zt.cif',
      residue_coloring_data_path: 'ANNOCONFIDENCE/mapping_uncertainty_annotation.tsv',
      pdb_residue_coordinate_key_column: 'pdb_residue_coordinate_key'
    }],
    conflicts: [{ case_id: '10ZT', conflict_candidate_id: 'conflict-1', conflict_status: 'candidate' }],
    residueEvidence: [
      { case_id: '10ZT', pair_id: '10ZT:sequence_000001', rmdb_profile_id: 'profile-a', rmdb_position: '27', label_asym_id: 'A', label_seq_id: '2', auth_seq_id: '2', comp_id: 'T', parent_base: 'T', residue_key: '10ZT|1|A|2|2||T', reactivity_value: '0.6295', reactivity_error: '0.015', numeric_status: 'NUMERIC_VALUE_PRESENT', residue_projection_status: 'PROJECTED' },
      { case_id: '10ZT', pair_id: '10ZT:sequence_000001', rmdb_profile_id: 'profile-a', rmdb_position: '28', label_asym_id: 'A', label_seq_id: '3', auth_seq_id: '3', comp_id: 'G', parent_base: 'G', residue_key: '10ZT|1|A|3|3||G', reactivity_value: '1.4200', reactivity_error: '0.020', numeric_status: 'NUMERIC_VALUE_PRESENT', residue_projection_status: 'PROJECTED' }
    ]
  });

  assert.equal(asset.case.caseId, '10ZT');
  assert.equal(asset.memberships.preview.length, 1);
  assert.equal(asset.trackRoutes.preview[0].trackDataPath, 'ANNOCONFIDENCE/assay_numeric_usability_annotation.tsv');
  assert.equal(asset.structureRoutes.preview[0].structureFilePath.startsWith('CONFIDENCE/10_structure_context/'), true);
  assert.equal(asset.structureRoutes.preview[0].structureUrl, '/api/annojoin/structure?path=CONFIDENCE%2F10_structure_context%2Fx%2F10zt.cif');
  assert.equal(asset.structureRoutes.preview[0].coordinateKeyColumn, 'pdb_residue_coordinate_key');
  assert.equal(asset.routeAssets.memberships.path, 'cases/10ZT/memberships/page-0001.json');
  assert.equal(asset.routeAssets.trackRoutes.path, 'cases/10ZT/track-routes/page-0001.json');
  assert.equal(asset.routeAssets.visualPreview.path, 'cases/10ZT/visual-preview/page-0001.json');
  assert.equal(asset.visualPreview.reactivity1d.points[0].reactivityValue, 0.6295);
  assert.equal(asset.visualPreview.pairArcs[0].segmentLabel, '10ZT:2-69');
  assert.equal(asset.visualPreview.structureColoring.structureUrl, '/api/annojoin/structure?path=CONFIDENCE%2F10_structure_context%2Fx%2F10zt.cif');
  assert.equal(asset.visualPreview.structureColoring.points[1].colorBin, 'high');
  assert.equal(asset.annotationPayloadRowsCopied, 0);
});

test('buildPagedRouteAssets splits route arrays and keeps overview preview bounded', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({ id: `row-${index + 1}` }));
  const paged = buildPagedRouteAssets({
    caseId: '10ZT',
    routeKey: 'track-routes',
    rows,
    pageSize: 2,
    previewSize: 3
  });

  assert.equal(paged.summary.totalRows, 5);
  assert.equal(paged.summary.pageCount, 3);
  assert.equal(paged.summary.path, 'cases/10ZT/track-routes/page-0001.json');
  assert.deepEqual(paged.summary.preview.map((row) => row.id), ['row-1', 'row-2', 'row-3']);
  assert.deepEqual(paged.pages.map((page) => page.path), [
    'cases/10ZT/track-routes/page-0001.json',
    'cases/10ZT/track-routes/page-0002.json',
    'cases/10ZT/track-routes/page-0003.json'
  ]);
  assert.deepEqual(paged.pages[2].asset.rows.map((row) => row.id), ['row-5']);
});
