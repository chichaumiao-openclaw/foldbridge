export const ANNOJOIN_CONFIDENCE_SCHEMA_VERSION = 'annojoin-confidence.v1';
export const DEFAULT_SELECTION_RULE_VERSION = 'tier_auc_p_n_v1';

const TIER_ORDER = new Map([
  ['LSS_STRONG', 0],
  ['LSS_MODERATE', 1],
  ['LSS_MODERATE_CANDIDATE', 2],
  ['LSS_WEAK', 3],
  ['LSS_DISCORDANT', 4],
  ['LSS_UNDERPOWERED', 5],
  ['LSS_NOT_SUPPORTED', 6],
  ['LSS_NOT_EVALUABLE', 7],
]);

function text(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  const normalized = text(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function casePathSegment(caseKey = '') {
  return encodeURIComponent(text(caseKey));
}

function tierRank(value) {
  const normalized = text(value);
  return TIER_ORDER.has(normalized) ? TIER_ORDER.get(normalized) : 999;
}

function sortFamilies(values = []) {
  return [...new Set((values || []).map(text).filter(Boolean))].sort();
}

function firstValue(...values) {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return '';
}

function countBy(rows, key) {
  const out = {};
  for (const row of rows || []) {
    const value = text(row[key]);
    if (!value) continue;
    out[value] = (out[value] || 0) + 1;
  }
  return out;
}

function compareEvidence(left = {}, right = {}) {
  const tierDelta = tierRank(left.lssTierCalibrated) - tierRank(right.lssTierCalibrated);
  if (tierDelta !== 0) return tierDelta;
  const aucDelta = (right.aucDirectional ?? -Infinity) - (left.aucDirectional ?? -Infinity);
  if (aucDelta !== 0) return aucDelta;
  const pLeft = left.aucEmpiricalPValue ?? Infinity;
  const pRight = right.aucEmpiricalPValue ?? Infinity;
  if (pLeft !== pRight) return pLeft - pRight;
  const nDelta = (right.nEvaluable ?? -Infinity) - (left.nEvaluable ?? -Infinity);
  if (nDelta !== 0) return nDelta;
  const familyDelta = text(left.family).localeCompare(text(right.family));
  if (familyDelta !== 0) return familyDelta;
  return text(left.evidenceId).localeCompare(text(right.evidenceId));
}

function defaultEvidenceId(evidence = []) {
  const materialized = evidence.filter((row) => row.bridgeStatus === 'materialized');
  const candidates = materialized.length ? materialized : evidence;
  return candidates[0]?.evidenceId || '';
}

export function buildConfidenceAssetPaths(caseKey = '') {
  const segment = casePathSegment(caseKey);
  return {
    summaryPath: `cases/${segment}/confidence-summary.json`,
    evidencePath: `cases/${segment}/confidence-evidence.json`,
    provenancePath: `cases/${segment}/confidence-provenance.json`,
  };
}

function evidenceIdFor(caseKey, pairId, profileKey) {
  const seed = firstValue(pairId, profileKey, 'unmatched');
  return `annojoin:${caseKey}:confidence:${seed}`;
}

function buildMembershipMap(rows = []) {
  const byProfileKey = new Map();
  for (const row of rows || []) {
    const key = text(row.profile_id);
    if (!key) continue;
    const existing = byProfileKey.get(key) || [];
    existing.push(row);
    byProfileKey.set(key, existing);
  }
  return byProfileKey;
}

function buildPairMap(rows = []) {
  const byPair = new Map();
  for (const row of rows || []) {
    const pairId = text(row.pair_id);
    if (!pairId || byPair.has(pairId)) continue;
    byPair.set(pairId, row);
  }
  return byPair;
}

function chooseMembership(candidates = []) {
  if (!candidates.length) {
    return { row: null, reason: 'missing_membership_profile', duplicateCount: 0 };
  }
  return {
    row: candidates[0],
    reason: candidates.length > 1 ? 'duplicate_membership_profile_first_row' : 'unique_membership_profile_match',
    duplicateCount: Math.max(0, candidates.length - 1),
  };
}

function sourceTables(source = {}) {
  return {
    calibratedPath: text(source.calibratedPath),
    confidencePath: text(source.confidencePath),
    calibrationGatePath: text(source.calibrationGatePath),
    membershipsPath: text(source.membershipsPath),
    tracksPath: text(source.tracksPath),
    pairContextPath: text(source.pairContextPath),
    structurePath: text(source.structurePath),
  };
}

function evidenceMetricDescriptor(row = {}) {
  const family = text(row.measurement_family).toUpperCase();
  const recallPath = text(row.recall_path);
  if (family !== 'D') {
    return { kind: 'auc', label: 'AUC' };
  }
  if (recallPath === 'spearman_primary') {
    return { kind: 'spearman_rho', label: 'Spearman rho' };
  }
  return { kind: 'auc', label: 'AUC' };
}

function normalizedDirectionalMetric(row = {}) {
  return numberOrNull(firstValue(row.auc_directional, row.directional_metric));
}

function normalizedEmpiricalPValue(row = {}) {
  return numberOrNull(firstValue(row.auc_empirical_p_value, row.empirical_p_value));
}

function normalizedEffectSizeZ(row = {}) {
  return numberOrNull(firstValue(row.auc_effect_size_z, row.effect_size_z));
}

export function buildCaseConfidenceSidecars({
  atlasCaseKey = '',
  caseId = '',
  pdbId = '',
  calibratedRows = [],
  memberships = [],
  tracks = [],
  pairs2d = [],
  colors3d = [],
  source = {},
  generatedAt = new Date().toISOString(),
} = {}) {
  const assetPaths = buildConfidenceAssetPaths(atlasCaseKey);
  const membershipByProfileKey = buildMembershipMap(memberships);
  const trackByPairId = buildPairMap(tracks);
  const pairContextByPairId = buildPairMap(pairs2d);
  const structureByPairId = buildPairMap(colors3d);
  const firstStructureRow = colors3d[0] || null;
  const failures = [];
  const evidence = [];

  for (const row of calibratedRows || []) {
    const profileKey = text(row.profile_key);
    const metric = evidenceMetricDescriptor(row);
    const membershipChoice = chooseMembership(membershipByProfileKey.get(profileKey) || []);
    const membership = membershipChoice.row;
    const pairId = text(membership?.pair_id);
    const track = pairId ? trackByPairId.get(pairId) || null : null;
    const pairContext = pairId ? pairContextByPairId.get(pairId) || null : null;
    const structure = (pairId ? structureByPairId.get(pairId) : null) || firstStructureRow;
    const missing = [];
    if (!membership) missing.push('membership');
    if (!track) missing.push('track');
    if (!pairContext) missing.push('pair_context');
    const bridgeStatus = missing.length ? 'bridge_missing' : 'materialized';
    if (bridgeStatus !== 'materialized') {
      failures.push({
        profileKey,
        chain: text(row.chain),
        reason: missing.join('+'),
      });
    }
    evidence.push({
      evidenceId: evidenceIdFor(atlasCaseKey, pairId, profileKey),
      family: text(row.measurement_family),
      technology: text(row.technology),
      chain: text(row.chain),
      profileKey,
      membershipProfileId: text(membership?.profile_id),
      pairId,
      pairSegmentId: text(pairContext?.pair_segment_id),
      trackProfileId: text(track?.profile_id),
      trackRouteId: text(track?.track_route_id),
      contextRouteId: text(pairContext?.context_route_id),
      structureRouteId: firstValue(structure?.structure_file_route_id, structure?.source_residue_track_route_id),
      structureFilePath: text(structure?.structure_file_path),
      bridgeStatus,
      bridgeSelectionReason: membershipChoice.reason,
      duplicateMembershipCount: membershipChoice.duplicateCount,
      lssTierCalibrated: text(row.lss_tier_calibrated),
      lssTierUncalibrated: text(row.lss_tier_uncalibrated),
      aucDirectional: normalizedDirectionalMetric(row),
      aucEmpiricalPValue: normalizedEmpiricalPValue(row),
      aucEffectSizeZ: normalizedEffectSizeZ(row),
      directionalMetricKind: metric.kind,
      directionalMetricLabel: metric.label,
      conflictFraction: numberOrNull(row.conflict_fraction),
      partnerInsideFraction: numberOrNull(row.partner_inside_fraction),
      partnerOutsideFraction: numberOrNull(row.partner_outside_fraction),
      nEvaluable: numberOrNull(row.n_evaluable),
      nPairedEvaluable: numberOrNull(row.n_paired_evaluable),
      nUnpairedEvaluable: numberOrNull(row.n_unpaired_evaluable),
      sasaReferenceStatus: text(row.sasa_reference_status),
      recallPath: text(row.recall_path),
      permutationStatus: text(row.permutation_status),
      permutationN: numberOrNull(row.permutation_n),
      calibrationNote: text(row.calibration_note),
      rankedSetEligible: text(row.confidence_ranked_set_eligible) === 'true',
      selectedByDefault: false,
    });
  }

  evidence.sort(compareEvidence);
  const chosenEvidenceId = defaultEvidenceId(evidence);
  for (const row of evidence) {
    row.selectedByDefault = row.evidenceId === chosenEvidenceId;
  }

  const status = evidence.length ? 'materialized' : 'not_materialized';
  const availableFamilies = sortFamilies(evidence.map((row) => row.family));
  const materializedCount = evidence.filter((row) => row.bridgeStatus === 'materialized').length;
  const summary = {
    schemaVersion: ANNOJOIN_CONFIDENCE_SCHEMA_VERSION,
    generatedAt,
    atlasCaseKey: text(atlasCaseKey),
    caseId: text(caseId),
    pdbId: text(pdbId || caseId),
    status,
    totalEvidenceCount: evidence.length,
    materializedEvidenceCount: materializedCount,
    bridgeMissingCount: evidence.length - materializedCount,
    availableFamilies,
    familyCounts: countBy(evidence, 'family'),
    tierCounts: countBy(evidence, 'lssTierCalibrated'),
    defaultEvidenceId: chosenEvidenceId,
    defaultSelectionRuleVersion: DEFAULT_SELECTION_RULE_VERSION,
    assetPaths,
    sourceTables: sourceTables(source),
  };

  const provenance = {
    schemaVersion: ANNOJOIN_CONFIDENCE_SCHEMA_VERSION,
    generatedAt,
    atlasCaseKey: text(atlasCaseKey),
    caseId: text(caseId),
    pdbId: text(pdbId || caseId),
    status,
    bridgeStrategyVersion: 'profile_key_to_membership_to_pair_routes_v1',
    bridgeStrategy: 'confidence.profile_key -> membership.profile_id -> pair_id -> track/pair-context/structure routes',
    sourceTables: sourceTables(source),
    totals: {
      calibratedRows: calibratedRows.length,
      membershipRows: memberships.length,
      trackRows: tracks.length,
      pairContextRows: pairs2d.length,
      structureRows: colors3d.length,
      materializedEvidenceCount: materializedCount,
      bridgeMissingCount: evidence.length - materializedCount,
    },
    failureReasons: failures.reduce((acc, row) => {
      acc[row.reason] = (acc[row.reason] || 0) + 1;
      return acc;
    }, {}),
    bridgeFailureSample: failures.slice(0, 20),
  };

  return {
    summary,
    evidence: {
      schemaVersion: ANNOJOIN_CONFIDENCE_SCHEMA_VERSION,
      generatedAt,
      atlasCaseKey: text(atlasCaseKey),
      caseId: text(caseId),
      pdbId: text(pdbId || caseId),
      status,
      rows: evidence,
    },
    provenance,
  };
}
