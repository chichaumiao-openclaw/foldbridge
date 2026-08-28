#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

import {
  BUILDER_VERSION,
  COVERAGE_SCHEMA,
  MAX_DB_ONLY_AUDIT_SUMMARY_BYTES,
  MAX_PROFILE_INDEX_BYTES,
  MAX_SOURCE_MANIFEST_BYTES,
  REPORT_HEADERS,
  SOURCE_MANIFEST_SCHEMA,
  STATUS_NAMES,
  assertExactFields,
  assertStrictIdentity,
  captureAnchoredFile,
  committedPreviewGlobalAssets,
  compareAuditRows,
  compareUtf8,
  createBoundedDbOnlyAuditSummaryAccumulator,
  deterministicGzip,
  deterministicJson,
  emptyStatusCounts,
  enumerateAnchoredCaseInventory,
  isRecord,
  parseNdjsonStrict,
  parseProfileIndexGzipBytes,
  processSequentiallyBounded,
  runGitNoReplace,
  sha256AnchoredManifest,
  sidecarRelativePath,
  snapshotAnchoredTree,
  validateExtractorRow,
  validateDbOnlyAuditSummary,
  validateIsoUtcInstant,
  validateProfileIndex,
  validateRunId,
} from './case-public-techniques-lib.mjs';
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const BUILDER_PATH = path.join(REPO_ROOT, 'scripts', 'build-case-public-techniques.mjs');
const PREVIEW_BUILDER_PATH = path.join(REPO_ROOT, 'scripts', 'build-case-public-techniques-preview.mjs');
const BUILDER_EXTRACTOR_PATH = path.join(REPO_ROOT, 'scripts', 'extract-case-public-techniques.py');
const REQUIRED_FLAGS = ['--run', '--db', '--case-root', '--python'];
const MAX_CHAIN_QUERY_STDOUT_BYTES = 32 * 1024 * 1024;
const VERIFIER_APPROVED_PREVIEW_BASELINE_RUN = '/Volumes/tianyi/foldbridge_staging/case-public-taxonomy-20260828/runs/pilot-20260828T160812Z-f53fbdb138d2';
const VERIFIER_APPROVED_PREVIEW_BASELINE_SHA256 = 'c0e5c91055d49c1503944551fb198e45fa07153862e1f0a9634692d1d136a65e';
const VERIFIER_PREVIEW_SOURCE_MANIFEST_SCHEMA = 'case-public-techniques-source-manifest.v3';
const VERIFIER_PREVIEW_PROVENANCE_SCHEMA = 'case-public-techniques-preview.v2';
const VERIFIER_PREVIEW_BUILDER_VERSION = 'case-public-techniques-preview-builder.v2';
const VERIFIER_PREVIEW_ARTIFACT_KIND = 'pilot-preview';
const VERIFIER_MAX_PREVIEW_FILE_BYTES = 64 * 1024 * 1024;
const VERIFIER_MAX_PREVIEW_MANIFEST_BYTES = 64 * 1024 * 1024;
const VERIFIER_APPROVED_PREVIEW_BASELINE_ANCHOR = Object.freeze({
  run: VERIFIER_APPROVED_PREVIEW_BASELINE_RUN,
  sha256: VERIFIER_APPROVED_PREVIEW_BASELINE_SHA256,
});
const RUN_FILE_BYTE_LIMITS = new Map([
  ['source-manifest.json', MAX_SOURCE_MANIFEST_BYTES],
]);
const SOURCE_CLOSURE_PATHS = [
  'scripts/build-case-public-techniques.mjs',
  'scripts/case-public-techniques-lib.mjs',
  'scripts/extract-case-public-techniques.py',
  'scripts/safe-openat-capture.py',
  'src/techniqueFilterModel.js',
  'public/entry-cases/__entry_v3_site__/workbench-pure.mjs',
].sort(compareUtf8);
// Keep the v3 replay closure and copied global roots independent from builder-owned lists.
const VERIFIER_PREVIEW_SOURCE_CLOSURE_PATHS = [
  'package.json',
  'scripts/build-case-public-techniques-preview.mjs',
  'scripts/build-case-public-techniques.mjs',
  'scripts/case-public-techniques-lib.mjs',
  'scripts/extract-case-public-techniques.py',
  'scripts/safe-openat-capture.py',
  'scripts/verify-case-public-techniques.mjs',
  'scripts/version-ef-entry-assets.mjs',
  'src/techniqueFilterModel.js',
  'public/entry-cases/__entry_v3_site__/workbench-pure.mjs',
].sort(compareUtf8);
const VERIFIER_PREVIEW_GLOBAL_DIRECTORIES = [
  'entry-cases/__entry_v3_site__',
  'entry-cases/__entry_ef_site__',
];
const VERIFIER_PREVIEW_GLOBAL_FILES = [
  'src/assets/generated/pdb-primary-citations/index.json',
  'src/assets/header/aboutus.svg',
  'src/assets/header/database.svg',
  'src/assets/header/gznl2.svg',
  'src/assets/header/home.svg',
  'src/assets/header/research.svg',
  'src/portalChrome.js',
  'src/siteChrome.js',
  'src/statsDashboard.js',
];
const VERIFIER_PDB_ROOT_DIRECT_DEPENDENCIES = [
  'browser-manifest.json',
  'structure.cif.gz',
];
const PREVIEW_MANIFEST_FIELDS = [
  'schemaVersion',
  'builderVersion',
  'artifactKind',
  'runId',
  'gitCommit',
  'buildStartedAt',
  'projectionCompletedAt',
  'finalizedAt',
  'sourceClosure',
  'database',
  'caseRoot',
  'profileIndexes',
  'taxonomySnapshotSha256',
  'selectionMode',
  'selection',
  'dbOnlyAuditSummary',
  'baseline',
  'commands',
  'execution',
  'totals',
  'preview',
];
const MANIFEST_FIELDS = [
  'schemaVersion',
  'builderVersion',
  'runId',
  'gitCommit',
  'buildStartedAt',
  'projectionCompletedAt',
  'finalizedAt',
  'sourceClosure',
  'database',
  'caseRoot',
  'profileIndexes',
  'taxonomySnapshotSha256',
  'selectionMode',
  'selection',
  'dbOnlyAuditSummary',
  'commands',
  'execution',
  'totals',
];
const INPUT_RECORD_FIELDS = ['path', 'size', 'mtimeNs', 'inode', 'device', 'sha256'];
const PROFILE_RECORD_FIELDS = ['ordinal', 'pdbId', 'authChain', ...INPUT_RECORD_FIELDS];
const EXECUTION_FIELDS = [
  'strategy',
  'maxBufferedChains',
  'maxExtractorStdoutBytes',
  'maxDbOnlyAuditSummaryBytes',
  'maxSourceManifestBytes',
  'maxProfileIndexBytes',
];
const PREVIEW_EXECUTION_FIELDS = [
  ...EXECUTION_FIELDS,
  'previewStrategy',
  'maxPreviewFileBytes',
  'maxPreviewManifestBytes',
];

export function snapshotRunTreeStreaming(run, {
  python,
  sourceManifestMaxBytes = MAX_SOURCE_MANIFEST_BYTES,
} = {}) {
  if (!Number.isSafeInteger(sourceManifestMaxBytes) || sourceManifestMaxBytes <= 0) {
    throw new TypeError('sourceManifestMaxBytes must be a positive safe integer');
  }
  return deterministicJson(snapshotAnchoredTree({
    python,
    root: run,
    maxBytesByRelativePath: new Map([['source-manifest.json', sourceManifestMaxBytes]]),
  }));
}

export function parseVerifierArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!REQUIRED_FLAGS.includes(flag)) throw new Error(`Unknown argument ${JSON.stringify(flag)}`);
    if (values.has(flag)) throw new Error(`Duplicate argument ${flag}`);
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) throw new Error(`Missing value for ${flag}`);
    values.set(flag, argv[index + 1]);
    index += 1;
  }
  for (const flag of REQUIRED_FLAGS) {
    if (!values.has(flag)) throw new Error(`Missing required argument ${flag}`);
  }
  return Object.fromEntries(REQUIRED_FLAGS.map((flag) => [flag.slice(2).replace('-', ''), values.get(flag)]));
}

function requireDirectory(directory, label) {
  const absolute = realpathSync(directory);
  if (!statSync(absolute).isDirectory()) throw new Error(`${label} is not a directory: ${absolute}`);
  return absolute;
}

function requireFile(filePath, label) {
  const absolute = realpathSync(filePath);
  if (!statSync(absolute).isFile()) throw new Error(`${label} is not a regular file: ${absolute}`);
  return absolute;
}

