export const ANNOJOIN_ATLAS_SCHEMA_VERSION = 'annojoin-atlas.v1';
export const ANNOJOIN_ATLAS_VERSION = 'V2.1_RMDB_LINE_A_20260617';
export const DEFAULT_ROUTE_PAGE_SIZE = 500;
export const DEFAULT_ROUTE_PREVIEW_SIZE = 8;
export const DEFAULT_VISUAL_PREVIEW_SIZE = 48;

export function parseTsv(text) {
  const [headerLine, ...lines] = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  if (!headerLine) return [];
  const header = headerLine.split('\t');
  return lines
    .filter((line) => line.length > 0)
    .map((line) => {
      const cells = line.split('\t');
      return Object.fromEntries(header.map((key, index) => [key, cells[index] ?? '']));
    });
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
  return text(value).split(';').map((item) => item.trim()).filter(Boolean);
}

function previewProfiles(value) {
  return splitList(value).filter((profileId) => !profileId.startsWith('bundle_'));
}

export function groupByCaseId(rows) {
  const grouped = new Map();
  for (const row of rows || []) {
    const caseId = text(row.case_id);
    if (!caseId) continue;
    if (!grouped.has(caseId)) grouped.set(caseId, []);
    grouped.get(caseId).push(row);
  }
  return grouped;
}

function normalizeCase(row = {}) {
  const caseId = text(row.case_id);
  return {
    caseUid: text(row.case_uid),
    caseId,
    pdbId: text(row.pdb_id),
    chains: splitList(row.pdb_chain_ids),
    sourceDatabases: splitList(row.source_databases),
    assayFamilies: splitList(row.assay_family_set),
    rnaFamily: text(row.rna_family_label),
    rnaFamilyProvenance: text(row.rna_family_provenance),
    motif: text(row.motif_label),
    motifProvenance: text(row.motif_provenance),
    structureClass: text(row.structure_class_label),
    structureClassProvenance: text(row.structure_class_provenance),
    profilePreview: previewProfiles(row.profile_ids),
    profileCount: numberOrZero(row.profile_count),
    profilePreviewIsComplete: truthy(row.profile_ids_complete),
    profileMembershipRouteId: text(row.profile_membership_route_id),
    fecClaimCeilingDistribution: text(row.fec_claim_ceiling_distribution),
    coverageShapeDistribution: text(row.coverage_shape_distribution),
    conflictCandidateCount: numberOrZero(row.conflict_candidate_count),
    hasContextAnnotation: truthy(row.has_context_annotation),
    hasLssAnnotation: truthy(row.has_lss_annotation),
    searchText: text(row.search_text),
    routeId: text(row.route_id),
    caseAssetPath: `cases/${caseId}.json`
  };
}

function normalizeFacet(row = {}) {
  return {
    name: text(row.facet_name),
    label: text(row.display_label || row.facet_name),
    sourceTable: text(row.source_table),
    sourceColumn: text(row.source_column),
    group: text(row.facet_group)
  };
}

function normalizePreset(row = {}) {
  return {
    id: text(row.preset_id),
    name: text(row.preset_name || row.preset_id),
    description: text(row.preset_description),
    filterExpression: text(row.filter_expression),
    requiredAnnotationTables: splitList(row.required_annotation_tables),
    isDefault: truthy(row.is_default),
    userEditable: truthy(row.user_editable),
    warningText: text(row.warning_text)
  };
}

function normalizeDownload(row = {}) {
  return {
    id: text(row.download_id),
    label: text(row.download_label || row.download_id),
    sourceTables: text(row.source_tables),
    filterExpression: text(row.filter_expression),
    filePath: text(row.file_path),
    fileFormat: text(row.file_format),
    rowCount: numberOrZero(row.row_count),
    sha256: text(row.sha256)
  };
}

function normalizeSummary(row = {}) {
  return {
    profileCount: numberOrZero(row.profile_count),
    pairCount: numberOrZero(row.pair_count),
    residueEvidenceCount: numberOrZero(row.residue_evidence_count),
    recommendedDefaultPreset: text(row.recommended_default_preset),
    summaryRouteId: text(row.summary_route_id)
  };
}

