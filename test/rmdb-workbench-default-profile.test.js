import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Both case-page renderers (RMDB + RASP) share the same default-profile logic
// and must carry the same richest-signal fix, so 1GTN-style cases whose first
// profile is sparse no longer open the 3D view almost entirely white.
const RENDERERS = {
  'rmdb-v3': path.resolve(here, '../public/rmdb-v3/__rmdb_v3_site__/workbench.js'),
  'rasp-v3': path.resolve(here, '../public/rasp-v3/__rasp_v3_site__/workbench.js'),
};

// Extract a named top-level function body from the workbench IIFE script so we
// can exercise its pure logic without a DOM. Brace-matched, no execution of the
// surrounding browser-only module code.
function extractFunctionSource(src, name) {
  const sig = `function ${name}(`;
  const start = src.indexOf(sig);
  if (start < 0) throw new Error(`function ${name} not found in workbench.js`);
  let depth = 0;
  let i = src.indexOf('{', start);
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) { i += 1; break; }
    }
  }
  return src.slice(start, i);
}

function loadPureFunction(src, name) {
  const fnSource = extractFunctionSource(src, name);
  // eslint-disable-next-line no-new-func
  return new Function(`${fnSource}\nreturn ${name};`)();
}

for (const [label, workbenchPath] of Object.entries(RENDERERS)) {
  const source = fs.readFileSync(workbenchPath, 'utf8');

  test(`[${label}] pickRichestProfileIndex selects the profile with the most positive reactivity values`, () => {
    const pick = loadPureFunction(source, 'pickRichestProfileIndex');
    assert.equal(pick([9, 28]), 1, '1GTN: 2A3=9 positives, DMS=28 -> DMS profile');
    assert.equal(pick([28, 9]), 0, 'order-independent: richest wins');
    assert.equal(pick([0, 0, 0]), 0, 'all-empty profiles -> first');
    assert.equal(pick([5, 5]), 0, 'tie -> lowest index (stable)');
    assert.equal(pick([7]), 0, 'single profile -> index 0');
    assert.equal(pick([]), 0, 'no profiles -> 0');
    assert.equal(pick([1, 0, 40, 3]), 2, 'picks the global max');
  });

  test(`[${label}] default profile selection honors explicit request, else falls back to richest signal`, () => {
    // explicit URL/config profile request still takes precedence
    assert.match(source, /profileIndexForId\(\s*requestedProfileId\s*\)/);
    // richest-signal selection is used as the no-request default
    assert.match(source, /richestProfileIndex\(/);
    // the old blind "profiles[0]" default is gone
    assert.doesNotMatch(source, /Math\.max\(0,\s*profileIndexForId\(initialProfileId\)\)/);
  });
}
