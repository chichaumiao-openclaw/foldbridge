// workbench-pure.mjs — DOM-free pure helpers, importable by node --test AND workbench.js.
// workbench.js keeps its own escapeHtml (DOM-adjacent); this module carries an
// independent esc() so the module stays importable without any browser globals.
export function esc(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export const PROFILE_PUBLIC_TECHNIQUES_SCHEMA = "profile-public-techniques.v1";
export const LOCAL_GEOMETRY_SCHEMA = "foldbridge-local-geometry.v1";

export const REACTIVITY_STATES = Object.freeze({
  MISSING: "missing",
  NONPOSITIVE: "nonpositive",
  POSITIVE: "positive",
});

const REACTIVITY_MISSING_COLOR = "#b8b8b8";
const REACTIVITY_NONPOSITIVE_COLOR = "#dbeef8";

function percentile(values, quantile) {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.min(lower + 1, sorted.length - 1);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function positiveReactivityColor(norm) {
  const value = Math.max(0, Math.min(1, norm));
  const start = [255, 242, 0];
  const end = [215, 25, 28];
  const channels = start.map((channel, index) => (
    Math.round(channel + (end[index] - channel) * value)
  ));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function normalizeReactivityProfile(values) {
  if (!Array.isArray(values) && !(ArrayBuffer.isView(values) && !(values instanceof DataView))) {
    throw new TypeError("Reactivity values must be an Array or TypedArray");
  }
  const rawValues = Array.from(values);
  const positives = rawValues.filter((value) => Number.isFinite(value) && value > 0);
  const cap = percentile(positives, 0.95);
  const byPosition = new Map();
  let missingCount = 0;
  let nonpositiveCount = 0;
  let positiveCount = 0;
  let cappedCount = 0;

  rawValues.forEach((raw, index) => {
    let norm = 0;
    let state = REACTIVITY_STATES.MISSING;
    let color = REACTIVITY_MISSING_COLOR;
    if (Number.isFinite(raw) && raw <= 0) {
      state = REACTIVITY_STATES.NONPOSITIVE;
      color = REACTIVITY_NONPOSITIVE_COLOR;
      nonpositiveCount += 1;
    } else if (Number.isFinite(raw)) {
      state = REACTIVITY_STATES.POSITIVE;
      norm = cap > 0 ? Math.min(raw / cap, 1) : 0;
      color = positiveReactivityColor(norm);
      positiveCount += 1;
      if (norm >= 1) cappedCount += 1;
    } else {
      missingCount += 1;
    }
    byPosition.set(index + 1, { raw, norm, state, color });
  });

  return {
    cap,
    byPosition,
    mappedCount: nonpositiveCount + positiveCount,
    missingCount,
    nonpositiveCount,
    positiveCount,
    cappedCount,
  };
}

export function publicTechniqueFilterStatus({
  active,
  hitCount,
  totalCount,
  metadataAvailable,
}) {
  if (!Number.isInteger(totalCount) || totalCount < 0) {
    throw new TypeError("totalCount must be a non-negative integer");
  }
  if (!Number.isInteger(hitCount) || hitCount < 0) {
    throw new TypeError("hitCount must be a non-negative integer");
  }
  if (hitCount > totalCount) {
    throw new RangeError("hitCount cannot exceed totalCount");
  }
  if (!metadataAvailable) return "Technique metadata unavailable";
  if (!active) return `显示全部 ${totalCount} 个 Profile`;
  if (hitCount === 0) return "无匹配 Profile";
  return `匹配 ${hitCount} 个 Profile；请在 Profile 下拉列表中选择`;
}

const PROFILE_PUBLIC_TECHNIQUES_TOP_FIELDS = [
  "schemaVersion",
  "pdbId",
  "authChain",
  "profileCount",
  "profiles",
];
const PROFILE_PUBLIC_TECHNIQUES_PROFILE_FIELDS = ["profileId", "classificationStatus", "methods"];
const PROFILE_PUBLIC_TECHNIQUES_METHOD_FIELDS = [
  "label",
  "mappingStatus",
  "categoryId",
  "categoryLabel",
  "categoryShortLabel",
];
const PROFILE_PUBLIC_TECHNIQUES_STATUSES = new Set([
  "mapped",
  "partially_mapped",
  "unmapped",
  "background",
  "missing",
]);
const PROFILE_PUBLIC_TECHNIQUES_MAPPING_STATUSES = new Set(["mapped", "unmapped"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlainObject(value) {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactFields(value, expectedFields, path) {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  const expected = new Set(expectedFields);
  for (const field of Object.keys(value)) {
    if (!expected.has(field)) throw new Error(`${path} has unknown field "${field}"`);
  }
  for (const field of expectedFields) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      throw new Error(`${path} is missing field "${field}"`);
    }
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertStrictIdentity(value, fieldPath) {
  if (!isNonEmptyString(value) || value.trim() !== value) {
    throw new Error(`${fieldPath} must be a non-empty string without surrounding whitespace`);
  }
}

const LOCAL_GEOMETRY_TOP_FIELDS = ["schemaVersion", "caseId", "chainId", "source", "residues"];
const LOCAL_GEOMETRY_SOURCE_FIELDS = [
  "tool",
  "toolVersion",
  "containerImage",
  "containerImageId",
  "command",
  "structureSha256",
  "dssrInputSha256",
  "modelId",
  "modelPolicy",
  "altlocPolicy",
];
const LOCAL_GEOMETRY_RESIDUE_FIELDS = ["residueKey", "position", "base", "locator", "pucker", "stacking"];
const LOCAL_GEOMETRY_LOCATOR_FIELDS = [
  "modelId",
  "labelAsymId",
  "authAsymId",
  "labelSeqId",
  "authSeqId",
  "insertionCode",
  "componentId",
];
const LOCAL_GEOMETRY_PARTNER_FIELDS = [
  "partnerResidueKey",
  "partnerLocator",
  "partnerPosition",
  "partnerBase",
  "topology",
  "dssrStackClass",
  "overlapArea",
  "ringOverlapArea",
  "sourcePairIndex",
];
const LOCAL_GEOMETRY_CONTEXT_FIELDS = ["caseId", "chainId", "residues"];
const LOCAL_GEOMETRY_CONTEXT_RESIDUE_FIELDS = ["residueKey", "position", "base", "locator"];
const LOCAL_GEOMETRY_CONTEXT_LOCATOR_FIELDS = [
  "labelAsymId",
  "authAsymId",
  "labelSeqId",
  "authSeqId",
  "insertionCode",
  "componentId",
];
const LOCAL_GEOMETRY_TOPOLOGIES = new Set([
  "three_prime_adjacent",
  "five_prime_adjacent",
  "non_adjacent_intrachain",
  "interchain",
]);
const LOCAL_GEOMETRY_DSSR_STACK_CLASS = /^(?:pm|mp|mm|pp)\((?:>>|<<|><|<>),(?:forward|backward|inward|outward)\)$/;
const LOCAL_GEOMETRY_CANONICAL_COMPONENTS = new Set(["A", "C", "G", "U", "T", "I", "N"]);

function assertFiniteNumber(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${path} must be a finite number`);
  }
}

function assertPositiveInteger(value, path) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${path} must be a positive integer`);
  }
}

function validateLocalGeometryLocator(locator, path, { allowNullLabelSeq = false } = {}) {
  assertExactFields(locator, LOCAL_GEOMETRY_LOCATOR_FIELDS, path);
  for (const field of ["modelId", "labelAsymId", "authAsymId", "componentId"]) {
    assertStrictIdentity(locator[field], `${path}.${field}`);
  }
  if (!(allowNullLabelSeq && locator.labelSeqId === null)) {
    assertPositiveInteger(locator.labelSeqId, `${path}.labelSeqId`);
  }
  if (!Number.isInteger(locator.authSeqId)) {
    throw new TypeError(`${path}.authSeqId must be an integer`);
  }
  if (typeof locator.insertionCode !== "string" || locator.insertionCode.trim() !== locator.insertionCode) {
    throw new TypeError(`${path}.insertionCode must be a string without surrounding whitespace`);
  }
}

function validateLocalGeometryContextLocator(locator, path) {
  assertExactFields(locator, LOCAL_GEOMETRY_CONTEXT_LOCATOR_FIELDS, path);
  for (const field of ["labelAsymId", "authAsymId", "componentId"]) {
    assertStrictIdentity(locator[field], `${path}.${field}`);
  }
  const parseInteger = (value, field, positive) => {
    const pattern = positive ? /^[1-9]\d*$/ : /^-?(?:0|[1-9]\d*)$/;
    const normalized = typeof value === "string" && pattern.test(value) ? Number(value) : value;
    if (!Number.isInteger(normalized) || (positive && normalized < 1)) {
      throw new TypeError(`${path}.${field} must be ${positive ? "a positive integer" : "an integer"}`);
    }
    return normalized;
  };
  const labelSeqId = parseInteger(locator.labelSeqId, "labelSeqId", true);
  const authSeqId = parseInteger(locator.authSeqId, "authSeqId", false);
  if (typeof locator.insertionCode !== "string" || locator.insertionCode.trim() !== locator.insertionCode) {
    throw new TypeError(`${path}.insertionCode must be a string without surrounding whitespace`);
  }
  return { ...locator, labelSeqId, authSeqId };
}

function validateLocalGeometrySource(source) {
  const path = "Local geometry sidecar source";
  assertExactFields(source, LOCAL_GEOMETRY_SOURCE_FIELDS, path);
  for (const field of LOCAL_GEOMETRY_SOURCE_FIELDS) {
    assertStrictIdentity(source[field], `${path}.${field}`);
  }
  if (!/^[0-9a-f]{64}$/.test(source.structureSha256)) {
    throw new Error(`${path}.structureSha256 must be a lowercase SHA-256 digest`);
  }
  if (!/^[0-9a-f]{64}$/.test(source.dssrInputSha256)) {
    throw new Error(`${path}.dssrInputSha256 must be a lowercase SHA-256 digest`);
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(source.containerImageId)) {
    throw new Error(`${path}.containerImageId must be a sha256 image id`);
  }
  if (source.modelPolicy !== "first_atom_site_model") {
    throw new Error(`${path}.modelPolicy must be "first_atom_site_model"`);
  }
  if (source.altlocPolicy !== "preserve_input_altlocs_dssr_managed") {
    throw new Error(`${path}.altlocPolicy must be "preserve_input_altlocs_dssr_managed"`);
  }
}

function validateLocalGeometryPucker(pucker, path) {
  if (!isRecord(pucker)) throw new TypeError(`${path} must be an object`);
  if (pucker.status === "computed") {
    assertExactFields(pucker, ["status", "class", "phaseDeg", "amplitudeDeg"], path);
    assertStrictIdentity(pucker.class, `${path}.class`);
    assertFiniteNumber(pucker.phaseDeg, `${path}.phaseDeg`);
    assertFiniteNumber(pucker.amplitudeDeg, `${path}.amplitudeDeg`);
    return;
  }
  if (pucker.status === "not_computable") {
    assertExactFields(pucker, ["status", "reason"], path);
    assertStrictIdentity(pucker.reason, `${path}.reason`);
    return;
  }
  throw new Error(`${path}.status must be "computed" or "not_computable"`);
}

function localGeometryLocatorIdentity(locator) {
  return LOCAL_GEOMETRY_LOCATOR_FIELDS.map((field) => JSON.stringify(locator[field])).join("|");
}

function validateLocalGeometryPartner(partner, path, sourceModelId) {
  assertExactFields(partner, LOCAL_GEOMETRY_PARTNER_FIELDS, path);
  if (!LOCAL_GEOMETRY_TOPOLOGIES.has(partner.topology)) {
    throw new Error(`${path}.topology has invalid value "${partner.topology}"`);
  }
  validateLocalGeometryLocator(partner.partnerLocator, `${path}.partnerLocator`, {
    allowNullLabelSeq: partner.topology === "interchain",
  });
  if (partner.partnerLocator.modelId !== sourceModelId) {
    throw new Error(`${path}.partnerLocator.modelId must match source.modelId`);
  }
  assertStrictIdentity(partner.partnerBase, `${path}.partnerBase`);
  assertStrictIdentity(partner.dssrStackClass, `${path}.dssrStackClass`);
  if (!LOCAL_GEOMETRY_DSSR_STACK_CLASS.test(partner.dssrStackClass)) {
    throw new Error(`${path}.dssrStackClass must use DSSR pm/mp/mm/pp stacking syntax`);
  }
  assertFiniteNumber(partner.overlapArea, `${path}.overlapArea`);
  assertFiniteNumber(partner.ringOverlapArea, `${path}.ringOverlapArea`);
  if (!Number.isInteger(partner.sourcePairIndex) || partner.sourcePairIndex < 0) {
    throw new TypeError(`${path}.sourcePairIndex must be a non-negative integer`);
  }
  if (partner.topology === "interchain") {
    if (partner.partnerResidueKey !== null || partner.partnerPosition !== null) {
      throw new Error(`${path} interchain partnerResidueKey and partnerPosition must be null`);
    }
    return;
  }
  assertStrictIdentity(partner.partnerResidueKey, `${path} same-chain partnerResidueKey`);
  assertPositiveInteger(partner.partnerPosition, `${path} same-chain partnerPosition`);
}

function validateLocalGeometryStacking(stacking, path, sourceModelId) {
  if (!isRecord(stacking)) throw new TypeError(`${path} must be an object`);
  if (stacking.status === "not_computable") {
    assertExactFields(stacking, ["status", "reason"], path);
    assertStrictIdentity(stacking.reason, `${path}.reason`);
    return;
  }
  if (stacking.status !== "computed") {
    throw new Error(`${path}.status must be "computed" or "not_computable"`);
  }
  assertExactFields(stacking, ["status", "partners"], path);
  if (!Array.isArray(stacking.partners)) throw new TypeError(`${path}.partners must be an array`);
  const seenPartners = new Set();
  stacking.partners.forEach((partner, partnerIndex) => {
    const partnerPath = `${path}.partners[${partnerIndex}]`;
    validateLocalGeometryPartner(partner, partnerPath, sourceModelId);
    const identity = `${localGeometryLocatorIdentity(partner.partnerLocator)}|${partner.dssrStackClass}`;
    if (seenPartners.has(identity)) {
      throw new Error(`${path} contains duplicate stacking partner identity and DSSR class`);
    }
    seenPartners.add(identity);
  });
}

function localGeometryDeepReadonly(value) {
  if (Array.isArray(value)) return Object.freeze(value.map((item) => localGeometryDeepReadonly(item)));
  if (!isRecord(value)) return value;
  const copy = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    copy[field] = localGeometryDeepReadonly(fieldValue);
  }
  return Object.freeze(copy);
}

function localGeometryReadonlyMap(entries) {
  const map = new Map(entries);
  const safeBoundMethods = new Set(["get", "has", "keys", "values", "entries", Symbol.iterator]);
  const readonlyMutation = () => {
    throw new TypeError("Local geometry residue index is read-only");
  };
  let readonlyMap;
  readonlyMap = new Proxy(map, {
    get(target, property) {
      if (property === "set" || property === "delete" || property === "clear") return readonlyMutation;
      if (property === "valueOf") return () => readonlyMap;
      if (property === "forEach") {
        return (callback, thisArg) => target.forEach(
          (value, key) => callback.call(thisArg, value, key, readonlyMap),
        );
      }
      if (safeBoundMethods.has(property)) return Reflect.get(target, property, target).bind(target);
      if (property === "size") return Reflect.get(target, property, target);
      return Reflect.get(target, property, readonlyMap);
    },
  });
  return Object.freeze(readonlyMap);
}

function assertMatchingLocalPartner(residue, partner, byResidueKey, path) {
  if (partner.topology === "interchain") {
    const partnerLocatorIdentity = localGeometryLocatorIdentity(partner.partnerLocator);
    const matchesCurrentChain = [...byResidueKey.values()].some(
      (target) => localGeometryLocatorIdentity(target.locator) === partnerLocatorIdentity,
    );
    if (matchesCurrentChain) {
      throw new Error(`${path} interchain partner locator must not belong to the current chain`);
    }
    return;
  }
  const target = byResidueKey.get(partner.partnerResidueKey);
  if (!target) throw new Error(`${path} same-chain partnerResidueKey is not present in residue coverage`);
  if (target.position !== partner.partnerPosition) {
    throw new Error(`${path} same-chain partnerPosition does not match the referenced residue`);
  }
  if (target.base !== partner.partnerBase) {
    throw new Error(`${path} same-chain partnerBase does not match the referenced residue`);
  }
  if (localGeometryLocatorIdentity(target.locator) !== localGeometryLocatorIdentity(partner.partnerLocator)) {
    throw new Error(`${path} same-chain partnerLocator does not match the referenced residue`);
  }
  const positionDelta = target.position - residue.position;
  const expectedTopology = positionDelta === 1
    ? "three_prime_adjacent"
    : positionDelta === -1
      ? "five_prime_adjacent"
      : "non_adjacent_intrachain";
  if (partner.topology !== expectedTopology) {
    throw new Error(`${path}.topology must be "${expectedTopology}" for this same-chain position relationship`);
  }
  if (target.residueKey === residue.residueKey) {
    throw new Error(`${path} must not reference the residue itself as a stacking partner`);
  }
}

export function validateLocalGeometrySidecar(payload, context) {
  if (payload === undefined || payload === null) throw new Error("Local geometry sidecar is required");
  assertExactFields(payload, LOCAL_GEOMETRY_TOP_FIELDS, "Local geometry sidecar");
  if (payload.schemaVersion !== LOCAL_GEOMETRY_SCHEMA) {
    throw new Error(`Invalid local geometry schemaVersion "${payload.schemaVersion}"`);
  }
  if (!isRecord(context)) throw new TypeError("Local geometry context must be an object");
  assertExactFields(context, LOCAL_GEOMETRY_CONTEXT_FIELDS, "Local geometry context");
  assertStrictIdentity(payload.caseId, "Local geometry sidecar caseId");
  assertStrictIdentity(payload.chainId, "Local geometry sidecar chainId");
  assertStrictIdentity(context.caseId, "Local geometry context caseId");
  assertStrictIdentity(context.chainId, "Local geometry context chainId");
  if (payload.caseId !== context.caseId) {
    throw new Error(`Local geometry caseId must exactly match context caseId "${context.caseId}"`);
  }
  if (payload.chainId !== context.chainId) {
    throw new Error(`Local geometry chainId must exactly match context chainId "${context.chainId}"`);
  }
  if (!Array.isArray(context.residues)) {
    throw new TypeError("Local geometry context residues must be an array");
  }
  if (!Array.isArray(payload.residues)) throw new TypeError("Local geometry sidecar residues must be an array");
  validateLocalGeometrySource(payload.source);

  const contextByResidueKey = new Map();
  const contextPositions = new Set();
  context.residues.forEach((residue, index) => {
    const path = `Local geometry context residue ${index}`;
    assertExactFields(residue, LOCAL_GEOMETRY_CONTEXT_RESIDUE_FIELDS, path);
    assertStrictIdentity(residue.residueKey, `${path}.residueKey`);
    assertPositiveInteger(residue.position, `${path}.position`);
    assertStrictIdentity(residue.base, `${path}.base`);
    const locator = validateLocalGeometryContextLocator(residue.locator, `${path}.locator`);
    const normalizedResidue = { ...residue, locator };
    if (locator.labelSeqId !== residue.position) {
      throw new Error(`${path}.locator.labelSeqId must match context residue position`);
    }
    if (locator.authAsymId !== context.chainId) {
      throw new Error(`${path}.locator.authAsymId must match context chainId`);
    }
    if (contextByResidueKey.has(residue.residueKey)) {
      throw new Error(`Local geometry context contains duplicate residueKey "${residue.residueKey}"`);
    }
    if (contextPositions.has(residue.position)) {
      throw new Error(`Local geometry context contains duplicate residue position ${residue.position}`);
    }
    contextByResidueKey.set(residue.residueKey, normalizedResidue);
    contextPositions.add(residue.position);
  });

  const byResidueKey = new Map();
  const positions = new Set();
  let previousResidue = null;
  payload.residues.forEach((residue, index) => {
    const path = `Local geometry residue ${index}`;
    assertExactFields(residue, LOCAL_GEOMETRY_RESIDUE_FIELDS, path);
    assertStrictIdentity(residue.residueKey, `${path}.residueKey`);
    assertPositiveInteger(residue.position, `${path}.position`);
    assertStrictIdentity(residue.base, `${path}.base`);
    validateLocalGeometryLocator(residue.locator, `${path}.locator`);
    if (residue.locator.modelId !== payload.source.modelId) {
      throw new Error(`${path}.locator.modelId must match source.modelId`);
    }
    if (residue.locator.authAsymId !== payload.chainId) {
      throw new Error(`${path}.locator.authAsymId must match sidecar chainId`);
    }
    if (residue.locator.labelSeqId !== residue.position) {
      throw new Error(`${path}.locator.labelSeqId must match residue position`);
    }
    validateLocalGeometryPucker(residue.pucker, `${path}.pucker`);
    validateLocalGeometryStacking(residue.stacking, `${path}.stacking`, payload.source.modelId);
    if (byResidueKey.has(residue.residueKey)) {
      throw new Error(`Local geometry contains duplicate residueKey "${residue.residueKey}"`);
    }
    if (positions.has(residue.position)) {
      throw new Error(`Local geometry contains duplicate residue position ${residue.position}`);
    }
    if (previousResidue
      && (residue.position < previousResidue.position
        || (residue.position === previousResidue.position && residue.residueKey < previousResidue.residueKey))) {
      throw new Error("Local geometry residues must be ordered by position and residueKey");
    }
    previousResidue = residue;
    positions.add(residue.position);
    byResidueKey.set(residue.residueKey, residue);

    const expected = contextByResidueKey.get(residue.residueKey);
    if (!expected) return;
    if (residue.position !== expected.position) {
      throw new Error(`Local geometry context residue position must exactly match ${path}.position`);
    }
    if (residue.base !== expected.base) {
      throw new Error(`Local geometry context residue base must exactly match ${path}.base`);
    }
    for (const field of LOCAL_GEOMETRY_CONTEXT_LOCATOR_FIELDS) {
      if (residue.locator[field] !== expected.locator[field]) {
        const isModifiedComponentMapping = field === "componentId"
          && (expected.locator.componentId === expected.base || expected.locator.componentId === "N")
          && !LOCAL_GEOMETRY_CANONICAL_COMPONENTS.has(residue.locator.componentId);
        if (isModifiedComponentMapping) continue;
        throw new Error(`Local geometry context residue locator.${field} must exactly match ${path}.locator.${field}`);
      }
    }
  });

  const missing = context.residues
    .map((residue) => residue.residueKey)
    .filter((residueKey) => !byResidueKey.has(residueKey));
  const extra = payload.residues
    .map((residue) => residue.residueKey)
    .filter((residueKey) => !contextByResidueKey.has(residueKey));
  if (missing.length || extra.length) {
    throw new Error(
      `Local geometry residue coverage mismatch; missing: ${missing.join(", ") || "none"};`
      + ` extra: ${extra.join(", ") || "none"}`,
    );
  }

  payload.residues.forEach((residue, residueIndex) => {
    if (residue.stacking.status !== "computed") return;
    residue.stacking.partners.forEach((partner, partnerIndex) => {
      assertMatchingLocalPartner(
        residue,
        partner,
        byResidueKey,
        `Local geometry residue ${residueIndex}.stacking.partners[${partnerIndex}]`,
      );
    });
  });

  const source = localGeometryDeepReadonly(payload.source);
  const orderedResidues = localGeometryDeepReadonly(payload.residues);
  const readonlyByResidueKey = localGeometryReadonlyMap(
    orderedResidues.map((residue) => [residue.residueKey, residue]),
  );
  return Object.freeze({
    schemaVersion: payload.schemaVersion,
    caseId: payload.caseId,
    chainId: payload.chainId,
    source,
    residues: orderedResidues,
    orderedResidues,
    byResidueKey: readonlyByResidueKey,
  });
}

export function buildLocalGeometryWindow(model, selectedResidueKey, radius = 5) {
  if (!isRecord(model) || !Array.isArray(model.orderedResidues) || !(model.byResidueKey instanceof Map)) {
    throw new TypeError("Local geometry model must contain orderedResidues and a byResidueKey Map");
  }
  assertStrictIdentity(selectedResidueKey, "Local geometry selected residue key");
  if (!Number.isInteger(radius) || radius < 0 || radius > 5) {
    throw new RangeError("Local geometry radius must be an integer from 0 through 5");
  }
  const selectedResidue = model.byResidueKey.get(selectedResidueKey);
  if (!selectedResidue) throw new Error(`Local geometry selected residue "${selectedResidueKey}" is unavailable`);
  const selectedIndex = model.orderedResidues.findIndex((residue) => residue.residueKey === selectedResidueKey);
  if (selectedIndex < 0) throw new Error(`Local geometry selected residue "${selectedResidueKey}" is not ordered`);
  const residues = Object.freeze(model.orderedResidues.slice(
    Math.max(0, selectedIndex - radius),
    Math.min(model.orderedResidues.length, selectedIndex + radius + 1),
  ));
  const windowKeys = new Set(residues.map((residue) => residue.residueKey));
  const partners = selectedResidue.stacking.status === "computed" ? selectedResidue.stacking.partners : [];
  const withinWindowPartners = Object.freeze(
    partners.filter((partner) => partner.partnerResidueKey !== null && windowKeys.has(partner.partnerResidueKey)),
  );
  const sameChainOutsideWindowPartners = Object.freeze(
    partners.filter((partner) => partner.partnerResidueKey !== null && !windowKeys.has(partner.partnerResidueKey)),
  );
  const crossChainPartners = Object.freeze(
    partners.filter((partner) => partner.partnerResidueKey === null),
  );
  return Object.freeze({
    selectedResidueKey,
    selectedResidue,
    radius,
    residues,
    withinWindowPartners,
    sameChainOutsideWindowPartners,
    crossChainPartners,
  });
}

export function parseCaseMatrixFamilyQuery(search = "") {
  const params = new URLSearchParams(search);
  const families = params.getAll("family");
  if (families.length === 0) return null;
  if (families.length !== 1) throw new Error("Case matrix family must appear exactly once");
  const [family] = families;
  if (family !== "E" && family !== "F") throw new Error(`Invalid Case matrix family "${family}"`);
  return family;
}

export function resolveCaseViewMode({ manifest, chainId, requestedFamily = null } = {}) {
  if (!isRecord(manifest) || !isRecord(manifest.chains)) {
    throw new TypeError("Case manifest must contain a chains object");
  }
  assertStrictIdentity(chainId, "Case manifest selected chain id");
  if (!Object.prototype.hasOwnProperty.call(manifest.chains, chainId)) {
    throw new Error(`Case manifest missing selected chain ${chainId}`);
  }
  const chain = manifest.chains[chainId];
  if (!isRecord(chain)) throw new Error(`Case manifest selected chain ${chainId} must be an object`);
  if (chain.chainId !== chainId) {
    throw new Error(`Case manifest chains.${chainId}.chainId must equal the selected chain`);
  }

  if (requestedFamily === null) {
    return { mode: "profiles", family: null, matrixField: null };
  }
  if (requestedFamily !== "E" && requestedFamily !== "F") {
    throw new Error(`Unsupported Case matrix family "${requestedFamily}"`);
  }

  const matrixField = requestedFamily === "F" ? "efMatrixPathF" : "efMatrixPath";
  assertStrictIdentity(chain[matrixField], `Case manifest chains.${chainId}.${matrixField}`);
  return { mode: "matrix", family: requestedFamily, matrixField };
}

function validatePublicTechniqueCategories(categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new TypeError("Profile public technique categories must be a non-empty array");
  }
  const categoryById = new Map();
  const orderedCategories = [];
  categories.forEach((category, index) => {
    if (!isRecord(category)) throw new TypeError(`Profile public technique category ${index} must be an object`);
    for (const field of ["id", "label", "shortLabel"]) {
      if (!isNonEmptyString(category[field])) {
        throw new Error(`Profile public technique category ${index} has invalid ${field}`);
      }
    }
    if (categoryById.has(category.id)) {
      throw new Error(`Duplicate category id "${category.id}" in profile public technique taxonomy`);
    }
    const publicCategory = {
      id: category.id,
      label: category.label,
      shortLabel: category.shortLabel,
    };
    categoryById.set(category.id, publicCategory);
    orderedCategories.push(publicCategory);
  });
  return { categoryById, orderedCategories };
}

function validateProfileIndex(profileIndex) {
  if (!isRecord(profileIndex) || !Array.isArray(profileIndex.profiles)) {
    throw new TypeError("Case profile index must contain a profiles array");
  }
  const profileIds = [];
  const seen = new Set();
  profileIndex.profiles.forEach((profile, index) => {
    if (!isRecord(profile) || !isNonEmptyString(profile.profile_id)) {
      throw new Error(`Case profile index profile ${index} has invalid profile_id`);
    }
    if (seen.has(profile.profile_id)) {
      throw new Error(`Case profile index contains duplicate profile_id "${profile.profile_id}"`);
    }
    seen.add(profile.profile_id);
    profileIds.push(profile.profile_id);
  });
  return profileIds;
}

function validatePublicTechniqueMethod(
  method,
  profileId,
  methodIndex,
  categoryById,
  classifyTechniqueToken,
) {
  const path = `Profile "${profileId}" method ${methodIndex}`;
  assertExactFields(method, PROFILE_PUBLIC_TECHNIQUES_METHOD_FIELDS, path);
  if (!isNonEmptyString(method.label)) throw new Error(`${path} has invalid method label`);
  if (!PROFILE_PUBLIC_TECHNIQUES_MAPPING_STATUSES.has(method.mappingStatus)) {
    throw new Error(`${path} has invalid mappingStatus "${method.mappingStatus}"`);
  }

  if (method.mappingStatus === "unmapped") {
    for (const field of ["categoryId", "categoryLabel", "categoryShortLabel"]) {
      if (method[field] !== null) throw new Error(`${path} ${field} must be null when unmapped`);
    }
  } else {
    for (const field of ["categoryId", "categoryLabel", "categoryShortLabel"]) {
      if (!isNonEmptyString(method[field])) throw new Error(`${path} has invalid ${field}`);
    }
    const category = categoryById.get(method.categoryId);
    if (!category) throw new Error(`${path} has unknown categoryId "${method.categoryId}"`);
    if (method.categoryLabel !== category.label) {
      throw new Error(`${path} categoryLabel does not match category "${method.categoryId}"`);
    }
    if (method.categoryShortLabel !== category.shortLabel) {
      throw new Error(`${path} categoryShortLabel does not match category "${method.categoryId}"`);
    }
  }

  let classified;
  try {
    classified = classifyTechniqueToken(method.label);
  } catch (error) {
    throw new Error(`${path} classifyTechniqueToken failed: ${error?.message || error}`);
  }
  try {
    assertExactFields(classified, PROFILE_PUBLIC_TECHNIQUES_METHOD_FIELDS, "Classifier method record");
    if (!isNonEmptyString(classified.label)) throw new Error("classifier method label is invalid");
    if (!PROFILE_PUBLIC_TECHNIQUES_MAPPING_STATUSES.has(classified.mappingStatus)) {
      throw new Error("classifier mappingStatus is invalid");
    }
    if (classified.mappingStatus === "unmapped") {
      for (const field of ["categoryId", "categoryLabel", "categoryShortLabel"]) {
        if (classified[field] !== null) throw new Error(`classifier ${field} must be null when unmapped`);
      }
    } else {
      const classifiedCategory = categoryById.get(classified.categoryId);
      if (!classifiedCategory) throw new Error(`classifier categoryId "${classified.categoryId}" is unknown`);
      if (classified.categoryLabel !== classifiedCategory.label) {
        throw new Error("classifier categoryLabel does not match the injected categories");
      }
      if (classified.categoryShortLabel !== classifiedCategory.shortLabel) {
        throw new Error("classifier categoryShortLabel does not match the injected categories");
      }
    }
  } catch (error) {
    throw new Error(`${path} has malformed classifyTechniqueToken result: ${error?.message || error}`);
  }

  if (classified.mappingStatus !== method.mappingStatus) {
    throw new Error(
      `${path} ${method.mappingStatus} method "${method.label}" was classified as ${classified.mappingStatus}`,
    );
  }
  if (classified.label !== method.label) {
    const classifierLabelKind = classified.mappingStatus === "mapped" ? "canonical label" : "label";
    throw new Error(
      `${path} ${method.mappingStatus} method label "${method.label}"`
      + ` must equal classifier ${classifierLabelKind} "${classified.label}"`,
    );
  }
  for (const field of ["categoryId", "categoryLabel", "categoryShortLabel"]) {
    if (classified[field] !== method[field]) {
      throw new Error(`${path} classifier ${field} does not match the sidecar method`);
    }
  }
}

function validatePublicTechniqueStatus(profile, mappedMethodCount) {
  const { classificationStatus, methods, profileId } = profile;
  if (classificationStatus === "mapped" && (methods.length === 0 || mappedMethodCount !== methods.length)) {
    throw new Error(`Profile "${profileId}" mapped status is inconsistent with methods`);
  }
  if (
    classificationStatus === "partially_mapped"
    && (methods.length === 0 || mappedMethodCount === 0 || mappedMethodCount === methods.length)
  ) {
    throw new Error(`Profile "${profileId}" partially_mapped status is inconsistent with methods`);
  }
  if (classificationStatus === "unmapped" && (methods.length === 0 || mappedMethodCount !== 0)) {
    throw new Error(`Profile "${profileId}" unmapped status is inconsistent with methods`);
  }
  if ((classificationStatus === "background" || classificationStatus === "missing") && methods.length !== 0) {
    throw new Error(`Profile "${profileId}" ${classificationStatus} status requires empty methods`);
  }
}

export function buildPublicTechniqueModel(validatedPayload, categories) {
  const { orderedCategories } = validatePublicTechniqueCategories(categories);
  const orderedProfileIds = [];
  const profileMeta = new Map();

  for (const profile of validatedPayload.profiles) {
    const methods = profile.methods.map((method) => ({ ...method }));
    const mappedCategoryIds = new Set(
      methods
        .filter((method) => method.mappingStatus === "mapped")
        .map((method) => method.categoryId),
    );
    const publicCategories = orderedCategories
      .filter((category) => mappedCategoryIds.has(category.id))
      .map((category) => ({ ...category }));
    const categoryIds = new Set(publicCategories.map((category) => category.id));
    const methodLabels = new Set(methods.map((method) => method.label));

    orderedProfileIds.push(profile.profileId);
    profileMeta.set(profile.profileId, {
      profileId: profile.profileId,
      classificationStatus: profile.classificationStatus,
      methods,
      methodLabels,
      categoryIds,
      categories: publicCategories,
    });
  }

  return {
    schemaVersion: validatedPayload.schemaVersion,
    pdbId: validatedPayload.pdbId,
    authChain: validatedPayload.authChain,
    profileCount: validatedPayload.profileCount,
    orderedProfileIds,
    profileMeta,
  };
}

export function buildUnavailablePublicTechniqueModel(profileIndex) {
  const orderedProfileIds = validateProfileIndex(profileIndex);
  const profileMeta = new Map();
  for (const profileId of orderedProfileIds) {
    profileMeta.set(profileId, {
      profileId,
      classificationStatus: "missing",
      methods: [],
      methodLabels: new Set(),
      categoryIds: new Set(),
      categories: [],
    });
  }
  return {
    schemaVersion: null,
    pdbId: null,
    authChain: null,
    profileCount: orderedProfileIds.length,
    orderedProfileIds,
    profileMeta,
  };
}

export function buildPublicTechniqueFilterOptions(model, categories) {
  const { orderedCategories } = validatePublicTechniqueCategories(categories);
  if (!isRecord(model) || !Array.isArray(model.orderedProfileIds) || !(model.profileMeta instanceof Map)) {
    throw new TypeError("Profile public technique model is invalid");
  }

  const availableCategoryIds = new Set();
  const methods = [];
  const seenMethods = new Set();
  for (const profileId of model.orderedProfileIds) {
    const meta = model.profileMeta.get(profileId);
    if (!isRecord(meta) || !(meta.categoryIds instanceof Set) || !Array.isArray(meta.methods)) {
      throw new TypeError(`Profile public technique model is missing metadata for "${profileId}"`);
    }
    for (const categoryId of meta.categoryIds) availableCategoryIds.add(categoryId);
    for (const method of meta.methods) {
      if (method.mappingStatus !== "mapped" || seenMethods.has(method.label)) continue;
      seenMethods.add(method.label);
      methods.push(method.label);
    }
  }

  return {
    categories: orderedCategories.map((category) => ({
      ...category,
      enabled: availableCategoryIds.has(category.id),
    })),
    methods,
  };
}

export function validateProfilePublicTechniques(payload, profileIndex, context) {
  if (payload === undefined || payload === null) {
    throw new Error("Profile public techniques sidecar is required");
  }
  if (!isRecord(payload)) throw new TypeError("Profile public techniques sidecar must be an object");
  assertExactFields(payload, PROFILE_PUBLIC_TECHNIQUES_TOP_FIELDS, "Profile public techniques sidecar");
  if (payload.schemaVersion !== PROFILE_PUBLIC_TECHNIQUES_SCHEMA) {
    throw new Error(`Invalid profile public techniques schemaVersion "${payload.schemaVersion}"`);
  }
  if (!isRecord(context)) throw new TypeError("Profile public techniques context must be an object");
  assertStrictIdentity(payload.pdbId, "Profile public techniques sidecar pdbId");
  assertStrictIdentity(context.pdbId, "Profile public techniques context pdbId");
  assertStrictIdentity(payload.authChain, "Profile public techniques sidecar authChain");
  assertStrictIdentity(context.authChain, "Profile public techniques context authChain");
  if (typeof context.classifyTechniqueToken !== "function") {
    throw new TypeError("Profile public techniques context classifyTechniqueToken must be a function");
  }
  if (payload.pdbId !== context.pdbId) {
    throw new Error(`Profile public techniques pdbId must exactly match context pdbId "${context.pdbId}"`);
  }
  if (payload.authChain !== context.authChain) {
    throw new Error(`Profile public techniques authChain must exactly match context authChain "${context.authChain}"`);
  }
  if (!Number.isInteger(payload.profileCount) || payload.profileCount < 0) {
    throw new Error("Profile public techniques profileCount must be a non-negative integer");
  }
  if (!Array.isArray(payload.profiles)) throw new TypeError("Profile public techniques profiles must be an array");

  const { categoryById } = validatePublicTechniqueCategories(context.categories);
  const indexProfileIds = validateProfileIndex(profileIndex);
  if (payload.profileCount !== payload.profiles.length || payload.profileCount !== indexProfileIds.length) {
    throw new Error(
      `Profile public techniques profileCount ${payload.profileCount} must match sidecar profiles ${payload.profiles.length}`
      + ` and profile index profiles ${indexProfileIds.length}`,
    );
  }

  const sidecarProfileIds = [];
  const seenProfileIds = new Set();
  payload.profiles.forEach((profile, profileIndexPosition) => {
    const path = `Profile public techniques profile ${profileIndexPosition}`;
    assertExactFields(profile, PROFILE_PUBLIC_TECHNIQUES_PROFILE_FIELDS, path);
    if (!isNonEmptyString(profile.profileId)) throw new Error(`${path} has invalid profileId`);
    if (seenProfileIds.has(profile.profileId)) {
      throw new Error(`Profile public techniques contains duplicate profileId "${profile.profileId}"`);
    }
    seenProfileIds.add(profile.profileId);
    sidecarProfileIds.push(profile.profileId);
  });

  const indexProfileIdSet = new Set(indexProfileIds);
  const missing = indexProfileIds.filter((profileId) => !seenProfileIds.has(profileId));
  const extra = sidecarProfileIds.filter((profileId) => !indexProfileIdSet.has(profileId));
  if (missing.length || extra.length) {
    throw new Error(
      `Profile public techniques coverage mismatch; missing: ${missing.join(", ") || "none"};`
      + ` extra: ${extra.join(", ") || "none"}`,
    );
  }
  for (let index = 0; index < indexProfileIds.length; index += 1) {
    if (sidecarProfileIds[index] !== indexProfileIds[index]) {
      throw new Error(
        `Profile public techniques profile order mismatch at index ${index}:`
        + ` expected "${indexProfileIds[index]}", received "${sidecarProfileIds[index]}"`,
      );
    }
  }

  payload.profiles.forEach((profile) => {
    if (!PROFILE_PUBLIC_TECHNIQUES_STATUSES.has(profile.classificationStatus)) {
      throw new Error(`Profile "${profile.profileId}" has invalid classificationStatus "${profile.classificationStatus}"`);
    }
    if (!Array.isArray(profile.methods)) {
      throw new TypeError(`Profile "${profile.profileId}" methods must be an array`);
    }
    const methodLabels = new Set();
    let mappedMethodCount = 0;
    profile.methods.forEach((method, methodIndex) => {
      validatePublicTechniqueMethod(
        method,
        profile.profileId,
        methodIndex,
        categoryById,
        context.classifyTechniqueToken,
      );
      if (methodLabels.has(method.label)) {
        throw new Error(`Profile "${profile.profileId}" contains duplicate method label "${method.label}"`);
      }
      methodLabels.add(method.label);
      if (method.mappingStatus === "mapped") mappedMethodCount += 1;
    });
    validatePublicTechniqueStatus(profile, mappedMethodCount);
  });

  return buildPublicTechniqueModel(payload, context.categories);
}

function publicTechniqueSelectionSet(selection, dimension) {
  if (!Object.prototype.hasOwnProperty.call(selection, dimension)) return new Set();
  const selected = selection[dimension];
  let selectedValues;
  try {
    selectedValues = Set.prototype.values.call(selected);
  } catch {
    throw new TypeError(`Profile public technique selection ${dimension} must be a Set`);
  }
  const normalized = new Set(selectedValues);
  for (const value of normalized) {
    if (!isNonEmptyString(value)) {
      throw new TypeError(`Profile public technique selection ${dimension} must contain non-empty strings`);
    }
  }
  return normalized;
}

export function applyPublicTechniqueFilter(model, selection) {
  const normalizedSelection = selection === undefined ? {} : selection;
  if (!isPlainObject(normalizedSelection)) {
    throw new TypeError("Profile public technique selection must be a plain object");
  }
  const allowedFields = new Set(["categories", "methods"]);
  for (const field of Reflect.ownKeys(normalizedSelection)) {
    if (typeof field !== "string" || !allowedFields.has(field)) {
      throw new Error(`Profile public technique selection has unknown selection field "${String(field)}"`);
    }
  }
  const categories = publicTechniqueSelectionSet(normalizedSelection, "categories");
  const methods = publicTechniqueSelectionSet(normalizedSelection, "methods");
  if (categories.size === 0 && methods.size === 0) return new Set(model.orderedProfileIds);

  const matches = new Set();
  for (const profileId of model.orderedProfileIds) {
    const meta = model.profileMeta.get(profileId);
    const categoryMatch = [...meta.categoryIds].some((categoryId) => categories.has(categoryId));
    const methodMatch = [...meta.methodLabels].some((methodLabel) => methods.has(methodLabel));
    if (categoryMatch || methodMatch) matches.add(profileId);
  }
  return matches;
}

function profilePublicLabelBase(profile) {
  for (const value of [
    profile?.pair_id,
    profile?.label,
    profile?.profile_label,
    profile?.display_label,
    profile?.profile_id,
  ]) {
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  return "Profile";
}

export function profilePublicTechniqueLabel(profile, meta) {
  const base = profilePublicLabelBase(profile);
  const methodLabels = Array.isArray(meta?.methods)
    ? meta.methods.map((method) => method.label).filter((label) => isNonEmptyString(label))
    : [];

  if (meta?.classificationStatus === "background") return `${base} | Background / control`;
  if (meta?.classificationStatus === "missing") return `${base} | Technique metadata unavailable`;
  if (meta?.classificationStatus === "unmapped") {
    const methods = methodLabels.length ? `${methodLabels.join(", ")} | ` : "";
    return `${base} | ${methods}Technique category unavailable`;
  }
  if (methodLabels.length) return `${base} | ${methodLabels.join(", ")}`;
  return `${base} | Technique metadata unavailable`;
}

function validatePublicProfileSelectorItems(selectorItems) {
  if (!Array.isArray(selectorItems)) {
    throw new TypeError("Public profile selector items must be an array");
  }
  const seenProfileIds = new Set();
  selectorItems.forEach((item, position) => {
    if (!isRecord(item)) throw new TypeError(`Public profile selector item ${position} must be an object`);
    if (item.index !== position) {
      throw new Error(`Public profile selector item index must equal ordered position ${position}`);
    }
    if (!isNonEmptyString(item.profileId)) {
      throw new Error(`Public profile selector item ${position} has invalid profileId`);
    }
    if (seenProfileIds.has(item.profileId)) {
      throw new Error(`Public profile selector items contain duplicate profileId "${item.profileId}"`);
    }
    seenProfileIds.add(item.profileId);
    if (!isNonEmptyString(item.label)) {
      throw new Error(`Public profile selector item ${position} has invalid label`);
    }
    if (!Array.isArray(item.categories)) {
      throw new TypeError(`Public profile selector item ${position} categories must be an array`);
    }
  });
  return selectorItems;
}

export function buildPublicProfileSelectorItems(profiles, publicTechniqueModel) {
  const profileIds = validateProfileIndex({ profiles });
  if (
    !isRecord(publicTechniqueModel)
    || !Array.isArray(publicTechniqueModel.orderedProfileIds)
    || !(publicTechniqueModel.profileMeta instanceof Map)
  ) {
    throw new TypeError("Public profile selector requires a valid public technique model");
  }
  if (
    publicTechniqueModel.profileCount !== profileIds.length
    || publicTechniqueModel.orderedProfileIds.length !== profileIds.length
    || publicTechniqueModel.profileMeta.size !== profileIds.length
  ) {
    throw new Error("Public profile selector profile count does not match the public technique model");
  }

  const selectorItems = profiles.map((profile, index) => {
    const profileId = profileIds[index];
    if (publicTechniqueModel.orderedProfileIds[index] !== profileId) {
      throw new Error(
        `Public profile selector profileId order mismatch at index ${index}:`
        + ` expected "${profileId}", received "${publicTechniqueModel.orderedProfileIds[index]}"`,
      );
    }
    const meta = publicTechniqueModel.profileMeta.get(profileId);
    if (!isRecord(meta) || meta.profileId !== profileId || !Array.isArray(meta.categories)) {
      throw new Error(`Public profile selector metadata mismatch for profileId "${profileId}"`);
    }
    return {
      index,
      profileId,
      label: profilePublicTechniqueLabel(profile, meta),
      categories: meta.categories.map((category) => ({ ...category })),
    };
  });
  return validatePublicProfileSelectorItems(selectorItems);
}

export function buildPublicProfileSelectMarkup(selectorItems) {
  return validatePublicProfileSelectorItems(selectorItems).map((item) => (
    `<option value="${item.index}">${esc(item.label)}</option>`
  )).join("");
}

function validatePublicProfileOptionElements(selectorItems, optionElements) {
  const items = validatePublicProfileSelectorItems(selectorItems);
  if (!Array.isArray(optionElements) || optionElements.length !== items.length) {
    throw new Error("Public profile selector custom option count does not match selector items");
  }
  optionElements.forEach((option, index) => {
    if (
      String(option?.dataset?.index) !== String(items[index].index)
      || option?.dataset?.profileId !== items[index].profileId
    ) {
      throw new Error(`Public profile selector custom option identity mismatch at index ${index}`);
    }
  });
  return items;
}

export function mountPublicProfileSelectorDom(selectorItems, { document, select }) {
  const items = validatePublicProfileSelectorItems(selectorItems);
  if (!document || typeof document.createElement !== "function") {
    throw new TypeError("Public profile selector requires a document adapter");
  }
  if (!select?.parentElement || typeof select.insertAdjacentElement !== "function") {
    throw new TypeError("Public profile selector requires a mounted native select");
  }

  const existing = select.parentElement.querySelector?.(".profile-dropdown");
  if (existing) {
    const trigger = existing.querySelector?.(".profile-dropdown-trigger");
    const list = existing.querySelector?.(".profile-dropdown-list");
    const optionElements = list ? Array.from(list.querySelectorAll("li[role='option']")) : [];
    if (!trigger || !list) throw new Error("Existing public profile selector DOM is incomplete");
    validatePublicProfileOptionElements(items, optionElements);
    select.hidden = true;
    return { root: existing, trigger, list, optionElements };
  }

  const root = document.createElement("div");
  root.className = "profile-dropdown";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "profile-dropdown-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", "Profile selector");
  const list = document.createElement("ul");
  list.className = "profile-dropdown-list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Profile options");
  list.hidden = true;
  root.append(trigger, list);

  const optionElements = items.map((item) => {
    const option = document.createElement("li");
    option.setAttribute("role", "option");
    option.dataset.index = String(item.index);
    option.dataset.profileId = item.profileId;
    option.tabIndex = -1;
    option.title = item.label;
    option.innerHTML = `${categoryBadgeMarkup({ categories: item.categories })}`
      + `<span class="profile-dropdown-text">${esc(item.label)}</span>`;
    list.appendChild(option);
    return option;
  });
  validatePublicProfileOptionElements(items, optionElements);

  select.insertAdjacentElement("afterend", root);
  select.hidden = true;
  return { root, trigger, list, optionElements };
}

export function applyPublicProfileSelectorVisibility(
  selectorItems,
  optionElements,
  hitProfileIds,
  active,
) {
  const items = validatePublicProfileOptionElements(selectorItems, optionElements);
  let hits = new Set();
  if (active) {
    try {
      hits = new Set(Set.prototype.values.call(hitProfileIds));
    } catch {
      throw new TypeError("Active public profile selector filter requires a Set of profile ids");
    }
  }
  items.forEach((item, index) => {
    const option = optionElements[index];
    const hidden = Boolean(active) && !hits.has(item.profileId);
    option.classList.toggle("filtered-out", hidden);
    if (hidden) option.setAttribute("aria-hidden", "true");
    else option.removeAttribute("aria-hidden");
  });
  return optionElements;
}

export function selectPublicProfileSelectorOption(selectorItems, select, optionElement) {
  const items = validatePublicProfileSelectorItems(selectorItems);
  const index = Number(optionElement?.dataset?.index);
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    throw new Error("Public profile selector option has an invalid index");
  }
  const item = items[index];
  if (optionElement.dataset.profileId !== item.profileId) {
    throw new Error(`Public profile selector option identity mismatch at index ${index}`);
  }
  if (!select || !("value" in select)) {
    throw new TypeError("Public profile selector option requires a native select backing");
  }
  select.value = String(item.index);
  return item;
}

