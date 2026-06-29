#!/usr/bin/env node
// build-rmdb-cases.mjs — 薄 IO 壳：读 JOIN 主表 + PUBLIC case 资产 → 经纯函数库构造 →
// 写 src/assets/generated/rmdb-pdb-cases/（轻量索引 + 大量小资产 + manifest）。
// 数据源为 build-time 本地输入；外接卷未挂载时报清晰错误并退出。

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseTsv,
  selectDisplayableCases,
  selectDisplayableChildren,
  buildIndexRow,
  buildChildIndexRow,
  groupReactivityByProfile,
  buildReactivitySummary,
  sliceReactivityWindows,
  paginateAlignment,
  buildProfiles,
  selectBestHitPair,
  buildCaseDetail,
  sha256Hex,
  classifyAssetSize
} from './lib/rmdb-case-corpus.mjs';
import { SAMPLE_CASE_IDS } from './lib/sample-case-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const JOIN_ROOT = process.env.RMDB_JOIN_ROOT
  || '/Volumes/tianyi/04_foldbridge_data/JOIN/database_center';
const PUBLIC_ROOT = process.env.RMDB_PUBLIC_ROOT
  || '/Volumes/tianyi/04_foldbridge_data/PUBLIC/rmdb2pdb_export_v3_fec_aligned_20260616_staging/cases';
const OUT_ROOT = path.resolve(__dirname, '../src/assets/generated/rmdb-pdb-cases');

const SCHEMA_VERSION = 'rmdb-pdb-cases.v2';
const SOURCE_PACKAGE_ID = 'rmdb2pdb_export_v3_fec_aligned_20260616_staging';
const REACTIVITY_WINDOW = 100;
const ALIGNMENT_PAGE = 25;

