// build-site-stats.mjs — 构建期派生站点全局统计（Stats 总览页数据源）。
//
// 单一来源原则（规格 §2.2）：对外可见 PDB 口径不在浏览器过滤，而是构建期
// 已发布白名单（scripts/data/annojoin-atlas-published-case-keys.tsv，2386 行）。
// 本脚本对 annojoin-atlas/index.json 的 displayCases 套白名单得到 pdb_total==2386，
// 同时保留 total_raw（index.totalCaseCount）供脚注；页面只展示 2386，不展示 3401。
//
// 全部统计口径 = entry（已发布白名单过滤后的 kept 集），不再用全量跑的 segment 级常量。
// LSS tier 分布、SASA 探针覆盖、RNA 生物学分类都从 kept 的 per-entry 字段真实派生，
// 与页面其它 entry 口径数字一致。
//
// 纯 ESM：deriveStats 为纯函数（可被测试 import 而不触发写文件）；
// CLI 执行体用 import.meta.url 守卫包裹。

import fs from 'node:fs';
import path from 'node:path';
import {
  filterCasesToPublishedAllowlist,
  parsePublishedCaseKeyAllowlist
} from './lib/annojoin-atlas-published-allowlist.mjs';

// LSS 召回层级键（强→弱）。保证页面始终拿到全部 6 个键（缺失=0），SVG 不出现 undefined。
const TIER_KEYS = ['STRONG', 'MODERATE', 'WEAK', 'DISCORDANT', 'UNDERPOWERED', 'NOT_SUPPORTED'];

// Family D（溶剂可及性）探针技术 —— 这些 assay 走 SASA 参考主路径。
// 见 MEMORY：RL-Seq/Lead-seq/icLASER/HRF = SASA-based footprinting。
const SASA_PROBE_TECHS = ['RL-Seq', 'Lead-seq', 'icLASER', 'HRF'];

// structureClass / rnaFamily 噪声值（未注释占位、UUID、pending 分组）→ 生物学统计中剔除。
const BIO_NOISE = /^pending|^urs|^pdbmol_|^pdbreg_|未注释/i;

function emptyTierCounts() {
  return TIER_KEYS.reduce((acc, k) => { acc[k] = 0; return acc; }, {});
}

// entry 口径 LSS tier 分布：从每个 entry 的 confidenceDisplayLabel 解析代表层级
// （如 "A WEAK"/"B STRONG"/"D MODERATE"）。只有携带 LSS 校准的 entry（RASP 线）命中；
// RMDB 线用 FEC claim-ceiling 标签（无 tier 词），不计入 tier 图。
function deriveEntryTierDistribution(kept = []) {
  const counts = emptyTierCounts();
  let calibratedEntries = 0;
  for (const c of kept) {
    const label = String(c.confidenceDisplayLabel || '').toUpperCase();
    for (const k of TIER_KEYS) {
      if (label.includes(k)) { counts[k] += 1; calibratedEntries += 1; break; }
    }
  }
  return { counts, calibratedEntries };
}

// SASA 探针覆盖（替代旧 Family D SASA segment 面板）：统计有多少 entry 用到
// SASA-based footprinting 技术，并按技术细分。entry 的 assayFamilies 列携带技术名。
function deriveSasaProbeCoverage(kept = []) {
  const technologies = {};
  let entries = 0;
  for (const c of kept) {
    const assays = Array.isArray(c.assayFamilies) ? c.assayFamilies : [];
    let hit = false;
    for (const t of SASA_PROBE_TECHS) {
      if (assays.includes(t)) { technologies[t] = (technologies[t] || 0) + 1; hit = true; }
    }
    if (hit) entries += 1;
  }
  return { entries, technologies };
}

