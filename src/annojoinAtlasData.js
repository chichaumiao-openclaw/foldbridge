export const REQUIRED_ATLAS_CAPABILITIES = [
  { id: 'searchable-web-interface', label: 'Searchable web interface' },
  { id: 'facet-search', label: 'RNA family / probe type / PDB ID / motif / structure class search' },
  { id: 'reactivity-1d', label: '1D reactivity profile' },
  { id: 'paired-unpaired-2d', label: '2D paired/unpaired view' },
  { id: 'residue-coloring-3d', label: '3D residue coloring' },
  { id: 'mapped-residue-table', label: 'Mapped residue table' },
  { id: 'confidence-view-builder', label: 'Confidence view builder' },
  { id: 'conflict-candidate-viewer', label: 'Conflict / discordance candidate viewer' },
  { id: 'download-current-filter', label: 'Download current-filter result' }
];

export const ANNOJOIN_SOURCE_CONTRACT = {
  entryRoot: 'ANNOJOIN',
  annotationRoot: 'ANNOCONFIDENCE',
  version: 'V2.1_RMDB_LINE_A_20260617',
  browserLoadsAnnoconfidenceBigTables: false,
  note: 'ANNOJOIN drives browser lists, filters, routes, presets, and downloads. ANNOCONFIDENCE stays server-side or route-lazy.'
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value ?? '').trim();
}

function truthy(value) {
  return ['true', '1', 'yes', 'y'].includes(text(value).toLowerCase());
}

function numberOrZero(value) {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value) {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
  return text(value).split(';').map((item) => item.trim()).filter(Boolean);
}

function previewProfiles(value) {
  return splitList(value).filter((profileId) => !profileId.startsWith('bundle_'));
}

function includesFolded(haystack, needle) {
  if (!needle) return true;
  return text(haystack).toLowerCase().includes(text(needle).toLowerCase());
}

function normalizeCase(row) {
  return {
    caseUid: text(row.case_uid || row.caseUid),
    caseId: text(row.case_id || row.caseId),
    pdbId: text(row.pdb_id || row.pdbId),
    chains: splitList(row.pdb_chain_ids || row.chains),
    sourceDatabases: splitList(row.source_databases || row.sourceDatabases),
    assayFamilies: splitList(row.assay_family_set || row.assayFamilies),
    rnaFamily: text(row.rna_family_label || row.rnaFamily),
    rnaFamilyProvenance: text(row.rna_family_provenance || row.rnaFamilyProvenance),
    motif: text(row.motif_label || row.motif),
    motifProvenance: text(row.motif_provenance || row.motifProvenance),
    structureClass: text(row.structure_class_label || row.structureClass),
    structureClassProvenance: text(row.structure_class_provenance || row.structureClassProvenance),
    profilePreview: Array.isArray(row.profilePreview) ? row.profilePreview : previewProfiles(row.profile_ids),
    profileCount: numberOrZero(row.profile_count ?? row.profileCount),
    profilePreviewIsComplete: row.profilePreviewIsComplete === true || truthy(row.profile_ids_complete),
    profileMembershipRouteId: text(row.profile_membership_route_id || row.profileMembershipRouteId),
    fecClaimCeilingDistribution: text(row.fec_claim_ceiling_distribution || row.fecClaimCeilingDistribution),
    coverageShapeDistribution: text(row.coverage_shape_distribution || row.coverageShapeDistribution),
    conflictCandidateCount: numberOrZero(row.conflict_candidate_count ?? row.conflictCandidateCount),
    hasContextAnnotation: row.hasContextAnnotation === true || truthy(row.has_context_annotation),
    hasLssAnnotation: row.hasLssAnnotation === true || truthy(row.has_lss_annotation),
    searchText: text(row.search_text || row.searchText),
    routeId: text(row.route_id || row.routeId)
  };
}

