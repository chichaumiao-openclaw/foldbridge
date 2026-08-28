// workbench-pure.mjs — DOM-free pure helpers, importable by node --test AND workbench.js.
// workbench.js keeps its own escapeHtml (DOM-adjacent); this module carries an
// independent esc() so the module stays importable without any browser globals.
export function esc(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export const PROFILE_PUBLIC_TECHNIQUES_SCHEMA = "profile-public-techniques.v1";

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

export function categoryBadgeMarkup(meta) {
  if (!Array.isArray(meta?.categories) || meta.categories.length === 0) return "";
  const seen = new Set();
  return meta.categories.map((category) => {
    if (!isRecord(category) || seen.has(category.id)) return "";
    seen.add(category.id);
    return `<span class="public-technique-category-badge" data-category="${esc(category.id)}"`
      + ` title="${esc(category.label)}">${esc(category.shortLabel)}</span>`;
  }).join("");
}

// Join case-level confidence-evidence rows to the chain's profiles by technology.
// rows come from the case-root confidence-evidence.json (the only chain-reachable
// technology source; chain config/data files carry family only, no technology).
// Filter to the active chain, key by trackProfileId (falls back to profileKey) so
// the dropdown/filter can look up technology by workbench profile_id.
export function joinTechniqueByProfile(rows, chainId) {
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  rows.forEach((row) => {
    if (!row || (chainId != null && row.chain !== chainId)) return;
    const key = row.trackProfileId || row.profileKey;
    if (!key) return;
    map.set(String(key), { technology: row.technology || "", family: row.family || "" });
  });
  return map;
}

// Render a colored family badge span. Uses data-family for CSS color hook
// (--family-a..d tokens); empty/unknown family renders a neutral "unassigned"
// badge so every profile stays visually consistent.
export function familyBadgeMarkup(family) {
  const f = String(family || "").toUpperCase();
  const label = f || "?";
  return `<span class="family-badge" data-family="${esc(f)}">${esc(label)}</span>`;
}

export function buildTechniqueFilterModel(rows, chainId) {
  const techniquesByFamily = new Map();
  const profileMeta = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || (chainId != null && row.chain !== chainId)) return;
    const fam = String(row.family || "").toUpperCase();
    const tech = row.technology || "";
    const pid = row.trackProfileId || row.profileKey;
    if (fam) {
      if (!techniquesByFamily.has(fam)) techniquesByFamily.set(fam, new Set());
      if (tech) techniquesByFamily.get(fam).add(tech);
    }
    if (pid) profileMeta.set(String(pid), { family: fam, technology: tech });
  });
  const families = [...techniquesByFamily.keys()].sort();
  return {
    families,
    techniquesByFamily: new Map([...techniquesByFamily].map(([k, v]) => [k, [...v]])),
    profileMeta,
  };
}
export function applyTechniqueFilter(model, selection) {
  const fams = selection?.families || new Set();
  const techs = selection?.techniques || new Set();
  const all = new Set(model.profileMeta.keys());
  if (!fams.size && !techs.size) return all;
  const hit = new Set();
  model.profileMeta.forEach((meta, pid) => {
    if (fams.has(meta.family) || techs.has(meta.technology)) hit.add(pid);
  });
  return hit;
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
