import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoute } from '../src/router.js';
import {
  buildAtlasSearchState,
  createAtlasCaseDetail,
  REQUIRED_ATLAS_CAPABILITIES
} from '../src/annojoinAtlasData.js';
import { renderAnnojointAtlasPage } from '../src/annojoinAtlasView.js';

const fixtures = {
  cases: [
    {
      case_id: '10ZT',
      case_uid: 'RMDB2PDB|10ZT',
      pdb_id: '10ZT',
      pdb_chain_ids: 'A',
      profile_ids: 'rmdbv3_exact_alpha|top_x_279::seq_alpha|10ZT_A',
      profile_count: '1',
      profile_ids_complete: 'true',
      profile_membership_route_id: 'annojoin:profiles:RMDB2PDB:10ZT',
      source_databases: 'RMDB;PDB',
      assay_family_set: 'rmdb_chemical_probing',
      rna_family_label: 'Group I intron',
      rna_family_provenance: 'sidecar',
      motif_label: 'P4-P6 domain',
      motif_provenance: 'curated',
      structure_class_label: 'ribozyme',
      structure_class_provenance: 'PDB',
      fec_claim_ceiling_distribution: '{"C_EXPLORATORY_HINT":1}',
      coverage_shape_distribution: 'see ANNOCONFIDENCE/coverage_topology_annotation.tsv',
      conflict_candidate_count: '2',
      has_context_annotation: 'true',
      has_lss_annotation: 'true',
      search_text: '10ZT Group I intron P4-P6 ribozyme SHAPE',
      route_id: 'annojoin:case:RMDB2PDB:10ZT'
    },
    {
      case_id: '10ZU',
      case_uid: 'RMDB2PDB|10ZU',
      pdb_id: '10ZU',
      pdb_chain_ids: '',
      profile_ids: 'bundle_preview_should_not_render',
      profile_count: '3',
      profile_ids_complete: 'false',
      profile_membership_route_id: 'annojoin:profiles:RMDB2PDB:10ZU',
      source_databases: 'RMDB;PDB',
      assay_family_set: 'rmdb_chemical_probing',
      rna_family_label: '',
      motif_label: '',
      structure_class_label: '',
      fec_claim_ceiling_distribution: '{"C_EXPLORATORY_HINT":3}',
      coverage_shape_distribution: 'see ANNOCONFIDENCE/coverage_topology_annotation.tsv',
      conflict_candidate_count: '',
      has_context_annotation: 'true',
      has_lss_annotation: 'true',
      search_text: '10ZU RMDB2PDB chemical probing',
      route_id: 'annojoin:case:RMDB2PDB:10ZU'
    }
  ],
  facets: [
    { facet_name: 'PDB ID', source_table: 'anno_case_search_index.tsv', source_column: 'pdb_id', display_label: 'PDB ID', facet_group: 'identity' },
    { facet_name: 'RNA family', source_table: 'anno_case_search_index.tsv', source_column: 'rna_family_label', display_label: 'RNA family', facet_group: 'biology' },
    { facet_name: 'probe type', source_table: 'assay_numeric_usability_annotation.tsv', source_column: 'raw_assay_label', display_label: 'Probe type', facet_group: 'assay' }
  ],
  summaries: [
    {
      case_id: '10ZT',
      profile_count: '1',
      pair_count: '1',
      residue_evidence_count: '100',
      recommended_default_preset: 'balanced_segment_view',
      summary_route_id: 'annojoin:summary:RMDB2PDB:10ZT'
    }
  ],
  routes: [
    {
      case_id: '10ZT',
      detail_route_id: '/atlas/rmdb2pdb/10ZT',
      mapping_table_route_id: 'annojoin:mapping:RMDB2PDB:10ZT',
      coverage_annotation_route_id: 'annojoin:coverage:RMDB2PDB:10ZT',
      fec_annotation_route_id: 'annojoin:fec:RMDB2PDB:10ZT',
      assay_numeric_route_id: 'annojoin:numeric:RMDB2PDB:10ZT',
      structure_context_route_id: 'annojoin:structure-context:RMDB2PDB:10ZT',
      lss_annotation_route_id: 'annojoin:lss:RMDB2PDB:10ZT',
      conflict_annotation_route_id: 'annojoin:conflict:RMDB2PDB:10ZT',
      source_download_route_id: 'download:RMDB2PDB:10ZT:annotation_bundle'
    }
  ],
  memberships: [
    { case_id: '10ZT', profile_id: 'data-eterna/OK7ALIB_2A3_0000.rdat#5914', pair_id: '10ZT:sequence_000001' },
    { case_id: '10ZT', profile_id: 'data-eterna/OK7ALIB_DMS_0000.rdat#5915', pair_id: '10ZT:sequence_000002' }
  ],
  tracks: [
    {
      case_id: '10ZT',
      profile_id: 'data-eterna/OK7ALIB_2A3_0000.rdat#5914',
      track_route_id: 'annojoin:track:RMDB2PDB:pairseg_10ZT_sequence_000001',
      track_data_path: 'ANNOCONFIDENCE/assay_numeric_usability_annotation.tsv',
      supports_1d: 'true',
      supports_table: 'true',
      color_policy_id: 'rmdb_reactivity_low_mid_high_v1'
    }
  ],
  pairs2d: [
    {
      case_id: '10ZT',
      context_route_id: 'annojoin:2d:RMDB2PDB:pairseg_10ZT_sequence_000001',
      pair_context_data_path: 'ANNOCONFIDENCE/lss_structure_context_annotation.tsv',
      supports_pair_arc_view: 'true',
      supports_dot_bracket_view: 'false',
      supports_residue_hover: 'true'
    }
  ],
  lssContexts: [
    {
      case_id: '10ZT',
      pair_id: '10ZT:sequence_000001',
      pair_segment_id: 'pairseg_10ZT_sequence_000001',
      profile_id: 'data-eterna/data-eterna/OK7ALIB_2A3_0000.rdat#5914',
      pdb_id: '10ZT',
      residue_key_or_segment_key: '10ZT:2-69',
      n_evaluable: '59',
      n_paired_evaluable: '54',
      n_unpaired_evaluable: '5',
      lss_status: 'LSS_MODERATE_CANDIDATE',
      context_engine: 'FEC_V0_4_BETA_LSS'
    }
  ],
  colors3d: [
    {
      case_id: '10ZT',
      structure_file_path: 'CONFIDENCE/10_structure_context/alpha_full_20260615/mmcif_inputs_from_132/10zt.cif',
      structure_url: '/api/annojoin/structure?path=CONFIDENCE%2F10_structure_context%2Falpha_full_20260615%2Fmmcif_inputs_from_132%2F10zt.cif',
      structure_file_format: 'mmCIF',
      residue_coloring_data_path: 'ANNOCONFIDENCE/mapping_uncertainty_annotation.tsv',
      pdb_residue_coordinate_key_column: 'pdb_residue_coordinate_key',
      value_column: 'reactivity_value'
    }
  ],
  residueEvidence: [
    {
      case_id: '10ZT',
      pair_id: '10ZT:sequence_000001',
      rmdb_profile_id: 'data-eterna/data-eterna/OK7ALIB_2A3_0000.rdat#5914',
      rmdb_position: '27',
      rmdb_base: 'T',
      pdb_id: '10ZT',
      label_asym_id: 'A',
      label_seq_id: '2',
      auth_seq_id: '2',
      comp_id: 'T',
      parent_base: 'T',
      residue_key: '10ZT|1|1|A|2|T',
      reactivity_value: '0.6295',
      reactivity_error: '0.015',
      numeric_status: 'NUMERIC_VALUE_PRESENT',
      residue_projection_status: 'PROJECTED',
      structure_reactivity_status: 'NOT_EVALUATED'
    },
    {
      case_id: '10ZT',
      pair_id: '10ZT:sequence_000001',
      rmdb_profile_id: 'data-eterna/data-eterna/OK7ALIB_2A3_0000.rdat#5914',
      rmdb_position: '28',
      rmdb_base: 'G',
      pdb_id: '10ZT',
      label_asym_id: 'A',
      label_seq_id: '3',
      auth_seq_id: '3',
      comp_id: 'G',
      parent_base: 'G',
      residue_key: '10ZT|1|1|A|3|G',
      reactivity_value: '1.4200',
      reactivity_error: '0.020',
      numeric_status: 'NUMERIC_VALUE_PRESENT',
      residue_projection_status: 'PROJECTED',
      structure_reactivity_status: 'NOT_EVALUATED'
    }
  ],
  conflicts: [
    { case_id: '10ZT', conflict_candidate_route_id: 'annojoin:conflict-candidate:RMDB2PDB:10ZT', discordance_status: 'review_candidate', candidate_reason: 'coverage disagreement' }
  ],
  presets: [
    { preset_id: 'balanced_segment_view', display_name: 'Balanced segment view', preset_scope: 'atlas_view', editable_by_user: 'true' }
  ],
  downloads: [
    { download_id: 'atlas_download_manifest', artifact_path: 'ANNOJOIN/atlas_download_manifest.tsv', row_count: '24', sha256: 'abc123' }
  ]
};

