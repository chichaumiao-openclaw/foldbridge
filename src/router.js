const ALLOWED_ROUTES = new Set([
  'home',
  'browse',
  'sequence',
  'structure',
  'probing',
  'download',
  'search',
  'download-sequences',
  'download-structures',
  'detail',
  'publications',
  'help',
  'sequence-detail',
  'pdb-case',
  'annojoin-atlas',
  'annojoin-case'
]);

export function normalizeRoute(value) {
  if (typeof value !== 'string') return 'home';
  const lowered = value.trim().toLowerCase();
  return ALLOWED_ROUTES.has(lowered) ? lowered : 'home';
}

export function parseHashRoute(hashValue) {
  if (typeof hashValue !== 'string' || hashValue.length === 0) {
    return { route: 'home', params: new URLSearchParams() };
  }

  const withoutHash = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue;
  const [routeOnly = 'home', queryString = ''] = withoutHash.split('?');
  return {
    route: normalizeRoute(routeOnly),
    params: new URLSearchParams(queryString)
  };
}

export function routeFromHash(hashValue) {
  return parseHashRoute(hashValue).route;
}

export function buildPdbCaseHash({ pdbId, pdbReferenceId, bundleProfileId, rmdbUniqueId } = {}) {
  const normalizedPdbId = String(pdbId ?? '').trim().toUpperCase();
  const params = new URLSearchParams();
  if (normalizedPdbId) params.set('pdbId', normalizedPdbId);
  if (pdbReferenceId) params.set('pdbReferenceId', String(pdbReferenceId).trim());
  if (bundleProfileId) params.set('bundleProfileId', String(bundleProfileId).trim());
  if (rmdbUniqueId) params.set('rmdbUniqueId', String(rmdbUniqueId).trim());
  const query = params.toString();
  return query ? `#pdb-case?${query}` : '#pdb-case';
}
