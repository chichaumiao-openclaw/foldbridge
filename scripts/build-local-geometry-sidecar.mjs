#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import {
  realpathSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildLocalGeometrySidecar,
  deterministicGzip,
  deterministicJson,
  parseJsonBytes,
  prepareDssrInput,
} from './local-geometry-sidecar-lib.mjs';

function parseFlags(argv, required, optional = []) {
  const allowed = new Set([...required, ...optional]);
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (typeof flag !== 'string' || !flag.startsWith('--') || value === undefined) {
      throw new Error('arguments must be explicit --name value pairs');
    }
    const name = flag.slice(2);
    if (!allowed.has(name)) throw new Error(`unknown argument --${name}`);
    if (Object.hasOwn(values, name)) throw new Error(`duplicate argument --${name}`);
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`--${name} must not be blank`);
    values[name] = value;
  }
  const missing = required.filter((name) => !Object.hasOwn(values, name));
  if (missing.length) throw new Error(`missing required arguments: ${missing.map((name) => `--${name}`).join(', ')}`);
  return values;
}

function readJson(filePath, label) {
  return parseJsonBytes(readFileSync(filePath), label);
}

function canonicalMissingPath(resolved) {
  const remaining = [];
  let ancestor = resolved;
  while (true) {
    try {
      return path.join(realpathSync(ancestor), ...remaining);
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      remaining.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
}

function pathIdentity(filePath) {
  const resolved = path.resolve(filePath);
  try {
    const stats = statSync(resolved);
    return {
      resolved,
      exists: true,
      canonicalPath: realpathSync(resolved),
      device: stats.dev,
      inode: stats.ino,
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      return { resolved, exists: false, canonicalPath: canonicalMissingPath(resolved) };
    }
    throw error;
  }
}

function identitiesAlias(left, right) {
  if (left.canonicalPath === right.canonicalPath) return true;
  if (!left.exists || !right.exists) return false;
  return left.device === right.device && left.inode === right.inode;
}

function assertDistinctPaths(entries) {
  const identities = entries.map(([label, filePath]) => [label, pathIdentity(filePath)]);
  for (let leftIndex = 0; leftIndex < identities.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < identities.length; rightIndex += 1) {
      const [leftLabel, left] = identities[leftIndex];
      const [rightLabel, right] = identities[rightIndex];
      if (identitiesAlias(left, right)) {
        throw new Error(`path alias rejected: --${leftLabel} and --${rightLabel} must be distinct`);
      }
    }
  }
}

function stageWrite(finalPath, bytes) {
  const resolvedFinal = path.resolve(finalPath);
  const existing = pathIdentity(resolvedFinal);
  if (existing.exists && existing.isDirectory) {
    throw new Error(`output path is an existing directory: ${resolvedFinal}`);
  }
  const directory = path.dirname(resolvedFinal);
  const basename = path.basename(resolvedFinal);
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const suffix = randomBytes(12).toString('hex');
    const temporaryPath = path.join(directory, `.${basename}.tmp-${process.pid}-${suffix}`);
    try {
      writeFileSync(temporaryPath, bytes, { flag: 'wx' });
      return { finalPath: resolvedFinal, temporaryPath, published: false };
    } catch (error) {
      if (error?.code === 'EEXIST') continue;
      try {
        unlinkSync(temporaryPath);
      } catch (cleanupError) {
        if (cleanupError?.code !== 'ENOENT') throw cleanupError;
      }
      throw error;
    }
  }
  throw new Error(`could not allocate a unique staged output for ${resolvedFinal}`);
}

function publishAtomically(outputs) {
  const staged = [];
  try {
    for (const [finalPath, bytes] of outputs) staged.push(stageWrite(finalPath, bytes));
    for (const item of staged) {
      renameSync(item.temporaryPath, item.finalPath);
      item.published = true;
    }
  } finally {
    for (const item of staged) {
      if (item.published) continue;
      try {
        unlinkSync(item.temporaryPath);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }
}

function runPrepare(argv) {
  const flags = parseFlags(argv, ['structure', 'output', 'meta']);
  assertDistinctPaths([
    ['structure', flags.structure],
    ['output', flags.output],
    ['meta', flags.meta],
  ]);
  const prepared = prepareDssrInput(readFileSync(flags.structure));
  publishAtomically([
    [flags.output, prepared.bytes],
    [flags.meta, Buffer.from(deterministicJson(prepared.meta), 'utf8')],
  ]);
  return prepared.meta;
}

function runBuild(argv) {
  const flags = parseFlags(argv, [
    'structure',
    'dssr-input',
    'prepare-meta',
    'dssr-json',
    'linked-view',
    'case-id',
    'chain-id',
    'tool',
    'tool-version',
    'container-image',
    'container-image-id',
    'command',
    'output',
  ]);
  assertDistinctPaths([
    ['output', flags.output],
    ['structure', flags.structure],
    ['dssr-input', flags['dssr-input']],
    ['prepare-meta', flags['prepare-meta']],
    ['dssr-json', flags['dssr-json']],
    ['linked-view', flags['linked-view']],
  ]);
  const structureBytes = readFileSync(flags.structure);
  const dssrInputBytes = readFileSync(flags['dssr-input']);
  const prepareMeta = readJson(flags['prepare-meta'], 'prepare meta');
  const payload = buildLocalGeometrySidecar({
    structureBytes,
    dssrInputBytes,
    prepareMeta,
    dssr: readJson(flags['dssr-json'], 'DSSR JSON'),
    linkedView: readJson(flags['linked-view'], 'linked-view bundle'),
    caseId: flags['case-id'],
    chainId: flags['chain-id'],
    tool: flags.tool,
    toolVersion: flags['tool-version'],
    containerImage: flags['container-image'],
    containerImageId: flags['container-image-id'],
    command: flags.command,
  });
  publishAtomically([[flags.output, deterministicGzip(payload)]]);
  return payload;
}

export function main(argv = process.argv.slice(2)) {
  const [subcommand, ...rest] = argv;
  if (subcommand === 'prepare') return runPrepare(rest);
  if (subcommand === 'build') return runBuild(rest);
  throw new Error('usage: build-local-geometry-sidecar.mjs prepare|build [explicit options]');
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`build-local-geometry-sidecar: ${error.message || error}\n`);
    process.exitCode = 1;
  }
}
