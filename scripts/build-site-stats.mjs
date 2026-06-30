// build-site-stats.mjs — 构建期派生站点全局统计（Stats 总览页数据源）。
//
// 单一来源原则（规格 §2.2）：对外可见 PDB 口径不在浏览器过滤，而是构建期
// 已发布白名单（scripts/data/annojoin-atlas-published-case-keys.tsv，2386 行）。
// 本脚本对 annojoin-atlas/index.json 的 displayCases 套白名单得到 pdb_total==2386，
// 同时保留 total_raw（index.totalCaseCount）供脚注；页面只展示 2386，不展示 3401。
//
// tier 分布：若提供校准表行（calibration），按真实行派生并标注
// `calibration-table <date>`；否则回退到 run-record 2026-06-27 常量并标注。
//
// 纯 ESM：deriveStats 为纯函数（可被测试 import 而不触发写文件）；
// CLI 执行体用 import.meta.url 守卫包裹。

import fs from 'node:fs';
import path from 'node:path';
import {
  filterCasesToPublishedAllowlist,
  parsePublishedCaseKeyAllowlist
} from './lib/annojoin-atlas-published-allowlist.mjs';

// 回退常量（run-record 2026-06-27，见 MEMORY 全量跑记录）。
// 校准表不可读时使用，stats.json 标注来源。
const FALLBACK_TIER_DISTRIBUTION = {
  STRONG: 284,
  MODERATE: 1189,
  WEAK: 18677,
  DISCORDANT: 33876,
  UNDERPOWERED: 50062,
  NOT_SUPPORTED: 114550
};
const FALLBACK_FAMILY_D_SASA = {
  SASA_PRESENT: 8417,
  PAIRING_PROXY_FALLBACK: 1812
};
const RUN_RECORD_LABEL = 'run-record 2026-06-27';

// 计数表骨架：保证页面始终拿到全部 6 个 tier 键（缺失=0），SVG 不会出现 undefined。
const TIER_KEYS = ['STRONG', 'MODERATE', 'WEAK', 'DISCORDANT', 'UNDERPOWERED', 'NOT_SUPPORTED'];

// 校准表 lss_tier_calibrated 值（LSS_ 前缀）→ 页面 tier 键。
// LSS_MODERATE_CANDIDATE 归并入 MODERATE（未校准上限的候选也是 moderate 级展示）。
function tierKeyFromCalibrated(raw = '') {
  const v = String(raw || '').trim().toUpperCase().replace(/^LSS_/, '');
  if (v === 'MODERATE_CANDIDATE') return 'MODERATE';
  if (TIER_KEYS.includes(v)) return v;
  return null;
}

function emptyTierCounts() {
  return TIER_KEYS.reduce((acc, k) => { acc[k] = 0; return acc; }, {});
}

function deriveTierDistribution(rmdbAbcRows = []) {
  const counts = emptyTierCounts();
  for (const row of rmdbAbcRows) {
    const key = tierKeyFromCalibrated(row.lss_tier_calibrated);
    if (key) counts[key] += 1;
  }
  return counts;
}

function deriveFamilyDSasa(raspDRows = []) {
  const counts = { SASA_PRESENT: 0, PAIRING_PROXY_FALLBACK: 0 };
  for (const row of raspDRows) {
    const v = String(row.sasa_reference_status || '').trim().toUpperCase();
    if (v in counts) counts[v] += 1;
  }
  return counts;
}

/**
 * 纯函数：从 atlas index + 已发布白名单（+ 可选校准行）派生站点统计。
 * @param {object} args
 * @param {object} args.index annojoin-atlas/index.json 对象（含 displayCases / totalCaseCount）
 * @param {string} args.allowlistTsv 已发布 case-key 白名单 TSV 文本
 * @param {object} [args.calibration] 校准行（可选）：
 *   { rmdbAbcRows:[{lss_tier_calibrated}], raspDRows:[{sasa_reference_status}], source }
 * @returns {object} stats 对象（写入 stats.json）
 */
