import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVisualPreviewCaseIds } from '../scripts/lib/annojoin-atlas-build-options.mjs';

const cases = Array.from({ length: 5 }, (_, index) => ({ case_id: `CASE${index + 1}` }));

test('visual preview generation defaults to all ANNOJOIN cases', () => {
  assert.deepEqual(resolveVisualPreviewCaseIds(cases), ['CASE1', 'CASE2', 'CASE3', 'CASE4', 'CASE5']);
});

test('visual preview generation can still be bounded explicitly for quick dev builds', () => {
  assert.deepEqual(resolveVisualPreviewCaseIds(cases, '2'), ['CASE1', 'CASE2']);
  assert.deepEqual(resolveVisualPreviewCaseIds(cases, '0'), []);
});
