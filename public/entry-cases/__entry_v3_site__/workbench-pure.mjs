// workbench-pure.mjs — DOM-free pure helpers, importable by node --test AND workbench.js.
// workbench.js keeps its own escapeHtml (DOM-adjacent); this module carries an
// independent esc() so the module stays importable without any browser globals.
export function esc(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
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
