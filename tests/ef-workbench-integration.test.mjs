import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) => fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

test("EF stays inside the existing Workbench shell", () => {
  const source = read("public/entry-cases/__entry_v3_site__/workbench.js");
  assert.match(source, /ef-workbench-shell\.[^"']+\.mjs/);
  assert.match(source, /prepareEfWorkbenchShell/);
  assert.match(source, /window\.efCaseBootstrap\(\s*\{/);
  assert.doesNotMatch(source, /document\.body\s*\.\s*innerHTML\s*=/);
  assert.doesNotMatch(source, /document\.body\s*\.\s*replaceChildren\s*\(/);
  assert.doesNotMatch(source, /#assetStatus[^;\n]*\|\|\s*document\.body/);
  assert.doesNotMatch(source, /main class="ef-grid"/);
  assert.match(source, /if\s*\(!detectedEfChain\s*&&\s*!manifestDetectionError\s*&&\s*el\.status\)/);
});

test("retired Full CIF reference is removed before ordinary or EF mode branches", () => {
  const source = read("public/entry-cases/__entry_v3_site__/workbench.js");
  assert.match(source, /function\s+removeRetiredFullCifReference\s*\(/);
  assert.match(source, /querySelector\(["']#molstar-full-host["']\)\?\.closest\(["']\.molstar-view["']\)\?\.remove\(\)/);
  assert.match(source, /querySelector\(["']#molstarFullMeta["']\)\?\.remove\(\)/);

  const helperBody = source.indexOf("function removeRetiredFullCifReference");
  const eagerCleanupCall = source.indexOf("removeRetiredFullCifReference();", helperBody);
  const manifestFetch = source.indexOf("const response = await fetch");
  assert.ok(eagerCleanupCall >= 0 && eagerCleanupCall < manifestFetch, "retired Full CIF cleanup must run before manifest loading can block");
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
  assert.match(source, /sequenceHost\.appendChild\(sequenceTrack\)/);
  assert.doesNotMatch(source, /root\.appendChild\(sequenceTrack\)/);
  assert.match(source, /Mapped chain seq/);
  assert.match(source, /Intensity/);
  assert.match(source, /role:\s*["']group["']/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /data-track-kind/);
  assert.match(source, /updateSequenceIntensity/);
  assert.match(source, /kind:\s*["']hover["']/);
  assert.match(source, /kind:\s*["']select["']/);
  assert.match(source, /idx\.cellMap\.has/);
  assert.match(source, /core\.presentationPayload/);
  assert.match(source, /const mappedAxisI\s*=\s*viewPayload\.axis_i\.filter/);
  assert.match(source, /const mappedAxisJ\s*=\s*viewPayload\.axis_j\.filter/);
  assert.match(source, /const sequenceAxis\s*=\s*mappedAxisJ\.length\s*>\s*mappedAxisI\.length\s*\?\s*["']j["']\s*:\s*["']i["']/);
  assert.match(source, /const sequenceRows\s*=\s*sequenceAxis\s*===\s*["']j["']\s*\?\s*mappedAxisJ\s*:\s*mappedAxisI/);
  assert.match(source, /sequenceRows\.forEach/);
  assert.match(source, /const matrixRefByKey\s*=\s*new Map/);
  assert.match(source, /for\s*\(const axis of \[sequenceAxis/);
  assert.match(source, /selectAxis\(ref\.axis,\s*ref\.index,\s*["']varna["']\)/);
  assert.match(source, /PDB\.molstar\.click/);
  assert.match(source, /selectPdbPosition\([^,]+,\s*["']3d["']\)/);
  assert.match(source, /FoldBridgeResidueLinkage/);
  assert.match(source, /data-residue-key/);
  assert.match(source, /PDB\.molstar\.mouseover/);
  assert.match(source, /PDB\.molstar\.mouseout/);
  assert.doesNotMatch(source, /nearestVarna|nearestDistance|nearestRadius/);
});

test("ordinary Case and EF share the residue linkage API", () => {
  const workbench = read("public/entry-cases/__entry_v3_site__/workbench.js");
  assert.match(workbench, /residue-linkage\.[^"']+\.mjs/);
  assert.match(workbench, /window\.FoldBridgeResidueLinkage/);
  assert.match(workbench, /setResidueMarkState/);
  assert.match(workbench, /installVarnaHitLayer/);
});

test("EF uses the existing Workbench heatmap palette instead of blue-red", () => {
  const core = read("public/entry-cases/__entry_ef_site__/ef-heatmap-core.js");
  const renderer = read("public/entry-cases/__entry_ef_site__/ef-heatmap.js");
  assert.match(core, /\[255,\s*255,\s*255\]/);
  assert.match(core, /\[255,\s*242,\s*0\]/);
  assert.match(core, /\[198,\s*0,\s*0\]/);
  assert.doesNotMatch(renderer, /blue\s*<\s*center\s*<\s*red/i);
  assert.match(renderer, /no \/ negative signal.*strong positive signal/i);
});

test("Case Shell reports the chain it actually embeds", () => {
  const source = read("public/entry-cases/__entry_v3_site__/case-shell.js");
  assert.match(source, /querySelector\(["']#chainStatus["']\)/);
  assert.match(source, /chainStatus\.textContent\s*=\s*state\.activeChainId/);
  assert.match(source, /initialChainId\(bootstrap,\s*window\.location\.search\)/);
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
  assert.match(source, /\.molstar-view:has\(#molstar-full-host\)/, "retired Full CIF panel must be hidden before JavaScript initializes");
});

test("EF component chrome is entirely Workbench-token driven", () => {
  const renderer = read("public/entry-cases/__entry_ef_site__/ef-heatmap.js");
  const styles = read("public/entry-cases/__entry_v3_site__/workbench.css");
  assert.doesNotMatch(renderer, /style\.cssText\s*=/);
  assert.doesNotMatch(renderer, /\.style\.cursor\s*=/);
  assert.doesNotMatch(renderer, /#[0-9a-fA-F]{3,8}/);
  assert.match(renderer, /class:\s*["']ef-matrix-background["']/);
  assert.match(renderer, /class:\s*["']ef-selection-row["']/);
  assert.match(renderer, /class:\s*["']ef-hover-guide["']/);
  assert.doesNotMatch(renderer, /is-ef-hovered|is-ef-selected/);
  assert.match(renderer, /rmdb-heatmap-gradient ef-colorbar-ramp/);

  const efBlock = styles.slice(styles.indexOf("/* EF mode"));
  assert.match(efBlock, /\.ef-colorbar\s*\{[^}]*var\(--panel\)/s);
  assert.doesNotMatch(efBlock, /--ef-scale-(?:low|center|high)/);
  assert.match(efBlock, /\.ef-selection-row\s*\{[^}]*var\(--selected-soft\)[^}]*var\(--selected\)/s);
  assert.match(efBlock, /\.ef-hover-guide\s*\{[^}]*var\(--accent\)/s);
  assert.match(efBlock, /\.ef-sequence-track\s*\{/);
  assert.match(efBlock, /\.ef-sequence-base\[data-base=["']A["']\]\s*\{[^}]*#4c78a8/s);
  assert.doesNotMatch(efBlock, /\.ef-sequence-base\s*\{[^}]*min-width:\s*44px/s);
  assert.doesNotMatch(efBlock, /is-ef-hovered|is-ef-selected/);
  assert.doesNotMatch(efBlock, /(?:^|\n)\s*\.ef-/, "EF visual rules must remain scoped to Workbench EF mode");
});

test("EF dependency paths are fingerprinted for caches that ignore query strings", () => {
  const source = read("public/entry-cases/__entry_v3_site__/workbench.js");
  assert.match(source, /const EF_ASSET_VERSION\s*=\s*["']20260828-case-taxonomy-1["']/);
  assert.match(source, /ef-heatmap-core\.20260828-case-taxonomy-1\.js/);
  assert.match(source, /ef-heatmap\.20260828-case-taxonomy-1\.js/);
  assert.match(source, /ef-case\.20260828-case-taxonomy-1\.js/);
  assert.doesNotMatch(source, /20260826-ef-ui-8/);
  assert.doesNotMatch(source, /scriptUrl\.searchParams\.set\(["']v["']/);
});

test("Case Shell navigation does not force desktop horizontal overflow", () => {
  const source = read("public/entry-cases/__entry_v3_site__/case-shell.css");
  const routeRule = source.match(/\.fb-detail-nav \.bundle-home-route-nav\s*\{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(routeRule, /left:\s*220px/);
});