export function deriveStats({ index = {}, allowlistTsv = '', calibration = null } = {}) {
  const displayCases = Array.isArray(index.displayCases) ? index.displayCases : [];
  const allow = parsePublishedCaseKeyAllowlist(allowlistTsv);
  // 单一可见口径：pdb_total 与 source_cases 都从同一份白名单过滤后的 kept 集派生，
  // 绝不直接对外用 totalSourceCaseCount/totalCaseCount（= 过滤前的 3401 原始数，规格 §2.2 红线）。
  const kept = filterCasesToPublishedAllowlist(displayCases, allow).kept;
  const pdbTotal = kept.length;
  const totalRaw = Number.isFinite(index.totalCaseCount) ? index.totalCaseCount : displayCases.length;
  const sourceCases = kept.reduce((sum, c) => sum + (Number(c.sourceCaseCount) || 0), 0);

  const hasCalibration = !!(calibration
    && (Array.isArray(calibration.rmdbAbcRows) && calibration.rmdbAbcRows.length));
  const tierDistribution = hasCalibration
    ? deriveTierDistribution(calibration.rmdbAbcRows)
    : { ...FALLBACK_TIER_DISTRIBUTION };
  const familyDSasa = hasCalibration && Array.isArray(calibration.raspDRows) && calibration.raspDRows.length
    ? deriveFamilyDSasa(calibration.raspDRows)
    : { ...FALLBACK_FAMILY_D_SASA };
  const tierSource = hasCalibration
    ? (calibration.source || 'calibration-table')
    : RUN_RECORD_LABEL;

  return {
    pdb_total: pdbTotal,
    probing_entries: 4664,
    high_confidence_entries: 510,
    strong_entries: 176,
    total_raw: totalRaw,
    source_cases: sourceCases,
    families: 6,
    technologies: 34,
    articles: 27,
    tier_distribution: tierDistribution,
    family_d_sasa: familyDSasa,
    technology_threshold_basis: {
      LITERATURE_SUPPORTED: 1,
      LITERATURE_INFORMED: 10,
      OPERATING_VALUE_PENDING_CALIBRATION: 23
    },
    provenance: {
      pdb_total: 'annojoin-atlas/index.json displayCases ∩ published allowlist (scripts/data/annojoin-atlas-published-case-keys.tsv)',
      probing_entries: 'entry caliber: 4,664 chemical probing entries (RMDB 760 + RASP 3904), published PDB chains merged by biological molecule name',
      high_confidence_entries: 'entry caliber: 510 entries (RMDB 95 + RASP 415) with ≥1 constituent chain at STRONG or MODERATE',
      strong_entries: 'entry caliber: 176 entries (RMDB 82 + RASP 94) with ≥1 constituent chain at STRONG',
      source_cases: 'visible-caliber sum of sourceCaseCount over published-allowlist-filtered displayCases (NOT totalSourceCaseCount)',
      total_raw: `internal metadata only — pre-filter raw displayCase count (${totalRaw}); never rendered as a user-facing number`,
      tier: hasCalibration
        ? `RMDB ABC LSS calibrated tiers, ${tierSource}`
        : `RMDB ABC LSS calibrated tiers, ${RUN_RECORD_LABEL}`,
      tier_source: tierSource,
      family_d_sasa: hasCalibration
        ? `RASP Family D SASA reference status, ${tierSource}`
        : `RASP Family D SASA reference status, ${RUN_RECORD_LABEL}`,
      technologies: 'probe_confidence_method_registry.tsv (34 RNA probe technologies)',
      families: 'probing-articles/index.json family_count + A–F measurement families',
      articles: 'probing-articles/index.json article_count'
    }
  };
}

// --- CLI helpers (only invoked under the import.meta.url guard) ---

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readTextOrEmpty(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

// 读取一张校准 TSV 为对象数组（按表头）。不可读 → null。
function readCalibrationTsv(p) {
  let text;
  try {
    text = fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (lines.length < 2) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i] ?? ''; });
    return row;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const indexPath = path.join(root, 'src/assets/generated/annojoin-atlas/index.json');
  const allowlistPath = path.join(root, 'scripts/data/annojoin-atlas-published-case-keys.tsv');
  const rmdbCalPath = '/Volumes/tianyi/foldbridgeAssessert/confidence注册表/RMDB_ABC_LSS/cal/abc_lss_calibrated.tsv';
  const raspCalPath = '/Volumes/tianyi/foldbridgeAssessert/confidence注册表/RASP_D_LSS/cal/def_lss_calibrated.tsv';

  const index = readJson(indexPath);
  const allowlistTsv = readTextOrEmpty(allowlistPath);

  const rmdbAbcRows = readCalibrationTsv(rmdbCalPath);
  const raspDRows = readCalibrationTsv(raspCalPath);
  const calibration = (rmdbAbcRows && rmdbAbcRows.length)
    ? { rmdbAbcRows, raspDRows: raspDRows || [], source: 'calibration-table 2026-06-27' }
    : null;

  const stats = deriveStats({ index, allowlistTsv, calibration });

  const outDir = path.join(root, 'src/assets/generated/site-stats');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'stats.json');
  fs.writeFileSync(outPath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
  process.stdout.write(`[build-site-stats] wrote ${outPath}\n`);
  process.stdout.write(`[build-site-stats] pdb_total=${stats.pdb_total} tier_source=${stats.provenance.tier_source}\n`);
}
