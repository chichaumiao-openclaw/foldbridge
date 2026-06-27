import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve('public/annojoin-smoke/5gag/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(path.resolve('public/annojoin-smoke/5gag/workbench.css'), 'utf8');
const js = fs.readFileSync(path.resolve('public/annojoin-smoke/5gag/workbench.js'), 'utf8');
const smokeRoot = path.resolve('public/annojoin-smoke/5gag');

test('5GAG smoke page exposes a complete linked-view workbench contract', () => {
  assert.match(html, /class="workbench-shell"/);
  assert.match(html, /id="track-viewport"/);
  assert.match(html, /id="zoom-in"/);
  assert.match(html, /id="zoom-out"/);
  assert.match(html, /id="pan-left"/);
  assert.match(html, /id="pan-right"/);
  assert.match(html, /id="linked-inspector"/);
  assert.match(html, /id="molstar-host"/);
  assert.match(html, /href="\.\/workbench\.css"/);
  assert.match(html, /src="\.\/workbench\.js"/);

  assert.match(css, /contain: layout paint/);
  assert.match(css, /\.molstar-host \.msp-plugin/);
  assert.match(css, /position: absolute !important/);

  assert.match(js, /function setViewport/);
  assert.match(js, /function zoomTrack/);
  assert.match(js, /function panTrack/);
  assert.match(js, /function initialProfileIdFromLocation/);
  assert.match(js, /function renderProfileById/);
  assert.match(js, /function installExternalProfileBridge/);
  assert.match(js, /function renderTrackRail/);
  assert.match(js, /function renderInspector/);
  assert.match(js, /function getResidueDetails/);
  assert.match(js, /function materializedSequenceAlignment/);
  assert.match(html, /id="molstar-full-host"/);
  assert.match(css, /\.molstar-split/);

  assert.match(js, /function handleBridgeTrackEvent/);
  assert.match(js, /function handleObservedTrackEvent/);
  assert.match(js, /function handleProfileSequenceTrackEvent/);
  assert.match(js, /function handlePdbAlignmentTrackEvent/);
  assert.match(js, /function handlePdbResidueTrackEvent/);
  assert.match(js, /function handleTargetabilityTrackEvent/);
  assert.match(js, /function handleInteractionTrackEvent/);
  assert.match(js, /function trackHoverText/);
  assert.match(js, /bridge_membership/);
  assert.match(js, /observed_mask/);
  assert.match(js, /interaction_endpoint_occupancy/);

  assert.match(js, /function applyLinkedHover/);
  assert.match(js, /function applyMolstarHover/);
  assert.match(js, /function installMolstarEventBridge/);
  assert.match(js, /function handleMolstarResidueEvent/);
  assert.match(js, /PDB\.molstar\.click/);
  assert.match(js, /PDB\.molstar\.mouseover/);
  assert.match(js, /origin = "3d"/);

  assert.match(js, /Raw value/);
  assert.match(js, /Join status/);
  assert.match(js, /Structure locus/);
  assert.match(js, /Assay state/);
  assert.match(js, /profileId/);
  assert.match(js, /annojoin:set-profile/);
  assert.match(js, /window\.location\.search/);
});

test('5GAG smoke consumes linked-view contract assets for residue semantics', () => {
  for (const asset of [
    'residue-index.json',
    'profile-joins.json',
    'structure-contexts.json',
    'structure-coverage.json',
    'bridges.json',
    'interactions.json',
    'confidence-summary.json',
    'lss-context.json',
    'raw-alignment-coverage.json',
  ]) {
    assert.ok(fs.existsSync(path.join(smokeRoot, 'assets', 'linked-view', asset)), `${asset} missing`);
  }

  assert.match(js, /linkedViewUrls/);
  assert.match(js, /buildResidueIndexes/);
  assert.match(js, /buildStructureCoverageIndexes/);
  assert.match(js, /buildConfidenceIndexes/);
  assert.match(js, /buildBridgeIndexes/);
  assert.match(js, /buildInteractionIndexes/);
  assert.match(js, /buildLssContextIndexes/);
  assert.match(js, /buildRawAlignmentCoverageIndexes/);
  assert.match(js, /installVarnaHitLayer/);
  assert.match(js, /data-layer", "varna-hit-layer"/);
  assert.match(js, /data-structure-chain-key/);
  assert.match(js, /profile_sequence/);
  assert.match(js, /pdb_polymer_alignment/);
  assert.match(js, /pdb_residue/);
  assert.match(js, /dms_targetability/);
  assert.match(js, /1d:profile_sequence/);
  assert.match(js, /1d:pdb_polymer_alignment/);
  assert.match(js, /1d:dms_targetability/);
  assert.match(js, /data-alignment-state/);
  assert.match(js, /data-alignment-source/);
  assert.match(js, /fec_lss_confidence/);
  assert.match(js, /Profile\/RMDB seq/);
  assert.match(js, /PDB polymer alignment/);
  assert.doesNotMatch(js, /\["PDB polymer seq"/);
  assert.doesNotMatch(js, /pdbBaseText/);
  assert.match(js, /profile-PDB polymer sequence match/);
  assert.match(js, /atom_site coordinates observed/);
  assert.match(js, /not a sequence-alignment count/);
  assert.match(js, /PDB polymer residue/);
  assert.match(js, /DMS targetability/);
  assert.match(js, /FEC\/LSS confidence/);
  assert.match(js, /ANNOCONFIDENCE/);
  assert.doesNotMatch(js, /bridgeMembership:\s*partners\.length \?/);
  assert.doesNotMatch(js, /interactionEndpoint:\s*partners\.length \?/);
  assert.doesNotMatch(js, /return `5GAG\|chain\|strand_1\|\$\{position\}`/);
  assert.doesNotMatch(js, /function pdbBaseForPosition/);
  assert.doesNotMatch(js, /function alignmentStateForBases/);
  assert.doesNotMatch(js, /function sequenceAlignmentSummary/);
  assert.doesNotMatch(js, /comparableLength/);
  assert.doesNotMatch(js, /fallback\.matchedResidues/);
  assert.doesNotMatch(js, /raw_fallback/);
});

test('5GAG smoke manifest registers linked-view projection assets', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'browser_smoke_manifest.json'), 'utf8'));
  const sizeReport = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'asset_size_report.json'), 'utf8'));
  const linkedViewAssets = [
    'residue-index.json',
    'profile-joins.json',
    'structure-contexts.json',
    'structure-coverage.json',
    'bridges.json',
    'interactions.json',
    'confidence-summary.json',
    'lss-context.json',
    'raw-alignment-coverage.json',
  ];

  let totalBytes = 0;
  for (const asset of linkedViewAssets) {
    const key = `linked_view_${asset.replace(/[-.]/g, '_').replace(/_json$/, '')}`;
    const href = `assets/linked-view/${asset}`;
    assert.equal(manifest.assets[key], href);
    totalBytes += fs.statSync(path.join(smokeRoot, href)).size;
  }
  assert.equal(sizeReport.linked_view_total_bytes, totalBytes);
  assert.equal(sizeReport.linked_view_asset_count, linkedViewAssets.length);
});