test('router accepts annjoin atlas route', () => {
  assert.equal(normalizeRoute('annojoin-atlas'), 'annojoin-atlas');
});

test('atlas search state is ANNOJOIN first and supports required facets', () => {
  const state = buildAtlasSearchState(fixtures, { query: 'ribozyme', structureClass: 'ribozyme' });
  assert.equal(state.source.entryRoot, 'ANNOJOIN');
  assert.equal(state.source.browserLoadsAnnoconfidenceBigTables, false);
  assert.equal(state.cases.length, 1);
  assert.equal(state.cases[0].pdbId, '10ZT');
  assert.deepEqual(
    state.facets.map((facet) => facet.name),
    ['PDB ID', 'RNA family', 'probe type']
  );
});

test('atlas search state accepts generated normalized index rows', () => {
  const state = buildAtlasSearchState({
    cases: [{
      caseId: '10ZT',
      caseUid: 'RMDB2PDB|10ZT',
      pdbId: '10ZT',
      profileCount: 1,
      profilePreview: ['profile-a'],
      profilePreviewIsComplete: true,
      assayFamilies: ['rmdb_chemical_probing'],
      rnaFamily: 'Group I intron',
      motif: 'P4-P6 domain',
      structureClass: 'ribozyme',
      searchText: '10ZT Group I intron P4-P6 ribozyme'
    }],
    facets: [{ name: 'PDB ID', label: 'PDB ID', sourceTable: 'anno_case_search_index.tsv', sourceColumn: 'pdb_id' }]
  }, { query: 'group i' });

  assert.equal(state.cases.length, 1);
  assert.equal(state.cases[0].caseId, '10ZT');
  assert.equal(state.cases[0].profileCount, 1);
});

