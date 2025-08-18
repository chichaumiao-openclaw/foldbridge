import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCaseConfidenceSidecars,
  buildConfidenceAssetPaths,
} from '../scripts/lib/annojoin-atlas-confidence.mjs';

test('buildConfidenceAssetPaths encodes atlas case keys into stable sidecar paths', () => {
  assert.deepEqual(buildConfidenceAssetPaths('RMDB2PDB:5GAG'), {
    summaryPath: 'cases/RMDB2PDB%3A5GAG/confidence-summary.json',
    evidencePath: 'cases/RMDB2PDB%3A5GAG/confidence-evidence.json',
    provenancePath: 'cases/RMDB2PDB%3A5GAG/confidence-provenance.json',
  });
});

test('buildCaseConfidenceSidecars bridges profile_key through memberships to pair routes and selects strongest default evidence', () => {
  const assets = buildCaseConfidenceSidecars({
    atlasCaseKey: 'RMDB2PDB:5GAG',
    caseId: '5GAG',
    calibratedRows: [
      {
        profile_key: 'exact-profile-a',
        pdb_id: '5GAG',
        chain: '1',
        technology: 'DMS',
        measurement_family: 'A',
        lss_tier_uncalibrated: 'LSS_MODERATE_CANDIDATE',
        lss_tier_calibrated: 'LSS_STRONG',
        auc_directional: '0.8125',
        auc_empirical_p_value: '0.010000',
        auc_effect_size_z: '2.11',
        conflict_fraction: '0.100000',
        partner_inside_fraction: '0.850000',
        partner_outside_fraction: '0.150000',
        n_evaluable: '32',
        n_paired_evaluable: '20',
        n_unpaired_evaluable: '12',
        permutation_status: 'RUN',
        permutation_n: '1000',
        calibration_note: '',
        confidence_ranked_set_eligible: 'true',
      },
      {
        profile_key: 'exact-profile-b',
        pdb_id: '5GAG',
        chain: '1',
        technology: '2A3',
        measurement_family: 'B',
        lss_tier_uncalibrated: 'LSS_MODERATE_CANDIDATE',
        lss_tier_calibrated: 'LSS_MODERATE',
        auc_directional: '0.7500',
        auc_empirical_p_value: '0.040000',
        auc_effect_size_z: '1.85',
        conflict_fraction: '0.120000',
        partner_inside_fraction: '0.650000',
        partner_outside_fraction: '0.350000',
        n_evaluable: '28',
        n_paired_evaluable: '16',
        n_unpaired_evaluable: '12',
        permutation_status: 'RUN',
        permutation_n: '1000',
        calibration_note: '',
        confidence_ranked_set_eligible: 'true',
      },
    ],
    memberships: [
      { profile_id: 'exact-profile-a', pair_id: '5GAG:sequence_000001' },
      { profile_id: 'exact-profile-b', pair_id: '5GAG:sequence_000002' },
    ],
    tracks: [
      { pair_id: '5GAG:sequence_000001', profile_id: 'data-rna-structures/A.rdat#1', track_route_id: 'track:5GAG:1' },
      { pair_id: '5GAG:sequence_000002', profile_id: 'data-rna-structures/B.rdat#1', track_route_id: 'track:5GAG:2' },
    ],
    pairs2d: [
      { pair_id: '5GAG:sequence_000001', pair_segment_id: 'pairseg_5GAG_sequence_000001', context_route_id: '2d:5GAG:1' },
      { pair_id: '5GAG:sequence_000002', pair_segment_id: 'pairseg_5GAG_sequence_000002', context_route_id: '2d:5GAG:2' },
    ],
    colors3d: [
      { pair_id: '5GAG:sequence_000001', structure_file_route_id: '3d:5GAG', structure_file_path: 'CONFIDENCE/5gag.cif' },
    ],
    source: {
      calibratedPath: 'rmdb_abc_lss_run_20260626/cal/abc_lss_calibrated.tsv',
      confidencePath: 'rmdb_abc_lss_run_20260626/out/abc_lss_confidence.tsv',
      membershipsPath: 'ANNOJOIN/anno_case_profile_membership.tsv',
      tracksPath: 'ANNOJOIN/anno_residue_track_route_index.tsv',
      pairContextPath: 'ANNOJOIN/anno_2d_pair_context_route_index.tsv',
      structurePath: 'ANNOJOIN/anno_3d_residue_coloring_route_index.tsv',
    },
  });

  assert.equal(assets.summary.status, 'materialized');
  assert.equal(assets.summary.totalEvidenceCount, 2);
  assert.equal(assets.summary.defaultEvidenceId, 'annojoin:RMDB2PDB:5GAG:confidence:5GAG:sequence_000001');
  assert.deepEqual(assets.summary.availableFamilies, ['A', 'B']);
  assert.deepEqual(assets.summary.tierCounts, { LSS_STRONG: 1, LSS_MODERATE: 1 });
  assert.equal(assets.evidence.rows[0].trackProfileId, 'data-rna-structures/A.rdat#1');
  assert.equal(assets.evidence.rows[0].pairSegmentId, 'pairseg_5GAG_sequence_000001');
  assert.equal(assets.evidence.rows[0].bridgeStatus, 'materialized');
  assert.equal(assets.evidence.rows[0].selectedByDefault, true);
  assert.equal(assets.provenance.totals.materializedEvidenceCount, 2);
});