test('5GAG smoke resource provenance manifest records source tools and dispatch boundaries', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'browser_smoke_manifest.json'), 'utf8'));
  assert.equal(manifest.assets.resource_provenance, 'assets/resource-provenance.json');

  const provenance = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'assets', 'resource-provenance.json'), 'utf8'));
  assert.equal(provenance.protocolVersion, 'annojoin-web-resource-provenance.v0.1');
  assert.equal(provenance.caseId, '5GAG');
  assert.equal(provenance.consumerRepo, 'docs/foldbridge');
  assert.equal(provenance.producerRepo, 'docs/rmdb2pdb');
  assert.match(provenance.documentation, /ANNOJOIN网页资源来源清单_20260626\.md/);
  assert.ok(Array.isArray(provenance.resourceGroups));

  const byId = new Map(provenance.resourceGroups.map((group) => [group.groupId, group]));
  for (const groupId of [
    'page-shell',
    'dbn-2d-structure',
    'varna-layout-template',
    'profile-reactivity-shards',
    'linked-view-contract-assets',
    'lss-context',
    'raw-qcov-scov',
    'molstar-3d-runtime',
    'technology-family-smoke',
  ]) {
    assert.ok(byId.has(groupId), `${groupId} missing`);
  }

  const dbn = byId.get('dbn-2d-structure');
  assert.deepEqual(dbn.viewerAssets, ['assets/case_2d_structure_5gag.json']);
  assert.match(dbn.sourceDataPaths.join('\n'), /ANNOJOIN\/2d_smoke_5gag_20260618\/dbn\/5gag\.dbn/);
  assert.equal(dbn.toolRuntime.remoteHost, '10.40.0.132');
  assert.equal(dbn.toolRuntime.remoteRoot, '/data/rnapdbee-dotbracket-amd64');
  assert.deepEqual(dbn.toolRuntime.containers, ['rnapdbee-engine', 'rnapdbee-adapters', 'cli2rest-rnaview']);
  assert.match(dbn.dispatch.command, /batch_rnaview_dotbracket\.py --engine-url http:\/\/127\.0\.0\.1:18081 --recursive/);
  assert.match(dbn.dispatch.outputs.join('\n'), /summary\.tsv/);
  assert.match(dbn.dispatch.outputs.join('\n'), /\.dbn/);

  const lss = byId.get('lss-context');
  assert.equal(lss.viewerAssets[0], 'assets/linked-view/lss-context.json');
  assert.equal(lss.sourceDataPaths[0], 'ANNOCONFIDENCE/lss_structure_context_annotation.tsv');
  assert.deepEqual(lss.joinKeys, ['profileId']);
  assert.equal(lss.matchPolicy, 'profile_id_exact');

  const rawCoverage = byId.get('raw-qcov-scov');
  assert.equal(rawCoverage.status, 'not_materialized');
  assert.equal(rawCoverage.viewerAssets[0], 'assets/linked-view/raw-alignment-coverage.json');
  assert.match(rawCoverage.recommendedSourceDataPaths.join('\n'), /PIPLINE\/rmdb2pdb_v3_exact_query_vs_pdb_normalized_acgun_rasp_params_20260612/);
  assert.match(rawCoverage.notes.join('\n'), /Do not label RASP feature coverage as RMDB profile qcov\/scov/);

  const molstar = byId.get('molstar-3d-runtime');
  assert.match(molstar.runtimeUrls.join('\n'), /https:\/\/files\.rcsb\.org\/download\/5GAG\.cif/);
  assert.match(molstar.runtimeUrls.join('\n'), /pdbe-molstar@3\.3\.0/);
  assert.equal(molstar.dispatch.mode, 'browser_client_alignment_crop');
  assert.deepEqual(molstar.joinKeys, ['structure-coverage.atomSiteFilter', 'structure-coverage.sequenceAlignment']);
  assert.match(molstar.notes.join('\n'), /full CIF reference/);

  const technologyFamilies = byId.get('technology-family-smoke');
  assert.match(technologyFamilies.sourceDataPaths.join('\n'), /docs\/技术沉淀\/RNA探针技术特性\.tsv/);
  assert.match(technologyFamilies.sourceDataPaths.join('\n'), /probe_confidence_method_registry\.tsv/);
});

