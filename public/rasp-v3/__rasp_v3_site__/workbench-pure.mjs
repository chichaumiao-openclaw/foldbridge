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
