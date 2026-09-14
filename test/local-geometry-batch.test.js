import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { hostname } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  batchInitializationParent,
  buildSourceManifest,
  candidateLockPath,
  readVerifiedInput,
  recoverCandidateLock,
  runLocalGeometryBatch,
  verifyBatchOutput,
} from '../scripts/local-geometry-batch-lib.mjs';
import {
  assertPinnedDssrRuntime,
  buildDssrContainerRunArgs,
  requireContainerRuntime,
} from '../scripts/build-local-geometry-batch.mjs';

const IMAGE_ID = 'sha256:259aba597ceac6d3072cc08585fa5284db8d4712cb768a02b7ef3471b8aa0853';
const PROVENANCE = {
  tool: 'x3dna-dssr',
  toolVersion: 'v1.9.10-2020apr23',
  containerImage: 'localhost/foldbridge-dssr:v1.9.10-c7261c0a',
  containerImageId: IMAGE_ID,
  command: '/usr/local/bin/x3dna-dssr --json --more --non-pair -i=/work/input.cif -o=/work/output.json',
};

const STRUCTURE = `data_demo
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_alt_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_entity_id
_atom_site.label_seq_id
_atom_site.pdbx_PDB_ins_code
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.auth_seq_id
_atom_site.auth_comp_id
_atom_site.auth_asym_id
_atom_site.pdbx_PDB_model_num
ATOM 1 C "C1'" . G A 1 1 ? 1 2 3 101 G X 1
ATOM 2 C "C1'" . U B 2 1 ? 4 5 6 201 U Y 1
#
`;

const DSSR = {
  nts: [
    {
      nt_id: 'X.G101', chain_name: 'X', nt_resnum: '101', nt_name: 'G', nt_code: 'G',
      puckering: "C3'-endo", phase_angle: 18, amplitude: 42,
    },
    {
      nt_id: 'Y.U201', chain_name: 'Y', nt_resnum: '201', nt_name: 'U', nt_code: 'U',
      puckering: "C2'-endo", phase_angle: 155, amplitude: 38,
    },
  ],
  nonPairs: [{
    nt1: 'X.G101', nt2: 'Y.U201',
    stacking: { type: 'pm(>>,forward)', oArea: 2.5, oArea_ring: 1.5 },
  }],
};

function linkedView(caseId, chainId, { componentId, authSeqId }) {
  const chainKey = `${caseId}|chain|${chainId}`;
  const residueKey = `${chainKey}|1`;
  return {
    residueIndex: {
      residues: [{ residueKey, chainKey, labelSeqId: 1, compId: componentId, parentBase: componentId }],
    },
    structureContexts: {
      loci: [{
        residueKey,
        coordinateStatus: 'resolved',
        locator: {
          label_asym_id: chainId === 'X' ? 'A' : 'B',
          auth_asym_id: chainId,
          label_seq_id: 1,
          auth_seq_id: authSeqId,
          pdbx_PDB_ins_code: '',
        },
      }],
    },
  };
}

function writeGzipJson(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, gzipSync(`${JSON.stringify(payload)}\n`));
}

function writeCase(root, caseId, structure, chains) {
  const caseRoot = path.join(root, caseId);
  mkdirSync(caseRoot, { recursive: true });
  writeFileSync(path.join(caseRoot, 'structure.cif.gz'), gzipSync(structure));
  for (const [chainId, payload] of Object.entries(chains)) {
    writeGzipJson(
      path.join(caseRoot, 'chains', chainId, 'linked-view', 'linked-view.json.gz'),
      payload,
    );
  }
}

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'foldbridge-d33-batch-'));
  const caseRoot = path.join(root, 'cases');
  const outputRoot = path.join(root, 'candidate');
  const workRoot = path.join(root, 'work');
  writeCase(caseRoot, 'DEMO', STRUCTURE, {
    X: linkedView('DEMO', 'X', { componentId: 'G', authSeqId: 101 }),
    Y: linkedView('DEMO', 'Y', { componentId: 'U', authSeqId: 201 }),
  });
  writeCase(caseRoot, 'FAIL', 'data_no_atoms\n_entry.id FAIL\n', {
    Z: linkedView('FAIL', 'Z', { componentId: 'G', authSeqId: 1 }),
  });
  return { root, caseRoot, outputRoot, workRoot };
}