test('5GAG raw qcov/scov remains an explicit non-materialized alignment contract', () => {
  const rawCoveragePath = path.join(smokeRoot, 'assets', 'linked-view', 'raw-alignment-coverage.json');
  const rawCoverage = JSON.parse(fs.readFileSync(rawCoveragePath, 'utf8'));
  assert.equal(rawCoverage.protocolVersion, 'linked-view-v0.1');
  assert.equal(rawCoverage.caseId, '5GAG');
  assert.equal(rawCoverage.status, 'not_materialized');
  assert.equal(rawCoverage.sourceDataPath, 'not_materialized');
  assert.equal(rawCoverage.matchPolicy, 'profile_id_pair_id_pair_segment_id_exact');
  assert.deepEqual(rawCoverage.records, []);
  assert.match(rawCoverage.note, /raw alignment\/BLAST coverage/);
  assert.match(rawCoverage.note, /not FEC semantic coverage/);

  const structureCoverage = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'assets', 'linked-view', 'structure-coverage.json'), 'utf8'));
  assert.equal(structureCoverage.coverage.qcov, undefined);
  assert.equal(structureCoverage.coverage.scov, undefined);
  assert.equal(structureCoverage.coverage.subject_coverage, undefined);
  assert.equal(structureCoverage.coverage.construct_coverage, undefined);

  assert.match(js, /rawAlignmentCoverage: "assets\/linked-view\/raw-alignment-coverage\.json"/);
  assert.match(js, /function rawAlignmentCoverageForProfile/);
  assert.match(js, /function rawAlignmentCoverageMetric/);
  assert.match(js, /RMDB query coverage/);
  assert.match(js, /PDB reference sequence coverage/);
  assert.match(js, /raw_alignment_coverage/);
  assert.doesNotMatch(js, /scalarCoverageMetric\("qcov"\)/);
  assert.doesNotMatch(js, /scalarCoverageMetric\("scov"\)/);
  assert.doesNotMatch(js, /structureCoverage\?\.coverage\?\.\[metricName\]/);
});

