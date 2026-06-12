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
  'structure-detail',
  'case-10fz',
  'case-detail'
]);

export function normalizeRoute(value) {
  if (typeof value !== 'string') return 'home';
  const lowered = value.trim().toLowerCase();
  return ALLOWED_ROUTES.has(lowered) ? lowered : 'home';
}

export function routeFromHash(hashValue) {
  if (typeof hashValue !== 'string' || hashValue.length === 0) return 'home';
  const withoutHash = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue;
  const [routeOnly = 'home'] = withoutHash.split('?');
  return normalizeRoute(routeOnly);
}