function parseJsonFileBounded({ python, root, segments, label, maxBytes }) {
  const captured = captureAnchoredFile({ python, root, segments, maxBytes, includeBytes: true });
  try {
    return { payload: JSON.parse(captured.bytes.toString('utf8')), bytes: captured.bytes };
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error.message}`);
  }
}

function captureAbsoluteAnchored({ python, filePath, maxBytes = null, includeBytes = false }) {
  return captureAnchoredFile({
    python,
    root: path.dirname(filePath),
    segments: [path.basename(filePath)],
    maxBytes,
    includeBytes,
  });
}

function captureRunFile({ python, run, relativePath, maxBytes, includeBytes = true }) {
  return captureAnchoredFile({
    python,
    root: run,
    segments: relativePath.split('/'),
    maxBytes,
    includeBytes,
  });
}

function assertBytes(actual, expected, label) {
  const actualBuffer = Buffer.isBuffer(actual) ? actual : Buffer.from(actual);
  const expectedBuffer = Buffer.isBuffer(expected) ? expected : Buffer.from(expected);
  if (!actualBuffer.equals(expectedBuffer)) throw new Error(`${label} differs from independently regenerated bytes`);
}

function sameRecord(actual, expected, label) {
  assertExactFields(actual, INPUT_RECORD_FIELDS, label);
  for (const field of INPUT_RECORD_FIELDS) {
    if (actual[field] !== expected[field]) throw new Error(`${label}.${field} does not match current input`);
  }
}

function validateSelection(selection) {
  if (!Array.isArray(selection) || selection.length === 0) throw new Error('Manifest selection must be a non-empty array');
  const seen = new Set();
  return selection.map((item, ordinal) => {
    assertExactFields(item, ['pdbId', 'authChain'], `Manifest selection[${ordinal}]`);
    assertStrictIdentity(item.pdbId, `Manifest selection[${ordinal}].pdbId`);
    assertStrictIdentity(item.authChain, `Manifest selection[${ordinal}].authChain`);
    for (const identity of [item.pdbId, item.authChain]) {
      if (identity === '.' || identity === '..' || identity.includes('/') || identity.includes('\0')) {
        throw new Error(`Manifest selection[${ordinal}] contains an unsafe path identity`);
      }
    }
    const key = `${item.pdbId}\0${item.authChain}`;
    if (seen.has(key)) throw new Error(`Manifest selection contains duplicate identity ${item.pdbId}/${item.authChain}`);
    seen.add(key);
    return { ordinal, pdbId: item.pdbId, authChain: item.authChain };
  });
}

function independentlyEnumerateAllSelection(caseRoot, python) {
  return enumerateAnchoredCaseInventory({
    python,
    caseRoot,
    profileIndexMaxBytes: MAX_PROFILE_INDEX_BYTES,
  }).map(({ pdbId, authChain }) => ({ pdbId, authChain }));
}

function gitBuffer(args, label) {
  return runGitNoReplace(REPO_ROOT, args, label, { maxBuffer: 8 * 1024 * 1024 });
}

function resolveRecordedCommit(git12, recordedCommit) {
  if (typeof recordedCommit !== 'string' || !/^[0-9a-f]{40}$/.test(recordedCommit)) {
    throw new Error('Source manifest gitCommit must be a full 40-character lowercase hex commit');
  }
  if (!recordedCommit.startsWith(git12)) {
    throw new Error('Run-id git12 is not a prefix of source manifest gitCommit');
  }
  const recordedType = gitBuffer(['cat-file', '-t', recordedCommit], 'Validate recorded full git commit').toString('utf8');
  if (recordedType !== 'commit\n') throw new Error('Source manifest gitCommit does not name a commit object');
  const candidates = gitBuffer(['rev-parse', `--disambiguate=${git12}`], 'Disambiguate run-id git12')
    .toString('utf8').split('\n').filter(Boolean);
  const commits = candidates.filter((candidate) => {
    if (!/^[0-9a-f]{40,64}$/.test(candidate)) return false;
    try {
      return gitBuffer(['cat-file', '-t', candidate], `Read git object type ${candidate}`).toString('utf8') === 'commit\n';
    } catch {
      return false;
    }
  });
  if (commits.length !== 1 || commits[0] !== recordedCommit) {
    throw new Error('Run-id git12 does not uniquely select the recorded full commit object');
  }
  return recordedCommit;
}

function independentlyRebuildSourceClosure(commit, paths = SOURCE_CLOSURE_PATHS) {
  return [...paths].sort(compareUtf8).map((relativePath) => {
    const entry = gitBuffer(
      ['ls-tree', '-z', commit, '--', relativePath],
      `Read committed source tree entry ${relativePath}`,
    );
    if (entry.length === 0 || entry.at(-1) !== 0 || entry.subarray(0, -1).includes(0)) {
      throw new Error(`Committed source path has no unique tree entry: ${relativePath}`);
    }
    const line = entry.subarray(0, -1).toString('utf8');
    const tab = line.indexOf('\t');
    const [mode, type, blob] = line.slice(0, tab).split(' ');
    if (tab < 0 || line.slice(tab + 1) !== relativePath || !['100644', '100755'].includes(mode) || type !== 'blob') {
      throw new Error(`Committed source path is not a regular file: ${relativePath}`);
    }
    if (!/^[0-9a-f]{40,64}$/.test(blob)) throw new Error(`Committed source blob id is invalid: ${relativePath}`);
    const bytes = gitBuffer(['cat-file', 'blob', blob], `Read committed source blob ${relativePath}`);
    return { path: relativePath, blob, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
}

function assertStringArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || item.length === 0 || item.trim() !== item) {
      throw new Error(`${label}[${index}] must be a non-empty trimmed string`);
    }
    if (seen.has(item)) throw new Error(`${label} contains duplicate ${JSON.stringify(item)}`);
    seen.add(item);
  }
}

function validateCommittedTaxonomySnapshot(snapshot) {
  assertExactFields(
    snapshot,
    ['taxonomyVersion', 'tokenSeparator', 'families', 'aliases', 'canonicalTechniques'],
    'Committed taxonomy snapshot',
  );
  for (const field of ['taxonomyVersion', 'tokenSeparator']) {
    if (typeof snapshot[field] !== 'string' || snapshot[field].length === 0) {
      throw new Error(`Committed taxonomy snapshot ${field} must be a non-empty string`);
    }
  }
  for (const [field, limit] of [['families', 256], ['aliases', 65536], ['canonicalTechniques', 65536]]) {
    if (!Array.isArray(snapshot[field]) || snapshot[field].length > limit) {
      throw new Error(`Committed taxonomy snapshot ${field} must be a bounded array`);
    }
  }
  const familyIds = new Set();
  snapshot.families.forEach((family, index) => {
    const label = `Committed taxonomy snapshot families[${index}]`;
    assertExactFields(family, ['id', 'label', 'shortLabel', 'techniques', 'filterTechniques'], label);
    for (const field of ['id', 'label', 'shortLabel']) {
      if (typeof family[field] !== 'string' || family[field].length === 0 || family[field].trim() !== family[field]) {
        throw new Error(`${label}.${field} must be a non-empty trimmed string`);
      }
    }
    if (familyIds.has(family.id)) throw new Error(`Committed taxonomy snapshot has duplicate family ${family.id}`);
    familyIds.add(family.id);
    assertStringArray(family.techniques, `${label}.techniques`);
    assertStringArray(family.filterTechniques, `${label}.filterTechniques`);
  });
  const aliasTokens = new Set();
  snapshot.aliases.forEach((alias, index) => {
    const label = `Committed taxonomy snapshot aliases[${index}]`;
    assertExactFields(alias, ['normalizedToken', 'canonicalLabel'], label);
    for (const field of ['normalizedToken', 'canonicalLabel']) {
      if (typeof alias[field] !== 'string' || alias[field].length === 0 || alias[field].trim() !== alias[field]) {
        throw new Error(`${label}.${field} must be a non-empty trimmed string`);
      }
    }
    if (aliasTokens.has(alias.normalizedToken)) throw new Error(`${label}.normalizedToken is duplicated`);
    aliasTokens.add(alias.normalizedToken);
  });
  const canonicalTokens = new Set();
  snapshot.canonicalTechniques.forEach((technique, index) => {
    const label = `Committed taxonomy snapshot canonicalTechniques[${index}]`;
    assertExactFields(
      technique,
      ['normalizedToken', 'label', 'categoryId', 'categoryLabel', 'categoryShortLabel'],
      label,
    );
    for (const field of ['normalizedToken', 'label', 'categoryId', 'categoryLabel', 'categoryShortLabel']) {
      if (typeof technique[field] !== 'string' || technique[field].length === 0 || technique[field].trim() !== technique[field]) {
        throw new Error(`${label}.${field} must be a non-empty trimmed string`);
      }
    }
    if (!familyIds.has(technique.categoryId)) throw new Error(`${label}.categoryId references an unknown family`);
    if (canonicalTokens.has(technique.normalizedToken)) throw new Error(`${label}.normalizedToken is duplicated`);
    canonicalTokens.add(technique.normalizedToken);
  });
}

function committedRegularBlob(commit, relativePath, label) {
  const entry = gitBuffer(
    ['ls-tree', '-z', commit, '--', relativePath],
    `Read committed ${label} tree entry`,
  );
  if (entry.length === 0 || entry.at(-1) !== 0 || entry.subarray(0, -1).includes(0)) {
    throw new Error(`Committed ${label} has no unique tree entry`);
  }
  const line = entry.subarray(0, -1).toString('utf8');
  const tab = line.indexOf('\t');
  const [mode, type, blob] = line.slice(0, tab).split(' ');
  if (tab < 0 || line.slice(tab + 1) !== relativePath || !['100644', '100755'].includes(mode) || type !== 'blob') {
    throw new Error(`Committed ${label} is not a regular file`);
  }
  if (!/^[0-9a-f]{40,64}$/.test(blob)) throw new Error(`Committed ${label} blob id is invalid`);
  const bytes = gitBuffer(['cat-file', 'blob', blob], `Read committed ${label} blob`);
  if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) {
    throw new Error(`Committed ${label} exceeds its byte contract`);
  }
  return bytes;
}

async function independentlyLoadCommittedTechniqueReplay(commit) {
  const classifierBytes = committedRegularBlob(
    commit,
    'src/techniqueFilterModel.js',
    'taxonomy classifier',
  );
  const validatorBytes = committedRegularBlob(
    commit,
    'public/entry-cases/__entry_v3_site__/workbench-pure.mjs',
    'profile technique validator',
  );
  const temporary = mkdtempSync(path.join(tmpdir(), 'case-public-taxonomy-commit-'));
  try {
    const modulePath = path.join(temporary, 'techniqueFilterModel.mjs');
    const validatorPath = path.join(temporary, 'workbench-pure.mjs');
    writeFileSync(modulePath, classifierBytes, { flag: 'wx', mode: 0o600 });
    writeFileSync(validatorPath, validatorBytes, { flag: 'wx', mode: 0o600 });
    const classifier = await import(pathToFileURL(modulePath).href);
    const validator = await import(pathToFileURL(validatorPath).href);
    if (typeof classifier.buildTechniqueTaxonomySnapshot !== 'function') {
      throw new Error('Committed taxonomy classifier does not export buildTechniqueTaxonomySnapshot');
    }
    if (typeof classifier.classifyTechniqueFilter !== 'function' || !Array.isArray(classifier.MECHANISM_FAMILIES)) {
      throw new Error('Committed taxonomy classifier does not expose its classification contract');
    }
    if (
      typeof validator.PROFILE_PUBLIC_TECHNIQUES_SCHEMA !== 'string'
      || validator.PROFILE_PUBLIC_TECHNIQUES_SCHEMA.length === 0
      || typeof validator.validateProfilePublicTechniques !== 'function'
    ) {
      throw new Error('Committed profile technique validator does not expose its validation contract');
    }
    const snapshot = classifier.buildTechniqueTaxonomySnapshot();
    if (snapshot && typeof snapshot.then === 'function') {
      throw new Error('Committed taxonomy snapshot builder must be synchronous');
    }
    validateCommittedTaxonomySnapshot(snapshot);
    const serialized = deterministicJson(snapshot);
    if (Buffer.byteLength(serialized) > 8 * 1024 * 1024) {
      throw new Error('Committed taxonomy snapshot exceeds its byte contract');
    }
    if (deterministicJson(classifier.MECHANISM_FAMILIES) !== deterministicJson(snapshot.families)) {
      throw new Error('Committed classifier families differ from its taxonomy snapshot');
    }
    return {
      taxonomySnapshotSha256: createHash('sha256').update(serialized).digest('hex'),
      classifyTechniqueFilter: classifier.classifyTechniqueFilter,
      categories: classifier.MECHANISM_FAMILIES,
      profileSchema: validator.PROFILE_PUBLIC_TECHNIQUES_SCHEMA,
      validateProfilePublicTechniques: validator.validateProfilePublicTechniques,
    };
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function singleTokenClassifier(label, techniqueReplay) {
  const result = techniqueReplay.classifyTechniqueFilter(label);
  if (!isRecord(result) || !Array.isArray(result.methods) || result.methods.length !== 1) {
    throw new Error(`Shared classifier did not return exactly one method for ${JSON.stringify(label)}`);
  }
  return { ...result.methods[0] };
}

function classifyRawRow(row, techniqueReplay) {
  if (row.techFilter !== null && typeof row.techFilter !== 'string') throw new Error(`DB row profile ${row.profileId} techFilter must be string or null`);
  if (row.isBackgroundChannel !== null && typeof row.isBackgroundChannel !== 'boolean') {
    throw new Error(`DB row profile ${row.profileId} isBackgroundChannel must be boolean or null`);
  }
  let methods = [];
  let status;
  if (typeof row.techFilter === 'string' && row.techFilter.trim().length > 0) {
    const result = techniqueReplay.classifyTechniqueFilter(row.techFilter);
    if (!isRecord(result) || !Array.isArray(result.methods)) throw new Error('Shared classifier returned a malformed result');
    methods = result.methods.map((method) => ({ ...method }));
    if (methods.length > 0) status = result.classificationStatus;
  }
  if (methods.length === 0) status = row.isBackgroundChannel === true ? 'background' : 'missing';
  if (!STATUS_NAMES.includes(status)) throw new Error(`Shared classifier returned invalid status ${JSON.stringify(status)}`);
  return { status, methods };
}

function independentlyProjectChain({ selection, profileIndex, rows, techniqueReplay }) {
  const profileIds = validateProfileIndex(profileIndex, `profile-index for ${selection.pdbId}/${selection.authChain}`);
  const byProfileId = new Map();
  const classifications = new Map();
  const unmappedRows = [];
  const nullRows = [];
  rows.forEach((row, rowIndex) => {
    validateExtractorRow(row, { rowIndex, ordinal: selection.ordinal, pdbId: selection.pdbId, authChain: selection.authChain });
    if (byProfileId.has(row.profileId)) throw new Error(`Verifier found duplicate DB profileId "${row.profileId}"`);
    byProfileId.set(row.profileId, row);
    const classified = classifyRawRow(row, techniqueReplay);
    classifications.set(row.profileId, classified);
    for (const method of classified.methods) {
      if (method.mappingStatus === 'unmapped') {
        unmappedRows.push({ ordinal: selection.ordinal, pdbId: selection.pdbId, authChain: selection.authChain, profileId: row.profileId, label: method.label });
      }
    }
    if (row.techFilter === null || row.techFilter.trim().length === 0) {
      nullRows.push({ ordinal: selection.ordinal, pdbId: selection.pdbId, authChain: selection.authChain, profileId: row.profileId, isBackgroundChannel: row.isBackgroundChannel });
    }
  });
  const missing = profileIds.filter((profileId) => !byProfileId.has(profileId));
  if (missing.length > 0) throw new Error(`Verifier exact join is missing published profiles: ${missing.join(', ')}`);
  const profileIdSet = new Set(profileIds);
  const dbOnlyRows = rows.filter((row) => !profileIdSet.has(row.profileId)).map((row) => ({ ...row }));
  const profiles = profileIds.map((profileId) => {
    const classified = classifications.get(profileId);
    return { profileId, classificationStatus: classified.status, methods: classified.methods.map((method) => ({ ...method })) };
  });
  const payload = {
    schemaVersion: techniqueReplay.profileSchema,
    pdbId: selection.pdbId,
    authChain: selection.authChain,
    profileCount: profiles.length,
    profiles,
  };
  techniqueReplay.validateProfilePublicTechniques(payload, profileIndex, {
    pdbId: selection.pdbId,
    authChain: selection.authChain,
    categories: techniqueReplay.categories,
    classifyTechniqueToken: (label) => singleTokenClassifier(label, techniqueReplay),
  });
  const statusCounts = emptyStatusCounts();
  for (const profile of profiles) statusCounts[profile.classificationStatus] += 1;
  return {
    payload,
    dbOnlyRows: dbOnlyRows.sort(compareAuditRows),
    unmappedRows: unmappedRows.sort(compareAuditRows),
    nullRows: nullRows.sort(compareAuditRows),
    statusCounts,
  };
}

function independentlySummarizeDbOnlyRows(rows, selection) {
  const groups = new Map();
  for (const row of rows) {
    const background = row.isBackgroundChannel;
    const backgroundKey = background === null ? 'N' : background === false ? 'F' : 'T';
    const key = `${row.techFilter === null ? 'N' : `S${row.techFilter}`}\0${backgroundKey}`;
    const current = groups.get(key);
    if (current) current.count += 1;
    else {
      groups.set(key, {
        pdbId: selection.pdbId,
        authChain: selection.authChain,
        techFilter: row.techFilter,
        isBackgroundChannel: background,
        count: 1,
      });
    }
  }
  const backgroundRank = (value) => value === null ? 0 : value === false ? 1 : 2;
  return [...groups.values()].sort((left, right) => {
    if (left.techFilter === null) return right.techFilter === null
      ? backgroundRank(left.isBackgroundChannel) - backgroundRank(right.isBackgroundChannel)
      : -1;
    if (right.techFilter === null) return 1;
    return compareUtf8(left.techFilter, right.techFilter)
      || backgroundRank(left.isBackgroundChannel) - backgroundRank(right.isBackgroundChannel);
  });
}

function verifierTsv(headers, rows) {
  const encode = (value, field) => {
    let text;
    if (value === null) text = 'null';
    else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') text = String(value);
    else throw new Error(`Verifier cannot encode ${field} in TSV`);
    if (/[\t\r\n]/.test(text)) throw new Error(`Verifier refuses unsafe TSV value in ${field}`);
    return text;
  };
  const lines = [headers.map((header) => encode(header, 'header')).join('\t')];
  rows.forEach((row, rowIndex) => {
    lines.push(headers.map((header) => {
      if (!Object.prototype.hasOwnProperty.call(row, header)) throw new Error(`Verifier TSV row ${rowIndex} lacks ${header}`);
      return encode(row[header], header);
    }).join('\t'));
  });
  return `${lines.join('\n')}\n`;
}

function createExpectedReport(headers) {
  const hash = createHash('sha256');
  let size = 0;
  const header = Buffer.from(verifierTsv(headers, []));
  hash.update(header);
  size += header.length;
  return {
    append(rows) {
      if (rows.length === 0) return;
      const full = verifierTsv(headers, rows);
      const body = Buffer.from(full.slice(full.indexOf('\n') + 1));
      hash.update(body);
      size += body.length;
    },
    finish() {
      return { size, sha256: hash.digest('hex') };
    },
  };
}

async function assertReportDigest({ python, run, relativePath, expected, label }) {
  const actual = captureRunFile({
    python,
    run,
    relativePath,
    maxBytes: null,
    includeBytes: false,
  }).record;
  if (actual.size !== expected.size || actual.sha256 !== expected.sha256) {
    throw new Error(`${label} differs from independently regenerated rows`);
  }
}

function expectedCommands({ run, runId, db, caseRoot, python, selections, selectionMode }) {
  const builder = [
    process.execPath,
    BUILDER_PATH,
    '--db', db,
    '--case-root', caseRoot,
    '--out-parent', path.dirname(run),
    '--run-id', runId,
    '--python', python,
  ];
  if (selectionMode === 'all') builder.push('--all');
  else for (const { pdbId, authChain } of selections) builder.push('--case', `${pdbId}/${authChain}`);
  return {
    builder,
    extractor: {
      strategy: 'per-chain',
      maxStdoutBytes: MAX_CHAIN_QUERY_STDOUT_BYTES,
      argvTemplate: [
        python,
        BUILDER_EXTRACTOR_PATH,
        '--db', db,
        '--selection-json', '<per-chain-selection.json>',
      ],
    },
  };
}

function expectedPreviewCommands({ run, runId, db, caseRoot, python, selections, baselineRun }) {
  return {
    previewBuilder: [
      process.execPath,
      PREVIEW_BUILDER_PATH,
      '--baseline-run', baselineRun,
      '--db', db,
      '--case-root', caseRoot,
      '--worktree-public', path.join(REPO_ROOT, 'public'),
      '--out-parent', path.dirname(run),
      '--run-id', runId,
      '--python', python,
      ...selections.flatMap(({ pdbId, authChain }) => ['--case', `${pdbId}/${authChain}`]),
    ],
    extractor: expectedCommands({
      run,
      runId,
      db,
      caseRoot,
      python,
      selections,
      selectionMode: 'cases',
    }).extractor,
  };
}

function expectedFiles(selections) {
  return [
    ...selections.map(({ pdbId, authChain }) => sidecarRelativePath(pdbId, authChain)),
    'reports/coverage.json',
    'reports/profile-join-failures.tsv',
    'reports/db-only-profiles.tsv',
    'reports/unmapped-techniques.tsv',
    'reports/null-techniques.tsv',
    'reports/sha256.txt',
    'selection.json',
    'source-manifest.json',
  ].sort(compareUtf8);
}

function expectedDirectories(selections) {
  const directories = new Set(['data', 'data/entry-cases', 'data/entry-cases/cases', 'pilot-preview', 'reports']);
  for (const { pdbId, authChain } of selections) {
    const pdbRoot = path.posix.join('data', 'entry-cases', 'cases', pdbId);
    const chainRoot = path.posix.join(pdbRoot, 'chains');
    const authRoot = path.posix.join(chainRoot, authChain);
    directories.add(pdbRoot);
    directories.add(chainRoot);
    directories.add(authRoot);
    directories.add(path.posix.join(authRoot, 'profiles'));
  }
  return [...directories].sort(compareUtf8);
}

function normalizedPreviewInventory(tree) {
  return {
    directories: tree.directories.map((item) => item.path),
    files: tree.files.map((item) => ({ path: item.path, size: item.record.size, sha256: item.record.sha256 })),
  };
}

function addPathAncestors(directories, relativePath) {
  let cursor = path.posix.dirname(relativePath);
  while (cursor !== '.') {
    directories.add(cursor);
    cursor = path.posix.dirname(cursor);
  }
}

function validatePreviewProvenance({ manifest, selections, caseRoot, python, commit, run }) {
  const preview = manifest.preview;
  assertExactFields(
    preview,
    ['schemaVersion', 'worktreePublic', 'globalDirectories', 'globalFiles', 'globalAssets', 'pdbSources', 'caseSources', 'sidecars', 'inventory'],
    'Preview provenance',
  );
  if (preview.schemaVersion !== VERIFIER_PREVIEW_PROVENANCE_SCHEMA) throw new Error('Preview provenance schemaVersion is invalid');
  if (preview.worktreePublic !== path.join(REPO_ROOT, 'public')) throw new Error('Preview worktreePublic does not match repository public root');
  if (deterministicJson(preview.globalDirectories) !== deterministicJson(VERIFIER_PREVIEW_GLOBAL_DIRECTORIES)) {
    throw new Error('Preview globalDirectories differ from the fixed committed asset roots');
  }
  if (deterministicJson(preview.globalFiles) !== deterministicJson(VERIFIER_PREVIEW_GLOBAL_FILES)) {
    throw new Error('Preview globalFiles differ from the fixed committed runtime closure');
  }
  const expectedGlobalAssets = committedPreviewGlobalAssets({
    repoRoot: REPO_ROOT,
    commit,
    globalDirectories: VERIFIER_PREVIEW_GLOBAL_DIRECTORIES,
    globalFiles: VERIFIER_PREVIEW_GLOBAL_FILES,
  });
  if (deterministicJson(preview.globalAssets) !== deterministicJson(expectedGlobalAssets)) {
    throw new Error('Preview globalAssets differ from committed Git blobs');
  }
  if (!Array.isArray(preview.caseSources) || preview.caseSources.length !== selections.length) {
    throw new Error('Preview caseSources must exactly cover the selected auth chains');
  }

  const expectedFilesByPath = new Map();
  const expectedDirectories = new Set(['', 'entry-cases']);
  const addExpectedFile = (relativePath, size, sha256, label) => {
    if (expectedFilesByPath.has(relativePath)) throw new Error(`Preview source paths collide at ${relativePath}`);
    expectedFilesByPath.set(relativePath, { path: relativePath, size, sha256, label });
    addPathAncestors(expectedDirectories, relativePath);
  };
  for (const asset of expectedGlobalAssets) {
    addExpectedFile(asset.path, asset.size, asset.sha256, `global asset ${asset.path}`);
  }

  const uniquePdbIds = [];
  const seenPdbIds = new Set();
  for (const { pdbId } of selections) {
    if (seenPdbIds.has(pdbId)) continue;
    seenPdbIds.add(pdbId);
    uniquePdbIds.push(pdbId);
  }
  if (!Array.isArray(preview.pdbSources) || preview.pdbSources.length !== uniquePdbIds.length) {
    throw new Error('Preview pdbSources must exactly cover selected PDB-root direct dependencies');
  }
  preview.pdbSources.forEach((source, ordinal) => {
    assertExactFields(
      source,
      ['ordinal', 'pdbId', 'sourceRelativePath', 'sourceRoot', 'files'],
      `Preview pdbSources[${ordinal}]`,
    );
    const pdbId = uniquePdbIds[ordinal];
    const sourceRoot = path.join(caseRoot, pdbId);
    if (
      source.ordinal !== ordinal
      || source.pdbId !== pdbId
      || source.sourceRelativePath !== pdbId
      || source.sourceRoot !== sourceRoot
    ) {
      throw new Error(`Preview pdbSources[${ordinal}] PDB-root identity or path drifted`);
    }
    if (!Array.isArray(source.files) || source.files.length !== VERIFIER_PDB_ROOT_DIRECT_DEPENDENCIES.length) {
      throw new Error(`Preview pdbSources[${ordinal}] must list every PDB-root direct dependency`);
    }
    source.files.forEach((file, fileOrdinal) => {
      assertExactFields(file, ['path', 'record'], `Preview pdbSources[${ordinal}].files[${fileOrdinal}]`);
      const relativePath = VERIFIER_PDB_ROOT_DIRECT_DEPENDENCIES[fileOrdinal];
      if (file.path !== relativePath) {
        throw new Error(`Preview pdbSources[${ordinal}] PDB-root dependency order drifted`);
      }
      let current;
      try {
        current = captureAnchoredFile({
          python,
          root: sourceRoot,
          segments: [relativePath],
          maxBytes: VERIFIER_MAX_PREVIEW_FILE_BYTES,
          includeBytes: false,
        });
      } catch (error) {
        throw new Error(`Missing or unsafe PDB-root direct dependency ${pdbId}/${relativePath}: ${error.message}`);
      }
      sameRecord(file.record, current.record, `Preview pdbSources[${ordinal}].files[${fileOrdinal}].record`);
      addExpectedFile(
        path.posix.join('entry-cases', 'cases', pdbId, relativePath),
        current.record.size,
        current.record.sha256,
        `PDB-root source ${pdbId}/${relativePath}`,
      );
    });
  });

  preview.caseSources.forEach((source, ordinal) => {
    assertExactFields(
      source,
      ['ordinal', 'pdbId', 'authChain', 'sourceRelativePath', 'sourceRoot', 'directories', 'files'],
      `Preview caseSources[${ordinal}]`,
    );
    const selection = selections[ordinal];
    if (source.ordinal !== ordinal || source.pdbId !== selection.pdbId || source.authChain !== selection.authChain) {
      throw new Error(`Preview caseSources[${ordinal}] identity or order drifted`);
    }
    const sourceRelativePath = path.posix.join(selection.pdbId, 'chains', selection.authChain);
    const sourceRoot = path.join(caseRoot, ...sourceRelativePath.split('/'));
    if (source.sourceRelativePath !== sourceRelativePath || source.sourceRoot !== sourceRoot) {
      throw new Error(`Preview caseSources[${ordinal}] source path drifted`);
    }
    const current = snapshotAnchoredTree({ python, root: sourceRoot, defaultMaxBytes: VERIFIER_MAX_PREVIEW_FILE_BYTES });
    if (deterministicJson({ directories: source.directories, files: source.files }) !== deterministicJson(current)) {
      throw new Error(`Preview case source changed for ${selection.pdbId}/${selection.authChain}`);
    }
    const destinationRoot = path.posix.join('entry-cases', 'cases', selection.pdbId, 'chains', selection.authChain);
    expectedDirectories.add(destinationRoot);
    addPathAncestors(expectedDirectories, destinationRoot);
    for (const directory of current.directories) {
      const destination = directory.path ? path.posix.join(destinationRoot, directory.path) : destinationRoot;
      expectedDirectories.add(destination);
      addPathAncestors(expectedDirectories, destination);
    }
    for (const file of current.files) {
      if (file.path === 'profiles/profile-public-techniques.json.gz') continue;
      addExpectedFile(
        path.posix.join(destinationRoot, file.path),
        file.record.size,
        file.record.sha256,
        `Case source ${selection.pdbId}/${selection.authChain}/${file.path}`,
      );
    }
  });

  if (!Array.isArray(preview.sidecars) || preview.sidecars.length !== selections.length) {
    throw new Error('Preview sidecars must exactly cover selection');
  }
  const expectedSidecars = selections.map((selection, ordinal) => {
    const dataPath = sidecarRelativePath(selection.pdbId, selection.authChain);
    const previewPath = path.posix.join(
      'pilot-preview',
      'entry-cases',
      'cases', selection.pdbId, 'chains', selection.authChain,
      'profiles', 'profile-public-techniques.json.gz',
    );
    const dataCapture = captureRunFile({ python, run, relativePath: dataPath, maxBytes: VERIFIER_MAX_PREVIEW_FILE_BYTES });
    const previewRelative = previewPath.slice('pilot-preview/'.length);
    addExpectedFile(previewRelative, dataCapture.record.size, dataCapture.record.sha256, `sidecar ${selection.pdbId}/${selection.authChain}`);
    const expected = {
      pdbId: selection.pdbId,
      authChain: selection.authChain,
      dataPath,
      previewPath,
      sha256: dataCapture.record.sha256,
    };
    assertExactFields(preview.sidecars[ordinal], ['pdbId', 'authChain', 'dataPath', 'previewPath', 'sha256'], `Preview sidecars[${ordinal}]`);
    return expected;
  });
  if (deterministicJson(preview.sidecars) !== deterministicJson(expectedSidecars)) {
    throw new Error('Preview sidecar provenance differs from rebuilt data paths');
  }

  const previewRoot = path.join(run, 'pilot-preview');
  const actualTree = snapshotAnchoredTree({ python, root: previewRoot, defaultMaxBytes: VERIFIER_MAX_PREVIEW_FILE_BYTES });
  const actualInventory = normalizedPreviewInventory(actualTree);
  assertExactFields(preview.inventory, ['directories', 'files'], 'Preview inventory');
  if (deterministicJson(preview.inventory) !== deterministicJson(actualInventory)) {
    throw new Error('Preview inventory differs from the anchored preview tree');
  }
  const expectedInventory = {
    directories: [...expectedDirectories].sort(compareUtf8),
    files: [...expectedFilesByPath.values()]
      .sort((left, right) => compareUtf8(left.path, right.path))
      .map(({ path: relativePath, size, sha256 }) => ({ path: relativePath, size, sha256 })),
  };
  if (deterministicJson(actualInventory) !== deterministicJson(expectedInventory)) {
    throw new Error('Preview tree has missing, extra, or source-divergent entries');
  }

  for (const asset of expectedGlobalAssets) {
    const absolute = path.join(previewRoot, ...asset.path.split('/'));
    const stat = lstatSync(absolute);
    const expectedMode = Number.parseInt(asset.mode, 8) & 0o777;
    if (!stat.isFile() || (stat.mode & 0o777) !== expectedMode) {
      throw new Error(`Preview global asset mode differs from Git blob ${asset.path}`);
    }
  }
  for (const sidecar of expectedSidecars) {
    const data = captureRunFile({ python, run, relativePath: sidecar.dataPath, maxBytes: VERIFIER_MAX_PREVIEW_FILE_BYTES }).bytes;
    const copied = captureRunFile({ python, run, relativePath: sidecar.previewPath, maxBytes: VERIFIER_MAX_PREVIEW_FILE_BYTES }).bytes;
    assertBytes(copied, data, `Preview sidecar ${sidecar.pdbId}/${sidecar.authChain}`);
  }
  return actualInventory;
}

async function validatePreviewBaseline({ baseline, baselineAnchor, db, caseRoot, python }) {
  assertExactFields(baseline, ['run', 'runId', 'sha256File', 'sourceManifestSha256'], 'Preview baseline');
  if (baseline.run !== baselineAnchor.run || baseline.runId !== path.basename(baselineAnchor.run)) {
    throw new Error('Preview baseline path or runId differs from the approved anchor');
  }
  if (typeof baseline.sourceManifestSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(baseline.sourceManifestSha256)) {
    throw new Error('Preview baseline sourceManifestSha256 is invalid');
  }
  await verifyRun([
    '--run', baseline.run,
    '--db', db,
    '--case-root', caseRoot,
    '--python', python,
  ], { baselineAnchor });
  const anchorCapture = captureAnchoredFile({
    python,
    root: baseline.run,
    segments: ['reports', 'sha256.txt'],
    maxBytes: MAX_SOURCE_MANIFEST_BYTES,
    includeBytes: false,
  });
  if (anchorCapture.record.sha256 !== baselineAnchor.sha256) {
    throw new Error('Approved preview baseline external SHA-256 anchor drifted');
  }
  sameRecord(baseline.sha256File, anchorCapture.record, 'Preview baseline sha256 file');
  const sourceManifest = captureAnchoredFile({
    python,
    root: baseline.run,
    segments: ['source-manifest.json'],
    maxBytes: MAX_SOURCE_MANIFEST_BYTES,
    includeBytes: true,
  });
  if (sourceManifest.record.sha256 !== baseline.sourceManifestSha256) {
    throw new Error('Preview baseline source manifest hash drifted');
  }
  let sourceManifestPayload;
  try {
    sourceManifestPayload = JSON.parse(sourceManifest.bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Approved baseline source manifest is not valid JSON: ${error.message}`);
  }
  if (sourceManifestPayload.schemaVersion !== SOURCE_MANIFEST_SCHEMA) {
    throw new Error('Approved baseline source manifest must use the v2 schema');
  }
  return validateSelection(sourceManifestPayload.selection);
}