test('5GAG Molstar renders an alignment-cropped target view plus a full-CIF reference', () => {
  assert.equal(fs.existsSync(path.join(smokeRoot, 'assets', 'structure')), false);

  const coverage = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'assets', 'linked-view', 'structure-coverage.json'), 'utf8'));
  assert.equal(coverage.activeChainKey, '5GAG|chain|strand_1');
  assert.deepEqual(coverage.atomSiteFilter, { label_asym_id: 'A', auth_asym_id: '1' });
  assert.equal(coverage.polymerChain.sequence.length, 113);
  assert.equal(coverage.polymerChain.sequence.slice(0, 20), 'GGGGGCUCUGUUGGUUCUCC');
  assert.deepEqual(coverage.sequenceAlignment, {
    profileResidues: 113,
    pdbPolymerResidues: 113,
    matchedResidues: 113,
    mismatchedResidues: 0,
    status: 'full_profile_to_pdb_polymer_sequence_match',
  });
  assert.equal(coverage.coverage.resolvedResidues, 43);
  assert.equal(coverage.coverage.profileResidues, 113);
  assert.equal(coverage.coverage.firstResolvedProfilePosition, 32);
  assert.equal(coverage.coverage.lastResolvedProfilePosition, 74);

  const residueIndex = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'assets', 'linked-view', 'residue-index.json'), 'utf8'));
  const residue1 = residueIndex.residues.find((residue) => residue.residueKey === '5GAG|chain|strand_1|1');
  const residue52 = residueIndex.residues.find((residue) => residue.residueKey === '5GAG|chain|strand_1|52');
  assert.equal(residue1.labelAsymId, 'A');
  assert.equal(residue1.authAsymId, '1');
  assert.equal(residue52.labelAsymId, 'A');
  assert.equal(residue52.authAsymId, '1');

  const structureContexts = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'assets', 'linked-view', 'structure-contexts.json'), 'utf8'));
  const locus1 = structureContexts.loci.find((locus) => locus.residueKey === '5GAG|chain|strand_1|1');
  const locus52 = structureContexts.loci.find((locus) => locus.residueKey === '5GAG|chain|strand_1|52');
  assert.equal(locus1.coordinateStatus, 'unresolved');
  assert.equal(locus1.locator.label_asym_id, 'A');
  assert.equal(locus1.locator.auth_asym_id, '1');
  assert.equal(locus52.coordinateStatus, 'resolved');
  assert.equal(locus52.locator.label_asym_id, 'A');
  assert.equal(locus52.locator.auth_asym_id, '1');

  const confidence = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'assets', 'linked-view', 'confidence-summary.json'), 'utf8'));
  assert.equal(confidence.fec.status, 'not_materialized_in_smoke');
  assert.equal(confidence.lss.status, 'not_materialized_in_smoke');
  assert.equal(confidence.annoconfidence.status, 'not_materialized_in_smoke');

  assert.match(js, /const sourceStructureUrl = "https:\/\/files\.rcsb\.org\/download\/5GAG\.cif"/);
  assert.match(js, /async function loadStructureSourceForMolstar/);
  assert.match(js, /function alignmentCropRange/);
  assert.match(js, /function filterMmcifAtomSiteLoop/);
  assert.match(js, /function atomSiteRowMatchesAlignmentCrop/);
  assert.match(js, /async function prepareClientAlignmentCroppedCif/);
  assert.match(js, /mode: "client-alignment-crop"/);
  assert.match(js, /customData: \{ url: croppedCif\.url, format: "cif" \}/);
  assert.match(js, /customData: \{ url: sourceCif\.sourceUrl, format: "cif" \}/);
  assert.match(js, /target chain alignment crop/);
  assert.match(js, /full CIF reference/);
  assert.match(js, /atomSiteFilter/);
  assert.doesNotMatch(js, /5gag_chain_strand_1\.cif/);
});