test('atlas detail preserves profile preview boundary and route-backed evidence panes', () => {
  const detail = createAtlasCaseDetail(fixtures, '10ZT');
  assert.equal(detail.caseId, '10ZT');
  assert.equal(detail.profilePreviewIsComplete, true);
  assert.equal(detail.memberships.length, 2);
  assert.equal(detail.trackRoutes[0].trackDataPath, 'ANNOCONFIDENCE/assay_numeric_usability_annotation.tsv');
  assert.equal(detail.structureRoutes[0].structureFilePath.startsWith('CONFIDENCE/10_structure_context/'), true);
  assert.equal(detail.structureRoutes[0].coordinateKeyColumn, 'pdb_residue_coordinate_key');
});

test('atlas detail derives residue-level visual previews without browser-loading big tables', () => {
  const detail = createAtlasCaseDetail(fixtures, '10ZT');

  assert.equal(detail.visualPreview.browserLoadsAnnoconfidenceBigTables, false);
  assert.equal(detail.visualPreview.reactivity1d.points.length, 2);
  assert.deepEqual(
    detail.visualPreview.reactivity1d.points.map((point) => [point.pdbResidue, point.reactivityValue, point.colorBin]),
    [['A:2 T', 0.6295, 'mid'], ['A:3 G', 1.42, 'high']]
  );
  assert.equal(detail.visualPreview.pairArcs[0].start, 2);
  assert.equal(detail.visualPreview.pairArcs[0].end, 69);
  assert.equal(detail.visualPreview.structureColoring.points[0].coordinateKey, '10ZT|1|1|A|2|T');
  assert.equal(detail.visualPreview.mappedResidues[0].numericStatus, 'NUMERIC_VALUE_PRESENT');
});

test('atlas page renders the nine required top-level capabilities', () => {
  const state = buildAtlasSearchState(fixtures, {});
  const detail = createAtlasCaseDetail(fixtures, '10ZT');
  const html = renderAnnojointAtlasPage({ state, detail });

  for (const capability of REQUIRED_ATLAS_CAPABILITIES) {
    assert.match(html, new RegExp(`data-atlas-capability="${capability.id}"`));
  }
  assert.match(html, /Download current-filter result/);
  assert.match(html, /ANNOCONFIDENCE stays server-side/);
  assert.doesNotMatch(html, /bundle_preview_should_not_render/);
});

