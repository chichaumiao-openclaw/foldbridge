import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAtlasCaseAsset,
  buildAtlasIndexAsset,
  buildPagedRouteAssets,
  groupByCaseId,
  parseTsv,
  shouldWritePerCaseAssets,
  slimAtlasIndexForWrite
} from '../scripts/lib/annojoin-atlas-corpus.mjs';
import { buildAnnojointTableGroups } from '../src/annojoinAtlasTableModel.js';

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

test('buildAtlasIndexAsset gives same-PDB RMDB and RASP rows distinct atlas case assets', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      {
        asset_family: 'RMDB2PDB',
        case_id: '10FZ',
        case_uid: 'rmdb_line_a:10FZ',
        pdb_id: '10FZ',
        parent_class_label: 'RMDB parent',
        child_class_label: 'RMDB child',
        biological_molecule_name: 'RMDB molecule',
        pdb_molecule_name: 'RMDB PDB molecule',
        confidence_display_label: 'RMDB confidence',
        profile_count: '2'
      },
      {
        asset_family: 'RASP2PDB',
        case_id: '10FZ',
        case_uid: 'rasp_public:10FZ',
        pdb_id: '10FZ',
        parent_class_label: 'RASP public current',
        child_class_label: 'raw-hit case',
        biological_molecule_name: 'RASP molecule',
        pdb_molecule_name: 'RASP PDB molecule',
        confidence_display_label: 'RASP public current; positive confidence not active',
        profile_count: '3'
      }
    ],
    summaries: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', recommended_default_preset: 'rmdb-view' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', recommended_default_preset: 'rasp-view' }
    ],
    routes: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', detail_route_id: 'detail:rmdb' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', detail_route_id: 'detail:rasp' }
    ]
  });

  assert.deepEqual(asset.cases.map((row) => row.atlasCaseKey), ['RMDB2PDB:10FZ', 'RASP2PDB:10FZ']);
  assert.deepEqual(asset.cases.map((row) => row.caseAssetPath), [
    'cases/RMDB2PDB%3A10FZ.json',
    'cases/RASP2PDB%3A10FZ.json'
  ]);
  assert.deepEqual(asset.cases.map((row) => row.recommendedDefaultPreset), ['rmdb-view', 'rasp-view']);
  assert.deepEqual(asset.cases.map((row) => row.detailRouteId), ['detail:rmdb', 'detail:rasp']);
  assert.deepEqual(asset.displayCases.map((row) => row.atlasCaseKey), ['PDB:10FZ']);
});