test('buildCaseConfidenceSidecars records bridge failures when memberships are missing', () => {
  const assets = buildCaseConfidenceSidecars({
    atlasCaseKey: 'RMDB2PDB:10ZT',
    caseId: '10ZT',
    calibratedRows: [
      {
        profile_key: 'missing-profile',
        pdb_id: '10ZT',
        chain: 'A',
        technology: 'DMS',
        measurement_family: 'A',
        lss_tier_uncalibrated: 'LSS_MODERATE_CANDIDATE',
        lss_tier_calibrated: 'LSS_WEAK',
        auc_directional: '0.6200',
        auc_empirical_p_value: '0.090000',
        conflict_fraction: '0.180000',
        partner_inside_fraction: '0.420000',
        partner_outside_fraction: '0.580000',
        n_evaluable: '18',
        n_paired_evaluable: '8',
        n_unpaired_evaluable: '10',
        permutation_status: 'RUN',
        permutation_n: '1000',
        calibration_note: 'auc_supported_but_not_self_contained',
        confidence_ranked_set_eligible: 'false',
      },
    ],
    memberships: [],
    tracks: [],
    pairs2d: [],
    colors3d: [],
  });

  assert.equal(assets.summary.materializedEvidenceCount, 0);
  assert.equal(assets.evidence.rows[0].bridgeStatus, 'bridge_missing');
  assert.equal(assets.evidence.rows[0].bridgeSelectionReason, 'missing_membership_profile');
  assert.deepEqual(assets.provenance.failureReasons, { 'membership+track+pair_context': 1 });
});

test('buildCaseConfidenceSidecars maps Family D calibrated rows into sidecars without inventing pair routes', () => {
  const assets = buildCaseConfidenceSidecars({
    atlasCaseKey: 'RASP2PDB:8IDT',
    caseId: '8IDT',
    pdbId: '8IDT',
    calibratedRows: [
      {
        profile_key: 'rasp_bw_6382c1bbc197',
        pdb_id: '8IDT',
        chain: '2',
        technology: 'icLASER',
        measurement_family: 'D',
        sasa_reference_status: 'SASA_PRESENT',
        recall_path: 'spearman_primary',
        lss_tier_uncalibrated: 'LSS_MODERATE_CANDIDATE',
        lss_tier_calibrated: 'LSS_STRONG',
        directional_metric: '0.516357',
        empirical_p_value: '0.000999',
        effect_size_z: '2.410',
        n_evaluable: '50',
        permutation_status: 'RUN',
        permutation_n: '1000',
        calibration_note: '',
        confidence_ranked_set_eligible: 'true',
      },
      {
        profile_key: 'rasp_bw_81424efa6c6b',
        pdb_id: '8IDT',
        chain: '2',
        technology: 'icLASER',
        measurement_family: 'D',
        sasa_reference_status: 'SASA_PRESENT',
        recall_path: 'spearman_primary',
        lss_tier_uncalibrated: 'LSS_WEAK',
        lss_tier_calibrated: 'LSS_NOT_SUPPORTED',
        directional_metric: '0.221074',
        empirical_p_value: '0.088911',
        effect_size_z: '0.921',
        n_evaluable: '40',
        permutation_status: 'RUN',
        permutation_n: '1000',
        calibration_note: 'not_significant_after_permutation',
        confidence_ranked_set_eligible: 'false',
      },
    ],
    memberships: [
      { profile_id: 'rasp_bw_6382c1bbc197', pair_id: '' },
      { profile_id: 'rasp_bw_81424efa6c6b', pair_id: '' },
    ],
    tracks: [],
    pairs2d: [],
    colors3d: [],
    source: {
      calibratedPath: 'family_d_lss_run_20260627/cal/def_lss_calibrated.tsv',
      membershipsPath: 'ANNOJOIN/anno_case_profile_membership.tsv',
      tracksPath: 'ANNOJOIN/anno_residue_track_route_index.tsv',
      pairContextPath: 'ANNOJOIN/anno_2d_pair_context_route_index.tsv',
      structurePath: 'ANNOJOIN/anno_3d_residue_coloring_route_index.tsv',
    },
  });

  assert.equal(assets.summary.status, 'materialized');
  assert.equal(assets.summary.defaultEvidenceId, 'annojoin:RASP2PDB:8IDT:confidence:rasp_bw_6382c1bbc197');
  assert.deepEqual(assets.summary.availableFamilies, ['D']);
  assert.deepEqual(assets.summary.tierCounts, { LSS_STRONG: 1, LSS_NOT_SUPPORTED: 1 });
  assert.equal(assets.evidence.rows[0].bridgeStatus, 'bridge_missing');
  assert.equal(assets.evidence.rows[0].pairId, '');
  assert.equal(assets.evidence.rows[0].aucDirectional, 0.516357);
  assert.equal(assets.evidence.rows[0].aucEmpiricalPValue, 0.000999);
  assert.equal(assets.evidence.rows[0].directionalMetricKind, 'spearman_rho');
  assert.equal(assets.evidence.rows[0].directionalMetricLabel, 'Spearman rho');
  assert.equal(assets.evidence.rows[0].sasaReferenceStatus, 'SASA_PRESENT');
  assert.equal(assets.evidence.rows[0].recallPath, 'spearman_primary');
  assert.equal(assets.evidence.rows[0].conflictFraction, null);
  assert.equal(assets.evidence.rows[0].partnerInsideFraction, null);
  assert.equal(assets.provenance.failureReasons['track+pair_context'], 2);
});
