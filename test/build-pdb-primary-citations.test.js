import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCitationIndex,
  pdbIdsFromAtlasIndex,
  primaryCitationQuery,
} from '../scripts/build-pdb-primary-citations.mjs';

test('collects valid PDB IDs once and prepares a focused primary-citation query', () => {
  assert.deepEqual(pdbIdsFromAtlasIndex({ displayCases: [
    { pdbId: '2l1v' }, { pdbId: '2L1V' }, { pdbId: 'ABCDE' }, { pdbId: ' 5gag ' },
  ] }), ['2L1V', '5GAG']);
  assert.match(primaryCitationQuery(['2L1V']), /entries\(entry_ids: \["2L1V"\]\)/);
  assert.match(primaryCitationQuery(['2L1V']), /pdbx_database_id_PubMed/);
});

test('builds a primary-citation index while retaining cached records', async () => {
  const citations = await buildCitationIndex({
    pdbIds: ['2L1V', '5GAG'],
    existing: { '2L1V': { title: 'Cached reference' } },
    fetchImpl: async (_url, request) => {
      assert.match(JSON.parse(request.body).query, /5GAG/);
      return {
        ok: true,
        json: async () => ({ data: { entries: [{
          rcsb_id: '5GAG',
          rcsb_primary_citation: {
            title: 'Fetched reference', rcsb_authors: ['Example, A.'], rcsb_journal_abbrev: 'RNA', year: 2020,
          },
        }] } }),
      };
    },
  });
  assert.equal(citations['2L1V'].title, 'Cached reference');
  assert.equal(citations['5GAG'].title, 'Fetched reference');
});
