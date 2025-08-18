// annojoin-atlas-profile-count-overlay.mjs — 用 case 页 profile-index 的权威 profile_count
// 覆盖 atlas index.json 的 profileCount。
//
// 背景：atlas index 的 profileCount 来自上游 membership 表去重后的 profile_id 数（如 2L1V=34），
// 但用户在 case 详情页看到的是 chains/<chain>/profiles/profile-index.json.gz 的 profile_count
// （映射到 strand 的全部 profile 行，如 2L1V=52）。详情页口径是对外权威值，
// 所以表格/侧栏展示必须与详情页一致。
//
// 纯函数：applyCasePageProfileCounts(index, countsByCaseKey) 不做 IO，可被测试直接 import。
// CLI 执行体（读 case 页 + 写回 index.json）在 build-annojoin-atlas-profile-counts.mjs。

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sourceKeysFor(row = {}) {
  if (Array.isArray(row.sourceCaseKeys) && row.sourceCaseKeys.length) return row.sourceCaseKeys;
  if (row.atlasCaseKey) return [row.atlasCaseKey];
  return [];
}

/**
 * 用 case 页 profile_count 覆盖 index 的 profileCount（就地修改 index 对象并返回）。
 * @param {object} index annojoin-atlas/index.json 对象（含 displayCases）
 * @param {Map<string,number>} countsByCaseKey atlasCaseKey -> case 页 profile_count
 * @param {object} [opts]
 * @param {boolean} [opts.returnStats] true 时返回 { index, patchedCount }
 * @returns {object} 默认返回 index；returnStats=true 返回 { index, patchedCount }
 */
export function applyCasePageProfileCounts(index = {}, countsByCaseKey = new Map(), opts = {}) {
  const counts = countsByCaseKey instanceof Map ? countsByCaseKey : new Map(Object.entries(countsByCaseKey || {}));
  const displayCases = Array.isArray(index.displayCases) ? index.displayCases : [];
  let patchedCount = 0;

  for (const row of displayCases) {
    // 先按 source 维度回填每个 source case 的真实 profile 数（合并行有多 source）。
    const entries = Array.isArray(row.sourceCaseAssetPaths) ? row.sourceCaseAssetPaths : [];
    for (const entry of entries) {
      const key = entry?.atlasCaseKey;
      if (key && counts.has(key)) entry.profileCount = counts.get(key);
    }

    // 行级 profileCount = 该行所有 source key 的 case 页计数之和（单源即单值）。
    const keys = sourceKeysFor(row);
    const present = keys.filter((k) => counts.has(k));
    if (!present.length) continue;
    const total = present.reduce((sum, k) => sum + numberOrZero(counts.get(k)), 0);
    row.profileCount = total;
    patchedCount += 1;
  }

  if (opts.returnStats) return { index, patchedCount };
  return index;
}