test('source manifest is case-sensitive, stable, hashed, and rejects symlink inputs', async () => {
  const { root, caseRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  assert.equal(manifest.caseCount, 2);
  assert.equal(manifest.chainCount, 3);
  assert.deepEqual(manifest.cases.map((entry) => entry.caseId), ['DEMO', 'FAIL']);
  assert.deepEqual(manifest.cases[0].chains.map((entry) => entry.chainId), ['X', 'Y']);
  assert.match(manifest.cases[0].structure.sha256, /^[0-9a-f]{64}$/);
  assert.match(manifest.cases[0].chains[0].linkedView.sha256, /^[0-9a-f]{64}$/);

  const symlinkRoot = path.join(root, 'symlink-cases');
  symlinkSync(caseRoot, symlinkRoot);
  await assert.rejects(() => buildSourceManifest(symlinkRoot), /symbolic link/i);
});

test('batch runs DSSR once per PDB, reuses it for every chain, and resumes only verified outputs', async () => {
  const { caseRoot, outputRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  const calls = [];
  const runDssr = async ({ caseId }) => {
    calls.push(caseId);
    return DSSR;
  };

  const first = await runLocalGeometryBatch({
    caseRoot,
    outputRoot,
    workRoot,
    sourceManifest: manifest,
    provenance: PROVENANCE,
    concurrency: 2,
    expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
    runDssr,
    resume: false,
  });
  assert.deepEqual(calls, ['DEMO']);
  assert.deepEqual(first.counts, { computedCases: 1, unavailableCases: 1, failedCases: 0, computedChains: 2, unavailableChains: 1 });
  const xOutput = path.join(outputRoot, 'cases', 'DEMO', 'chains', 'X', 'linked-view', 'local-geometry.json.gz');
  const yOutput = path.join(outputRoot, 'cases', 'DEMO', 'chains', 'Y', 'linked-view', 'local-geometry.json.gz');
  assert.ok(readFileSync(xOutput).length > 0);
  assert.ok(readFileSync(yOutput).length > 0);
  assert.equal(await verifyBatchOutput({ caseRoot, outputRoot, sourceManifest: manifest, provenance: PROVENANCE, expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]) }), true);

  calls.length = 0;
  await runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 2, expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]), runDssr, resume: true,
  });
  assert.deepEqual(calls, [], 'valid receipts and output hashes make resume skip DSSR');

  writeFileSync(xOutput, 'tampered');
  calls.length = 0;
  await runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 2, expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]), runDssr, resume: true,
  });
  assert.deepEqual(calls, ['DEMO'], 'one drifted output invalidates the entire PDB receipt');
  assert.equal(await verifyBatchOutput({ caseRoot, outputRoot, sourceManifest: manifest, provenance: PROVENANCE, expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]) }), true);
});