test('buildAtlasIndexAsset merges same-PDB source rows into display cases for the master table', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      {
        asset_family: 'RMDB2PDB',
        case_id: '10FZ',
        case_uid: 'rmdb_line_a:10FZ',
        pdb_id: '10FZ',
        pdb_chain_ids: 'A;B',
        parent_class_label: 'RMDB parent',
        child_class_label: 'RMDB child',
        biological_molecule_name: 'Short author molecule',
        biological_molecule_name_source: 'pdb_author_entity_description_author_provided_display_name',
        pdb_molecule_name: 'Short author molecule',
        confidence_display_label: 'B_CONTEXT_STRATIFIED (2); C_EXPLORATORY_HINT (1)',
        confidence_source: 'fec_claim_ceiling_distribution',
        source_databases: 'RMDB;PDB',
        assay_family_set: 'rmdb_chemical_probing',
        profile_count: '2',
        conflict_candidate_count: '1',
        search_text: '10FZ Short author molecule'
      },
      {
        asset_family: 'RASP2PDB',
        case_id: '10FZ',
        case_uid: 'rasp_public:10FZ',
        pdb_id: '10FZ',
        pdb_chain_ids: 'B;C',
        parent_class_label: 'RASP public current',
        child_class_label: 'raw-hit case',
        biological_molecule_name: 'RASP molecule name that should stay source detail only',
        pdb_molecule_name: 'RASP molecule name that should stay source detail only',
        confidence_display_label: 'RASP public current; positive confidence not active',
        confidence_source: 'rasp_public_current_gate',
        source_databases: 'RASP;PDB',
        assay_family_set: 'rasp_public_signal',
        profile_count: '3',
        conflict_candidate_count: '2',
        search_text: '10FZ RASP public hit'
      }
    ],
    summaries: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', recommended_default_preset: 'rmdb-view' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', recommended_default_preset: 'rasp-view' }
    ],
    routes: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', detail_route_id: 'detail:rmdb' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', detail_route_id: 'detail:rasp' }
    ]
  });

  assert.equal(asset.cases.length, 2);
  assert.equal(asset.displayCases.length, 1);
  assert.equal(asset.totalSourceCaseCount, 2);
  assert.equal(asset.totalCaseCount, 1);
  const row = asset.displayCases[0];
  assert.equal(row.atlasCaseKey, 'PDB:10FZ');
  assert.equal(row.caseId, '10FZ');
  assert.equal(row.pdbId, '10FZ');
  assert.equal(row.biologicalMoleculeName, 'Short author molecule');
  assert.equal(row.profileCount, 5);
  assert.equal(row.conflictCandidateCount, 3);
  assert.deepEqual(row.chains, ['A', 'B', 'C']);
  assert.deepEqual(row.sourceFamilies, ['RMDB2PDB', 'RASP2PDB']);
  assert.deepEqual(row.sourceCaseKeys, ['RMDB2PDB:10FZ', 'RASP2PDB:10FZ']);
  assert.equal(row.confidenceDisplayLabel, 'RMDB: B/C; RASP: not active');
  assert.deepEqual(row.sourceCaseAssetPaths.map((entry) => [entry.assetFamily, entry.caseAssetPath, entry.detailRouteId]), [
    ['RMDB2PDB', 'cases/RMDB2PDB%3A10FZ.json', 'detail:rmdb'],
    ['RASP2PDB', 'cases/RASP2PDB%3A10FZ.json', 'detail:rasp']
  ]);
});

test('buildAtlasIndexAsset keeps ANNOJOIN tables as browser entry and omits large annotation payloads', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      {
        case_id: '10ZT',
        case_uid: 'RMDB2PDB|10ZT',
        pdb_id: '10ZT',
        parent_class_label: 'Ribosome',
        parent_class_source: 'PDB/biological_layer/parent_child_pdb_map.tsv',
        child_class_label: '16S rRNA',
        child_class_source: 'PDB/biological_layer/parent_child_pdb_map.tsv',
        biological_molecule_name: '16S rRNA',
        biological_molecule_name_source: 'PDB/biological_layer/pdb_child_identity_index.tsv',
        pdb_molecule_name: 'Escherichia coli 70S ribosome',
        pdb_molecule_name_source: 'pdb_struct_title',
        confidence_display_label: 'B_CONTEXT_STRATIFIED (1)',
        confidence_source: 'fec_claim_ceiling_distribution',
        profile_count: '1',
        profile_ids: 'profile-a',
        profile_ids_complete: 'true',
        search_text: '10ZT ribozyme',
        route_id: 'annojoin:case:10ZT'
      }
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
  assert.equal(asset.cases[0].biologicalMoleculeName, '16S rRNA');
  assert.equal(asset.cases[0].confidenceDisplayLabel, 'B_CONTEXT_STRATIFIED (1)');
  assert.equal(asset.presets.length, 1);
  assert.deepEqual(Object.keys(asset).sort(), ['cases', 'displayCases', 'downloads', 'facets', 'generatedAt', 'presets', 'schemaVersion', 'source', 'totalCaseCount', 'totalPlacementCount', 'totalSourceCaseCount', 'version'].sort());
});

