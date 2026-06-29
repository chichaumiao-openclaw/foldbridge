const config = window.__FAMILY_D_CHAIN_WORKBENCH_CONFIG__ || {};
const caseUrl = config.caseUrl || "./case-2d-structure.json";
const profileIndexUrl = config.profileIndexUrl || "./profiles/profile-index.json";
const varnaTemplateUrl = config.varnaTemplateUrl || "./varna-template.svg";
const sourceStructureUrl = config.sourceStructureUrl || "../../structure.cif";
const linkedViewRoot = config.linkedViewRoot || "./linked-view";
const linkedViewBundleUrl = config.linkedViewBundleUrl || "";
const linkedViewUrls = {
  residueIndex: `${linkedViewRoot}/residue-index.json`,
  profileJoins: `${linkedViewRoot}/profile-joins.json`,
  structureContexts: `${linkedViewRoot}/structure-contexts.json`,
  structureCoverage: `${linkedViewRoot}/structure-coverage.json`,
  bridges: `${linkedViewRoot}/bridges.json`,
  interactions: `${linkedViewRoot}/interactions.json`,
  confidenceSummary: `${linkedViewRoot}/confidence-summary.json`,
  lssContext: `${linkedViewRoot}/lss-context.json`,
  rawAlignmentCoverage: `${linkedViewRoot}/raw-alignment-coverage.json`,
};
const state = {
  caseData: null,
  profileIndex: null,
  linkedView: null,
  residueByKey: new Map(),
  residueByStrandPosition: new Map(),
  legacyResidueKeyToKey: new Map(),
  joinsByProfileResidue: new Map(),
  lociByResidueKey: new Map(),
  pdbResidueByKey: new Map(),
  bridgeByResidueKey: new Map(),
  interactionsByResidueKey: new Map(),
  lssContextByProfileId: new Map(),
  rawAlignmentCoverageByProfileId: new Map(),
  confidenceSummary: null,
  lssContext: null,
  rawAlignmentCoverage: null,
  structureCoverage: null,
  structureCoverageUrl: linkedViewUrls.structureCoverage,
  varnaTemplate: null,
  profiles: [],
  shards: new Map(),
  lastRender: null,
  activeView: "varna",
  viewport: { start: 1, end: 113 },
  selectedResidueKey: null,
  hoveredResidueKey: null,
  molstarViewer: null,
  molstarFullViewer: null,
  molstarCroppedUrl: null,
  molstarBridgeInstalled: false,
  requestedProfileId: "",
};

