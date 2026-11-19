import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeEntryRows } from '../src/entryTable.js';
import { renderEntryTablePage } from '../src/entryTableView.js';
import { buildEntryExport } from '../src/downloadExport.js';

const legacyPayload = {
  rows: [{
    pdb_id: '1ABC',
    auth: 'A',
    sci_name: 'Example RNA',
    partition: 'rRNA',
    n_profiles: 2,
    probing_category: 'shape-based-probing',
    tech_filter: 'SHAPE',
    entry_confidence_class: 'RETIRED_CONFIDENCE_VALUE',
    source_lanes: 'rmdb',
  }],
};

for (const grouped of [false, true]) {
  test(`Entry ${grouped ? 'grouped' : 'flat'} table omits retired confidence headers and cells`, () => {
    const html = renderEntryTablePage({ rows: normalizeEntryRows(legacyPayload), grouped });
    const headers = [...html.matchAll(/<th\b[^>]*>([^<]*)<\/th>/g)].map((match) => match[1]);
    assert.deepEqual(headers, ['Molecule', 'Chain', 'PDB', 'RNA class', 'Technique', 'Profiles', 'Source']);
    assert.doesNotMatch(html, /Confidence|RETIRED_CONFIDENCE_VALUE/);
    assert.match(html, /#entry-case\?pdb=1ABC&amp;chain=A/);
    assert.match(html, /www\.rcsb\.org\/structure\/1ABC/);
    if (grouped) assert.match(html, /colspan="7"/);
  });
}

test('Entry row normalization discards a legacy confidence field', () => {
  const [row] = normalizeEntryRows(legacyPayload);
  assert.equal(Object.hasOwn(row, 'confidenceClass'), false);
  assert.equal(row.pdbId, '1ABC');
  assert.equal(row.nProfiles, 2);
  assert.deepEqual(row.techniqueNames, ['SHAPE']);
});

test('Entry export omits confidence even for a legacy in-memory row', () => {
  const [row] = normalizeEntryRows(legacyPayload);
  const payload = buildEntryExport([{ ...row, confidenceClass: 'RETIRED_CONFIDENCE_VALUE' }]);
  assert.equal(Object.hasOwn(payload.rows[0].entry, 'confidence'), false);
  assert.doesNotMatch(JSON.stringify(payload), /RETIRED_CONFIDENCE_VALUE/);
  assert.equal(payload.rows[0].entry.pdb_id, '1ABC');
  assert.equal(payload.rows[0].profile_meta.profile_count, 2);
});
