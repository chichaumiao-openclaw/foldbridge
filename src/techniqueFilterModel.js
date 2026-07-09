const ALLOWED_FAMILIES = ['A', 'B', 'C', 'D'];

export function buildTechniqueFilterModel(cases = []) {
  const byFamily = new Map();
  for (const row of cases) {
    const fams = row.techniqueFamilies || [];
    const names = row.techniqueNames || [];
    for (const fam of fams) {
      if (!ALLOWED_FAMILIES.includes(fam)) continue;
      if (!byFamily.has(fam)) byFamily.set(fam, new Set());
    }
    for (const fam of fams) {
      if (!ALLOWED_FAMILIES.includes(fam)) continue;
      for (const name of names) byFamily.get(fam).add(name);
    }
  }
  const families = [...byFamily.keys()].sort().map((id) => ({
    id,
    techniques: [...byFamily.get(id)].sort()
  }));
  return { families };
}

export function matchesTechniqueFilter(row, selection = {}) {
  const famSel = selection.families || new Set();
  const techSel = selection.techniques || new Set();
  if (famSel.size === 0 && techSel.size === 0) return true;
  const fams = row.techniqueFamilies || [];
  const names = row.techniqueNames || [];
  if (fams.some((f) => famSel.has(f))) return true;
  if (names.some((n) => techSel.has(n))) return true;
  return false;
}

export function toggleTechniqueSelection(selection, kind, value) {
  const next = {
    families: new Set(selection.families || []),
    techniques: new Set(selection.techniques || [])
  };
  const target = next[kind];
  if (target.has(value)) target.delete(value);
  else target.add(value);
  return next;
}
