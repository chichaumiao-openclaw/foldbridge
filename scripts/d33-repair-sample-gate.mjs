// Isolated representative gate. Inputs and retained DSSR evidence are never overwritten.
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { buildSourceManifest, runLocalGeometryBatch, DSSR_TOOL, DSSR_TOOL_VERSION,
  DSSR_CONTAINER_IMAGE, DSSR_CONTAINER_IMAGE_ID, DSSR_COMMAND } from './local-geometry-batch-lib.mjs';
import { assertPinnedDssrRuntime, buildDssrContainerRunArgs } from './build-local-geometry-batch.mjs';

const run = promisify(execFile);
const [wave, destination, ...caseIds] = process.argv.slice(2);
if (!wave || !destination || !caseIds.length || caseIds.some((id) => !/^[A-Z0-9]{4}$/.test(id))) {
  throw new Error('usage: node d33-repair-sample-gate.mjs WAVE NEW_DEST CASE_ID ...');
}
if (existsSync(destination)) throw new Error('destination must not already exist');
const image = await run('docker', ['image', 'inspect', DSSR_CONTAINER_IMAGE, '--format', '{{.Id}}']);
const version = await run('docker', ['run', '--rm', '--entrypoint', '/usr/local/bin/x3dna-dssr', DSSR_CONTAINER_IMAGE_ID, '--version']);
assertPinnedDssrRuntime({ actualImageId: image.stdout.trim(), versionOutput: version.stdout + version.stderr });
mkdirSync(destination, { recursive: true });
const caseRoot = path.join(destination, 'input/cases');
mkdirSync(caseRoot, { recursive: true });
const selections = [];
for (const caseId of caseIds) {
  const matches = readdirSync(wave).filter((name) => name.startsWith('shard-'))
    .map((name) => path.join(wave, name, 'input/cases', caseId)).filter(existsSync);
  if (matches.length !== 1) throw new Error(`${caseId}: expected one sealed source, found ${matches.length}`);
  cpSync(matches[0], path.join(caseRoot, caseId), { recursive: true, errorOnExist: true, force: false });
  selections.push({ caseId, source: matches[0] });
}
const sourceManifest = await buildSourceManifest(caseRoot);
writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(sourceManifest, null, 2), { flag: 'wx' });
writeFileSync(path.join(destination, 'selections.json'), JSON.stringify(selections, null, 2), { flag: 'wx' });
const evidenceRoot = path.join(destination, 'dssr-evidence');
mkdirSync(evidenceRoot);
const result = await runLocalGeometryBatch({ caseRoot, outputRoot: path.join(destination, 'candidate'),
  workRoot: path.join(destination, 'work'), sourceManifest, concurrency: 3,
  provenance: { tool: DSSR_TOOL, toolVersion: DSSR_TOOL_VERSION, containerImage: DSSR_CONTAINER_IMAGE,
    containerImageId: DSSR_CONTAINER_IMAGE_ID, command: DSSR_COMMAND },
  runDssr: async ({ jobDirectory, signal }) => {
    const evidence = path.join(evidenceRoot, path.basename(jobDirectory));
    mkdirSync(evidence);
    copyFileSync(path.join(jobDirectory, 'input.cif'), path.join(evidence, 'input.cif'));
    try {
      const runOptions = { maxBuffer: 64 * 1024 * 1024 };
      if (signal instanceof AbortSignal) runOptions.signal = signal;
      const output = await run('docker', buildDssrContainerRunArgs(jobDirectory), runOptions);
      writeFileSync(path.join(evidence, 'stderr.txt'), output.stderr);
      copyFileSync(path.join(jobDirectory, 'output.json'), path.join(evidence, 'output.json'));
      return readFileSync(path.join(evidence, 'output.json'));
    } catch (error) {
      writeFileSync(path.join(evidence, 'error.txt'), String(error));
      throw error;
    }
  },
});
writeFileSync(path.join(destination, 'result.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
console.log(JSON.stringify(result));