async function writeAsset(relPath, obj, manifest) {
  const full = path.join(OUT_ROOT, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  const buf = Buffer.from(JSON.stringify(obj), 'utf8');
  const size = buf.byteLength;
  const { ok, warning } = classifyAssetSize(size);
  if (!ok) {
    throw new Error(`[build-rmdb-cases] 资产 ${relPath} 为 ${size} 字节，触及 100MiB 硬上限，已中止。`);
  }
  await writeFile(full, buf);
  manifest.assets.push({
    path: relPath,
    size_bytes: size,
    sha256: sha256Hex(buf),
    large_asset_warning: warning
  });
  return size;
}

async function processCase(pdbId, linkRow, overview, manifest) {
  const caseDir = path.join(PUBLIC_ROOT, pdbId);
  const [caseJsonText, alignText, pairText, memberText, reacText, provText] = await Promise.all([
    readFile(path.join(caseDir, 'case.json'), 'utf8'),
    readFile(path.join(caseDir, 'alignment.tsv'), 'utf8'),
    readFile(path.join(caseDir, 'alignment_pair_summary.tsv'), 'utf8'),
    readFile(path.join(caseDir, 'rmdb_sequence_members.tsv'), 'utf8'),
    readFile(path.join(caseDir, 'pdb_axis_reactivity.tsv'), 'utf8'),
    readFile(path.join(caseDir, 'provenance_index.tsv'), 'utf8')
  ]);

  const publicCase = JSON.parse(caseJsonText);
  const alignmentRows = parseTsv(alignText);
  const pairRows = parseTsv(pairText);
  const memberRows = parseTsv(memberText);
  const reacRows = parseTsv(reacText);
  const provRows = parseTsv(provText);

  const indexRow = buildIndexRow(linkRow, overview);
  const profiles = buildProfiles({ provenance: provRows, members: memberRows });
  const bestPair = selectBestHitPair(pairRows);

  const rel = `cases/${pdbId}`;
  await writeAsset(`${rel}/profiles.json`, { pdbId, profiles }, manifest);

  const pages = paginateAlignment(alignmentRows, ALIGNMENT_PAGE);
  for (const pg of pages) {
    const name = String(pg.page).padStart(4, '0');
    await writeAsset(
      `${rel}/alignments/page-${name}.json`,
      { pdbId, page: pg.page, pageSize: ALIGNMENT_PAGE, rows: pg.rows },
      manifest
    );
  }

  const groups = groupReactivityByProfile(reacRows);
  const reactivityEntries = [];
  for (const g of groups) {
    const pk = g.profileKey || 'default';
    const summary = buildReactivitySummary(g.rows);
    await writeAsset(
      `${rel}/reactivity/${pk}/summary.json`,
      { pdbId, profileId: g.profileId, profileKey: pk, ...summary },
      manifest
    );
    const windows = sliceReactivityWindows(g.rows, REACTIVITY_WINDOW);
    const windowEntries = [];
    for (const w of windows) {
      const wRel = `${rel}/reactivity/${pk}/pdb-pos-${w.start}-${w.end}.json`;
      await writeAsset(
        wRel,
        { pdbId, profileId: g.profileId, profileKey: pk, start: w.start, end: w.end, rows: w.rows },
        manifest
      );
      windowEntries.push({ start: w.start, end: w.end, path: `reactivity/${pk}/pdb-pos-${w.start}-${w.end}.json` });
    }
    reactivityEntries.push({
      profileId: g.profileId,
      profileKey: pk,
      summaryPath: `reactivity/${pk}/summary.json`,
      windows: windowEntries
    });
  }

  const detail = buildCaseDetail({ publicCase, indexRow, bestPair, reactivityEntries, alignmentPageCount: pages.length });
  await writeAsset(`${rel}/case.json`, detail, manifest);

  return {
    ...indexRow,
    profileAssetCount: profiles.length,
    reactivityProfileCount: groups.length,
    alignmentPageCount: pages.length,
    caseAssetPath: `${rel}/case.json`
  };
}

async function main() {
  for (const [name, p] of [['RMDB_JOIN_ROOT', JOIN_ROOT], ['RMDB_PUBLIC_ROOT', PUBLIC_ROOT]]) {
    if (!existsSync(p)) {
      console.error(`[build-rmdb-cases] ${name} 不存在：${p}`);
      console.error('外接数据卷可能未挂载。请挂载数据卷或设置 RMDB_JOIN_ROOT / RMDB_PUBLIC_ROOT 后重试。');
      process.exit(1);
    }
  }

  // 读取三张 JOIN 表：parent_child（索引粒度）、child_detail_route（展示名）、link（聚合数据+detail assets）
  const parentChildRows = parseTsv(await readFile(path.join(JOIN_ROOT, 'biological_parent_child_pdb_confidence_index.tsv'), 'utf8'));
  const routeRows = parseTsv(await readFile(path.join(JOIN_ROOT, 'child_detail_route_index.tsv'), 'utf8'));
  const linkRows = parseTsv(await readFile(path.join(JOIN_ROOT, 'pdb_to_rmdb2pdb_export_link.tsv'), 'utf8'));
  const overviewRows = parseTsv(await readFile(path.join(JOIN_ROOT, 'pdb_case_overview_display_index_v1.tsv'), 'utf8'));

  // 索引：route by pdb_id, overview by pdb_id
  const routeByPdb = new Map(routeRows.map((r) => [r.pdb_id, r]));
  const overviewByPdb = new Map(overviewRows.map((r) => [r.pdb_id, r]));

  // link 聚合：同一 pdb_id 多 reference 的 profile/residue 合计
  const linkAggByPdb = new Map();
  for (const row of linkRows) {
    const pid = row.pdb_id;
    if (!linkAggByPdb.has(pid)) linkAggByPdb.set(pid, { profileCount: 0, residueCount: 0 });
    const agg = linkAggByPdb.get(pid);
    agg.profileCount += Number(row.filtered_profile_count) || 0;
    agg.residueCount += Number(row.filtered_residue_count) || 0;
  }

  // selectDisplayableCases for detail processing (legacy path for sample IDs)
  const displayable = selectDisplayableCases(linkRows);
  const linkByPdb = new Map(displayable.map((r) => [r.pdb_id, r]));

  await rm(OUT_ROOT, { recursive: true, force: true });
  await mkdir(OUT_ROOT, { recursive: true });

  const generatedAt = new Date().toISOString();
  const manifest = {
    source_package_id: SOURCE_PACKAGE_ID,
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    input_join_root: JOIN_ROOT,
    input_public_root: PUBLIC_ROOT,
    confidence_filter: ['high', 'medium', 'low'],
    sample_case_ids: SAMPLE_CASE_IDS,
    assets: []
  };

  // ── 全量索引：从 parent_child 表选出可显示 child → 构造索引行 ──
  const displayableChildren = selectDisplayableChildren(parentChildRows);
  const indexRows = displayableChildren.map((childRow) => {
    const pdbIds = (childRow.child_pdb_ids || '').split(';').filter(Boolean);
    const primaryPdb = pdbIds[0] || '';
    const routeRow = routeByPdb.get(primaryPdb) || null;
    const linkAgg = linkAggByPdb.get(primaryPdb) || null;
    return buildChildIndexRow(childRow, routeRow, linkAgg);
  });

  // ── 详情资产：仅为 SAMPLE_CASE_IDS 生成（full 生成过大，需渐进扩展） ──
  const detailCaseIds = new Set(SAMPLE_CASE_IDS);
  let detailCount = 0;
  for (const pdbId of detailCaseIds) {
    const linkRow = linkByPdb.get(pdbId);
    if (!linkRow) {
      console.warn(`[build-rmdb-cases] 样本 case ${pdbId} 在 link 表中不可显示，跳过详情生成。`);
      continue;
    }
    if (!existsSync(path.join(PUBLIC_ROOT, pdbId))) {
      console.warn(`[build-rmdb-cases] PUBLIC case 目录缺失：${pdbId}，跳过详情生成。`);
      continue;
    }
    await processCase(pdbId, linkRow, overviewByPdb.get(pdbId), manifest);
    detailCount++;
  }

  // 为有详情资产的 case 补充 caseAssetPath 到 index 行
  for (const row of indexRows) {
    if (detailCaseIds.has(row.pdbId)) {
      row.caseAssetPath = `cases/${row.pdbId}/case.json`;
      row.hasDetailAssets = true;
    } else {
      row.hasDetailAssets = false;
    }
  }

  await writeAsset('index.json', {
    source_package_id: SOURCE_PACKAGE_ID,
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    total_displayable: indexRows.length,
    detail_asset_count: detailCount,
    cases: indexRows
  }, manifest);

  await writeFile(path.join(OUT_ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const totalBytes = manifest.assets.reduce((sum, a) => sum + a.size_bytes, 0);
  const warnings = manifest.assets.filter((a) => a.large_asset_warning).length;
  console.log(`[build-rmdb-cases] 索引 ${indexRows.length} 个 case（全量），详情资产 ${detailCount} 个 case，${manifest.assets.length} 个资产，合计 ${(totalBytes / 1024 / 1024).toFixed(2)} MiB，large-asset 警告 ${warnings} 个。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