const el = {
  status: document.querySelector("#assetStatus"),
  select: document.querySelector("#profileSelect"),
  benchmark: document.querySelector("#benchmarkButton"),
  stats: document.querySelector("#stats"),
  track: document.querySelector("#track-viewport"),
  trackStatus: document.querySelector("#trackStatus"),
  viewportStatus: document.querySelector("#viewportStatus"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomOut: document.querySelector("#zoom-out"),
  panLeft: document.querySelector("#pan-left"),
  panRight: document.querySelector("#pan-right"),
  resetView: document.querySelector("#reset-view"),
  varnaViewer: document.querySelector("#varnaViewer"),
  varnaViewport: document.querySelector("#varnaViewport"),
  linearViewer: document.querySelector("#linearViewer"),
  profilePair: document.querySelector("#profilePair"),
  profileId: document.querySelector("#profileId"),
  tabs: [...document.querySelectorAll(".tab")],
  caption: document.querySelector("#viewCaption"),
  inspector: document.querySelector("#linked-inspector"),
  inspectorStatus: document.querySelector("#inspectorStatus"),
  molstarHost: document.querySelector("#molstar-host"),
  molstarFullHost: document.querySelector("#molstar-full-host"),
  molstarStatus: document.querySelector("#molstar-status"),
  molstarSelectionStatus: document.querySelector("#molstar-selection-status"),
  molstarMeta: document.querySelector("#molstarMeta"),
  molstarFullMeta: document.querySelector("#molstarFullMeta"),
  log: document.querySelector("#log"),
  tip: document.querySelector("#tip"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveAssetUrl(href, baseUrl = window.location.href) {
  return new URL(href, new URL(baseUrl, window.location.href)).href;
}

function percentile(values, q) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const idx = (clean.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, clean.length - 1);
  const t = idx - lo;
  return clean[lo] * (1 - t) + clean[hi] * t;
}

function colorForNorm(norm) {
  if (!Number.isFinite(norm) || norm <= 0) return "#ffffff";
  const t = Math.max(0, Math.min(1, norm));
  const start = [255, 242, 0];
  const end = [215, 25, 28];
  const rgb = start.map((channel, idx) => Math.round(channel + (end[idx] - channel) * t));
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function colorForBase(base) {
  return {
    A: "#4c78a8",
    C: "#f58518",
    G: "#54a24b",
    U: "#b279a2",
    T: "#b279a2",
  }[String(base || "N").toUpperCase()] || "#d8dee4";
}

const coordinateResolvedStyle = { fill: "#e3f1fb", stroke: "#3f7da8" };
const coordinateSequenceOnlyStyle = { fill: "#d8dde3", stroke: "#8d97a3" };
const RESIDUE_STATE_COLORS = Object.freeze({
  loop: { fill: "#dcfce7", stroke: "#2f855a", molstarRgb: { r: 47, g: 133, b: 90 } },
  stem: { fill: "#dbeafe", stroke: "#1d4ed8", molstarRgb: { r: 29, g: 78, b: 216 } },
  selected: { fill: "#fee2e2", stroke: "#9b1c1c", molstarRgb: { r: 155, g: 28, b: 28 } },
  unaligned: { fill: "#e5e7eb", stroke: "#6b7280", molstarRgb: { r: 107, g: 114, b: 128 } },
});
const MOLSTAR_CONTEXT_COLOR = Object.freeze({ r: 229, g: 231, b: 235 });

function coordinateDisplayStatus(pdbResidue) {
  return pdbResidue?.coordinateStatus === "resolved"
    ? "resolved atom_site coordinate"
    : "sequence only; no resolved atom_site coordinate";
}

function residueForPosition(position, strand = activeStrand()) {
  const strandId = strand?.strand_id || "strand_1";
  const residue = state.residueByStrandPosition.get(`${strandId}:${position}`);
  if (!residue) {
    throw new Error(`linked-view residue-index missing ${strandId}:${position}`);
  }
  return residue;
}

function profileBaseForPosition(position, strand = activeStrand()) {
  return residueForPosition(position, strand).parentBase;
}

function materializedSequenceAlignment() {
  const alignment = state.structureCoverage?.sequenceAlignment;
  if (!alignment) {
    throw new Error("linked-view structure-coverage missing sequenceAlignment");
  }
  return alignment;
}

function alignmentStateForResidue() {
  const alignment = materializedSequenceAlignment();
  return alignment.mismatchedResidues === 0 && alignment.matchedResidues === alignment.profileResidues
    ? "match"
    : "materialized_alignment";
}

function sequenceAgreementLabel(summary = materializedSequenceAlignment()) {
  return `${summary.matchedResidues}/${summary.profileResidues} profile-PDB polymer residues match`;
}

function sequenceAgreementStatusLabel(summary = materializedSequenceAlignment()) {
  return `profile-PDB polymer sequence match ${summary.matchedResidues}/${summary.profileResidues}`;
}

function atomSiteCoverageLabel(coverage = state.structureCoverage?.coverage || {}) {
  return coverage.profileResidues
    ? `${coverage.resolvedResidues}/${coverage.profileResidues} atom_site coordinate residues observed (${coverage.resolvedProfileRangeLabel || "no resolved range"}; not a sequence-alignment count)`
    : "atom_site coordinate coverage unavailable";
}

function atomSiteCoverageStatusLabel(coverage = state.structureCoverage?.coverage || {}) {
  return coverage.profileResidues
    ? `atom_site coordinates observed ${coverage.resolvedResidues}/${coverage.profileResidues} (${coverage.resolvedProfileRangeLabel || "no resolved range"}; not a sequence-alignment count)`
    : "atom_site coordinate coverage unavailable";
}

function sequenceOnlyCoordinateNote() {
  return "1-31 and 75-113 are sequence-only/no atom_site coordinates, not alignment failure";
}

function hexToRgb(hex) {
  const value = String(hex || "#ffffff").replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

async function decodeGzipArrayBuffer(buffer) {
  if (!("DecompressionStream" in window)) {
    throw new Error("gzip profile shard requires browser DecompressionStream support");
  }
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).arrayBuffer();
}

async function fetchArrayBufferOrThrow(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch asset ${url}: ${response.status}`);
  }
  return await response.arrayBuffer();
}

async function fetchJsonMaybeGzip(url) {
  const buffer = await fetchArrayBufferOrThrow(url);
  const decoded = String(url).endsWith(".gz") ? await decodeGzipArrayBuffer(buffer) : buffer;
  return JSON.parse(new TextDecoder("utf-8").decode(decoded));
}

async function fetchTextMaybeGzip(url) {
  const buffer = await fetchArrayBufferOrThrow(url);
  const decoded = String(url).endsWith(".gz") ? await decodeGzipArrayBuffer(buffer) : buffer;
  return new TextDecoder("utf-8").decode(decoded);
}

async function loadShard(shardId) {
  if (state.shards.has(shardId)) return state.shards.get(shardId);
  const shardInfo = state.profileIndex.shards[shardId];
  const meta = await fetchJsonMaybeGzip(shardInfo.meta_path);
  const gzipBuffer = await fetchArrayBufferOrThrow(shardInfo.gzip_path);
  const valueBuffer = await decodeGzipArrayBuffer(gzipBuffer);
  const values = new Float32Array(valueBuffer);
  const shard = { meta, values, decodeMode: "gzip", gzipBytes: gzipBuffer.byteLength, rawBytes: valueBuffer.byteLength };
  state.shards.set(shardId, shard);
  return shard;
}

function profileValues(profile, shard) {
  const start = profile.row_index * shard.meta.strand_length;
  const end = start + shard.meta.strand_length;
  return shard.values.subarray(start, end);
}

function normalizeProfile(profile, values) {
  const mapped = Array.from(values).filter((value) => Number.isFinite(value));
  const positives = mapped.filter((value) => value > 0);
  const cap = percentile(positives, 0.95);
  const byPosition = new Map();
  let whiteCount = 0;
  let cappedCount = 0;
  for (let idx = 0; idx < values.length; idx += 1) {
    const raw = values[idx];
    const norm = raw > 0 && cap > 0 ? Math.min(raw / cap, 1) : 0;
    if (norm <= 0) whiteCount += 1;
    if (norm >= 1) cappedCount += 1;
    byPosition.set(idx + 1, {
      raw,
      norm,
      color: colorForNorm(norm),
    });
  }
  return {
    cap,
    byPosition,
    mappedCount: mapped.length,
    whiteCount,
    cappedCount,
    positiveCount: positives.length,
    unmappedCount: profile.unmapped_to_strand_count,
  };
}

function parsePairs(dotbracket) {
  const stack = [];
  const pairs = [];
  for (let i = 0; i < dotbracket.length; i += 1) {
    const char = dotbracket[i];
    if (char === "(") stack.push(i + 1);
    if (char === ")" && stack.length) pairs.push([stack.pop(), i + 1]);
  }
  return pairs;
}

function strandPairs(strand) {
  return strand.pairs?.length ? strand.pairs.map((pair) => [pair.i, pair.j]) : parsePairs(strand.dotbracket);
}

function activeStrand() {
  const profile = state.lastRender?.profile || state.profiles[Number(el.select.value) || 0] || {};
  const strandId = profile.render_strand_id || state.caseData?.default_render_strand_id;
  return state.caseData?.strands.find((item) => item.strand_id === strandId) || state.caseData?.strands[0];
}

function activeProfileId() {
  return state.lastRender?.profile?.profile_id || state.profiles[Number(el.select.value) || 0]?.profile_id || "";
}

function activeChainKey() {
  return state.structureCoverage?.activeChainKey
    || state.caseData?.activeChainKey
    || state.residueByKey.values().next().value?.chainKey
    || "";
}

function buildResidueIndexes(residueIndex) {
  state.residueByKey = new Map();
  state.residueByStrandPosition = new Map();
  state.legacyResidueKeyToKey = new Map();
  for (const residue of residueIndex?.residues || []) {
    state.residueByKey.set(residue.residueKey, residue);
    const strandId = residue.aliases?.renderStrand?.[0] || residue.chainKey?.split("|").at(-1);
    if (strandId && residue.labelSeqId) {
      state.residueByStrandPosition.set(`${strandId}:${residue.labelSeqId}`, residue);
    }
    for (const legacyKey of residue.aliases?.legacyResidueKey || []) {
      state.legacyResidueKeyToKey.set(legacyKey, residue.residueKey);
    }
  }
}

function buildJoinIndexes(profileJoins) {
  state.joinsByProfileResidue = new Map();
  if (profileJoins) {
    for (const record of profileJoins.records || []) {
      state.joinsByProfileResidue.set(`${record.profileId}|${record.residueKey}`, record);
    }
    return;
  }
  for (const profile of state.profileIndex?.profiles || []) {
    for (const residue of state.residueByKey.values()) {
      if (residue.chainKey !== activeChainKey()) continue;
      const join = {
        profileId: profile.profile_id,
        residueKey: residue.residueKey,
        joinKey: `${profile.profile_id}|${residue.residueKey}`,
        sourceRecordKey: `${profile.profile_id}|${residue.labelSeqId}`,
        status: "browser_materialized",
      };
      state.joinsByProfileResidue.set(`${join.profileId}|${join.residueKey}`, join);
    }
  }
}

function buildStructureContextIndexes(structureContexts) {
  state.lociByResidueKey = new Map();
  state.pdbResidueByKey = new Map();
  const chain = state.structureCoverage?.polymerChain || {};
  for (const locus of structureContexts?.loci || []) {
    const residue = state.residueByKey.get(locus.residueKey);
    if (!residue) {
      throw new Error(`structure-contexts references unknown residue ${locus.residueKey}`);
    }
    const locator = locus.locator || {};
    state.lociByResidueKey.set(locus.residueKey, locus);
    state.pdbResidueByKey.set(locus.residueKey, {
      residueKey: locus.residueKey,
      profilePosition: residue.labelSeqId,
      pdbStrandId: chain.pdbStrandId,
      labelAsymId: locator.label_asym_id,
      authAsymId: locator.auth_asym_id,
      labelSeqId: locator.label_seq_id,
      authSeqId: locator.auth_seq_id,
      coordinateStatus: locus.coordinateStatus,
    });
  }
}

function buildStructureCoverageIndexes(structureCoverage) {
  if (!structureCoverage?.sequenceAlignment || !structureCoverage?.coverage || !structureCoverage?.polymerChain) {
    throw new Error("linked-view structure-coverage asset is incomplete");
  }
  state.structureCoverage = structureCoverage;
  state.structureCoverageUrl = linkedViewBundleUrl || linkedViewUrls.structureCoverage;
}

function buildConfidenceIndexes(confidenceSummary) {
  state.confidenceSummary = confidenceSummary || null;
}

function buildLssContextIndexes(lssContext) {
  state.lssContext = lssContext || null;
  state.lssContextByProfileId = new Map();
  for (const record of lssContext?.records || []) {
    state.lssContextByProfileId.set(record.profileId, record);
  }
}

function buildRawAlignmentCoverageIndexes(rawAlignmentCoverage) {
  state.rawAlignmentCoverage = rawAlignmentCoverage || null;
  state.rawAlignmentCoverageByProfileId = new Map();
  for (const record of rawAlignmentCoverage?.records || []) {
    const existing = state.rawAlignmentCoverageByProfileId.get(record.profileId) || [];
    existing.push(record);
    state.rawAlignmentCoverageByProfileId.set(record.profileId, existing);
  }
}

function buildBridgeIndexes(bridges) {
  state.bridgeByResidueKey = new Map();
  for (const bridge of bridges?.bridges || []) {
    for (const residueKey of bridge.residueKeys || []) {
      const existing = state.bridgeByResidueKey.get(residueKey) || [];
      existing.push(bridge);
      state.bridgeByResidueKey.set(residueKey, existing);
    }
  }
}

function buildInteractionIndexes(interactions) {
  state.interactionsByResidueKey = new Map();
  for (const edge of interactions?.edges || []) {
    for (const residueKey of [edge.residueA, edge.residueB]) {
      const existing = state.interactionsByResidueKey.get(residueKey) || [];
      existing.push(edge);
      state.interactionsByResidueKey.set(residueKey, existing);
    }
  }
}

function installLinkedViewIndexes(linkedView) {
  buildResidueIndexes(linkedView.residueIndex);
  buildJoinIndexes(linkedView.profileJoins);
  buildStructureCoverageIndexes(linkedView.structureCoverage);
  buildStructureContextIndexes(linkedView.structureContexts);
  buildBridgeIndexes(linkedView.bridges);
  buildInteractionIndexes(linkedView.interactions);
  buildConfidenceIndexes(linkedView.confidenceSummary);
  buildLssContextIndexes(linkedView.lssContext);
  buildRawAlignmentCoverageIndexes(linkedView.rawAlignmentCoverage);
}

function residueKeyForPosition(position, strand = activeStrand()) {
  return residueForPosition(position, strand).residueKey;
}

function positionFromResidueKey(residueKey) {
  const residue = state.residueByKey.get(residueKey);
  if (residue?.labelSeqId) return residue.labelSeqId;
  const position = Number(String(residueKey || "").split("|").at(-1));
  return Number.isFinite(position) ? position : null;
}

function assayStateForBase(base) {
  const normalizedBase = String(base || "N").toUpperCase();
  return normalizedBase === "A" || normalizedBase === "C" ? "applicable" : "not_applicable";
}

function pairPartnersForPosition(position, strand = activeStrand()) {
  return strandPairs(strand || {}).flatMap(([a, b]) => {
    if (a === position) return [b];
    if (b === position) return [a];
    return [];
  });
}

function secondaryStructureStateForPosition(position, strand = activeStrand()) {
  if (!position || !strand) return "unaligned";
  return pairPartnersForPosition(position, strand).length ? "stem" : "loop";
}

function visualStateForResidue(residueKey, selectedKey = state.selectedResidueKey) {
  if (residueKey && residueKey === selectedKey) return "selected";
  const residue = residueKey ? state.residueByKey.get(residueKey) : null;
  if (!residue || residue.chainKey !== activeChainKey()) return "unaligned";
  return secondaryStructureStateForPosition(residue.labelSeqId);
}

function colorForResidueVisualState(residueKey, selectedKey = state.selectedResidueKey) {
  return RESIDUE_STATE_COLORS[visualStateForResidue(residueKey, selectedKey)] || RESIDUE_STATE_COLORS.unaligned;
}

function lssContextForProfile(profileId = activeProfileId()) {
  return state.lssContextByProfileId.get(profileId) || null;
}

function rawAlignmentCoverageForProfile(profile) {
  if (!profile?.profile_id) return null;
  const records = state.rawAlignmentCoverageByProfileId.get(profile.profile_id) || [];
  return records.find((record) => (
    record.profileId === profile.profile_id
    && (!record.pairId || record.pairId === profile.pair_id)
    && (!record.pairSegmentId || record.pairSegmentId === profile.pair_segment_id)
  )) || records.find((record) => (
    record.profileId === profile.profile_id
    && (!record.pairId || record.pairId === profile.pair_id)
  )) || null;
}

function lssContextLabel(profileId = activeProfileId()) {
  const record = lssContextForProfile(profileId);
  if (!record) return "LSS context: not materialized";
  return `${record.lssStatus} (${record.pairedEvaluable} paired / ${record.unpairedEvaluable} unpaired evaluable; ${record.contextEngine})`;
}

function profileResidueRows(normalized, strand = activeStrand()) {
  if (!normalized || !strand) return [];
  return Array.from({ length: strand.sequence.length }, (_, idx) => {
    const position = idx + 1;
    const residue = residueForPosition(position, strand);
    const row = normalized.byPosition.get(position) || {};
    return {
      position,
      base: residue.parentBase || strand.sequence[idx],
      raw_value: row.raw,
      mapped_to_strand: Number.isFinite(row.raw),
    };
  });
}

function computeDmsLoopRecall(profile, normalized, strand = activeStrand()) {
  const pairedPositions = new Set(strandPairs(strand || {}).flatMap(([i, j]) => [i, j]));
  const denominatorRows = profileResidueRows(normalized, strand).filter((residue) => (
    residue.mapped_to_strand === true
    && /^[AC]$/.test(residue.base)
    && Number(residue.raw_value) > 0
  ));
  const loopRows = denominatorRows.filter((residue) => !pairedPositions.has(residue.position));
  const stemRows = denominatorRows.filter((residue) => pairedPositions.has(residue.position));
  const denominator = denominatorRows.length;
  const numerator = loopRows.length;
  return {
    profileId: profile?.profile_id || "",
    numerator,
    denominator,
    percentage: denominator ? (numerator / denominator) * 100 : null,
    stemSignalPositions: stemRows.map((residue) => residue.position),
  };
}

function formatDmsLoopRecall(recall) {
  if (!recall?.denominator) return "not materialized";
  return `${recall.numerator}/${recall.denominator} (${recall.percentage.toFixed(2)}%)`;
}

function rawAlignmentCoverageMetric(rawCoverage, metricName) {
  const value = rawCoverage?.[metricName];
  return Number.isFinite(value) ? value.toFixed(4) : "not materialized";
}

function getResidueDetails(residueKey) {
  const position = positionFromResidueKey(residueKey);
  const strand = activeStrand();
  const normalized = state.lastRender?.normalized;
  const profile = state.lastRender?.profile;
  if (!position || !strand || !normalized || !profile) return null;
  const residue = state.residueByKey.get(residueKey);
  if (!residue) throw new Error(`residue-index missing ${residueKey}`);
  const join = state.joinsByProfileResidue.get(`${profile.profile_id}|${residueKey}`);
  const locus = state.lociByResidueKey.get(residueKey);
  const pdbResidue = state.pdbResidueByKey.get(residueKey);
  if (!join) throw new Error(`profile-joins missing ${profile.profile_id} ${residueKey}`);
  if (!locus) throw new Error(`structure-contexts missing ${residueKey}`);
  if (!pdbResidue) throw new Error(`structure projection missing ${residueKey}`);
  const bridges = state.bridgeByResidueKey.get(residueKey) || [];
  const interactions = state.interactionsByResidueKey.get(residueKey) || [];
  const profileBase = residue.parentBase;
  const pdbBase = residue.compId;
  const base = residue.compId || residue.parentBase;
  const value = normalized.byPosition.get(position) || {};
  const raw = Number.isFinite(value.raw) ? Number(value.raw) : null;
  const locator = locus?.locator || {};
  const bridgeLabels = bridges.map((bridge) => bridge.bridgeKey).join(", ");
  const interactionLabels = interactions.map((edge) => edge.interactionKey).join(", ");
  const coverage = state.structureCoverage?.coverage || {};
  const sequenceSummary = materializedSequenceAlignment();
  const confidence = state.confidenceSummary || {};
  const coordinateObserved = pdbResidue?.coordinateStatus === "resolved";
  const structureState = visualStateForResidue(residueKey);
  const pdbLabel = `PDB strand ${pdbResidue.pdbStrandId} residue ${pdbResidue.labelSeqId} (label_asym_id=${pdbResidue.labelAsymId} auth_asym_id=${pdbResidue.authAsymId})`;
  const coordinateStatus = coordinateDisplayStatus(pdbResidue);
  const coverageLabel = `${atomSiteCoverageLabel(coverage)}; ${sequenceOnlyCoordinateNote()}`;
  const lssContext = lssContextForProfile(profile.profile_id);
  const fecLssStatus = [confidence.fec, confidence.lss]
    .filter(Boolean)
    .map((item) => `${item.displayLabel}: ${item.status}`)
    .join("; ") || "not_materialized_in_smoke";
  const joinKey = join.sourceRecordKey || join.joinKey;
  if (!joinKey) throw new Error(`profile-joins missing join key for ${profile.profile_id} ${residueKey}`);
  return {
    residueKey,
    position,
    base,
    profileBase,
    pdbBase,
    sequenceMatch: alignmentStateForResidue(residueKey),
    sequenceAgreement: sequenceAgreementLabel(sequenceSummary),
    structureState,
    raw,
    norm: Number.isFinite(value.norm) ? value.norm : 0,
    color: value.color || "#ffffff",
    joinStatus: join.status,
    joinKey,
    assayState: assayStateForBase(profileBase),
    pdbResidue: pdbLabel,
    coordinateStatus,
    coordinateMeaning: coordinateObserved ? "resolved_atom_site_coordinate" : "sequence_only_no_atom_site_coordinate",
    coordinateCoverage: coverageLabel,
    structureLocus: `${state.caseData?.case_id || config.caseId || "case"} auth_asym_id=${locator.auth_asym_id || ""} auth_seq_id=${locator.auth_seq_id || ""} label_asym_id=${locator.label_asym_id || ""} label_seq_id=${locator.label_seq_id || ""}`,
    observed: coordinateObserved,
    bridgeMembership: bridgeLabels || "not_in_bridge",
    interactionEndpoint: interactionLabels || "no_interaction_endpoint",
    lssContext: lssContext ? lssContextLabel(profile.profile_id) : "LSS context: not materialized",
    fecLssConfidence: fecLssStatus,
    annoconfidence: confidence.annoconfidence
      ? `${confidence.annoconfidence.displayLabel}: ${confidence.annoconfidence.status}`
      : "ANNOCONFIDENCE: not_materialized_in_smoke",
    profileJoinConfidence: confidence.profileJoinConfidence?.explanation || "profile join confidence unavailable",
  };
}

function showTip(event, text) {
  el.tip.textContent = text;
  el.tip.style.left = `${event.clientX + 12}px`;
  el.tip.style.top = `${event.clientY + 12}px`;
  el.tip.style.display = "block";
}

function hideTip() {
  el.tip.style.display = "none";
  applyLinkedHover(null);
}

function setDomState(className, residueKey) {
  document.querySelectorAll(".residue-mark").forEach((node) => {
    node.classList.toggle(className, residueKey !== null && node.getAttribute("data-residue-key") === residueKey);
  });
}

function applyLinkedHover(residueKey, origin = "preview") {
  state.hoveredResidueKey = residueKey;
  setDomState("hovered", residueKey);
  if (origin === "3d") {
    renderInspector(residueKey || state.selectedResidueKey);
  }
}

function applyMolstarHover(residueKey, event = null) {
  applyLinkedHover(residueKey, "3d");
  if (event && residueKey) {
    const details = getResidueDetails(residueKey);
    showTip(event, `3D ${details?.position || ""} ${details?.base || ""}`);
  }
}

function renderInspector(residueKey = state.selectedResidueKey) {
  const details = residueKey ? getResidueDetails(residueKey) : null;
  if (!details) {
    el.inspectorStatus.textContent = "no residue selected";
    el.inspector.innerHTML = `<div class="sub">Select a residue from 1D, 2D, or 3D.</div>`;
    return;
  }
  el.inspectorStatus.textContent = `${details.position} ${details.base}`;
  const rawValue = details.raw === null ? "missing" : details.raw.toFixed(6);
  el.inspector.innerHTML = `<dl class="inspector-grid">
    <div><dt>Residue</dt><dd>${escapeHtml(details.residueKey)}</dd></div>
    <div><dt>Profile base</dt><dd>${escapeHtml(details.profileBase)}</dd></div>
    <div><dt>PDB polymer base</dt><dd>${escapeHtml(details.pdbBase)} (${escapeHtml(details.sequenceMatch)})</dd></div>
    <div><dt>Sequence agreement</dt><dd>${escapeHtml(details.sequenceAgreement)}</dd></div>
    <div><dt>Structure state</dt><dd>${escapeHtml(details.structureState)}</dd></div>
    <div><dt>Raw value</dt><dd>${escapeHtml(rawValue)}</dd></div>
    <div><dt>Normalized value</dt><dd>${escapeHtml(details.norm.toFixed(6))}</dd></div>
    <div><dt>Join status</dt><dd>${escapeHtml(details.joinStatus)}</dd></div>
    <div><dt>Join key</dt><dd>${escapeHtml(details.joinKey)}</dd></div>
    <div><dt>PDB polymer residue</dt><dd>${escapeHtml(details.pdbResidue)}</dd></div>
    <div><dt>3D coordinate status</dt><dd>${escapeHtml(details.coordinateStatus)}</dd></div>
    <div><dt>3D coverage</dt><dd>${escapeHtml(details.coordinateCoverage)}</dd></div>
    <div><dt>Structure locus</dt><dd>${escapeHtml(details.structureLocus)}</dd></div>
    <div><dt>Assay state</dt><dd>${escapeHtml(details.assayState)}</dd></div>
    <div><dt>Bridge membership</dt><dd>${escapeHtml(details.bridgeMembership)}</dd></div>
    <div><dt>Interaction endpoint</dt><dd>${escapeHtml(details.interactionEndpoint)}</dd></div>
    <div><dt>Observed mask</dt><dd>${escapeHtml(details.coordinateStatus)}</dd></div>
    <div><dt>LSS context</dt><dd>${escapeHtml(details.lssContext)}</dd></div>
    <div><dt>FEC/LSS confidence</dt><dd>${escapeHtml(details.fecLssConfidence)}</dd></div>
    <div><dt>ANNOCONFIDENCE</dt><dd>${escapeHtml(details.annoconfidence)}</dd></div>
  </dl>`;
}

function activeResidues() {
  const chainKey = activeChainKey();
  return [...state.residueByKey.values()]
    .filter((residue) => residue.chainKey === chainKey)
    .sort((a, b) => (a.labelSeqId || 0) - (b.labelSeqId || 0));
}

function alignmentCropRange(coverage = state.structureCoverage) {
  const chain = coverage?.polymerChain || {};
  const alignment = coverage?.sequenceAlignment || {};
  const start = Number(chain.profileStart || 1);
  const end = Number(chain.profileEnd || alignment.profileResidues || activeStrand()?.sequence?.length || start);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error("linked-view structure-coverage has no usable alignment crop range");
  }
  return { start, end, label: `${start}-${end}` };
}

async function loadStructureSourceForMolstar() {
  const coverage = state.structureCoverage;
  if (!coverage?.sourceStructure?.href || !coverage?.atomSiteFilter || !coverage?.coverage) {
    throw new Error("linked-view structure-coverage missing Mol* source metadata");
  }
  const range = alignmentCropRange(coverage);
  const structureCoverageUrl = state.structureCoverageUrl || linkedViewUrls.structureCoverage;
  const resolvedSourceUrl = resolveAssetUrl(coverage.sourceStructure.href, structureCoverageUrl);
  return {
    chainKey: coverage.activeChainKey,
    mode: "source-structure",
    sourceUrl: resolvedSourceUrl,
    url: resolvedSourceUrl,
    authAsymId: coverage.atomSiteFilter.auth_asym_id,
    labelAsymId: coverage.atomSiteFilter.label_asym_id,
    atomSiteFilter: coverage.atomSiteFilter,
    alignmentRange: range,
    keptRows: coverage.coverage.resolvedResidues,
  };
}

function splitCifTokens(line) {
  const tokens = [];
  let current = "";
  let quote = "";
  for (let idx = 0; idx < line.length; idx += 1) {
    const char = line[idx];
    if (quote) {
      if (char === quote && (idx === line.length - 1 || /\s/.test(line[idx + 1]))) {
        quote = "";
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function atomSiteColumnIndex(headers, name) {
  return headers.findIndex((header) => header === `_atom_site.${name}`);
}

function cifToken(tokens, idx) {
  return idx >= 0 ? String(tokens[idx] || "") : "";
}

function cifNumber(value) {
  const number = Number(String(value || "").replace(/^\?$/, "").replace(/^\.$/, ""));
  return Number.isFinite(number) ? number : null;
}

function atomSiteRowMatchesAlignmentCrop(tokens, columns, atomSiteFilter, range) {
  const labelAsym = cifToken(tokens, columns.labelAsym);
  const authAsym = cifToken(tokens, columns.authAsym);
  const labelSeq = cifNumber(cifToken(tokens, columns.labelSeq));
  const authSeq = cifNumber(cifToken(tokens, columns.authSeq));
  const position = labelSeq ?? authSeq;
  const labelMatches = columns.labelAsym < 0 || labelAsym === String(atomSiteFilter.label_asym_id);
  const authMatches = columns.authAsym < 0 || authAsym === String(atomSiteFilter.auth_asym_id);
  const chainMatches = labelMatches && authMatches;
  return chainMatches
    && Number.isFinite(position)
    && position >= range.start
    && position <= range.end;
}

function filterMmcifAtomSiteLoop(cifText, { atomSiteFilter, range }) {
  const lines = String(cifText || "").split(/\r?\n/);
  const out = [];
  let keptAtomRows = 0;
  let droppedAtomRows = 0;
  let atomSiteLoopSeen = false;

  for (let idx = 0; idx < lines.length;) {
    if (lines[idx].trim() !== "loop_") {
      out.push(lines[idx]);
      idx += 1;
      continue;
    }

    let headerEnd = idx + 1;
    while (headerEnd < lines.length && lines[headerEnd].trim().startsWith("_")) {
      headerEnd += 1;
    }
    const headerLines = lines.slice(idx + 1, headerEnd);
    const headers = headerLines.map((line) => line.trim().split(/\s+/)[0]);
    if (!headers.some((header) => header.startsWith("_atom_site."))) {
      out.push(lines[idx]);
      idx += 1;
      continue;
    }

    atomSiteLoopSeen = true;
    out.push(lines[idx], ...headerLines);
    const columns = {
      labelAsym: atomSiteColumnIndex(headers, "label_asym_id"),
      authAsym: atomSiteColumnIndex(headers, "auth_asym_id"),
      labelSeq: atomSiteColumnIndex(headers, "label_seq_id"),
      authSeq: atomSiteColumnIndex(headers, "auth_seq_id"),
    };

    let rowIdx = headerEnd;
    while (rowIdx < lines.length) {
      const trimmed = lines[rowIdx].trim();
      if (trimmed === "#") {
        out.push(lines[rowIdx]);
        rowIdx += 1;
        break;
      }
      if (trimmed === "loop_" || trimmed.startsWith("_") || trimmed.startsWith("data_") || trimmed.startsWith("save_")) {
        break;
      }
      if (!trimmed) {
        out.push(lines[rowIdx]);
        rowIdx += 1;
        continue;
      }

      const tokens = splitCifTokens(lines[rowIdx]);
      if (tokens.length >= headers.length && atomSiteRowMatchesAlignmentCrop(tokens, columns, atomSiteFilter, range)) {
        out.push(lines[rowIdx]);
        keptAtomRows += 1;
      } else {
        droppedAtomRows += 1;
      }
      rowIdx += 1;
    }
    idx = rowIdx;
  }

  return {
    text: out.join("\n"),
    keptAtomRows,
    droppedAtomRows,
    atomSiteLoopSeen,
  };
}

async function prepareClientAlignmentCroppedCif(sourceCif) {
  const sourceBuffer = await fetchArrayBufferOrThrow(sourceCif.sourceUrl);
  const decoded = String(sourceCif.sourceUrl).endsWith(".gz")
    ? await decodeGzipArrayBuffer(sourceBuffer)
    : sourceBuffer;
  const sourceText = new TextDecoder("utf-8").decode(decoded);
  const filtered = filterMmcifAtomSiteLoop(sourceText, {
    atomSiteFilter: sourceCif.atomSiteFilter,
    range: sourceCif.alignmentRange,
  });
  if (!filtered.atomSiteLoopSeen || filtered.keptAtomRows === 0) {
    throw new Error("client alignment crop produced no target-chain atom_site rows");
  }
  if (state.molstarCroppedUrl) URL.revokeObjectURL(state.molstarCroppedUrl);
  const blob = new Blob([filtered.text], { type: "chemical/x-mmcif" });
  const url = URL.createObjectURL(blob);
  state.molstarCroppedUrl = url;
  return {
    ...sourceCif,
    mode: "client-alignment-crop",
    url,
    croppedAtomSiteRows: filtered.keptAtomRows,
    droppedAtomSiteRows: filtered.droppedAtomRows,
    croppedBytes: filtered.text.length,
  };
}

function colorForMolstarDmsReactivity(row, residueKey, selectedKey = state.selectedResidueKey) {
  if (residueKey && residueKey === selectedKey) return RESIDUE_STATE_COLORS.selected.molstarRgb;
  return hexToRgb(row?.color || "#ffffff");
}

function buildMolstarTargetDisplayPayload(profileId = activeProfileId(), selectedKey = state.selectedResidueKey) {
  const normalized = state.lastRender?.normalized;
  const residues = activeResidues();
  if (!residues.length || !normalized) return [];
  return residues.flatMap((residue) => {
    const position = residue.labelSeqId;
    const residueKey = residue.residueKey;
    const locus = state.lociByResidueKey.get(residueKey);
    const locator = locus?.locator || {};
    if (!position || locus?.coordinateStatus !== "resolved") return [];
    const row = normalized.byPosition.get(position);
    return [{
      struct_asym_id: locator.label_asym_id || locator.auth_asym_id || residue.labelAsymId,
      start_residue_number: locator.label_seq_id || locator.auth_seq_id || residue.labelSeqId || position,
      end_residue_number: locator.label_seq_id || locator.auth_seq_id || residue.labelSeqId || position,
      color: colorForMolstarDmsReactivity(row, residueKey, selectedKey),
      profile_id: profileId,
      residue_key: residueKey,
      chain_key: residue.chainKey,
      dms_fill: row?.color || "#ffffff",
      colorSource: residueKey === selectedKey ? "SELECTED" : "DMS_REACTIVITY_FILL",
      visual_state: visualStateForResidue(residueKey, selectedKey),
    }];
  });
}

function updateMolstarTargetDisplayDataset(payload, selectedKey = state.selectedResidueKey) {
  if (!el.molstarHost) return;
  const residue52 = payload.find((item) => item.residue_key === selectedKey) || payload[0] || null;
  el.molstarHost.dataset.targetDisplayMode = "alignment_cropped_target_chain";
  el.molstarHost.dataset.targetDisplayResidues = String(payload.length);
  el.molstarHost.dataset.targetDisplayColorSource = "DMS_REACTIVITY_FILL";
  el.molstarHost.dataset.targetDisplayContext = "alignment-cropped target chain";
  el.molstarHost.dataset.targetDisplaySelected = selectedKey || "";
  el.molstarHost.dataset.targetDisplayPreview52 = JSON.stringify(residue52 ? {
    residueKey: residue52.residue_key,
    structAsymId: residue52.struct_asym_id,
    startResidueNumber: residue52.start_residue_number,
    dmsFill: residue52.dms_fill,
    color: residue52.color,
    colorSource: residue52.colorSource,
  } : null);
}

function applyMolstarTargetDisplay(residueKey = state.selectedResidueKey, attempt = 0) {
  if (el.molstarSelectionStatus) {
    el.molstarSelectionStatus.textContent = residueKey ? `selection: ${residueKey}` : "selection: none";
  }
  const payload = buildMolstarTargetDisplayPayload(activeProfileId(), residueKey);
  updateMolstarTargetDisplayDataset(payload, residueKey);
  const viewer = state.molstarViewer;
  if (!viewer?.visual?.select || !state.lastRender) {
    if (attempt < 8) {
      window.setTimeout(() => applyMolstarTargetDisplay(residueKey, attempt + 1), 250);
    }
    return;
  }
  try {
    viewer.visual.select({
      data: payload,
      // alignment-cropped target chain: dim non-selected target atoms without labeling them unaligned.
      nonSelectedColor: MOLSTAR_CONTEXT_COLOR,
    });
  } catch (_error) {
    if (attempt < 8) {
      window.setTimeout(() => applyMolstarTargetDisplay(residueKey, attempt + 1), 250);
    } else {
      el.molstarStatus.textContent = "Mol* instance loaded; target display payload rejected.";
    }
  }
}

function buildMolstarSelectionPayload(profileId = activeProfileId(), selectedKey = state.selectedResidueKey) {
  return buildMolstarTargetDisplayPayload(profileId, selectedKey);
}

function applyMolstarSelection(residueKey = state.selectedResidueKey) {
  applyMolstarTargetDisplay(residueKey);
}

function applyLinkedSelection(residueKey = state.selectedResidueKey, origin = "preview") {
  state.selectedResidueKey = residueKey;
  setDomState("selected", residueKey);
  renderInspector(residueKey);
  if (el.molstarSelectionStatus) {
    el.molstarSelectionStatus.textContent = residueKey ? `selection: ${residueKey}` : "selection: none";
  }
  if (origin !== "3d") applyMolstarSelection(residueKey);
}

function selectResidue(residueKey, origin = "preview") {
  applyLinkedSelection(residueKey, origin);
  el.log.textContent = JSON.stringify({
    selected_residue_key: residueKey,
    origin,
    active_profile_id: activeProfileId(),
    molstar_selection_preview: buildMolstarSelectionPayload(activeProfileId(), residueKey).find((item) => item.visual_state === "selected") || null,
  }, null, 2);
}

function trackHoverText(trackKind, details) {
  if (!details) return trackKind;
  const labels = {
    profile_sequence: `Profile/RMDB seq ${details.position}: ${details.profileBase}`,
    pdb_polymer_alignment: `PDB polymer alignment ${details.position}: profile ${details.profileBase} -> PDB ${details.pdbBase} (${details.sequenceMatch})`,
    structure_state: `Structure state ${details.position}: ${details.structureState}`,
    pdb_residue: `3D coords ${details.position}: ${details.coordinateStatus}`,
    dms_targetability: `DMS targetability ${details.position}: ${details.assayState}`,
    profile_value: `DMS reactivity ${details.position}: raw=${details.raw === null ? "missing" : details.raw.toFixed(6)} norm=${details.norm.toFixed(3)}`,
    bridge_membership: `DBN bridge ${details.position}: ${details.bridgeMembership}`,
    observed_mask: `3D coordinates ${details.position}: ${details.coordinateStatus}`,
    fec_lss_confidence: `FEC/LSS ${details.position}: ${details.fecLssConfidence}`,
    interaction_endpoint_occupancy: `Interactions ${details.position}: ${details.interactionEndpoint}`,
  };
  return labels[trackKind] || `${trackKind} ${details.position} ${details.base}`;
}

function handleTrackHoverEvent(event, residueKey, trackKind) {
  const details = getResidueDetails(residueKey);
  applyLinkedHover(residueKey, "1d");
  showTip(event, trackHoverText(trackKind, details));
}

function handleBridgeTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:bridge_membership");
}

function handleObservedTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:observed_mask");
}

function handleProfileSequenceTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:profile_sequence");
}

function handlePdbAlignmentTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:pdb_polymer_alignment");
}

function handleStructureStateTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:structure_state");
}

function handlePdbResidueTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:pdb_residue");
}

function handleInteractionTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:interaction_endpoint_occupancy");
}

function handleConfidenceTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:fec_lss_confidence");
}

function handleTargetabilityTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:dms_targetability");
}

function clampViewport(start, end, length) {
  const minSpan = 12;
  let span = Math.max(minSpan, Math.round(end - start + 1));
  span = Math.min(length, span);
  let nextStart = Math.max(1, Math.min(length - span + 1, Math.round(start)));
  return { start: nextStart, end: nextStart + span - 1 };
}

function setViewport(start, end) {
  const strand = activeStrand();
  if (!strand) return;
  state.viewport = clampViewport(start, end, strand.sequence.length);
  renderTrackRail();
}

function zoomTrack(direction) {
  const { start, end } = state.viewport;
  const span = end - start + 1;
  const center = (start + end) / 2;
  const factor = direction > 0 ? 0.68 : 1.45;
  const nextSpan = Math.max(12, Math.round(span * factor));
  setViewport(Math.round(center - nextSpan / 2), Math.round(center + nextSpan / 2));
}

function panTrack(direction) {
  const { start, end } = state.viewport;
  const span = end - start + 1;
  const shift = Math.max(1, Math.round(span * 0.32)) * direction;
  setViewport(start + shift, end + shift);
}

function createSvgNode(svg, name, attrs = {}) {
  const node = document.createElementNS(svg.namespaceURI, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function wireTrackMark(mark, residueKey, trackKind, clickHandler) {
  mark.setAttribute("class", `${mark.getAttribute("class") || ""} residue-mark`.trim());
  mark.setAttribute("data-residue-key", residueKey);
  mark.setAttribute("data-track-kind", trackKind);
  mark.addEventListener("mousemove", (event) => handleTrackHoverEvent(event, residueKey, trackKind));
  mark.addEventListener("mouseleave", hideTip);
  mark.addEventListener("click", (event) => clickHandler(event, residueKey));
}

function renderTrackRail() {
  const strand = activeStrand();
  const normalized = state.lastRender?.normalized;
  if (!strand || !normalized) return;
  state.viewport = clampViewport(state.viewport.start, state.viewport.end, strand.sequence.length);
  const { start, end } = state.viewport;
  const positions = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  const width = 1120;
  const height = 386;
  const left = 112;
  const right = 18;
  const usable = width - left - right;
  const xFor = (position) => left + ((position - start + 0.5) / positions.length) * usable;
  const cellW = Math.max(4, usable / positions.length - 1);
  const rows = [
    ["Profile pos", 24],
    ["Profile/RMDB seq", 52],
    ["PDB polymer alignment", 84],
    ["Structure state", 116],
    ["3D coords", 148],
    ["DMS targetability", 180],
    ["DMS reactivity", 212],
    ["DBN bridge", 244],
    ["3D coordinates", 276],
    ["FEC/LSS", 308],
    ["Interactions", 340],
  ];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "1D residue track rail");
  svg.appendChild(createSvgNode(svg, "rect", { x: 0, y: 0, width, height, fill: "#ffffff" }));
  for (const [label, y] of rows) {
    const text = createSvgNode(svg, "text", { x: 10, y: y + 4, "font-size": 12, fill: "#5b6670" });
    text.textContent = label;
    svg.appendChild(text);
    svg.appendChild(createSvgNode(svg, "line", { x1: left, x2: width - right, y1: y, y2: y, stroke: "#e3e7ec", "stroke-width": 1 }));
  }
  for (const position of positions) {
    const x = xFor(position);
    const residueKey = residueKeyForPosition(position, strand);
    const residue = state.residueByKey.get(residueKey);
    if (!residue) throw new Error(`residue-index missing ${residueKey}`);
    const profileBase = residue.parentBase;
    const pdbBase = residue.compId;
    const alignmentState = alignmentStateForResidue(residueKey);
    const row = normalized.byPosition.get(position) || {};
    const color = row.color || "#ffffff";
    const bridgeMembership = state.bridgeByResidueKey.get(residueKey) || [];
    const interactionEndpoints = state.interactionsByResidueKey.get(residueKey) || [];
    const pdbResidue = state.pdbResidueByKey.get(residueKey);
    const observed = pdbResidue?.coordinateStatus === "resolved";
    const coordinateStyle = observed ? coordinateResolvedStyle : coordinateSequenceOnlyStyle;
    const coordinateMeaning = observed ? "resolved_atom_site_coordinate" : "sequence_only_no_atom_site_coordinate";
    if (position === 1 || position % 10 === 0 || position === strand.sequence.length) {
      svg.appendChild(createSvgNode(svg, "line", { x1: x, x2: x, y1: 15, y2: 30, stroke: "#7c8792", "stroke-width": 0.8 }));
      const tick = createSvgNode(svg, "text", { x, y: 12, "font-size": 10, "text-anchor": "middle", fill: "#39434d" });
      tick.textContent = String(position);
      svg.appendChild(tick);
    }
    const profileSeq = createSvgNode(svg, "rect", { x: x - cellW / 2, y: 40, width: cellW, height: 24, fill: colorForBase(profileBase), stroke: "#aeb7c1", "stroke-width": 0.5, rx: 1, "data-profile-base": profileBase });
    wireTrackMark(profileSeq, residueKey, "profile_sequence", handleProfileSequenceTrackEvent);
    svg.appendChild(profileSeq);
    const profileText = createSvgNode(svg, "text", { x, y: 56, "font-size": 10, "text-anchor": "middle", fill: "#ffffff", "pointer-events": "none" });
    profileText.textContent = profileBase;
    svg.appendChild(profileText);

    const alignmentFill = { match: "#dceccf", mismatch: "#f8d7da", materialized_alignment: "#eceff3" }[alignmentState];
    const alignmentStroke = { match: "#5d8a45", mismatch: "#b00020", materialized_alignment: "#9aa4ad" }[alignmentState];
    const pdbAlignment = createSvgNode(svg, "rect", {
      x: x - cellW / 2,
      y: 76,
      width: cellW,
      height: 16,
      fill: alignmentFill,
      stroke: alignmentStroke,
      "stroke-width": alignmentState === "match" ? 0.5 : 1.4,
      rx: 1,
      "data-profile-base": profileBase,
      "data-pdb-base": pdbBase,
      "data-alignment-state": alignmentState,
      "data-alignment-source": "structure-coverage.sequenceAlignment",
    });
    wireTrackMark(pdbAlignment, residueKey, "pdb_polymer_alignment", handlePdbAlignmentTrackEvent);
    svg.appendChild(pdbAlignment);
    const pdbAlignmentText = createSvgNode(svg, "text", { x, y: 92, "font-size": 10, "text-anchor": "middle", fill: alignmentState === "mismatch" ? "#7a0013" : "#243018", "pointer-events": "none", "data-alignment-text-for": residueKey, "data-pdb-base": pdbBase });
    pdbAlignmentText.textContent = pdbBase;
    svg.appendChild(pdbAlignmentText);

    const stateColor = colorForResidueVisualState(residueKey);
    const structureState = visualStateForResidue(residueKey);
    const structureStateCell = createSvgNode(svg, "rect", {
      x: x - cellW / 2,
      y: 104,
      width: cellW,
      height: 24,
      fill: stateColor.fill,
      stroke: stateColor.stroke,
      "stroke-width": 0.9,
      rx: 1,
      "data-structure-state": structureState,
    });
    structureStateCell.setAttribute("data-state-color-source", "RESIDUE_STATE_COLORS");
    wireTrackMark(structureStateCell, residueKey, "structure_state", handleStructureStateTrackEvent);
    svg.appendChild(structureStateCell);
    if (position === 1 || position % 10 === 0 || position === strand.sequence.length) {
      const stateTick = createSvgNode(svg, "text", { x, y: 120, "font-size": 8.5, "text-anchor": "middle", fill: stateColor.stroke, "pointer-events": "none" });
      stateTick.textContent = structureState === "stem" ? "S" : structureState === "loop" ? "L" : structureState.slice(0, 1).toUpperCase();
      svg.appendChild(stateTick);
    }

    const pdbCell = createSvgNode(svg, "rect", {
      x: x - cellW / 2,
      y: 136,
      width: cellW,
      height: 24,
      fill: coordinateStyle.fill,
      stroke: coordinateStyle.stroke,
      "stroke-width": observed ? 0.7 : 0.4,
      rx: 1,
      "data-pdb-residue": pdbResidue ? `${pdbResidue.pdbStrandId}:${pdbResidue.labelSeqId}` : "",
      "data-coordinate-status": pdbResidue?.coordinateStatus || "unavailable",
      "data-coordinate-meaning": coordinateMeaning,
    });
    wireTrackMark(pdbCell, residueKey, "pdb_residue", handlePdbResidueTrackEvent);
    svg.appendChild(pdbCell);
    if (position === 1 || position % 10 === 0 || position === strand.sequence.length || position === state.structureCoverage?.coverage?.firstResolvedProfilePosition || position === state.structureCoverage?.coverage?.lastResolvedProfilePosition) {
      const pdbTick = createSvgNode(svg, "text", { x, y: 152, "font-size": 8.5, "text-anchor": "middle", fill: observed ? "#164b6c" : "#7b858e", "pointer-events": "none" });
      pdbTick.textContent = pdbResidue ? String(pdbResidue.labelSeqId) : "-";
      svg.appendChild(pdbTick);
    }

    const targetable = assayStateForBase(profileBase) === "applicable";
    const targetability = createSvgNode(svg, "rect", {
      x: x - cellW / 2,
      y: 172,
      width: cellW,
      height: 16,
      fill: targetable ? "#dceccf" : "#f4f5f6",
      stroke: targetable ? "#5d8a45" : "#c8cdd2",
      "stroke-width": 0.5,
      rx: 1,
      "data-assay-state": targetable ? "applicable" : "not_applicable",
    });
    wireTrackMark(targetability, residueKey, "dms_targetability", handleTargetabilityTrackEvent);
    svg.appendChild(targetability);

    const profileRect = createSvgNode(svg, "rect", { x: x - cellW / 2, y: 200, width: cellW, height: 24, fill: color, stroke: "#aeb7c1", "stroke-width": 0.5, rx: 1 });
    wireTrackMark(profileRect, residueKey, "profile_value", (event, key) => selectResidue(key, "1d:profile_value"));
    svg.appendChild(profileRect);
    if (row.norm > 0) {
      const barH = Math.max(1, Math.round(row.norm * 21));
      svg.appendChild(createSvgNode(svg, "rect", { x: x - 2, y: 223 - barH, width: 4, height: barH, fill: "#17212b", opacity: 0.35 }));
    }

    if (bridgeMembership.length) {
      const bridge = createSvgNode(svg, "rect", { x: x - cellW / 2, y: 236, width: cellW, height: 16, fill: "#2c7a7b", stroke: "#195d5e", "stroke-width": 0.5, rx: 1 });
      wireTrackMark(bridge, residueKey, "bridge_membership", handleBridgeTrackEvent);
      svg.appendChild(bridge);
    } else {
      const bridgeEmpty = createSvgNode(svg, "rect", { x: x - cellW / 2, y: 240, width: cellW, height: 8, fill: "#eef3f2", stroke: "#d5dfdd", "stroke-width": 0.4, rx: 1 });
      wireTrackMark(bridgeEmpty, residueKey, "bridge_membership", handleBridgeTrackEvent);
      svg.appendChild(bridgeEmpty);
    }

    const obs = createSvgNode(svg, "circle", { cx: x, cy: 276, r: observed ? 4.2 : 3.4, fill: observed ? "#1f2933" : coordinateSequenceOnlyStyle.fill, stroke: observed ? "#1f2933" : coordinateSequenceOnlyStyle.stroke, "stroke-width": observed ? 0.8 : 1.2, "data-coordinate-status": pdbResidue?.coordinateStatus || "unavailable", "data-coordinate-meaning": coordinateMeaning });
    wireTrackMark(obs, residueKey, "observed_mask", handleObservedTrackEvent);
    svg.appendChild(obs);

    const confRect = createSvgNode(svg, "rect", {
      x: x - cellW / 2,
      y: 300,
      width: cellW,
      height: 16,
      fill: "#f8f2dc",
      stroke: "#cab779",
      "stroke-width": 0.5,
      rx: 1,
      "data-confidence-state": state.confidenceSummary?.fec?.status || "not_materialized_in_smoke",
    });
    wireTrackMark(confRect, residueKey, "fec_lss_confidence", handleConfidenceTrackEvent);
    svg.appendChild(confRect);

    if (interactionEndpoints.length) {
      const dot = createSvgNode(svg, "circle", { cx: x, cy: 340, r: 4.2, fill: "#1f78b4", stroke: "#0f3f60", "stroke-width": 0.6 });
      wireTrackMark(dot, residueKey, "interaction_endpoint_occupancy", handleInteractionTrackEvent);
      svg.appendChild(dot);
    } else {
      const dot = createSvgNode(svg, "circle", { cx: x, cy: 340, r: 2.2, fill: "#ffffff", stroke: "#aab5bf", "stroke-width": 0.8 });
      wireTrackMark(dot, residueKey, "interaction_endpoint_occupancy", handleInteractionTrackEvent);
      svg.appendChild(dot);
    }
  }
  el.track.replaceChildren(svg);
  el.viewportStatus.textContent = `${start}-${end} / ${strand.sequence.length}`;
  const coverage = state.structureCoverage?.coverage;
  const sequenceSummary = materializedSequenceAlignment();
  el.trackStatus.textContent = coverage
    ? `${positions.length} residues visible | ${sequenceAgreementStatusLabel(sequenceSummary)} | ${atomSiteCoverageStatusLabel(coverage)} | ${lssContextLabel()}`
    : `${positions.length} residues visible | ${sequenceAgreementStatusLabel(sequenceSummary)}`;
  applyLinkedHover(state.hoveredResidueKey);
  applyLinkedSelection(state.selectedResidueKey);
}

function toVarnaRgb(color) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return "rgb(100%, 100%, 100%)";
  const hex = match[1];
  const channels = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${channels.map((value) => Math.round((value / 255) * 100)).join("%, ")}%)`;
}

function recolorVarnaSvg(template, strand, normalized, profile) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(template, "image/svg+xml");
  const svg = doc.documentElement;
  svg.setAttribute("data-view", "varna");
  svg.setAttribute("data-layout-source", "VARNA");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "VARNA secondary structure");
  svg.setAttribute("viewBox", svg.getAttribute("viewBox") || "0 0 1270 355");
  const fillCircles = [...svg.querySelectorAll('circle[stroke="none"][r="5.0"]')];
  const baseTexts = [...svg.querySelectorAll('text[font-family="Verdana"][font-size="7.5"]')];
  if (fillCircles.length !== strand.sequence.length) {
    throw new Error(`VARNA base circle count ${fillCircles.length} does not match strand length ${strand.sequence.length}`);
  }
  for (let idx = 0; idx < fillCircles.length; idx += 1) {
    const pos = idx + 1;
    const residueKey = residueKeyForPosition(pos);
    const colorRow = normalized.byPosition.get(pos);
    const color = colorRow?.color ?? "#ffffff";
    const norm = colorRow?.norm ?? 0;
    const stateColor = colorForResidueVisualState(residueKey);
    const structureState = visualStateForResidue(residueKey);
    fillCircles[idx].setAttribute("fill", toVarnaRgb(color));
    fillCircles[idx].setAttribute("stroke", toVarnaRgb(stateColor.stroke));
    fillCircles[idx].setAttribute("stroke-width", "1.4");
    fillCircles[idx].setAttribute("class", "residue-mark");
    fillCircles[idx].setAttribute("data-position", String(pos));
    fillCircles[idx].setAttribute("data-residue-key", residueKey);
    fillCircles[idx].setAttribute("data-structure-state", structureState);
    fillCircles[idx].setAttribute("data-state-color-source", "RESIDUE_STATE_COLORS");
    fillCircles[idx].setAttribute("data-reactivity-fill", color);
    fillCircles[idx].setAttribute("data-reactivity-norm", Number.isFinite(norm) ? norm.toFixed(6) : "0");
    const title = doc.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${pos} ${strand.sequence[idx]} raw=${colorRow?.raw ?? ""} norm=${norm}`;
    fillCircles[idx].prepend(title);
    if (baseTexts[idx]) {
      baseTexts[idx].setAttribute("fill", norm >= 0.72 ? "rgb(100%, 100%, 100%)" : "rgb(0%, 0%, 0%)");
    }
  }
  installVarnaHitLayer(doc, svg, fillCircles, strand);
  return new XMLSerializer().serializeToString(svg);
}

function installVarnaHitLayer(doc, svg, fillCircles, strand) {
  const group = doc.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("data-layer", "varna-hit-layer");
  group.setAttribute("class", "varna-hit-layer");
  for (let idx = 0; idx < fillCircles.length; idx += 1) {
    const pos = idx + 1;
    const source = fillCircles[idx];
    const hit = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
    hit.setAttribute("class", "residue-mark varna-hit");
    hit.setAttribute("data-layer", "varna-hit-layer");
    hit.setAttribute("data-position", String(pos));
    hit.setAttribute("data-residue-key", residueKeyForPosition(pos, strand));
    hit.setAttribute("cx", source.getAttribute("cx"));
    hit.setAttribute("cy", source.getAttribute("cy"));
    hit.setAttribute("r", "8");
    hit.setAttribute("fill", "transparent");
    hit.setAttribute("stroke", "transparent");
    group.appendChild(hit);
  }
  svg.appendChild(group);
}

function wireVarnaEvents() {
  el.varnaViewport.querySelectorAll('circle[data-layer="varna-hit-layer"][data-position]').forEach((circle) => {
    const position = Number(circle.getAttribute("data-position"));
    const residueKey = circle.getAttribute("data-residue-key") || residueKeyForPosition(position);
    circle.addEventListener("mousemove", (event) => {
      const details = getResidueDetails(residueKey);
      applyLinkedHover(residueKey, "2d");
      showTip(event, `2D ${details?.position || ""} ${details?.base || ""}`);
    });
    circle.addEventListener("click", () => selectResidue(residueKey, "2d"));
    circle.addEventListener("mouseleave", hideTip);
  });
}

function fitVarnaSvg() {
  const svg = el.varnaViewport.querySelector("svg");
  if (!svg) return null;
  const viewBox = svg.getAttribute("viewBox") || "0 0 1270 355";
  const [, , width, height] = viewBox.split(/\s+/).map(Number);
  const aspect = width > 0 && height > 0 ? width / height : 1270 / 355;
  el.varnaViewport.style.setProperty("--varna-aspect", String(aspect));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  return { width, height, aspect };
}

function drawLinearSvg(strand, normalized, profile) {
  const sequence = strand.sequence;
  const pairs = strandPairs(strand);
  const n = sequence.length;
  const spacing = 13;
  const left = 60;
  const baseline = 268;
  const radius = 5;
  const width = left * 2 + spacing * (n - 1);
  const height = 420;
  const parts = [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img">`,
    `<style>text{font-family:Arial,Helvetica,sans-serif}.base{font-size:8px;text-anchor:middle;dominant-baseline:central}.tick{font-size:9px;text-anchor:middle;fill:#58616b}.meta{font-size:12px;fill:#333}</style>`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="20" y="26" class="meta">${config.caseId || state.caseData?.case_id || "case"} ${profile.pair_id} ${profile.profile_id}</text>`,
  ];
  for (const [i, j] of pairs) {
    const x1 = left + (i - 1) * spacing;
    const x2 = left + (j - 1) * spacing;
    const mid = (x1 + x2) / 2;
    const arcHeight = Math.min(180, Math.max(18, Math.abs(x2 - x1) * 0.36));
    parts.push(`<path d="M${x1},${baseline} Q${mid},${baseline - arcHeight} ${x2},${baseline}" fill="none" stroke="#8a8f98" stroke-width="1" opacity="0.65"/>`);
  }
  parts.push(`<line x1="${left}" y1="${baseline}" x2="${left + (n - 1) * spacing}" y2="${baseline}" stroke="#c8ccd2"/>`);
  for (let pos = 1; pos <= n; pos += 1) {
    const x = left + (pos - 1) * spacing;
    const base = sequence[pos - 1];
    const colorRow = normalized.byPosition.get(pos);
    const fill = colorRow?.color ?? "#ffffff";
    const raw = colorRow?.raw ?? "";
    const norm = colorRow?.norm ?? "";
    parts.push(`<g><title>${pos} ${base} raw=${raw} norm=${norm}</title><circle class="residue-mark" data-residue-key="${residueKeyForPosition(pos)}" data-position="${pos}" cx="${x}" cy="${baseline}" r="${radius}" fill="${fill}" stroke="#30343b" stroke-width="0.6"/><text x="${x}" y="${baseline + 15}" class="base">${base}</text></g>`);
    if (pos === 1 || pos % 10 === 0 || pos === n) {
      parts.push(`<text x="${x}" y="${baseline + 34}" class="tick">${pos}</text>`);
    }
  }
  parts.push(`</svg>`);
  return parts.join("");
}

function wireLinearDebugEvents() {
  el.linearViewer.querySelectorAll("circle[data-position]").forEach((circle) => {
    const residueKey = circle.getAttribute("data-residue-key");
    circle.addEventListener("mousemove", (event) => {
      const details = getResidueDetails(residueKey);
      applyLinkedHover(residueKey, "linear");
      showTip(event, `linear ${details?.position || ""} ${details?.base || ""}`);
    });
    circle.addEventListener("click", () => selectResidue(residueKey, "linear"));
    circle.addEventListener("mouseleave", hideTip);
  });
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><b>${value}</b></div>`;
}

async function loadPdbeMolstarAssets() {
  if (!document.getElementById("pdbe-molstar-css")) {
    const css = document.createElement("link");
    css.id = "pdbe-molstar-css";
    css.rel = "stylesheet";
    css.href = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar.css";
    document.head.appendChild(css);
  }
  if (!window.PDBeMolstarPlugin) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar-plugin.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

function molstarValue(payload, names) {
  for (const name of names) {
    const value = payload?.[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function looksLikeMolstarResiduePayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  return molstarValue(payload, [
    "residueNumber",
    "residue_number",
    "seq_id",
    "seqId",
    "auth_seq_id",
    "authSeqId",
    "label_seq_id",
    "labelSeqId",
    "start_residue_number",
  ]) !== null;
}

function extractMolstarEventData(event) {
  const queue = [event?.eventData, event?.detail, event];
  const seen = new Set();
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);
    if (looksLikeMolstarResiduePayload(item)) return item;
    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }
    queue.push(item.eventData, item.data, item.payload, item.loci, item.current, item.object);
  }
  return {};
}

function molstarEventMatchesActiveChain(payload = {}) {
  const atomSiteFilter = state.structureCoverage?.atomSiteFilter || {};
  const authChainIds = [
    molstarValue(payload, ["auth_asym_id", "authAsymId"]),
    molstarValue(payload, ["auth_chain_id", "authChainId"]),
    molstarValue(payload, ["chain_id", "chainId"]),
  ].filter(Boolean).map(String);
  const labelChainIds = [
    molstarValue(payload, ["label_asym_id", "labelAsymId"]),
    molstarValue(payload, ["label_chain_id", "labelChainId"]),
    molstarValue(payload, ["struct_asym_id", "structAsymId"]),
    molstarValue(payload, ["chain_id", "chainId"]),
    molstarValue(payload, ["entity_id", "entityId"]),
  ].filter(Boolean).map(String);
  return authChainIds.includes(String(atomSiteFilter.auth_asym_id))
    || labelChainIds.includes(String(atomSiteFilter.label_asym_id));
}

function residueKeyFromMolstarEventData(payload = {}) {
  if (!molstarEventMatchesActiveChain(payload)) return null;
  const rawPosition = molstarValue(payload, [
    "label_seq_id",
    "labelSeqId",
    "residueNumber",
    "residue_number",
    "seq_id",
    "seqId",
    "auth_seq_id",
    "authSeqId",
    "start_residue_number",
  ]);
  const position = Number(rawPosition);
  if (!Number.isFinite(position) || position < 1) return null;
  return residueKeyForPosition(position);
}

function handleMolstarResidueEvent(event, mode = "selection", origin = "3d") {
  const residueKey = residueKeyFromMolstarEventData(extractMolstarEventData(event));
  if (!residueKey) return;
  if (mode === "hover") {
    applyMolstarHover(residueKey, event);
  } else {
    selectResidue(residueKey, origin);
  }
}

function installMolstarEventBridge(viewer, host) {
  if (!host || state.molstarBridgeInstalled) return;
  state.molstarBridgeInstalled = true;
  host.addEventListener("PDB.molstar.click", (event) => handleMolstarResidueEvent(event, "selection", "3d"));
  host.addEventListener("PDB.molstar.mouseover", (event) => handleMolstarResidueEvent(event, "hover", "3d"));
  host.addEventListener("PDB.molstar.mouseout", () => applyMolstarHover(null));
  host.dataset.eventBridge = viewer.events ? "viewer.events" : "pdbe-custom-events";
}

function setMolstarStructureDataset(host, structure, sourceKind) {
  if (!host) return;
  host.dataset.structureSource = structure.mode;
  host.dataset.structureSourceKind = sourceKind;
  host.dataset.structureSourceUrl = structure.sourceUrl;
  host.dataset.structureAuthAsymId = structure.authAsymId;
  host.dataset.structureLabelAsymId = structure.labelAsymId;
  host.dataset.structureAtomRows = String(structure.keptRows);
  host.dataset.alignmentCropRange = structure.alignmentRange?.label || "";
  host.dataset.alignmentCropSource = "structure-coverage.sequenceAlignment";
  if (sourceKind === "cropped") {
    host.dataset.croppedAtomSiteRows = String(structure.croppedAtomSiteRows);
    host.dataset.droppedAtomSiteRows = String(structure.droppedAtomSiteRows);
    host.dataset.croppedBytes = String(structure.croppedBytes);
  }
}

async function initMolstarViewer() {
  if (state.molstarViewer || !el.molstarHost || !el.molstarFullHost) return;
  el.molstarStatus.textContent = `loading Mol* from ${sourceStructureUrl}`;
  el.molstarMeta.textContent = `${activeChainKey()} will use a target chain alignment crop.`;
  el.molstarFullMeta.textContent = `${activeChainKey()} full CIF reference pending.`;
  try {
    const sourceCif = await loadStructureSourceForMolstar();
    const croppedCif = await prepareClientAlignmentCroppedCif(sourceCif);
    setMolstarStructureDataset(el.molstarHost, croppedCif, "cropped");
    setMolstarStructureDataset(el.molstarFullHost, sourceCif, "full");
    installMolstarEventBridge({ events: null }, el.molstarHost);
    const coverage = state.structureCoverage?.coverage;
    const sequenceSummary = materializedSequenceAlignment();
    el.molstarMeta.textContent = coverage
      ? `${croppedCif.chainKey} | ${croppedCif.mode} | target chain alignment crop from ${croppedCif.alignmentRange.label}; auth_asym_id=${croppedCif.authAsymId} label_asym_id=${croppedCif.labelAsymId}; ${croppedCif.croppedAtomSiteRows} atom_site rows kept; displayed with DMS reactivity colors | ${sequenceAgreementStatusLabel(sequenceSummary)} | ${atomSiteCoverageStatusLabel(coverage)}; ${sequenceOnlyCoordinateNote()}; ${lssContextLabel()}.`
      : `${croppedCif.chainKey} | ${croppedCif.mode} | auth_asym_id=${croppedCif.authAsymId} label_asym_id=${croppedCif.labelAsymId}.`;
    el.molstarFullMeta.textContent = `${sourceCif.chainKey} | full CIF reference | ${sourceCif.sourceUrl} | uncropped source for chain comparison.`;
    await loadPdbeMolstarAssets();
    const croppedViewer = new window.PDBeMolstarPlugin();
    const fullViewer = new window.PDBeMolstarPlugin();
    state.molstarViewer = croppedViewer;
    state.molstarFullViewer = fullViewer;
    croppedViewer.render(el.molstarHost, {
      customData: { url: croppedCif.url, format: "cif" },
      expanded: false,
      hideControls: true,
      bgColor: { r: 255, g: 255, b: 255 },
    });
    fullViewer.render(el.molstarFullHost, {
      customData: { url: sourceCif.sourceUrl, format: "cif" },
      expanded: false,
      hideControls: true,
      bgColor: { r: 255, g: 255, b: 255 },
    });
    el.molstarStatus.textContent = `Mol* instances loaded: target crop ${croppedCif.chainKey}; full CIF reference retained.`;
    window.setTimeout(() => applyMolstarTargetDisplay(state.selectedResidueKey), 700);
  } catch (error) {
    el.molstarStatus.textContent = "Mol* runtime unavailable; structure views were not rendered.";
    el.molstarHost.innerHTML = `<pre>${escapeHtml(sourceStructureUrl)}\n${escapeHtml(error.message || error)}</pre>`;
    el.molstarFullHost.innerHTML = `<pre>${escapeHtml(sourceStructureUrl)}\n${escapeHtml(error.message || error)}</pre>`;
  }
}

async function renderProfile(index) {
  const started = performance.now();
  const profile = state.profiles[index];
  if (!profile) return;
  const shard = await loadShard(profile.shard_id);
  const values = profileValues(profile, shard);
  const strandId = profile.render_strand_id || state.caseData.default_render_strand_id;
  const strand = state.caseData.strands.find((item) => item.strand_id === strandId);
  const normalized = normalizeProfile(profile, values);
  const dmsLoopRecall = computeDmsLoopRecall(profile, normalized, strand);
  const lssContext = lssContextForProfile(profile.profile_id);
  const rawAlignmentCoverage = rawAlignmentCoverageForProfile(profile);
  const varnaSvg = recolorVarnaSvg(state.varnaTemplate, strand, normalized, profile);
  const linearSvg = drawLinearSvg(strand, normalized, profile);
  el.varnaViewport.innerHTML = varnaSvg;
  const varnaFit = fitVarnaSvg();
  wireVarnaEvents();
  el.linearViewer.innerHTML = linearSvg;
  wireLinearDebugEvents();
  const elapsed = performance.now() - started;
  state.lastRender = { profile, normalized, shard, elapsed, dmsLoopRecall };
  state.requestedProfileId = profile.profile_id || "";
  el.select.value = String(index);
  state.viewport = clampViewport(state.viewport.start, state.viewport.end, strand.sequence.length);
  el.profilePair.textContent = profile.pair_id;
  el.profileId.textContent = profile.profile_id;
  el.profilePair.title = profile.pair_id;
  el.profileId.title = profile.profile_id;
  el.molstarHost.setAttribute("data-structure-chain-key", activeChainKey());
  el.molstarFullHost.setAttribute("data-structure-chain-key", activeChainKey());
  const coverage = state.structureCoverage?.coverage;
  const sequenceSummary = materializedSequenceAlignment();
  el.molstarMeta.textContent = coverage
    ? `${activeChainKey()} | profile ${profile.profile_id} | target chain alignment crop displayed with DMS reactivity colors | ${sequenceAgreementStatusLabel(sequenceSummary)} | ${atomSiteCoverageStatusLabel(coverage)}; ${sequenceOnlyCoordinateNote()}; ${lssContextLabel(profile.profile_id)}.`
    : `${activeChainKey()} | profile ${profile.profile_id} | ${activeResidues().length} residues in active profile.`;
  el.molstarFullMeta.textContent = `${activeChainKey()} | profile ${profile.profile_id} | full CIF reference remains uncropped for comparison.`;
  el.stats.innerHTML = [
    metric("update ms", elapsed.toFixed(2)),
    metric("profiles loaded", state.profiles.length),
    metric("sequence match", `${sequenceSummary.matchedResidues}/${sequenceSummary.profileResidues}`),
    metric("atom_site obs", coverage?.profileResidues ? `${coverage.resolvedResidues}/${coverage.profileResidues}` : "n/a"),
    metric("RMDB query coverage", rawAlignmentCoverageMetric(rawAlignmentCoverage, "rmdbQueryCoverage")),
    metric("PDB reference sequence coverage", rawAlignmentCoverageMetric(rawAlignmentCoverage, "pdbReferenceSequenceCoverage")),
    metric("LSS status", lssContext?.lssStatus || "not materialized"),
    metric("LSS evaluable", lssContext ? `${lssContext.pairedEvaluable} paired / ${lssContext.unpairedEvaluable} unpaired` : "not materialized"),
    metric("DMS loop recall", formatDmsLoopRecall(dmsLoopRecall)),
    metric("mapped bases", normalized.mappedCount),
    metric("white bases", normalized.whiteCount),
    metric("positive bases", normalized.positiveCount),
    metric("P95 cap", normalized.cap.toFixed(4)),
  ].join("");
  updateView();
  renderTrackRail();
  renderInspector(state.selectedResidueKey);
  applyMolstarTargetDisplay(state.selectedResidueKey);
  el.log.textContent = JSON.stringify({
    pair_id: profile.pair_id,
    profile_id: profile.profile_id,
    render_strand_id: strandId,
    shard_id: profile.shard_id,
    shard_decode_mode: shard.decodeMode,
    shard_gzip_bytes: shard.gzipBytes,
    shard_raw_bytes: shard.rawBytes,
    layout_source: "VARNA",
    varna_fit: varnaFit,
    structure_coverage: state.structureCoverage?.coverage || null,
    raw_alignment_coverage: rawAlignmentCoverage || {
      status: state.rawAlignmentCoverage?.status || "not_materialized",
      sourceDataPath: state.rawAlignmentCoverage?.sourceDataPath || "not_materialized",
    },
    lss_context: lssContext || { status: "not_materialized" },
    dms_loop_recall: dmsLoopRecall,
    fec_status: state.confidenceSummary?.fec?.status || "not_materialized_in_smoke",
    lss_status: state.confidenceSummary?.lss?.status || "not_materialized_in_smoke",
    annoconfidence_status: state.confidenceSummary?.annoconfidence?.status || "not_materialized_in_smoke",
    elapsed_ms: Number(elapsed.toFixed(3)),
    p95_positive_cap: normalized.cap,
    capped_count: normalized.cappedCount,
    unmapped_count: normalized.unmappedCount,
  }, null, 2);
}

function profileIndexForId(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) return -1;
  return state.profiles.findIndex((profile) => profile.profile_id === normalized);
}

function initialProfileIdFromLocation() {
  const params = new URLSearchParams(window.location.search || "");
  return String(params.get("profileId") || "").trim();
}

async function renderProfileById(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) return;
  if (!state.profiles.length) {
    state.requestedProfileId = normalized;
    return;
  }
  const index = profileIndexForId(normalized);
  if (index < 0) return;
  await renderProfile(index);
}

