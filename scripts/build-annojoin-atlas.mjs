#!/usr/bin/env node
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  atlasCaseKeyFor,
  buildAtlasCaseAsset,
  buildAtlasIndexAsset,
  groupByAtlasCaseKey,
  groupByCaseId,
  parseTsv,
  shouldWritePerCaseAssets,
  slimAtlasIndexForWrite
} from './lib/annojoin-atlas-corpus.mjs';
import { buildCaseConfidenceSidecars } from './lib/annojoin-atlas-confidence.mjs';
import { buildChainIdentityIndex } from './lib/annojoin-atlas-chain-identity.mjs';
import {
  buildCompressedJsonSidecars,
  buildDetailRouteIndexAsset
} from './lib/annojoin-atlas-compression.mjs';
import { resolveVisualPreviewCaseIds } from './lib/annojoin-atlas-build-options.mjs';
import { buildAnnojointStructureUrl, normalizeStructureRoutePath } from './lib/annojoin-atlas-structure.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ANNO_ROOT = process.env.FOLDBRIDGE_ANNO_ROOT
  || '/Users/joseperezmartinez/docs/rmdb2pdb/task_packages/confidence_v3_restart_20260613/remote_root';
const ANNOJOIN_ROOT = process.env.FOLDBRIDGE_ANNOJOIN_ROOT
  || path.join(ANNO_ROOT, 'ANNOJOIN');
const ANNOCONFIDENCE_ROOT = process.env.FOLDBRIDGE_ANNOCONFIDENCE_ROOT
  || path.join(ANNO_ROOT, 'ANNOCONFIDENCE');
const FEC_EVIDENCE_ROOT = process.env.FOLDBRIDGE_FEC_EVIDENCE_ROOT
  || path.join(ANNO_ROOT, '06_fec_evidence');
const OUT_ROOT = process.env.FOLDBRIDGE_ANNOJOIN_ATLAS_OUT
  || path.resolve(__dirname, '../src/assets/generated/annojoin-atlas');
const RMDB_ABC_LSS_ROOT = process.env.FOLDBRIDGE_RMDB_ABC_LSS_ROOT
  || '/Volumes/tianyi/foldbridgeAssessert/confidence注册表/RMDB_ABC_LSS';
const RASP_D_LSS_ROOT = process.env.FOLDBRIDGE_RASP_D_LSS_ROOT
  || '/Volumes/tianyi/foldbridgeAssessert/confidence注册表/RASP_D_LSS';
const PDB_CHAIN_IDENTITY_PATH = process.env.FOLDBRIDGE_PDB_CHAIN_IDENTITY
  || '/Volumes/tianyi/tmp/PDB/04_pdb_metadata/pdb_rna_entity_chain_declared_identity.tsv';
const PDB_GOVERNED_MAP_PATH = process.env.FOLDBRIDGE_PDB_GOVERNED_MAP
  || '/Volumes/tianyi/tmp/PDB/biological_layer/parent_child_pdb_map.tsv';
