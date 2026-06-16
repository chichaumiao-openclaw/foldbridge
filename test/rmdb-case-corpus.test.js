import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_CASE_IDS } from '../scripts/lib/sample-case-ids.mjs';

test('sample case ids: 20 unique uppercase pdb ids', () => {
  assert.equal(SAMPLE_CASE_IDS.length, 20);
  assert.equal(new Set(SAMPLE_CASE_IDS).size, 20);
  assert.ok(SAMPLE_CASE_IDS.every((id) => /^[A-Z0-9]{4}$/.test(id)));
});
