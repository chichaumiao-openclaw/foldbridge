import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateFallbackPdb } from './generate_fallback_pdb.mjs';

const root = process.cwd();
const dist = path.join(root, 'dist');
const generatedSrcDir = path.join(root, 'src', 'generated');
const predictedStructuresDir = path.join(root, 'src', 'assets', 'predicted-structures');
const rmdbPuzzleDir = path.join(root, 'src', 'assets', 'data', 'rmdb-puzzle');
const structureResultsPath = path.join(rmdbPuzzleDir, 'structure_page_results.tsv');

await rm(dist, { recursive: true, force: true });
await mkdir(generatedSrcDir, { recursive: true });
await mkdir(predictedStructuresDir, { recursive: true });
await cp(path.join(root, 'index.html'), path.join(dist, 'index.html'));

function normalizeRnaSequence(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase().replace(/T/g, 'U');
}

function parseStructureResultsRows(text) {
  return text
    .trim()
    .split('\n')
    .map((line) => {
      const cols = line.split('\t');
      return {
        foldBridgeId: cols[23] || '',
        rdatFile: cols[15] || '',
        sequence: normalizeRnaSequence(cols[18] || ''),
        sourceStructure: String(cols[19] || '').replace(/\s+/g, '').trim()
      };
    })
    .filter((row) => row.foldBridgeId.startsWith('RMDB_'));
}

function parseRdatForPrediction(text) {
  let sequence = '';
  const reactivityRows = [];
  const dataAnnotations = new Map();
  const annotationDataRows = [];

  text.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith('SEQUENCE')) {
      sequence = normalizeRnaSequence(line.replace(/^SEQUENCE\s+/, ''));
      return;
    }
    if (line.startsWith('ANNOTATION_DATA:')) {
      const sequenceMatch = line.match(/sequence:([A-Za-z]+)/i);
      const structureMatch = line.match(/structure:([().[\]{}<>]+)/i);
      if (sequenceMatch || structureMatch) {
        annotationDataRows.push({
          sequence: normalizeRnaSequence(sequenceMatch?.[1] || ''),
          structure: String(structureMatch?.[1] || '').replace(/\s+/g, '').trim()
        });
      }
      return;
    }
    if (line.startsWith('DATA_ANNOTATION:')) {
      const match = line.match(/^DATA_ANNOTATION:(\d+)\s+(.+)$/);
      if (!match) return;
      const index = Number(match[1]);
      dataAnnotations.set(index, match[2]);
      return;
    }
    if (!line.startsWith('REACTIVITY:')) return;
    const values = line
      .replace(/^REACTIVITY:\d+\s+/, '')
      .split(/\s+/)
      .filter(Boolean)
      .map((value) => Number(value) || 0);
    if (values.length) reactivityRows.push({ sequence, values });
  });

  const annotatedStructure = annotationDataRows.find(
    (row) => row.sequence && row.structure && row.sequence.length === row.structure.length && /[()[\]{}<>]/.test(row.structure)
  );
  if ((!sequence || /[^AUGC]/.test(sequence)) && annotatedStructure) {
    return {
      sequence: annotatedStructure.sequence,
      structure: annotatedStructure.structure
    };
  }

  if (!reactivityRows.length && dataAnnotations.size) {
    text.split(/\r?\n/).forEach((rawLine) => {
      const line = rawLine.trim();
      const match = line.match(/^DATA:(\d+)\s+(.+)$/);
      if (!match) return;
      const index = Number(match[1]);
      const annotation = dataAnnotations.get(index) || '';
      if (!/datatype:REACTIVITY/i.test(annotation)) return;
      const sequenceMatch = annotation.match(/sequence:([A-Za-z]+)/i);
      const rowSequence = normalizeRnaSequence(sequenceMatch?.[1] || sequence);
      const values = match[2]
        .split(/\s+/)
        .filter(Boolean)
        .map((value) => Number(value) || 0);
      if (values.length) reactivityRows.push({ sequence: rowSequence, values });
    });
  }

  const rankedRows = reactivityRows
    .filter((row) => row.sequence && row.values.length === row.sequence.length)
    .sort((a, b) => {
      if (b.sequence.length !== a.sequence.length) return b.sequence.length - a.sequence.length;
      return b.values.reduce((sum, value) => sum + value, 0) - a.values.reduce((sum, value) => sum + value, 0);
    });
  const selected = rankedRows[0];

  if (!selected) {
    return null;
  }

  return { sequence: selected.sequence, reactivities: selected.values };
}

