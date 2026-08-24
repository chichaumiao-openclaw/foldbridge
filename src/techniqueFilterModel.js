export const MECHANISM_FAMILIES = [
  {
    id: 'dms',
    label: 'DMS-based methods',
    shortLabel: 'DMS',
    techniques: ['DMS', 'DMS-seq', 'Structure-seq', 'Structure-seq2', 'Mod-seq', 'DMS-MaPseq', 'DIM-2P-seq', 'tNet-MaPseq'],
    filterTechniques: ['DMS', 'DMS-seq', 'Structure-seq', 'Structure-seq2', 'Mod-seq', 'DMS-MaPseq', 'DIM-2P-seq']
  },
  {
    id: 'shape',
    label: 'SHAPE-based methods',
    shortLabel: 'SHAPE',
    techniques: ['SHAPE', 'SHAPE-Seq', 'SHAPE-MaP', '1M7', 'BzCN', '2A3', 'NAI-MaP', 'icSHAPE', 'icSHAPE-MaP', 'smartSHAPE', 'ChemModSeq', 'Cotranscriptional_SHAPE-seq', 'Nuc-SHAPE-Structure-Seq'],
    filterTechniques: ['SHAPE', 'SHAPE-Seq', 'SHAPE-MaP', 'icSHAPE', 'icSHAPE-MaP', 'NAI-MaP', 'smartSHAPE']
  },
  {
    id: 'cleavage',
    label: 'Cleavage-based methods',
    shortLabel: 'Cleavage',
    techniques: ['PARS', 'PARTE', 'HRF-seq', 'Lead-seq', 'RL-Seq', 'tNet-RNase-seq'],
    filterTechniques: ['PARS', 'PARTE', 'HRF-seq']
  },
  {
    id: 'nucleotide',
    label: 'Nucleotide-specific chemical probing methods',
    shortLabel: 'Nucleotide-specific',
    techniques: ['Keth-seq', 'EDC probing', 'LASER-seq', 'icLASER'],
    filterTechniques: ['Keth-seq', 'EDC probing', 'LASER-seq']
  },
  {
    id: 'interaction',
    label: 'RNA–RNA interaction mapping methods',
    shortLabel: 'RNA–RNA interaction',
    techniques: ['PARIS', 'SPLASH', 'LIGR-seq', 'MARIO', 'RIC-seq', 'COMRADES', 'MOHCA', 'Mutate-and-map methods'],
    filterTechniques: ['PARIS', 'SPLASH', 'LIGR-seq', 'MARIO', 'RIC-seq', 'COMRADES']
  }
];

const normalizeTechniqueName = (name = '') => String(name)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

const TECHNIQUE_TO_FAMILY = new Map();
const TECHNIQUE_CANONICAL_NAMES = new Map();
for (const family of MECHANISM_FAMILIES) {
  for (const name of family.techniques) {
    TECHNIQUE_TO_FAMILY.set(normalizeTechniqueName(name), family.id);
    TECHNIQUE_CANONICAL_NAMES.set(normalizeTechniqueName(name), name);
  }
}

// Existing atlas rows contain a few historical spellings that belong to one
// of the five probing-page families but are not displayed as separate options.
const TECHNIQUE_ALIASES = {
  structureseq: 'Structure-seq',
  cotranscriptionalshapeseq: 'SHAPE-Seq',
  nucshapestructureseq: 'SHAPE-Seq',
  iclaser: 'LASER-seq'
};
for (const [alias, canonical] of Object.entries(TECHNIQUE_ALIASES)) {
  const canonicalKey = normalizeTechniqueName(canonical);
  TECHNIQUE_TO_FAMILY.set(alias, TECHNIQUE_TO_FAMILY.get(canonicalKey));
  TECHNIQUE_CANONICAL_NAMES.set(alias, canonical);
}

const MECHANISM_FAMILY_BY_ID = new Map(MECHANISM_FAMILIES.map((family) => [family.id, family]));

export function mechanismFamilyForTechnique(name = '') {
  const key = normalizeTechniqueName(name);
  const familyId = TECHNIQUE_TO_FAMILY.get(key);
  return familyId ? MECHANISM_FAMILY_BY_ID.get(familyId) : null;
}

export function canonicalTechniqueName(name = '') {
  return TECHNIQUE_CANONICAL_NAMES.get(normalizeTechniqueName(name)) || '';
}

export function mechanismFamiliesForRow(row = {}) {
  const familyIds = new Set();
  for (const id of row.techniqueFamilies || []) {
    if (MECHANISM_FAMILY_BY_ID.has(id)) familyIds.add(id);
  }
  for (const name of row.techniqueNames || []) {
    const family = mechanismFamilyForTechnique(name);
    if (family) familyIds.add(family.id);
  }
  return MECHANISM_FAMILIES.map((family) => family.id).filter((id) => familyIds.has(id));
}

export function buildMechanismFilterModel() {
  return {
    families: MECHANISM_FAMILIES.map((family) => ({
      ...family,
      techniques: [...family.filterTechniques]
    }))
  };
}

export function buildTechniqueFilterModel(cases = []) {
  const byFamily = new Map();
  for (const row of cases) {
    const fams = mechanismFamiliesForRow(row);
    const names = row.techniqueNames || [];
    for (const fam of fams) {
      if (!byFamily.has(fam)) byFamily.set(fam, new Set());
    }
    for (const fam of fams) {
      for (const name of names) {
        if (mechanismFamilyForTechnique(name)?.id === fam) byFamily.get(fam).add(name);
      }
    }
  }
  const families = MECHANISM_FAMILIES.filter((family) => byFamily.has(family.id)).map((family) => ({
    id: family.id,
    techniques: [...byFamily.get(family.id)].sort()
  }));
  return { families };
}

export function matchesTechniqueFilter(row, selection = {}) {
  const famSel = selection.families || new Set();
  const techSel = selection.techniques || new Set();
  if (famSel.size === 0 && techSel.size === 0) return true;
  const fams = row.techniqueFamilies || [];
  const names = row.techniqueNames || [];
  if (fams.some((f) => famSel.has(f)) || mechanismFamiliesForRow(row).some((f) => famSel.has(f))) return true;
  if (names.some((n) => techSel.has(n) || techSel.has(canonicalTechniqueName(n)))) return true;
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
