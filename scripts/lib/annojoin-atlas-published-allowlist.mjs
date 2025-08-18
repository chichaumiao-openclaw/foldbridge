// 已发布详情页 allowlist：把总表收敛到“真的有发布页资产”的 case。
//
// 背景：ANNOJOIN atlas 总表会列出所有 displayCase，但详情页资产是由独立的
// v3 universe / AB v3 发布流水线按 case 生成的。两边数量对不齐时，总表里会出现
// 点进去 404 的行。本单元提供纯函数：从发布 allowlist（atlas_case_key 一列）
// 解析出已发布键集合，并据此过滤掉没有页资产的 case 行。
//
// allowlist 来源是 build report 的 built_case_keys（family:pdb，如 RASP2PDB:10FZ），
// 与 atlasCaseKeyFor(row) 输出同格式。由 scripts/build-annojoin-atlas-published-allowlist.mjs
// 生成为 checked-in TSV，构建时按环境变量加载。

import { atlasCaseKeyFor } from './annojoin-atlas-corpus.mjs';

function text(value) {
  return String(value ?? '').trim();
}

// 解析 allowlist TSV。首行为表头（含 atlas_case_key 列），其余每行取该列。
// 找不到表头列时回退到第一列。空行/纯空白行忽略。返回 Set<atlasCaseKey>。
export function parsePublishedCaseKeyAllowlist(tsv = '') {
  const allow = new Set();
  const lines = String(tsv ?? '').split(/\r?\n/);
  if (!lines.length) return allow;
  const header = lines[0].split('\t').map((cell) => text(cell));
  let keyColumn = header.indexOf('atlas_case_key');
  if (keyColumn < 0) keyColumn = 0;
  for (let i = 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!text(raw)) continue;
    const cells = raw.split('\t');
    const key = text(cells[keyColumn]);
    if (key) allow.add(key);
  }
  return allow;
}

// 过滤 case 行：只保留 atlasCaseKey 在 allowlist 内的行。
// allowlist 为空时视为“未配置”，原样返回所有行（applied=false），
// 避免在没有发布资产清单的开发构建里把整张表清空。
export function filterCasesToPublishedAllowlist(cases = [], allowlist = new Set()) {
  if (!(allowlist instanceof Set) || allowlist.size === 0) {
    return { kept: cases.slice(), removedCount: 0, applied: false };
  }
  const kept = [];
  let removedCount = 0;
  for (const row of cases) {
    if (allowlist.has(atlasCaseKeyFor(row))) {
      kept.push(row);
    } else {
      removedCount += 1;
    }
  }
  return { kept, removedCount, applied: true };
}
