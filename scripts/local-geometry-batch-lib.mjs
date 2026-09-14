import { createHash, randomBytes } from 'node:crypto';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import {
  buildLocalGeometrySidecar,
  deterministicGzip,
  deterministicJson,
  prepareDssrInput,
  sha256Bytes,
} from './local-geometry-sidecar-lib.mjs';

export const SOURCE_MANIFEST_SCHEMA = 'foldbridge-local-geometry-source.v1';
export const BATCH_RECEIPT_SCHEMA = 'foldbridge-local-geometry-batch-receipt.v1';
export const BATCH_LEDGER_SCHEMA = 'foldbridge-local-geometry-batch-ledger.v1';
export const DSSR_TOOL = 'x3dna-dssr';
export const DSSR_TOOL_VERSION = 'v1.9.10-2020apr23';
export const DSSR_CONTAINER_IMAGE = 'localhost/foldbridge-dssr:v1.9.10-c7261c0a';
export const DSSR_CONTAINER_IMAGE_ID = 'sha256:259aba597ceac6d3072cc08585fa5284db8d4712cb768a02b7ef3471b8aa0853';
export const DSSR_COMMAND = '/usr/local/bin/x3dna-dssr --json --more --non-pair -i=/work/input.cif -o=/work/output.json';
const ALLOWED_UNAVAILABLE_CODES = new Set(['PREPARE_NO_ATOM_SITE']);

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(String(left), 'utf8'), Buffer.from(String(right), 'utf8'));
}

function requireDirectory(directory, label, { create = false } = {}) {
  const resolved = path.resolve(directory);
  if (create) mkdirSync(resolved, { recursive: true });
  const stats = lstatSync(resolved);
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link: ${resolved}`);
  if (!stats.isDirectory()) throw new Error(`${label} must be a directory: ${resolved}`);
  return realpathSync(resolved);
}

function pathsOverlap(left, right) {
  const relative = path.relative(left, right);
  const reverse = path.relative(right, left);
  return relative === ''
    || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
    || (!reverse.startsWith(`..${path.sep}`) && reverse !== '..' && !path.isAbsolute(reverse));
}

function assertDistinctRoots(caseRoot, outputRoot, workRoot) {
  const roots = [
    ['case root', caseRoot],
    ['output root', outputRoot],
    ['work root', workRoot],
  ];
  for (let left = 0; left < roots.length; left += 1) {
    for (let right = left + 1; right < roots.length; right += 1) {
      if (pathsOverlap(roots[left][1], roots[right][1])) {
        throw new Error(`${roots[left][0]}, ${roots[right][0]} roots must not overlap`);
      }
    }
  }
}

export function batchInitializationParent(outputRoot) {
  return path.dirname(path.resolve(outputRoot));
}

export function candidateLockPath(outputRoot) {
  const resolved = path.resolve(outputRoot);
  return path.join(path.dirname(resolved), `.${path.basename(resolved)}.local-geometry.lock`);
}

function defaultIsProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    if (error?.code === 'EPERM') return true;
    throw error;
  }
}

export function recoverCandidateLock(outputRootInput, { isProcessAlive = defaultIsProcessAlive } = {}) {
  if (typeof isProcessAlive !== 'function') throw new Error('isProcessAlive must be a function');
  const outputRoot = requireDirectory(outputRootInput, 'output root');
  const lockPath = candidateLockPath(outputRoot);
  const lockStats = lstatOptional(lockPath);
  if (!lockStats) throw new Error(`candidate batch lock does not exist: ${lockPath}`);
  if (lockStats.isSymbolicLink() || !lockStats.isDirectory()) {
    throw new Error(`candidate batch lock must be a real directory: ${lockPath}`);
  }
  const entries = safeEntries(lockPath, 'candidate batch lock');
  if (entries.length !== 1 || entries[0].name !== 'owner.json' || !entries[0].isFile()) {
    throw new Error('candidate batch lock has an unexpected inventory');
  }
  const ownerPath = path.join(lockPath, 'owner.json');
  let owner;
  try {
    owner = JSON.parse(readFileSync(ownerPath, 'utf8'));
  } catch (error) {
    throw new Error(`candidate batch lock owner is not valid JSON: ${error.message}`);
  }
  const fields = ['acquiredAt', 'hostname', 'outputRoot', 'pid'];
  if (!owner || typeof owner !== 'object' || Array.isArray(owner)
      || Object.keys(owner).sort().join(',') !== fields.sort().join(',')
      || !Number.isSafeInteger(owner.pid) || owner.pid < 1
      || owner.hostname !== hostname()
      || owner.outputRoot !== outputRoot
      || typeof owner.acquiredAt !== 'string' || !Number.isFinite(Date.parse(owner.acquiredAt))) {
    throw new Error('candidate batch lock owner identity does not match this host and output root');
  }
  if (isProcessAlive(owner.pid)) throw new Error(`candidate batch lock owner is still active: PID ${owner.pid}`);
  rmSync(ownerPath);
  rmdirSync(lockPath);
  return owner;
}

function acquireCandidateLock(outputRoot) {
  const lockPath = candidateLockPath(outputRoot);
  try {
    mkdirSync(lockPath, { mode: 0o700 });
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`candidate batch lock is already held: ${lockPath}`);
    throw error;
  }
  const ownerPath = path.join(lockPath, 'owner.json');
  try {
    writeFileSync(ownerPath, `${JSON.stringify({
      pid: process.pid,
      hostname: hostname(),
      outputRoot: realpathSync(outputRoot),
      acquiredAt: new Date().toISOString(),
    })}\n`, { flag: 'wx' });
  } catch (error) {
    rmSync(ownerPath, { force: true });
    rmdirSync(lockPath);
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    rmSync(ownerPath, { force: true });
    rmdirSync(lockPath);
  };
}

async function withCandidateLock(outputRoot, action) {
  const release = acquireCandidateLock(outputRoot);
  try {
    return await action();
  } finally {
    release();
  }
}

function requirePlainName(value, label) {
  if (typeof value !== 'string' || value === '' || value === '.' || value === '..'
      || value.includes('/') || value.includes('\\')) {
    throw new Error(`${label} must be one non-empty path component`);
  }
  return value;
}

function requireRegularFile(filePath, label) {
  const stats = lstatSync(filePath);
  if (stats.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link: ${filePath}`);
  if (!stats.isFile()) throw new Error(`${label} must be a regular file: ${filePath}`);
  return stats;
}

