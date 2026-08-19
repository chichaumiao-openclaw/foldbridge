import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTRY_TABLE_COLUMNS,
  normalizeEntryRows,
  entryCaseHref
} from '../src/entryTable.js';

test('normalizeEntryRows reads the v1 payload rows', () => {
  const payload = {
    schemaVersion: 'entry-table.v1',
    rowCount: 2,
    rows: [
      { pdb_id: '10FZ', auth: 'A', chain_key: 'A[A]', sci_name: 'E. coli 16S rRNA', partition: 'rRNA', n_profiles: 67 },
      { pdb_id: '10PX', auth: '1v', chain_key: 'AB[1v]', sci_name: 'oligo', partition: 'mRNA', n_profiles: 0 }
    ]
  };
  const rows = normalizeEntryRows(payload);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].pdbId, '10FZ');
  assert.equal(rows[0].auth, 'A');
  assert.equal(rows[0].chainKey, 'A[A]');
  assert.equal(rows[0].sciName, 'E. coli 16S rRNA');
  assert.equal(rows[0].partition, 'rRNA');
  assert.equal(rows[0].nProfiles, 67);
});

test('normalizeEntryRows tolerates missing/empty payload', () => {
  assert.deepEqual(normalizeEntryRows(null), []);
  assert.deepEqual(normalizeEntryRows({}), []);
  assert.deepEqual(normalizeEntryRows({ rows: 'nope' }), []);
});

test('entryCaseHref points to in-site entry-case hash route with chain query', () => {
  const row = { pdbId: '7SYS', auth: 'z', chainKey: 'I[z]' };
  assert.equal(
    entryCaseHref('./public/entry-cases', row),
    '#entry-case?pdb=7SYS&chain=z'
  );
});

test('entryCaseHref url-encodes pdb and chain query params', () => {
  const row = { pdbId: 'A B', auth: 'a/b', chainKey: 'x' };
  const href = entryCaseHref('./base', row);
  // 桥接路由：pdb 与 chain 均用 encodeURIComponent（空格→%20，/→%2F）
  assert.equal(href, '#entry-case?pdb=A%20B&chain=a%2Fb');
});

test('entryCaseHref returns empty string when pdb or auth missing', () => {
  assert.equal(entryCaseHref('./base', { pdbId: '', auth: 'A' }), '');
  assert.equal(entryCaseHref('./base', { pdbId: '7SYS', auth: '' }), '');
});

test('ENTRY_TABLE_COLUMNS is the frozen display column order', () => {
  assert.ok(Array.isArray(ENTRY_TABLE_COLUMNS));
  assert.ok(ENTRY_TABLE_COLUMNS.length >= 1);
});
