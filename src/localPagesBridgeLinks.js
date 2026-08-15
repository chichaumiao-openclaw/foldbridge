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

function normalizeOriginBaseUrl(value = '') {
  return String(value || '').trim().replace(/\/$/, '');
}

function isPlaceholderOriginBaseUrl(value = '') {
  return !value || value.includes('LOCAL_PAGES_HOST_TODO');
}

// Per-lane model: every case lives in exactly one lane root, so one flat
// caseKey -> publicBasePath lookup is enough. No selector / duplicate handling.
const CASE_KEY_TO_BASE_PATH = new Map();
for (const entry of LOCAL_PAGES_BRIDGE_MANIFEST.entries || []) {
  const publicBasePath = String(entry.publicBasePath || '').trim().replace(/\/$/, '');
  if (!publicBasePath) continue;
  for (const caseKey of entry.builtCaseKeys || []) {
    const normalizedCaseKey = String(caseKey || '').trim();
    if (!normalizedCaseKey.startsWith('RMDB2PDB:') && !normalizedCaseKey.startsWith('RASP2PDB:')) continue;
    CASE_KEY_TO_BASE_PATH.set(normalizedCaseKey, publicBasePath);
  }
}

export function resolveLocalPagesBridgeDetailHref(input = '') {
  const normalizedCaseKey = typeof input === 'string'
    ? normalizeCaseKey({ atlasCaseKey: input })
    : normalizeCaseKey(input);
  const publicBasePath = CASE_KEY_TO_BASE_PATH.get(normalizedCaseKey);
  if (!publicBasePath) return '';
  const originBaseUrl = normalizeOriginBaseUrl(LOCAL_PAGES_BRIDGE_MANIFEST.originBaseUrl);
  if (isPlaceholderOriginBaseUrl(originBaseUrl)) return '';
  return `${originBaseUrl}${publicBasePath}/cases/${encodeCaseKey(normalizedCaseKey)}/index.html`;
}

export function hasLocalPagesBridgeDetailPage(atlasCaseKey = '') {
  return Boolean(resolveLocalPagesBridgeDetailHref(atlasCaseKey));
}