function normalizeFacet(row) {
  return {
    name: text(row.facet_name || row.name),
    label: text(row.display_label || row.label || row.facet_name || row.name),
    sourceTable: text(row.source_table || row.sourceTable),
    sourceColumn: text(row.source_column || row.sourceColumn),
    group: text(row.facet_group || row.group)
  };
}

function normalizePreset(row) {
  return {
    id: text(row.preset_id || row.id),
    name: text(row.preset_name || row.display_name || row.name || row.preset_id || row.id),
    description: text(row.preset_description || row.description),
    filterExpression: text(row.filter_expression || row.filterExpression),
    requiredAnnotationTables: splitList(row.required_annotation_tables || row.requiredAnnotationTables),
    isDefault: row.isDefault === true || truthy(row.is_default),
    userEditable: row.userEditable === true || truthy(row.user_editable || row.editable_by_user),
    warningText: text(row.warning_text || row.warningText)
  };
}

function normalizeDownload(row) {
  return {
    id: text(row.download_id || row.id),
    label: text(row.download_label || row.label || row.download_id || row.id),
    sourceTables: text(row.source_tables || row.sourceTables),
    filterExpression: text(row.filter_expression || row.filterExpression),
    filePath: text(row.file_path || row.artifact_path || row.filePath),
    fileFormat: text(row.file_format || row.fileFormat),
    rowCount: numberOrZero(row.row_count ?? row.rowCount),
    sha256: text(row.sha256)
  };
}

function normalizeSummary(row) {
  return {
    profileCount: numberOrZero(row.profile_count),
    pairCount: numberOrZero(row.pair_count),
    residueEvidenceCount: numberOrZero(row.residue_evidence_count),
    recommendedDefaultPreset: text(row.recommended_default_preset),
    summaryRouteId: text(row.summary_route_id)
  };
}

function normalizeRoute(row) {
  return {
    detailRouteId: text(row.detail_route_id),
    mappingTableRouteId: text(row.mapping_table_route_id),
    coverageAnnotationRouteId: text(row.coverage_annotation_route_id),
    fecAnnotationRouteId: text(row.fec_annotation_route_id),
    assayNumericRouteId: text(row.assay_numeric_route_id),
    structureContextRouteId: text(row.structure_context_route_id),
    lssAnnotationRouteId: text(row.lss_annotation_route_id),
    conflictAnnotationRouteId: text(row.conflict_annotation_route_id),
    sourceDownloadRouteId: text(row.source_download_route_id)
  };
}

function normalizeTrackRoute(row) {
  return {
    profileId: text(row.profile_id),
    trackRouteId: text(row.track_route_id),
    trackDataPath: text(row.track_data_path),
    trackSchemaId: text(row.track_schema_id),
    supports1d: truthy(row.supports_1d),
    supportsTable: truthy(row.supports_table),
    colorPolicyId: text(row.color_policy_id)
  };
}

function normalizePair2d(row) {
  return {
    contextRouteId: text(row.context_route_id),
    pairContextDataPath: text(row.pair_context_data_path),
    pairContextSchemaId: text(row.pair_context_schema_id),
    contextEngine: text(row.context_engine),
    supportsPairArcView: truthy(row.supports_pair_arc_view),
    supportsDotBracketView: truthy(row.supports_dot_bracket_view),
    supportsResidueHover: truthy(row.supports_residue_hover)
  };
}

function normalizeColor3d(row) {
  return {
    structureFilePath: text(row.structure_file_path || row.structureFilePath),
    structureUrl: text(row.structure_url || row.structureUrl),
    structureFileFormat: text(row.structure_file_format || row.structureFileFormat),
    residueColoringDataPath: text(row.residue_coloring_data_path || row.residueColoringDataPath),
    viewerCompatibility: text(row.viewer_compatibility || row.viewerCompatibility),
    colorPolicyId: text(row.color_policy_id || row.colorPolicyId),
    coordinateKeyColumn: text(row.pdb_residue_coordinate_key_column || row.coordinateKeyColumn),
    valueColumn: text(row.value_column || row.valueColumn)
  };
}