test('buildAtlasIndexAsset folds molecule-name case variants into a corpus-majority moleculeDisplayName', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      { case_id: 'AAA1', pdb_id: 'AAA1', biological_molecule_name: '16S ribosomal RNA' },
      { case_id: 'AAA2', pdb_id: 'AAA2', biological_molecule_name: '16S ribosomal RNA' },
      { case_id: 'AAA3', pdb_id: 'AAA3', biological_molecule_name: '16S ribosomal RNA' },
      { case_id: 'AAA4', pdb_id: 'AAA4', biological_molecule_name: '16S RIBOSOMAL RNA' }
    ]
  });

  // every source + display case displays the majority spelling
  for (const row of asset.cases) {
    assert.equal(row.moleculeDisplayName, '16S ribosomal RNA');
  }
  for (const row of asset.displayCases) {
    assert.equal(row.moleculeDisplayName, '16S ribosomal RNA');
  }
  // raw provenance is untouched: the minority-spelling row keeps its own raw value
  const minority = asset.cases.find((row) => row.caseId === 'AAA4');
  assert.equal(minority.biologicalMoleculeName, '16S RIBOSOMAL RNA');
  // counts unaffected by display folding (grouping is by pdbId)
  assert.equal(asset.cases.length, 4);
  assert.equal(asset.displayCases.length, 4);
  assert.equal(asset.totalSourceCaseCount, 4);
  assert.equal(asset.totalCaseCount, 4);
});

test('buildAtlasIndexAsset breaks moleculeDisplayName ties deterministically and force-expands the RNA term', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      { case_id: 'TIE1', pdb_id: 'TIE1', biological_molecule_name: 'tRNA(Phe)' },
      { case_id: 'TIE2', pdb_id: 'TIE2', biological_molecule_name: 'tRNA(PHE)' }
    ]
  });
  const winners = new Set(asset.cases.map((row) => row.moleculeDisplayName));
  assert.equal(winners.size, 1);
  const winner = [...winners][0];
  // both fold to "transfer rna(phe)"; representative is the code-point-smallest input
  // ('tRNA(PHE)' since 'H'(0x48) < 'h'(0x68)), then the abbreviation is force-expanded.
  // The (PHE) qualifier is preserved verbatim from the representative spelling.
  assert.equal(winner, 'transfer RNA(PHE)');
});

test('buildAtlasIndexAsset leaves moleculeDisplayName empty when no source name exists', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      { case_id: 'EMPT', pdb_id: 'EMPT', biological_molecule_name: '', pdb_molecule_name: '' }
    ]
  });
  assert.equal(asset.cases[0].moleculeDisplayName, '');
});

test('buildAtlasIndexAsset folds RASP composite pipe-delimited molecule names by their leading segment', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      // clean canonical spelling (majority spelling source)
      { case_id: 'C1', pdb_id: 'C1', biological_molecule_name: '16S ribosomal RNA' },
      { case_id: 'C2', pdb_id: 'C2', biological_molecule_name: '16S ribosomal RNA' },
      // RASP composite "molecule | structure_title | organism" variants
      { case_id: '8T5D', pdb_id: '8T5D', asset_family: 'RASP2PDB', biological_molecule_name: '16s RNA | Cryo-EM studies of the interplay between uS2 ribosomal protein | Escherichia coli' },
      { case_id: '8P17', pdb_id: '8P17', asset_family: 'RASP2PDB', biological_molecule_name: '16S RNA | E167K RF2 on E. coli 70S release complex with UGG (Structure II) | Escherichia coli' },
      { case_id: '8EYQ', pdb_id: '8EYQ', asset_family: 'RASP2PDB', biological_molecule_name: '16S_rRNA | 30S_delta_ksgA_h44_inactive_conformation | Escherichia coli' },
      { case_id: '4V85', pdb_id: '4V85', asset_family: 'RASP2PDB', biological_molecule_name: '16S rRNA' }
    ]
  });
  const display = new Map(asset.cases.map((row) => [row.caseId, row.moleculeDisplayName]));
  // every variant resolves to the corpus-majority clean spelling
  for (const id of ['8T5D', '8P17', '8EYQ', '4V85']) {
    assert.equal(display.get(id), '16S ribosomal RNA');
  }
  // raw provenance untouched: composite string preserved verbatim
  const raw = asset.cases.find((row) => row.caseId === '8T5D');
  assert.equal(raw.biologicalMoleculeName, '16s RNA | Cryo-EM studies of the interplay between uS2 ribosomal protein | Escherichia coli');
  // all six PDBs collapse into a single "16S ribosomal RNA" master-table parent group
  const groups = buildAnnojointTableGroups(asset.displayCases);
  const ribo = groups.find((group) => group.label === '16S ribosomal RNA');
  assert.ok(ribo, 'expected a single "16S ribosomal RNA" parent group');
  assert.equal(ribo.count, 6);
  assert.equal(groups.length, 1);
});

