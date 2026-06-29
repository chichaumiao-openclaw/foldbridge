export const ANNOJOIN_ATLAS_SCHEMA_VERSION = 'annojoin-atlas.v1';
export const ANNOJOIN_ATLAS_VERSION = 'V2.1_RMDB_LINE_A_20260617';
export const DEFAULT_ROUTE_PAGE_SIZE = 500;
export const DEFAULT_ROUTE_PREVIEW_SIZE = 8;
export const DEFAULT_VISUAL_PREVIEW_SIZE = 48;

export function parseTsv(text) {
  const [headerLine, ...lines] = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  if (!headerLine) return [];
  const header = headerLine.split('\t');
  return lines
    .filter((line) => line.length > 0)
    .map((line) => {
      const cells = line.split('\t');
      return Object.fromEntries(header.map((key, index) => [key, cells[index] ?? '']));
    });
}

function text(value) {
  return String(value ?? '').trim();
}

function truthy(value) {
  return ['true', '1', 'yes', 'y'].includes(text(value).toLowerCase());
}

function numberOrZero(value) {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberOrNull(value) {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value) {
  return text(value).split(';').map((item) => item.trim()).filter(Boolean);
}

function assetFamily(row = {}) {
  return text(row.asset_family || row.assetFamily);
}

export function atlasCaseKeyFor(row = {}) {
  const explicit = text(row.atlasCaseKey || row.atlas_case_key);
  if (explicit) return explicit;
  const family = assetFamily(row);
  const caseId = text(row.case_id || row.caseId);
  const pdbId = text(row.pdb_id || row.pdbId) || caseId;
  if (family && (pdbId || caseId)) return `${family}:${pdbId || caseId}`;
  return caseId || pdbId;
}

function casePathSegment(caseKey = '') {
  return encodeURIComponent(text(caseKey));
}

function caseAssetPathFor(row = {}) {
  const explicit = text(row.caseAssetPath || row.case_asset_path);
  if (explicit) return explicit;
  return `cases/${casePathSegment(atlasCaseKeyFor(row))}.json`;
}

function previewProfiles(value) {
  return splitList(value).filter((profileId) => (
    !profileId.startsWith('bundle_')
    && !profileId.startsWith('rmdbv3_exact_')
  ));
}

function normalizeRdatPath(pathValue = '') {
  const parts = text(pathValue).split('/').filter(Boolean);
  if (parts.length >= 3 && parts[0] === parts[1]) parts.splice(0, 1);
  return parts.join('/');
}

function profileTraceFromProfileId(profileId = '', { pairId = '', routeId = '' } = {}) {
  const value = text(profileId);
  if (!value || value.startsWith('rmdbv3_exact_')) return null;
  const rdatMatch = value.match(/(.+?\.rdat)#([^|#]+)/i);
  if (rdatMatch) {
    const rdatPath = normalizeRdatPath(rdatMatch[1]);
    const lineValue = Number(rdatMatch[2]);
    return {
      pairId: text(pairId),
      profileId: value,
      traceType: Number.isFinite(lineValue) ? 'rdat_line' : 'rdat_record',
      rdatPath,
      rdatFile: rdatPath.split('/').pop() || rdatPath,
      ...(Number.isFinite(lineValue) ? { rdatLine: lineValue } : { rdatRecord: rdatMatch[2] }),
      routeId: text(routeId)
    };
  }
  return {
    pairId: text(pairId),
    profileId: value,
    traceType: 'route_profile_id',
    routeId: text(routeId)
  };
}

function normalizeProfileTraceEntry(row = {}) {
  if (row.traceType || row.rdatPath || row.rdatFile || row.rdatLine || row.rdatRecord) {
    const rdatPath = normalizeRdatPath(row.rdatPath || row.rdat_path);
    return {
      pairId: text(row.pairId || row.pair_id),
      profileId: text(row.profileId || row.profile_id),
      traceType: text(row.traceType || row.trace_type),
      rdatPath,
      rdatFile: text(row.rdatFile || row.rdat_file || rdatPath.split('/').pop()),
      ...(numberOrNull(row.rdatLine ?? row.rdat_line) ? { rdatLine: numberOrNull(row.rdatLine ?? row.rdat_line) } : {}),
      ...(text(row.rdatRecord || row.rdat_record) ? { rdatRecord: text(row.rdatRecord || row.rdat_record) } : {}),
      routeId: text(row.routeId || row.route_id || row.track_route_id)
    };
  }
  return profileTraceFromProfileId(row.profileId || row.profile_id, {
    pairId: row.pairId || row.pair_id,
    routeId: row.routeId || row.route_id || row.track_route_id
  });
}

function buildProfileTracePreview(rows = [], maxEntries = DEFAULT_ROUTE_PREVIEW_SIZE) {
  const traces = [];
  const seen = new Set();
  for (const row of rows || []) {
    const trace = normalizeProfileTraceEntry(row);
    if (!trace) continue;
    const key = [trace.pairId, trace.rdatPath || trace.profileId, trace.rdatLine || trace.rdatRecord || ''].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    traces.push(trace);
    if (traces.length >= maxEntries) break;
  }
  return traces;
}

function uniqueOrdered(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values || []) {
    const item = text(value);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function familyDisplayLabel(family = '') {
  const normalized = text(family).toUpperCase();
  if (normalized.includes('RMDB')) return 'RMDB';
  if (normalized.includes('RASP')) return 'RASP';
  return text(family).replace(/2PDB$/i, '') || 'source';
}

function compactConfidenceLabel(row = {}) {
  const value = text(row.confidenceDisplayLabel || row.confidence_display_label);
  if (!value) return 'not annotated';
  if (/positive confidence not active/i.test(value)) return 'not active';
  const classes = uniqueOrdered([...value.matchAll(/\b([ABCD])_[A-Z0-9_]+/g)].map((match) => match[1]))
    .sort((a, b) => 'ABCD'.indexOf(a) - 'ABCD'.indexOf(b));
  if (classes.length) return classes.join('/');
  const firstSegment = value.split(';').map((part) => part.trim()).find(Boolean);
  return firstSegment || value;
}

function mergedConfidenceLabel(rows = []) {
  const byFamily = new Map();
  for (const row of rows) {
    const family = familyDisplayLabel(row.assetFamily);
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(compactConfidenceLabel(row));
  }
  return [...byFamily.entries()]
    .map(([family, labels]) => `${family}: ${uniqueOrdered(labels).join(', ')}`)
    .join('; ');
}

function displayMoleculeName(row = {}) {
  return text(row.biologicalMoleculeName || row.pdbMoleculeName || row.childClassLabel || row.parentClassLabel || row.pdbId || row.caseId);
}

function representativeScore(row = {}) {
  const family = text(row.assetFamily);
  const name = displayMoleculeName(row);
  const nameSource = text(row.biologicalMoleculeNameSource || row.pdbMoleculeNameSource).toLowerCase();
  const sourceScore = nameSource.includes('author') || nameSource.includes('pdb_author_entity_description') ? 0 : 1;
  const familyScore = family === 'RMDB2PDB' ? 0 : family === 'RASP2PDB' ? 1 : 2;
  const lengthScore = name.length && name.length <= 240 ? 0 : 1;
  return [familyScore, sourceScore, lengthScore, name.length || 999999, text(row.atlasCaseKey)];
}

function compareRepresentativeRows(a = {}, b = {}) {
  const left = representativeScore(a);
  const right = representativeScore(b);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

function sourceCaseDescriptor(row = {}) {
  return {
    assetFamily: text(row.assetFamily),
    familyLabel: familyDisplayLabel(row.assetFamily),
    atlasCaseKey: text(row.atlasCaseKey),
    caseId: text(row.caseId),
    pdbId: text(row.pdbId),
    caseAssetPath: text(row.caseAssetPath),
    detailRouteId: text(row.detailRouteId),
    recommendedDefaultPreset: text(row.recommendedDefaultPreset),
    moleculeName: displayMoleculeName(row),
    confidenceDisplayLabel: text(row.confidenceDisplayLabel),
    compactConfidenceLabel: compactConfidenceLabel(row),
    profileCount: numberOrZero(row.profileCount),
    chains: row.chains || []
  };
}

function tracePreviewKey(entry = {}) {
  return [
    text(entry.pairId),
    text(entry.rdatPath || entry.profileId),
    text(entry.rdatLine || entry.rdatRecord || entry.routeId)
  ].join('|');
}

function mergeTracePreviews(rows = []) {
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    for (const trace of row.profileTracePreview || []) {
      const key = tracePreviewKey(trace);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trace);
      if (out.length >= DEFAULT_ROUTE_PREVIEW_SIZE) return out;
    }
  }
  return out;
}

function displayGroupKey(row = {}) {
  return text(row.pdbId || row.caseId || row.atlasCaseKey);
}

// 分子展示名的折叠键：小写 + 折叠内部空白 + 展开受控 RNA 缩写。
// Q2 红线（覆盖此前 never-fabricate）：rRNA/RRNA→ribosomal RNA、tRNA/mRNA 等
// 一并强制为标准全称全名，即使语料只出现缩写也强制展开；并把全大写/异常大小写的
// 全称（如 5S RIBOSOMAL RNA）归一成标准展示大小写（5S ribosomal RNA）。
// 数字前缀/限定词（25S、(Phe)、(1584-MER)）原样保留，绝不词干化/去标点。
const MOLECULE_MISSING_LABELS = new Set(['', '未注释', 'not annotated', 'missing source']);

// 受控 RNA 缩写词典：键=缩写（小写），值=标准展示全称（大小写即最终展示拼写）。
const RNA_ABBREVIATIONS = [
  ['rrna', 'ribosomal RNA'],
  ['trna', 'transfer RNA'],
  ['mrna', 'messenger RNA'],
  ['sgrna', 'single guide RNA'],
  ['grna', 'guide RNA'],
  ['snorna', 'small nucleolar RNA'],
  ['snrna', 'small nuclear RNA'],
  ['crrna', 'CRISPR RNA']
];

// 折叠键用：在已小写、空白折叠后的文本上，把整词缩写替换为「小写全称」，
// 使「25S rRNA」「25S RIBOSOMAL RNA」「25s ribosomal rna」落到同一键。
// 整词边界保证 sgrna 不被 grna 误匹配、crrna/rrna 不匹配 tracrrna 内部。
const RNA_FOLD_PATTERNS = RNA_ABBREVIATIONS.map(([abbr, full]) => [
  new RegExp(`\\b${abbr}\\b`, 'g'),
  full.toLowerCase()
]);

// 展示归一用：①缩写（任意大小写）→ 标准全称；②已是全称但大小写异常者
// （如 RIBOSOMAL RNA）→ 标准全称大小写。只动 RNA 术语本身，前缀/限定词不动。
const RNA_DISPLAY_PATTERNS = [];
for (const [abbr, full] of RNA_ABBREVIATIONS) {
  RNA_DISPLAY_PATTERNS.push([new RegExp(`\\b${abbr}\\b`, 'gi'), full]);
  const fullPattern = full.replace(/\s+/g, '\\s+');
  RNA_DISPLAY_PATTERNS.push([new RegExp(`\\b${fullPattern}\\b`, 'gi'), full]);
}

function expandRnaAbbreviations(loweredText = '') {
  let out = loweredText;
  for (const [pattern, full] of RNA_FOLD_PATTERNS) {
    out = out.replace(pattern, full);
  }
  return out;
}

// 受控核糖体 Svedberg 系数集合：仅这些值的「<n>S RNA」会被补全为「<n>S ribosomal RNA」。
// 科学红线：SRP RNA（4.5S / 7S）与核糖体亚基（30S / 50S / 70S）绝不在此集合内，
// 避免把信号识别颗粒 RNA 或亚基误标成 rRNA。bare「<n>S」（无 RNA 词）也不展开（保守）。
const RIBOSOMAL_SVEDBERG = '5\\.8|5|12|16|18|21|23|25|26|28';
const RIBOSOMAL_SVEDBERG_FOLD = new RegExp(`(?<![\\d.])(${RIBOSOMAL_SVEDBERG})s rna\\b`, 'g');
const RIBOSOMAL_SVEDBERG_DISPLAY = new RegExp(`(?<![\\d.])(${RIBOSOMAL_SVEDBERG})s\\s+rna\\b`, 'gi');

// 折叠键用：把「16s rna」补成「16s ribosomal rna」，使其与「16s rRNA」「16s ribosomal RNA」同键。
function expandRibosomalSvedberg(loweredText = '') {
  return loweredText.replace(RIBOSOMAL_SVEDBERG_FOLD, '$1s ribosomal rna');
}

// 把展示拼写里的 RNA 术语强制归一成标准全称（覆盖语料拼写）。
// 下划线视作分隔符（如 16S_rRNA、30S_delta…）归一成空格，再展开 RNA 术语。
function canonicalizeDisplaySpelling(value = '') {
  let out = text(value).replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [pattern, full] of RNA_DISPLAY_PATTERNS) {
    out = out.replace(pattern, full);
  }
  out = out.replace(RIBOSOMAL_SVEDBERG_DISPLAY, (match, svedberg) => `${svedberg}S ribosomal RNA`);
  return out;
}

// RASP 的 biological_molecule_name 是 pipe 复合串「molecule | structure_title | organism」。
// 展示/分组只取首段（真正的分子名）；raw 复合串原样保留在 biologicalMoleculeName 字段。
function moleculeLeadingSegment(value = '') {
  const raw = text(value);
  if (!raw.includes('|')) return raw;
  for (const part of raw.split('|')) {
    const seg = part.trim();
    if (seg) return seg;
  }
  return raw;
}

function moleculeBaseName(row = {}) {
  const bio = text(row.biologicalMoleculeName);
  if (bio && !MOLECULE_MISSING_LABELS.has(bio)) return moleculeLeadingSegment(bio);
  const pdb = text(row.pdbMoleculeName);
  if (pdb && !MOLECULE_MISSING_LABELS.has(pdb)) return moleculeLeadingSegment(pdb);
  return '';
}

function moleculeFoldKey(name = '') {
  const base = text(name).toLowerCase().replace(/[_\s]+/g, ' ').trim();
  // Svedberg/abbreviation expansion runs first because "5.8s" carries a dot that
  // the trailing punctuation collapse would otherwise split into "5 8s".
  const expanded = expandRibosomalSvedberg(expandRnaAbbreviations(base));
  // Collapse remaining punctuation last so spacing/hyphen variants share one key
  // (e.g. "single-guide RNA" == "single guide RNA", "HCV-IRES" == "HCV IRES").
  return expanded.replace(/[^0-9a-z]+/g, ' ').trim();
}

// 语料级 canonical 映射：按折叠键归并；同键下选代表拼写（出现次数最高，计数相同
// 按码点升序，跨运行时/locale 确定性），再对代表拼写强制展开/归一 RNA 术语。
// 代表拼写只决定前缀/限定词的大小写（25S / (Phe)），RNA 术语一律强制标准全称。
function buildCanonicalSpellingMap(values = []) {
  const byKey = new Map();
  for (const value of values) {
    const base = text(value);
    if (!base || MOLECULE_MISSING_LABELS.has(base)) continue;
    const key = moleculeFoldKey(base);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, new Map());
    const variants = byKey.get(key);
    variants.set(base, (variants.get(base) || 0) + 1);
  }
  const canonical = new Map();
  for (const [key, variants] of byKey) {
    let best = '';
    let bestCount = -1;
    for (const [spelling, count] of variants) {
      // 种子 best='' / bestCount=-1 安全：真实 count 恒 ≥1，首个条目必经 count>bestCount 胜出。
      if (count > bestCount || (count === bestCount && spelling < best)) {
        best = spelling;
        bestCount = count;
      }
    }
    canonical.set(key, canonicalizeDisplaySpelling(best));
  }
  return canonical;
}

