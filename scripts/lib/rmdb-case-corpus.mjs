// RMDB→PDB case 语料构造纯函数库（build-time，无 fs 依赖，便于单测）。

/**
 * 解析 TSV 文本为 header 键控的对象数组。
 * - 制表符分隔，首行为表头
 * - 容忍结尾换行
 * - 保留空的尾随字段（用表头长度补齐）
 */
export function parseTsv(text) {
  const lines = String(text).split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row = {};
    header.forEach((key, i) => { row[key] = cells[i] ?? ''; });
    return row;
  });
}

// confidence_class 原始标签 → 站点分级标签
const CONFIDENCE_CLASS_MAP = {
  high_confidence: 'high',
  medium_confidence: 'medium',
  low_confidence: 'low'
};

/**
 * 仅保留 confidence_class ∈ {high,medium,low} 的 link 行，按 pdb_id 去重（保留首次出现）。
 */
export function selectDisplayableCases(linkRows) {
  const seen = new Set();
  const out = [];
  for (const row of linkRows) {
    if (!(row.confidence_class in CONFIDENCE_CLASS_MAP)) continue;
    if (seen.has(row.pdb_id)) continue;
    seen.add(row.pdb_id);
    out.push(row);
  }
  return out;
}

function pickTitle(overview, pdbId) {
  if (overview) {
    for (const key of ['display_name', 'pdb_struct_title', 'list_display_title', 'primary_display_title']) {
      const v = (overview[key] || '').trim();
      if (v) return v;
    }
  }
  return pdbId;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 由 link 行 + overview 行构造前端索引行（轻量，仅列表/筛选所需字段）。
 */
export function buildIndexRow(linkRow, overview) {
  const pdbId = linkRow.pdb_id;
  return {
    pdbId,
    pdbReferenceId: linkRow.pdb_reference_id || '',
    title: pickTitle(overview, pdbId),
    subtitle: overview ? (overview.display_subtitle || '').trim() : '',
    confidenceClass: CONFIDENCE_CLASS_MAP[linkRow.confidence_class] || 'low',
    confidenceScore: toNumber(linkRow.confidence_score),
    pairCount: toNumber(linkRow.filtered_pair_count),
    profileCount: toNumber(linkRow.filtered_profile_count),
    residueCount: toNumber(linkRow.filtered_residue_count),
    detailHref: `#pdb-case?pdbId=${pdbId}`
  };
}
