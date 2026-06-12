import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const generatedSrcDir = path.join(root, 'src', 'generated');

await rm(dist, { recursive: true, force: true });
await mkdir(generatedSrcDir, { recursive: true });
await cp(path.join(root, 'index.html'), path.join(dist, 'index.html'));

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

await cp(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });

const pdbfilesSrc = path.join(root, 'pdbfiles');
const pdbfilesDist = path.join(dist, 'pdbfiles');
try {
  await cp(pdbfilesSrc, pdbfilesDist, { recursive: true });
} catch {
  // optional folder
}

console.log('Build complete: dist/');
