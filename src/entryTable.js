// entry 浏览入口表：纯数据/纯函数层（无 DOM、无 fetch）。
// 读 build-entry-table.py 产出的 entry-table.json（pdb_id x chain 粒度），
// 归一化为视图行，并按 base + pdb + chain 拼 case page 跳转链接（URL 规则占位）。

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

// 按 base + pdb + chain 拼 case page 链接。chain 参数用 auth（对齐 case page
// chains/<auth> 命名）。base 为占位常量，case page 机制就位后再定最终值。
// pdb 或 auth 缺失 → 返回空串（该行不可跳转，由视图层降级处理）。
export function entryCaseHref(base, row) {
  const pdb = text(row && row.pdbId);
  const chain = text(row && row.auth);
  if (!pdb || !chain) return '';
  const params = new URLSearchParams();
  params.set('pdb', pdb);
  params.set('chain', chain);
  return `${base}?${params.toString()}`;
}