function reactivityColorBin(value) {
  if (!Number.isFinite(value)) return 'missing';
  if (value < 0.35) return 'low';
  if (value < 1) return 'mid';
  return 'high';
}

function residueLabel(row = {}) {
  const chain = text(row.label_asym_id || row.labelAsymId || row.auth_asym_id || row.authAsymId || row.chain_id_display);
  const seq = text(row.auth_seq_id || row.authSeqId || row.label_seq_id || row.labelSeqId || row.rmdb_position || row.rmdbPosition);
  const base = text(row.parent_base || row.parentBase || row.comp_id || row.compId || row.rmdb_base || row.rmdbBase);
  return [chain && seq ? `${chain}:${seq}` : seq || chain, base].filter(Boolean).join(' ');
}

function normalizeResidueEvidence(row = {}) {
  const reactivityValue = numberOrNull(row.reactivity_value ?? row.reactivityValue);
  const reactivityError = numberOrNull(row.reactivity_error ?? row.reactivityError);
  return {
    pairId: text(row.pair_id || row.pairId),
    profileId: text(row.rmdb_profile_id || row.profile_id || row.profileId),
    rmdbPosition: numberOrNull(row.rmdb_position ?? row.rmdbPosition),
    rmdbBase: text(row.rmdb_base || row.rmdbBase),
    pdbResidue: residueLabel(row),
    labelAsymId: text(row.label_asym_id || row.labelAsymId),
    labelSeqId: numberOrNull(row.label_seq_id ?? row.labelSeqId),
    authSeqId: text(row.auth_seq_id || row.authSeqId),
    compId: text(row.comp_id || row.compId),
    parentBase: text(row.parent_base || row.parentBase),
    coordinateKey: text(row.pdb_residue_coordinate_key || row.residue_key || row.coordinateKey),
    reactivityValue,
    reactivityError,
    numericStatus: text(row.numeric_status || row.numericStatus),
    projectionStatus: text(row.residue_projection_status || row.projection_status || row.projectionStatus),
    structureReactivityStatus: text(row.structure_reactivity_status || row.structureReactivityStatus),
    colorBin: reactivityColorBin(reactivityValue)
  };
}

function parseSegmentRange(value) {
  const match = text(value).match(/:(\d+)-(\d+)$/);
  if (!match) return { start: null, end: null };
  return { start: Number(match[1]), end: Number(match[2]) };
}

function normalizeLssContext(row = {}) {
  const segmentLabel = text(row.residue_key_or_segment_key || row.segmentLabel);
  const range = parseSegmentRange(segmentLabel);
  return {
    pairId: text(row.pair_id || row.pairId),
    pairSegmentId: text(row.pair_segment_id || row.pairSegmentId),
    profileId: text(row.profile_id || row.profileId),
    segmentLabel,
    start: range.start,
    end: range.end,
    pairedEvaluable: numberOrZero(row.n_paired_evaluable ?? row.pairedEvaluable),
    unpairedEvaluable: numberOrZero(row.n_unpaired_evaluable ?? row.unpairedEvaluable),
    lssStatus: text(row.lss_status || row.lssStatus),
    contextEngine: text(row.context_engine || row.contextEngine)
  };
}