function predictSecondaryStructure(sequence, reactivities) {
  const pairable = {
    A: new Set(['U']),
    U: new Set(['A', 'G']),
    G: new Set(['C', 'U']),
    C: new Set(['G'])
  };
  const n = sequence.length;
  const minLoop = 3;
  const dp = Array.from({ length: n }, () => Array(n).fill(0));
  const bt = Array.from({ length: n }, () => Array(n).fill(null));

  const pairScore = (i, j) => {
    if (!pairable[sequence[i]]?.has(sequence[j])) return Number.NEGATIVE_INFINITY;
    const ri = Math.min(Number(reactivities[i]) || 0, 8);
    const rj = Math.min(Number(reactivities[j]) || 0, 8);
    const score = 2.2 - 0.18 * (ri + rj);
    return score > 0.2 ? score : Number.NEGATIVE_INFINITY;
  };

  for (let len = 1; len <= n; len += 1) {
    for (let i = 0; i + len - 1 < n; i += 1) {
      const j = i + len - 1;
      let best = i + 1 <= j ? dp[i + 1][j] : 0;
      bt[i][j] = ['skipi'];
      if (i <= j - 1 && dp[i][j - 1] > best) {
        best = dp[i][j - 1];
        bt[i][j] = ['skipj'];
      }
      if (j - i > minLoop) {
        const ps = pairScore(i, j);
        if (Number.isFinite(ps)) {
          const val = (i + 1 <= j - 1 ? dp[i + 1][j - 1] : 0) + ps;
          if (val > best) {
            best = val;
            bt[i][j] = ['pair'];
          }
        }
      }
      for (let k = i + 1; k < j; k += 1) {
        const val = dp[i][k] + dp[k + 1][j];
        if (val > best) {
          best = val;
          bt[i][j] = ['split', k];
        }
      }
      dp[i][j] = best;
    }
  }

  const structure = Array(n).fill('.');
  const trace = (i, j) => {
    if (i >= j || i < 0 || j < 0) return;
    const decision = bt[i][j];
    if (!decision) return;
    if (decision[0] === 'skipi') return trace(i + 1, j);
    if (decision[0] === 'skipj') return trace(i, j - 1);
    if (decision[0] === 'pair') {
      structure[i] = '(';
      structure[j] = ')';
      return trace(i + 1, j - 1);
    }
    if (decision[0] === 'split') {
      trace(i, decision[1]);
      trace(decision[1] + 1, j);
    }
  };
  trace(0, n - 1);
  return structure.join('');
}

const generatedReactivityGuidedPredictions = [];
try {
  const rows = parseStructureResultsRows(await readFile(structureResultsPath, 'utf8'));
  for (const row of rows) {
    if (/[()[\]{}<>]/.test(row.sourceStructure)) continue;
    if (!row.rdatFile) continue;
    try {
      const rdatText = await readFile(path.join(rmdbPuzzleDir, row.rdatFile), 'utf8');
      const parsed = parseRdatForPrediction(rdatText);
      if (!parsed) continue;
      const structure = parsed.structure || predictSecondaryStructure(parsed.sequence, parsed.reactivities);
      if (!/[()[\]{}<>]/.test(structure) || structure.length !== parsed.sequence.length) continue;

      generatedReactivityGuidedPredictions.push([
        row.foldBridgeId,
        {
          structure,
          method: `Local reactivity-guided estimate from the bundled ${row.rdatFile} measurements.`
        }
      ]);

      const fallbackPath = path.join(
        predictedStructuresDir,
        `${row.foldBridgeId.replace(/^RMDB_/, '')}.pdb`
      );
      generateFallbackPdb(row.foldBridgeId, parsed.sequence, structure, fallbackPath);
    } catch {
      // skip malformed or unavailable RDAT-based predictions
    }
  }
} catch {
  // optional dataset
}

