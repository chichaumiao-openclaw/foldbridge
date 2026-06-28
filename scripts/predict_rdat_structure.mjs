#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage() {
  console.error('Usage: node scripts/predict_rdat_structure.mjs <path-to-rdat>');
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) usage();

const rdatPath = path.resolve(process.cwd(), inputPath);
const text = fs.readFileSync(rdatPath, 'utf8');

function parseValueFields(input) {
  const payload = String(input ?? '').trim();
  if (!payload) return [];
  if (payload.includes('\t')) return payload.split('\t').filter(Boolean);
  return payload.split(/\s+/).filter(Boolean);
}

function percentile(values, p) {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function parseRdat(input) {
  const lines = input.split(/\r?\n/);
  let sequence = '';
  const annotations = new Map();
  const reactivities = new Map();

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    if (line.startsWith('SEQUENCE')) {
      sequence = line.replace(/^SEQUENCE\s+/, '').trim();
      continue;
    }

    if (line.startsWith('ANNOTATION_DATA:')) {
      const indexMatch = line.match(/^ANNOTATION_DATA:(\d+)/);
      if (!indexMatch) continue;
      const index = Number.parseInt(indexMatch[1], 10);
      const columns = line.split('\t').map((entry) => entry.trim()).filter(Boolean);
      annotations.set(index, columns.slice(1));
      continue;
    }

    if (line.startsWith('REACTIVITY:')) {
      const indexMatch = line.match(/^REACTIVITY:(\d+)/);
      if (!indexMatch) continue;
      const index = Number.parseInt(indexMatch[1], 10);
      const values = parseValueFields(line.replace(/^REACTIVITY:\d+\s*/, '')).map((value) => Number.parseFloat(value) || 0);
      reactivities.set(index, values);
    }
  }

  return { sequence, annotations, reactivities };
}

function normalizeSequence(sequence) {
  return String(sequence ?? '').replace(/\s+/g, '').toUpperCase().replace(/T/g, 'U');
}

function chooseRows(parsed) {
  const entries = [...parsed.reactivities.keys()].map((index) => ({
    index,
    tags: (parsed.annotations.get(index) || []).join(' ').toLowerCase()
  }));

  const modified = entries.find((entry) =>
    ['modifier:1m7', 'modifier:shape', 'modifier:2a3', 'modifier:nai'].some((tag) => entry.tags.includes(tag))
  ) || entries.find((entry) => !entry.tags.includes('modifier:nomod')) || entries[0];

  const control = entries.find((entry) => entry.tags.includes('modifier:nomod')) || null;

  if (!modified) throw new Error('No reactivity rows found in RDAT');
  return { modified, control };
}

function correctAndNormalize(modified, control) {
  const corrected = modified.map((value, index) => Math.max(0, value - (control?.[index] || 0)));
  const positives = corrected.filter((value) => value > 0);
  const scale = percentile(positives, 0.9) || Math.max(...corrected, 1) || 1;
  const normalized = corrected.map((value) => value / scale);
  return { corrected, normalized, scale };
}

function canPair(a, b) {
  return (
    (a === 'A' && b === 'U') ||
    (a === 'U' && b === 'A') ||
    (a === 'G' && b === 'C') ||
    (a === 'C' && b === 'G') ||
    (a === 'G' && b === 'U') ||
    (a === 'U' && b === 'G')
  );
}

function pairBonus(a, b) {
  if ((a === 'G' && b === 'C') || (a === 'C' && b === 'G')) return 4.0;
  if ((a === 'A' && b === 'U') || (a === 'U' && b === 'A')) return 3.0;
  return 1.5;
}

function pairingPenalty(reactivity) {
  const value = Math.max(0, Number(reactivity) || 0);
  return Math.max(0, 1.8 * Math.log(value + 1) - 0.6);
}

function predictStructure(sequence, normalizedReactivity) {
  const n = sequence.length;
  const minLoop = 3;
  const dp = Array.from({ length: n }, () => Array(n).fill(0));
  const trace = Array.from({ length: n }, () => Array(n).fill(null));

  for (let span = 1; span < n; span += 1) {
    for (let i = 0; i + span < n; i += 1) {
      const j = i + span;
      let best = dp[i + 1]?.[j] ?? 0;
      let action = { type: 'skip-i' };

      if ((dp[i]?.[j - 1] ?? 0) > best) {
        best = dp[i][j - 1];
        action = { type: 'skip-j' };
      }

      if (j - i > minLoop && canPair(sequence[i], sequence[j])) {
        const pairScore = pairBonus(sequence[i], sequence[j]) - 1.35 * (pairingPenalty(normalizedReactivity[i]) + pairingPenalty(normalizedReactivity[j]));
        const candidate = (dp[i + 1]?.[j - 1] ?? 0) + pairScore;
        if (candidate > best && pairScore > 0) {
          best = candidate;
          action = { type: 'pair' };
        }
      }

      for (let k = i + 1; k < j; k += 1) {
        const candidate = dp[i][k] + dp[k + 1][j];
        if (candidate > best) {
          best = candidate;
          action = { type: 'split', k };
        }
      }

      dp[i][j] = best;
      trace[i][j] = action;
    }
  }

  const structure = Array(n).fill('.');

  function backtrack(i, j) {
    if (i >= j || i < 0 || j < 0 || i >= n || j >= n) return;
    const action = trace[i][j];
    if (!action) return;
    if (action.type === 'skip-i') {
      backtrack(i + 1, j);
      return;
    }
    if (action.type === 'skip-j') {
      backtrack(i, j - 1);
      return;
    }
    if (action.type === 'pair') {
      structure[i] = '(';
      structure[j] = ')';
      backtrack(i + 1, j - 1);
      return;
    }
    if (action.type === 'split') {
      backtrack(i, action.k);
      backtrack(action.k + 1, j);
    }
  }

  backtrack(0, n - 1);
  return { structure: structure.join(''), score: dp[0][n - 1] };
}

const parsed = parseRdat(text);
const sequence = normalizeSequence(parsed.sequence);
const { modified, control } = chooseRows(parsed);
const modifiedValues = parsed.reactivities.get(modified.index) || [];
const controlValues = control ? parsed.reactivities.get(control.index) || [] : null;
const { corrected, normalized, scale } = correctAndNormalize(modifiedValues, controlValues);
const prediction = predictStructure(sequence, normalized);

const output = {
  file: path.basename(rdatPath),
  sequenceLength: sequence.length,
  modifiedRow: modified.index,
  modifiedTags: parsed.annotations.get(modified.index) || [],
  controlRow: control?.index || null,
  controlTags: control ? parsed.annotations.get(control.index) || [] : [],
  normalizationScale: scale,
  correctedReactivityPreview: corrected.slice(0, 20),
  predictedStructure: prediction.structure,
  score: Number(prediction.score.toFixed(3))
};

console.log(JSON.stringify(output, null, 2));