function canonicalSpelling(canonicalMap, value) {
  const base = text(value);
  if (!base || MOLECULE_MISSING_LABELS.has(base)) return base;
  return canonicalMap.get(moleculeFoldKey(base)) ?? canonicalizeDisplaySpelling(base);
}

function buildMoleculeCanonicalMap(normalizedCases = []) {
  return buildCanonicalSpellingMap(normalizedCases.map(moleculeBaseName));
}


function buildDisplayCases(sourceCases = []) {
  const grouped = new Map();
  for (const row of sourceCases) {
    const key = displayGroupKey(row);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const displayRows = [];
  for (const [pdbKey, rows] of grouped.entries()) {
    if (rows.length === 1) {
      const row = rows[0];
      displayRows.push({
        ...row,
        sourceCaseCount: 1,
        sourceFamilies: uniqueOrdered([row.assetFamily]),
        sourceCaseKeys: uniqueOrdered([row.atlasCaseKey]),
        sourceCaseAssetPaths: [sourceCaseDescriptor(row)]
      });
      continue;
    }

    const representative = [...rows].sort(compareRepresentativeRows)[0];
    const chains = uniqueOrdered(rows.flatMap((row) => row.chains || []));
    const sourceFamilies = uniqueOrdered(rows.map((row) => row.assetFamily));
    const sourceCaseKeys = rows.map((row) => text(row.atlasCaseKey)).filter(Boolean);
    const sourceCaseAssetPaths = rows.map(sourceCaseDescriptor);
    const profilePreview = uniqueOrdered(rows.flatMap((row) => row.profilePreview || [])).slice(0, DEFAULT_ROUTE_PREVIEW_SIZE);
    const searchTerms = uniqueOrdered([
      pdbKey,
      representative.searchText,
      representative.biologicalMoleculeName,
      representative.pdbMoleculeName,
      ...rows.flatMap((row) => [
        row.searchText,
        row.atlasCaseKey,
        row.assetFamily,
        row.biologicalMoleculeName,
        row.pdbMoleculeName,
        row.confidenceDisplayLabel
      ])
    ]);
    displayRows.push({
      ...representative,
      assetFamily: '',
      sourceLine: '',
      caseUid: `PDB|${pdbKey}`,
      atlasCaseKey: `PDB:${pdbKey}`,
      caseId: pdbKey,
      pdbId: pdbKey,
      caseAssetPath: '',
      routeId: `annojoin:display:pdb:${pdbKey}`,
      detailRouteId: '',
      recommendedDefaultPreset: '',
      isMergedDisplayRow: true,
      sourceCaseCount: rows.length,
      sourceFamilies,
      sourceCaseKeys,
      sourceCaseAssetPaths,
      chains,
      sourceDatabases: uniqueOrdered(rows.flatMap((row) => row.sourceDatabases || [])),
      assayFamilies: uniqueOrdered(rows.flatMap((row) => row.assayFamilies || [])),
      profileCount: rows.reduce((sum, row) => sum + numberOrZero(row.profileCount), 0),
      profilePreview,
      profilePreviewIsComplete: rows.every((row) => row.profilePreviewIsComplete),
      profileTracePreview: mergeTracePreviews(rows),
      confidenceDisplayLabel: mergedConfidenceLabel(rows),
      confidenceSource: 'source_case_confidence_summary',
      conflictCandidateCount: rows.reduce((sum, row) => sum + numberOrZero(row.conflictCandidateCount), 0),
      hasContextAnnotation: rows.some((row) => row.hasContextAnnotation),
      hasLssAnnotation: rows.some((row) => row.hasLssAnnotation),
      searchText: searchTerms.join(' ')
    });
  }
  return displayRows;
}

export function groupByCaseId(rows) {
  const grouped = new Map();
  for (const row of rows || []) {
    const caseId = text(row.case_id);
    if (!caseId) continue;
    if (!grouped.has(caseId)) grouped.set(caseId, []);
    grouped.get(caseId).push(row);
  }
  return grouped;
}

export function groupByAtlasCaseKey(rows) {
  const grouped = new Map();
  for (const row of rows || []) {
    const caseKey = atlasCaseKeyFor(row);
    if (!caseKey) continue;
    if (!grouped.has(caseKey)) grouped.set(caseKey, []);
    grouped.get(caseKey).push(row);
  }
  return grouped;
}

// Task 13：上游对没有真实生物学分类的 case 会塞占位标签——RASP raw-hit 桶
// （parent="RASP public current" / child="raw-hit case"，source PUBLIC/RASP/raw_hit_cases_current）
// 以及治理待定项（"pending parent display group ..." 等，source governance_context_display_name）。
// 这些占位标签会造出假的父/子分组。把它们当作缺失（置空），让 parentGroupLabel/childGroupLabel
// 的回退链落到 moleculeDisplayName。只动 display-only 派生标签，raw *Source provenance 不碰。
const PLACEHOLDER_CLASS_LABEL_PATTERNS = [
  /^rasp public current$/i,
  /^raw-?hit case$/i,
  /^pending\b/i
];
const PLACEHOLDER_CLASS_SOURCES = new Set(['PUBLIC/RASP/raw_hit_cases_current']);

function isPlaceholderClassLabel(label = '', source = '') {
  const value = text(label);
  if (!value) return false;
  if (PLACEHOLDER_CLASS_LABEL_PATTERNS.some((pattern) => pattern.test(value))) return true;
  return PLACEHOLDER_CLASS_SOURCES.has(text(source));
}

function cleanClassLabel(label = '', source = '') {
  return isPlaceholderClassLabel(label, source) ? '' : text(label);
}

function normalizeCase(row = {}) {
  const caseId = text(row.case_id);
  const caseKey = atlasCaseKeyFor(row);
  return {
    assetFamily: assetFamily(row),
    sourceLine: text(row.source_line || row.sourceLine),
    evidenceNamespace: text(row.evidence_namespace || row.evidenceNamespace),
    sourceAssetRoot: text(row.source_asset_root || row.sourceAssetRoot),
    sourcePublicRoot: text(row.source_public_root || row.sourcePublicRoot),
    publicCaseStatus: text(row.public_case_status || row.publicCaseStatus),
    caseUid: text(row.case_uid),
    atlasCaseKey: caseKey,
    caseId,
    pdbId: text(row.pdb_id),
    chains: splitList(row.pdb_chain_ids),
    parentClassLabel: cleanClassLabel(row.parent_class_label, row.parent_class_source),
    parentClassSource: text(row.parent_class_source),
    childClassLabel: cleanClassLabel(row.child_class_label, row.child_class_source),
    childClassSource: text(row.child_class_source),
    biologicalMoleculeName: text(row.biological_molecule_name),
    biologicalMoleculeNameSource: text(row.biological_molecule_name_source),
    pdbMoleculeName: text(row.pdb_molecule_name),
    pdbMoleculeNameSource: text(row.pdb_molecule_name_source),
    confidenceDisplayLabel: text(row.confidence_display_label),
    confidenceSource: text(row.confidence_source),
    sourceDatabases: splitList(row.source_databases),
    assayFamilies: splitList(row.assay_family_set),
    rnaFamily: text(row.rna_family_label),
    rnaFamilyProvenance: text(row.rna_family_provenance),
    motif: text(row.motif_label),
    motifProvenance: text(row.motif_provenance),
    structureClass: text(row.structure_class_label),
    structureClassProvenance: text(row.structure_class_provenance),
    profilePreview: previewProfiles(row.profilePreview || row.profile_ids),
    profileCount: numberOrZero(row.profile_count),
    profilePreviewIsComplete: truthy(row.profile_ids_complete),
    profileMembershipRouteId: text(row.profile_membership_route_id),
    profileTracePreview: buildProfileTracePreview(row.profileTracePreview),
    fecClaimCeilingDistribution: text(row.fec_claim_ceiling_distribution),
    coverageShapeDistribution: text(row.coverage_shape_distribution),
    conflictCandidateCount: numberOrZero(row.conflict_candidate_count),
    hasContextAnnotation: truthy(row.has_context_annotation),
    hasLssAnnotation: truthy(row.has_lss_annotation),
    searchText: text(row.search_text),
    routeId: text(row.route_id),
    caseAssetPath: caseAssetPathFor({ ...row, atlasCaseKey: caseKey })
  };
}

function caseDisplayLabel(row = {}) {
  return text(
    row.biologicalMoleculeName
      || row.pdbMoleculeName
      || row.rnaFamily
      || row.structureClass
      || row.motif
      || row.pdbId
      || row.caseId
  );
}

function parentBucketLabel(row = {}) {
  const parent = text(row.parentClassLabel);
  if (parent && parent !== '未注释') return parent;
  return text(row.childClassLabel) || caseDisplayLabel(row);
}

function childBucketLabel(row = {}) {
  const child = text(row.childClassLabel);
  if (child && child !== '未注释') return child;
  return caseDisplayLabel(row);
}

function bucketId(label = '') {
  return text(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'unclassified';
}

function buildCaseHierarchy(cases = []) {
  const parents = new Map();
  for (const row of cases) {
    const parentLabel = parentBucketLabel(row);
    const childLabel = childBucketLabel(row);
    const parentId = bucketId(parentLabel);
    const childId = bucketId(`${parentLabel}-${childLabel}`);
    if (!parents.has(parentId)) {
      parents.set(parentId, {
        id: parentId,
        label: parentLabel,
        source: text(row.parentClassSource || row.childClassSource || row.biologicalMoleculeNameSource || row.pdbMoleculeNameSource),
        caseCount: 0,
        children: new Map()
      });
    }
    const parent = parents.get(parentId);
    parent.caseCount += 1;
    if (!parent.children.has(childId)) {
      parent.children.set(childId, {
        id: childId,
        label: childLabel,
        source: text(row.childClassSource || row.biologicalMoleculeNameSource || row.pdbMoleculeNameSource),
        caseCount: 0,
        cases: []
      });
    }
    const child = parent.children.get(childId);
    child.caseCount += 1;
    child.cases.push(row.atlasCaseKey || row.caseId);
  }

  return [...parents.values()]
    .map((parent) => ({
      ...parent,
      children: [...parent.children.values()]
        .sort((a, b) => b.caseCount - a.caseCount || a.label.localeCompare(b.label))
    }))
    .sort((a, b) => b.caseCount - a.caseCount || a.label.localeCompare(b.label));
}

function normalizeFacet(row = {}) {
  return {
    name: text(row.facet_name),
    label: text(row.display_label || row.facet_name),
    sourceTable: text(row.source_table),
    sourceColumn: text(row.source_column),
    group: text(row.facet_group)
  };
}

function normalizePreset(row = {}) {
  return {
    id: text(row.preset_id),
    name: text(row.preset_name || row.preset_id),
    description: text(row.preset_description),
    filterExpression: text(row.filter_expression),
    requiredAnnotationTables: splitList(row.required_annotation_tables),
    isDefault: truthy(row.is_default),
    userEditable: truthy(row.user_editable),
    warningText: text(row.warning_text)
  };
}

function normalizeDownload(row = {}) {
  return {
    id: text(row.download_id),
    label: text(row.download_label || row.download_id),
    sourceTables: text(row.source_tables),
    filterExpression: text(row.filter_expression),
    filePath: text(row.file_path),
    fileFormat: text(row.file_format),
    rowCount: numberOrZero(row.row_count),
    sha256: text(row.sha256)
  };
}

function normalizeSummary(row = {}) {
  return {
    profileCount: numberOrZero(row.profile_count),
    pairCount: numberOrZero(row.pair_count),
    residueEvidenceCount: numberOrZero(row.residue_evidence_count),
    recommendedDefaultPreset: text(row.recommended_default_preset),
    summaryRouteId: text(row.summary_route_id)
  };
}

function normalizeRoute(row = {}) {
  return {
    detailRouteId: text(row.detail_route_id),
    mappingTableRouteId: text(row.mapping_table_route_id),
    coverageAnnotationRouteId: text(row.coverage_annotation_route_id),
    fecAnnotationRouteId: text(row.fec_annotation_route_id),
    assayNumericRouteId: text(row.assay_numeric_route_id),
    structureContextRouteId: text(row.structure_context_route_id),
    lssAnnotationRouteId: text(row.lss_annotation_route_id),
    conflictAnnotationRouteId: text(row.conflict_annotation_route_id),
    sourceDownloadRouteId: text(row.source_download_route_id)
  };
}

function normalizeTrack(row = {}) {
  return {
    profileId: text(row.profile_id),
    trackRouteId: text(row.track_route_id),
    trackDataPath: text(row.track_data_path),
    trackSchemaId: text(row.track_schema_id),
    supports1d: truthy(row.supports_1d),
    supportsTable: truthy(row.supports_table),
    colorPolicyId: text(row.color_policy_id)
  };
}

function normalizePair2d(row = {}) {
  return {
    contextRouteId: text(row.context_route_id),
    pairContextDataPath: text(row.pair_context_data_path),
    pairContextSchemaId: text(row.pair_context_schema_id),
    contextEngine: text(row.context_engine),
    supportsPairArcView: truthy(row.supports_pair_arc_view),
    supportsDotBracketView: truthy(row.supports_dot_bracket_view),
    supportsResidueHover: truthy(row.supports_residue_hover),
    routeAvailabilityStatus: text(row.route_availability_status),
    blockerCode: text(row.blocker_code),
    blockerReason: text(row.blocker_reason)
  };
}

function normalizeColor3d(row = {}) {
  return {
    structureFilePath: text(row.structure_file_path),
    structureUrl: text(row.structure_url),
    structureFileFormat: text(row.structure_file_format),
    residueColoringDataPath: text(row.residue_coloring_data_path),
    viewerCompatibility: text(row.viewer_compatibility),
    colorPolicyId: text(row.color_policy_id),
    coordinateKeyColumn: text(row.pdb_residue_coordinate_key_column),
    valueColumn: text(row.value_column),
    routeAvailabilityStatus: text(row.route_availability_status),
    blockerCode: text(row.blocker_code),
    blockerReason: text(row.blocker_reason)
  };
}

function reactivityColorBin(value) {
  if (!Number.isFinite(value)) return 'missing';
  if (value < 0.35) return 'low';
  if (value < 1) return 'mid';
  return 'high';
}

function residueLabel(row = {}) {
  const chain = text(row.label_asym_id || row.auth_asym_id || row.chain_id_display);
  const seq = text(row.auth_seq_id || row.label_seq_id || row.rmdb_position);
  const base = text(row.parent_base || row.comp_id || row.rmdb_base);
  return [chain && seq ? `${chain}:${seq}` : seq || chain, base].filter(Boolean).join(' ');
}

function normalizeResidueEvidence(row = {}) {
  const reactivityValue = numberOrNull(row.reactivity_value ?? row.reactivityValue);
  const reactivityError = numberOrNull(row.reactivity_error ?? row.reactivityError);
  return {
    pairId: text(row.pair_id || row.pairId),
    profileId: text(row.rmdb_profile_id || row.profile_id || row.profileId),
    rmdbPosition: numberOrNull(row.rmdb_position ?? row.rmdbPosition),
    rmdbBase: text(row.rmdb_base || row.rmdbBase),
    pdbResidue: residueLabel(row),
    labelAsymId: text(row.label_asym_id || row.labelAsymId),
    labelSeqId: numberOrNull(row.label_seq_id ?? row.labelSeqId),
    authSeqId: text(row.auth_seq_id || row.authSeqId),
    compId: text(row.comp_id || row.compId),
    parentBase: text(row.parent_base || row.parentBase),
    coordinateKey: text(row.pdb_residue_coordinate_key || row.residue_key || row.coordinateKey),
    reactivityValue,
    reactivityError,
    numericStatus: text(row.numeric_status || row.numericStatus),
    projectionStatus: text(row.residue_projection_status || row.projection_status || row.projectionStatus),
    structureReactivityStatus: text(row.structure_reactivity_status || row.structureReactivityStatus),
    colorBin: reactivityColorBin(reactivityValue)
  };
}

function parseSegmentRange(value) {
  const match = text(value).match(/:(\d+)-(\d+)$/);
  if (!match) return { start: null, end: null };
  return { start: Number(match[1]), end: Number(match[2]) };
}

function normalizeLssContext(row = {}) {
  const segmentLabel = text(row.residue_key_or_segment_key || row.segmentLabel);
  const range = parseSegmentRange(segmentLabel);
  return {
    pairId: text(row.pair_id || row.pairId),
    pairSegmentId: text(row.pair_segment_id || row.pairSegmentId),
    profileId: text(row.profile_id || row.profileId),
    segmentLabel,
    start: range.start,
    end: range.end,
    pairedEvaluable: numberOrZero(row.n_paired_evaluable ?? row.pairedEvaluable),
    unpairedEvaluable: numberOrZero(row.n_unpaired_evaluable ?? row.unpairedEvaluable),
    lssStatus: text(row.lss_status || row.lssStatus),
    contextEngine: text(row.context_engine || row.contextEngine)
  };
}

export function buildVisualPreview({
  residueEvidence = [],
  lssContexts = [],
  structureRoutes = [],
  maxPoints = DEFAULT_VISUAL_PREVIEW_SIZE
} = {}) {
  const residuePoints = residueEvidence
    .slice(0, maxPoints)
    .map(normalizeResidueEvidence);
  const firstStructureRoute = structureRoutes[0] || {};
  return {
    browserLoadsAnnoconfidenceBigTables: false,
    source: 'build-time derived preview from route-indexed evidence; full ANNOCONFIDENCE tables stay server-side',
    reactivity1d: {
      pointCount: residueEvidence.length,
      points: residuePoints.map((point, index) => ({
        index: index + 1,
        pdbResidue: point.pdbResidue,
        rmdbPosition: point.rmdbPosition,
        rmdbBase: point.rmdbBase,
        profileId: point.profileId,
        reactivityValue: point.reactivityValue,
        reactivityError: point.reactivityError,
        numericStatus: point.numericStatus,
        colorBin: point.colorBin
      }))
    },
    pairArcs: lssContexts.slice(0, 12).map(normalizeLssContext),
    structureColoring: {
      structureFilePath: text(firstStructureRoute.structureFilePath || firstStructureRoute.structure_file_path),
      structureUrl: text(firstStructureRoute.structureUrl || firstStructureRoute.structure_url),
      coordinateKeyColumn: text(firstStructureRoute.coordinateKeyColumn || firstStructureRoute.pdb_residue_coordinate_key_column || 'pdb_residue_coordinate_key'),
      valueColumn: text(firstStructureRoute.valueColumn || firstStructureRoute.value_column || 'reactivity_value'),
      points: residuePoints.map((point) => ({
        coordinateKey: point.coordinateKey,
        pdbResidue: point.pdbResidue,
        reactivityValue: point.reactivityValue,
        colorBin: point.colorBin
      }))
    },
    mappedResidues: residuePoints
  };
}

function normalizeConflict(row = {}) {
  return {
    id: text(row.conflict_candidate_id || row.route_id),
    routeId: text(row.route_id),
    type: text(row.conflict_type),
    status: text(row.conflict_status),
    fecClaimCeiling: text(row.fec_claim_ceiling),
    claimScope: text(row.claim_scope),
    lssStatus: text(row.lss_status),
    reviewPriorityHint: text(row.review_priority_hint)
  };
}

function pagePath(caseKey, routeKey, page) {
  return `cases/${casePathSegment(caseKey)}/${routeKey}/page-${String(page).padStart(4, '0')}.json`;
}

function confidenceAssetPaths(caseKey) {
  const segment = casePathSegment(caseKey);
  return {
    confidenceSummaryPath: `cases/${segment}/confidence-summary.json`,
    confidenceEvidencePath: `cases/${segment}/confidence-evidence.json`,
    confidenceProvenancePath: `cases/${segment}/confidence-provenance.json`,
  };
}

export function buildPagedRouteAssets({
  caseId,
  caseKey,
  routeKey,
  rows = [],
  pageSize = DEFAULT_ROUTE_PAGE_SIZE,
  previewSize = DEFAULT_ROUTE_PREVIEW_SIZE
} = {}) {
  const selectedCaseId = text(caseId);
  const selectedCaseKey = text(caseKey) || selectedCaseId;
  const safeRows = Array.isArray(rows) ? rows : [];
  const pageCount = Math.max(1, Math.ceil(safeRows.length / pageSize));
  const pages = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    const start = index * pageSize;
    const pageRows = safeRows.slice(start, start + pageSize);
    const path = pagePath(selectedCaseKey, routeKey, page);
    return {
      path,
      asset: {
        schemaVersion: ANNOJOIN_ATLAS_SCHEMA_VERSION,
        version: ANNOJOIN_ATLAS_VERSION,
        atlasCaseKey: selectedCaseKey,
        caseId: selectedCaseId,
        routeKey,
        page,
        pageSize,
        totalRows: safeRows.length,
        pageCount,
        rows: pageRows
      }
    };
  });

  return {
    summary: {
      totalRows: safeRows.length,
      pageSize,
      pageCount,
      path: pages[0].path,
      preview: safeRows.slice(0, previewSize)
    },
    pages
  };
}

