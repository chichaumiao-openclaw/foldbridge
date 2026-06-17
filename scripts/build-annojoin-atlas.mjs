#!/usr/bin/env node
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import {
  buildAtlasCaseAsset,
  buildAtlasIndexAsset,
  groupByCaseId,
  parseTsv
} from './lib/annojoin-atlas-corpus.mjs';
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
const VISUAL_PREVIEW_ROWS_PER_CASE = Number(process.env.FOLDBRIDGE_ANNOJOIN_VISUAL_ROWS_PER_CASE || 48);

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

async function writeJson(relPath, data, manifest) {
  const fullPath = path.join(OUT_ROOT, relPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  const text = `${JSON.stringify(data)}\n`;
  await writeFile(fullPath, text);
  manifest.assets.push({
    path: relPath,
    size_bytes: Buffer.byteLength(text),
    row_count: Array.isArray(data) ? data.length : undefined
  });
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

  const tables = {};
  for (const name of Object.keys(TABLES)) {
    tables[name] = await readTable(name);
  }
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

  const generatedAt = new Date().toISOString();

  await rm(OUT_ROOT, { recursive: true, force: true });
  await mkdir(OUT_ROOT, { recursive: true });

  const manifest = {
    generated_at: generatedAt,
    input_annojoin_root: ANNOJOIN_ROOT,
    output_root: OUT_ROOT,
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
    structure_route_unique_paths: 0,
    structure_serving_mode: 'api_on_demand',
    assets: []
  };

  const structureRoutes = addStructureUrls(tables.colors3d);
  tables.colors3d = structureRoutes.rows;
  manifest.structure_route_unique_paths = structureRoutes.uniquePathCount;

  const index = buildAtlasIndexAsset({ ...tables, generatedAt });
  const grouped = {
    memberships: groupByCaseId(tables.memberships),
    tracks: groupByCaseId(tables.tracks),
    pairs2d: groupByCaseId(tables.pairs2d),
    colors3d: groupByCaseId(tables.colors3d),
    conflicts: groupByCaseId(tables.conflicts),
    lssContexts: groupByCaseId(tables.lssContexts),
    residueEvidence: groupByCaseId(tables.residueEvidence)
  };

  await writeJson('index.json', index, manifest);

  for (const row of tables.cases) {
    const caseId = row.case_id;
    const caseAsset = buildAtlasCaseAsset({
      caseId,
      cases: tables.cases,
      summaries: tables.summaries,
      routes: tables.routes,
      memberships: grouped.memberships.get(caseId) || [],
      tracks: grouped.tracks.get(caseId) || [],
      pairs2d: grouped.pairs2d.get(caseId) || [],
      lssContexts: grouped.lssContexts.get(caseId) || [],
      colors3d: grouped.colors3d.get(caseId) || [],
      conflicts: grouped.conflicts.get(caseId) || [],
      residueEvidence: grouped.residueEvidence.get(caseId) || []
    });
    const { routeAssetPages, ...overviewAsset } = caseAsset;
    await writeJson(`cases/${caseId}.json`, overviewAsset, manifest);
    for (const page of routeAssetPages) {
      await writeJson(page.path, page.asset, manifest);
    }
  }

  await writeFile(path.join(OUT_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const totalBytes = manifest.assets.reduce((sum, row) => sum + row.size_bytes, 0);
  console.log(`[build-annojoin-atlas] ${tables.cases.length} cases, ${manifest.assets.length} assets, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
