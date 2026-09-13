#!/usr/bin/env node

import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { deterministicJson } from './local-geometry-sidecar-lib.mjs';
import {
  buildSourceManifest,
  DSSR_COMMAND,
  DSSR_CONTAINER_IMAGE,
  DSSR_CONTAINER_IMAGE_ID,
  DSSR_TOOL,
  DSSR_TOOL_VERSION,
  recoverCandidateLock,
  runLocalGeometryBatch,
  verifyBatchOutput,
} from './local-geometry-batch-lib.mjs';

const execFileAsync = promisify(execFile);

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
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function readExpectedUnavailable(filePath) {
  const value = readJson(filePath, 'expected unavailable file');
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected unavailable file must be an object');
  return new Map(Object.entries(value));
}

function provenance(flags) {
  const value = {
    tool: DSSR_TOOL,
    toolVersion: flags['tool-version'],
    containerImage: flags['container-image'],
    containerImageId: flags['container-image-id'],
    command: DSSR_COMMAND,
  };
  const expected = {
    toolVersion: DSSR_TOOL_VERSION,
    containerImage: DSSR_CONTAINER_IMAGE,
    containerImageId: DSSR_CONTAINER_IMAGE_ID,
  };
  for (const [name, pinned] of Object.entries(expected)) {
    if (value[name] !== pinned) throw new Error(`--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} must equal ${pinned}`);
  }
  return value;
}

async function runManifest(argv) {
  const flags = parseFlags(argv, ['case-root', 'output']);
  const manifest = await buildSourceManifest(flags['case-root']);
  writeFileSync(flags.output, deterministicJson(manifest), { flag: 'wx' });
  return { caseCount: manifest.caseCount, chainCount: manifest.chainCount };
}

export function assertPinnedDssrRuntime({ actualImageId, versionOutput }) {
  if (actualImageId !== DSSR_CONTAINER_IMAGE_ID) {
    throw new Error(`container image ID mismatch: expected ${DSSR_CONTAINER_IMAGE_ID}, got ${actualImageId}`);
  }
  if (typeof versionOutput !== 'string' || !versionOutput.includes(`v${DSSR_TOOL_VERSION.replace(/^v/, '')}`)) {
    throw new Error(`DSSR version mismatch: expected ${DSSR_TOOL_VERSION}`);
  }
  return true;
}

function assertDockerRuntime() {
  const actualImageId = execFileSync(
    'docker',
    ['image', 'inspect', DSSR_CONTAINER_IMAGE, '--format', '{{.Id}}'],
    { encoding: 'utf8' },
  ).trim();
  const version = spawnSync('docker', [
    'run', '--rm', '--entrypoint', '/usr/local/bin/x3dna-dssr',
    DSSR_CONTAINER_IMAGE_ID, '--version',
  ], { encoding: 'utf8' });
  if (version.error) throw version.error;
  if (version.status !== 0) throw new Error(`DSSR version check failed with exit ${version.status}: ${version.stderr || version.stdout}`);
  assertPinnedDssrRuntime({ actualImageId, versionOutput: `${version.stdout || ''}\n${version.stderr || ''}` });
}

export function buildDssrDockerRunArgs(jobDirectory) {
  const mount = `${path.resolve(jobDirectory)}:/work`;
  return [
    'run', '--rm', '--volume', mount, '--entrypoint', 'sh',
    DSSR_CONTAINER_IMAGE_ID, '-lc', DSSR_COMMAND,
  ];
}

async function runBuild(argv) {
  const flags = parseFlags(argv, [
    'case-root', 'output-root', 'work-root', 'manifest', 'expected-unavailable',
    'container-image', 'container-image-id', 'tool-version', 'concurrency', 'resume',
  ]);
  const sourceManifest = readJson(flags.manifest, 'source manifest');
  const expectedUnavailable = readExpectedUnavailable(flags['expected-unavailable']);
  const sourceProvenance = provenance(flags);
  assertDockerRuntime();
  const resume = flags.resume === 'true' ? true : flags.resume === 'false' ? false : null;
  if (resume === null) throw new Error('--resume must be true or false');
  const controller = new AbortController();
  const interrupt = (signalName) => {
    if (!controller.signal.aborted) controller.abort(new Error(`received ${signalName}`));
  };
  const onSigint = () => interrupt('SIGINT');
  const onSigterm = () => interrupt('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  try {
    return await runLocalGeometryBatch({
      caseRoot: flags['case-root'],
      outputRoot: flags['output-root'],
      workRoot: flags['work-root'],
      sourceManifest,
      provenance: sourceProvenance,
      concurrency: Number(flags.concurrency),
      expectedUnavailable,
      resume,
      abortSignal: controller.signal,
      runDssr: async ({ jobDirectory, signal }) => {
        await execFileAsync('docker', buildDssrDockerRunArgs(jobDirectory), {
          maxBuffer: 64 * 1024 * 1024,
          signal,
        });
        return readFileSync(path.join(jobDirectory, 'output.json'));
      },
    });
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  }
}

async function runVerify(argv) {
  const flags = parseFlags(argv, [
    'case-root', 'output-root', 'manifest', 'expected-unavailable',
    'container-image', 'container-image-id', 'tool-version',
  ]);
  return verifyBatchOutput({
    caseRoot: flags['case-root'],
    outputRoot: flags['output-root'],
    sourceManifest: readJson(flags.manifest, 'source manifest'),
    provenance: provenance(flags),
    expectedUnavailable: readExpectedUnavailable(flags['expected-unavailable']),
  });
}

function runUnlock(argv) {
  const flags = parseFlags(argv, ['output-root']);
  return recoverCandidateLock(flags['output-root']);
}

export async function main(argv = process.argv.slice(2)) {
  const [subcommand, ...rest] = argv;
  if (subcommand === 'manifest') return runManifest(rest);
  if (subcommand === 'build') return runBuild(rest);
  if (subcommand === 'verify') return runVerify(rest);
  if (subcommand === 'unlock') return runUnlock(rest);
  throw new Error('usage: build-local-geometry-batch.mjs manifest|build|verify|unlock [explicit options]');
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    const result = await main();
    process.stdout.write(deterministicJson(result));
  } catch (error) {
    process.stderr.write(`build-local-geometry-batch: ${error.message || error}\n`);
    process.exitCode = 1;
  }
}
