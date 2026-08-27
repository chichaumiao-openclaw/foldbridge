import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EF_ASSET_VERSION,
  VERSIONED_ASSETS,
  versionedAssetName,
  versionEfEntryAssets,
} from "../scripts/version-ef-entry-assets.mjs";

// 选项 C：缓存击穿只靠全局壳子模块的版本化文件名。per-case 的 index 版本化已移除
// （线上从未部署，且随 EF case 增长带来维护负担）。所有 case 走无版本 index.html +
// 无版本 family-aware 壳，壳内部 import 这些 *.<version>.mjs/js。
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
  return publicRoot;
}

test("EF versioning fingerprints every global shell submodule (idempotent)", async () => {
  const publicRoot = await makePublicFixture();

  const result = await versionEfEntryAssets(publicRoot);
  assert.equal(result.changedFiles, VERSIONED_ASSETS.length);
  // 再跑一遍 --check：已版本化则零改动、不抛错（幂等）。
  await versionEfEntryAssets(publicRoot, { check: true });

  for (const { directory, assetName } of VERSIONED_ASSETS) {
    const source = await fs.readFile(path.join(publicRoot, "entry-cases", directory, assetName), "utf8");
    const fingerprinted = await fs.readFile(
      path.join(publicRoot, "entry-cases", directory, versionedAssetName(assetName)),
      "utf8",
    );
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

test("Workbench shell imports the deploy-version submodules", async () => {
  const workbench = await fs.readFile(
    new URL("../public/entry-cases/__entry_v3_site__/workbench.js", import.meta.url),
    "utf8",
  );
  assert.ok(
    VERSIONED_ASSETS.some(({ directory, assetName }) => directory === "__entry_v3_site__" && assetName === "workbench-pure.mjs"),
    "workbench-pure.mjs must ship in the same versioned release as workbench.js",
  );
  assert.match(workbench, new RegExp(versionedAssetName("workbench-pure.mjs").replaceAll(".", "\\.")));
  assert.match(workbench, new RegExp(versionedAssetName("ef-workbench-shell.mjs").replaceAll(".", "\\.")));
  assert.match(workbench, new RegExp(versionedAssetName("residue-linkage.mjs").replaceAll(".", "\\.")));
  assert.match(workbench, new RegExp(versionedAssetName("residue-rail.mjs").replaceAll(".", "\\.")));
  assert.match(workbench, new RegExp(`const EF_ASSET_VERSION = ["']${EF_ASSET_VERSION}["']`));
  for (const assetName of ["ef-heatmap-core.js", "ef-heatmap.js", "ef-case.js"]) {
    assert.match(workbench, new RegExp(versionedAssetName(assetName).replaceAll(".", "\\.")));
  }
});
