#!/usr/bin/env node
// build-annojoin-atlas-technique-enrichment.mjs — 用 case 详情页的权威技术信息
// （confidence-evidence.json 的 rows[].technology / rows[].family）覆盖 atlas index.json
// 的 displayCase 行，追加 techniqueNames / techniqueFamilies。
//
// 权威源 = evidence（rows[].technology / rows[].family），绝不使用 assayFamilies
// 或 token 反解码。
//
// 流程（镜像 build-annojoin-atlas-profile-counts.mjs）：
//   1. 扫描发布准备目录下两套 case 页（RMDB pages / RASP 2275_pages）
//   2. 对每个 case 目录，读 confidence-evidence.json，聚合 distinct technology/family
//   3. 以 decode 后的 atlasCaseKey（如 RMDB2PDB:2L1V）为键，覆盖 index.json
//
// 纯函数 applyCaseTechniques 在 lib/annojoin-atlas-technique-overlay.mjs（已测试）。
//
// 用法：
//   node scripts/build-annojoin-atlas-technique-enrichment.mjs \
//     [--publish-root <dir>] [--index <index.json>]

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCaseTechniques } from './lib/annojoin-atlas-technique-overlay.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_PUBLISH_ROOT = path.resolve(__dirname, '../public');
const DEFAULT_INDEX = path.resolve(__dirname, '../src/assets/generated/annojoin-atlas/index.json');

// 两套 case 页相对仓内 public/ 根的路径。
const CASE_PAGE_ROOTS = [
  'rmdb-v3/cases',
  'rasp-v3/cases'
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

// 从单个 confidence-evidence.json 聚合 distinct 排序的 technology/family 集合。
// 缺 technology 或 family 的行按防御性方式跳过对应字段。
export function aggregateEvidenceTechniques(evidenceJson) {
  const names = new Set();
  const families = new Set();
  for (const row of (evidenceJson && evidenceJson.rows) || []) {
    if (row.technology) names.add(row.technology);
    if (row.family) families.add(row.family);
  }
  return { names: [...names].sort(), families: [...families].sort() };
}

// 扫描发布准备目录，返回 Map<atlasCaseKey, {names, families}>。
function collectTechniquesByCaseKey(publishRoot) {
  const byCaseKey = new Map();
  for (const rel of CASE_PAGE_ROOTS) {
    const root = path.join(publishRoot, rel);
    if (!existsSync(root)) continue;
    for (const dir of readdirSync(root)) {
      const evidencePath = path.join(root, dir, 'confidence-evidence.json');
      if (!existsSync(evidencePath)) continue;
      let evidence;
      try {
        evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
      } catch (_error) {
        // 损坏的单文件跳过，不中止整批。
        continue;
      }
      // 目录名形如 RMDB2PDB%3A2L1V → decode 为 RMDB2PDB:2L1V。
      byCaseKey.set(decodeURIComponent(dir), aggregateEvidenceTechniques(evidence));
    }
  }
  return byCaseKey;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const publishRoot = args.publishRoot || process.env.FOLDBRIDGE_PUBLISH_ROOT || DEFAULT_PUBLISH_ROOT;
  const indexPath = args.index || DEFAULT_INDEX;

  const techniques = collectTechniquesByCaseKey(publishRoot);
  process.stdout.write(`[technique-enrichment] read ${techniques.size} case-page technique sets from ${publishRoot}\n`);

  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  const { patchedCount } = applyCaseTechniques(index, techniques, { returnStats: true });

  writeFileSync(indexPath, `${JSON.stringify(index)}\n`, 'utf8');
  process.stdout.write(`[technique-enrichment] patched ${patchedCount} display rows in ${indexPath}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
