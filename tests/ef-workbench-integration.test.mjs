import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

test("EF stays inside the existing Workbench shell", () => {
  const source = read("public/entry-cases/__entry_v3_site__/workbench.js");
  assert.match(source, /ef-workbench-shell\.mjs/);
  assert.match(source, /prepareEfWorkbenchShell/);
  assert.match(source, /window\.efCaseBootstrap\(\s*\{/);
  assert.doesNotMatch(source, /document\.body\s*\.\s*innerHTML\s*=/);
  assert.doesNotMatch(source, /document\.body\s*\.\s*replaceChildren\s*\(/);
  assert.doesNotMatch(source, /#assetStatus[^;\n]*\|\|\s*document\.body/);
  assert.doesNotMatch(source, /main class="ef-grid"/);
  assert.match(source, /if\s*\(!detectedEfChain\s*&&\s*!manifestDetectionError\s*&&\s*el\.status\)/);
});

test("manifest detection fails loudly instead of falling back to profile mode", () => {
  const source = read("public/entry-cases/__entry_v3_site__/workbench.js");
  assert.match(source, /let manifestDetectionError\s*=\s*null/);
  assert.match(source, /if\s*\(!response\.ok\)\s*throw/);
  assert.match(source, /if\s*\(!chain\)\s*throw/);
  assert.match(source, /if\s*\(manifestDetectionError\)\s*throw manifestDetectionError/);
  assert.match(source, /if\s*\(!detectedEfChain\s*&&\s*!manifestDetectionError\s*&&\s*el\.status\)/);
});

test("EF bootstrap validates linked assets before rendering", () => {
  const source = read("public/entry-cases/__entry_ef_site__/ef-case.js");
  assert.match(source, /case2dPath/);
  assert.match(source, /linkedViewBundlePath/);
  assert.match(source, /assertLinkedContract/);
  assert.match(source, /sequence\s*=\s*requireOptionHost\(hosts,\s*["']sequence["']\)/);
  assert.doesNotMatch(source, /showError\([^)]*document\.body/);
  assert.match(source, /return\s+\{\s*manifest,\s*manifestUrl,\s*resolvedChain,\s*controller\s*\}/);
});

test("EF renderer owns separate 1D and matrix hosts", () => {
  const source = read("public/entry-cases/__entry_ef_site__/ef-heatmap.js");
  assert.match(source, /sequenceHost/);
  assert.match(source, /onInteraction/);
  assert.match(source, /sequenceHost\.appendChild\(sequenceViewport\)/);
  assert.doesNotMatch(source, /root\.appendChild\(sequenceViewport\)/);
  assert.match(source, /kind:\s*["']hover["']/);
  assert.match(source, /kind:\s*["']select["']/);
  assert.match(source, /cellMap\.get\([^\n]+\)\s*\?\?\s*null/);
  assert.match(source, /const mappedAxisI\s*=\s*viewPayload\.axis_i\.filter/);
  assert.match(source, /const mappedAxisJ\s*=\s*viewPayload\.axis_j\.filter/);
  assert.match(source, /const sequenceAxis\s*=\s*mappedAxisJ\.length\s*>\s*mappedAxisI\.length\s*\?\s*["']j["']\s*:\s*["']i["']/);
  assert.match(source, /const sequenceRows\s*=\s*sequenceAxis\s*===\s*["']j["']\s*\?\s*mappedAxisJ\s*:\s*mappedAxisI/);
  assert.match(source, /sequenceRows\.forEach/);
  assert.match(source, /const matrixRefByVarna\s*=\s*new Map/);
  assert.match(source, /for\s*\(const axis of \[sequenceAxis/);
  assert.match(source, /selectAxis\(matrixRef\.axis,\s*matrixRef\.index,\s*["']varna["']\)/);
});

test("Case Shell reports the chain it actually embeds", () => {
  const source = read("public/entry-cases/__entry_v3_site__/case-shell.js");
  assert.match(source, /querySelector\(["']#chainStatus["']\)/);
  assert.match(source, /chainStatus\.textContent\s*=\s*state\.activeChainId/);
});

test("EF inspector reports linked 3D state without undefined matrix values", () => {
  const source = read("public/entry-cases/__entry_v3_site__/ef-workbench-shell.mjs");
  assert.match(source, /molstar-selection-status/);
  assert.match(source, /Number\.isFinite\(active\.cell\.value\)/);
  assert.match(source, /mappedPositions/);
  assert.match(source, /no signal/);
});

test("EF styles are scoped to Workbench EF mode", () => {
  const source = read("public/entry-cases/__entry_v3_site__/workbench.css");
  assert.match(source, /\.workbench-shell\.is-ef-mode/);
  assert.match(source, /\.ef-workbench-matrix-panel/);
  assert.match(source, /var\(--(?:ink|muted|line|panel|accent|selected|hover)\)/);
});

test("Case Shell navigation does not force desktop horizontal overflow", () => {
  const source = read("public/entry-cases/__entry_v3_site__/case-shell.css");
  const routeRule = source.match(/\.fb-detail-nav \.bundle-home-route-nav\s*\{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(routeRule, /left:\s*220px/);
});