const VISUAL_PREVIEW_ROWS_PER_CASE = Number(process.env.FOLDBRIDGE_ANNOJOIN_VISUAL_ROWS_PER_CASE || 48);
const DETAIL_ASSET_WRITE_CONCURRENCY = Math.max(
  1,
  Number(process.env.FOLDBRIDGE_ANNOJOIN_DETAIL_WRITE_CONCURRENCY || 8)
);
const VIEW_ID = process.env.FOLDBRIDGE_ANNOJOIN_ATLAS_VIEW_ID || path.basename(OUT_ROOT);
const VIEW_ASSET_FAMILIES = (process.env.FOLDBRIDGE_ANNOJOIN_ATLAS_ASSET_FAMILIES || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const TABLES = {
  cases: 'anno_case_search_index.tsv',
  facets: 'anno_facet_catalog.tsv',
  summaries: 'anno_case_evidence_summary.tsv',
  routes: 'anno_detail_route_index.tsv',
  memberships: 'anno_case_profile_membership.tsv',
  tracks: 'anno_residue_track_route_index.tsv',
  pairs2d: 'anno_2d_pair_context_route_index.tsv',
  colors3d: 'anno_3d_residue_coloring_route_index.tsv',
  conflicts: 'anno_conflict_candidate_index.tsv',
  presets: 'atlas_preset_view_definitions.tsv',
  downloads: 'atlas_download_manifest.tsv'
};

async function readTable(name) {
  const fullPath = path.join(ANNOJOIN_ROOT, TABLES[name]);
  if (!existsSync(fullPath)) {
    throw new Error(`[build-annojoin-atlas] missing required ANNOJOIN table: ${fullPath}`);
  }
  return parseTsv(await readFile(fullPath, 'utf8'));
}

async function readOptionalTable(fullPath, label) {
  if (!existsSync(fullPath)) {
    console.warn(`[build-annojoin-atlas] optional ${label} not found: ${fullPath}`);
    return [];
  }
  return parseTsv(await readFile(fullPath, 'utf8'));
}

function firstExistingPath(paths = []) {
  for (const fullPath of paths || []) {
    if (fullPath && existsSync(fullPath)) return fullPath;
  }
  return paths[0] || '';
}

function groupByField(rows = [], fieldName = '') {
  const grouped = new Map();
  for (const row of rows || []) {
    const key = String(row?.[fieldName] ?? '').trim();
    if (!key) continue;
    const bucket = grouped.get(key) || [];
    bucket.push(row);
    grouped.set(key, bucket);
  }
  return grouped;
}

function confidenceEnabledCaseFamily(family = '') {
  return family === 'RMDB2PDB' || family === 'RASP2PDB';
}

function tierSuffix(tier = '') {
  const normalized = String(tier || '').trim();
  return normalized.startsWith('LSS_') ? normalized.slice(4) : normalized;
}

function sourceConfidenceDisplayLabel(row = {}, confidenceAssets = null) {
  // 线1（LSS recall tier）口径：RMDB 与 RASP 都改用校准后的 LSS 召回层级展示，
  // 取默认选中的证据行 -> "{measurement_family} {tier}"（如 "B MODERATE" / "D STRONG"）。
  // 没有校准证据时回退原标签：RMDB 保留 FEC 分布，RASP 保留 "not active"（红线②）。
  if (!confidenceEnabledCaseFamily(row.asset_family || '')) return row.confidence_display_label || '';
  const chosen = confidenceAssets?.evidence?.rows?.find((entry) => entry.selectedByDefault)
    || confidenceAssets?.evidence?.rows?.[0]
    || null;
  if (!chosen) return row.confidence_display_label || '';
  const tier = tierSuffix(chosen.lssTierCalibrated);
  if (!tier) return row.confidence_display_label || '';
  return [String(chosen.family || '').trim(), tier].filter(Boolean).join(' ');
}

function raspDFamilyPathCandidates(root = '') {
  if (!root) {
    return { calibrated: [''], gate: [''] };
  }
  return {
    calibrated: [
      path.join(root, '家族D校准结果_20260627.tsv'),
      path.join(root, 'cal/def_lss_calibrated.tsv'),
    ],
    gate: [
      path.join(root, '家族D校准门禁_20260627.tsv'),
      path.join(root, 'cal/def_lss_calibration_gate.tsv'),
    ],
  };
}

function pickColumns(header, cells, wanted) {
  const row = {};
  for (const name of wanted) {
    const index = header.indexOf(name);
    row[name] = index >= 0 ? cells[index] ?? '' : '';
  }
  return row;
}

async function readResidueEvidencePreview(fullPath, caseIds, rowsPerCase) {
  if (!existsSync(fullPath)) {
    console.warn(`[build-annojoin-atlas] optional residue evidence not found: ${fullPath}`);
    return [];
  }

  const selected = new Set(caseIds);
  const counts = new Map();
  const rows = [];
  let header = null;
  const wanted = [
    'case_id',
    'pair_id',
    'rmdb_profile_id',
    'rmdb_position',
    'rmdb_base',
    'pdb_id',
    'label_asym_id',
    'auth_asym_id',
    'label_seq_id',
    'auth_seq_id',
    'comp_id',
    'parent_base',
    'residue_key',
    'reactivity_value',
    'reactivity_error',
    'numeric_status',
    'residue_projection_status',
    'structure_reactivity_status'
  ];
  const reader = createInterface({
    input: createReadStream(fullPath),
    crlfDelay: Infinity
  });

  for await (const line of reader) {
    if (!header) {
      header = line.split('\t');
      continue;
    }
    if (!line) continue;
    const cells = line.split('\t');
    const caseIdIndex = header.indexOf('case_id');
    const caseId = caseIdIndex >= 0 ? cells[caseIdIndex] || '' : '';
    if (!selected.has(caseId)) continue;
    const count = counts.get(caseId) || 0;
    if (count >= rowsPerCase) continue;
    rows.push(pickColumns(header, cells, wanted));
    counts.set(caseId, count + 1);
    if (counts.size === selected.size && [...counts.values()].every((value) => value >= rowsPerCase)) {
      reader.close();
      break;
    }
  }

  return rows;
}

function updateCompressionReport(manifest, descriptor) {
  if (!manifest.detail_compression) {
    manifest.detail_compression = {
      enabled: true,
      preferred_codec: 'br',
      fallback_codec: 'gzip',
      raw_json_fallback: true,
      asset_count: 0,
      raw_bytes: 0,
      brotli_bytes: 0,
      gzip_bytes: 0,
      sample_assets: [],
      largest_raw_assets: []
    };
  }
  const report = manifest.detail_compression;
  report.asset_count += 1;
  report.raw_bytes += descriptor.rawBytes;
  report.brotli_bytes += descriptor.brotli.bytes;
  report.gzip_bytes += descriptor.gzip.bytes;
  const row = {
    path: descriptor.path,
    raw_bytes: descriptor.rawBytes,
    brotli_bytes: descriptor.brotli.bytes,
    gzip_bytes: descriptor.gzip.bytes
  };
  if (report.sample_assets.length < 20) report.sample_assets.push(row);
  report.largest_raw_assets = [...report.largest_raw_assets, row]
    .sort((left, right) => right.raw_bytes - left.raw_bytes)
    .slice(0, 20);
}

async function writeJson(relPath, data, manifest, { compress = false, compressedAssetsByPath = null } = {}) {
  const fullPath = path.join(OUT_ROOT, relPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  if (!compress) {
    const text = `${JSON.stringify(data)}\n`;
    await writeFile(fullPath, text);
    manifest.assets.push({
      path: relPath,
      size_bytes: Buffer.byteLength(text),
      row_count: Array.isArray(data) ? data.length : undefined
    });
    return null;
  }

  const sidecars = await buildCompressedJsonSidecars(relPath, data);
  await writeFile(fullPath, sidecars.raw.bytes);
  await writeFile(`${fullPath}.br`, sidecars.brotli.bytes);
  await writeFile(`${fullPath}.gz`, sidecars.gzip.bytes);
  if (compressedAssetsByPath) compressedAssetsByPath.set(relPath, sidecars.descriptor);
  updateCompressionReport(manifest, sidecars.descriptor);
  manifest.assets.push({
    path: relPath,
    size_bytes: sidecars.raw.sizeBytes,
    row_count: Array.isArray(data) ? data.length : undefined,
    compression: {
      preferred_codec: 'br',
      fallback_codec: 'gzip',
      raw_json_fallback: true,
      brotli_path: sidecars.brotli.path,
      brotli_size_bytes: sidecars.brotli.sizeBytes,
      gzip_path: sidecars.gzip.path,
      gzip_size_bytes: sidecars.gzip.sizeBytes
    }
  });
  return sidecars.descriptor;
}

async function runWithConcurrency(tasks, concurrency) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    async () => {
      while (nextIndex < tasks.length) {
        const taskIndex = nextIndex;
        nextIndex += 1;
        await tasks[taskIndex]();
      }
    }
  );
  await Promise.all(workers);
}

