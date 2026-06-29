import { LOCAL_PAGES_BRIDGE_MANIFEST } from './assets/generated/local_pages_bridge_manifest.js';

function encodeCaseKey(caseKey = '') {
  return encodeURIComponent(String(caseKey || '').trim());
}

function normalizeCaseKey({ atlasCaseKey = '', assetFamily = '', caseUid = '', caseId = '', pdbId = '' } = {}) {
  const normalizedCaseKey = String(atlasCaseKey || '').trim();
  if (normalizedCaseKey.startsWith('RMDB2PDB:') || normalizedCaseKey.startsWith('RASP2PDB:')) {
    return normalizedCaseKey;
  }
  const normalizedCaseUid = String(caseUid || '').trim();
  if (normalizedCaseUid.startsWith('RMDB2PDB|')) {
    const [, suffix = ''] = normalizedCaseUid.split('|', 2);
    return suffix ? `RMDB2PDB:${String(suffix).trim().toUpperCase()}` : normalizedCaseKey;
  }
  const normalizedAssetFamily = String(assetFamily || '').trim();
  if (!['RMDB2PDB', 'RASP2PDB'].includes(normalizedAssetFamily)) return normalizedCaseKey;
  const suffix = String(caseId || pdbId || '').trim().toUpperCase();
  return suffix ? `${normalizedAssetFamily}:${suffix}` : normalizedCaseKey;
}

function universeSlug(caseKey = '') {
  if (String(caseKey).startsWith('RMDB2PDB:')) return 'rmdb';
  if (String(caseKey).startsWith('RASP2PDB:')) return 'rasp';
  return '';
}

function normalizeOriginBaseUrl(value = '') {
  return String(value || '').trim().replace(/\/$/, '');
}

function isPlaceholderOriginBaseUrl(value = '') {
  return !value || value.includes('LOCAL_PAGES_HOST_TODO');
}

const CASE_KEY_TO_ENTRIES = new Map();
const CASE_KEY_TO_SELECTOR = new Map();
for (const entry of LOCAL_PAGES_BRIDGE_MANIFEST.entries || []) {
  const publicBasePath = String(entry.publicBasePath || '').trim().replace(/\/$/, '');
  if (!publicBasePath) continue;
  for (const caseKey of entry.builtCaseKeys || []) {
    const normalizedCaseKey = String(caseKey || '').trim();
    if (!normalizedCaseKey.startsWith('RMDB2PDB:') && !normalizedCaseKey.startsWith('RASP2PDB:')) continue;
    if (!CASE_KEY_TO_ENTRIES.has(normalizedCaseKey)) {
      CASE_KEY_TO_ENTRIES.set(normalizedCaseKey, []);
    }
    CASE_KEY_TO_ENTRIES.get(normalizedCaseKey).push({
      familyId: String(entry.familyId || '').trim(),
      publicBasePath,
      universe: String(entry.universe || '').trim(),
    });
  }
}
for (const [caseKey, duplicate] of Object.entries(LOCAL_PAGES_BRIDGE_MANIFEST.duplicateCases || {})) {
  const normalizedCaseKey = String(caseKey || '').trim();
  const selectorPath = String(duplicate?.selectorPath || '').trim();
  if (!normalizedCaseKey || !selectorPath) continue;
  CASE_KEY_TO_SELECTOR.set(normalizedCaseKey, selectorPath);
}

export function resolveLocalPagesBridgeDetailHref(input = '') {
  const normalizedCaseKey = typeof input === 'string'
    ? normalizeCaseKey({ atlasCaseKey: input })
    : normalizeCaseKey(input);
  const entries = CASE_KEY_TO_ENTRIES.get(normalizedCaseKey) || [];
  if (!entries.length) return '';
  const originBaseUrl = normalizeOriginBaseUrl(LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl);
  if (isPlaceholderOriginBaseUrl(originBaseUrl)) return '';
  if (entries.length === 1) {
    return `${originBaseUrl}${entries[0].publicBasePath}/cases/${encodeCaseKey(normalizedCaseKey)}/index.html`;
  }
  const selectorPath = CASE_KEY_TO_SELECTOR.get(normalizedCaseKey);
  if (selectorPath) return `${originBaseUrl}${selectorPath}`;
  const universe = universeSlug(normalizedCaseKey);
  if (!universe) return '';
  const selectorBasePath = String(LOCAL_PAGES_BRIDGE_MANIFEST.selectorBasePath || '/selector').replace(/\/$/, '');
  return `${originBaseUrl}${selectorBasePath}/${universe}/${encodeCaseKey(normalizedCaseKey)}/index.html`;
}

export function hasLocalPagesBridgeDetailPage(atlasCaseKey = '') {
  return Boolean(resolveLocalPagesBridgeDetailHref(atlasCaseKey));
}