test('unexpected failure persists a complete state inventory and a non-success ledger', async () => {
  const { caseRoot, outputRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  await assert.rejects(() => runLocalGeometryBatch({
    caseRoot,
    outputRoot,
    workRoot,
    sourceManifest: manifest,
    provenance: PROVENANCE,
    concurrency: 1,
    expectedUnavailable: new Map(),
    runDssr: async () => DSSR,
    resume: false,
  }), /unexpected batch failures/i);

  const demoState = JSON.parse(readFileSync(path.join(outputRoot, '_batch', 'status', 'DEMO.json'), 'utf8'));
  const failState = JSON.parse(readFileSync(path.join(outputRoot, '_batch', 'status', 'FAIL.json'), 'utf8'));
  const ledger = JSON.parse(readFileSync(path.join(outputRoot, '_batch', 'ledger.json'), 'utf8'));
  assert.equal(demoState.status, 'computed');
  assert.equal(failState.status, 'failed');
  assert.equal(failState.stage, 'prepare');
  assert.equal(failState.errorCode, 'PREPARE_NO_ATOM_SITE');
  assert.equal(failState.attempts, 1);
  assert.deepEqual(ledger.cases.map(({ caseId, status }) => [caseId, status]), [
    ['DEMO', 'computed'],
    ['FAIL', 'failed'],
  ]);
});

test('batch rejects an output root reached through a symbolic link', async () => {
  const { root, caseRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  const realOutput = path.join(root, 'real-output');
  mkdirSync(realOutput);
  const linkedOutput = path.join(root, 'linked-output');
  symlinkSync(realOutput, linkedOutput);
  await assert.rejects(() => runLocalGeometryBatch({
    caseRoot,
    outputRoot: linkedOutput,
    workRoot,
    sourceManifest: manifest,
    provenance: PROVENANCE,
    concurrency: 1,
    expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
    runDssr: async () => DSSR,
    resume: false,
  }), /symbolic link/i);
});

test('verified input is read once and the returned bytes are exactly the bytes hashed', () => {
  const { caseRoot } = fixture();
  const descriptor = {
    path: 'DEMO/structure.cif.gz',
    size: 5,
    sha256: 'f'.repeat(64),
  };
  let reads = 0;
  const bytes = Buffer.from('first');
  const result = readVerifiedInput(caseRoot, descriptor, 'DEMO structure', {
    readFile() {
      reads += 1;
      return bytes;
    },
    statFile() {
      return { size: bytes.length };
    },
    hashBytes() {
      return descriptor.sha256;
    },
  });
  assert.equal(reads, 1);
  assert.equal(result, bytes);
});

test('manifest descriptors must name the exact Case and Chain input paths', async () => {
  const { caseRoot, outputRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  manifest.cases[0].structure = { ...manifest.cases[1].structure };
  await assert.rejects(() => runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 1, expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
    runDssr: async () => DSSR, resume: false,
  }), /DEMO structure\.path must equal DEMO\/structure\.cif\.gz/i);
});

test('run and verify reject a current source inventory not represented by the manifest', async () => {
  const { caseRoot, outputRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  writeCase(caseRoot, 'NEW', STRUCTURE, {
    X: linkedView('NEW', 'X', { componentId: 'G', authSeqId: 101 }),
  });
  await assert.rejects(() => runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 1, expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
    runDssr: async () => DSSR, resume: false,
  }), /current source inventory differs from source manifest/i);
  await assert.rejects(() => verifyBatchOutput({
    caseRoot, outputRoot, sourceManifest: manifest, provenance: PROVENANCE,
    expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
  }), /current source inventory differs from source manifest/i);
});

test('run rejects source inventory drift that occurs during DSSR execution', async () => {
  const { caseRoot, outputRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  let mutated = false;
  await assert.rejects(() => runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 1, expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
    runDssr: async () => {
      if (!mutated) {
        mutated = true;
        writeCase(caseRoot, 'NEW', STRUCTURE, {
          X: linkedView('NEW', 'X', { componentId: 'G', authSeqId: 101 }),
        });
      }
      return DSSR;
    },
    resume: false,
  }), /current source inventory differs from source manifest/i);
});

test('source and candidate descendants must not traverse symbolic links', async () => {
  const { root, caseRoot, outputRoot, workRoot } = fixture();
  const linkedViewDirectory = path.join(caseRoot, 'DEMO', 'chains', 'X', 'linked-view');
  const realLinkedViewDirectory = path.join(root, 'real-linked-view');
  renameSync(linkedViewDirectory, realLinkedViewDirectory);
  symlinkSync(realLinkedViewDirectory, linkedViewDirectory);
  await assert.rejects(() => buildSourceManifest(caseRoot), /symbolic link/i);

  const clean = fixture();
  const manifest = await buildSourceManifest(clean.caseRoot);
  mkdirSync(clean.outputRoot, { recursive: true });
  const realBatch = path.join(root, 'real-batch');
  mkdirSync(realBatch);
  symlinkSync(realBatch, path.join(clean.outputRoot, '_batch'));
  await assert.rejects(() => runLocalGeometryBatch({
    caseRoot: clean.caseRoot, outputRoot: clean.outputRoot, workRoot: clean.workRoot,
    sourceManifest: manifest, provenance: PROVENANCE, concurrency: 1,
    expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
    runDssr: async () => DSSR, resume: false,
  }), /symbolic link/i);
});

