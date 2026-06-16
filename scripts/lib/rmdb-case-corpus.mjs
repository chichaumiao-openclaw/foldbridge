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

/**
 * 把 bundle_profile_id 转为文件系统安全的 key：小写、非字母数字转 '-'、压缩重复 '-'、去首尾 '-'。
 */
export function slugifyProfileKey(profileId) {
  return String(profileId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 按 bundle_profile_id 分组反应性行，保留每组内原始行序。
 * 返回 [{ profileId, profileKey, rows }]，分组顺序按首次出现。
 */
export function groupReactivityByProfile(reacRows) {
  const order = [];
  const byId = new Map();
  for (const row of reacRows) {
    const id = row.bundle_profile_id ?? '';
    if (!byId.has(id)) {
      byId.set(id, []);
      order.push(id);
    }
    byId.get(id).push(row);
  }
  return order.map((id) => ({ profileId: id, profileKey: slugifyProfileKey(id), rows: byId.get(id) }));
}

function parseReactivity(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 由单个 profile 的反应性行构造轻量摘要：位置范围 + 降采样轨道预览（≤maxPoints 点）。
 */
export function buildReactivitySummary(rows, maxPoints = 64) {
  const points = rows.map((r) => ({
    pdbPos: Number(r.pdb_pos),
    pdbBase: r.pdb_base ?? '',
    reactivity: parseReactivity(r.reactivity)
  }));
  const positions = points.map((p) => p.pdbPos).filter((n) => Number.isFinite(n));
  const minPos = positions.length ? Math.min(...positions) : 0;
  const maxPos = positions.length ? Math.max(...positions) : 0;
  let trackPreview = points;
  if (points.length > maxPoints) {
    const step = (points.length - 1) / (maxPoints - 1);
    trackPreview = Array.from({ length: maxPoints }, (_, i) => points[Math.round(i * step)]);
  }
  return { minPos, maxPos, pointCount: points.length, trackPreview };
}

/**
 * 按固定 PDB position window 把单个 profile 的反应性行切片。
 * 返回 [{ start, end, rows }]，按 window 起点升序。
 */
export function sliceReactivityWindows(rows, windowSize = 100) {
  const byWindow = new Map();
  for (const row of rows) {
    const pos = Number(row.pdb_pos);
    if (!Number.isFinite(pos)) continue;
    const idx = Math.floor((pos - 1) / windowSize);
    if (!byWindow.has(idx)) byWindow.set(idx, []);
    byWindow.get(idx).push(row);
  }
  return [...byWindow.keys()].sort((a, b) => a - b).map((idx) => ({
    start: idx * windowSize + 1,
    end: (idx + 1) * windowSize,
    rows: byWindow.get(idx)
  }));
}

/**
 * 按固定页大小把 alignment 行分页。返回 [{ page, rows }]（page 从 1 起）。
 */
export function paginateAlignment(rows, pageSize = 25) {
  const pages = [];
  for (let i = 0; i < rows.length; i += pageSize) {
    pages.push({ page: pages.length + 1, rows: rows.slice(i, i + pageSize) });
  }
  return pages;
}

/**
 * 枚举 profile：以 provenance_index.tsv 的 bundle_profile_id 为粒度（去重，保留首次出现），
 * 经 bundle_sequence_id 关联 rmdb_sequence_members.tsv 取序列统计。
 * 探针类型等信息由 rdat_file 名承载，不依赖独立 modifier 列。
 */
export function buildProfiles({ provenance = [], members = [] }) {
  const memberBySeqId = new Map();
  for (const m of members) {
    if (!memberBySeqId.has(m.bundle_sequence_id)) memberBySeqId.set(m.bundle_sequence_id, m);
  }
  const seen = new Set();
  const out = [];
  for (const p of provenance) {
    const id = p.bundle_profile_id ?? '';
    if (seen.has(id)) continue;
    seen.add(id);
    const m = memberBySeqId.get(p.bundle_sequence_id);
    out.push({
      bundleProfileId: id,
      profileKey: slugifyProfileKey(id),
      bundleSequenceId: p.bundle_sequence_id || '',
      rmdbUniqueId: p.rmdb_unique_id || '',
      rdatFile: p.rdat_file || '',
      lineageId: p.lineage_id || '',
      releaseSourceId: p.release_source_id || '',
      sequenceLength: m ? toNumber(m.sequence_length) : 0,
      identityFraction: m ? toNumber(m.identity_fraction) : 0,
      rmdbQueryCoverage: m ? toNumber(m.rmdb_query_coverage) : 0,
      pdbSubjectCoverage: m ? toNumber(m.pdb_subject_coverage) : 0
    });
  }
  return out;
}
