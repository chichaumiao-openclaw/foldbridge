import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_CASE_IDS } from '../scripts/lib/sample-case-ids.mjs';
import { parseTsv } from '../scripts/lib/rmdb-case-corpus.mjs';

test('sample case ids: 20 unique uppercase pdb ids', () => {
  assert.equal(SAMPLE_CASE_IDS.length, 20);
  assert.equal(new Set(SAMPLE_CASE_IDS).size, 20);
  assert.ok(SAMPLE_CASE_IDS.every((id) => /^[A-Z0-9]{4}$/.test(id)));
});

test('parseTsv: header keyed rows, tab split, trailing newline tolerated', () => {
  const rows = parseTsv('a\tb\tc\n1\t2\t3\n4\t5\t6\n');
  assert.deepEqual(rows, [
    { a: '1', b: '2', c: '3' },
    { a: '4', b: '5', c: '6' }
  ]);
});

test('parseTsv: preserves empty trailing fields', () => {
  const rows = parseTsv('a\tb\tc\n1\t\t\n');
  assert.deepEqual(rows, [{ a: '1', b: '', c: '' }]);
});
