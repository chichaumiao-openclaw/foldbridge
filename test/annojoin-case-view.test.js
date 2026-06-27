import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAnnojointCasePage } from '../src/annojoinCaseView.js';

test('annojoin case page renders confidence-first shell with embedded 5GAG workbench', () => {
  const html = renderAnnojointCasePage({
    caseAsset: {
      case: {
        caseId: '5GAG',
        pdbId: '5GAG',
        atlasCaseKey: 'RMDB2PDB:5GAG',
        assetFamily: 'RMDB2PDB',
        biologicalMoleculeName: 'SRP 4.5S RNA',
        confidenceDisplayLabel: 'A_REFERENCE (38); B_CONTEXT_STRATIFIED (72); C_EXPLORATORY_HINT (1378)',
      },
      summary: { profileCount: 1488 },
    },
    confidenceBundle: {
      summary: {
        status: 'materialized',
        totalEvidenceCount: 2,
        materializedEvidenceCount: 2,
        availableFamilies: ['A', 'B'],
        tierCounts: { LSS_STRONG: 1, LSS_MODERATE: 1 },
        defaultEvidenceId: 'annojoin:RMDB2PDB:5GAG:confidence:5GAG:sequence_000001',
        defaultSelectionRuleVersion: 'tier_auc_p_n_v1',
      },
      evidence: {
        rows: [
          {
            evidenceId: 'annojoin:RMDB2PDB:5GAG:confidence:5GAG:sequence_000001',
            family: 'A',
            technology: 'DMS',
            chain: '1',
            trackProfileId: 'data-rna-structures/SRPECLI_DMS_0001.rdat#DATA:262',
            pairId: '5GAG:sequence_000001',
            pairSegmentId: 'pairseg_5GAG_sequence_000001',
            lssTierCalibrated: 'LSS_STRONG',
            aucDirectional: 0.81,
            aucEmpiricalPValue: 0.01,
            conflictFraction: 0.10,
            partnerInsideFraction: 0.85,
            nEvaluable: 32,
            bridgeStatus: 'materialized',
            selectedByDefault: true,
          },
          {
            evidenceId: 'annojoin:RMDB2PDB:5GAG:confidence:5GAG:sequence_000002',
            family: 'B',
            technology: '2A3',
            chain: '1',
            trackProfileId: 'data-rna-structures/SRPECLI_BZCN_0001.rdat#DATA:259',
            pairId: '5GAG:sequence_000002',
            pairSegmentId: 'pairseg_5GAG_sequence_000002',
            lssTierCalibrated: 'LSS_MODERATE',
            aucDirectional: 0.72,
            aucEmpiricalPValue: 0.04,
            conflictFraction: 0.12,
            partnerInsideFraction: 0.62,
            nEvaluable: 24,
            bridgeStatus: 'materialized',
            selectedByDefault: false,
          },
        ],
      },
      provenance: {
        bridgeStrategy: 'confidence.profile_key -> membership.profile_id -> pair_id -> track/pair-context/structure routes',
        totals: { calibratedRows: 2, materializedEvidenceCount: 2, bridgeMissingCount: 0 },
        sourceTables: { calibratedPath: 'rmdb_abc_lss_run_20260626/cal/abc_lss_calibrated.tsv' },
      },
    },
    confidenceStatus: 'ready',
  });

  assert.match(html, /confidence-first/);
  assert.match(html, /annojoin-family-filter/);
  assert.match(html, /annojoin-evidence-row is-selected/);
  assert.match(html, /annojoin-smoke\/5gag\/index\.html\?profileId=/);
  assert.match(html, /id="annojoin-case-bootstrap"/);
});

test('annojoin case page stays honest when calibrated confidence sidecars are absent', () => {
  const html = renderAnnojointCasePage({
    caseAsset: {
      case: {
        caseId: '10ZT',
        pdbId: '10ZT',
        atlasCaseKey: 'RMDB2PDB:10ZT',
        assetFamily: 'RMDB2PDB',
        biologicalMoleculeName: 'RNA (519-MER)',
        confidenceDisplayLabel: 'C_EXPLORATORY_HINT (1)',
      },
      summary: { profileCount: 1 },
    },
    confidenceBundle: {
      summary: { status: 'not_materialized', totalEvidenceCount: 0, availableFamilies: [] },
      evidence: { rows: [] },
      provenance: { status: 'not_materialized', sourceTables: {} },
    },
    confidenceStatus: 'ready',
  });

  assert.match(html, /Confidence sidecar unavailable/);
  assert.match(html, /The RMDB calibrated confidence sidecar is not materialized in the current build/);
  assert.match(html, /Workbench not materialized for this case/);
});