function matchesSelectedCase(row = {}, caseId = '', caseKey = '') {
  const selectedKey = text(caseKey);
  if (selectedKey && atlasCaseKeyFor(row) === selectedKey) return true;
  if (selectedKey && assetFamily(row)) return false;
  return text(row.case_id || row.caseId) === text(caseId);
}

function firstByCase(rows, caseId, caseKey = '') {
  return (rows || []).find((row) => matchesSelectedCase(row, caseId, caseKey)) || null;
}

function allByCase(rows, caseId, caseKey = '') {
  return (rows || []).filter((row) => matchesSelectedCase(row, caseId, caseKey));
}

export function buildAtlasIndexAsset({
  cases = [],
  facets = [],
  summaries = [],
  routes = [],
  tracks = [],
  presets = [],
  downloads = [],
  source = {},
  generatedAt = new Date().toISOString()
} = {}) {
  const tracksByCase = groupByAtlasCaseKey(tracks);
  const normalizedCases = cases.map((row) => {
    const caseId = text(row.case_id);
    const caseKey = atlasCaseKeyFor(row);
    const summary = firstByCase(summaries, caseId, caseKey);
    const route = firstByCase(routes, caseId, caseKey);
    return {
      ...normalizeCase(row),
      profileTracePreview: buildProfileTracePreview(tracksByCase.get(caseKey) || []),
      recommendedDefaultPreset: text(summary?.recommended_default_preset),
      detailRouteId: text(route?.detail_route_id)
    };
  });
  // 加性 canonical 展示名（display-only）：不改 raw biologicalMoleculeName/pdbMoleculeName。
  const moleculeCanonicalMap = buildMoleculeCanonicalMap(normalizedCases);
  // class 层级标签也折叠大小写/空白变体（总表按 parent/child class label 分组）。
  // 同样 display-only：覆写 normalizedCase 上派生的 parentClassLabel/childClassLabel
  // （这两个字段本就是展示标签，raw provenance 在各自 *Source 字段，未触碰）。
  const classCanonicalMap = buildCanonicalSpellingMap(
    normalizedCases.flatMap((row) => [row.parentClassLabel, row.childClassLabel])
  );
  for (const row of normalizedCases) {
    const base = moleculeBaseName(row);
    row.moleculeDisplayName = base ? canonicalSpelling(moleculeCanonicalMap, base) : '';
    row.parentClassLabel = canonicalSpelling(classCanonicalMap, row.parentClassLabel);
    row.childClassLabel = canonicalSpelling(classCanonicalMap, row.childClassLabel);
  }
  const displayCases = buildDisplayCases(normalizedCases);
  return {
    schemaVersion: ANNOJOIN_ATLAS_SCHEMA_VERSION,
    version: ANNOJOIN_ATLAS_VERSION,
    generatedAt,
    source: {
      entryRoot: 'ANNOJOIN',
      annotationRoot: 'ANNOCONFIDENCE',
      browserLoadsAnnoconfidenceBigTables: false,
      ...source
    },
    totalCaseCount: displayCases.length,
    totalSourceCaseCount: normalizedCases.length,
    caseHierarchy: buildCaseHierarchy(displayCases),
    displayCases,
    cases: normalizedCases,
    facets: facets.map(normalizeFacet),
    presets: presets.map(normalizePreset),
    downloads: downloads.map(normalizeDownload)
  };
}

