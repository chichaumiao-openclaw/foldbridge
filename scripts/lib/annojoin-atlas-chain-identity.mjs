// 逐链 RNA 身份索引：为详情页按链展示真实身份提供数据。
//
// 纯函数单元，无 I/O。输入已解析的两张上游表行：
//   - declaredIdentityRows: PDB/04_pdb_metadata/pdb_rna_entity_chain_declared_identity.tsv
//       （全库 RNA 链作者声明身份：auth_asym_id / parent_rna_name / parent_rna_class
//        / sequence_length / declared_identity_phrase / struct_ref_*）
//   - governedRows: PDB/biological_layer/parent_child_pdb_map.tsv
//       （governed 链：display_label=URS + governance_state=final_identity）
// join 键：pdb_reference_id（如 8XT0_S1）。
// 输出：Map<pdbIdUpper, ChainIdentity[]>，每条链 verified 由 biological_layer 的
// final_identity 决定——绝不自行推断身份（红线：不猜）。

function asText(value) {
  return String(value ?? '').trim();
}

function isRnaChainRow(row = {}) {
  const polymerType = asText(row.polymer_type).toLowerCase();
  if (polymerType.includes('ribonucleotide')) return true;
  if (polymerType === 'rna') return true;
  return asText(row.is_rna_entity).toLowerCase() === 'true';
}

function governedRefIndex(governedRows = []) {
  const byRef = new Map();
  for (const row of governedRows) {
    const ref = asText(row.pdb_reference_id);
    if (!ref) continue;
    if (asText(row.governance_state) !== 'final_identity') continue;
    byRef.set(ref, {
      ursId: asText(row.display_label),
      registryObjectId: asText(row.registry_object_id),
    });
  }
  return byRef;
}

function genbankRef(row = {}) {
  const db = asText(row.struct_ref_db_name);
  const accession = asText(row.struct_ref_accession) || asText(row.struct_ref_db_code);
  return [db, accession].filter(Boolean).join(' ');
}

// 展示名的折叠基名：与 displayName 在 `|| ref` 兜底前所用的值一致。
function chainBaseName(row = {}) {
  return asText(row.declared_identity_phrase) || asText(row.parent_rna_name);
}

// 折叠键：仅小写 + 折叠内部空白。绝不词干化/去标点/套标题大小写。
function foldKeyOf(name) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

// 预扫描全库 RNA 链，按折叠键统计各精确拼写出现频次，
// 归约为 Map<foldKey, 规范拼写>。规范选择：频次最高，并列时 localeCompare 升序（确定性）。
function buildCanonicalByFoldKey(declaredIdentityRows = []) {
  const counts = new Map(); // foldKey -> Map<exactSpelling, count>
  for (const row of declaredIdentityRows) {
    if (!isRnaChainRow(row)) continue;
    const baseName = chainBaseName(row);
    if (!baseName) continue;
    const key = foldKeyOf(baseName);
    if (!counts.has(key)) counts.set(key, new Map());
    const spellings = counts.get(key);
    spellings.set(baseName, (spellings.get(baseName) || 0) + 1);
  }

  const canonical = new Map();
  for (const [key, spellings] of counts) {
    let bestSpelling = null;
    let bestCount = -1;
    for (const [spelling, count] of spellings) {
      if (
        count > bestCount ||
        (count === bestCount && spelling.localeCompare(bestSpelling) < 0)
      ) {
        bestSpelling = spelling;
        bestCount = count;
      }
    }
    canonical.set(key, bestSpelling);
  }
  return canonical;
}

export function buildChainIdentityIndex({ declaredIdentityRows = [], governedRows = [] } = {}) {
  const governedByRef = governedRefIndex(governedRows);
  const canonicalByFoldKey = buildCanonicalByFoldKey(declaredIdentityRows);
  const byPdb = new Map();

  for (const row of declaredIdentityRows) {
    if (!isRnaChainRow(row)) continue;
    const pdbId = asText(row.pdb_id).toUpperCase();
    const ref = asText(row.pdb_reference_id);
    if (!pdbId || !ref) continue;

    const governed = governedByRef.get(ref) || null;
    const chainId = asText(row.auth_asym_id) || asText(row.label_asym_id);
    const authorPhrase = asText(row.declared_identity_phrase);
    const parentRnaName = asText(row.parent_rna_name);

    // 展示名折叠（仅 displayName）：基名为 authorPhrase || parentRnaName。
    // 非空时用全库最高频拼写替换；为空则保留逐链 ref 兜底，不折叠。
    const baseName = authorPhrase || parentRnaName;
    const displayName = baseName
      ? (canonicalByFoldKey.get(foldKeyOf(baseName)) ?? baseName)
      : ref;

    const chain = {
      pdbReferenceId: ref,
      chainId,
      authAsymId: asText(row.auth_asym_id),
      labelAsymId: asText(row.label_asym_id),
      verified: Boolean(governed),
      ursId: governed ? governed.ursId : null,
      // verified: 权威展示名仍是作者短语（人类可读），URS 作为已验证外部 ID 并列。
      // unverified: 作者声明名，标注未验证。
      displayName,
      parentRnaName,
      rnaClass: asText(row.parent_rna_class),
      lengthNt: Number(asText(row.sequence_length)) || null,
      genbank: genbankRef(row),
      source: governed ? 'biological_layer:final_identity' : 'pdb_author_declared_identity',
    };

    if (!byPdb.has(pdbId)) byPdb.set(pdbId, []);
    byPdb.get(pdbId).push(chain);
  }

  for (const chains of byPdb.values()) {
    chains.sort((left, right) => {
      const verifiedDelta = Number(right.verified) - Number(left.verified);
      if (verifiedDelta !== 0) return verifiedDelta;
      return left.chainId.localeCompare(right.chainId);
    });
  }

  return byPdb;
}