test('5GAG unresolved target-chain residues render as gray sequence-only coordinates', () => {
  assert.match(js, /const coordinateResolvedStyle = \{ fill: "#e3f1fb", stroke: "#3f7da8" \}/);
  assert.match(js, /const coordinateSequenceOnlyStyle = \{ fill: "#d8dde3", stroke: "#8d97a3" \}/);
  assert.match(js, /function coordinateDisplayStatus/);
  assert.match(js, /sequence only; no resolved atom_site coordinate/);
  assert.match(js, /data-coordinate-meaning/);
  assert.match(js, /sequence_only_no_atom_site_coordinate/);
  assert.match(js, /3D coords/);
  assert.match(js, /3D coordinates/);
  assert.doesNotMatch(js, /not observed in current CIF/);
  assert.doesNotMatch(js, /PDB coord \$\{details\.position\}: \$\{details\.coordinateStatus\}/);
});

test('5GAG PDB polymer alignment track renders the polymer base sequence', () => {
  assert.match(js, /const pdbAlignmentText = createSvgNode\(svg, "text"/);
  assert.match(js, /pdbAlignmentText\.textContent = pdbBase/);
});

test('5GAG linked-view LSS context is materialized from ANNOCONFIDENCE by profile id', () => {
  const lss = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'assets', 'linked-view', 'lss-context.json'), 'utf8'));
  assert.equal(lss.protocolVersion, 'linked-view-v0.1');
  assert.equal(lss.caseId, '5GAG');
  assert.equal(lss.sourceDataPath, 'ANNOCONFIDENCE/lss_structure_context_annotation.tsv');
  assert.equal(lss.matchPolicy, 'profile_id_exact');
  assert.ok(Array.isArray(lss.records));

  const dms262 = lss.records.find((record) => record.profileId === 'data-rna-structures/SRPECLI_DMS_0001.rdat#DATA:262');
  assert.deepEqual(dms262, {
    profileId: 'data-rna-structures/SRPECLI_DMS_0001.rdat#DATA:262',
    pairId: '5GAG:sequence_000008',
    pairSegmentId: 'pairseg_5GAG_sequence_000008',
    segmentLabel: '5GAG:1-113',
    start: 1,
    end: 113,
    pairedEvaluable: 18,
    unpairedEvaluable: 4,
    lssStatus: 'LSS_UNDERPOWERED',
    contextEngine: 'FEC_V0_4_BETA_LSS',
  });
  assert.doesNotMatch(JSON.stringify(lss), /case_level_fallback|coarse_case_match|inferred_from_ui/);
});