test('buildAtlasIndexAsset folds punctuation and spacing variants of a molecule name into one group', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      { case_id: 'G1', pdb_id: 'G1', biological_molecule_name: 'single guide RNA' },
      { case_id: 'G2', pdb_id: 'G2', biological_molecule_name: 'single guide RNA' },
      { case_id: 'G3', pdb_id: 'G3', biological_molecule_name: 'single-guide RNA' },
      { case_id: 'H1', pdb_id: 'H1', biological_molecule_name: 'HCV IRES' },
      { case_id: 'H2', pdb_id: 'H2', biological_molecule_name: 'HCV-IRES' }
    ]
  });
  const display = new Map(asset.cases.map((row) => [row.caseId, row.moleculeDisplayName]));
  // punctuation/spacing variants resolve to the corpus-majority spelling
  assert.equal(display.get('G3'), 'single guide RNA');
  assert.equal(display.get('H2'), display.get('H1'));
  const groups = buildAnnojointTableGroups(asset.displayCases);
  const sg = groups.find((group) => /single guide RNA/i.test(group.label));
  const hcv = groups.find((group) => /HCV/i.test(group.label));
  assert.equal(sg.count, 3);
  assert.equal(hcv.count, 2);
  assert.equal(groups.length, 2);
});

test('buildAtlasIndexAsset keeps the decimal Svedberg coefficient intact when folding 5.8S rRNA', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      { case_id: 'D1', pdb_id: 'D1', biological_molecule_name: '5.8S RNA' },
      { case_id: 'D2', pdb_id: 'D2', biological_molecule_name: '5.8S rRNA' },
      { case_id: 'D3', pdb_id: 'D3', biological_molecule_name: '5.8S ribosomal RNA' }
    ]
  });
  const display = new Map(asset.cases.map((row) => [row.caseId, row.moleculeDisplayName]));
  for (const id of ['D1', 'D2', 'D3']) {
    assert.match(display.get(id), /5\.8S ribosomal RNA/);
  }
  const groups = buildAnnojointTableGroups(asset.displayCases);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 3);
});

test('buildAtlasIndexAsset never expands Svedberg SRP RNA or ribosomal subunit names into rRNA', () => {
  const asset = buildAtlasIndexAsset({
    cases: [
      { case_id: 'SRP1', pdb_id: 'SRP1', biological_molecule_name: '4.5S RNA | SRP context | Escherichia coli' },
      { case_id: 'SRP2', pdb_id: 'SRP2', biological_molecule_name: '7S RNA' },
      { case_id: 'SUB1', pdb_id: 'SUB1', biological_molecule_name: '30S | ribosome subunit | Escherichia coli' }
    ]
  });
  const display = new Map(asset.cases.map((row) => [row.caseId, row.moleculeDisplayName]));
  // SRP RNAs and bare subunit labels are NOT rewritten to "... ribosomal RNA"
  assert.equal(/ribosomal RNA/i.test(display.get('SRP1')), false);
  assert.equal(/ribosomal RNA/i.test(display.get('SRP2')), false);
  assert.equal(/ribosomal RNA/i.test(display.get('SUB1')), false);
});

