const SEARCH_FILTER_KEYS = ['type', 'tag'];

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
    if (Array.isArray(value)) {
      const cleaned = value.filter(Boolean);
      if (cleaned.length === 1) normalized[key] = cleaned[0];
      if (cleaned.length > 1) normalized[key] = cleaned;
    } else if (value) {
      normalized[key] = value;
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
