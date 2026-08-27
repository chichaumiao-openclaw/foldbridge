import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EF_ASSET_VERSION,
  EF_ENTRY_ROUTES,
  VERSIONED_ASSETS,
  versionedAssetName,
  versionEfEntryAssets,
} from "../scripts/version-ef-entry-assets.mjs";

const rootHtml = `<!doctype html>
<link rel="stylesheet" href="../../__entry_v3_site__/case-shell.css">
<script id="family-case-bootstrap" type="application/json">{"caseId":"fixture","defaultChainId":"a","chainPageById":{"a":"chains/a/index.html"},"evidenceChainMap":{"ev-1":"a"},"evidenceRows":[{"evidenceId":"ev-1","chain":"a"}]}</script>
<script src="../../__entry_v3_site__/case-shell.js"></script>`;

const chainHtml = `<!doctype html>
<link rel="stylesheet" href="../../../../__entry_v3_site__/workbench.css?v=old">
<main class="workbench-shell">
<section class="controls"><label>Profile<select id="profileSelect"></select></label></section>
</main>
<script type="module" src="../../../../__entry_v3_site__/workbench.js?v=old"></script>`;

async function makePublicFixture({ workbenchPure = "export function buildCaseProfileDownloadItems() {}" } = {}) {
  const publicRoot = await fs.mkdtemp(path.join(os.tmpdir(), "foldbridge-ef-version-"));
  for (const { directory, assetName } of VERSIONED_ASSETS) {
    const assetDir = path.join(publicRoot, "entry-cases", directory);
    await fs.mkdir(assetDir, { recursive: true });
    const source = assetName === "workbench-pure.mjs"
      ? workbenchPure
      : `fixture:${directory}/${assetName}`;
    await fs.writeFile(path.join(assetDir, assetName), source);
  }
  for (const { caseId, chainId } of EF_ENTRY_ROUTES) {
    const caseDir = path.join(publicRoot, "entry-cases", "cases", caseId);
    const chainDir = path.join(caseDir, "chains", chainId);
    await fs.mkdir(chainDir, { recursive: true });
    await fs.writeFile(path.join(caseDir, "index.html"), `${rootHtml}\n<span>chains/${chainId}/index.html</span>`);
    await fs.writeFile(path.join(chainDir, "index.html"), chainHtml);
  }
  return publicRoot;
}

test("EF entry versioning step survives case rematerialization", async () => {
  const publicRoot = await makePublicFixture();

  const result = await versionEfEntryAssets(publicRoot);
  assert.equal(result.changedFiles, EF_ENTRY_ROUTES.length * 4 + VERSIONED_ASSETS.length);
  await versionEfEntryAssets(publicRoot, { check: true });

  for (const { caseId, chainId } of EF_ENTRY_ROUTES) {
    const caseDir = path.join(publicRoot, "entry-cases", "cases", caseId);
    const root = await fs.readFile(path.join(caseDir, "index.html"), "utf8");
    const chain = await fs.readFile(path.join(caseDir, "chains", chainId, "index.html"), "utf8");
    const rootAlias = await fs.readFile(path.join(caseDir, `index.${EF_ASSET_VERSION}.html`), "utf8");
    const chainAlias = await fs.readFile(path.join(caseDir, "chains", chainId, `index.${EF_ASSET_VERSION}.html`), "utf8");
    assert.match(root, new RegExp(versionedAssetName("case-shell.css").replaceAll(".", "\\.")));
    assert.match(root, new RegExp(versionedAssetName("case-shell.js").replaceAll(".", "\\.")));
    assert.match(root, new RegExp(`chains/${chainId}/index\\.${EF_ASSET_VERSION}\\.html`));
    assert.match(root, /"evidenceUrl":"confidence-evidence\.json"/);
    assert.doesNotMatch(root, /"evidenceRows"/);
    assert.doesNotMatch(root, /"evidenceChainMap"/);
    assert.equal(rootAlias, root);
    assert.match(chain, new RegExp(versionedAssetName("workbench.css").replaceAll(".", "\\.")));
    assert.match(chain, new RegExp(versionedAssetName("workbench.js").replaceAll(".", "\\.")));
    assert.match(chain, /<main class="workbench-shell is-ef-mode">/);
    assert.match(chain, /<section class="controls" hidden>/);
    assert.equal(chainAlias, chain);
  }

  for (const { directory, assetName } of VERSIONED_ASSETS) {
    const source = await fs.readFile(path.join(publicRoot, "entry-cases", directory, assetName), "utf8");
    const fingerprinted = await fs.readFile(path.join(publicRoot, "entry-cases", directory, versionedAssetName(assetName)), "utf8");
    assert.equal(fingerprinted, source);
  }
});

test("EF release rejects a stale workbench-pure dependency", async () => {
  const publicRoot = await makePublicFixture({
    workbenchPure: "export function applyTechniqueFilter() {}",
  });
  await assert.rejects(
    versionEfEntryAssets(publicRoot),
    /workbench-pure\.mjs must export buildCaseProfileDownloadItems/,
  );
});

test("Workbench shell and downstream EF scripts use the deploy version", async () => {
  const workbench = await fs.readFile(
    new URL("../public/entry-cases/__entry_v3_site__/workbench.js", import.meta.url),
    "utf8",
  );
  const main = await fs.readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.ok(
    VERSIONED_ASSETS.some(({ directory, assetName }) => directory === "__entry_v3_site__" && assetName === "workbench-pure.mjs"),
    "workbench-pure.mjs must ship in the same versioned release as workbench.js",
  );
  assert.match(workbench, new RegExp(versionedAssetName("workbench-pure.mjs").replaceAll(".", "\\.")));
  assert.match(workbench, new RegExp(versionedAssetName("ef-workbench-shell.mjs").replaceAll(".", "\\.")));
  assert.match(workbench, new RegExp(versionedAssetName("residue-linkage.mjs").replaceAll(".", "\\.")));
  assert.match(workbench, new RegExp(versionedAssetName("residue-rail.mjs").replaceAll(".", "\\.")));
  assert.match(workbench, new RegExp(`const EF_ASSET_VERSION = ["']${EF_ASSET_VERSION}["']`));
  assert.match(main, new RegExp(`const EF_ASSET_VERSION = ["']${EF_ASSET_VERSION}["']`));
  for (const assetName of ["ef-heatmap-core.js", "ef-heatmap.js", "ef-case.js"]) {
    assert.match(workbench, new RegExp(versionedAssetName(assetName).replaceAll(".", "\\.")));
  }
});
