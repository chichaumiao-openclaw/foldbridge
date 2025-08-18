#!/usr/bin/env node
// build-annojoin-atlas-profile-counts.mjs — 用 case 详情页的权威 profile_count 覆盖
// atlas index.json 的 profileCount。
//
// 背景：atlas index 的 profileCount 来自上游 membership 表去重后的 profile_id 数（如 2L1V=34），
// 但用户在 case 详情页看到的是 chains/<chain>/profiles/profile-index.json.gz 的 profile_count
// 之和（映射到 strand 的全部 profile 行，如 2L1V=52）。详情页是对外权威口径，
// 总表/侧栏的 Profile hits 必须与详情页一致。
//
// 流程：
//   1. 扫描发布准备目录下两套 case 页（RMDB pages / RASP 2275_pages）
//   2. 对每个 case 目录，求 chains/*/profiles/profile-index.json.gz 的 profile_count 之和
//   3. 以 decode 后的 atlasCaseKey（如 RMDB2PDB:2L1V）为键，覆盖 index.json
//
// 纯函数 applyCasePageProfileCounts 在 lib/annojoin-atlas-profile-count-overlay.mjs（已测试）。
//
// 用法：
//   node scripts/build-annojoin-atlas-profile-counts.mjs \
//     [--publish-root <dir>] [--index <index.json>]

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCasePageProfileCounts } from './lib/annojoin-atlas-profile-count-overlay.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_PUBLISH_ROOT = '/Volumes/tianyi/foldbridgeAssessert/发布准备';
const DEFAULT_INDEX = path.resolve(__dirname, '../src/assets/generated/annojoin-atlas/index.json');

// 两套 case 页相对发布准备根的路径。
const CASE_PAGE_ROOTS = [
  'rmdb2pdb_ab_v3_launch_132_centered/20260628T193700Z_retry/pages/cases',
  'rasp2pdb_v3_universe_20260629/2275_pages/cases'
];

function parseArgs(argv) {
  const args = { publishRoot: '', index: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--publish-root') args.publishRoot = argv[++i] || '';
    else if (flag === '--index') args.index = argv[++i] || '';
  }
  return args;
}

// 读单个 case 目录所有链的 profile_count 之和。读不到任何链 → null（跳过，不污染计数）。
function caseProfileCount(caseDir) {
  const chainsDir = path.join(caseDir, 'chains');
  if (!existsSync(chainsDir)) return null;
  let total = 0;
  let sawAny = false;
  for (const chain of readdirSync(chainsDir)) {
    const f = path.join(chainsDir, chain, 'profiles', 'profile-index.json.gz');
    if (!existsSync(f)) continue;
    try {
      const j = JSON.parse(gunzipSync(readFileSync(f)).toString('utf8'));
      total += Number(j.profile_count) || 0;
      sawAny = true;
    } catch (_error) {
      // 损坏的单文件跳过，不中止整批。
    }
  }
  return sawAny ? total : null;
}

// 扫描发布准备目录，返回 Map<atlasCaseKey, profile_count>。
function buildCountsByCaseKey(publishRoot) {
  const counts = new Map();
  for (const rel of CASE_PAGE_ROOTS) {
    const root = path.join(publishRoot, rel);
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      const total = caseProfileCount(path.join(root, dir));
      if (total === null) continue;
      // 目录名形如 RMDB2PDB%3A2L1V → decode 为 RMDB2PDB:2L1V。
      counts.set(decodeURIComponent(dir), total);
    }
  }
  return counts;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const publishRoot = args.publishRoot || process.env.FOLDBRIDGE_PUBLISH_ROOT || DEFAULT_PUBLISH_ROOT;
  const indexPath = args.index || DEFAULT_INDEX;

  const counts = buildCountsByCaseKey(publishRoot);
  process.stdout.write(`[profile-counts] read ${counts.size} case-page profile counts from ${publishRoot}\n`);

  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  const before = (index.displayCases || []).find((c) => c.atlasCaseKey === 'RMDB2PDB:2L1V');
  const { patchedCount } = applyCasePageProfileCounts(index, counts, { returnStats: true });
  const after = (index.displayCases || []).find((c) => c.atlasCaseKey === 'RMDB2PDB:2L1V');

  writeFileSync(indexPath, `${JSON.stringify(index)}\n`, 'utf8');
  process.stdout.write(`[profile-counts] patched ${patchedCount} display rows in ${indexPath}\n`);
  if (before && after) {
    process.stdout.write(`[profile-counts] 2L1V profileCount ${before.profileCount} -> ${after.profileCount}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