function installExternalProfileBridge() {
  if (window.__annojoinExternalProfileBridgeInstalled) return;
  window.__annojoinExternalProfileBridgeInstalled = true;
  window.addEventListener("message", (event) => {
    const payload = event?.data;
    if (!payload || payload.type !== "annojoin:set-profile") return;
    void renderProfileById(payload.profileId);
  });
}

async function benchmarkAll() {
  const started = performance.now();
  let svgBytes = 0;
  for (let i = 0; i < state.profiles.length; i += 1) {
    const profile = state.profiles[i];
    const shard = await loadShard(profile.shard_id);
    const values = profileValues(profile, shard);
    const strand = state.caseData.strands.find((item) => item.strand_id === (profile.render_strand_id || state.caseData.default_render_strand_id));
    const normalized = normalizeProfile(profile, values);
    svgBytes += recolorVarnaSvg(state.varnaTemplate, strand, normalized, profile).length + drawLinearSvg(strand, normalized, profile).length;
  }
  const elapsed = performance.now() - started;
  el.log.textContent = JSON.stringify({
    benchmark_profiles: state.profiles.length,
    total_ms: Number(elapsed.toFixed(3)),
    mean_ms_per_profile: Number((elapsed / state.profiles.length).toFixed(3)),
    generated_svg_bytes: svgBytes,
  }, null, 2);
}

