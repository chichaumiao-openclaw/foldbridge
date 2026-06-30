#!/usr/bin/env node
// 生成已发布详情页 allowlist TSV。
//
// 扫描发布准备目录下所有 web-build-report.json，取其 built_case_keys（family:pdb），
// 合并去重后写出一列 atlas_case_key 的 TSV。该 TSV 由 build-annojoin-atlas 在构建时
// 加载，用于把总表收敛到“真的有发布页资产”的 case，避免点进 404。
//
// 用法：
//   node scripts/build-annojoin-atlas-published-allowlist.mjs \
//     [--publish-root <dir>] [--out <tsv>]
//
// 默认 publish-root = /Volumes/tianyi/foldbridgeAssessert/发布准备
// 默认 out = scripts/data/annojoin-atlas-published-case-keys.tsv

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { publishRoot: '', out: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--publish-root') args.publishRoot = argv[++i] || '';
    else if (flag === '--out') args.out = argv[++i] || '';
  }
  return args;
}

const DEFAULT_PUBLISH_ROOT = '/Volumes/tianyi/foldbridgeAssessert/发布准备';
const DEFAULT_OUT = path.resolve(__dirname, 'data/annojoin-atlas-published-case-keys.tsv');

// 递归找出所有 web-build-report.json。
async function findBuildReports(root) {
  const found = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (_error) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name === 'web-build-report.json') {
        found.push(full);
      }
    }
  }
  await walk(root);
  return found.sort();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const publishRoot = args.publishRoot || process.env.FOLDBRIDGE_PUBLISH_ROOT || DEFAULT_PUBLISH_ROOT;
  const outPath = args.out || DEFAULT_OUT;

  if (!existsSync(publishRoot)) {
    console.error(`[allowlist] publish root not found: ${publishRoot}`);
    process.exit(1);
  }

  const reports = await findBuildReports(publishRoot);
  if (!reports.length) {
    console.error(`[allowlist] no web-build-report.json under ${publishRoot}`);
    process.exit(1);
  }

  // atlas_case_key -> set of source report relpaths (审计追溯).
  const keyToSources = new Map();
  for (const reportPath of reports) {
    let report;
    try {
      report = JSON.parse(await readFile(reportPath, 'utf8'));
    } catch (error) {
      console.error(`[allowlist] skip unreadable report ${reportPath}: ${error.message}`);
      continue;
    }
    const keys = Array.isArray(report.built_case_keys) ? report.built_case_keys : [];
    const rel = path.relative(publishRoot, reportPath);
    for (const key of keys) {
      const trimmed = String(key ?? '').trim();
      if (!trimmed) continue;
      if (!keyToSources.has(trimmed)) keyToSources.set(trimmed, new Set());
      keyToSources.get(trimmed).add(rel);
    }
    console.error(`[allowlist] ${String(keys.length).padStart(6)} keys  ${rel}`);
  }

  const sortedKeys = [...keyToSources.keys()].sort();
  const lines = ['atlas_case_key\tsource_reports'];
  for (const key of sortedKeys) {
    const sources = [...keyToSources.get(key)].sort().join(';');
    lines.push(`${key}\t${sources}`);
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${lines.join('\n')}\n`, 'utf8');
  console.error(`[allowlist] wrote ${sortedKeys.length} published case keys -> ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