test('buildAtlasCaseAsset selects same-PDB detail rows by atlasCaseKey', () => {
  const asset = buildAtlasCaseAsset({
    caseKey: 'RASP2PDB:10FZ',
    cases: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', pdb_id: '10FZ', profile_count: '2', profile_ids: 'rmdb-profile' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', pdb_id: '10FZ', profile_count: '3', profile_ids: 'rasp-profile' }
    ],
    summaries: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', profile_count: '2', summary_route_id: 'summary:rmdb' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', profile_count: '3', summary_route_id: 'summary:rasp' }
    ],
    routes: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', mapping_table_route_id: 'mapping:rmdb' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', mapping_table_route_id: 'mapping:rasp' }
    ],
    memberships: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', pair_id: 'rmdb-pair', profile_id: 'rmdb-profile' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', pair_id: 'rasp-pair', profile_id: 'rasp-profile' }
    ],
    tracks: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', track_route_id: 'track:rmdb' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', track_route_id: 'track:rasp' }
    ]
  });

  assert.equal(asset.case.assetFamily, 'RASP2PDB');
  assert.equal(asset.case.atlasCaseKey, 'RASP2PDB:10FZ');
  assert.equal(asset.summary.summaryRouteId, 'summary:rasp');
  assert.equal(asset.detailRoutes.mappingTableRouteId, 'mapping:rasp');
  assert.equal(asset.memberships.preview[0].profileId, 'rasp-profile');
  assert.equal(asset.trackRoutes.preview[0].trackRouteId, 'track:rasp');
  assert.equal(asset.routeAssets.memberships.path, 'cases/RASP2PDB%3A10FZ/memberships/page-0001.json');
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
  assert.deepEqual(asset.supplementalAssets, {
    confidenceSummaryPath: 'cases/10ZT/confidence-summary.json',
    confidenceEvidencePath: 'cases/10ZT/confidence-evidence.json',
    confidenceProvenancePath: 'cases/10ZT/confidence-provenance.json',
  });
  assert.equal(asset.routeAssets.memberships.path, 'cases/10ZT/memberships/page-0001.json');
  assert.equal(asset.routeAssets.trackRoutes.path, 'cases/10ZT/track-routes/page-0001.json');
  assert.equal(asset.routeAssets.visualPreview.path, 'cases/10ZT/visual-preview/page-0001.json');
  assert.equal(asset.visualPreview.reactivity1d.points[0].reactivityValue, 0.6295);
  assert.equal(asset.visualPreview.pairArcs[0].segmentLabel, '10ZT:2-69');
  assert.equal(asset.visualPreview.structureColoring.structureUrl, '/api/annojoin/structure?path=CONFIDENCE%2F10_structure_context%2Fx%2F10zt.cif');
  assert.equal(asset.visualPreview.structureColoring.points[1].colorBin, 'high');
  assert.equal(asset.annotationPayloadRowsCopied, 0);
});

test('buildAtlasCaseAsset preserves blocked RASP 2D and 3D route metadata', () => {
  const asset = buildAtlasCaseAsset({
    caseId: '2GDI',
    cases: [{ case_id: '2GDI', pdb_id: '2GDI', profile_count: '1', profile_ids: 'rasp-profile', profile_ids_complete: 'true' }],
    summaries: [{ case_id: '2GDI', profile_count: '1', pair_count: '0', recommended_default_preset: 'rasp_public_current' }],
    routes: [{ case_id: '2GDI', mapping_table_route_id: 'annojoin:mapping:2GDI' }],
    memberships: [{ case_id: '2GDI', pair_id: '2GDI:rasp', profile_id: 'rasp-profile' }],
    tracks: [{ case_id: '2GDI', track_route_id: 'annojoin:track:2GDI', track_data_path: 'rasp_public_residue_tracks/2GDI.tsv', supports_1d: 'true' }],
    pairs2d: [{
      case_id: '2GDI',
      context_route_id: 'annojoin:2d:2GDI',
      route_availability_status: 'blocked',
      blocker_code: 'RASP_PUBLIC_2D_CONTEXT_NOT_MATERIALIZED_BLOCKER'
    }],
    colors3d: [{
      case_id: '2GDI',
      route_availability_status: 'blocked',
      blocker_code: 'RASP_PUBLIC_3D_STRUCTURE_ROUTE_NOT_MATERIALIZED_BLOCKER'
    }],
    residueEvidence: [
      { case_id: '2GDI', profile_id: 'rasp-profile', label_asym_id: 'A', label_seq_id: '1', comp_id: 'G', reactivity_value: '0.4' }
    ]
  });

  assert.equal(asset.pairContextRoutes.preview[0].routeAvailabilityStatus, 'blocked');
  assert.equal(asset.pairContextRoutes.preview[0].blockerCode, 'RASP_PUBLIC_2D_CONTEXT_NOT_MATERIALIZED_BLOCKER');
  assert.equal(asset.structureRoutes.preview[0].routeAvailabilityStatus, 'blocked');
  assert.equal(asset.structureRoutes.preview[0].blockerCode, 'RASP_PUBLIC_3D_STRUCTURE_ROUTE_NOT_MATERIALIZED_BLOCKER');
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

test('slimAtlasIndexForWrite drops the browser-dead cases array', () => {
  const index = buildAtlasIndexAsset({
    cases: [
      { case_id: '10FZ', pdb_id: '10FZ', biological_molecule_name: '16S ribosomal RNA', profile_ids: 'p1', profile_count: '1' }
    ]
  });
  assert.ok(Array.isArray(index.cases), 'precondition: full index has cases');
  const slim = slimAtlasIndexForWrite(index);
  assert.equal('cases' in slim, false);
});

test('slimAtlasIndexForWrite strips profilePreview/profilePreviewIsComplete from every displayCases row', () => {
  const index = buildAtlasIndexAsset({
    cases: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', pdb_id: '10FZ', biological_molecule_name: 'm', profile_ids: 'p1;p2', profile_count: '2', profile_ids_complete: 'true' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', pdb_id: '10FZ', biological_molecule_name: 'm', profile_ids: 'p3', profile_count: '1', profile_ids_complete: 'true' }
    ]
  });
  const merged = index.displayCases.find((row) => row.isMergedDisplayRow);
  assert.ok(merged, 'precondition: a merged display row exists with a profilePreview');
  assert.ok('profilePreview' in merged);
  const slim = slimAtlasIndexForWrite(index);
  for (const row of slim.displayCases) {
    assert.equal('profilePreview' in row, false);
    assert.equal('profilePreviewIsComplete' in row, false);
  }
});