function buildVisualPreview({ residueEvidence = [], lssContexts = [], structureRoutes = [] } = {}) {
  const residuePoints = asArray(residueEvidence).map(normalizeResidueEvidence);
  const firstStructureRoute = structureRoutes[0] || {};
  return {
    browserLoadsAnnoconfidenceBigTables: false,
    source: 'build-time derived preview from route-indexed evidence; full ANNOCONFIDENCE tables stay server-side',
    reactivity1d: {
      pointCount: residuePoints.length,
      points: residuePoints.map((point, index) => ({
        index: index + 1,
        pdbResidue: point.pdbResidue,
        rmdbPosition: point.rmdbPosition,
        rmdbBase: point.rmdbBase,
        profileId: point.profileId,
        reactivityValue: point.reactivityValue,
        reactivityError: point.reactivityError,
        numericStatus: point.numericStatus,
        colorBin: point.colorBin
      }))
    },
    pairArcs: asArray(lssContexts).map(normalizeLssContext),
    structureColoring: {
      structureFilePath: text(firstStructureRoute.structureFilePath || firstStructureRoute.structure_file_path),
      structureUrl: text(firstStructureRoute.structureUrl || firstStructureRoute.structure_url),
      coordinateKeyColumn: text(firstStructureRoute.coordinateKeyColumn || firstStructureRoute.pdb_residue_coordinate_key_column || 'pdb_residue_coordinate_key'),
      valueColumn: text(firstStructureRoute.valueColumn || firstStructureRoute.value_column || 'reactivity_value'),
      points: residuePoints.map((point) => ({
        coordinateKey: point.coordinateKey,
        pdbResidue: point.pdbResidue,
        reactivityValue: point.reactivityValue,
        colorBin: point.colorBin
      }))
    },
    mappedResidues: residuePoints
  };
}

function normalizeConflict(row) {
  return {
    id: text(row.conflict_candidate_id || row.conflict_candidate_route_id || row.route_id),
    routeId: text(row.route_id || row.conflict_candidate_route_id),
    type: text(row.conflict_type),
    status: text(row.conflict_status || row.discordance_status),
    fecClaimCeiling: text(row.fec_claim_ceiling),
    claimScope: text(row.claim_scope),
    lssStatus: text(row.lss_status),
    reviewPriorityHint: text(row.review_priority_hint || row.candidate_reason)
  };
}

function byCase(rows, caseId) {
  return asArray(rows).filter((row) => text(row.case_id) === caseId);
}

function firstByCase(rows, caseId) {
  return byCase(rows, caseId)[0] || null;
}

function filterCases(cases, filters = {}) {
  return cases.filter((row) => {
    const queryTarget = [
      row.searchText,
      row.caseId,
      row.pdbId,
      row.rnaFamily,
      row.motif,
      row.structureClass,
      ...row.assayFamilies
    ].join(' ');
    return includesFolded(queryTarget, filters.query)
      && includesFolded(row.rnaFamily, filters.rnaFamily)
      && includesFolded(row.pdbId, filters.pdbId)
      && includesFolded(row.motif, filters.motif)
      && includesFolded(row.structureClass, filters.structureClass)
      && (!filters.probeType || row.assayFamilies.some((family) => includesFolded(family, filters.probeType)));
  });
}

export function buildAtlasSearchState(tables = {}, filters = {}) {
  const normalizedCases = asArray(tables.cases).map(normalizeCase);
  const cases = filterCases(normalizedCases, filters);
  return {
    source: ANNOJOIN_SOURCE_CONTRACT,
    filters: {
      query: text(filters.query),
      rnaFamily: text(filters.rnaFamily),
      probeType: text(filters.probeType),
      pdbId: text(filters.pdbId),
      motif: text(filters.motif),
      structureClass: text(filters.structureClass)
    },
    cases,
    totalCaseCount: normalizedCases.length,
    facets: asArray(tables.facets).map(normalizeFacet),
    presets: asArray(tables.presets).map(normalizePreset),
    downloads: asArray(tables.downloads).map(normalizeDownload)
  };
}

