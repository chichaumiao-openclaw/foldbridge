import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const buildScript = path.join(repoRoot, 'scripts/build-annojoin-atlas.mjs');

// 11 required ANNOJOIN tables (TABLES map in build-annojoin-atlas.mjs).
// Two source rows under one shared pdb_id so a merged display row is produced.
function writeFixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'annojoin-fixture-'));
  const tsv = (rows) => rows.map((cols) => cols.join('\t')).join('\n') + '\n';
  writeFileSync(path.join(root, 'anno_case_search_index.tsv'), tsv([
    ['asset_family', 'case_id', 'pdb_id', 'biological_molecule_name', 'parent_class_label', 'child_class_label', 'confidence_display_label', 'profile_count', 'profile_ids', 'profile_ids_complete', 'search_text'],
    ['RMDB2PDB', '10FZ', '10FZ', '16S ribosomal RNA', 'Ribosome', '16S rRNA', 'B_CONTEXT_STRATIFIED (1)', '2', 'a;b', 'true', '10FZ rmdb'],
    ['RASP2PDB', '10FZ', '10FZ', '16S ribosomal RNA', 'RASP public current', 'raw-hit case', 'RASP public current; positive confidence not active', '1', 'c', 'true', '10FZ rasp']
  ]));
  writeFileSync(path.join(root, 'anno_facet_catalog.tsv'), tsv([
    ['facet_name', 'source_table', 'source_column', 'display_label'],
    ['PDB ID', 'anno_case_search_index.tsv', 'pdb_id', 'PDB ID']
  ]));
  writeFileSync(path.join(root, 'anno_case_evidence_summary.tsv'), tsv([
    ['asset_family', 'case_id', 'recommended_default_preset'],
    ['RMDB2PDB', '10FZ', 'rmdb-view'],
    ['RASP2PDB', '10FZ', 'rasp-view']
  ]));
  writeFileSync(path.join(root, 'anno_detail_route_index.tsv'), tsv([
    ['asset_family', 'case_id', 'detail_route_id'],
    ['RMDB2PDB', '10FZ', 'detail:rmdb'],
    ['RASP2PDB', '10FZ', 'detail:rasp']
  ]));
  // remaining tables can be header-only (parseTsv yields [])
  writeFileSync(path.join(root, 'anno_case_profile_membership.tsv'), 'asset_family\tcase_id\tpair_id\tprofile_id\n');
  writeFileSync(path.join(root, 'anno_residue_track_route_index.tsv'), 'asset_family\tcase_id\ttrack_route_id\n');
  writeFileSync(path.join(root, 'anno_2d_pair_context_route_index.tsv'), 'asset_family\tcase_id\tcontext_route_id\n');
  writeFileSync(path.join(root, 'anno_3d_residue_coloring_route_index.tsv'), 'asset_family\tcase_id\tstructure_file_path\n');
  writeFileSync(path.join(root, 'anno_conflict_candidate_index.tsv'), 'asset_family\tcase_id\tconflict_candidate_id\n');
  writeFileSync(path.join(root, 'atlas_preset_view_definitions.tsv'), 'preset_id\tpreset_name\n');
  writeFileSync(path.join(root, 'atlas_download_manifest.tsv'), 'download_id\tdownload_label\tfile_path\trow_count\n');
  return root;
}

function runBuild(annojoinRoot, outRoot, extraArgs = []) {
  // Point optional-table envs at a non-existent path so they degrade to [].
  const result = spawnSync('node', [buildScript, ...extraArgs], {
    cwd: repoRoot,
    env: {
      ...process.env,
      FOLDBRIDGE_ANNOJOIN_ROOT: annojoinRoot,
      FOLDBRIDGE_ANNOJOIN_ATLAS_OUT: outRoot,
      // Pin viewId so the two temp out-dirs don't diverge on source.viewId
      // (which otherwise defaults to path.basename(OUT_ROOT)).
      FOLDBRIDGE_ANNOJOIN_ATLAS_VIEW_ID: 'fixture-view',
      FOLDBRIDGE_ANNOCONFIDENCE_ROOT: path.join(annojoinRoot, '__missing_annoconfidence__'),
      FOLDBRIDGE_FEC_EVIDENCE_ROOT: path.join(annojoinRoot, '__missing_fec__'),
      FOLDBRIDGE_PDB_CHAIN_IDENTITY: path.join(annojoinRoot, '__missing_identity__.tsv'),
      FOLDBRIDGE_PDB_GOVERNED_MAP: path.join(annojoinRoot, '__missing_governed__.tsv'),
      FOLDBRIDGE_RMDB_ABC_LSS_ROOT: '',
      FOLDBRIDGE_RASP_D_LSS_ROOT: ''
    },
    encoding: 'utf8'
  });
  return result;
}

function stripGeneratedAt(jsonText) {
  const obj = JSON.parse(jsonText);
  delete obj.generatedAt;
  return JSON.stringify(obj);
}

test('--index-only writes index.json + detail-route-index.json but no per-case files', () => {
  const root = writeFixtureRoot();
  const fullOut = mkdtempSync(path.join(tmpdir(), 'annojoin-full-out-'));
  const indexOut = mkdtempSync(path.join(tmpdir(), 'annojoin-index-out-'));

  const full = runBuild(root, fullOut);
  assert.equal(full.status, 0, `full build failed: ${full.stderr}`);
  // full build writes per-case assets
  assert.ok(existsSync(path.join(fullOut, 'cases')), 'full build wrote cases/ dir');
  assert.ok(readdirSync(path.join(fullOut, 'cases')).length > 0);

  const indexOnly = runBuild(root, indexOut, ['--index-only']);
  assert.equal(indexOnly.status, 0, `index-only build failed: ${indexOnly.stderr}`);
  assert.ok(existsSync(path.join(indexOut, 'index.json')), 'index.json written');
  assert.ok(existsSync(path.join(indexOut, 'detail-route-index.json')), 'detail-route-index.json written');
  // index-only writes NO per-case files
  assert.equal(existsSync(path.join(indexOut, 'cases')), false, 'index-only wrote no cases/ dir');

  // written index.json is slimmed (no cases key)
  const slim = JSON.parse(readFileSync(path.join(indexOut, 'index.json'), 'utf8'));
  assert.equal('cases' in slim, false);
  assert.equal(slim.totalSourceCaseCount, 2);
  assert.equal(slim.displayCases.length, 1);

  // index-only index.json == full-build index.json (modulo generatedAt)
  assert.equal(
    stripGeneratedAt(readFileSync(path.join(indexOut, 'index.json'), 'utf8')),
    stripGeneratedAt(readFileSync(path.join(fullOut, 'index.json'), 'utf8'))
  );
});