function updateView() {
  const varnaActive = state.activeView === "varna";
  el.varnaViewer.hidden = !varnaActive;
  el.linearViewer.hidden = varnaActive;
  for (const tab of el.tabs) {
    const active = tab.dataset.view === state.activeView;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  }
  el.caption.textContent = varnaActive
    ? "VARNA layout with active profile coloring."
    : "Linear residue order with profile coloring.";
}

async function init() {
  const started = performance.now();
  const linkedViewPromise = linkedViewBundleUrl
    ? fetchJsonMaybeGzip(linkedViewBundleUrl).then((bundle) => ({
        residueIndex: bundle.residueIndex,
        profileJoins: bundle.profileJoins || null,
        structureContexts: bundle.structureContexts,
        structureCoverage: bundle.structureCoverage,
        bridges: bundle.bridges,
        interactions: bundle.interactions,
        confidenceSummary: bundle.confidenceSummary,
        lssContext: bundle.lssContext,
        rawAlignmentCoverage: bundle.rawAlignmentCoverage,
      }))
    : Promise.all([
        fetchJsonMaybeGzip(linkedViewUrls.residueIndex),
        fetchJsonMaybeGzip(linkedViewUrls.profileJoins),
        fetchJsonMaybeGzip(linkedViewUrls.structureContexts),
        fetchJsonMaybeGzip(linkedViewUrls.structureCoverage),
        fetchJsonMaybeGzip(linkedViewUrls.bridges),
        fetchJsonMaybeGzip(linkedViewUrls.interactions),
        fetchJsonMaybeGzip(linkedViewUrls.confidenceSummary),
        fetchJsonMaybeGzip(linkedViewUrls.lssContext),
        fetchJsonMaybeGzip(linkedViewUrls.rawAlignmentCoverage),
      ]).then(([
        residueIndex,
        profileJoins,
        structureContexts,
        structureCoverage,
        bridges,
        interactions,
        confidenceSummary,
        lssContext,
        rawAlignmentCoverage,
      ]) => ({
        residueIndex,
        profileJoins,
        structureContexts,
        structureCoverage,
        bridges,
        interactions,
        confidenceSummary,
        lssContext,
        rawAlignmentCoverage,
      }));
  const [
    caseData,
    profileIndex,
    varnaTemplate,
    linkedView,
  ] = await Promise.all([
    fetchJsonMaybeGzip(caseUrl),
    fetchJsonMaybeGzip(profileIndexUrl),
    fetchTextMaybeGzip(varnaTemplateUrl),
    linkedViewPromise,
  ]);
  const {
    residueIndex,
    profileJoins,
    structureContexts,
    structureCoverage,
    bridges,
    interactions,
    confidenceSummary,
    lssContext,
    rawAlignmentCoverage,
  } = linkedView;
  state.caseData = caseData;
  state.profileIndex = profileIndex;
  state.linkedView = { residueIndex, profileJoins, structureContexts, structureCoverage, bridges, interactions, confidenceSummary, lssContext, rawAlignmentCoverage };
  installLinkedViewIndexes(state.linkedView);
  state.varnaTemplate = varnaTemplate;
  state.profiles = profileIndex.profiles;
  const strand = activeStrand() || caseData.strands[0];
  state.viewport = { start: 1, end: strand.sequence.length };
  el.select.innerHTML = state.profiles.map((profile, idx) => {
    const label = `${profile.pair_id} | ${profile.profile_id}`;
    return `<option value="${idx}">${label}</option>`;
  }).join("");
  el.status.textContent = `loaded profile index for ${state.profiles.length} profiles in ${(performance.now() - started).toFixed(1)} ms`;
  const initialProfileId = state.requestedProfileId || initialProfileIdFromLocation();
  const initialIndex = Math.max(0, profileIndexForId(initialProfileId));
  await renderProfile(initialIndex);
  initMolstarViewer();
}

el.select.addEventListener("change", () => void renderProfile(Number(el.select.value)));
el.benchmark.addEventListener("click", () => void benchmarkAll());
el.zoomIn.addEventListener("click", () => zoomTrack(1));
el.zoomOut.addEventListener("click", () => zoomTrack(-1));
el.panLeft.addEventListener("click", () => panTrack(-1));
el.panRight.addEventListener("click", () => panTrack(1));
el.resetView.addEventListener("click", () => {
  const strand = activeStrand();
  if (strand) setViewport(1, strand.sequence.length);
});
for (const tab of el.tabs) {
  tab.addEventListener("click", () => {
    state.activeView = tab.dataset.view;
    updateView();
  });
}

installExternalProfileBridge();

init().catch((error) => {
  el.status.textContent = "asset load failed";
  el.log.textContent = String(error.stack || error);
});