export function createAtlasCaseDetail(tables = {}, caseIdInput = '') {
  const caseId = text(caseIdInput);
  const caseRow = firstByCase(tables.cases, caseId);
  if (!caseRow) return null;
  const structureRoutes = byCase(tables.colors3d, caseId).map(normalizeColor3d);
  return {
    ...normalizeCase(caseRow),
    summary: firstByCase(tables.summaries, caseId) ? normalizeSummary(firstByCase(tables.summaries, caseId)) : null,
    detailRoutes: firstByCase(tables.routes, caseId) ? normalizeRoute(firstByCase(tables.routes, caseId)) : null,
    memberships: byCase(tables.memberships, caseId).map((row) => ({
      pairId: text(row.pair_id),
      profileId: text(row.profile_id),
      routeId: text(row.profile_membership_route_id)
    })),
    trackRoutes: byCase(tables.tracks, caseId).map(normalizeTrackRoute),
    pairContextRoutes: byCase(tables.pairs2d, caseId).map(normalizePair2d),
    structureRoutes,
    conflicts: byCase(tables.conflicts, caseId).map(normalizeConflict),
    visualPreview: buildVisualPreview({
      residueEvidence: byCase(tables.residueEvidence, caseId),
      lssContexts: byCase(tables.lssContexts, caseId),
      structureRoutes
    })
  };
}

export function createAtlasCaseDetailFromAsset(asset) {
  if (!asset?.case) return null;
  return {
    ...asset.case,
    summary: asset.summary || null,
    detailRoutes: asset.detailRoutes || null,
    memberships: asset.memberships || [],
    trackRoutes: asset.trackRoutes || [],
    pairContextRoutes: asset.pairContextRoutes || [],
    structureRoutes: asset.structureRoutes || [],
    conflicts: asset.conflicts || [],
    visualPreview: asset.visualPreview || buildVisualPreview()
  };
}

