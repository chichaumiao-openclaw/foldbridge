import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchHash,
  createSearchService,
  filtersFromSearchParams,
  searchParamsFromHash
} from '../src/search/searchService.js';

test('search hash encodes query and tag filters for shareable search pages', () => {
  const hash = buildSearchHash({
    q: '5KPY aptamer',
    filters: {
      type: 'pdb-case',
      tag: ['aptamer', 'profile']
    }
  });

  assert.equal(hash, '#search?q=5KPY+aptamer&type=pdb-case&tag=aptamer&tag=profile');
});

test('search params parse API-like query shape', () => {
  const params = searchParamsFromHash('#search?q=shape&type=technology&tag=probing&tag=structure');
  const filters = filtersFromSearchParams(params);

  assert.equal(params.get('q'), 'shape');
  assert.deepEqual(filters, {
    type: 'technology',
    tag: ['probing', 'structure']
  });
});

test('central search service wraps Pagefind API and paginates results', async () => {
  const service = createSearchService({
    pagefindLoader: async () => ({
      init() {},
      filters: async () => ({ type: { 'pdb-case': 2 }, tag: { aptamer: 1 } }),
      search: async (query, options) => ({
        results: [
          { data: async () => ({ url: '/dist/search-docs/a.html', meta: { title: 'A', href: '#a' }, excerpt: 'A result' }) },
          { data: async () => ({ url: '/dist/search-docs/b.html', meta: { title: 'B', href: '#b' }, excerpt: 'B result' }) }
        ],
        unfilteredResultCount: 4,
        filters: { type: { 'pdb-case': 2 } },
        totalFilters: { type: { 'pdb-case': 2 } }
      })
    })
  });

  const result = await service.search({ q: 'aptamer', filters: { type: 'pdb-case' }, page: 1, pageSize: 1 });

  assert.equal(result.query, 'aptamer');
  assert.equal(result.total, 2);
  assert.equal(result.unfilteredTotal, 4);
  assert.deepEqual(result.items, [{ title: 'A', href: '#a', excerpt: 'A result', type: undefined, tags: [] }]);
  assert.deepEqual(result.availableFilters, { type: { 'pdb-case': 2 }, tag: { aptamer: 1 } });
});
