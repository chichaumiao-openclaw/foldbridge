#!/usr/bin/env node
// entry 表 ∩ 已渲染详情页 的缺页交叉回报脚本。
//
// entry-table.json 有 17843 行 pdb×chain，每行通过 cases/<PDB>/index.html?chain=<auth>
// 链到静态详情页。但并非每个 entry 表里的 PDB 都一定被渲染出了页面（render build
// 期间可能跳过某些）。本脚本交叉核对：哪些 entry 表 PDB 没有对应的已渲染页面，
// 供人工决定是否补渲染或接受死链降级。
//
// 权威口径：built_case_keys（web-build-report.json 里的已渲染纯 PDB 列表，如 "10FZ"）
// 与 entry-table 的 pdb_id 逐字节精确匹配（PDB 大小写必须与 render 输出一致，不做大小写折叠）。
//
// 用法：
//   node scripts/report-entry-missing-pages.mjs \
//     --entry-table src/assets/generated/entry-table/entry-table.json \
//     --build-report <path/to/web-build-report.json> \
//     --out reports/entry-cases-missing-YYYYMMDD.tsv

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// 纯函数：聚合 entryRows（按 pdb_id 统计 distinct auth 链数），返回未在 builtPdbSet
// 中的 pdb_id 的 { pdbId, chainCount } 列表，按 pdbId 升序，绝不修改入参。
export function computeMissing(entryRows, builtPdbSet) {
  const chainsByPdb = new Map();
  for (const row of entryRows) {
    const pdbId = row.pdb_id;
    if (!chainsByPdb.has(pdbId)) chainsByPdb.set(pdbId, new Set());
    chainsByPdb.get(pdbId).add(row.auth);
  }
  const missing = [];
  for (const [pdbId, chains] of chainsByPdb) {
    if (builtPdbSet.has(pdbId)) continue;
    missing.push({ pdbId, chainCount: chains.size });
  }
  missing.sort((a, b) => (a.pdbId < b.pdbId ? -1 : a.pdbId > b.pdbId ? 1 : 0));
  return missing;
}

function parseArgs(argv) {
  const args = { entryTable: '', buildReport: '', out: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--entry-table') args.entryTable = argv[++i] || '';
    else if (flag === '--build-report') args.buildReport = argv[++i] || '';
    else if (flag === '--out') args.out = argv[++i] || '';
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.entryTable || !args.buildReport || !args.out) {
    console.error('usage: --entry-table <path> --build-report <path> --out <path>');
    process.exit(1);
  }

  const entryTable = JSON.parse(await readFile(args.entryTable, 'utf8'));
  const rows = entryTable.rows || [];

  const buildReport = JSON.parse(await readFile(args.buildReport, 'utf8'));
  const built = new Set(buildReport.built_case_keys || []);

  const missing = computeMissing(rows, built);

  const lines = ['pdbId\tchainCount\treason'];
  for (const m of missing) {
    lines.push(`${m.pdbId}\t${m.chainCount}\tno_rendered_page`);
  }
  await mkdir(path.dirname(args.out), { recursive: true });
  await writeFile(args.out, `${lines.join('\n')}\n`, 'utf8');

  process.stdout.write(`missing\t${missing.length}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
