import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoute } from '../src/router.js';
import {
  buildAtlasSearchState,
  createAtlasCaseDetail
} from '../src/annojoinAtlasData.js';
import { renderAnnojointAtlasPage, renderLssEvidenceContent, hydrateLssEvidence } from '../src/annojoinAtlasView.js';
import { buildAtlasIndexAsset, slimAtlasIndexForWrite } from '../scripts/lib/annojoin-atlas-corpus.mjs';
import {
  sortAnnojointCases,
  searchAnnojointRows,
  paginateAnnojointRows,
  buildAnnojointTableGroups
} from '../src/annojoinAtlasTableModel.js';
import { LOCAL_PAGES_BRIDGE_MANIFEST } from '../src/assets/generated/local_pages_bridge_manifest.js';

const fixtures = {
  cases: [
    {
      case_id: '10ZT',
      case_uid: 'RMDB2PDB|10ZT',
      pdb_id: '10ZT',
      pdb_chain_ids: 'A',
      chainPlacements: [{ classLabel: 'Ribosome', nameLabel: '16S rRNA' }],
      parent_class_label: 'Ribosome',
      parent_class_source: 'PDB/biological_layer/governance_context_display_name',
      child_class_label: '16S rRNA',
      child_class_source: 'PDB/biological_layer/pdb_child_identity_index.tsv',
      biological_molecule_name: '16S ribosomal RNA',
      biological_molecule_name_source: 'PDB/biological_layer/pdb_child_identity_index.tsv',
      pdb_molecule_name: '30S ribosomal subunit RNA',
      pdb_molecule_name_source: 'pdb_author_entity_description_author_provided_display_name',
      confidence_display_label: 'B_CONTEXT_STRATIFIED (1); C_EXPLORATORY_HINT (2)',
      confidence_source: 'fec_claim_ceiling_distribution',
      profile_ids: 'rmdbv3_exact_alpha|top_x_279::seq_alpha|10ZT_A',
      profile_count: '3',
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
      chainPlacements: [{ classLabel: 'designed_RNA', nameLabel: 'MPNN-fixbb designed RNA molecule' }],
      parent_class_label: '',
      parent_class_source: '',
      child_class_label: 'MPNN-fixbb designed RNA molecule',
      child_class_source: 'pdb_struct_title_author_provided_display_name',
      biological_molecule_name: 'MPNN-fixbb designed RNA molecule',
      biological_molecule_name_source: 'pdb_struct_title_author_provided_display_name',
      pdb_molecule_name: 'MPNN-fixbb designed RNA molecule',
      pdb_molecule_name_source: 'pdb_struct_title_author_provided_display_name',
      confidence_display_label: 'C_EXPLORATORY_HINT (3)',
      confidence_source: 'fec_claim_ceiling_distribution',
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
      pair_id: '10ZT:sequence_000001',
      profile_id: 'data-eterna/data-eterna/OK7ALIB_2A3_0000.rdat#5914',
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

test('router keeps sequence as a valid ANNOJOIN Atlas entry route', () => {
  assert.equal(normalizeRoute('sequence'), 'sequence');
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

test('atlas search state preserves the canonical moleculeDisplayName for grouping and dedupe', () => {
  // Mirrors the real index: build derives a canonical `moleculeDisplayName` per row
  // (annojoin-atlas-corpus.mjs). The browser data layer must carry it through so the
  // table model's parentGroupLabel/childGroupLabel/moleculeName fallback chain can
  // (a) fold a class-label-less PDB (4V85) under its molecule name group, and
  // (b) suppress the molecule cell ("—") for rows whose name equals the group label.
  const state = buildAtlasSearchState({
    displayCases: [
      {
        atlasCaseKey: 'RMDB2PDB:1G1X', caseId: '1G1X', pdbId: '1G1X',
        chainPlacements: [{ classLabel: 'rRNA', nameLabel: '16S ribosomal RNA' }],
        parentClassLabel: '16S ribosomal RNA', childClassLabel: '16S ribosomal RNA',
        moleculeDisplayName: '16S ribosomal RNA', biologicalMoleculeName: '16S rRNA',
        confidenceDisplayLabel: 'A_REFERENCE (1)', profileCount: 1, chains: ['A']
      },
      {
        // 4V85-like: blank class labels, canonical name only in moleculeDisplayName
        atlasCaseKey: 'RASP2PDB:4V85', caseId: '4V85', pdbId: '4V85',
        chainPlacements: [{ classLabel: 'rRNA', nameLabel: '16S ribosomal RNA' }],
        parentClassLabel: '', childClassLabel: '',
        moleculeDisplayName: '16S ribosomal RNA', biologicalMoleculeName: '16S rRNA',
        confidenceDisplayLabel: 'B WEAK', profileCount: 1, chains: ['B']
      }
    ],
    totalSourceCaseCount: 2,
    totalCaseCount: 2,
    facets: []
  }, {});

  const folded = state.cases.find((row) => row.caseId === '4V85');
  assert.equal(folded.moleculeDisplayName, '16S ribosomal RNA');

  const html = renderAnnojointAtlasPage({
    state,
    expandedGroupIds: new Set(['parent:rRNA'])
  });
  // Problem 2: 4V85 folds into the "16S ribosomal RNA" parent group.
  assert.match(html, /data-annojoin-case-row="RASP2PDB:4V85"/);
  // Problem 1: both rows render "—" (molecule name equals the group label).
  assert.equal((html.match(/annojoin-molecule-same-as-group/g) || []).length, 2);
});

test('normalizeCase passes through chainPlacements', () => {
  const state = buildAtlasSearchState({
    displayCases: [{
      pdb_id: '4V99',
      chainPlacements: [
        { classLabel: 'rRNA', nameLabel: '16S ribosomal RNA' },
        { classLabel: 'tRNA', nameLabel: 'tRNA-Lys' }
      ]
    }]
  });
  const c = state.cases.find((row) => row.pdbId === '4V99');
  assert.deepEqual(c.chainPlacements, [
    { classLabel: 'rRNA', nameLabel: '16S ribosomal RNA' },
    { classLabel: 'tRNA', nameLabel: 'tRNA-Lys' }
  ]);
});

test('atlas search state prefers PDB-level display cases while preserving source case counts', () => {
  const state = buildAtlasSearchState({
    cases: [
      { atlasCaseKey: 'RMDB2PDB:10FZ', caseId: '10FZ', pdbId: '10FZ', assetFamily: 'RMDB2PDB', profileCount: 2 },
      { atlasCaseKey: 'RASP2PDB:10FZ', caseId: '10FZ', pdbId: '10FZ', assetFamily: 'RASP2PDB', profileCount: 3 }
    ],
    displayCases: [
      {
        atlasCaseKey: 'PDB:10FZ',
        caseId: '10FZ',
        pdbId: '10FZ',
        biologicalMoleculeName: 'Short author molecule',
        confidenceDisplayLabel: 'RMDB: B; RASP: not active',
        profileCount: 5,
        chains: ['A'],
        sourceCaseCount: 2,
        sourceCaseKeys: ['RMDB2PDB:10FZ', 'RASP2PDB:10FZ'],
        sourceFamilies: ['RMDB2PDB', 'RASP2PDB'],
        sourceCaseAssetPaths: [
          { assetFamily: 'RMDB2PDB', atlasCaseKey: 'RMDB2PDB:10FZ', caseId: '10FZ', caseAssetPath: 'cases/RMDB2PDB%3A10FZ.json', profileCount: 2 },
          { assetFamily: 'RASP2PDB', atlasCaseKey: 'RASP2PDB:10FZ', caseId: '10FZ', caseAssetPath: 'cases/RASP2PDB%3A10FZ.json', profileCount: 3 }
        ]
      }
    ],
    totalSourceCaseCount: 2,
    totalCaseCount: 1,
    facets: []
  }, {});

  assert.equal(state.cases.length, 1);
  assert.equal(state.cases[0].atlasCaseKey, 'PDB:10FZ');
  assert.equal(state.cases[0].sourceCaseCount, 2);
  assert.equal(state.totalCaseCount, 1);
  assert.equal(state.totalSourceCaseCount, 2);
});

test('atlas page renders merged PDB rows with source detail links in the side panel', () => {
  const originalOrigin = LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl;
  LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl = 'https://pages.example.test';
  const state = buildAtlasSearchState({
    cases: [
      { atlasCaseKey: 'RMDB2PDB:10FZ', caseId: '10FZ', pdbId: '10FZ', assetFamily: 'RMDB2PDB', profileCount: 2 },
      { atlasCaseKey: 'RASP2PDB:10FZ', caseId: '10FZ', pdbId: '10FZ', assetFamily: 'RASP2PDB', profileCount: 3 }
    ],
    displayCases: [
      {
        atlasCaseKey: 'PDB:10FZ',
        caseId: '10FZ',
        pdbId: '10FZ',
        biologicalMoleculeName: 'Short author molecule',
        confidenceDisplayLabel: 'RMDB: B; RASP: not active',
        profileCount: 5,
        chains: ['A'],
        sourceCaseCount: 2,
        sourceCaseKeys: ['RMDB2PDB:10FZ', 'RASP2PDB:10FZ'],
        sourceFamilies: ['RMDB2PDB', 'RASP2PDB'],
        sourceCaseAssetPaths: [
          { assetFamily: 'RMDB2PDB', atlasCaseKey: 'RMDB2PDB:10FZ', caseId: '10FZ', caseAssetPath: 'cases/RMDB2PDB%3A10FZ.json', profileCount: 2 },
          { assetFamily: 'RASP2PDB', atlasCaseKey: 'RASP2PDB:10FZ', caseId: '10FZ', caseAssetPath: 'cases/RASP2PDB%3A10FZ.json', profileCount: 3 }
        ]
      }
    ],
    totalSourceCaseCount: 2,
    totalCaseCount: 1,
    facets: []
  }, {});
  const html = renderAnnojointAtlasPage({
    state,
    routeName: 'sequence',
    selectedCaseKey: 'PDB:10FZ',
    selectedField: 'moleculeName'
  });

  assert.match(html, /Rows 1-1 of 1/);
  assert.equal((html.match(/data-annojoin-case-row="PDB:10FZ"/g) || []).length, 1);
  assert.match(html, /1 PDBs \(2 source cases\)/);
  assert.match(html, /2 source cases/);
  assert.match(html, /Source cases/);
  assert.match(html, /href="public\/rmdb-v3\/cases\/RMDB2PDB%253A10FZ\/index\.html"/);
  assert.match(html, /href="public\/rasp-v3\/cases\/RASP2PDB%253A10FZ\/index\.html"/);
  assert.doesNotMatch(html, /href="#annojoin-case\?caseId=10FZ" class="download-outline-btn">Open detail page/);
  LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl = originalOrigin;
});

test('atlas page upgrades completed RMDB source-case links to V3 static detail pages', () => {
  const originalOrigin = LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl;
  LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl = 'https://pages.example.test';
  const state = buildAtlasSearchState({
    cases: [
      { atlasCaseKey: 'RMDB2PDB:10ZT', caseId: '10ZT', pdbId: '10ZT', assetFamily: 'RMDB2PDB', profileCount: 1 },
      { atlasCaseKey: 'RASP2PDB:10ZT', caseId: '10ZT', pdbId: '10ZT', assetFamily: 'RASP2PDB', profileCount: 3 }
    ],
    displayCases: [
      {
        atlasCaseKey: 'PDB:10ZT',
        caseId: '10ZT',
        pdbId: '10ZT',
        biologicalMoleculeName: 'RNA (519-MER)',
        confidenceDisplayLabel: 'RMDB: C_EXPLORATORY_HINT (1); RASP: not active',
        profileCount: 4,
        chains: ['A'],
        sourceCaseCount: 2,
        sourceCaseKeys: ['RMDB2PDB:10ZT', 'RASP2PDB:10ZT'],
        sourceFamilies: ['RMDB2PDB', 'RASP2PDB'],
        sourceCaseAssetPaths: [
          { assetFamily: 'RMDB2PDB', atlasCaseKey: 'RMDB2PDB:10ZT', caseId: '10ZT', caseAssetPath: 'cases/RMDB2PDB%3A10ZT.json', profileCount: 1 },
          { assetFamily: 'RASP2PDB', atlasCaseKey: 'RASP2PDB:10ZT', caseId: '10ZT', caseAssetPath: 'cases/RASP2PDB%3A10ZT.json', profileCount: 3 }
        ]
      }
    ],
    totalSourceCaseCount: 2,
    totalCaseCount: 1,
    facets: []
  }, {});
  const html = renderAnnojointAtlasPage({
    state,
    routeName: 'sequence',
    selectedCaseKey: 'PDB:10ZT',
    selectedField: 'moleculeName'
  });

  assert.match(html, /href="public\/rmdb-v3\/cases\/RMDB2PDB%253A10ZT\/index\.html"/);
  assert.match(html, /href="public\/rasp-v3\/cases\/RASP2PDB%253A10ZT\/index\.html"/);
  LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl = originalOrigin;
});

test('atlas page routes duplicate RASP family cases to its own static detail page (no selector)', () => {
  const state = buildAtlasSearchState({
    cases: [
      { atlasCaseKey: 'RMDB2PDB:8EWB', caseId: '8EWB', pdbId: '8EWB', assetFamily: 'RMDB2PDB', profileCount: 1 },
      { atlasCaseKey: 'RASP2PDB:8EWB', caseId: '8EWB', pdbId: '8EWB', assetFamily: 'RASP2PDB', profileCount: 3 }
    ],
    displayCases: [
      {
        atlasCaseKey: 'PDB:8EWB',
        caseId: '8EWB',
        pdbId: '8EWB',
        biologicalMoleculeName: 'Duplicate family bridge case',
        confidenceDisplayLabel: 'RMDB: not active; RASP: bridge candidate',
        profileCount: 4,
        chains: ['A'],
        sourceCaseCount: 2,
        sourceCaseKeys: ['RMDB2PDB:8EWB', 'RASP2PDB:8EWB'],
        sourceFamilies: ['RMDB2PDB', 'RASP2PDB'],
        sourceCaseAssetPaths: [
          { assetFamily: 'RMDB2PDB', atlasCaseKey: 'RMDB2PDB:8EWB', caseId: '8EWB', caseAssetPath: 'cases/RMDB2PDB%3A8EWB.json', profileCount: 1 },
          { assetFamily: 'RASP2PDB', atlasCaseKey: 'RASP2PDB:8EWB', caseId: '8EWB', caseAssetPath: 'cases/RASP2PDB%3A8EWB.json', profileCount: 3 }
        ]
      }
    ],
    totalSourceCaseCount: 2,
    totalCaseCount: 1,
    facets: []
  }, {});
  const html = renderAnnojointAtlasPage({
    state,
    routeName: 'sequence',
    selectedCaseKey: 'PDB:8EWB',
    selectedField: 'moleculeName'
  });

  // No selector page: each universe links straight to its own static detail tree.
  assert.match(html, /href="public\/rmdb-v3\/cases\/RMDB2PDB%253A8EWB\/index\.html"/);
  assert.match(html, /href="public\/rasp-v3\/cases\/RASP2PDB%253A8EWB\/index\.html"/);
  assert.doesNotMatch(html, /selector/);
});

test('confidence panel never surfaces the legacy ANNOCONFIDENCE coverage_topology pointer string', () => {
  const state = buildAtlasSearchState({
    cases: [
      {
        atlasCaseKey: 'RMDB2PDB:10ZT',
        caseId: '10ZT',
        pdbId: '10ZT',
        assetFamily: 'RMDB2PDB',
        confidenceDisplayLabel: 'B MODERATE',
        confidenceSource: 'build_time_case_confidence_sidecar',
        coverageShapeDistribution: 'see ANNOCONFIDENCE/coverage_topology_annotation.tsv',
        profileCount: 1,
        chains: ['A']
      }
    ],
    displayCases: [
      {
        atlasCaseKey: 'RMDB2PDB:10ZT',
        caseId: '10ZT',
        pdbId: '10ZT',
        assetFamily: 'RMDB2PDB',
        confidenceDisplayLabel: 'B MODERATE',
        confidenceSource: 'build_time_case_confidence_sidecar',
        coverageShapeDistribution: 'see ANNOCONFIDENCE/coverage_topology_annotation.tsv',
        profileCount: 1,
        chains: ['A'],
        sourceCaseCount: 1,
        sourceCaseKeys: ['RMDB2PDB:10ZT'],
        sourceFamilies: ['RMDB2PDB']
      }
    ],
    totalSourceCaseCount: 1,
    totalCaseCount: 1,
    facets: []
  }, {});
  const html = renderAnnojointAtlasPage({
    state,
    routeName: 'sequence',
    selectedCaseKey: 'RMDB2PDB:10ZT',
    selectedField: 'confidenceDisplayLabel'
  });

  // Line 1 (LSS recall tier) label is shown, legacy file pointer is suppressed.
  assert.match(html, /B MODERATE/);
  assert.doesNotMatch(html, /coverage_topology_annotation\.tsv/);
  assert.doesNotMatch(html, /see ANNOCONFIDENCE/);
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

test('atlas search state derives reproducible profile traces from route profile ids', () => {
  const state = buildAtlasSearchState(fixtures, {});
  const row = state.cases.find((entry) => entry.caseId === '10ZT');

  assert.deepEqual(row.profilePreview, []);
  assert.equal(row.profileTracePreview.length, 1);
  assert.deepEqual(row.profileTracePreview[0], {
    pairId: '10ZT:sequence_000001',
    profileId: 'data-eterna/data-eterna/OK7ALIB_2A3_0000.rdat#5914',
    traceType: 'rdat_line',
    rdatPath: 'data-eterna/OK7ALIB_2A3_0000.rdat',
    rdatFile: 'OK7ALIB_2A3_0000.rdat',
    rdatLine: 5914,
    routeId: 'annojoin:track:RMDB2PDB:pairseg_10ZT_sequence_000001'
  });
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

test('atlas page renders only the compact master table surface', () => {
  const state = buildAtlasSearchState(fixtures, {});
  const html = renderAnnojointAtlasPage({ state, selectedCaseIds: new Set(['10ZT']), pageSize: 1 });

  assert.match(html, /ANNOJOIN master table/);
  assert.match(html, /Export Selected \(1\)/);
  assert.match(html, /Export All Results/);
  assert.match(html, /Select Current Page/);
  assert.match(html, /Select All Results/);
  assert.match(html, /Clear Selection/);
  assert.match(html, /Page 1 \/ 2/);
  assert.match(html, /Rows 1-1 of 2/);
  assert.doesNotMatch(html, /annojoin-column-picker/);
  assert.match(html, /Expand All/);
  assert.match(html, /Collapse All/);
  assert.match(html, /class="annojoin-master-table"/);
  assert.doesNotMatch(html, /class="annojoin-parent-group-row"/);
  assert.doesNotMatch(html, /class="annojoin-child-group-row"/);
  assert.match(html, /type="checkbox" class="annojoin-case-select"/);
  assert.doesNotMatch(html, /data-annojoin-column-toggle=/);
  assert.doesNotMatch(html, /data-atlas-capability=/);
  assert.doesNotMatch(html, /Selected case/);
  assert.doesNotMatch(html, /1D reactivity profile/);
  assert.doesNotMatch(html, /2D paired\/unpaired view/);
  assert.doesNotMatch(html, /3D residue coloring/);
  assert.doesNotMatch(html, /bundle_preview_should_not_render/);
});

test('atlas page renders case-level display fields and profile/confidence semantics', () => {
  const state = buildAtlasSearchState(fixtures, {});
  const html = renderAnnojointAtlasPage({ state });

  assert.match(html, /Molecule name/);
  assert.doesNotMatch(html, /<th>Biological molecule<\/th>/);
  assert.doesNotMatch(html, /<th>PDB molecule<\/th>/);
  assert.doesNotMatch(html, /<th>Probe family<\/th>/);
  assert.match(html, /Confidence distribution/);
  assert.match(html, /16S ribosomal RNA/);
  assert.match(html, /B_CONTEXT_STRATIFIED \(1\); C_EXPLORATORY_HINT \(2\)/);
  assert.match(html, /3 profiles/);
  assert.match(html, /profile preview, not a representative profile/);
  assert.match(html, /MPNN-fixbb designed RNA molecule/);
  assert.doesNotMatch(html, /Best profile/i);
  assert.doesNotMatch(html, /Best confidence/i);
  assert.doesNotMatch(html, /<th>Parent class<\/th>/);
  assert.doesNotMatch(html, /<th>Child class<\/th>/);
  assert.doesNotMatch(html, /<th>Source<\/th>/);
});

test('atlas page expands singleton-child parent groups with one click', () => {
  const state = buildAtlasSearchState({
    ...fixtures,
    cases: [
      fixtures.cases[0],
      {
        ...fixtures.cases[0],
        case_id: '10ZW',
        case_uid: 'RMDB2PDB|10ZW',
        pdb_id: '10ZW',
        search_text: '10ZW 16S ribosomal RNA'
      }
    ]
  }, {});
  const html = renderAnnojointAtlasPage({
    state,
    expandedGroupIds: new Set(['parent:Ribosome'])
  });

  assert.match(html, /Molecule name/);
  assert.match(html, /<th>Confidence distribution<\/th>/);
  assert.match(html, /data-annojoin-group-state="expanded"/);
  assert.doesNotMatch(html, /annojoin-child-group-row/);
  assert.match(html, /class="annojoin-case-row is-in-expanded-group"/);
});

test('atlas page suppresses molecule name inside a group whose label already shows it', () => {
  const state = buildAtlasSearchState({
    ...fixtures,
    cases: [
      {
        ...fixtures.cases[0],
        case_id: '20AA',
        case_uid: 'RMDB2PDB|20AA',
        pdb_id: '20AA',
        chainPlacements: [{ classLabel: '5S ribosomal RNA', nameLabel: '5S ribosomal RNA' }],
        parent_class_label: '5S ribosomal RNA',
        child_class_label: '5S ribosomal RNA',
        biological_molecule_name: '5S ribosomal RNA',
        pdb_molecule_name: '5S ribosomal RNA',
        search_text: '20AA 5S ribosomal RNA'
      },
      {
        ...fixtures.cases[0],
        case_id: '20AB',
        case_uid: 'RMDB2PDB|20AB',
        pdb_id: '20AB',
        chainPlacements: [{ classLabel: '5S ribosomal RNA', nameLabel: '5S ribosomal RNA' }],
        parent_class_label: '5S ribosomal RNA',
        child_class_label: '5S ribosomal RNA',
        biological_molecule_name: '5S ribosomal RNA',
        pdb_molecule_name: '5S ribosomal RNA',
        search_text: '20AB 5S ribosomal RNA'
      }
    ]
  }, {});
  const html = renderAnnojointAtlasPage({
    state,
    expandedGroupIds: new Set(['parent:5S-ribosomal-RNA'])
  });

  assert.match(html, /class="annojoin-molecule-same-as-group"/);
  assert.doesNotMatch(html, /annojoin-field-link[^>]*>\s*<span[^>]*>5S ribosomal RNA<\/span>/);
});

test('atlas page keeps second-level child folding when a parent has multiple child classes', () => {
  const state = buildAtlasSearchState({
    ...fixtures,
    cases: [
      fixtures.cases[0],
      {
        ...fixtures.cases[0],
        case_id: '10ZW',
        case_uid: 'RMDB2PDB|10ZW',
        pdb_id: '10ZW',
        search_text: '10ZW 16S ribosomal RNA'
      },
      {
        ...fixtures.cases[0],
        case_id: '10ZV',
        case_uid: 'RMDB2PDB|10ZV',
        pdb_id: '10ZV',
        chainPlacements: [{ classLabel: 'Ribosome', nameLabel: '23S rRNA' }],
        child_class_label: '23S rRNA',
        biological_molecule_name: '23S ribosomal RNA',
        search_text: '10ZV 23S ribosomal RNA'
      },
      {
        ...fixtures.cases[0],
        case_id: '10ZX',
        case_uid: 'RMDB2PDB|10ZX',
        pdb_id: '10ZX',
        chainPlacements: [{ classLabel: 'Ribosome', nameLabel: '23S rRNA' }],
        child_class_label: '23S rRNA',
        biological_molecule_name: '23S ribosomal RNA',
        search_text: '10ZX 23S ribosomal RNA'
      }
    ]
  }, {});
  const parentOnlyHtml = renderAnnojointAtlasPage({
    state,
    expandedGroupIds: new Set(['parent:Ribosome'])
  });

  assert.match(parentOnlyHtml, /annojoin-child-group-row/);
  assert.doesNotMatch(parentOnlyHtml, /data-annojoin-case-row="10ZT"/);

  const childExpandedHtml = renderAnnojointAtlasPage({
    state,
    expandedGroupIds: new Set(['parent:Ribosome', 'child:Ribosome::16S-rRNA'])
  });
  assert.match(childExpandedHtml, /data-annojoin-case-row="10ZT"/);
  assert.doesNotMatch(childExpandedHtml, /data-annojoin-case-row="10ZV"/);
});

test('atlas page defaults foldable groups to collapsed and visually marks expanded groups', () => {
  const state = buildAtlasSearchState({
    ...fixtures,
    cases: [
      fixtures.cases[0],
      {
        ...fixtures.cases[0],
        case_id: '10ZW',
        case_uid: 'RMDB2PDB|10ZW',
        pdb_id: '10ZW',
        search_text: '10ZW 16S ribosomal RNA'
      }
    ]
  }, {});
  const collapsedHtml = renderAnnojointAtlasPage({ state });
  assert.match(collapsedHtml, /data-annojoin-group-state="collapsed"/);
  assert.doesNotMatch(collapsedHtml, /data-annojoin-case-row="10ZT"/);

  const expandedHtml = renderAnnojointAtlasPage({
    state,
    expandedGroupIds: new Set(['parent:Ribosome'])
  });
  assert.match(expandedHtml, /annojoin-parent-group-row is-expanded-group/);
  assert.doesNotMatch(expandedHtml, /annojoin-child-group-row/);
  assert.match(expandedHtml, /annojoin-case-row is-in-expanded-group/);
});

test('atlas page caps large expanded singleton-child parent groups inside the current table page', () => {
  const repeated = Array.from({ length: 30 }, (_, index) => ({
    ...fixtures.cases[0],
    case_id: `10${String(index).padStart(2, '0')}`,
    case_uid: `RMDB2PDB|10${String(index).padStart(2, '0')}`,
    pdb_id: `10${String(index).padStart(2, '0')}`,
    search_text: `10${String(index).padStart(2, '0')} 16S ribosomal RNA`
  }));
  const state = buildAtlasSearchState({ ...fixtures, cases: repeated }, {});
  const html = renderAnnojointAtlasPage({
    state,
    expandedGroupIds: new Set(['parent:Ribosome'])
  });

  assert.equal((html.match(/class="annojoin-case-row is-in-expanded-group"/g) || []).length, 25);
  assert.match(html, /data-annojoin-group-page-toggle="parent:Ribosome"/);
  assert.match(html, /Showing 25 of 30 cases in this group/);
});

test('atlas page does not render folding rows for singleton classes', () => {
  const state = buildAtlasSearchState(fixtures, {});
  const html = renderAnnojointAtlasPage({ state });

  assert.doesNotMatch(html, /annojoin-parent-group-row/);
  assert.doesNotMatch(html, /annojoin-child-group-row/);
  assert.match(html, /data-annojoin-case-row="10ZT"/);
  assert.match(html, /data-annojoin-case-row="10ZU"/);
});

test('atlas page renders an index-row detail sidebar without loading detail panes', () => {
  const state = buildAtlasSearchState(fixtures, {});
  const html = renderAnnojointAtlasPage({ state, selectedCaseId: '10ZT', routeName: 'sequence' });

  assert.match(html, /class="annojoin-detail-sidebar/);
  assert.match(html, /Click a table field/);
  assert.match(html, /Molecule, confidence, PDB, profiles, and chains each open a focused explanation here/);
  assert.doesNotMatch(html, /Index row detail/);
});

test('atlas side panel renders field-specific explanations', () => {
  const originalOrigin = LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl;
  LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl = 'https://pages.example.test';
  const state = buildAtlasSearchState(fixtures, {});
  const moleculeHtml = renderAnnojointAtlasPage({ state, selectedCaseId: '10ZT', selectedField: 'moleculeName', routeName: 'sequence' });
  assert.match(moleculeHtml, /Index row detail/);
  assert.match(moleculeHtml, /Molecule name/);
  assert.match(moleculeHtml, /href="public\/rmdb-v3\/cases\/RMDB2PDB%253A10ZT\/index\.html"/);

  const confidenceHtml = renderAnnojointAtlasPage({ state, selectedCaseId: '10ZT', selectedField: 'confidenceDisplayLabel' });
  assert.match(confidenceHtml, /Confidence classification/);
  assert.match(confidenceHtml, /B_CONTEXT_STRATIFIED \(1\); C_EXPLORATORY_HINT \(2\)/);
  assert.match(confidenceHtml, /Annotation coverage/);
  // confidence panel links out to the dedicated explainer page
  assert.match(confidenceHtml, /href="#annojoin-confidence"/);
  assert.match(confidenceHtml, /What do these confidence labels mean\?/);
  LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl = originalOrigin;

  const pdbHtml = renderAnnojointAtlasPage({ state, selectedCaseId: '10ZT', selectedField: 'pdbId' });
  assert.match(pdbHtml, /PDB metadata/);
  assert.match(pdbHtml, /href="https:\/\/www.rcsb.org\/structure\/10ZT"/);
  assert.match(pdbHtml, /Author-provided molecule name/);

  const profilesHtml = renderAnnojointAtlasPage({ state, selectedCaseId: '10ZT', selectedField: 'profileCount' });
  assert.match(profilesHtml, /Profile hits/);
  assert.match(profilesHtml, /RDAT trace/);
  assert.match(profilesHtml, /OK7ALIB_2A3_0000\.rdat/);
  assert.match(profilesHtml, /line 5914/);
  assert.match(profilesHtml, /class="annojoin-profile-trace-list"/);
  assert.match(profilesHtml, /5914/);
  assert.doesNotMatch(profilesHtml, /rmdbv3_exact_alpha/);
  assert.match(profilesHtml, /RASP hit details are not present in the current index asset/);

  const chainsHtml = renderAnnojointAtlasPage({ state, selectedCaseId: '10ZT', selectedField: 'chains' });
  assert.match(chainsHtml, /Chain definitions/);
  assert.match(chainsHtml, /class="annojoin-chain-scroll"/);
  assert.match(chainsHtml, /class="annojoin-chain-list"/);
  // chain identifiers are listed rather than hidden behind a "not present" message
  assert.doesNotMatch(chainsHtml, /Chain sequences are not present in the current index asset/);

  const conflictsHtml = renderAnnojointAtlasPage({ state, selectedCaseId: '10ZT', selectedField: 'conflictCandidateCount' });
  assert.match(conflictsHtml, /Conflict candidates/);
  assert.match(conflictsHtml, /2 conflict candidates/);
  assert.match(conflictsHtml, /review candidate/);
});

test('atlas table field links target the side panel', () => {
  const state = buildAtlasSearchState(fixtures, {});
  const html = renderAnnojointAtlasPage({ state, routeName: 'sequence' });

  assert.match(html, /href="#sequence\?caseId=10ZT&amp;field=moleculeName"/);
  assert.match(html, /href="#sequence\?caseId=10ZT&amp;field=confidenceDisplayLabel"/);
  assert.match(html, /href="#sequence\?caseId=10ZT&amp;field=profileCount"/);
  assert.match(html, /href="#sequence\?caseId=10ZT&amp;field=chains"/);
  assert.match(html, /href="#sequence\?caseId=10ZT&amp;field=pdbId"/);
  // Conflicts column was removed from the master table; no cell links to it.
  assert.doesNotMatch(html, /field=conflictCandidateCount"/);
});

test('atlas page can render as the sequence route entry', () => {
  const state = buildAtlasSearchState(fixtures, {});
  const html = renderAnnojointAtlasPage({ state, routeName: 'sequence' });

  assert.match(html, /href="#sequence"/);
  assert.match(html, /href="#sequence\?caseId=10ZT&amp;field=pdbId"/);
  assert.doesNotMatch(html, /href="#annojoin-atlas\?caseId=10ZT"/);
});

test('atlas field links preserve the active filter and page so clicking does not reset the table', () => {
  const state = buildAtlasSearchState(fixtures, { query: '10ZT' });
  const html = renderAnnojointAtlasPage({ state, routeName: 'entry', page: 1 });

  // a filtered field click must retain q=10ZT alongside the field/case selection
  assert.match(html, /href="#entry\?q=10ZT&amp;caseId=10ZT&amp;field=pdbId"/);
  assert.match(html, /href="#entry\?q=10ZT&amp;caseId=10ZT&amp;field=moleculeName"/);
  // and must NOT drop the query (the bug: #entry?caseId=10ZT&field=pdbId)
  assert.doesNotMatch(html, /href="#entry\?caseId=10ZT&amp;field=pdbId"/);
});

test('atlas field links carry a non-default page through the field click', () => {
  // query '10Z' matches both fixtures; pageSize 1 leaves one case on page 2
  const state = buildAtlasSearchState(fixtures, { query: '10Z' });
  const html = renderAnnojointAtlasPage({ state, routeName: 'entry', page: 2, pageSize: 1 });

  // the active query and page must both survive the field click (caseId varies by sort)
  assert.match(html, /href="#entry\?q=10Z&amp;page=2&amp;caseId=10Z[A-Z]&amp;field=pdbId"/);
});

test('atlas page omits visual/detail panes from the master table page', () => {
  const state = buildAtlasSearchState(fixtures, {});
  const detail = createAtlasCaseDetail(fixtures, '10ZT');
  const html = renderAnnojointAtlasPage({ state, detail });

  assert.doesNotMatch(html, /class="annojoin-reactivity-track"/);
  assert.doesNotMatch(html, /class="annojoin-pair-arc-svg"/);
  assert.doesNotMatch(html, /data-annojoin-structure-viewer/);
  assert.doesNotMatch(html, /Mapped residue preview rows/);
  assert.doesNotMatch(html, /A:2 T/);
});

test('atlas page exposes current-filter dynamic export link', () => {
  const state = buildAtlasSearchState(fixtures, { query: 'ribozyme', structureClass: 'ribozyme' });
  const html = renderAnnojointAtlasPage({ state });

  assert.match(html, /href="\/api\/annojoin\/export-current-filter\?q=ribozyme&amp;structureClass=ribozyme&amp;format=csv"/);
  assert.match(html, /Export All Results/);
});

test('atlas page ignores paginated detail route previews on the master table page', () => {
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
  assert.doesNotMatch(html, /cases\/10ZT\/track-routes\/page-0001\.json/);
  assert.doesNotMatch(html, /profile-a/);
  assert.doesNotMatch(html, /pdb_residue_coordinate_key/);
});

test('atlas page shows a loading status banner instead of placeholder rows while the index loads', () => {
  const html = renderAnnojointAtlasPage({ statusMessage: { tone: 'loading', text: 'Loading the master table…' } });

  assert.match(html, /annojoin-table-status/);
  assert.match(html, /data-status-tone="loading"/);
  assert.match(html, /Loading the master table…/);
  // the empty table body must not fabricate demo rows
  assert.doesNotMatch(html, /10ZT/);
  assert.doesNotMatch(html, /10ZU/);
});

test('atlas page shows an error status banner when the index fails to load', () => {
  const html = renderAnnojointAtlasPage({
    statusMessage: { tone: 'error', text: 'The master table could not be loaded. Refresh to try again.' }
  });

  assert.match(html, /annojoin-table-status/);
  assert.match(html, /data-status-tone="error"/);
  assert.match(html, /could not be loaded/);
  assert.doesNotMatch(html, /10ZT/);
});

test('a slimmed index still resolves merged and single detail-page links', () => {
  const index = buildAtlasIndexAsset({
    cases: [
      // single-source PDB
      { asset_family: 'RMDB2PDB', case_id: '10ZT', pdb_id: '10ZT', biological_molecule_name: 'm', profile_count: '1', profile_ids: 'p1', search_text: '10ZT' },
      // merged PDB (two source families, same pdb_id)
      { asset_family: 'RMDB2PDB', case_id: '10FZ', pdb_id: '10FZ', biological_molecule_name: 'm', profile_count: '2', profile_ids: 'a;b', search_text: '10FZ rmdb' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', pdb_id: '10FZ', biological_molecule_name: 'm', profile_count: '3', profile_ids: 'c', search_text: '10FZ rasp' }
    ],
    summaries: [
      { asset_family: 'RMDB2PDB', case_id: '10ZT', recommended_default_preset: 'balanced_segment_view' },
      { asset_family: 'RMDB2PDB', case_id: '10FZ', recommended_default_preset: 'rmdb-view' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', recommended_default_preset: 'rasp-view' }
    ],
    routes: [
      { asset_family: 'RMDB2PDB', case_id: '10ZT', detail_route_id: 'detail:10ZT' },
      { asset_family: 'RMDB2PDB', case_id: '10FZ', detail_route_id: 'detail:rmdb' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', detail_route_id: 'detail:rasp' }
    ]
  });
  const slim = slimAtlasIndexForWrite(index);
  // browser reads displayCases via buildAtlasSearchState(...).cases
  const state = buildAtlasSearchState(slim, {});
  // Single-source rows keep their original family-prefixed atlasCaseKey
  // (buildDisplayCases L398-407 spreads the row verbatim); ONLY merged rows
  // (≥2 sources, same pdb_id) are rekeyed to `PDB:<pdbId>` (L435).
  const single = state.cases.find((row) => row.atlasCaseKey === 'RMDB2PDB:10ZT');
  const merged = state.cases.find((row) => row.atlasCaseKey === 'PDB:10FZ');
  assert.ok(single, 'single-source PDB row resolvable');
  assert.ok(merged, 'merged PDB row resolvable');
  // single row keeps a direct caseAssetPath
  assert.equal(single.caseAssetPath, 'cases/RMDB2PDB%3A10ZT.json');
  // merged row keeps explicit sub-links for "Open detail page"
  assert.ok(Array.isArray(merged.sourceCaseAssetPaths) && merged.sourceCaseAssetPaths.length === 2);
  for (const entry of merged.sourceCaseAssetPaths) {
    assert.ok(entry.caseAssetPath && entry.caseAssetPath.length > 0);
  }
});

test('buildAtlasSearchState drops dead caseHierarchy and exposes totalPlacementCount', () => {
  const state = buildAtlasSearchState({
    displayCases: [{ pdb_id: '1ABC', chainPlacements: [{ classLabel: 'tRNA', nameLabel: 'tRNA-Phe' }] }],
    totalPlacementCount: 1
  });
  assert.equal('caseHierarchy' in state, false);
  assert.equal('sourceCaseHierarchy' in state, false);
  assert.equal(state.totalPlacementCount, 1);
});

test('real pipeline groups by chain placement; search disables grouping', () => {
  const state = buildAtlasSearchState({
    displayCases: [
      { pdb_id: '4V99', chainPlacements: [
        { classLabel: 'rRNA', nameLabel: '16S ribosomal RNA' },
        { classLabel: 'tRNA', nameLabel: 'tRNA-Lys' }
      ] },
      { pdb_id: '1EHZ', chainPlacements: [{ classLabel: 'tRNA', nameLabel: 'tRNA-Phe' }] }
    ]
  });
  const sorted = sortAnnojointCases(state.cases);
  const page = paginateAnnojointRows(sorted, { page: 1, pageSize: 50 });
  const groups = buildAnnojointTableGroups(page.rows);
  const parentLabels = groups.map((p) => p.label).sort();
  assert.deepEqual(parentLabels, ['rRNA', 'tRNA']);
  const tRNA = groups.find((p) => p.label === 'tRNA');
  const tRNApdbs = tRNA.children.flatMap((c) => c.rows.map((r) => r.pdbId)).sort();
  assert.ok(tRNApdbs.includes('4V99'));
  const filtered = searchAnnojointRows(sorted, '4V99');
  assert.equal(filtered.length, 1);
});

const MOCK_EVIDENCE = {
  schemaVersion: 'annojoin-confidence.v1',
  atlasCaseKey: 'RASP2PDB:5EEW',
  status: 'materialized',
  rows: [
    {
      evidenceId: 'annojoin:RASP2PDB:5EEW:confidence:rasp_bw_internal',
      family: 'B',
      technology: 'tNet-MaPseq',
      chain: 'W',
      profileKey: 'rasp_bw_internal',
      membershipProfileId: 'rasp_bw_internal',
      pairId: 'PAIR-INTERNAL',
      pairSegmentId: 'SEG-INTERNAL',
      trackRouteId: 'annojoin:internal:track',
      bridgeStatus: 'bridge_missing',
      bridgeSelectionReason: 'unique_membership_profile_match',
      lssTierCalibrated: 'LSS_STRONG',
      lssTierUncalibrated: 'LSS_INTERNAL_UNCALIBRATED',
      aucDirectional: 0.78,
      aucEmpiricalPValue: 0.001,
      aucEffectSizeZ: 7.56,
      directionalMetricLabel: 'Contact pair AUC',
      nEvaluable: 75,
      calibrationNote: 'internal_calibration_note',
      rankedSetEligible: true,
      selectedByDefault: true
    }
  ]
};

test('renderLssEvidenceContent renders only external-friendly fields', () => {
  const html = renderLssEvidenceContent(MOCK_EVIDENCE);
  // external-friendly values present
  assert.match(html, /tNet-MaPseq/);
  assert.match(html, /LSS_STRONG/);
  assert.match(html, /Contact pair AUC/);
  assert.match(html, /0\.78/);
  assert.match(html, /0\.001/);
  assert.match(html, /7\.56/);
  assert.match(html, /Evaluable units/);
  assert.match(html, /75/);
  // internal-facing fields must never appear
  assert.doesNotMatch(html, /rasp_bw_internal/);
  assert.doesNotMatch(html, /PAIR-INTERNAL/);
  assert.doesNotMatch(html, /SEG-INTERNAL/);
  assert.doesNotMatch(html, /bridge_missing/);
  assert.doesNotMatch(html, /unique_membership_profile_match/);
  assert.doesNotMatch(html, /internal_calibration_note/);
  assert.doesNotMatch(html, /LSS_INTERNAL_UNCALIBRATED/);
  assert.doesNotMatch(html, /annojoin:internal:track/);
  assert.doesNotMatch(html, /evidenceId/);
});

test('renderLssEvidenceContent degrades gracefully for empty or unmaterialized evidence', () => {
  assert.match(renderLssEvidenceContent({ status: 'materialized', rows: [] }), /No per-profile LSS evidence/);
  assert.match(renderLssEvidenceContent({ status: 'not_materialized', rows: [] }), /No per-profile LSS evidence/);
  assert.match(renderLssEvidenceContent(null), /No per-profile LSS evidence/);
});

test('confidence panel emits an LSS evidence slot only when hasLssAnnotation is true', () => {
  const makeState = (hasLss) => buildAtlasSearchState({
    cases: [{ atlasCaseKey: 'RASP2PDB:5EEW', caseId: '5EEW', pdbId: '5EEW', assetFamily: 'RASP2PDB', confidenceDisplayLabel: 'B', profileCount: 1, chains: ['W'], hasLssAnnotation: hasLss }],
    displayCases: [{ atlasCaseKey: 'RASP2PDB:5EEW', caseId: '5EEW', pdbId: '5EEW', assetFamily: 'RASP2PDB', confidenceDisplayLabel: 'B', profileCount: 1, chains: ['W'], hasLssAnnotation: hasLss, sourceCaseCount: 1, sourceCaseKeys: ['RASP2PDB:5EEW'], sourceFamilies: ['RASP2PDB'] }],
    totalSourceCaseCount: 1, totalCaseCount: 1, facets: []
  }, {});
  const withLss = renderAnnojointAtlasPage({ state: makeState(true), routeName: 'sequence', selectedCaseKey: 'RASP2PDB:5EEW', selectedField: 'confidenceDisplayLabel' });
  assert.match(withLss, /data-lss-evidence-slot="RASP2PDB:5EEW"/);
  const withoutLss = renderAnnojointAtlasPage({ state: makeState(false), routeName: 'sequence', selectedCaseKey: 'RASP2PDB:5EEW', selectedField: 'confidenceDisplayLabel' });
  assert.doesNotMatch(withoutLss, /data-lss-evidence-slot/);
});

function makeFakeRoot(caseKey) {
  const slot = { _key: caseKey, innerHTML: '', getAttribute: () => caseKey };
  return {
    innerHTML: '',
    querySelectorAll: (sel) => (sel === '[data-lss-evidence-slot]' ? [slot] : []),
    _slot: slot
  };
}

test('hydrateLssEvidence fills the slot with filtered evidence', async () => {
  const root = makeFakeRoot('RASP2PDB:5EEW');
  const store = { loadAssetPath: async () => MOCK_EVIDENCE };
  await hydrateLssEvidence({ store, root, caseKey: 'RASP2PDB:5EEW', getCurrentCaseKey: () => 'RASP2PDB:5EEW' });
  assert.match(root._slot.innerHTML, /tNet-MaPseq/);
  assert.doesNotMatch(root._slot.innerHTML, /rasp_bw_internal/);
});

test('hydrateLssEvidence falls back without throwing when fetch fails', async () => {
  const root = makeFakeRoot('RASP2PDB:5EEW');
  const store = { loadAssetPath: async () => { throw new Error('404'); } };
  await hydrateLssEvidence({ store, root, caseKey: 'RASP2PDB:5EEW', getCurrentCaseKey: () => 'RASP2PDB:5EEW' });
  assert.match(root._slot.innerHTML, /No per-profile LSS evidence/);
});

test('hydrateLssEvidence discards stale responses when the sidebar moved on', async () => {
  const root = makeFakeRoot('RASP2PDB:5EEW');
  const store = { loadAssetPath: async () => MOCK_EVIDENCE };
  await hydrateLssEvidence({ store, root, caseKey: 'RASP2PDB:5EEW', getCurrentCaseKey: () => 'RASP2PDB:OTHER' });
  assert.equal(root._slot.innerHTML, '');
});