test('atlas page renders visual 1D 2D 3D panes and mapped residue rows', () => {
  const state = buildAtlasSearchState(fixtures, {});
  const detail = createAtlasCaseDetail(fixtures, '10ZT');
  const html = renderAnnojointAtlasPage({ state, detail });

  assert.match(html, /class="annojoin-reactivity-track"/);
  assert.match(html, /data-reactivity-value="0.6295"/);
  assert.match(html, /class="annojoin-pair-arc-svg"/);
  assert.match(html, /data-pair-segment="10ZT:2-69"/);
  assert.match(html, /data-structure-color-bin="high"/);
  assert.match(html, /href="\/api\/annojoin\/structure\?path=CONFIDENCE%2F10_structure_context%2Falpha_full_20260615%2Fmmcif_inputs_from_132%2F10zt\.cif"/);
  assert.match(html, /Open mmCIF/);
  assert.match(html, /data-annojoin-structure-viewer/);
  assert.match(html, /class="annojoin-structure-canvas"/);
  assert.match(html, /data-annojoin-structure-colors/);
  assert.match(html, /Mapped residue preview rows/);
  assert.match(html, /A:2 T/);
});

test('atlas page exposes current-filter dynamic export link', () => {
  const state = buildAtlasSearchState(fixtures, { query: 'ribozyme', structureClass: 'ribozyme' });
  const detail = createAtlasCaseDetail(fixtures, '10ZT');
  const html = renderAnnojointAtlasPage({ state, detail });

  assert.match(html, /href="\/api\/annojoin\/export-current-filter\?q=ribozyme&amp;structureClass=ribozyme&amp;format=csv"/);
  assert.match(html, /Download filtered CSV/);
});

test('atlas page renders paginated generated overview previews', () => {
  const state = buildAtlasSearchState({
    cases: [{ caseId: '10ZT', pdbId: '10ZT', profileCount: 1, searchText: '10ZT' }],
    facets: [],
    presets: [],
    downloads: []
  }, {});
  const detail = {
    caseId: '10ZT',
    profileMembershipRouteId: 'annojoin:profiles:RMDB2PDB:10ZT',
    summary: { summaryRouteId: 'annojoin:summary:RMDB2PDB:10ZT', recommendedDefaultPreset: 'balanced_segment_view' },
    detailRoutes: { mappingTableRouteId: 'annojoin:mapping:RMDB2PDB:10ZT', detailRouteId: '/atlas/rmdb2pdb/10ZT' },
    memberships: { totalRows: 10, pageCount: 2, path: 'cases/10ZT/memberships/page-0001.json', preview: [{ pairId: 'p1', profileId: 'profile-a', routeId: 'annojoin:profiles:RMDB2PDB:10ZT' }] },
    trackRoutes: { totalRows: 10, pageCount: 2, path: 'cases/10ZT/track-routes/page-0001.json', preview: [{ trackRouteId: 'annojoin:track:10ZT', trackDataPath: 'ANNOCONFIDENCE/assay_numeric_usability_annotation.tsv', colorPolicyId: 'rmdb_reactivity_low_mid_high_v1' }] },
    pairContextRoutes: { totalRows: 10, pageCount: 2, path: 'cases/10ZT/pair-context-routes/page-0001.json', preview: [{ contextRouteId: 'annojoin:2d:10ZT', pairContextDataPath: 'ANNOCONFIDENCE/lss_structure_context_annotation.tsv', supportsPairArcView: true, supportsResidueHover: true }] },
    structureRoutes: { totalRows: 10, pageCount: 2, path: 'cases/10ZT/structure-routes/page-0001.json', preview: [{ structureFilePath: 'CONFIDENCE/10_structure_context/x/10zt.cif', structureUrl: '/api/annojoin/structure?path=CONFIDENCE%2F10_structure_context%2Fx%2F10zt.cif', residueColoringDataPath: 'ANNOCONFIDENCE/mapping_uncertainty_annotation.tsv', coordinateKeyColumn: 'pdb_residue_coordinate_key', valueColumn: 'reactivity_value' }] },
    conflicts: { totalRows: 1, pageCount: 1, path: 'cases/10ZT/conflicts/page-0001.json', preview: [{ type: 'structure_signal_discordance_candidate', status: 'candidate', fecClaimCeiling: 'C_EXPLORATORY_HINT', reviewPriorityHint: 'review' }] }
  };

  const html = renderAnnojointAtlasPage({ state, detail });
  assert.match(html, /cases\/10ZT\/track-routes\/page-0001\.json/);
  assert.match(html, /profile-a/);
  assert.match(html, /pdb_residue_coordinate_key/);
});