test('a fresh run rejects non-empty output and resume rejects unrelated files', async () => {
  const { caseRoot, outputRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(path.join(outputRoot, 'sentinel.txt'), 'do not mix');
  const options = {
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 1, expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
    runDssr: async () => DSSR,
  };
  await assert.rejects(() => runLocalGeometryBatch({ ...options, resume: false }), /output root must be empty/i);
  await assert.rejects(() => runLocalGeometryBatch({ ...options, resume: true }), /unexpected candidate file/i);
});

test('case, candidate, and work roots must not overlap', async () => {
  const { caseRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  await assert.rejects(() => runLocalGeometryBatch({
    caseRoot,
    outputRoot: path.join(caseRoot, 'candidate'),
    workRoot,
    sourceManifest: manifest,
    provenance: PROVENANCE,
    concurrency: 1,
    expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
    runDssr: async () => DSSR,
    resume: false,
  }), /roots must not overlap/i);
});

test('only the pinned DSSR provenance and structural unavailable code are accepted', async () => {
  const { caseRoot, outputRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  const options = {
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, concurrency: 1,
    runDssr: async () => DSSR, resume: false,
  };
  await assert.rejects(() => runLocalGeometryBatch({
    ...options,
    provenance: { ...PROVENANCE, toolVersion: 'v1.9.10' },
    expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
  }), /toolVersion must equal v1\.9\.10-2020apr23/i);
  await assert.rejects(() => runLocalGeometryBatch({
    ...options,
    provenance: PROVENANCE,
    expectedUnavailable: new Map([['DEMO', 'DSSR_FAILED']]),
  }), /unsupported unavailable code DSSR_FAILED/i);
  await assert.rejects(() => runLocalGeometryBatch({
    ...options,
    provenance: PROVENANCE,
    expectedUnavailable: new Map([['UNKNOWN', 'PREPARE_NO_ATOM_SITE']]),
  }), /unknown unavailable case UNKNOWN/i);
});

test('container runtime is explicit and never falls back between Docker and Podman', () => {
  assert.equal(requireContainerRuntime('docker'), 'docker');
  assert.equal(requireContainerRuntime('podman'), 'podman');
  assert.throws(() => requireContainerRuntime(''), /container runtime must be docker or podman/i);
  assert.throws(() => requireContainerRuntime('container'), /container runtime must be docker or podman/i);
  assert.throws(() => requireContainerRuntime(undefined), /container runtime must be docker or podman/i);
});

test('container runtime check pins the approved image ID, tool version, and immutable run target', () => {
  assert.equal(assertPinnedDssrRuntime({
    actualImageId: IMAGE_ID,
    versionOutput: 'DSSR v1.9.10-2020apr23, by xiangjun@x3dna.org',
  }), true);
  assert.equal(assertPinnedDssrRuntime({
    actualImageId: IMAGE_ID.slice('sha256:'.length),
    versionOutput: 'DSSR v1.9.10-2020apr23, by xiangjun@x3dna.org',
  }), true);
  assert.throws(() => assertPinnedDssrRuntime({
    actualImageId: `sha256:${'b'.repeat(64)}`,
    versionOutput: 'DSSR v1.9.10-2020apr23',
  }), /container image ID mismatch/i);
  assert.throws(() => assertPinnedDssrRuntime({
    actualImageId: IMAGE_ID,
    versionOutput: 'DSSR v2.0.0',
  }), /DSSR version mismatch/i);
  const args = buildDssrContainerRunArgs('/tmp/foldbridge-job');
  assert.ok(args.includes(IMAGE_ID));
  assert.ok(!args.includes(PROVENANCE.containerImage));
});

test('verification rejects stale unavailable output, tampered state or ledger, and extra files', async () => {
  for (const mutation of ['stale-unavailable', 'state', 'ledger', 'extra']) {
    const { caseRoot, outputRoot, workRoot } = fixture();
    const manifest = await buildSourceManifest(caseRoot);
    const expectedUnavailable = new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]);
    await runLocalGeometryBatch({
      caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
      concurrency: 2, expectedUnavailable, runDssr: async () => DSSR, resume: false,
    });
    if (mutation === 'stale-unavailable') {
      const stale = path.join(outputRoot, 'cases', 'FAIL', 'chains', 'Z', 'linked-view', 'local-geometry.json.gz');
      mkdirSync(path.dirname(stale), { recursive: true });
      writeFileSync(stale, 'stale');
    } else if (mutation === 'state') {
      writeFileSync(path.join(outputRoot, '_batch', 'status', 'DEMO.json'), '{}');
    } else if (mutation === 'ledger') {
      writeFileSync(path.join(outputRoot, '_batch', 'ledger.json'), '{}');
    } else {
      writeFileSync(path.join(outputRoot, 'extra.txt'), 'extra');
    }
    await assert.rejects(() => verifyBatchOutput({
      caseRoot, outputRoot, sourceManifest: manifest, provenance: PROVENANCE, expectedUnavailable,
    }), /verification failed|unexpected candidate file/i, mutation);
  }
});

test('atomic initialization is staged beside, never inside, the candidate root', () => {
  const candidate = '/data/sunhao/foldbridge-d33/candidate';
  assert.equal(batchInitializationParent(candidate), '/data/sunhao/foldbridge-d33');
});

test('one candidate lock excludes a concurrent resume and is released after final verification', async () => {
  const { caseRoot, outputRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  const expectedUnavailable = new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]);
  let announceStarted;
  let releaseDssr;
  const started = new Promise((resolve) => { announceStarted = resolve; });
  const blocked = new Promise((resolve) => { releaseDssr = resolve; });
  const first = runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 1, expectedUnavailable,
    runDssr: async () => {
      announceStarted();
      await blocked;
      return DSSR;
    },
    resume: false,
  });
  await started;
  await assert.rejects(() => runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 1, expectedUnavailable, runDssr: async () => DSSR, resume: true,
  }), /candidate batch lock is already held/i);
  releaseDssr();
  await first;
  assert.equal(existsSync(candidateLockPath(outputRoot)), false);
  assert.equal(await verifyBatchOutput({
    caseRoot, outputRoot, sourceManifest: manifest, provenance: PROVENANCE, expectedUnavailable,
  }), true);
});

