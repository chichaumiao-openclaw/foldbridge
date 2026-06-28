#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const targetsPath = path.join(root, 'scripts', 'targets.json');
const outputDir = path.join(root, 'src', 'assets', 'predicted-structures');

function usage() {
  console.error('Usage: node scripts/generate_fallback_pdb.mjs <RMDB_ID>');
  process.exit(1);
}

const recordId = process.argv[2];
if (!recordId) usage();

const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
const target = targets.find((entry) => entry.id === recordId);
if (!target) {
  throw new Error(`Target ${recordId} not found in scripts/targets.json`);
}

const sequence = String(target.sequence || '').replace(/\s+/g, '').toUpperCase().replace(/T/g, 'U');
const structure = String(target.structure || '').replace(/\s+/g, '');
if (!sequence || !structure || sequence.length !== structure.length) {
  throw new Error(`Invalid sequence/structure for ${recordId}`);
}

const OPEN_TO_CLOSE = { '(': ')', '[': ']', '{': '}', '<': '>' };
const CLOSE_TO_OPEN = Object.fromEntries(Object.entries(OPEN_TO_CLOSE).map(([k, v]) => [v, k]));

function vAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vScale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function vNorm(a) {
  return Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
}

function vNormalize(a, fallback = [1, 0, 0]) {
  const norm = vNorm(a);
  return norm < 1e-8 ? [...fallback] : vScale(a, 1 / norm);
}

function vCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function parsePairs(dotBracket) {
  const stacks = Object.fromEntries(Object.keys(OPEN_TO_CLOSE).map((key) => [key, []]));
  const pairs = new Map();
  for (let i = 0; i < dotBracket.length; i += 1) {
    const char = dotBracket[i];
    if (OPEN_TO_CLOSE[char]) {
      stacks[char].push(i);
      continue;
    }
    const opener = CLOSE_TO_OPEN[char];
    if (!opener || !stacks[opener].length) continue;
    const j = stacks[opener].pop();
    pairs.set(i, j);
    pairs.set(j, i);
  }
  return pairs;
}

function initializePositions(length) {
  const radius = Math.max(24, length * 0.18);
  return Array.from({ length }, (_, i) => {
    const theta = (2 * Math.PI * i) / length;
    const z = Math.sin(theta * 3) * 6;
    return [Math.cos(theta) * radius, Math.sin(theta) * radius, z];
  });
}

function relaxPositions(positions, pairs, iterations = 900) {
  const n = positions.length;
  const targetBackbone = 6.2;
  const targetPair = 8.5;
  for (let step = 0; step < iterations; step += 1) {
    const forces = Array.from({ length: n }, () => [0, 0, 0]);
    const temperature = 0.28 * (1 - step / iterations);

    for (let i = 0; i < n - 1; i += 1) {
      const delta = vSub(positions[i + 1], positions[i]);
      const dist = Math.max(vNorm(delta), 1e-6);
      const direction = vScale(delta, 1 / dist);
      const magnitude = (dist - targetBackbone) * 0.22;
      forces[i] = vAdd(forces[i], vScale(direction, magnitude));
      forces[i + 1] = vAdd(forces[i + 1], vScale(direction, -magnitude));
    }

    for (const [i, j] of pairs.entries()) {
      if (i > j) continue;
      const delta = vSub(positions[j], positions[i]);
      const dist = Math.max(vNorm(delta), 1e-6);
      const direction = vScale(delta, 1 / dist);
      const magnitude = (dist - targetPair) * 0.18;
      forces[i] = vAdd(forces[i], vScale(direction, magnitude));
      forces[j] = vAdd(forces[j], vScale(direction, -magnitude));
    }

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 2; j < n; j += 1) {
        if (pairs.get(i) === j) continue;
        const delta = vSub(positions[j], positions[i]);
        const dist = Math.max(vNorm(delta), 1e-6);
        if (dist > 18) continue;
        const direction = vScale(delta, 1 / dist);
        const magnitude = 5.0 / (dist * dist);
        forces[i] = vAdd(forces[i], vScale(direction, -magnitude));
        forces[j] = vAdd(forces[j], vScale(direction, magnitude));
      }
    }

    for (let i = 0; i < n; i += 1) {
      positions[i] = vAdd(positions[i], vScale(forces[i], temperature));
    }
  }
  return positions;
}

function atomPositions(positions, index) {
  const current = positions[index];
  const prev = index > 0 ? positions[index - 1] : vAdd(current, [-4, 0, 0]);
  const next = index < positions.length - 1 ? positions[index + 1] : vAdd(current, [4, 0, 0]);
  const tangent = vNormalize(vSub(next, prev), [1, 0, 0]);
  const normal = vNormalize(vCross(tangent, [0, 0, 1]), [0, 1, 0]);
  const binormal = vNormalize(vCross(tangent, normal), [0, 0, 1]);
  const p = current;
  const c4 = vAdd(current, vAdd(vScale(tangent, 1.7), vScale(binormal, 0.6)));
  const base = vAdd(current, vScale(normal, 2.5));
  return { p, c4, base };
}

function writePdb(outputPath, seq, positions, id) {
  let serial = 1;
  const lines = [`HEADER    LOCAL FALLBACK RNA MODEL ${id}`];
  for (let i = 0; i < seq.length; i += 1) {
    const residue = seq[i];
    const residueName = ['A', 'C', 'G', 'U'].includes(residue) ? residue : 'A';
    const { p, c4, base } = atomPositions(positions, i);
    const baseAtomName = residueName === 'A' || residueName === 'G' ? 'N9' : 'N1';
    const atoms = [
      ['P', p, 'P'],
      ["C4'", c4, 'C'],
      [baseAtomName, base, 'N']
    ];
    for (const [atomName, coord, element] of atoms) {
      lines.push(
        `ATOM  ${String(serial).padStart(5)} ${String(atomName).padEnd(4)} ${residueName.padStart(3)} A${String(i + 1).padStart(4)}    ${coord[0].toFixed(3).padStart(8)}${coord[1].toFixed(3).padStart(8)}${coord[2].toFixed(3).padStart(8)}  1.00  1.00          ${String(element).padStart(2)}`
      );
      serial += 1;
    }
  }
  lines.push('END');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

const pairs = parsePairs(structure);
const positions = relaxPositions(initializePositions(sequence.length), pairs);
const outputPath = path.join(outputDir, `${recordId.replace(/^RMDB_/, '')}.pdb`);
writePdb(outputPath, sequence, positions, recordId);
console.log(outputPath);