test('slimAtlasIndexForWrite preserves link-critical and rendered fields on a sample row', () => {
  const index = buildAtlasIndexAsset({
    cases: [
      {
        asset_family: 'RMDB2PDB', case_id: '10ZT', pdb_id: '10ZT',
        biological_molecule_name: '16S ribosomal RNA',
        biological_molecule_name_source: 'PDB/biological_layer/pdb_child_identity_index.tsv',
        pdb_molecule_name: '30S ribosomal subunit RNA',
        parent_class_label: 'Ribosome', child_class_label: '16S rRNA',
        profile_count: '1', profile_ids: 'p1', search_text: '10ZT ribosome'
      }
    ],
    summaries: [{ case_id: '10ZT', recommended_default_preset: 'balanced_segment_view' }],
    routes: [{ case_id: '10ZT', detail_route_id: '/atlas/rmdb2pdb/10ZT' }]
  });
  const slim = slimAtlasIndexForWrite(index);
  const row = slim.displayCases[0];
  for (const key of ['atlasCaseKey', 'caseId', 'pdbId', 'assetFamily', 'caseAssetPath',
    'sourceCaseAssetPaths', 'profileTracePreview', 'searchText', 'moleculeDisplayName',
    'biologicalMoleculeName', 'biologicalMoleculeNameSource']) {
    assert.ok(key in row, `expected ${key} preserved`);
  }
  assert.equal(row.caseAssetPath, 'cases/RMDB2PDB%3A10ZT.json');
  assert.equal(row.biologicalMoleculeName, '16S ribosomal RNA');
});

test('slimAtlasIndexForWrite keeps scalars and top-level structures', () => {
  const index = buildAtlasIndexAsset({
    cases: [{ case_id: '10ZT', pdb_id: '10ZT', biological_molecule_name: 'm', parent_class_label: 'Ribosome', child_class_label: '16S rRNA' }],
    facets: [{ facet_name: 'PDB ID', source_column: 'pdb_id', display_label: 'PDB ID' }],
    presets: [{ preset_id: 'p', preset_name: 'P' }],
    downloads: [{ download_id: 'd', download_label: 'D', file_path: 'x.tsv', row_count: '1' }]
  });
  const slim = slimAtlasIndexForWrite(index);
  assert.equal(slim.totalSourceCaseCount, index.totalSourceCaseCount);
  assert.equal(slim.totalCaseCount, index.totalCaseCount);
  assert.equal(slim.displayCases.length, index.displayCases.length);
  assert.deepEqual(slim.facets, index.facets);
  assert.deepEqual(slim.presets, index.presets);
  assert.deepEqual(slim.downloads, index.downloads);
  assert.equal(slim.schemaVersion, index.schemaVersion);
  assert.equal(slim.version, index.version);
  assert.equal(slim.generatedAt, index.generatedAt);
  assert.deepEqual(slim.source, index.source);
});

