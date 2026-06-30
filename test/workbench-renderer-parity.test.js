import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// There is ONE workbench renderer source of truth:
//   public/annojoin-smoke/5gag/workbench.js
// A build script transforms it into two published per-universe renderers. Because
// the two published renderers share the same global config name, they MUST be
// byte-identical: same source + same transform config => identical output. A bug
// once regenerated the RMDB renderer from a STALE 5gag source, silently dropping
// the latest 1D-slider / 2D-VARNA zoom / 3D-linkage features while RASP kept them.
// These tests lock that drift down.
const SOURCE_OF_TRUTH = path.resolve(here, '../public/annojoin-smoke/5gag/workbench.js');
const RASP_PUBLISHED = path.resolve(here, '../public/rasp-v3/__rasp_v3_site__/workbench.js');
const RMDB_PUBLISHED = path.resolve(here, '../public/rmdb-v3/__rmdb_v3_site__/workbench.js');

const raspJs = fs.readFileSync(RASP_PUBLISHED, 'utf8');
const rmdbJs = fs.readFileSync(RMDB_PUBLISHED, 'utf8');
const sourceJs = fs.readFileSync(SOURCE_OF_TRUTH, 'utf8');

// Count non-overlapping occurrences of a literal substring.
function count(haystack, needle) {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

test('published RASP and RMDB renderers are byte-identical', () => {
  assert.strictEqual(
    raspJs,
    rmdbJs,
    'The two published workbench renderers diverged. They are generated from the ' +
      'same source-of-truth (public/annojoin-smoke/5gag/workbench.js) with the same ' +
      'transform config and share the same global config name, so they MUST be ' +
      'byte-identical. A difference means one was regenerated from a stale source ' +
      '(the RMDB renderer previously drifted this way, losing 1D/2D/3D linkage). ' +
      'Rebuild both renderers from the current 5gag source.'
  );
});

test('latest 1D/2D/3D linkage feature tokens present in BOTH published renderers', () => {
  for (const [label, js] of [['rasp', raspJs], ['rmdb', rmdbJs]]) {
    assert.ok(
      count(js, 'varnaZoom') >= 16,
      `[${label}] expected >=16 occurrences of varnaZoom (2D VARNA zoom linkage), got ${count(js, 'varnaZoom')}`
    );
    assert.ok(
      count(js, 'viewportSlider') >= 9,
      `[${label}] expected >=9 occurrences of viewportSlider (1D slider linkage), got ${count(js, 'viewportSlider')}`
    );
    assert.ok(count(js, 'applyVarnaZoom') >= 1, `[${label}] missing applyVarnaZoom`);
    assert.ok(count(js, 'recolorVarnaViewportLink') >= 1, `[${label}] missing recolorVarnaViewportLink`);
    assert.ok(count(js, 'syncViewportSlider') >= 1, `[${label}] missing syncViewportSlider`);
    assert.ok(count(js, 'densestReactivityWindow') >= 1, `[${label}] missing densestReactivityWindow`);
    assert.ok(count(js, 'applyMolstarHoverHighlight') >= 1, `[${label}] missing applyMolstarHoverHighlight`);
    assert.ok(count(js, 'clearHighlight') >= 1, `[${label}] missing clearHighlight`);
    assert.ok(count(js, 'focusMolstarOnSelection') >= 1, `[${label}] missing focusMolstarOnSelection`);
  }
});

test('L2 coloring fix tokens present, pre-L2 symbols gone, in BOTH published renderers', () => {
  for (const [label, js] of [['rasp', raspJs], ['rmdb', rmdbJs]]) {
    assert.ok(
      count(js, 'familyTargetsBase') >= 3,
      `[${label}] expected >=3 occurrences of familyTargetsBase (L2 fix), got ${count(js, 'familyTargetsBase')}`
    );
    assert.ok(count(js, 'colorForMolstarReactivity') >= 1, `[${label}] missing colorForMolstarReactivity (L2 fix)`);
    assert.ok(count(js, 'buildProfileSelectMarkup') >= 1, `[${label}] missing buildProfileSelectMarkup (L2 fix)`);
    assert.ok(count(js, 'richestProfileIndex') >= 1, `[${label}] missing richestProfileIndex (L2 fix)`);
    // The pre-L2 symbols must be gone, or a stale regenerate slipped through.
    assert.strictEqual(
      count(js, 'colorForMolstarDmsReactivity'),
      0,
      `[${label}] pre-L2 symbol colorForMolstarDmsReactivity still present -> stale renderer`
    );
    assert.strictEqual(
      count(js, 'assayStateForBase'),
      0,
      `[${label}] pre-L2 symbol assayStateForBase still present -> stale renderer`
    );
  }
});

test('source-of-truth 5gag workbench carries the linkage features', () => {
  // Guards the actual root cause: if someone points the build at an old 5gag,
  // this fails even before regeneration.
  assert.ok(
    count(sourceJs, 'varnaZoom') >= 16,
    `source-of-truth 5gag workbench expected >=16 occurrences of varnaZoom, got ${count(sourceJs, 'varnaZoom')}`
  );
});
