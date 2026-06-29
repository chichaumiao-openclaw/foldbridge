import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const smokeRoot = path.resolve('public/annojoin-smoke/technology-families');
const indexPath = path.join(smokeRoot, 'assets', 'technology-family-index.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('technology family smoke index materializes the six registry measurement families', () => {
  const asset = readJson(indexPath);

  assert.equal(asset.protocolVersion, 'annojoin-technology-family-smoke.v0.1');
  assert.equal(asset.sources.knowledgeSource, 'docs/技术沉淀/RNA探针技术特性.tsv');
  assert.equal(asset.sources.registry, 'task_packages/fec_lss_rc3_release_20260623/probe_confidence_method_registry.tsv');
  assert.equal(asset.axisPolicy.rmdbCoverageAxis, 'rmdb_profile_query_to_pdb_subject');
  assert.equal(asset.axisPolicy.raspCoverageAxis, 'rasp_feature_query_to_pdb_subject');
  assert.equal(asset.axisPolicy.structureCoverageAxis, 'sequence_alignment_and_atom_site_coordinates_only');

  assert.deepEqual(asset.families.map((family) => family.id), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(asset.registrySummary.technologyCount, 33);
  assert.deepEqual(asset.registrySummary.familyCounts, { A: 10, B: 14, C: 3, D: 4, E: 2, F: 1 });
  assert.equal(asset.registrySummary.unknownFamilyCount, 0);
});

test('technology family smoke keeps scientific semantics per family', () => {
  const { families } = readJson(indexPath);
  const byId = new Map(families.map((family) => [family.id, family]));

  assert.equal(byId.get('A').signalDirection, 'unpaired_positive');
  assert.equal(byId.get('A').referenceQuantity, 'rnaview_dssr_paired_unpaired_label');
  assert.equal(byId.get('A').recallMetric, 'auc_unpaired_vs_paired');
  assert.ok(byId.get('A').technologies.includes('DMS'));
  assert.ok(byId.get('A').technologies.includes('CMC'));
  assert.ok(byId.get('A').technologies.includes('Keth-seq'));

  assert.equal(byId.get('B').signalDirection, 'unpaired_positive');
  assert.equal(byId.get('B').visualChannel, 'residue_reactivity');
  assert.ok(byId.get('B').technologies.includes('BzCN'));
  assert.ok(byId.get('B').technologies.includes('2A3'));
  assert.ok(byId.get('B').technologies.includes('SHAPE-MaP'));

  assert.equal(byId.get('C').signalDirection, 'paired_positive');
  assert.equal(byId.get('C').recallMetric, 'auc_paired_vs_unpaired');
  assert.equal(byId.get('C').conflictMetric, 'unpaired_high_fraction');

  assert.equal(byId.get('D').referenceQuantity, 'pdb_shrake_rupley_residue_sasa');
  assert.equal(byId.get('D').recallMetric, 'spearman_reactivity_vs_sasa');
  assert.equal(byId.get('D').visualChannel, 'sasa_accessibility');

  assert.equal(byId.get('E').visualChannel, 'contact_map');
  assert.equal(byId.get('E').recallMetric, 'contact_pair_auc');
  assert.equal(byId.get('F').visualChannel, 'pair_set');
  assert.equal(byId.get('F').recallMetric, 'pair_f1');
});

test('technology family smoke representative cases preserve RMDB/RASP axis boundaries', () => {
  const asset = readJson(indexPath);
  const byId = new Map(asset.families.map((family) => [family.id, family]));

  for (const familyId of ['A', 'B', 'C', 'D']) {
    const rasp = byId.get(familyId).representativeCases.find((item) => item.sourceFamily === 'RASP2PDB');
    assert.ok(rasp, `${familyId} missing RASP representative`);
    assert.equal(rasp.coverageAxis, 'rasp_feature_query_to_pdb_subject');
    assert.match(rasp.caseKey, /^RASP2PDB:/);
    assert.equal(rasp.status, 'current_atlas_case');
  }

  assert.deepEqual(
    byId.get('A').representativeCases.find((item) => item.sourceFamily === 'RMDB2PDB'),
    {
      sourceFamily: 'RMDB2PDB',
      caseKey: 'RMDB2PDB:5GAG',
      pdbId: '5GAG',
      technology: 'DMS',
      profileId: 'data-rna-structures/SRPECLI_DMS_0001.rdat#DATA:262',
      coverageAxis: 'rmdb_profile_query_to_pdb_subject',
      coverageSource: 'PIPLINE/rmdb2pdb_v3_exact_query_vs_pdb_normalized_acgun_rasp_params_20260612',
      status: 'smoke_ready',
      href: '../5gag/index.html',
    }
  );
  assert.equal(byId.get('B').representativeCases.find((item) => item.sourceFamily === 'RMDB2PDB').technology, 'BzCN');
  assert.equal(byId.get('E').representativeCases[0].status, 'not_materialized_in_current_atlas');
  assert.equal(byId.get('F').representativeCases[0].status, 'not_materialized_in_current_atlas');

  assert.ok(asset.controls.negativeAssayLabels.includes('None'));
  assert.equal(asset.controls.negativeAssayPolicy, 'do_not_assign_to_measurement_family');
  assert.equal(asset.controls.rmdbCoarseLabel, 'rmdb_chemical_probing');
  assert.equal(asset.controls.rmdbCoarseLabelPolicy, 'requires_profile_provenance_split');
  assert.equal(asset.aliases['Structure-seq'], 'Structure-Seq');
});

test('technology family smoke pages expose six standalone family routes', () => {
  const asset = readJson(indexPath);
  const indexHtml = fs.readFileSync(path.join(smokeRoot, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(smokeRoot, 'workbench.js'), 'utf8');

  assert.match(indexHtml, /id="family-list"/);
  assert.match(indexHtml, /assets\/technology-family-index\.json/);
  assert.match(js, /function renderFamilyPage/);
  assert.match(js, /RASP feature query -&gt; PDB subject/);
  assert.match(js, /RMDB profile query -&gt; PDB subject/);
  assert.match(js, /not residue reactivity/);
  assert.doesNotMatch(js, /rmdb_chemical_probing.*measurement family/i);

  for (const family of asset.families) {
    const pagePath = path.join(smokeRoot, family.pageHref);
    const html = fs.readFileSync(pagePath, 'utf8');
    assert.match(html, new RegExp(`data-family-id="${family.id}"`));
    assert.match(html, /src="\.\/workbench\.js"/);
    assert.match(html, /href="\.\/workbench\.css"/);
  }
});
