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

function vDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vMean(vectors) {
  if (!vectors.length) return [0, 0, 0];
  const total = vectors.reduce((acc, vector) => vAdd(acc, vector), [0, 0, 0]);
  return vScale(total, 1 / vectors.length);
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

function findStems(pairs) {
  const seen = new Set();
  const leftIndices = Array.from(pairs.keys())
    .filter((index) => index < pairs.get(index))
    .sort((a, b) => a - b);
  const stems = [];
  for (const left of leftIndices) {
    if (seen.has(left)) continue;
    const right = pairs.get(left);
    const stem = [[left, right]];
    seen.add(left);
    seen.add(right);
    let nextLeft = left + 1;
    let nextRight = right - 1;
    while (pairs.get(nextLeft) === nextRight) {
      stem.push([nextLeft, nextRight]);
      seen.add(nextLeft);
      seen.add(nextRight);
      nextLeft += 1;
      nextRight -= 1;
    }
    stems.push(stem);
  }
  return stems;
}

function applyStemGeometry(positions, stems) {
  const anchored = new Set();
  for (const stem of stems) {
    const pairCenters = [];
    const pairVectors = [];
    for (const [left, right] of stem) {
      pairCenters.push(vScale(vAdd(positions[left], positions[right]), 0.5));
      pairVectors.push(vSub(positions[left], positions[right]));
    }

    const axis =
      pairCenters.length > 1
        ? vNormalize(vSub(pairCenters[pairCenters.length - 1], pairCenters[0]), [0, 1, 0])
        : [0, 1, 0];

    let pairVector = vMean(pairVectors);
    pairVector = vSub(pairVector, vScale(axis, vDot(pairVector, axis)));
    pairVector = vNormalize(pairVector, [1, 0, 0]);
    const orthogonal = vNormalize(vCross(axis, pairVector), [0, 0, 1]);

    const helicalSpacing = 3.4;
    const radius = 4.2;
    const twistStep = 0.58;
    const stemOrigin = vSub(vMean(pairCenters), vScale(axis, (helicalSpacing * (stem.length - 1)) / 2));

    stem.forEach(([left, right], pairIndex) => {
      const angle = pairIndex * twistStep;
      const radial = vAdd(vScale(pairVector, Math.cos(angle)), vScale(orthogonal, Math.sin(angle)));
      const center = vAdd(stemOrigin, vScale(axis, pairIndex * helicalSpacing));
      positions[left] = vAdd(center, vScale(radial, radius));
      positions[right] = vSub(center, vScale(radial, radius));
      anchored.add(left);
      anchored.add(right);
    });
  }
  return anchored;
}

function fillUnpairedRegions(positions, anchored) {
  const length = positions.length;
  let index = 0;
  while (index < length) {
    if (anchored.has(index)) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < length && !anchored.has(index)) index += 1;
    const end = index - 1;
    const runLength = end - start + 1;
    const leftAnchor = start > 0 && anchored.has(start - 1) ? start - 1 : null;
    const rightAnchor = end + 1 < length && anchored.has(end + 1) ? end + 1 : null;

    if (leftAnchor !== null && rightAnchor !== null) {
      const leftPosition = positions[leftAnchor];
      const rightPosition = positions[rightAnchor];
      const direction = vNormalize(vSub(rightPosition, leftPosition), [1, 0, 0]);
      const bulge = vNormalize(vCross(direction, [0, 0, 1]), [0, 1, 0]);
      const span = vNorm(vSub(rightPosition, leftPosition));
      const amplitude = Math.min(8.0, Math.max(3.0, span / 4.0));
      for (let offset = 1; offset <= runLength; offset += 1) {
        const residueIndex = start + offset - 1;
        const t = offset / (runLength + 1);
        const basePosition = vAdd(vScale(leftPosition, 1 - t), vScale(rightPosition, t));
        positions[residueIndex] = vAdd(basePosition, vScale(bulge, Math.sin(Math.PI * t) * amplitude));
      }
      continue;
    }

    const anchorIndex = leftAnchor ?? rightAnchor;
    const anchorPosition = anchorIndex === null ? [0, 0, 0] : positions[anchorIndex];
    const direction = leftAnchor === null ? [0, 1, 0] : [0, -1, 0];
    const sweep = leftAnchor === null ? [1, 0, 0] : [-1, 0, 0];
    for (let offset = 1; offset <= runLength; offset += 1) {
      const residueIndex = start + offset - 1;
      const curve = Math.sin((offset / (runLength + 1)) * Math.PI) * 3.0;
      positions[residueIndex] = vAdd(
        anchorPosition,
        vAdd(vScale(direction, offset * 5.2), vScale(sweep, curve))
      );
    }
  }
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

export function generateFallbackPdb(recordId, sequenceText, structureText, destinationPath = '') {
  const sequence = String(sequenceText || '').replace(/\s+/g, '').toUpperCase().replace(/T/g, 'U');
  const structure = String(structureText || '').replace(/\s+/g, '');
  if (!recordId || !sequence || !structure || sequence.length !== structure.length) {
    throw new Error(`Invalid sequence/structure for ${recordId || 'unknown record'}`);
  }

  const pairs = parsePairs(structure);
  const positions = initializePositions(sequence.length);
  const stems = findStems(pairs);
  const anchored = applyStemGeometry(positions, stems);
  fillUnpairedRegions(positions, anchored);
  const outputPath = destinationPath || path.join(outputDir, `${String(recordId).replace(/^RMDB_/, '')}.pdb`);
  writePdb(outputPath, sequence, positions, recordId);
  return outputPath;
}

const isCliRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isCliRun) {
  const recordId = process.argv[2];
  if (!recordId) usage();

  const targets = JSON.parse(fs.readFileSync(targetsPath, 'utf8'));
  const target = targets.find((entry) => entry.id === recordId);
  if (!target) {
    throw new Error(`Target ${recordId} not found in scripts/targets.json`);
  }

  const outputPath = generateFallbackPdb(recordId, target.sequence, target.structure);
  console.log(outputPath);
}
