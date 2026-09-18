import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { runLocalGeometryBatch } from './local-geometry-batch-lib.mjs';

const [gateRoot, outputRoot, workRoot] = process.argv.slice(2);
if (!gateRoot || !outputRoot || !workRoot) throw new Error('usage: GATE_ROOT NEW_OUTPUT_ROOT NEW_WORK_ROOT');
const ledger = JSON.parse(readFileSync(path.join(gateRoot, 'candidate/_batch/ledger.json')));
const evidenceRoot = path.join(gateRoot, 'dssr-evidence');
const result = await runLocalGeometryBatch({
  caseRoot: path.join(gateRoot, 'input/cases'), outputRoot, workRoot,
  sourceManifest: JSON.parse(readFileSync(path.join(gateRoot, 'manifest.json'))),
  provenance: ledger.provenance, concurrency: 3,
  runDssr: async ({ jobDirectory }) => {
    const bytes = readFileSync(path.join(jobDirectory, 'input.cif'));
    const matches = readdirSync(evidenceRoot).filter((name) =>
      readFileSync(path.join(evidenceRoot, name, 'input.cif')).equals(bytes));
    if (matches.length !== 1) throw new Error('retained DSSR input must match exactly one evidence file');
    return readFileSync(path.join(evidenceRoot, matches[0], 'output.json'));
  },
});
console.log(JSON.stringify(result));