function resolveContained(root, relativePath, label) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be a contained relative path`);
  }
  const parts = relativePath.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part.includes('\\'))) {
    throw new Error(`${label} must be a contained relative path`);
  }
  const absolutePath = path.resolve(root, ...parts);
  const relative = path.relative(root, absolutePath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes its root: ${relativePath}`);
  }
  return { absolutePath, parts };
}

function lstatOptional(filePath) {
  try {
    return lstatSync(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function assertContainedParents(root, parts, label, { create = false } = {}) {
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    let stats = lstatOptional(current);
    if (!stats) {
      if (!create) throw new Error(`${label} parent is missing: ${current}`);
      mkdirSync(current);
      stats = lstatSync(current);
    }
    if (stats.isSymbolicLink()) throw new Error(`${label} parent must not be a symbolic link: ${current}`);
    if (!stats.isDirectory()) throw new Error(`${label} parent must be a directory: ${current}`);
  }
}

function containedFileExists(root, relativePath, label) {
  const { parts } = resolveContained(root, relativePath, label);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const stats = lstatOptional(current);
    if (!stats) return false;
    if (stats.isSymbolicLink()) throw new Error(`${label} must not traverse a symbolic link: ${current}`);
    if (index < parts.length - 1 && !stats.isDirectory()) throw new Error(`${label} parent must be a directory: ${current}`);
    if (index === parts.length - 1 && !stats.isFile()) throw new Error(`${label} must be a regular file: ${current}`);
  }
  return true;
}

function containedRegularFile(root, relativePath, label) {
  const resolved = resolveContained(root, relativePath, label);
  assertContainedParents(root, resolved.parts, label);
  return { ...resolved, stats: requireRegularFile(resolved.absolutePath, label) };
}

function fileSnapshot(root, relativePath, label, {
  readFile = readFileSync,
  statFile = null,
  hashBytes = sha256Bytes,
} = {}) {
  const resolved = containedRegularFile(root, relativePath, label);
  const stats = statFile ? statFile(resolved.absolutePath) : resolved.stats;
  const bytes = readFile(resolved.absolutePath);
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw new Error(`${label} reader must return bytes`);
  const normalized = Buffer.from(bytes);
  if (normalized.length !== stats.size) throw new Error(`${label} changed while it was read`);
  return {
    bytes,
    descriptor: {
      path: relativePath,
      size: normalized.length,
      sha256: hashBytes(normalized),
    },
  };
}

function readFileMetadata(root, relativePath, label) {
  return fileSnapshot(root, relativePath.split(path.sep).join('/'), label).descriptor;
}

function safeEntries(directory, label) {
  return readdirSync(directory, { withFileTypes: true }).sort((left, right) => compareUtf8(left.name, right.name)).map((entry) => {
    if (entry.isSymbolicLink()) throw new Error(`${label} contains a symbolic link: ${path.join(directory, entry.name)}`);
    return entry;
  });
}

export async function buildSourceManifest(caseRootInput) {
  const caseRoot = requireDirectory(caseRootInput, 'case root');
  const cases = [];
  for (const caseEntry of safeEntries(caseRoot, 'case root')) {
    if (!caseEntry.isDirectory()) continue;
    const caseId = requirePlainName(caseEntry.name, 'caseId');
    const caseDirectory = path.join(caseRoot, caseId);
    const structure = readFileMetadata(caseRoot, path.join(caseId, 'structure.cif.gz'), `${caseId} structure`);
    const chainRoot = requireDirectory(path.join(caseDirectory, 'chains'), `${caseId} chain root`);
    const chains = [];
    for (const chainEntry of safeEntries(chainRoot, `${caseId} chain root`)) {
      if (!chainEntry.isDirectory()) continue;
      const chainId = requirePlainName(chainEntry.name, `${caseId} chainId`);
      const linkedView = readFileMetadata(
        caseRoot,
        path.join(caseId, 'chains', chainId, 'linked-view', 'linked-view.json.gz'),
        `${caseId}/${chainId} linked-view`,
      );
      chains.push({ chainId, linkedView });
    }
    if (chains.length === 0) throw new Error(`${caseId} has no linked-view chains`);
    cases.push({ caseId, structure, chains });
  }
  if (cases.length === 0) throw new Error('case root contains no cases');
  return {
    schemaVersion: SOURCE_MANIFEST_SCHEMA,
    caseCount: cases.length,
    chainCount: cases.reduce((total, entry) => total + entry.chains.length, 0),
    cases,
  };
}

function requireSha256(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256`);
  }
  return value;
}

function validateFileDescriptor(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'path,sha256,size') throw new Error(`${label} has unknown or missing fields`);
  if (typeof value.path !== 'string' || !value.path || path.isAbsolute(value.path) || value.path.split('/').includes('..')) {
    throw new Error(`${label}.path must be a contained relative path`);
  }
  if (!Number.isSafeInteger(value.size) || value.size < 0) throw new Error(`${label}.size must be a non-negative integer`);
  requireSha256(value.sha256, `${label}.sha256`);
}

function validateSourceManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('source manifest must be an object');
  if (manifest.schemaVersion !== SOURCE_MANIFEST_SCHEMA) throw new Error(`source manifest schema must be ${SOURCE_MANIFEST_SCHEMA}`);
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) throw new Error('source manifest cases must be non-empty');
  const seenCases = new Set();
  let chainCount = 0;
  let priorCase = null;
  for (const caseEntry of manifest.cases) {
    const caseId = requirePlainName(caseEntry?.caseId, 'source manifest caseId');
    if (seenCases.has(caseId)) throw new Error(`duplicate source manifest caseId ${caseId}`);
    if (priorCase !== null && compareUtf8(priorCase, caseId) >= 0) throw new Error('source manifest cases must use stable UTF-8 order');
    priorCase = caseId;
    seenCases.add(caseId);
    validateFileDescriptor(caseEntry.structure, `${caseId} structure`);
    const expectedStructurePath = path.posix.join(caseId, 'structure.cif.gz');
    if (caseEntry.structure.path !== expectedStructurePath) {
      throw new Error(`${caseId} structure.path must equal ${expectedStructurePath}`);
    }
    if (!Array.isArray(caseEntry.chains) || caseEntry.chains.length === 0) throw new Error(`${caseId} chains must be non-empty`);
    const seenChains = new Set();
    let priorChain = null;
    for (const chain of caseEntry.chains) {
      const chainId = requirePlainName(chain?.chainId, `${caseId} chainId`);
      if (seenChains.has(chainId)) throw new Error(`duplicate source manifest chain ${caseId}/${chainId}`);
      if (priorChain !== null && compareUtf8(priorChain, chainId) >= 0) throw new Error(`${caseId} chains must use stable UTF-8 order`);
      priorChain = chainId;
      seenChains.add(chainId);
      validateFileDescriptor(chain.linkedView, `${caseId}/${chainId} linked-view`);
      const expectedLinkedPath = path.posix.join(caseId, 'chains', chainId, 'linked-view', 'linked-view.json.gz');
      if (chain.linkedView.path !== expectedLinkedPath) {
        throw new Error(`${caseId}/${chainId} linked-view.path must equal ${expectedLinkedPath}`);
      }
      chainCount += 1;
    }
  }
  if (manifest.caseCount !== manifest.cases.length) throw new Error('source manifest caseCount mismatch');
  if (manifest.chainCount !== chainCount) throw new Error('source manifest chainCount mismatch');
  return manifest;
}

function validateProvenance(provenance) {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) throw new Error('provenance must be an object');
  const required = ['tool', 'toolVersion', 'containerImage', 'containerImageId', 'command'];
  const keys = Object.keys(provenance).sort();
  if (keys.join(',') !== [...required].sort().join(',')) throw new Error('provenance has unknown or missing fields');
  for (const name of required) {
    if (typeof provenance[name] !== 'string' || provenance[name].trim() !== provenance[name] || !provenance[name]) {
      throw new Error(`provenance.${name} must be a non-empty string`);
    }
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(provenance.containerImageId)) {
    throw new Error('provenance.containerImageId must be an exact image SHA-256');
  }
  const pinned = {
    tool: DSSR_TOOL,
    toolVersion: DSSR_TOOL_VERSION,
    containerImage: DSSR_CONTAINER_IMAGE,
    containerImageId: DSSR_CONTAINER_IMAGE_ID,
    command: DSSR_COMMAND,
  };
  for (const [name, expected] of Object.entries(pinned)) {
    if (provenance[name] !== expected) throw new Error(`provenance.${name} must equal ${expected}`);
  }
  return provenance;
}

export function readVerifiedInput(caseRoot, descriptor, label, dependencies = {}) {
  const current = fileSnapshot(caseRoot, descriptor.path, label, dependencies);
  if (current.descriptor.size !== descriptor.size || current.descriptor.sha256 !== descriptor.sha256) {
    throw new Error(`${label} differs from source manifest`);
  }
  return current.bytes;
}

function parseJsonBytes(bytes, label) {
  const decoded = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  try {
    return JSON.parse(decoded.toString('utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function atomicWrite(root, relativePath, bytes) {
  const resolved = resolveContained(root, relativePath, `candidate output ${relativePath}`);
  assertContainedParents(root, resolved.parts, `candidate output ${relativePath}`, { create: true });
  const prior = lstatOptional(resolved.absolutePath);
  if (prior?.isSymbolicLink()) throw new Error(`candidate output must not be a symbolic link: ${resolved.absolutePath}`);
  if (prior && !prior.isFile()) throw new Error(`candidate output must be a regular file: ${resolved.absolutePath}`);
  const directory = path.dirname(resolved.absolutePath);
  const temporary = path.join(directory, `.${path.basename(resolved.absolutePath)}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`);
  try {
    writeFileSync(temporary, bytes, { flag: 'wx' });
    assertContainedParents(root, resolved.parts, `candidate output ${relativePath}`);
    const current = lstatOptional(resolved.absolutePath);
    if (current?.isSymbolicLink()) throw new Error(`candidate output must not be a symbolic link: ${resolved.absolutePath}`);
    if (current && !current.isFile()) throw new Error(`candidate output must be a regular file: ${resolved.absolutePath}`);
    renameSync(temporary, resolved.absolutePath);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function atomicJson(root, relativePath, value) {
  atomicWrite(root, relativePath, Buffer.from(deterministicJson(value), 'utf8'));
}

function outputRelativePath(caseId, chainId) {
  return path.posix.join('cases', caseId, 'chains', chainId, 'linked-view', 'local-geometry.json.gz');
}

function receiptRelativePath(caseId) {
  return path.posix.join('_batch', 'receipts', `${caseId}.json`);
}

function stateRelativePath(caseId) {
  return path.posix.join('_batch', 'status', `${caseId}.json`);
}

function sameJson(left, right) {
  return deterministicJson(left) === deterministicJson(right);
}

function expectedReceiptInputs(caseEntry, provenance) {
  return {
    structure: caseEntry.structure,
    linkedViews: caseEntry.chains.map(({ chainId, linkedView }) => ({ chainId, ...linkedView })),
    provenance,
  };
}

function expectedInputSha256(caseEntry, provenance) {
  return sha256Bytes(Buffer.from(deterministicJson(expectedReceiptInputs(caseEntry, provenance)), 'utf8'));
}

function outputDescriptor(outputRoot, relativePath) {
  return readFileMetadata(outputRoot, relativePath, `batch output ${relativePath}`);
}

function verifiedReceipt(outputRoot, caseEntry, provenance, expectedUnavailable) {
  const relativePath = receiptRelativePath(caseEntry.caseId);
  let receipt;
  try {
    const file = containedRegularFile(outputRoot, relativePath, `${caseEntry.caseId} receipt`);
    receipt = JSON.parse(readFileSync(file.absolutePath, 'utf8'));
  } catch (_error) {
    return null;
  }
  if (receipt?.schemaVersion !== BATCH_RECEIPT_SCHEMA || receipt.caseId !== caseEntry.caseId) return null;
  if (!sameJson(receipt.inputs, expectedReceiptInputs(caseEntry, provenance))) return null;
  const allowedCode = expectedUnavailable.get(caseEntry.caseId);
  if (receipt.status === 'not_computable') {
    if (receipt.errorCode !== allowedCode || !Array.isArray(receipt.outputs) || receipt.outputs.length !== 0) return null;
    for (const { chainId } of caseEntry.chains) {
      const outputPath = outputRelativePath(caseEntry.caseId, chainId);
      if (containedFileExists(outputRoot, outputPath, `batch output ${outputPath}`)) return null;
    }
    return receipt;
  }
  if (receipt.status !== 'computed' || receipt.errorCode !== null || !Array.isArray(receipt.outputs)
      || receipt.outputs.length !== caseEntry.chains.length) return null;
  const expectedPaths = caseEntry.chains.map(({ chainId }) => outputRelativePath(caseEntry.caseId, chainId));
  for (let index = 0; index < expectedPaths.length; index += 1) {
    const recorded = receipt.outputs[index];
    if (recorded.path !== expectedPaths[index]) return null;
    try {
      const current = outputDescriptor(outputRoot, recorded.path);
      if (!sameJson(current, recorded)) return null;
    } catch (_error) {
      return null;
    }
  }
  return receipt;
}

function classifyError(stage, error) {
  const message = error?.message || String(error);
  if (stage === 'prepare' && /no _atom_site loop|_atom_site contains no rows/i.test(message)) {
    return { errorCode: 'PREPARE_NO_ATOM_SITE', message };
  }
  return { errorCode: `${stage.toUpperCase()}_FAILED`, message };
}

function ledgerFromStates(sourceManifest, provenance, states) {
  const cases = sourceManifest.cases.map(({ caseId }) => states.get(caseId));
  const counts = {
    computedCases: cases.filter(({ status }) => status === 'computed').length,
    unavailableCases: cases.filter(({ status }) => status === 'not_computable').length,
    failedCases: cases.filter(({ status }) => status === 'failed').length,
    computedChains: cases.filter(({ status }) => status === 'computed').reduce((sum, item) => sum + item.chainCount, 0),
    unavailableChains: cases.filter(({ status }) => status === 'not_computable').reduce((sum, item) => sum + item.chainCount, 0),
  };
  return {
    schemaVersion: BATCH_LEDGER_SCHEMA,
    sourceManifestSha256: sha256Bytes(Buffer.from(deterministicJson(sourceManifest), 'utf8')),
    provenance,
    caseCount: sourceManifest.caseCount,
    chainCount: sourceManifest.chainCount,
    counts,
    cases,
  };
}

function sourceManifestSha256(sourceManifest) {
  return sha256Bytes(Buffer.from(deterministicJson(sourceManifest), 'utf8'));
}

async function assertCurrentSourceInventory(caseRoot, sourceManifest) {
  const current = await buildSourceManifest(caseRoot);
  if (!sameJson(current, sourceManifest)) throw new Error('current source inventory differs from source manifest');
}

function validateExpectedUnavailable(expectedUnavailable, sourceManifest) {
  if (!(expectedUnavailable instanceof Map)) throw new Error('expectedUnavailable must be a Map');
  const knownCases = new Set(sourceManifest.cases.map(({ caseId }) => caseId));
  for (const [caseIdValue, errorCode] of expectedUnavailable) {
    const caseId = requirePlainName(caseIdValue, 'expected unavailable caseId');
    if (!knownCases.has(caseId)) throw new Error(`unknown unavailable case ${caseId}`);
    if (!ALLOWED_UNAVAILABLE_CODES.has(errorCode)) throw new Error(`unsupported unavailable code ${errorCode}`);
  }
}

function pendingState(caseEntry, provenance, attempts = 0) {
  return {
    caseId: caseEntry.caseId,
    chainCount: caseEntry.chains.length,
    status: 'pending',
    stage: 'pending',
    errorCode: null,
    message: null,
    attempts,
    inputSha256: expectedInputSha256(caseEntry, provenance),
  };
}

function validateState(state, caseEntry, provenance, { finalReceipt = null } = {}) {
  const fields = ['attempts', 'caseId', 'chainCount', 'errorCode', 'inputSha256', 'message', 'stage', 'status'];
  if (!state || typeof state !== 'object' || Array.isArray(state)
      || Object.keys(state).sort().join(',') !== fields.sort().join(',')) {
    throw new Error(`${caseEntry.caseId} state verification failed`);
  }
  if (state.caseId !== caseEntry.caseId || state.chainCount !== caseEntry.chains.length
      || state.inputSha256 !== expectedInputSha256(caseEntry, provenance)
      || !Number.isSafeInteger(state.attempts) || state.attempts < 0
      || !['pending', 'running', 'computed', 'not_computable', 'failed'].includes(state.status)
      || !['pending', 'read', 'prepare', 'dssr', 'build', 'complete'].includes(state.stage)
      || (state.errorCode !== null && typeof state.errorCode !== 'string')
      || (state.message !== null && typeof state.message !== 'string')) {
    throw new Error(`${caseEntry.caseId} state verification failed`);
  }
  const finalStageValid = finalReceipt?.status === 'computed'
    ? state.stage === 'complete'
    : state.stage !== 'pending' && state.stage !== 'complete';
  if (finalReceipt && (state.status !== finalReceipt.status || !finalStageValid
      || state.errorCode !== finalReceipt.errorCode || (state.message ?? null) !== (finalReceipt.message ?? null)
      || state.attempts < 1)) {
    throw new Error(`${caseEntry.caseId} final state verification failed`);
  }
  return state;
}

function candidateTree(outputRoot) {
  const files = [];
  const directories = [];
  function walk(absoluteDirectory, relativeDirectory = '') {
    for (const entry of safeEntries(absoluteDirectory, 'candidate output')) {
      const relative = relativeDirectory ? path.posix.join(relativeDirectory, entry.name) : entry.name;
      if (entry.isDirectory()) {
        directories.push(relative);
        walk(path.join(absoluteDirectory, entry.name), relative);
      } else if (entry.isFile()) {
        files.push(relative);
      } else {
        throw new Error(`candidate output contains unsupported entry: ${relative}`);
      }
    }
  }
  walk(outputRoot);
  return { files, directories };
}

function possibleCandidateFiles(sourceManifest) {
  const files = new Set(['_batch/ledger.json']);
  for (const caseEntry of sourceManifest.cases) {
    files.add(receiptRelativePath(caseEntry.caseId));
    files.add(stateRelativePath(caseEntry.caseId));
    for (const { chainId } of caseEntry.chains) files.add(outputRelativePath(caseEntry.caseId, chainId));
  }
  return files;
}

function possibleCandidateDirectories(files) {
  const directories = new Set();
  for (const file of files) {
    let directory = path.posix.dirname(file);
    while (directory !== '.') {
      directories.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  return directories;
}

function assertResumeCandidateShape(outputRoot, sourceManifest) {
  const tree = candidateTree(outputRoot);
  const allowedFiles = possibleCandidateFiles(sourceManifest);
  const allowedDirectories = possibleCandidateDirectories(allowedFiles);
  for (const file of tree.files) {
    if (!allowedFiles.has(file)) throw new Error(`unexpected candidate file: ${file}`);
  }
  for (const directory of tree.directories) {
    if (!allowedDirectories.has(directory)) throw new Error(`unexpected candidate directory: ${directory}`);
  }
  return tree;
}

function readCandidateJson(outputRoot, relativePath, label) {
  const file = containedRegularFile(outputRoot, relativePath, label);
  try {
    return JSON.parse(readFileSync(file.absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function initializeBatchSnapshot(outputRoot, sourceManifest, provenance) {
  const states = new Map(sourceManifest.cases.map((caseEntry) => [
    caseEntry.caseId,
    pendingState(caseEntry, provenance),
  ]));
  const parent = batchInitializationParent(outputRoot);
  const temporaryRoot = mkdtempSync(path.join(parent, `.${path.basename(outputRoot)}.batch-init-`));
  try {
    for (const state of states.values()) atomicJson(temporaryRoot, path.posix.join('status', `${state.caseId}.json`), state);
    atomicJson(temporaryRoot, 'ledger.json', ledgerFromStates(sourceManifest, provenance, states));
    renameSync(temporaryRoot, path.join(outputRoot, '_batch'));
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
  return states;
}

function loadResumeSnapshot(outputRoot, sourceManifest, provenance) {
  const ledger = readCandidateJson(outputRoot, '_batch/ledger.json', 'resume ledger');
  if (ledger?.schemaVersion !== BATCH_LEDGER_SCHEMA
      || ledger.sourceManifestSha256 !== sourceManifestSha256(sourceManifest)
      || !sameJson(ledger.provenance, provenance)) {
    throw new Error('resume ledger does not match source manifest and provenance');
  }
  const states = new Map();
  for (const caseEntry of sourceManifest.cases) {
    const state = validateState(
      readCandidateJson(outputRoot, stateRelativePath(caseEntry.caseId), `${caseEntry.caseId} resume state`),
      caseEntry,
      provenance,
    );
    states.set(caseEntry.caseId, state);
  }
  return states;
}

function writeState(outputRoot, states, state) {
  states.set(state.caseId, state);
  atomicJson(outputRoot, stateRelativePath(state.caseId), state);
}

function removeCandidateOutput(outputRoot, relativePath) {
  const resolved = resolveContained(outputRoot, relativePath, `candidate output ${relativePath}`);
  let current = outputRoot;
  for (let index = 0; index < resolved.parts.length; index += 1) {
    current = path.join(current, resolved.parts[index]);
    const stats = lstatOptional(current);
    if (!stats) return;
    if (stats.isSymbolicLink()) throw new Error(`candidate output must not traverse a symbolic link: ${current}`);
    if (index < resolved.parts.length - 1 && !stats.isDirectory()) {
      throw new Error(`candidate output parent must be a directory: ${current}`);
    }
    if (index === resolved.parts.length - 1) {
      if (!stats.isFile()) throw new Error(`candidate output must be a regular file: ${current}`);
      rmSync(current);
    }
  }
}

export async function runLocalGeometryBatch({
  caseRoot: caseRootInput,
  outputRoot: outputRootInput,
  workRoot: workRootInput,
  sourceManifest: sourceManifestInput,
  provenance: provenanceInput,
  concurrency,
  expectedUnavailable = new Map(),
  runDssr,
  resume = false,
  abortSignal = null,
}) {
  assertDistinctRoots(path.resolve(caseRootInput), path.resolve(outputRootInput), path.resolve(workRootInput));
  const caseRoot = requireDirectory(caseRootInput, 'case root');
  const outputRoot = requireDirectory(outputRootInput, 'output root', { create: true });
  const workRoot = requireDirectory(workRootInput, 'work root', { create: true });
  assertDistinctRoots(caseRoot, outputRoot, workRoot);
  const sourceManifest = validateSourceManifest(sourceManifestInput);
  const provenance = validateProvenance(provenanceInput);
  validateExpectedUnavailable(expectedUnavailable, sourceManifest);
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 256) throw new Error('concurrency must be an integer from 1 to 256');
  if (typeof runDssr !== 'function') throw new Error('runDssr must be a function');
  if (abortSignal !== null && (typeof abortSignal !== 'object' || typeof abortSignal.aborted !== 'boolean')) {
    throw new Error('abortSignal must be an AbortSignal');
  }
  return withCandidateLock(outputRoot, async () => {
    await assertCurrentSourceInventory(caseRoot, sourceManifest);

    let states;
    const existing = candidateTree(outputRoot);
    if (!resume) {
      if (existing.files.length || existing.directories.length) throw new Error('output root must be empty for a fresh run');
      states = initializeBatchSnapshot(outputRoot, sourceManifest, provenance);
    } else if (!existing.files.length && !existing.directories.length) {
      states = initializeBatchSnapshot(outputRoot, sourceManifest, provenance);
    } else {
      assertResumeCandidateShape(outputRoot, sourceManifest);
      states = loadResumeSnapshot(outputRoot, sourceManifest, provenance);
    }

    let nextIndex = 0;
    async function processCase(caseEntry) {
    const previous = states.get(caseEntry.caseId);
    if (resume) {
      const receipt = verifiedReceipt(outputRoot, caseEntry, provenance, expectedUnavailable);
      if (receipt) {
        writeState(outputRoot, states, {
          ...previous,
          status: receipt.status,
          stage: receipt.status === 'computed' ? 'complete' : 'prepare',
          errorCode: receipt.errorCode,
          message: receipt.message ?? null,
        });
        return;
      }
    }

    const attempts = previous.attempts + 1;
    writeState(outputRoot, states, { ...previous, status: 'running', stage: 'read', attempts });
    let stage = 'read';
    let jobDirectory = null;
    try {
      const structureBytes = readVerifiedInput(caseRoot, caseEntry.structure, `${caseEntry.caseId} structure`);
      stage = 'prepare';
      writeState(outputRoot, states, { ...states.get(caseEntry.caseId), stage });
      const prepared = prepareDssrInput(structureBytes);
      jobDirectory = mkdtempSync(path.join(workRoot, `${caseEntry.caseId}-`));
      const inputPath = path.join(jobDirectory, 'input.cif');
      writeFileSync(inputPath, prepared.bytes, { flag: 'wx' });
      stage = 'dssr';
      writeState(outputRoot, states, { ...states.get(caseEntry.caseId), stage });
      const rawDssr = await runDssr({ caseId: caseEntry.caseId, inputPath, jobDirectory, prepared, signal: abortSignal });
      const dssr = Buffer.isBuffer(rawDssr) || rawDssr instanceof Uint8Array
        ? parseJsonBytes(Buffer.from(rawDssr), `${caseEntry.caseId} DSSR output`)
        : rawDssr;
      stage = 'build';
      writeState(outputRoot, states, { ...states.get(caseEntry.caseId), stage });
      const pendingOutputs = [];
      for (const chain of caseEntry.chains) {
        const linkedBytes = readVerifiedInput(caseRoot, chain.linkedView, `${caseEntry.caseId}/${chain.chainId} linked-view`);
        const payload = buildLocalGeometrySidecar({
          structureBytes,
          dssrInputBytes: prepared.bytes,
          prepareMeta: prepared.meta,
          dssr,
          linkedView: parseJsonBytes(linkedBytes, `${caseEntry.caseId}/${chain.chainId} linked-view`),
          caseId: caseEntry.caseId,
          chainId: chain.chainId,
          ...provenance,
        });
        const relativePath = outputRelativePath(caseEntry.caseId, chain.chainId);
        const bytes = deterministicGzip(payload);
        pendingOutputs.push({ relativePath, bytes });
      }
      for (const output of pendingOutputs) atomicWrite(outputRoot, output.relativePath, output.bytes);
      const outputs = pendingOutputs.map(({ relativePath }) => outputDescriptor(outputRoot, relativePath));
      const receipt = {
        schemaVersion: BATCH_RECEIPT_SCHEMA,
        caseId: caseEntry.caseId,
        status: 'computed',
        errorCode: null,
        message: null,
        inputs: expectedReceiptInputs(caseEntry, provenance),
        outputs,
      };
      atomicJson(outputRoot, receiptRelativePath(caseEntry.caseId), receipt);
      writeState(outputRoot, states, {
        ...states.get(caseEntry.caseId), status: 'computed', stage: 'complete', errorCode: null, message: null,
      });
    } catch (error) {
      const classified = classifyError(stage, error);
      const allowed = expectedUnavailable.get(caseEntry.caseId) === classified.errorCode;
      const status = allowed ? 'not_computable' : 'failed';
      for (const { chainId } of caseEntry.chains) {
        removeCandidateOutput(outputRoot, outputRelativePath(caseEntry.caseId, chainId));
      }
      const receipt = {
        schemaVersion: BATCH_RECEIPT_SCHEMA,
        caseId: caseEntry.caseId,
        status,
        errorCode: classified.errorCode,
        message: classified.message,
        inputs: expectedReceiptInputs(caseEntry, provenance),
        outputs: [],
      };
      atomicJson(outputRoot, receiptRelativePath(caseEntry.caseId), receipt);
      writeState(outputRoot, states, {
        ...states.get(caseEntry.caseId), status, stage, errorCode: classified.errorCode, message: classified.message,
      });
    } finally {
      if (jobDirectory) rmSync(jobDirectory, { recursive: true, force: true });
    }
    }

    async function worker() {
      while (true) {
        if (abortSignal?.aborted) return;
        const index = nextIndex;
        nextIndex += 1;
        if (index >= sourceManifest.cases.length) return;
        await processCase(sourceManifest.cases[index]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, sourceManifest.caseCount) }, () => worker()));
    const ledger = ledgerFromStates(sourceManifest, provenance, states);
    atomicJson(outputRoot, '_batch/ledger.json', ledger);
    await assertCurrentSourceInventory(caseRoot, sourceManifest);
    if (abortSignal?.aborted) {
      const reason = abortSignal.reason?.message || abortSignal.reason || 'signal received';
      throw new Error(`batch aborted: ${reason}`);
    }
    if (ledger.counts.failedCases > 0) {
      throw new Error(`unexpected batch failures: ${ledger.counts.failedCases} cases`);
    }
    for (const caseId of expectedUnavailable.keys()) {
      if (states.get(caseId)?.status !== 'not_computable') {
        throw new Error(`expected unavailable case ${caseId} did not finish as not_computable`);
      }
    }
    verifyCandidateOutput(outputRoot, sourceManifest, provenance, expectedUnavailable);
    return ledger;
  });
}

function verifyCandidateOutput(outputRoot, sourceManifest, provenance, expectedUnavailable) {
  const receipts = new Map();
  const states = new Map();
  const expectedFiles = new Set(['_batch/ledger.json']);
  for (const caseEntry of sourceManifest.cases) {
    const receipt = verifiedReceipt(outputRoot, caseEntry, provenance, expectedUnavailable);
    if (!receipt) {
      throw new Error(`batch receipt or output verification failed for ${caseEntry.caseId}`);
    }
    receipts.set(caseEntry.caseId, receipt);
    expectedFiles.add(receiptRelativePath(caseEntry.caseId));
    expectedFiles.add(stateRelativePath(caseEntry.caseId));
    for (const output of receipt.outputs) expectedFiles.add(output.path);
    const state = validateState(
      readCandidateJson(outputRoot, stateRelativePath(caseEntry.caseId), `${caseEntry.caseId} state`),
      caseEntry,
      provenance,
      { finalReceipt: receipt },
    );
    states.set(caseEntry.caseId, state);
  }
  for (const caseId of expectedUnavailable.keys()) {
    if (receipts.get(caseId)?.status !== 'not_computable') {
      throw new Error(`batch receipt or output verification failed for expected unavailable case ${caseId}`);
    }
  }
  const actualLedger = readCandidateJson(outputRoot, '_batch/ledger.json', 'batch ledger');
  const expectedLedger = ledgerFromStates(sourceManifest, provenance, states);
  if (!sameJson(actualLedger, expectedLedger)) throw new Error('batch ledger verification failed');
  const actualFiles = candidateTree(outputRoot).files;
  const expectedList = [...expectedFiles].sort(compareUtf8);
  const actualList = [...actualFiles].sort(compareUtf8);
  if (!sameJson(actualList, expectedList)) {
    const unexpected = actualFiles.find((file) => !expectedFiles.has(file));
    if (unexpected) throw new Error(`unexpected candidate file: ${unexpected}`);
    throw new Error('candidate file inventory verification failed');
  }
  return true;
}

export async function verifyBatchOutput({
  caseRoot: caseRootInput,
  outputRoot: outputRootInput,
  sourceManifest: sourceManifestInput,
  provenance: provenanceInput,
  expectedUnavailable = new Map(),
}) {
  const caseRoot = requireDirectory(caseRootInput, 'case root');
  const outputRoot = requireDirectory(outputRootInput, 'output root');
  if (pathsOverlap(caseRoot, outputRoot)) throw new Error('case root and output root roots must not overlap');
  const sourceManifest = validateSourceManifest(sourceManifestInput);
  const provenance = validateProvenance(provenanceInput);
  validateExpectedUnavailable(expectedUnavailable, sourceManifest);
  return withCandidateLock(outputRoot, async () => {
    await assertCurrentSourceInventory(caseRoot, sourceManifest);
    return verifyCandidateOutput(outputRoot, sourceManifest, provenance, expectedUnavailable);
  });
}