test('slimAtlasIndexForWrite does not mutate its input', () => {
  const index = buildAtlasIndexAsset({
    cases: [
      { asset_family: 'RMDB2PDB', case_id: '10FZ', pdb_id: '10FZ', biological_molecule_name: 'm', profile_ids: 'p1;p2', profile_count: '2', profile_ids_complete: 'true' },
      { asset_family: 'RASP2PDB', case_id: '10FZ', pdb_id: '10FZ', biological_molecule_name: 'm', profile_ids: 'p3', profile_count: '1', profile_ids_complete: 'true' }
    ]
  });
  const before = JSON.stringify(index);
  slimAtlasIndexForWrite(index);
  assert.equal(JSON.stringify(index), before, 'input index must be unchanged');
  assert.ok(Array.isArray(index.cases));
  assert.ok(index.displayCases.some((row) => 'profilePreview' in row));
});

test('slimAtlasIndexForWrite preserves chainPlacements while dropping profilePreview', () => {
  const slim = slimAtlasIndexForWrite({
    displayCases: [{ pdbId: '1ABC', chainPlacements: [{ classLabel: 'tRNA', nameLabel: 'tRNA-Phe' }], profilePreview: ['p1'], profilePreviewIsComplete: true }]
  });
  const dc = slim.displayCases[0];
  assert.deepEqual(dc.chainPlacements, [{ classLabel: 'tRNA', nameLabel: 'tRNA-Phe' }]);
  assert.equal('profilePreview' in dc, false);
});

test('shouldWritePerCaseAssets is false only when --index-only is present', () => {
  assert.equal(shouldWritePerCaseAssets([]), true);
  assert.equal(shouldWritePerCaseAssets(['--some-other-flag']), true);
  assert.equal(shouldWritePerCaseAssets(['--index-only']), false);
  assert.equal(shouldWritePerCaseAssets(['node', 'build.mjs', '--index-only']), false);
});

test('buildAtlasIndexAsset derives deduped sorted chainPlacements per displayCase', () => {
  const chainIdentityIndex = new Map([
    ['4V99', [
      { rnaClass: 'rRNA', displayName: '16S ribosomal RNA' },
      { rnaClass: 'rRNA', displayName: '16S ribosomal RNA' }, // dup -> collapse
      { rnaClass: 'tRNA', displayName: 'tRNA-Lys' }
    ]]
  ]);
  const index = buildAtlasIndexAsset({
    cases: [{ case_id: 'c1', pdb_id: '4V99', pdb_chain_ids: 'A;B' }],
    chainIdentityIndex
  });
  const dc = index.displayCases.find((row) => row.pdbId === '4V99');
  assert.deepEqual(dc.chainPlacements, [
    { classLabel: 'rRNA', nameLabel: '16S ribosomal RNA' },
    { classLabel: 'tRNA', nameLabel: 'tRNA-Lys' }
  ]); // localeCompare(class) asc, then name asc; deduped
  assert.equal(index.totalPlacementCount, 2);
  assert.equal(index.totalCaseCount, index.displayCases.length);
});

test('buildAtlasIndexAsset falls back to Unclassified RNA when chain index misses', () => {
  const index = buildAtlasIndexAsset({
    cases: [{ case_id: 'c2', pdb_id: '9XXX', pdb_chain_ids: 'A', biological_molecule_name: 'Some Ribozyme' }],
    chainIdentityIndex: new Map()
  });
  const dc = index.displayCases.find((row) => row.pdbId === '9XXX');
  assert.deepEqual(dc.chainPlacements, [{ classLabel: 'Unclassified RNA', nameLabel: 'Some Ribozyme' }]);
  assert.equal(index.totalPlacementCount, 1);
});

test('buildAtlasIndexAsset no longer emits caseHierarchy', () => {
  const index = buildAtlasIndexAsset({ cases: [{ case_id: 'c3', pdb_id: '1ABC' }], chainIdentityIndex: new Map() });
  assert.equal('caseHierarchy' in index, false);
});
