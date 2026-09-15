import assert from 'node:assert/strict';
import test from 'node:test';

import { ENTRY_TABLE_COLUMNS, normalizeEntryRows } from '../src/entryTable.js';
import { renderEntryTablePage } from '../src/entryTableView.js';

test('Entry table columns omit the Confidence field', () => {
  assert.equal(ENTRY_TABLE_COLUMNS.some((column) => column.id === 'confidenceClass'), false);
  assert.equal(ENTRY_TABLE_COLUMNS.some((column) => column.label === 'Confidence'), false);
});

test('normalizeEntryRows does not expose confidenceClass', () => {
  const [row] = normalizeEntryRows({
    rows: [{ pdb_id: '1AAA', auth: 'A', entry_confidence_class: 'high' }]
  });

  assert.equal('confidenceClass' in row, false);
});

test('rendered Entry table headers omit Confidence', () => {
  const html = renderEntryTablePage({ rows: [{ pdbId: '1AAA', auth: 'A' }] });
  assert.doesNotMatch(html, /<th[^>]*>Confidence<\/th>/);
});