generatedReactivityGuidedPredictions.sort((a, b) => a[0].localeCompare(b[0]));
await writeFile(
  path.join(generatedSrcDir, 'reactivityGuidedStructureManifest.js'),
  `export const reactivityGuidedStructurePredictions = ${JSON.stringify(generatedReactivityGuidedPredictions, null, 2)};\n`
);

const caseBundleRootName = 'rmdb_pdb_sequence_cases_rasp_params_besthit_20260610';
const caseBundleSrc = path.join(root, caseBundleRootName);
const caseBundleDist = path.join(dist, caseBundleRootName);
try {
  const entries = await readdir(caseBundleSrc, { withFileTypes: true });
  const manifest = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const caseJsonPath = path.join(caseBundleSrc, entry.name, 'case.json');
    try {
      const data = JSON.parse(await readFile(caseJsonPath, 'utf8'));
      manifest.push({
        pdbId: data.pdb_id,
        candidatePairRows: data.candidate_pair_rows,
        rmdbUniqueSequenceCount: data.rmdb_unique_sequence_count,
        rmdbProfileCount: data.rmdb_profile_count,
        alignmentRows: data.alignment_rows,
        pdbAxisReactivityRows: data.pdb_axis_reactivity_rows,
        projectionStatus: data.projection_status,
        projectionMethod: data.projection_method,
        packageType: data.package_type
      });
    } catch {
      // skip malformed case bundles
    }
  }

  manifest.sort((a, b) => String(a.pdbId).localeCompare(String(b.pdbId)));
  await writeFile(
    path.join(generatedSrcDir, 'caseManifest.js'),
    `export const caseManifest = ${JSON.stringify(manifest, null, 2)};\n`
  );
  await cp(caseBundleSrc, caseBundleDist, { recursive: true });
  await mkdir(caseBundleDist, { recursive: true });
  await writeFile(path.join(caseBundleDist, 'manifest.json'), JSON.stringify(manifest, null, 2));
} catch {
  // optional folder
}

try {
  const entries = await readdir(predictedStructuresDir, { withFileTypes: true });
  const predictedStructureIds = new Set();
  const rnaComposerPredictedStructureIds = new Set();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.rnacomposer.pdb')) {
      const foldBridgeId = `RMDB_${entry.name.replace(/\.rnacomposer\.pdb$/i, '')}`;
      predictedStructureIds.add(foldBridgeId);
      rnaComposerPredictedStructureIds.add(foldBridgeId);
      continue;
    }
    if (entry.name.endsWith('.pdb')) {
      const foldBridgeId = `RMDB_${entry.name.replace(/\.pdb$/i, '')}`;
      predictedStructureIds.add(foldBridgeId);
    }
  }

  await writeFile(
    path.join(generatedSrcDir, 'predictedStructureManifest.js'),
    `export const predictedStructureIds = ${JSON.stringify([...predictedStructureIds].sort(), null, 2)};\n` +
      `export const rnaComposerPredictedStructureIds = ${JSON.stringify(
        [...rnaComposerPredictedStructureIds].sort(),
        null,
        2
      )};\n`
  );
} catch {
  await writeFile(
    path.join(generatedSrcDir, 'predictedStructureManifest.js'),
    'export const predictedStructureIds = [];\nexport const rnaComposerPredictedStructureIds = [];\n'
  );
}

await cp(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });

const pdbfilesSrc = path.join(root, 'pdbfiles');
const pdbfilesDist = path.join(dist, 'pdbfiles');
try {
  await cp(pdbfilesSrc, pdbfilesDist, { recursive: true });
} catch {
  // optional folder
}

console.log('Build complete: dist/');
