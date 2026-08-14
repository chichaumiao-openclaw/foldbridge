// annojoin-atlas-technique-overlay.mjs — 用发布态的技术富化信息（technique families/names）
// 覆盖 atlas index.json 的 displayCase 行。
//
// 纯函数：applyCaseTechniques(index, techniquesByCaseKey, opts) 不做 IO，可被测试直接 import。
// 只追加技术名称、Probing 五类和原始测量家族，绝不触碰既有字段（如 profileCount）。
// 幂等 pure-append（§2.4）。match key = sourceKeysFor(row)（镜像 profile-count overlay）。

function sortedUnique(list) {
  return [...new Set((list || []).filter(Boolean))].sort();
}

// mirrors annojoin-atlas-profile-count-overlay.mjs: merged rows use sourceCaseKeys.
function sourceKeysFor(row = {}) {
  if (Array.isArray(row.sourceCaseKeys) && row.sourceCaseKeys.length) return row.sourceCaseKeys;
  if (row.atlasCaseKey) return [row.atlasCaseKey];
  return [];
}

export function applyCaseTechniques(index = {}, techniquesByCaseKey = new Map(), opts = {}) {
  const map = techniquesByCaseKey instanceof Map
    ? techniquesByCaseKey
    : new Map(Object.entries(techniquesByCaseKey || {}));
  let patchedCount = 0;
  for (const displayCase of index.displayCases || []) {
    const keys = sourceKeysFor(displayCase);
    const present = keys.filter((k) => map.has(k));
    if (!present.length) continue;
    const families = present.flatMap((k) => map.get(k).families || []);
    const names = present.flatMap((k) => map.get(k).names || []);
    const measurementFamilies = present.flatMap((k) => map.get(k).measurementFamilies || []);
    displayCase.techniqueFamilies = sortedUnique(families);
    displayCase.techniqueNames = sortedUnique(names);
    displayCase.measurementFamilies = sortedUnique(measurementFamilies);
    patchedCount += 1;
  }
  if (opts.returnStats) return { index, patchedCount };
  return index;
}
