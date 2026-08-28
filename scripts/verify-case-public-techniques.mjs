#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  sha256AnchoredManifest,
  sidecarRelativePath,
  taxonomySnapshotSha256,
  snapshotAnchoredTree,
  validateExtractorRow,
  validateDbOnlyAuditSummary,
  validateIsoUtcInstant,
  validateProfileIndex,
  validateRunId,
} from './case-public-techniques-lib.mjs';
import {
  MECHANISM_FAMILIES,
  classifyTechniqueFilter,
} from '../src/techniqueFilterModel.js';
import {
  PROFILE_PUBLIC_TECHNIQUES_SCHEMA,
  validateProfilePublicTechniques,
} from '../public/entry-cases/__entry_v3_site__/workbench-pure.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');
const BUILDER_PATH = path.join(REPO_ROOT, 'scripts', 'build-case-public-techniques.mjs');
const BUILDER_EXTRACTOR_PATH = path.join(REPO_ROOT, 'scripts', 'extract-case-public-techniques.py');
const REQUIRED_FLAGS = ['--run', '--db', '--case-root', '--python'];
const MAX_CHAIN_QUERY_STDOUT_BYTES = 32 * 1024 * 1024;
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
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: null, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed: ${result.error?.message || result.stderr?.toString('utf8') || 'git error'}`);
  }
  return result.stdout;
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

function independentlyRebuildSourceClosure(commit) {
  return SOURCE_CLOSURE_PATHS.map((relativePath) => {
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

function singleTokenClassifier(label) {
  const result = classifyTechniqueFilter(label);
  if (!isRecord(result) || !Array.isArray(result.methods) || result.methods.length !== 1) {
    throw new Error(`Shared classifier did not return exactly one method for ${JSON.stringify(label)}`);
  }
  return { ...result.methods[0] };
}

function classifyRawRow(row) {
  if (row.techFilter !== null && typeof row.techFilter !== 'string') throw new Error(`DB row profile ${row.profileId} techFilter must be string or null`);
  if (row.isBackgroundChannel !== null && typeof row.isBackgroundChannel !== 'boolean') {
    throw new Error(`DB row profile ${row.profileId} isBackgroundChannel must be boolean or null`);
  }
  let methods = [];
  let status;
  if (typeof row.techFilter === 'string' && row.techFilter.trim().length > 0) {
    const result = classifyTechniqueFilter(row.techFilter);
    if (!isRecord(result) || !Array.isArray(result.methods)) throw new Error('Shared classifier returned a malformed result');
    methods = result.methods.map((method) => ({ ...method }));
    if (methods.length > 0) status = result.classificationStatus;
  }
  if (methods.length === 0) status = row.isBackgroundChannel === true ? 'background' : 'missing';
  if (!STATUS_NAMES.includes(status)) throw new Error(`Shared classifier returned invalid status ${JSON.stringify(status)}`);
  return { status, methods };
}

function independentlyProjectChain({ selection, profileIndex, rows }) {
  const profileIds = validateProfileIndex(profileIndex, `profile-index for ${selection.pdbId}/${selection.authChain}`);
  const byProfileId = new Map();
  const classifications = new Map();
  const unmappedRows = [];
  const nullRows = [];
  rows.forEach((row, rowIndex) => {
    validateExtractorRow(row, { rowIndex, ordinal: selection.ordinal, pdbId: selection.pdbId, authChain: selection.authChain });
    if (byProfileId.has(row.profileId)) throw new Error(`Verifier found duplicate DB profileId "${row.profileId}"`);
    byProfileId.set(row.profileId, row);
    const classified = classifyRawRow(row);
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
    schemaVersion: PROFILE_PUBLIC_TECHNIQUES_SCHEMA,
    pdbId: selection.pdbId,
    authChain: selection.authChain,
    profileCount: profiles.length,
    profiles,
  };
  validateProfilePublicTechniques(payload, profileIndex, {
    pdbId: selection.pdbId,
    authChain: selection.authChain,
    categories: MECHANISM_FAMILIES,
    classifyTechniqueToken: singleTokenClassifier,
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

export async function verifyRun(argv) {
  const parsed = parseVerifierArgs(argv);
  const run = requireDirectory(parsed.run, '--run');
  const db = requireFile(parsed.db, '--db');
  const caseRoot = requireDirectory(parsed.caseroot, '--case-root');
  const python = requireFile(parsed.python, '--python');
  const runId = path.basename(run);
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
    if (manifest.schemaVersion !== SOURCE_MANIFEST_SCHEMA) throw new Error('Source manifest schemaVersion is invalid');
    assertExactFields(manifest, MANIFEST_FIELDS, 'Source manifest');
    assertExactFields(manifest.execution, EXECUTION_FIELDS, 'Source manifest execution');
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
    if (manifest.builderVersion !== BUILDER_VERSION) throw new Error('Source manifest builderVersion is invalid');
    if (manifest.runId !== runId) throw new Error('Source manifest runId does not match run directory');
    const commit = resolveRecordedCommit(runIdParts.git12, manifest.gitCommit);
    const expectedClosure = independentlyRebuildSourceClosure(commit);
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
    if (manifest.taxonomySnapshotSha256 !== taxonomySnapshotSha256()) {
      throw new Error('Source manifest taxonomy snapshot hash does not match shared taxonomy');
    }
    if (manifest.selectionMode !== 'cases' && manifest.selectionMode !== 'all') throw new Error('Source manifest selectionMode is invalid');

    const currentDb = captureAbsoluteAnchored({ python, filePath: db }).record;
    sameRecord(manifest.database, currentDb, 'Source manifest database');
    const selections = validateSelection(manifest.selection);
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

    const layout = snapshotAnchoredTree({
      python,
      root: run,
      maxBytesByRelativePath: RUN_FILE_BYTE_LIMITS,
    });
    if (deterministicJson(layout.files.map(({ path: relative }) => relative).sort(compareUtf8)) !== deterministicJson(expectedFiles(selections))) {
      throw new Error('Run layout has missing or unexpected files');
    }
    const actualDirectories = layout.directories.map(({ path: relative }) => relative).filter(Boolean).sort(compareUtf8);
    if (deterministicJson(actualDirectories) !== deterministicJson(expectedDirectories(selections))) {
      throw new Error('Run layout has missing or unexpected directories');
    }
    if (layout.files.some(({ path: relative }) => relative.startsWith('pilot-preview/'))) {
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
      const projection = independentlyProjectChain({ selection: input, profileIndex, rows: queried });
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
    const expectedManifest = {
      schemaVersion: SOURCE_MANIFEST_SCHEMA,
      builderVersion: BUILDER_VERSION,
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
      taxonomySnapshotSha256: taxonomySnapshotSha256(),
      selectionMode: manifest.selectionMode,
      selection: manifest.selection.map((selection) => ({ ...selection })),
      dbOnlyAuditSummary: expectedDbOnlyAuditSummary,
      commands: expectedCommands({ run, runId, db, caseRoot, python, selections, selectionMode: manifest.selectionMode }),
      execution: {
        strategy: 'per-chain',
        maxBufferedChains: executionState.maxBufferedItems,
        maxExtractorStdoutBytes: MAX_CHAIN_QUERY_STDOUT_BYTES,
        maxDbOnlyAuditSummaryBytes: MAX_DB_ONLY_AUDIT_SUMMARY_BYTES,
        maxSourceManifestBytes: MAX_SOURCE_MANIFEST_BYTES,
        maxProfileIndexBytes: MAX_PROFILE_INDEX_BYTES,
      },
      totals: expectedTotals,
    };
    if (deterministicJson(manifest) !== deterministicJson(expectedManifest)) {
      throw new Error('Source manifest declarations do not match independently regenerated provenance');
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
