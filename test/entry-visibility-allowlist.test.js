import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterCasesToPublishedAllowlist, parsePublishedCaseKeyAllowlist } from '../scripts/lib/annojoin-atlas-published-allowlist.mjs';

const index = JSON.parse(fs.readFileSync(new URL('../src/assets/generated/annojoin-atlas/index.json', import.meta.url), 'utf8'));
const tsv = fs.readFileSync(new URL('../scripts/data/annojoin-atlas-published-case-keys.tsv', import.meta.url), 'utf8');

test('published allowlist narrows displayCases to ground-truth 2386', () => {
  const allow = parsePublishedCaseKeyAllowlist(tsv);
  const kept = filterCasesToPublishedAllowlist(index.displayCases, allow);
  assert.equal(kept.kept.length, 2386);
});