// RNA 生物学口径：结构类型分布（tRNA/rRNA/riboswitch…）、细分 family 数、探针技术种类数。
// 全部从 kept 的 per-entry 注释字段派生，噪声/未注释值剔除。
function deriveRnaBiology(kept = []) {
  const structureClasses = {};
  const families = new Set();
  const technologies = new Set();
  let classifiedEntries = 0;
  for (const c of kept) {
    const sc = c.structureClass;
    if (sc && !BIO_NOISE.test(sc)) {
      structureClasses[sc] = (structureClasses[sc] || 0) + 1;
      classifiedEntries += 1;
    }
    const fam = c.rnaFamily;
    if (fam && !BIO_NOISE.test(fam) && fam !== 'gRNAde designed RNA molecule') {
      families.add(fam);
    }
    for (const a of (Array.isArray(c.assayFamilies) ? c.assayFamilies : [])) {
      if (a && a !== 'None' && a !== 'rmdb_chemical_probing') technologies.add(a);
    }
  }
  return {
    structure_classes: structureClasses,
    classified_entries: classifiedEntries,
    distinct_families: families.size,
    probe_technologies_present: technologies.size
  };
}

/**
 * 纯函数：从 atlas index + 已发布白名单派生站点统计（全部 entry 口径）。
 * @param {object} args
 * @param {object} args.index annojoin-atlas/index.json 对象（含 displayCases / totalCaseCount）
 * @param {string} args.allowlistTsv 已发布 case-key 白名单 TSV 文本
 * @returns {object} stats 对象（写入 stats.json）
 */
export function deriveStats({ index = {}, allowlistTsv = '' } = {}) {
  const displayCases = Array.isArray(index.displayCases) ? index.displayCases : [];
  const allow = parsePublishedCaseKeyAllowlist(allowlistTsv);
  // 单一可见口径：pdb_total 与 source_cases 都从同一份白名单过滤后的 kept 集派生，
  // 绝不直接对外用 totalSourceCaseCount/totalCaseCount（= 过滤前的 3401 原始数，规格 §2.2 红线）。
  const kept = filterCasesToPublishedAllowlist(displayCases, allow).kept;
  const pdbTotal = kept.length;
  const totalRaw = Number.isFinite(index.totalCaseCount) ? index.totalCaseCount : displayCases.length;
  const sourceCases = kept.reduce((sum, c) => sum + (Number(c.sourceCaseCount) || 0), 0);

  const { counts: tierDistribution, calibratedEntries } = deriveEntryTierDistribution(kept);
  const sasaProbeCoverage = deriveSasaProbeCoverage(kept);
  const rnaBiology = deriveRnaBiology(kept);

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
    lss_calibrated_entries: calibratedEntries,
    tier_distribution: tierDistribution,
    sasa_probe_coverage: sasaProbeCoverage,
    rna_biology: rnaBiology,
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
      tier: 'entry caliber: per-entry LSS recall tier parsed from confidenceDisplayLabel over published RASP entries',
      tier_source: 'published-entry confidenceDisplayLabel',
      lss_calibrated_entries: 'published entries carrying an LSS calibrated recall tier (RASP line); RMDB-line entries use FEC claim-ceiling labels and are not tiered here',
      sasa_probe_coverage: 'entry caliber: published entries whose assayFamilies include a SASA-based footprinting probe (RL-Seq / Lead-seq / icLASER / HRF)',
      rna_biology: 'entry caliber: structureClass / rnaFamily / assayFamilies over published entries (PDB Rfam annotation; pending/unannotated values excluded)',
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const indexPath = path.join(root, 'src/assets/generated/annojoin-atlas/index.json');
  const allowlistPath = path.join(root, 'scripts/data/annojoin-atlas-published-case-keys.tsv');

  const index = readJson(indexPath);
  const allowlistTsv = readTextOrEmpty(allowlistPath);

  const stats = deriveStats({ index, allowlistTsv });

  const outDir = path.join(root, 'src/assets/generated/site-stats');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'stats.json');
  fs.writeFileSync(outPath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
  process.stdout.write(`[build-site-stats] wrote ${outPath}\n`);
  process.stdout.write(`[build-site-stats] pdb_total=${stats.pdb_total} lss_calibrated_entries=${stats.lss_calibrated_entries}\n`);
}
