import { buildAtlasSearchState } from '../../src/annojoinAtlasData.js';

const EXPORT_COLUMNS = [
  'filter_expression',
  'source_version',
  'atlas_case_key',
  'case_id',
  'pdb_id',
  'rna_family',
  'probe_families',
  'motif',
  'structure_class',
  'confidence_display_label',
  'profile_count',
  'conflict_candidate_count',
  'source_case_count',
  'source_families',
  'source_case_keys',
  'detail_route_id',
  'case_asset_path'
];

function text(value) {
  return String(value ?? '').trim();
}

function normalizeFilterParams(params = {}) {
  return {
    query: text(params.q ?? params.query),
    rnaFamily: text(params.rnaFamily),
    probeType: text(params.probeType),
    pdbId: text(params.pdbId),
    motif: text(params.motif),
    structureClass: text(params.structureClass)
  };
}

function filterExpression(filters = {}) {
  const pairs = [
    ['q', filters.query],
    ['rnaFamily', filters.rnaFamily],
    ['probeType', filters.probeType],
    ['pdbId', filters.pdbId],
    ['motif', filters.motif],
    ['structureClass', filters.structureClass]
  ].filter(([, value]) => text(value));
  return new URLSearchParams(pairs).toString();
}

function csvCell(value) {
  const raw = String(value ?? '');
  const escaped = raw.replaceAll('"', '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function rowsToCsv(rows) {
  return [
    EXPORT_COLUMNS.join(','),
    ...rows.map((row) => EXPORT_COLUMNS.map((column) => csvCell(row[column])).join(','))
  ].join('\n') + '\n';
}

function rowFromCase(row, sourceVersion, expression) {
  return {
    filter_expression: expression,
    source_version: sourceVersion,
    atlas_case_key: row.atlasCaseKey,
    case_id: row.caseId,
    pdb_id: row.pdbId,
    rna_family: row.rnaFamily,
    probe_families: row.assayFamilies.join(';'),
    motif: row.motif,
    structure_class: row.structureClass,
    confidence_display_label: row.confidenceDisplayLabel,
    profile_count: row.profileCount,
    conflict_candidate_count: row.conflictCandidateCount,
    source_case_count: row.sourceCaseCount || '',
    source_families: (row.sourceFamilies || []).join(';'),
    source_case_keys: (row.sourceCaseKeys || []).join(';'),
    detail_route_id: row.detailRouteId,
    case_asset_path: row.caseAssetPath
  };
}

export function buildAnnojointCurrentFilterExport(indexAsset = {}, params = {}) {
  const filters = normalizeFilterParams(params);
  const state = buildAtlasSearchState(indexAsset, filters);
  const expression = filterExpression(filters);
  const sourceVersion = text(indexAsset.version || state.source.version);
  return {
    source: {
      ...state.source,
      version: sourceVersion,
      browserLoadsAnnoconfidenceBigTables: false
    },
    filterExpression: expression,
    totalRows: state.cases.length,
    totalCaseCount: state.totalCaseCount,
    totalSourceCaseCount: state.totalSourceCaseCount,
    rows: state.cases.map((row) => rowFromCase(row, sourceVersion, expression))
  };
}

export function buildAnnojointCurrentFilterResponse(indexAsset = {}, params = {}) {
  const result = buildAnnojointCurrentFilterExport(indexAsset, params);
  const format = text(params.format).toLowerCase() === 'json' ? 'json' : 'csv';
  const filename = `annojoin-current-filter-${result.source.version || 'export'}.${format}`;
  const commonHeaders = {
    'X-FoldBridge-Entry-Root': result.source.entryRoot,
    'X-FoldBridge-Annotation-Root': result.source.annotationRoot,
    'X-FoldBridge-Source-Version': result.source.version,
    'X-FoldBridge-Filter-Expression': result.filterExpression
  };

  if (format === 'json') {
    return {
      status: 200,
      headers: {
        ...commonHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      },
      body: `${JSON.stringify(result, null, 2)}\n`
    };
  }

  return {
    status: 200,
    headers: {
      ...commonHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`
    },
    body: rowsToCsv(result.rows)
  };
}