export function buildAtlasCaseAsset({
  caseId,
  caseKey,
  cases = [],
  summaries = [],
  routes = [],
  memberships = [],
  tracks = [],
  pairs2d = [],
  lssContexts = [],
  colors3d = [],
  conflicts = [],
  residueEvidence = [],
  chainIdentities = []
} = {}) {
  const requestedCaseKey = text(caseKey);
  const requestedCaseId = text(caseId);
  const caseRow = firstByCase(cases, requestedCaseId, requestedCaseKey);
  if (!caseRow) {
    throw new Error(`[annojoin-atlas] case not found: ${requestedCaseKey || requestedCaseId}`);
  }
  const selectedCaseId = requestedCaseId || text(caseRow.case_id || caseRow.caseId);
  const selectedCaseKey = requestedCaseKey || atlasCaseKeyFor(caseRow);

  const membershipRows = allByCase(memberships, selectedCaseId, selectedCaseKey).map((row) => ({
    pairId: text(row.pair_id),
    profileId: text(row.profile_id),
    routeId: text(row.profile_membership_route_id)
  }));
  const trackRows = allByCase(tracks, selectedCaseId, selectedCaseKey).map(normalizeTrack);
  const pairRows = allByCase(pairs2d, selectedCaseId, selectedCaseKey).map(normalizePair2d);
  const structureRows = allByCase(colors3d, selectedCaseId, selectedCaseKey).map(normalizeColor3d);
  const conflictRows = allByCase(conflicts, selectedCaseId, selectedCaseKey).map(normalizeConflict);
  const residueRows = allByCase(residueEvidence, selectedCaseId, selectedCaseKey);
  const lssRows = allByCase(lssContexts, selectedCaseId, selectedCaseKey);
  const membershipPages = buildPagedRouteAssets({ caseId: selectedCaseId, caseKey: selectedCaseKey, routeKey: 'memberships', rows: membershipRows });
  const trackPages = buildPagedRouteAssets({ caseId: selectedCaseId, caseKey: selectedCaseKey, routeKey: 'track-routes', rows: trackRows });
  const pairPages = buildPagedRouteAssets({ caseId: selectedCaseId, caseKey: selectedCaseKey, routeKey: 'pair-context-routes', rows: pairRows });
  const structurePages = buildPagedRouteAssets({ caseId: selectedCaseId, caseKey: selectedCaseKey, routeKey: 'structure-routes', rows: structureRows });
  const conflictPages = buildPagedRouteAssets({ caseId: selectedCaseId, caseKey: selectedCaseKey, routeKey: 'conflicts', rows: conflictRows });
  const visualPreview = buildVisualPreview({ residueEvidence: residueRows, lssContexts: lssRows, structureRoutes: structureRows });
  const visualPages = buildPagedRouteAssets({ caseId: selectedCaseId, caseKey: selectedCaseKey, routeKey: 'visual-preview', rows: visualPreview.mappedResidues });

  return {
    schemaVersion: ANNOJOIN_ATLAS_SCHEMA_VERSION,
    version: ANNOJOIN_ATLAS_VERSION,
    case: { ...normalizeCase(caseRow), chainIdentities: Array.isArray(chainIdentities) ? chainIdentities : [] },
    summary: normalizeSummary(firstByCase(summaries, selectedCaseId, selectedCaseKey)),
    detailRoutes: normalizeRoute(firstByCase(routes, selectedCaseId, selectedCaseKey)),
    memberships: membershipPages.summary,
    trackRoutes: trackPages.summary,
    pairContextRoutes: pairPages.summary,
    structureRoutes: structurePages.summary,
    conflicts: conflictPages.summary,
    visualPreview,
    routeAssets: {
      memberships: { path: membershipPages.summary.path, totalRows: membershipPages.summary.totalRows, pageCount: membershipPages.summary.pageCount },
      trackRoutes: { path: trackPages.summary.path, totalRows: trackPages.summary.totalRows, pageCount: trackPages.summary.pageCount },
      pairContextRoutes: { path: pairPages.summary.path, totalRows: pairPages.summary.totalRows, pageCount: pairPages.summary.pageCount },
      structureRoutes: { path: structurePages.summary.path, totalRows: structurePages.summary.totalRows, pageCount: structurePages.summary.pageCount },
      conflicts: { path: conflictPages.summary.path, totalRows: conflictPages.summary.totalRows, pageCount: conflictPages.summary.pageCount },
      visualPreview: { path: visualPages.summary.path, totalRows: visualPages.summary.totalRows, pageCount: visualPages.summary.pageCount }
    },
    supplementalAssets: confidenceAssetPaths(selectedCaseKey),
    routeAssetPages: [
      ...membershipPages.pages,
      ...trackPages.pages,
      ...pairPages.pages,
      ...structurePages.pages,
      ...conflictPages.pages,
      ...visualPages.pages
    ],
    annotationPayloadRowsCopied: 0
  };
}
