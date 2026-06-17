export const DEFAULT_ANNOJOIN_ATLAS_BASE = './src/assets/generated/annojoin-atlas';

function joinAssetUrl(baseUrl, relPath) {
  return `${String(baseUrl).replace(/\/$/, '')}/${String(relPath).replace(/^\//, '')}`;
}

export function createAnnojointAtlasStore({
  baseUrl = DEFAULT_ANNOJOIN_ATLAS_BASE,
  fetcher = globalThis.fetch?.bind(globalThis)
} = {}) {
  if (!fetcher) {
    throw new Error('[annojoinAtlasStore] fetch is not available');
  }

  let indexPromise = null;
  const caseCache = new Map();
  const routePageCache = new Map();

  async function loadJson(relPath) {
    const url = joinAssetUrl(baseUrl, relPath);
    const response = await fetcher(url);
    if (!response?.ok) {
      throw new Error(`[annojoinAtlasStore] failed to load ${url} (${response?.status || 'no-response'})`);
    }
    return response.json();
  }

  async function loadIndex() {
    if (!indexPromise) indexPromise = loadJson('index.json');
    return indexPromise;
  }

  async function loadCase(caseId) {
    const normalizedCaseId = String(caseId ?? '').trim();
    if (!normalizedCaseId) throw new Error('[annojoinAtlasStore] caseId is required');
    if (!caseCache.has(normalizedCaseId)) {
      caseCache.set(normalizedCaseId, loadJson(`cases/${encodeURIComponent(normalizedCaseId)}.json`));
    }
    return caseCache.get(normalizedCaseId);
  }

  async function loadRoutePage(path) {
    const normalizedPath = String(path ?? '').trim();
    if (!normalizedPath) throw new Error('[annojoinAtlasStore] route page path is required');
    if (!routePageCache.has(normalizedPath)) {
      routePageCache.set(normalizedPath, loadJson(normalizedPath));
    }
    return routePageCache.get(normalizedPath);
  }

  return { loadIndex, loadCase, loadRoutePage };
}
