// build-site-stats.mjs — 构建期派生站点全局统计（Stats 总览页数据源）。
//
// 单一来源原则（规格 §2.2）：对外可见 PDB 口径不在浏览器过滤，而是构建期
// 已发布白名单（scripts/data/annojoin-atlas-published-case-keys.tsv，2386 行）。
// 本脚本对 annojoin-atlas/index.json 的 displayCases 套白名单得到 pdb_total==2386，
// 同时保留 total_raw（index.totalCaseCount）供脚注；页面只展示 2386，不展示 3401。
//
// 已发布 entry 相关统计均从白名单过滤后的 kept 集派生；PDB tier 和 RNA chain
// partition 则使用 Stats 页提供的聚合源表，避免混淆它们与 entry 口径数字。
//
// 纯 ESM：deriveStats 为纯函数（可被测试 import 而不触发写文件）；
// CLI 执行体用 import.meta.url 守卫包裹。

import fs from 'node:fs';
import path from 'node:path';

// RNA chain partitions supplied with the Stats-page source table. This is a chain-level
// distribution, intentionally distinct from the page's entry-level PDB statistics.
const RNA_CHAIN_PARTITIONS = {
  rRNA: 8794,
  tRNA: 3763,
  other_RNA: 1629,
  mRNA: 1544,
  ribozyme: 493,
  riboswitch: 492,
  snRNA: 489,
  viral: 304,
  aptamer: 128,
  synthetic_RNA: 92,
  SRP_RNA: 75,
  designed_RNA: 34
};

// PDB tier 分布（按 pdb_id 聚合，每个 PDB 取其全链中的最高 tier），来自 Stats 页源表。
const PDB_TIER_DISTRIBUTION = {
  high: 2689,
  low: 1210,
  not_supported: 1422
};

const DATA_SOURCE_DISTRIBUTION = {
  rasp: 3904,
  rmdb: 760
};

// entry_atlas.duckdb 固定统计（Stats 页展示值，不再引用 index.json）。
const PDB_TOTAL = 5321;
const MEASUREMENT_FAMILY_DISTRIBUTION = {
  base_specific: 5306,
  shape_flexibility: 5320,
  enzymatic_cleavage: 2206,
  solvent_accessibility: 1027,
  contact_mapping: 840
};

/**
 * 纯函数：返回站点统计（全部 entry_atlas 固定口径，不再引用 index.json/白名单）。
 * @returns {object} stats 对象（写入 stats.json）
 */
export function deriveStats() {
  return {
    pdb_total: PDB_TOTAL,
    probing_entries: 4664,
    high_confidence_entries: 510,
    strong_entries: 176,
    source_cases: PDB_TOTAL,
    families: 5,
    technologies: 26,
    articles: 26,
    pdb_tier_distribution: PDB_TIER_DISTRIBUTION,
    rna_chain_partitions: RNA_CHAIN_PARTITIONS,
    data_source_distribution: DATA_SOURCE_DISTRIBUTION,
    measurement_family_distribution: MEASUREMENT_FAMILY_DISTRIBUTION,
    technology_threshold_basis: {
      LITERATURE_SUPPORTED: 1,
      LITERATURE_INFORMED: 10,
      OPERATING_VALUE_PENDING_CALIBRATION: 23
    },
    provenance: {
      pdb_total: 'entry_atlas.duckdb entry table row count (fixed)',
      probing_entries: 'entry caliber: 4,664 chemical probing entries (RMDB 760 + RASP 3904), published PDB chains merged by biological molecule name',
      high_confidence_entries: 'entry caliber: 510 entries (RMDB 95 + RASP 415) with ≥1 constituent chain at STRONG or MODERATE',
      strong_entries: 'entry caliber: 176 entries (RMDB 82 + RASP 94) with ≥1 constituent chain at STRONG',
      source_cases: 'entry_atlas.duckdb entry total (fixed)',
      pdb_tier_distribution: 'PDB-ID caliber: each PDB takes the strongest tier among its chains (high 2,689; low 1,210; not supported 1,422; total 5,321)',
      rna_chain_partitions: 'chain caliber: annotated RNA partition counts supplied with the Statistics-page source table (total 17,837 chains)',
      data_source_distribution: 'entry caliber: chemical probing entries from RASP (3,904) and RMDB (760); total 4,664',
      measurement_family_distribution: 'published-PDB-entry caliber: entries containing each technique family A–E; categories can overlap within one entry',
      technologies: 'curated chemical-probing methods shown on the Statistics page (26)',
      families: 'curated measurement families shown on the Statistics page (A–E)',
      articles: 'probing-articles/index.json article_count'
    }
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

  const stats = deriveStats();

  const outDir = path.join(root, 'src/assets/generated/site-stats');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'stats.json');
  fs.writeFileSync(outPath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
  process.stdout.write(`[build-site-stats] wrote ${outPath}\n`);
  process.stdout.write(`[build-site-stats] pdb_total=${stats.pdb_total} pdb_tier_total=${Object.values(stats.pdb_tier_distribution).reduce((sum, value) => sum + value, 0)}\n`);
}