export const SAMPLE_ANNOJOIN_ATLAS_TABLES = {
  cases: [
    {
      case_id: '10ZT',
      case_uid: 'RMDB2PDB|10ZT',
      pdb_id: '10ZT',
      pdb_chain_ids: '',
      profile_ids: 'rmdbv3_exact_d48b168ed659eeb6986d99ce1a46f797ff8d67c7|top_x_279::seq_775726ec4465858e|10ZT_A',
      profile_count: '1',
      profile_ids_complete: 'true',
      profile_membership_route_id: 'annojoin:profiles:RMDB2PDB:10ZT',
      source_databases: 'RMDB;PDB',
      assay_family_set: 'rmdb_chemical_probing',
      rna_family_label: '',
      motif_label: '',
      structure_class_label: '',
      fec_claim_ceiling_distribution: '{"C_EXPLORATORY_HINT":1}',
      coverage_shape_distribution: 'see ANNOCONFIDENCE/coverage_topology_annotation.tsv',
      conflict_candidate_count: '1',
      has_context_annotation: 'true',
      has_lss_annotation: 'true',
      search_text: '10ZT RMDB2PDB rmdb chemical probing',
      route_id: 'annojoin:case:RMDB2PDB:10ZT'
    },
    {
      case_id: '10ZU',
      case_uid: 'RMDB2PDB|10ZU',
      pdb_id: '10ZU',
      pdb_chain_ids: '',
      profile_ids: 'rmdbv3_exact_8a785a01846fad5a5b70bcdad4d34fe117f096ae|top_x_279::seq_14799dda3998b255|10ZU_A',
      profile_count: '5',
      profile_ids_complete: 'true',
      profile_membership_route_id: 'annojoin:profiles:RMDB2PDB:10ZU',
      source_databases: 'RMDB;PDB',
      assay_family_set: 'rmdb_chemical_probing',
      rna_family_label: '',
      motif_label: '',
      structure_class_label: '',
      fec_claim_ceiling_distribution: '{"C_EXPLORATORY_HINT":5}',
      coverage_shape_distribution: 'see ANNOCONFIDENCE/coverage_topology_annotation.tsv',
      conflict_candidate_count: '1',
      has_context_annotation: 'true',
      has_lss_annotation: 'true',
      search_text: '10ZU RMDB2PDB rmdb chemical probing',
      route_id: 'annojoin:case:RMDB2PDB:10ZU'
    }
  ],
  facets: [
    { facet_name: 'PDB ID', source_table: 'anno_case_search_index.tsv', source_column: 'pdb_id', display_label: 'PDB ID', facet_group: 'identity' },
    { facet_name: 'RNA family', source_table: 'anno_case_search_index.tsv', source_column: 'rna_family_label', display_label: 'RNA family', facet_group: 'biology' },
    { facet_name: 'probe type', source_table: 'assay_numeric_usability_annotation.tsv', source_column: 'raw_assay_label', display_label: 'Probe type', facet_group: 'assay' },
    { facet_name: 'motif', source_table: 'anno_case_search_index.tsv', source_column: 'motif_label', display_label: 'Motif', facet_group: 'biology' },
    { facet_name: 'structure class', source_table: 'anno_case_search_index.tsv', source_column: 'structure_class_label', display_label: 'Structure class', facet_group: 'structure' }
  ],
  summaries: [
    { case_id: '10ZT', profile_count: '1', pair_count: '1', residue_evidence_count: '', recommended_default_preset: 'balanced_segment_view', summary_route_id: 'annojoin:summary:RMDB2PDB:10ZT' },
    { case_id: '10ZU', profile_count: '5', pair_count: '5', residue_evidence_count: '', recommended_default_preset: 'balanced_segment_view', summary_route_id: 'annojoin:summary:RMDB2PDB:10ZU' }
  ],
  routes: [
    { case_id: '10ZT', detail_route_id: '/atlas/rmdb2pdb/10ZT', mapping_table_route_id: 'annojoin:mapping:RMDB2PDB:10ZT', coverage_annotation_route_id: 'annojoin:coverage:RMDB2PDB:10ZT', fec_annotation_route_id: 'annojoin:fec:RMDB2PDB:10ZT', assay_numeric_route_id: 'annojoin:numeric:RMDB2PDB:10ZT', structure_context_route_id: 'annojoin:structure-context:RMDB2PDB:10ZT', lss_annotation_route_id: 'annojoin:lss:RMDB2PDB:10ZT', conflict_annotation_route_id: 'annojoin:conflict:RMDB2PDB:10ZT', source_download_route_id: 'download:RMDB2PDB:10ZT:annotation_bundle' },
    { case_id: '10ZU', detail_route_id: '/atlas/rmdb2pdb/10ZU', mapping_table_route_id: 'annojoin:mapping:RMDB2PDB:10ZU', coverage_annotation_route_id: 'annojoin:coverage:RMDB2PDB:10ZU', fec_annotation_route_id: 'annojoin:fec:RMDB2PDB:10ZU', assay_numeric_route_id: 'annojoin:numeric:RMDB2PDB:10ZU', structure_context_route_id: 'annojoin:structure-context:RMDB2PDB:10ZU', lss_annotation_route_id: 'annojoin:lss:RMDB2PDB:10ZU', conflict_annotation_route_id: 'annojoin:conflict:RMDB2PDB:10ZU', source_download_route_id: 'download:RMDB2PDB:10ZU:annotation_bundle' }
  ],
  memberships: [
    { case_id: '10ZT', pair_id: '10ZT:sequence_000001', profile_id: 'data-eterna/data-eterna/OK7ALIB_2A3_0000.rdat#5914', profile_membership_route_id: 'annojoin:profiles:RMDB2PDB:10ZT' },
    { case_id: '10ZU', pair_id: '10ZU:sequence_000001', profile_id: 'data-eterna/data-eterna/OK7ALIB_2A3_0000.rdat#1298', profile_membership_route_id: 'annojoin:profiles:RMDB2PDB:10ZU' }
  ],
  tracks: [
    { case_id: '10ZT', profile_id: 'data-eterna/data-eterna/OK7ALIB_2A3_0000.rdat#5914', track_route_id: 'annojoin:track:RMDB2PDB:pairseg_10ZT_sequence_000001', track_data_path: 'ANNOCONFIDENCE/assay_numeric_usability_annotation.tsv', track_schema_id: 'assay_numeric_usability_annotation', supports_1d: 'true', supports_table: 'true', color_policy_id: 'rmdb_reactivity_low_mid_high_v1' }
  ],
  pairs2d: [
    { case_id: '10ZT', context_route_id: 'annojoin:2d:RMDB2PDB:pairseg_10ZT_sequence_000001', pair_context_data_path: 'ANNOCONFIDENCE/lss_structure_context_annotation.tsv', pair_context_schema_id: 'lss_structure_context_annotation', context_engine: 'FEC_V0_4_BETA_LSS', supports_pair_arc_view: 'true', supports_dot_bracket_view: 'false', supports_residue_hover: 'true' }
  ],
  colors3d: [
    { case_id: '10ZT', structure_file_path: 'CONFIDENCE/10_structure_context/alpha_full_20260615/mmcif_inputs_from_132/10zt.cif', structure_file_format: 'mmCIF', residue_coloring_data_path: 'ANNOCONFIDENCE/mapping_uncertainty_annotation.tsv', viewer_compatibility: 'coordinate-key residue coloring', color_policy_id: 'rmdb_reactivity_low_mid_high_v1', pdb_residue_coordinate_key_column: 'pdb_residue_coordinate_key', value_column: 'reactivity_value' }
  ],
  conflicts: [
    { case_id: '10ZT', conflict_candidate_id: 'RMDB2PDB|conflict|pairseg_10ZT_sequence_000001', conflict_type: 'structure_signal_discordance_candidate', conflict_status: 'candidate', fec_claim_ceiling: 'C_EXPLORATORY_HINT', claim_scope: 'PDB_SEGMENT_ONLY', lss_status: 'LSS_MODERATE_CANDIDATE', review_priority_hint: 'review_lss_signal_context', route_id: 'annojoin:conflict:RMDB2PDB:pairseg_10ZT_sequence_000001' }
  ],
  presets: [
    { preset_id: 'strict_reference_view', preset_name: 'Strict reference view', preset_description: 'High provenance, numeric and context-supported rows.', filter_expression: "fec_claim_ceiling in ['A_REFERENCE_READY','B_STRONG_SUPPORT']", required_annotation_tables: 'fec_claim_boundary_annotation.tsv;assay_numeric_usability_annotation.tsv;lss_structure_context_annotation.tsv', is_default: 'false', user_editable: 'true', warning_text: 'Preset is an Atlas view; it does not overwrite FEC claim ceilings or define Core truth.' },
    { preset_id: 'balanced_segment_view', preset_name: 'Balanced segment view', preset_description: 'Default bounded segment interpretation without upgrading Core truth.', filter_expression: "claim_scope == 'PDB_SEGMENT_ONLY'", required_annotation_tables: 'fec_claim_boundary_annotation.tsv;coverage_topology_annotation.tsv;lss_structure_context_annotation.tsv', is_default: 'true', user_editable: 'true', warning_text: 'Preset is an Atlas view; it does not overwrite FEC claim ceilings or define Core truth.' }
  ],
  downloads: [
    { download_id: 'download:RMDB2PDB:anno_case_search_index.tsv', download_label: 'anno_case_search_index.tsv', source_tables: 'anno_case_search_index.tsv', filter_expression: "asset_family == 'RMDB2PDB'", file_path: 'ANNOJOIN/anno_case_search_index.tsv', file_format: 'tsv', row_count: '1126', sha256: 'd0d056826ea55f50366b60aaa9e49aa2377abeb9793aa4078ebdf3e2cd9c8bd9' },
    { download_id: 'download:RMDB2PDB:atlas_download_manifest.tsv', download_label: 'atlas_download_manifest.tsv', source_tables: 'atlas_download_manifest.tsv', filter_expression: "asset_family == 'RMDB2PDB'", file_path: 'ANNOJOIN/atlas_download_manifest.tsv', file_format: 'tsv', row_count: '24', sha256: '' }
  ]
};