export function extractRowsIndependently({ python, db, selection }) {
  if (!Array.isArray(selection) || selection.length !== 1) {
    throw new Error('Independent verifier query accepts exactly one chain per bounded call');
  }
  const temporary = mkdtempSync(path.join(tmpdir(), 'case-public-techniques-verify-'));
  try {
    const selectionPath = path.join(temporary, 'selection.json');
    writeFileSync(selectionPath, deterministicJson(selection));
    const program = String.raw`
import duckdb
import json
import sys

OUTPUT_FIELDS = ("ordinal", "pdbId", "authChain", "chainKey", "profileId", "techFilter", "isBackgroundChannel")

def fail(message):
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)

try:
    with open(sys.argv[2], encoding="utf-8") as handle:
        selection = json.load(handle)
    if type(selection) is not list or len(selection) != 1:
        fail("selection must contain exactly one chain")
    item = selection[0]
    if type(item) is not dict or set(item) != {"pdbId", "authChain"}:
        fail("selection item must have exactly pdbId and authChain")
    pdb_id = item["pdbId"]
    auth_chain = item["authChain"]
    if type(pdb_id) is not str or not pdb_id or pdb_id.strip() != pdb_id:
        fail("selection pdbId is invalid")
    if type(auth_chain) is not str or not auth_chain or auth_chain.strip() != auth_chain:
        fail("selection authChain is invalid")

    connection = duckdb.connect(sys.argv[1], read_only=True)
    try:
        chain_count = connection.execute(
            "SELECT COUNT(*) FROM chain WHERE pdb_id = ? AND auth = ?",
            [pdb_id, auth_chain],
        ).fetchone()[0]
        if chain_count != 1:
            fail(f"selection requires exactly one DB chain; pdbId={pdb_id!r}, authChain={auth_chain!r}, count={chain_count}")
        cursor = connection.execute(
            "SELECT p.pdb_id, c.auth, p.chain_key, p.profile_key, p.tech_filter, p.is_background_channel "
            "FROM chain c JOIN profile p ON p.pdb_id = c.pdb_id AND p.chain_key = c.chain_key "
            "WHERE c.pdb_id = ? AND c.auth = ? ORDER BY p.profile_key",
            [pdb_id, auth_chain],
        )
        while True:
            rows = cursor.fetchmany(1024)
            if not rows:
                break
            for row in rows:
                output = (0,) + tuple(row)
                sys.stdout.write(json.dumps(dict(zip(OUTPUT_FIELDS, output)), ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n")
    finally:
        connection.close()
except SystemExit:
    raise
except Exception as error:
    fail(error)
`;
    const result = spawnSync(python, ['-c', program, db, selectionPath], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: MAX_CHAIN_QUERY_STDOUT_BYTES,
    });
    if (result.error) throw new Error(`Verifier per-chain query launch failed: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`Verifier per-chain query failed with exit ${result.status}: ${result.stderr || '(empty stderr)'}`);
    if (result.signal !== null) throw new Error(`Verifier per-chain query terminated by signal ${result.signal}`);
    if (result.stderr !== '') throw new Error(`Verifier per-chain query emitted stderr on success: ${result.stderr}`);
    return parseNdjsonStrict(result.stdout);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

export async function verifyRun(argv, {
  baselineAnchor = VERIFIER_APPROVED_PREVIEW_BASELINE_ANCHOR,
  logicalRun = null,
} = {}) {
  const parsed = parseVerifierArgs(argv);
  const run = requireDirectory(parsed.run, '--run');
  const db = requireFile(parsed.db, '--db');
  const caseRoot = requireDirectory(parsed.caseroot, '--case-root');
  const python = requireFile(parsed.python, '--python');
  const commandRun = logicalRun === null ? run : path.resolve(logicalRun);
  if (logicalRun !== null) {
    const commandParent = realpathSync(path.dirname(commandRun));
    if (path.dirname(commandRun) !== commandParent || commandRun === run) {
      throw new Error('Verifier logicalRun must name a not-yet-published child of a canonical directory');
    }
  }
  const runId = path.basename(commandRun);
  const runIdParts = validateRunId(runId);

  const runBefore = await snapshotRunTreeStreaming(run, { python });
  const dbBefore = captureAbsoluteAnchored({ python, filePath: db }).record;
  let profileSnapshots = [];
  let allInventoryBefore = null;
  try {
    const manifestCapture = parseJsonFileBounded({
      python,
      root: run,
      segments: ['source-manifest.json'],
      label: 'source-manifest.json',
      maxBytes: MAX_SOURCE_MANIFEST_BYTES,
    });
    const manifest = manifestCapture.payload;
    assertBytes(manifestCapture.bytes, deterministicJson(manifest), 'source-manifest canonical JSON');
    const isPreview = manifest.schemaVersion === VERIFIER_PREVIEW_SOURCE_MANIFEST_SCHEMA;
    if (logicalRun !== null && !isPreview) {
      throw new Error('Verifier logicalRun is allowed only for private preview assembly verification');
    }
    if (!isPreview && manifest.schemaVersion !== SOURCE_MANIFEST_SCHEMA) {
      throw new Error('Source manifest schemaVersion is invalid');
    }
    assertExactFields(manifest, isPreview ? PREVIEW_MANIFEST_FIELDS : MANIFEST_FIELDS, 'Source manifest');
    assertExactFields(manifest.execution, isPreview ? PREVIEW_EXECUTION_FIELDS : EXECUTION_FIELDS, 'Source manifest execution');
    if (manifest.execution.maxDbOnlyAuditSummaryBytes !== MAX_DB_ONLY_AUDIT_SUMMARY_BYTES) {
      throw new Error('Source manifest execution.maxDbOnlyAuditSummaryBytes is invalid');
    }
    if (manifest.execution.maxSourceManifestBytes !== MAX_SOURCE_MANIFEST_BYTES) {
      throw new Error('Source manifest execution.maxSourceManifestBytes is invalid');
    }
    if (manifest.execution.maxProfileIndexBytes !== MAX_PROFILE_INDEX_BYTES) {
      throw new Error(
        'Source manifest execution.maxProfileIndexBytes compressed/decompressed ceiling is invalid',
      );
    }
    if (manifest.builderVersion !== (isPreview ? VERIFIER_PREVIEW_BUILDER_VERSION : BUILDER_VERSION)) {
      throw new Error('Source manifest builderVersion is invalid');
    }
    if (isPreview) {
      if (manifest.artifactKind !== VERIFIER_PREVIEW_ARTIFACT_KIND) throw new Error('Preview artifactKind is invalid');
      if (manifest.execution.previewStrategy !== 'anchored-selected-chain-copy') throw new Error('Preview execution strategy is invalid');
      if (manifest.execution.maxPreviewFileBytes !== VERIFIER_MAX_PREVIEW_FILE_BYTES) throw new Error('Preview file byte cap is invalid');
      if (manifest.execution.maxPreviewManifestBytes !== VERIFIER_MAX_PREVIEW_MANIFEST_BYTES) throw new Error('Preview manifest byte cap is invalid');
    }
    if (manifest.runId !== runId) throw new Error('Source manifest runId does not match run directory');
    const commit = resolveRecordedCommit(runIdParts.git12, manifest.gitCommit);
    const expectedClosure = independentlyRebuildSourceClosure(
      commit,
      isPreview ? VERIFIER_PREVIEW_SOURCE_CLOSURE_PATHS : SOURCE_CLOSURE_PATHS,
    );
    if (deterministicJson(manifest.sourceClosure) !== deterministicJson(expectedClosure)) {
      throw new Error('Source manifest sourceClosure does not match committed Git blobs');
    }
    const started = validateIsoUtcInstant(manifest.buildStartedAt, 'Source manifest buildStartedAt');
    const projectionCompleted = validateIsoUtcInstant(
      manifest.projectionCompletedAt,
      'Source manifest projectionCompletedAt',
    );
    const finalized = validateIsoUtcInstant(manifest.finalizedAt, 'Source manifest finalizedAt');
    if (projectionCompleted < started) throw new Error('Source manifest projectionCompletedAt precedes buildStartedAt');
    if (finalized < projectionCompleted) throw new Error('Source manifest finalizedAt precedes projectionCompletedAt');
    if (manifest.caseRoot !== caseRoot) throw new Error('Source manifest caseRoot does not match --case-root');
    const techniqueReplay = await independentlyLoadCommittedTechniqueReplay(commit);
    const committedTaxonomySnapshotSha256 = techniqueReplay.taxonomySnapshotSha256;
    if (manifest.taxonomySnapshotSha256 !== committedTaxonomySnapshotSha256) {
      throw new Error('Source manifest taxonomy snapshot hash does not match committed taxonomy');
    }
    if (manifest.selectionMode !== 'cases' && manifest.selectionMode !== 'all') throw new Error('Source manifest selectionMode is invalid');

    const currentDb = captureAbsoluteAnchored({ python, filePath: db }).record;
    sameRecord(manifest.database, currentDb, 'Source manifest database');
    const selections = validateSelection(manifest.selection);
    if (isPreview) {
      if (manifest.selectionMode !== 'cases') throw new Error('Preview manifest selectionMode must be cases');
      const baselineSelection = await validatePreviewBaseline({
        baseline: manifest.baseline,
        baselineAnchor,
        db,
        caseRoot,
        python,
      });
      if (deterministicJson(selections) !== deterministicJson(baselineSelection)) {
        throw new Error('Preview selection must exactly match the approved baseline selection and order');
      }
    }
    if (manifest.selectionMode === 'all') {
      allInventoryBefore = independentlyEnumerateAllSelection(caseRoot, python);
      if (deterministicJson(manifest.selection) !== deterministicJson(allInventoryBefore)) {
        throw new Error('Source manifest --all selection does not match complete safe case-root inventory');
      }
    }
    assertBytes(
      captureRunFile({
        python,
        run,
        relativePath: 'selection.json',
        maxBytes: MAX_SOURCE_MANIFEST_BYTES,
      }).bytes,
      deterministicJson(manifest.selection),
      'selection.json',
    );
    if (!Array.isArray(manifest.profileIndexes) || manifest.profileIndexes.length !== selections.length) {
      throw new Error('Source manifest profileIndexes must exactly cover selection');
    }
    const profileInputs = selections.map((selection, ordinal) => {
      const recorded = manifest.profileIndexes[ordinal];
      assertExactFields(recorded, PROFILE_RECORD_FIELDS, `Source manifest profileIndexes[${ordinal}]`);
      for (const field of ['ordinal', 'pdbId', 'authChain']) {
        if (recorded[field] !== selection[field]) throw new Error(`Source manifest profileIndexes[${ordinal}].${field} drift`);
      }
      const segments = [selection.pdbId, 'chains', selection.authChain, 'profiles', 'profile-index.json.gz'];
      const expectedPath = path.join(caseRoot, ...segments);
      if (recorded.path !== expectedPath) throw new Error(`Source manifest profile-index path drift at ordinal ${ordinal}`);
      const captured = captureAnchoredFile({
        python,
        root: caseRoot,
        segments,
        maxBytes: MAX_PROFILE_INDEX_BYTES,
        includeBytes: true,
      });
      sameRecord(
        Object.fromEntries(INPUT_RECORD_FIELDS.map((field) => [field, recorded[field]])),
        captured.record,
        `Profile-index record ${ordinal}`,
      );
      parseProfileIndexGzipBytes(captured.bytes, expectedPath);
      return {
        ...selection,
        path: expectedPath,
        segments,
        inputRecord: captured.record,
      };
    });
    profileSnapshots = profileInputs.map(({ segments, inputRecord }) => ({ segments, inputRecord }));

    const previewInventory = isPreview
      ? validatePreviewProvenance({ manifest, selections, caseRoot, python, commit, run })
      : null;

    const layout = snapshotAnchoredTree({
      python,
      root: run,
      maxBytesByRelativePath: RUN_FILE_BYTE_LIMITS,
      defaultMaxBytes: isPreview ? VERIFIER_MAX_PREVIEW_FILE_BYTES : null,
    });
    const expectedRunFiles = [
      ...expectedFiles(selections),
      ...(previewInventory?.files || []).map((file) => path.posix.join('pilot-preview', file.path)),
    ].sort(compareUtf8);
    if (deterministicJson(layout.files.map(({ path: relative }) => relative).sort(compareUtf8)) !== deterministicJson(expectedRunFiles)) {
      throw new Error('Run layout has missing or unexpected files');
    }
    const actualDirectories = layout.directories.map(({ path: relative }) => relative).filter(Boolean).sort(compareUtf8);
    const expectedRunDirectories = new Set(expectedDirectories(selections));
    for (const directory of previewInventory?.directories || []) {
      if (directory) expectedRunDirectories.add(path.posix.join('pilot-preview', directory));
    }
    if (deterministicJson(actualDirectories) !== deterministicJson([...expectedRunDirectories].sort(compareUtf8))) {
      throw new Error('Run layout has missing or unexpected directories');
    }
    if (!isPreview && layout.files.some(({ path: relative }) => relative.startsWith('pilot-preview/'))) {
      throw new Error('pilot-preview must be an empty directory');
    }

    const reports = {
      joinFailures: createExpectedReport(REPORT_HEADERS.joinFailures),
      dbOnly: createExpectedReport(REPORT_HEADERS.dbOnly),
      unmapped: createExpectedReport(REPORT_HEADERS.unmapped),
      nullTechniques: createExpectedReport(REPORT_HEADERS.nullTechniques),
    };
    const statusCounts = emptyStatusCounts();
    let sidecarCount = 0;
    let profileCount = 0;
    let dbOnlyProfileCount = 0;
    const expectedDbOnlyAuditAccumulator = createBoundedDbOnlyAuditSummaryAccumulator({
      selection: manifest.selection,
      maxBytes: MAX_DB_ONLY_AUDIT_SUMMARY_BYTES,
    });
    let unmappedTechniqueCount = 0;
    let nullTechniqueCount = 0;
    const executionState = await processSequentiallyBounded(profileInputs, async (input) => {
      const profileCapture = captureAnchoredFile({
        python,
        root: caseRoot,
        segments: input.segments,
        maxBytes: MAX_PROFILE_INDEX_BYTES,
        includeBytes: true,
      });
      sameRecord(profileCapture.record, input.inputRecord, `Profile-index processing record ${input.ordinal}`);
      const profileIndex = parseProfileIndexGzipBytes(profileCapture.bytes, input.path);
      const queried = extractRowsIndependently({
        python,
        db,
        selection: [{ pdbId: input.pdbId, authChain: input.authChain }],
      }).map((row, rowIndex) => {
        if (row.ordinal !== 0 || row.pdbId !== input.pdbId || row.authChain !== input.authChain) {
          throw new Error(`Verifier per-chain row ${rowIndex} identity drift`);
        }
        return { ...row, ordinal: input.ordinal };
      });
      const projection = independentlyProjectChain({
        selection: input,
        profileIndex,
        rows: queried,
        techniqueReplay,
      });
      const relative = sidecarRelativePath(input.pdbId, input.authChain);
      const actualGzip = captureRunFile({
        python,
        run,
        relativePath: relative,
        maxBytes: MAX_SOURCE_MANIFEST_BYTES,
      }).bytes;
      assertBytes(actualGzip, deterministicGzip(projection.payload), `Sidecar gzip ${relative}`);
      let decompressed;
      try {
        decompressed = gunzipSync(actualGzip);
      } catch (error) {
        throw new Error(`Sidecar ${relative} is not valid gzip: ${error.message}`);
      }
      assertBytes(decompressed, deterministicJson(projection.payload), `Sidecar ${relative}`);
      reports.dbOnly.append(projection.dbOnlyRows);
      expectedDbOnlyAuditAccumulator.append(
        independentlySummarizeDbOnlyRows(projection.dbOnlyRows, input),
      );
      reports.unmapped.append(projection.unmappedRows);
      reports.nullTechniques.append(projection.nullRows);
      sidecarCount += 1;
      profileCount += projection.payload.profileCount;
      dbOnlyProfileCount += projection.dbOnlyRows.length;
      unmappedTechniqueCount += projection.unmappedRows.length;
      nullTechniqueCount += projection.nullRows.length;
      for (const status of STATUS_NAMES) statusCounts[status] += projection.statusCounts[status];
    });
    const expectedDbOnlyAuditSummary = expectedDbOnlyAuditAccumulator.finish();

    await assertReportDigest({ python, run, relativePath: 'reports/profile-join-failures.tsv', expected: reports.joinFailures.finish(), label: 'join-failures report' });
    await assertReportDigest({ python, run, relativePath: 'reports/db-only-profiles.tsv', expected: reports.dbOnly.finish(), label: 'DB-only report' });
    await assertReportDigest({ python, run, relativePath: 'reports/unmapped-techniques.tsv', expected: reports.unmapped.finish(), label: 'unmapped report' });
    await assertReportDigest({ python, run, relativePath: 'reports/null-techniques.tsv', expected: reports.nullTechniques.finish(), label: 'null-techniques report' });

    const coverage = {
      schemaVersion: COVERAGE_SCHEMA,
      runId,
      chainCount: selections.length,
      sidecarCount,
      profileCount,
      statusCounts: Object.fromEntries(STATUS_NAMES.map((status) => [status, statusCounts[status]])),
      dbOnlyProfileCount,
      unmappedTechniqueCount,
      nullTechniqueCount,
    };
    assertBytes(
      captureRunFile({ python, run, relativePath: 'reports/coverage.json', maxBytes: MAX_SOURCE_MANIFEST_BYTES }).bytes,
      deterministicJson(coverage),
      'coverage report',
    );
    const expectedTotals = {
      chainCount: coverage.chainCount,
      sidecarCount: coverage.sidecarCount,
      profileCount: coverage.profileCount,
      statusCounts: coverage.statusCounts,
      dbOnlyProfileCount: coverage.dbOnlyProfileCount,
      unmappedTechniqueCount: coverage.unmappedTechniqueCount,
      nullTechniqueCount: coverage.nullTechniqueCount,
    };
    validateDbOnlyAuditSummary(manifest.dbOnlyAuditSummary, manifest.selection);
    validateDbOnlyAuditSummary(expectedDbOnlyAuditSummary, manifest.selection);
    const recordedAuditCount = manifest.dbOnlyAuditSummary.reduce((sum, row) => sum + row.count, 0);
    if (recordedAuditCount !== manifest.totals.dbOnlyProfileCount) {
      throw new Error('Source manifest DB-only audit summary count does not match recorded totals');
    }
    if (expectedDbOnlyAuditSummary.reduce((sum, row) => sum + row.count, 0) !== dbOnlyProfileCount) {
      throw new Error('Independent DB-only audit summary count does not match DB-only report projection');
    }
    if (deterministicJson(manifest.dbOnlyAuditSummary) !== deterministicJson(expectedDbOnlyAuditSummary)) {
      throw new Error('Source manifest DB-only audit summary differs from independent DuckDB projection');
    }
    const commonExpectedManifest = {
      runId,
      gitCommit: commit,
      buildStartedAt: manifest.buildStartedAt,
      projectionCompletedAt: manifest.projectionCompletedAt,
      finalizedAt: manifest.finalizedAt,
      sourceClosure: expectedClosure,
      database: currentDb,
      caseRoot,
      profileIndexes: profileInputs.map((input) => ({
        ordinal: input.ordinal,
        pdbId: input.pdbId,
        authChain: input.authChain,
        ...input.inputRecord,
      })),
      taxonomySnapshotSha256: committedTaxonomySnapshotSha256,
      selectionMode: manifest.selectionMode,
      selection: manifest.selection.map((selection) => ({ ...selection })),
      dbOnlyAuditSummary: expectedDbOnlyAuditSummary,
      totals: expectedTotals,
    };
    const baseExecution = {
      strategy: 'per-chain',
      maxBufferedChains: executionState.maxBufferedItems,
      maxExtractorStdoutBytes: MAX_CHAIN_QUERY_STDOUT_BYTES,
      maxDbOnlyAuditSummaryBytes: MAX_DB_ONLY_AUDIT_SUMMARY_BYTES,
      maxSourceManifestBytes: MAX_SOURCE_MANIFEST_BYTES,
      maxProfileIndexBytes: MAX_PROFILE_INDEX_BYTES,
    };
    const expectedManifest = isPreview ? {
      schemaVersion: VERIFIER_PREVIEW_SOURCE_MANIFEST_SCHEMA,
      builderVersion: VERIFIER_PREVIEW_BUILDER_VERSION,
      artifactKind: VERIFIER_PREVIEW_ARTIFACT_KIND,
      ...commonExpectedManifest,
      baseline: manifest.baseline,
      commands: expectedPreviewCommands({
        run: commandRun,
        runId,
        db,
        caseRoot,
        python,
        selections,
        baselineRun: baselineAnchor.run,
      }),
      execution: {
        ...baseExecution,
        previewStrategy: 'anchored-selected-chain-copy',
        maxPreviewFileBytes: VERIFIER_MAX_PREVIEW_FILE_BYTES,
        maxPreviewManifestBytes: VERIFIER_MAX_PREVIEW_MANIFEST_BYTES,
      },
      preview: manifest.preview,
    } : {
      schemaVersion: SOURCE_MANIFEST_SCHEMA,
      builderVersion: BUILDER_VERSION,
      ...commonExpectedManifest,
      commands: expectedCommands({ run: commandRun, runId, db, caseRoot, python, selections, selectionMode: manifest.selectionMode }),
      execution: baseExecution,
    };
    if (deterministicJson(manifest) !== deterministicJson(expectedManifest)) {
      const differingFields = Object.keys(expectedManifest)
        .filter((field) => deterministicJson(manifest[field]) !== deterministicJson(expectedManifest[field]));
      throw new Error(
        `Source manifest declarations do not match independently regenerated provenance: ${differingFields.join(', ')}`,
      );
    }
    assertBytes(
      captureRunFile({
        python,
        run,
        relativePath: 'reports/sha256.txt',
        maxBytes: MAX_SOURCE_MANIFEST_BYTES,
      }).bytes,
      sha256AnchoredManifest({
        python,
        root: run,
        maxBytesByRelativePath: RUN_FILE_BYTE_LIMITS,
        defaultMaxBytes: isPreview ? VERIFIER_MAX_PREVIEW_FILE_BYTES : null,
      }),
      'SHA-256 manifest',
    );
    if (allInventoryBefore !== null) {
      const allInventoryAfter = independentlyEnumerateAllSelection(caseRoot, python);
      if (deterministicJson(allInventoryBefore) !== deterministicJson(allInventoryAfter)) {
        throw new Error('Verifier --all inventory changed during verification');
      }
    }
  } finally {
    const changes = [];
    if (await snapshotRunTreeStreaming(run, { python }) !== runBefore) {
      changes.push('run tree');
    }
    const dbAfter = captureAbsoluteAnchored({ python, filePath: db }).record;
    if (deterministicJson(dbAfter) !== deterministicJson(dbBefore)) changes.push('database');
    for (const { segments, inputRecord } of profileSnapshots) {
      const after = captureAnchoredFile({
        python,
        root: caseRoot,
        segments,
        maxBytes: MAX_PROFILE_INDEX_BYTES,
        includeBytes: false,
      }).record;
      if (deterministicJson(after) !== deterministicJson(inputRecord)) {
        changes.push(`profile-index ${path.join(caseRoot, ...segments)}`);
      }
    }
    if (changes.length > 0) throw new Error(`Verifier mutated immutable inputs: ${changes.join(', ')}`);
  }
  return { run, runId };
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const result = await verifyRun(argv);
    process.stdout.write(`${result.run}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  process.exitCode = await main();
}
