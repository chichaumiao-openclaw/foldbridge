import test from 'node:test';
import assert from 'node:assert/strict';
import { createPdbCitationStore, normalizePrimaryCitation } from '../src/pdbCitationStore.js';

const primaryCitation = {
  rcsb_primary_citation: {
    title: 'Structural Insights into Riboswitch Control of the Biosynthesis of Queuosine',
    rcsb_authors: ['Kang, M.', 'Peterson, R.D.', 'Feigon, J.'],
    rcsb_journal_abbrev: 'Mol Cell',
    journal_volume: '33',
    page_first: '784',
    page_last: '790',
    pdbx_database_id_PubMed: 19285444,
    pdbx_database_id_DOI: 'https://doi.org/10.1016/j.molcel.2009.02.019',
    year: 2009,
  },
};

test('normalizes an RCSB primary citation for display', () => {
  assert.deepEqual(normalizePrimaryCitation(primaryCitation), {
    title: 'Structural Insights into Riboswitch Control of the Biosynthesis of Queuosine',
    authors: ['Kang, M.', 'Peterson, R.D.', 'Feigon, J.'],
    journal: 'Mol Cell',
    volume: '33',
    pageFirst: '784',
    pageLast: '790',
    year: '2009',
    doi: '10.1016/j.molcel.2009.02.019',
    pubmedId: '19285444',
  });
});

test('loads a generated static citation index and tolerates unavailable records', async () => {
  let calls = 0;
  const store = createPdbCitationStore({
    assetUrl: './citation-index.json',
    fetchImpl: async (url) => {
      calls += 1;
      assert.equal(url, './citation-index.json');
      return { ok: true, json: async () => ({
        citations: {
          '2L1V': normalizePrimaryCitation(primaryCitation),
        },
      }) };
    },
  });

  const [first, second] = await Promise.all([
    store.loadPrimaryCitation('2l1v'),
    store.loadPrimaryCitation('2L1V'),
  ]);
  assert.equal(calls, 1);
  assert.equal(first?.pubmedId, '19285444');
  assert.deepEqual(second, first);

  const unavailable = await createPdbCitationStore({
    fetchImpl: async () => ({ ok: false, status: 404 }),
  }).loadPrimaryCitation('xxxx');
  assert.equal(unavailable, null);
});
