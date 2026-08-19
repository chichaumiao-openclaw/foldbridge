// entry 浏览入口表：纯数据/纯函数层（无 DOM、无 fetch）。
// 读 build-entry-table.py 产出的 entry-table.json（pdb_id x chain 粒度），
// 归一化为视图行，并拼指向静态 case 页 cases/<PDB>/index.html?chain=<auth> 的跳转链接。

// 展示列顺序（源自论文 Fig 2C：molecule / PDB / chain / profiles / technique /
// confidence / class / source）。锁死列序。
export const ENTRY_TABLE_COLUMNS = [
  { id: 'pdbId', label: 'PDB' },
  { id: 'auth', label: 'Chain' },
  { id: 'sciName', label: 'Molecule' },
  { id: 'partition', label: 'RNA class' },
  { id: 'probingCategory', label: 'Technique' },
  { id: 'nProfiles', label: 'Profiles' },
  { id: 'confidenceClass', label: 'Confidence' },
  { id: 'sourceLanes', label: 'Source' }
];

function text(value) {
  return String(value ?? '').trim();
}

export function normalizeEntryRows(payload) {
  const rows = payload && Array.isArray(payload.rows) ? payload.rows : [];
  return rows.map((row) => ({
    pdbId: text(row.pdb_id),
    auth: text(row.auth),
    chainKey: text(row.chain_key),
    sciName: text(row.sci_name),
    partition: text(row.partition),
    nProfiles: Number(row.n_profiles) || 0,
    confidenceClass: text(row.entry_confidence_class),
    probingCategory: text(row.probing_category),
    sourceLanes: text(row.source_lanes),
    hasGeo: text(row.has_geo)
  }));
}

// entry 行 → 静态 case 页链接。PDB 进路径段（对齐 render shell 输出 cases/<PDB>/），
// chain(auth) 作 query（对齐 bundle chains/<auth>）。pdb 或 auth 缺失 → 空串（不可跳）。
export function entryCaseHref(base, row) {
  const pdb = text(row && row.pdbId);
  const chain = text(row && row.auth);
  if (!pdb || !chain) return '';
  return `#entry-case?pdb=${encodeURIComponent(pdb)}&chain=${encodeURIComponent(chain)}`;
}

// 稳定 slug：小写、非字母数字折成单个连字符、去首尾连字符。用于折叠分组的稳定 id。
export function entryGroupSlug(label = '') {
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'na';
}

// 两层折叠分组：外层 partition(RNA class)，内层 sciName(分子名)。
// chain 行全保留、不漏行、不改行内容——只是把已有归一化行按现有字段包进分组结构。
// 空 partition → 'Unclassified RNA'；空 sciName → 回退到 partition label。
// 排序：parent/child 按 label 升序，组内行按 pdbId→auth 升序（稳定、确定，避免部署 churn）。
export function buildEntryTableGroups(rows = []) {
  const parentMap = new Map();
  for (const row of rows) {
    const parentLabel = text(row.partition) || 'Unclassified RNA';
    const childLabel = text(row.sciName) || parentLabel;
    const parentId = entryGroupSlug(parentLabel);
    const childId = `${parentId}::${entryGroupSlug(childLabel)}`;
    if (!parentMap.has(parentId)) {
      parentMap.set(parentId, { id: parentId, label: parentLabel, count: 0, children: new Map() });
    }
    const parent = parentMap.get(parentId);
    if (!parent.children.has(childId)) {
      parent.children.set(childId, { id: childId, parentId, label: childLabel, count: 0, rows: [] });
    }
    const child = parent.children.get(childId);
    child.rows.push(row);
    child.count += 1;
    parent.count += 1;
  }

  const byLabel = (a, b) => String(a.label).localeCompare(String(b.label));
  const byRow = (a, b) =>
    String(a.pdbId).localeCompare(String(b.pdbId)) || String(a.auth).localeCompare(String(b.auth));

  return [...parentMap.values()]
    .sort(byLabel)
    .map((parent) => ({
      ...parent,
      children: [...parent.children.values()]
        .sort(byLabel)
        .map((child) => ({ ...child, rows: [...child.rows].sort(byRow) }))
    }));
}