function addStructureUrls(rows) {
  const uniquePaths = new Set();
  return {
    rows: rows.map((row) => {
      const routePath = row.structure_file_path || '';
      if (!routePath) return row;
      const normalized = normalizeStructureRoutePath(routePath);
      uniquePaths.add(normalized);
      return {
        ...row,
        structure_file_path: normalized,
        structure_url: buildAnnojointStructureUrl(normalized)
      };
    }),
    uniquePathCount: uniquePaths.size
  };
}

async function main() {
  if (!existsSync(ANNOJOIN_ROOT)) {
    throw new Error(`[build-annojoin-atlas] FOLDBRIDGE_ANNOJOIN_ROOT does not exist: ${ANNOJOIN_ROOT}`);
  }

  const writePerCaseAssets = shouldWritePerCaseAssets(process.argv);

  const tables = {};
  for (const name of Object.keys(TABLES)) {
    tables[name] = await readTable(name);
  }
  const raspDFamilyPaths = raspDFamilyPathCandidates(RASP_D_LSS_ROOT);
  const visualCaseIds = resolveVisualPreviewCaseIds(
    tables.cases,
    process.env.FOLDBRIDGE_ANNOJOIN_VISUAL_CASE_LIMIT
  );
  const visualCaseIdSet = new Set(visualCaseIds);
  tables.lssContexts = (await readOptionalTable(
    path.join(ANNOCONFIDENCE_ROOT, 'lss_structure_context_annotation.tsv'),
    'ANNOCONFIDENCE/lss_structure_context_annotation.tsv'
  )).filter((row) => visualCaseIdSet.has(row.case_id));
  tables.residueEvidence = await readResidueEvidencePreview(
    path.join(FEC_EVIDENCE_ROOT, 'residue_evidence.tsv'),
    visualCaseIds,
    Math.max(1, VISUAL_PREVIEW_ROWS_PER_CASE)
  );
  tables.rmdbAbcConfidence = await readOptionalTable(
    RMDB_ABC_LSS_ROOT ? path.join(RMDB_ABC_LSS_ROOT, 'out/abc_lss_confidence.tsv') : '',
    'RMDB A/B/C confidence'
  );
  tables.rmdbAbcCalibrated = await readOptionalTable(
    RMDB_ABC_LSS_ROOT ? path.join(RMDB_ABC_LSS_ROOT, 'cal/abc_lss_calibrated.tsv') : '',
    'RMDB A/B/C calibrated confidence'
  );
  tables.raspDCalibrated = await readOptionalTable(
    firstExistingPath(raspDFamilyPaths.calibrated),
    'RASP Family D calibrated confidence'
  );

  const declaredIdentityRows = await readOptionalTable(PDB_CHAIN_IDENTITY_PATH, 'PDB chain declared identity');
  const governedMapRows = await readOptionalTable(PDB_GOVERNED_MAP_PATH, 'PDB governed identity map');
  const chainIdentityIndex = buildChainIdentityIndex({ declaredIdentityRows, governedRows: governedMapRows });

  const generatedAt = new Date().toISOString();

  if (writePerCaseAssets) {
    await rm(OUT_ROOT, { recursive: true, force: true });
  }
  await mkdir(OUT_ROOT, { recursive: true });

  const manifest = {
    generated_at: generatedAt,
    input_annojoin_root: ANNOJOIN_ROOT,
    output_root: OUT_ROOT,
    view_id: VIEW_ID,
    view_asset_families: VIEW_ASSET_FAMILIES,
    entry_root: 'ANNOJOIN',
    annotation_root: 'ANNOCONFIDENCE',
    browser_loads_annoconfidence_big_tables: false,
    case_count: tables.cases.length,
    facet_count: tables.facets.length,
    preset_count: tables.presets.length,
    download_count: tables.downloads.length,
    visual_preview_case_limit: visualCaseIds.length,
    visual_preview_rows_per_case: VISUAL_PREVIEW_ROWS_PER_CASE,
    visual_preview_residue_rows: tables.residueEvidence.length,
    visual_preview_lss_rows: tables.lssContexts.length,
    rmdb_confidence_root: RMDB_ABC_LSS_ROOT,
    rmdb_confidence_rows: tables.rmdbAbcConfidence.length,
    rmdb_calibrated_rows: tables.rmdbAbcCalibrated.length,
    rasp_family_d_confidence_root: RASP_D_LSS_ROOT,
    rasp_family_d_calibrated_rows: tables.raspDCalibrated.length,
    pdb_chain_identity_path: PDB_CHAIN_IDENTITY_PATH,
    pdb_chain_identity_rows: declaredIdentityRows.length,
    pdb_chain_identity_pdbs: chainIdentityIndex.size,
    structure_route_unique_paths: 0,
    structure_serving_mode: 'api_on_demand',
    detail_compression: {
      enabled: true,
      preferred_codec: 'br',
      fallback_codec: 'gzip',
      raw_json_fallback: true,
      asset_count: 0,
      raw_bytes: 0,
      brotli_bytes: 0,
      gzip_bytes: 0,
      sample_assets: [],
      largest_raw_assets: []
    },
    assets: []
  };

  const structureRoutes = addStructureUrls(tables.colors3d);
  tables.colors3d = structureRoutes.rows;
  manifest.structure_route_unique_paths = structureRoutes.uniquePathCount;

  const grouped = {
    memberships: groupByAtlasCaseKey(tables.memberships),
    tracks: groupByAtlasCaseKey(tables.tracks),
    pairs2d: groupByAtlasCaseKey(tables.pairs2d),
    colors3d: groupByAtlasCaseKey(tables.colors3d),
    conflicts: groupByAtlasCaseKey(tables.conflicts),
    lssContexts: groupByAtlasCaseKey(tables.lssContexts),
    residueEvidence: groupByAtlasCaseKey(tables.residueEvidence),
    lssContextsByCaseId: groupByCaseId(tables.lssContexts),
    residueEvidenceByCaseId: groupByCaseId(tables.residueEvidence),
    rmdbCalibratedByPdb: groupByField(tables.rmdbAbcCalibrated, 'pdb_id'),
    raspDCalibratedByPdb: groupByField(tables.raspDCalibrated, 'pdb_id')
  };

  // 线1（LSS 召回层级）实际数据特征：两张校准表（A/B/C 与 D 家族）都属于 RASP 域
  // （profile_key 全为 rasp_bw_，pdb 全部落在 RASP 原子，RMDB 原子 0 命中）。
  // 因此 RASP case 的 Line 1 证据要取「两表按 pdb 合并」后跨家族选最优层级；
  // RMDB case 本地无 LSS 召回校准，优雅降级保留其 FEC 分布（红线：不伪造）。
  const raspCalibratedByPdb = new Map();
  for (const map of [grouped.rmdbCalibratedByPdb, grouped.raspDCalibratedByPdb]) {
    for (const [pdb, rows] of map) {
      if (!raspCalibratedByPdb.has(pdb)) raspCalibratedByPdb.set(pdb, []);
      raspCalibratedByPdb.get(pdb).push(...rows);
    }
  }

  const confidenceAssetsByCaseKey = new Map();
  for (const row of tables.cases) {
    const caseId = row.case_id;
    const caseKey = atlasCaseKeyFor(row);
    const family = row.asset_family || '';
    if (!confidenceEnabledCaseFamily(family)) continue;
    const calibratedRows = family === 'RMDB2PDB'
      ? grouped.rmdbCalibratedByPdb.get(caseId) || []
      : raspCalibratedByPdb.get(caseId) || [];
    confidenceAssetsByCaseKey.set(caseKey, buildCaseConfidenceSidecars({
      atlasCaseKey: caseKey,
      caseId,
      pdbId: row.pdb_id || caseId,
      calibratedRows,
      memberships: grouped.memberships.get(caseKey) || [],
      tracks: grouped.tracks.get(caseKey) || [],
      pairs2d: grouped.pairs2d.get(caseKey) || [],
      colors3d: grouped.colors3d.get(caseKey) || [],
      generatedAt,
      source: {
        confidencePath: family === 'RMDB2PDB' && RMDB_ABC_LSS_ROOT ? path.join(RMDB_ABC_LSS_ROOT, 'out/abc_lss_confidence.tsv') : '',
        calibratedPath: family === 'RMDB2PDB'
          ? (RMDB_ABC_LSS_ROOT ? path.join(RMDB_ABC_LSS_ROOT, 'cal/abc_lss_calibrated.tsv') : '')
          : [
            RMDB_ABC_LSS_ROOT ? path.join(RMDB_ABC_LSS_ROOT, 'cal/abc_lss_calibrated.tsv') : '',
            firstExistingPath(raspDFamilyPaths.calibrated)
          ].filter(Boolean).join(';'),
        calibrationGatePath: family === 'RASP2PDB' ? firstExistingPath(raspDFamilyPaths.gate) : '',
        membershipsPath: path.join(ANNOJOIN_ROOT, TABLES.memberships),
        tracksPath: path.join(ANNOJOIN_ROOT, TABLES.tracks),
        pairContextPath: path.join(ANNOJOIN_ROOT, TABLES.pairs2d),
        structurePath: path.join(ANNOJOIN_ROOT, TABLES.colors3d),
      },
    }));
  }

  tables.cases = tables.cases.map((row) => {
    const caseKey = atlasCaseKeyFor(row);
    const confidenceAssets = confidenceAssetsByCaseKey.get(caseKey);
    if (!confidenceAssets || !confidenceEnabledCaseFamily(row.asset_family || '')) return row;
    const nextLabel = sourceConfidenceDisplayLabel(row, confidenceAssets);
    if (!nextLabel || nextLabel === row.confidence_display_label) return row;
    return {
      ...row,
      confidence_display_label: nextLabel,
      confidence_source: 'build_time_case_confidence_sidecar',
    };
  });

  // RASP case 若校准合并后仍是 "positive confidence not active" 回退标签，说明该 PDB
  // 没有可打分的反应性信号（无探针测定 / 反应性无坐标映射 / 输入超 size guard / 缺二级结构），
  // 两张校准表里都无证据行，没有 LSS 召回层级可展示。这类行从总表移除。
  // 对于同时存在 RMDB+RASP 的 PDB，移除其 RASP 原始行只是丢掉无信号的 RASP 臂，
  // 合并展示行退化为 RMDB-only（保留 RMDB 的真实 FEC 层级）。RMDB case 与已获真实
  // 层级的 RASP case 不受影响。
  const isRaspNotActive = (row) => (row.asset_family || '') === 'RASP2PDB'
    && /not active/i.test(row.confidence_display_label || '');
  const raspNotActiveRemoved = tables.cases.filter(isRaspNotActive).length;
  tables.cases = tables.cases.filter((row) => !isRaspNotActive(row));
  manifest.rasp_not_active_rows_removed = raspNotActiveRemoved;
  manifest.case_count = tables.cases.length;

  const index = buildAtlasIndexAsset({
    ...tables,
    chainIdentityIndex,
    generatedAt,
    source: {
      viewId: VIEW_ID,
      assetFamilies: VIEW_ASSET_FAMILIES,
      inputAnnojointRoot: ANNOJOIN_ROOT
    }
  });

  await writeJson('index.json', slimAtlasIndexForWrite(index), manifest);
  const compressedAssetsByPath = new Map();

  if (writePerCaseAssets) {
    for (const row of tables.cases) {
    const caseId = row.case_id;
    const caseKey = atlasCaseKeyFor(row);
    const family = row.asset_family || '';
    const useRmdbCaseIdFallback = !family || family === 'RMDB2PDB';
    const caseAsset = buildAtlasCaseAsset({
      caseId,
      caseKey,
      cases: tables.cases,
      summaries: tables.summaries,
      routes: tables.routes,
      memberships: grouped.memberships.get(caseKey) || [],
      tracks: grouped.tracks.get(caseKey) || [],
      pairs2d: grouped.pairs2d.get(caseKey) || [],
      lssContexts: grouped.lssContexts.get(caseKey) || (useRmdbCaseIdFallback ? grouped.lssContextsByCaseId.get(caseId) : []) || [],
      colors3d: grouped.colors3d.get(caseKey) || [],
      conflicts: grouped.conflicts.get(caseKey) || [],
      residueEvidence: grouped.residueEvidence.get(caseKey) || (useRmdbCaseIdFallback ? grouped.residueEvidenceByCaseId.get(caseId) : []) || [],
      chainIdentities: chainIdentityIndex.get((row.pdb_id || '').toUpperCase()) || []
    });
    const { routeAssetPages, ...overviewAsset } = caseAsset;
    const writeTasks = [
      () => writeJson(overviewAsset.case.caseAssetPath, overviewAsset, manifest, {
        compress: true,
        compressedAssetsByPath
      }),
      ...routeAssetPages.map((page) => () => writeJson(page.path, page.asset, manifest, {
        compress: true,
        compressedAssetsByPath
      })),
    ];
    if (confidenceEnabledCaseFamily(row.asset_family || '')) {
      const confidenceAssets = confidenceAssetsByCaseKey.get(caseKey);
      writeTasks.push(
        () => writeJson(overviewAsset.supplementalAssets.confidenceSummaryPath, confidenceAssets.summary, manifest, {
          compress: true,
          compressedAssetsByPath,
        }),
        () => writeJson(overviewAsset.supplementalAssets.confidenceEvidencePath, confidenceAssets.evidence, manifest, {
          compress: true,
          compressedAssetsByPath,
        }),
        () => writeJson(overviewAsset.supplementalAssets.confidenceProvenancePath, confidenceAssets.provenance, manifest, {
          compress: true,
          compressedAssetsByPath,
        }),
      );
    }
    await runWithConcurrency(writeTasks, DETAIL_ASSET_WRITE_CONCURRENCY);
    }
  } else {
    console.log('[build-annojoin-atlas] --index-only: skipped per-case asset writes (cases/*.json, route pages, confidence sidecars). Run `npm run build:annojoin-atlas` when case content changes.');
  }

  const detailRouteIndex = buildDetailRouteIndexAsset({
    generatedAt,
    source: {
      viewId: VIEW_ID,
      assetFamilies: VIEW_ASSET_FAMILIES,
      inputAnnojointRoot: ANNOJOIN_ROOT
    },
    cases: index.cases,
    displayCases: index.displayCases,
    compressedAssetsByPath
  });
  await writeJson('detail-route-index.json', detailRouteIndex, manifest, {
    compress: true,
    compressedAssetsByPath
  });

  await writeFile(path.join(OUT_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const totalBytes = manifest.assets.reduce((sum, row) => sum + row.size_bytes, 0);
  console.log(`[build-annojoin-atlas] ${tables.cases.length} cases, ${manifest.assets.length} assets, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
