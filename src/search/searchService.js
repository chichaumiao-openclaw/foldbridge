const SEARCH_FILTER_KEYS = ['type', 'tag', 'technique'];

const TECHNIQUE_FILTER_OPTIONS = [
  { value: 'dms', label: 'DMS-based methods', facets: ['dms-based-probing'] },
  { value: 'shape', label: 'SHAPE-based methods', facets: ['shape-based-probing'] },
  { value: 'cleavage', label: 'Cleavage-based methods', facets: ['enzymatic-probing', 'cleavage-footprinting'] },
  { value: 'nucleotide', label: 'Nucleotide-specific chemical probing methods', facets: ['carbodiimide', 'guanine-specific-probing'] },
  { value: 'interaction', label: 'RNA–RNA interaction mapping methods', facets: ['rna-protein-interaction'] }
];

const RNA_TYPE_FILTER_OPTIONS = [
  { value: 'rrna', label: 'rRNA' },
  { value: 'trna', label: 'tRNA' },
  { value: 'other_rna', label: 'Other RNA' },
  { value: 'mrna', label: 'mRNA' },
  { value: 'ribozyme', label: 'Ribozyme' },
  { value: 'riboswitch', label: 'Riboswitch' },
  { value: 'snrna', label: 'snRNA' },
  { value: 'viral', label: 'Viral RNA' },
  { value: 'aptamer', label: 'Aptamer' },
  { value: 'synthetic_rna', label: 'Synthetic RNA' },
  { value: 'srp_rna', label: 'SRP RNA' },
  { value: 'designed_rna', label: 'Designed RNA' }
];

export const SEARCH_FILTER_GROUPS = [
  { key: 'technique', options: TECHNIQUE_FILTER_OPTIONS },
  { key: 'type' },
  { key: 'tag', options: RNA_TYPE_FILTER_OPTIONS }
];

const TECHNIQUE_FILTER_BY_VALUE = new Map(TECHNIQUE_FILTER_OPTIONS.map((option) => [option.value, option]));
const RNA_TYPE_FILTER_VALUES = new Set(RNA_TYPE_FILTER_OPTIONS.map((option) => option.value));

export function visibleSearchFilterEntries(filters = {}, key = '') {
  const group = SEARCH_FILTER_GROUPS.find((item) => item.key === key);
  const counts = filters?.[key] ?? {};
  if (group?.options) {
    return group.options.map((option) => ({
      value: option.value,
      label: option.label,
      count: (option.facets ?? [option.value]).reduce((sum, facet) => sum + (Number(counts[facet]) || 0), 0)
    }));
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([value, count]) => ({ value, label: value, count }));
}

export function searchParamsFromHash(hashValue = '') {
  const hash = String(hashValue || '');
  const queryString = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return new URLSearchParams(queryString);
}

export function filtersFromSearchParams(params) {
  const filters = {};

  for (const key of SEARCH_FILTER_KEYS) {
    const values = params.getAll(key).filter(Boolean);
    if (values.length === 1) filters[key] = values[0];
    if (values.length > 1) filters[key] = values;
  }

  return filters;
}

export function buildSearchHash({ q = '', filters = {} } = {}) {
  const params = new URLSearchParams();
  const query = String(q || '').trim();
  if (query) params.set('q', query);

  for (const key of SEARCH_FILTER_KEYS) {
    const value = filters[key];
    const values = Array.isArray(value) ? value : value ? [value] : [];
    for (const item of values.filter(Boolean)) {
      params.append(key, item);
    }
  }

  const queryString = params.toString();
  return queryString ? `#search?${queryString}` : '#search';
}

function normalizeFilters(filters = {}) {
  const normalized = {};
  for (const key of SEARCH_FILTER_KEYS) {
    const value = filters[key];
    const values = (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
    let cleaned = values;
    if (key === 'technique') {
      cleaned = values.flatMap((item) => {
        const option = TECHNIQUE_FILTER_BY_VALUE.get(item);
        if (!option) throw new Error(`Unsupported technique filter: ${item}`);
        return option.facets;
      });
    }
    if (key === 'tag') {
      const unsupported = values.find((item) => !RNA_TYPE_FILTER_VALUES.has(item));
      if (unsupported) throw new Error(`Unsupported RNA tag filter: ${unsupported}`);
    }
    if (cleaned.length) {
      if (cleaned.length === 1) normalized[key] = cleaned[0];
      if (cleaned.length > 1) normalized[key] = cleaned;
    }
  }
  return normalized;
}

function getPagefindBundlePath() {
  if (typeof window === 'undefined') return '/dist/pagefind/pagefind.js';
  const marker = '/dist/';
  const path = window.location.pathname;
  const index = path.indexOf(marker);
  if (index >= 0) return `${path.slice(0, index + marker.length)}pagefind/pagefind.js`;
  return '/dist/pagefind/pagefind.js';
}

async function defaultPagefindLoader() {
  return import(getPagefindBundlePath());
}

function mapResult(data) {
  const tags = String(data.meta?.tags ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    title: data.meta?.title ?? data.title ?? 'Untitled result',
    href: data.meta?.href ?? data.url,
    excerpt: data.excerpt ?? data.plain_excerpt ?? '',
    type: data.meta?.type,
    tags
  };
}

export function createSearchService({ pagefindLoader = defaultPagefindLoader } = {}) {
  let pagefindPromise = null;
  let availableFiltersPromise = null;

  async function getPagefind() {
    if (!pagefindPromise) {
      pagefindPromise = pagefindLoader().then((pagefind) => {
        pagefind.init?.();
        return pagefind;
      });
    }
    return pagefindPromise;
  }

  async function getFilters() {
    if (!availableFiltersPromise) {
      availableFiltersPromise = getPagefind().then((pagefind) => pagefind.filters?.() ?? {});
    }
    return availableFiltersPromise;
  }

  async function search({ q = '', filters = {}, page = 1, pageSize = 10 } = {}) {
    const query = String(q || '').trim();
    const normalizedFilters = normalizeFilters(filters);
    const hasFilters = Object.keys(normalizedFilters).length > 0;
    const availableFilters = await getFilters();

    if (!query && !hasFilters) {
      return {
        query,
        filters: normalizedFilters,
        items: [],
        total: 0,
        unfilteredTotal: 0,
        availableFilters,
        resultFilters: {}
      };
    }

    const pagefind = await getPagefind();
    const raw = await pagefind.search(query || null, { filters: normalizedFilters });
    const start = Math.max(0, (Number(page) - 1) * Number(pageSize));
    const end = start + Number(pageSize);
    const items = await Promise.all(raw.results.slice(start, end).map(async (result) => mapResult(await result.data())));

    return {
      query,
      filters: normalizedFilters,
      items,
      total: raw.results.length,
      unfilteredTotal: raw.unfilteredResultCount ?? raw.results.length,
      availableFilters,
      resultFilters: raw.filters ?? {},
      totalFilters: raw.totalFilters ?? {}
    };
  }

  return {
    getFilters,
    search,
    warm: () => getPagefind()
  };
}