test('5GAG DMS loop recall uses mapped AC positive signal positions only', () => {
  const structure = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'assets', 'case_2d_structure_5gag.json'), 'utf8'));
  const strand = structure.strands.find((item) => item.strand_id === 'strand_1');
  const pairedPositions = new Set(strand.pairs.flatMap((pair) => [pair.i, pair.j]));
  const profiles = JSON.parse(fs.readFileSync(path.join(smokeRoot, 'assets', 'profile_reactivity_5gag_reference_mapped.json'), 'utf8'));
  const profile = profiles.profiles.find((item) => item.profile_id === 'data-rna-structures/SRPECLI_DMS_0001.rdat#DATA:262');
  const acSignal = profile.residues.filter((residue) => (
    residue.mapped_to_strand === true
    && /^[AC]$/.test(residue.base)
    && Number(residue.raw_value) > 0
  ));
  const loopSignal = acSignal.filter((residue) => !pairedPositions.has(residue.position));
  const stemSignal = acSignal.filter((residue) => pairedPositions.has(residue.position));

  assert.equal(acSignal.length, 34);
  assert.equal(loopSignal.length, 30);
  assert.equal(stemSignal.length, 4);
  assert.deepEqual(stemSignal.map((residue) => residue.position), [33, 59, 68, 74]);
  assert.match(js, /function computeDmsLoopRecall/);
  assert.match(js, /mapped_to_strand === true/);
  assert.match(js, /raw_value\) > 0/);
  assert.match(js, /DMS loop recall/);
});

test('5GAG shared residue state colors drive 1D and 2D without replacing DMS signal colors', () => {
  assert.match(js, /const RESIDUE_STATE_COLORS = Object\.freeze/);
  for (const [stateName, hex] of [
    ['loop', '#dcfce7'],
    ['stem', '#dbeafe'],
    ['selected', '#fee2e2'],
    ['unaligned', '#e5e7eb'],
  ]) {
    assert.match(js, new RegExp(`${stateName}: \\{ fill: "${hex}"`));
  }
  assert.match(js, /function secondaryStructureStateForPosition/);
  assert.match(js, /function visualStateForResidue/);
  assert.match(js, /function colorForResidueVisualState/);
  assert.match(js, /wireTrackMark\(structureStateCell, residueKey, "structure_state", handleStructureStateTrackEvent\)/);
  assert.match(js, /data-structure-state/);
  assert.match(js, /data-state-color-source", "RESIDUE_STATE_COLORS"/);
  assert.match(js, /data-reactivity-fill/);
  assert.match(js, /fillCircles\[idx\]\.setAttribute\("fill", toVarnaRgb\(color\)\)/);
});

test('5GAG 3D target display defaults to DMS reactivity colors on the cropped target chain', () => {
  assert.match(js, /const MOLSTAR_CONTEXT_COLOR = Object\.freeze\(\{ r: 229, g: 231, b: 235 \}\)/);
  assert.match(js, /function colorForMolstarDmsReactivity/);
  assert.match(js, /function buildMolstarTargetDisplayPayload/);
  assert.match(js, /function applyMolstarTargetDisplay/);
  assert.match(js, /struct_asym_id: locator\.label_asym_id \|\| locator\.auth_asym_id \|\| residue\.labelAsymId/);
  assert.doesNotMatch(js, /struct_asym_id: locator\.auth_asym_id \|\| locator\.label_asym_id \|\| residue\.authAsymId/);
  assert.match(js, /targetDisplayColorSource = "DMS_REACTIVITY_FILL"/);
  assert.match(js, /targetDisplayMode = "alignment_cropped_target_chain"/);
  assert.match(js, /targetDisplayResidues = String\(payload\.length\)/);
  assert.match(js, /nonSelectedColor: MOLSTAR_CONTEXT_COLOR/);
  assert.match(js, /alignment-cropped target chain/);
  assert.doesNotMatch(js, /nonSelectedColor: .*unaligned/i);
  assert.doesNotMatch(js, /const stateColor = colorForResidueVisualState\(residueKey, selectedKey\);\n\s*return \[\{\n\s*struct_asym_id:[\s\S]*?color: stateColor\.molstarRgb/);
  assert.match(js, /color: colorForMolstarDmsReactivity\(row, residueKey, selectedKey\)/);
  assert.match(js, /window\.setTimeout\(\(\) => applyMolstarTargetDisplay\(state\.selectedResidueKey\), 700\)/);
  assert.match(js, /function molstarEventMatchesActiveChain/);
  assert.match(js, /atomSiteFilter/);
});