export function resolvePublicProfileSelector(profileIndex, sidecarResult, context) {
  let error = sidecarResult?.error || null;
  let model = null;
  if (!error) {
    try {
      model = validateProfilePublicTechniques(sidecarResult?.payload, profileIndex, context);
    } catch (validationError) {
      error = validationError;
    }
  }
  if (error) {
    if (!(error instanceof Error)) error = new Error(String(error));
    model = buildUnavailablePublicTechniqueModel(profileIndex);
  }
  return {
    model,
    selectorItems: buildPublicProfileSelectorItems(profileIndex?.profiles, model),
    error,
  };
}

export function categoryBadgeMarkup(meta, { fullLabel = false } = {}) {
  if (!Array.isArray(meta?.categories) || meta.categories.length === 0) return "";
  const seen = new Set();
  return meta.categories.map((category) => {
    if (!isRecord(category) || seen.has(category.id)) return "";
    seen.add(category.id);
    const visibleLabel = fullLabel ? category.label : category.shortLabel;
    return `<span class="category-badge" data-category="${esc(category.id)}"`
      + ` title="${esc(category.label)}">${esc(visibleLabel)}</span>`;
  }).join("");
}

export function buildCaseProfileDownloadItems(profileIndex, profileIndexUrl = "./profiles/profile-index.json.gz") {
  const shards = profileIndex?.shards;
  if (!shards || typeof shards !== "object" || Array.isArray(shards)) {
    throw new TypeError("Case profile index must contain a shards object");
  }
  const filenameFor = (href, fallback) => {
    const clean = String(href || "").split(/[?#]/)[0];
    return clean.split("/").filter(Boolean).at(-1) || fallback;
  };
  const items = [{
    kind: "index",
    label: "Profile index",
    href: String(profileIndexUrl),
    filename: filenameFor(profileIndexUrl, "profile-index.json.gz"),
  }];
  Object.keys(shards).sort().forEach((shardId) => {
    const shard = shards[shardId] || {};
    if (!shard.gzip_path || !shard.meta_path) {
      throw new Error(`Profile shard ${shardId} is missing values or metadata`);
    }
    items.push({
      kind: "values",
      label: `Profile values ${shardId}`,
      href: String(shard.gzip_path),
      filename: filenameFor(shard.gzip_path, `${shardId}.f32.bin.gz`),
    });
    items.push({
      kind: "meta",
      label: `Profile metadata ${shardId}`,
      href: String(shard.meta_path),
      filename: filenameFor(shard.meta_path, `${shardId}.meta.json.gz`),
    });
  });
  return items;
}