test('an abort stops scheduling, records a non-success snapshot, and releases the lock', async () => {
  const { caseRoot, outputRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  const controller = new AbortController();
  let started;
  const dssrStarted = new Promise((resolve) => { started = resolve; });
  const run = runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 1, expectedUnavailable: new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]),
    abortSignal: controller.signal,
    runDssr: async ({ signal }) => new Promise((resolve, reject) => {
      started();
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
    resume: false,
  });
  await dssrStarted;
  controller.abort(new Error('test interrupt'));
  await assert.rejects(() => run, /batch aborted/i);
  assert.equal(existsSync(candidateLockPath(realpathSync(outputRoot))), false);
  const ledger = JSON.parse(readFileSync(path.join(outputRoot, '_batch', 'ledger.json'), 'utf8'));
  assert.equal(ledger.cases.length, manifest.caseCount);
  assert.ok(ledger.cases.some(({ status }) => status !== 'computed' && status !== 'not_computable'));
});

test('a stale lock is recovered only when owner identity is exact and its PID is inactive', async () => {
  const { caseRoot, outputRoot, workRoot } = fixture();
  const manifest = await buildSourceManifest(caseRoot);
  const expectedUnavailable = new Map([['FAIL', 'PREPARE_NO_ATOM_SITE']]);
  await runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 1, expectedUnavailable, runDssr: async () => DSSR, resume: false,
  });
  const canonicalOutput = realpathSync(outputRoot);
  const lockPath = candidateLockPath(canonicalOutput);
  mkdirSync(lockPath);
  const owner = {
    pid: 999999,
    hostname: hostname(),
    outputRoot: canonicalOutput,
    acquiredAt: new Date().toISOString(),
  };
  writeFileSync(path.join(lockPath, 'owner.json'), `${JSON.stringify(owner)}\n`);
  await assert.rejects(() => runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 1, expectedUnavailable, runDssr: async () => DSSR, resume: true,
  }), /candidate batch lock is already held/i);
  assert.throws(() => recoverCandidateLock(outputRoot, { isProcessAlive: () => true }), /lock owner is still active/i);
  assert.equal(recoverCandidateLock(outputRoot, { isProcessAlive: () => false }).pid, owner.pid);
  assert.equal(existsSync(lockPath), false);
  const calls = [];
  await runLocalGeometryBatch({
    caseRoot, outputRoot, workRoot, sourceManifest: manifest, provenance: PROVENANCE,
    concurrency: 1, expectedUnavailable,
    runDssr: async ({ caseId }) => { calls.push(caseId); return DSSR; },
    resume: true,
  });
  assert.deepEqual(calls, []);
});