function normalizeRoute(row = {}) {
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

function normalizeTrack(row = {}) {
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

function normalizePair2d(row = {}) {
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

function normalizeColor3d(row = {}) {
  return {
    structureFilePath: text(row.structure_file_path),
    structureUrl: text(row.structure_url),
    structureFileFormat: text(row.structure_file_format),
    residueColoringDataPath: text(row.residue_coloring_data_path),
    viewerCompatibility: text(row.viewer_compatibility),
    colorPolicyId: text(row.color_policy_id),
    coordinateKeyColumn: text(row.pdb_residue_coordinate_key_column),
    valueColumn: text(row.value_column)
  };
}

function reactivityColorBin(value) {
  if (!Number.isFinite(value)) return 'missing';
  if (value < 0.35) return 'low';
  if (value < 1) return 'mid';
  return 'high';
}

function residueLabel(row = {}) {
  const chain = text(row.label_asym_id || row.auth_asym_id || row.chain_id_display);
  const seq = text(row.auth_seq_id || row.label_seq_id || row.rmdb_position);
  const base = text(row.parent_base || row.comp_id || row.rmdb_base);
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

export function buildVisualPreview({
  residueEvidence = [],
  lssContexts = [],
  structureRoutes = [],
  maxPoints = DEFAULT_VISUAL_PREVIEW_SIZE
} = {}) {
  const residuePoints = residueEvidence
    .slice(0, maxPoints)
    .map(normalizeResidueEvidence);
  const firstStructureRoute = structureRoutes[0] || {};
  return {
    browserLoadsAnnoconfidenceBigTables: false,
    source: 'build-time derived preview from route-indexed evidence; full ANNOCONFIDENCE tables stay server-side',
    reactivity1d: {
      pointCount: residueEvidence.length,
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
    pairArcs: lssContexts.slice(0, 12).map(normalizeLssContext),
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

function normalizeConflict(row = {}) {
  return {
    id: text(row.conflict_candidate_id || row.route_id),
    routeId: text(row.route_id),
    type: text(row.conflict_type),
    status: text(row.conflict_status),
    fecClaimCeiling: text(row.fec_claim_ceiling),
    claimScope: text(row.claim_scope),
    lssStatus: text(row.lss_status),
    reviewPriorityHint: text(row.review_priority_hint)
  };
}

function pagePath(caseId, routeKey, page) {
  return `cases/${caseId}/${routeKey}/page-${String(page).padStart(4, '0')}.json`;
}

export function buildPagedRouteAssets({
  caseId,
  routeKey,
  rows = [],
  pageSize = DEFAULT_ROUTE_PAGE_SIZE,
  previewSize = DEFAULT_ROUTE_PREVIEW_SIZE
} = {}) {
  const selectedCaseId = text(caseId);
  const safeRows = Array.isArray(rows) ? rows : [];
  const pageCount = Math.max(1, Math.ceil(safeRows.length / pageSize));
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    const start = index * pageSize;
    const pageRows = safeRows.slice(start, start + pageSize);
    const path = pagePath(selectedCaseId, routeKey, page);
    return {
      path,
      asset: {
        schemaVersion: ANNOJOIN_ATLAS_SCHEMA_VERSION,
        version: ANNOJOIN_ATLAS_VERSION,
        caseId: selectedCaseId,
        routeKey,
        page,
        pageSize,
        totalRows: safeRows.length,
        pageCount,
        rows: pageRows
      }
    };
  });

  return {
    summary: {
      totalRows: safeRows.length,
      pageSize,
      pageCount,
      path: pages[0].path,
      preview: safeRows.slice(0, previewSize)
    },
    pages
  };
}

function firstByCase(rows, caseId) {
  return (rows || []).find((row) => text(row.case_id) === caseId) || null;
}

function allByCase(rows, caseId) {
  return (rows || []).filter((row) => text(row.case_id) === caseId);
}

export function buildAtlasIndexAsset({
  cases = [],
  facets = [],
  summaries = [],
  routes = [],
  presets = [],
  downloads = [],
  generatedAt = new Date().toISOString()
} = {}) {
  return {
    schemaVersion: ANNOJOIN_ATLAS_SCHEMA_VERSION,
    version: ANNOJOIN_ATLAS_VERSION,
    generatedAt,
    source: {
      entryRoot: 'ANNOJOIN',
      annotationRoot: 'ANNOCONFIDENCE',
      browserLoadsAnnoconfidenceBigTables: false
    },
    totalCaseCount: cases.length,
    cases: cases.map((row) => {
      const caseId = text(row.case_id);
      const summary = firstByCase(summaries, caseId);
      const route = firstByCase(routes, caseId);
      return {
        ...normalizeCase(row),
        recommendedDefaultPreset: text(summary?.recommended_default_preset),
        detailRouteId: text(route?.detail_route_id)
      };
    }),
    facets: facets.map(normalizeFacet),
    presets: presets.map(normalizePreset),
    downloads: downloads.map(normalizeDownload)
  };
}

export function buildAtlasCaseAsset({
  caseId,
  cases = [],
  summaries = [],
  routes = [],
  memberships = [],
  tracks = [],
  pairs2d = [],
  lssContexts = [],
  colors3d = [],
  conflicts = [],
  residueEvidence = []
} = {}) {
  const selectedCaseId = text(caseId);
  const caseRow = firstByCase(cases, selectedCaseId);
  if (!caseRow) {
    throw new Error(`[annojoin-atlas] case_id not found: ${selectedCaseId}`);
  }

  const membershipRows = allByCase(memberships, selectedCaseId).map((row) => ({
    pairId: text(row.pair_id),
    profileId: text(row.profile_id),
    routeId: text(row.profile_membership_route_id)
  }));
  const trackRows = allByCase(tracks, selectedCaseId).map(normalizeTrack);
  const pairRows = allByCase(pairs2d, selectedCaseId).map(normalizePair2d);
  const structureRows = allByCase(colors3d, selectedCaseId).map(normalizeColor3d);
  const conflictRows = allByCase(conflicts, selectedCaseId).map(normalizeConflict);
  const residueRows = allByCase(residueEvidence, selectedCaseId);
  const lssRows = allByCase(lssContexts, selectedCaseId);
  const membershipPages = buildPagedRouteAssets({ caseId: selectedCaseId, routeKey: 'memberships', rows: membershipRows });
  const trackPages = buildPagedRouteAssets({ caseId: selectedCaseId, routeKey: 'track-routes', rows: trackRows });
  const pairPages = buildPagedRouteAssets({ caseId: selectedCaseId, routeKey: 'pair-context-routes', rows: pairRows });
  const structurePages = buildPagedRouteAssets({ caseId: selectedCaseId, routeKey: 'structure-routes', rows: structureRows });
  const conflictPages = buildPagedRouteAssets({ caseId: selectedCaseId, routeKey: 'conflicts', rows: conflictRows });
  const visualPreview = buildVisualPreview({ residueEvidence: residueRows, lssContexts: lssRows, structureRoutes: structureRows });
  const visualPages = buildPagedRouteAssets({ caseId: selectedCaseId, routeKey: 'visual-preview', rows: visualPreview.mappedResidues });

  return {
    schemaVersion: ANNOJOIN_ATLAS_SCHEMA_VERSION,
    version: ANNOJOIN_ATLAS_VERSION,
    case: normalizeCase(caseRow),
    summary: normalizeSummary(firstByCase(summaries, selectedCaseId)),
    detailRoutes: normalizeRoute(firstByCase(routes, selectedCaseId)),
    memberships: membershipPages.summary,
    trackRoutes: trackPages.summary,
    pairContextRoutes: pairPages.summary,
    structureRoutes: structurePages.summary,
    conflicts: conflictPages.summary,
    visualPreview,
    routeAssets: {
      memberships: { path: membershipPages.summary.path, totalRows: membershipPages.summary.totalRows, pageCount: membershipPages.summary.pageCount },
      trackRoutes: { path: trackPages.summary.path, totalRows: trackPages.summary.totalRows, pageCount: trackPages.summary.pageCount },
      pairContextRoutes: { path: pairPages.summary.path, totalRows: pairPages.summary.totalRows, pageCount: pairPages.summary.pageCount },
      structureRoutes: { path: structurePages.summary.path, totalRows: structurePages.summary.totalRows, pageCount: structurePages.summary.pageCount },
      conflicts: { path: conflictPages.summary.path, totalRows: conflictPages.summary.totalRows, pageCount: conflictPages.summary.pageCount },
      visualPreview: { path: visualPages.summary.path, totalRows: visualPages.summary.totalRows, pageCount: visualPages.summary.pageCount }
    },
    routeAssetPages: [
      ...membershipPages.pages,
      ...trackPages.pages,
      ...pairPages.pages,
      ...structurePages.pages,
      ...conflictPages.pages,
      ...visualPages.pages
    ],
    annotationPayloadRowsCopied: 0
  };
}
