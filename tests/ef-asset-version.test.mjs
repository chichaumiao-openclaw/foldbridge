import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EF_ASSET_VERSION,
  EF_ENTRY_ROUTES,
  versionEfEntryAssets,
} from "../scripts/version-ef-entry-assets.mjs";

const rootHtml = `<!doctype html>
<link rel="stylesheet" href="../../__entry_v3_site__/case-shell.css">
<script src="../../__entry_v3_site__/case-shell.js"></script>`;

const chainHtml = `<!doctype html>
<link rel="stylesheet" href="../../../../__entry_v3_site__/workbench.css?v=old">
<script type="module" src="../../../../__entry_v3_site__/workbench.js?v=old"></script>`;

test("EF entry versioning step survives case rematerialization", async () => {
  const publicRoot = await fs.mkdtemp(path.join(os.tmpdir(), "foldbridge-ef-version-"));
  for (const { caseId, chainId } of EF_ENTRY_ROUTES) {
    const caseDir = path.join(publicRoot, "entry-cases", "cases", caseId);
    const chainDir = path.join(caseDir, "chains", chainId);
    await fs.mkdir(chainDir, { recursive: true });
    await fs.writeFile(path.join(caseDir, "index.html"), rootHtml);
    await fs.writeFile(path.join(chainDir, "index.html"), chainHtml);
  }

  const result = await versionEfEntryAssets(publicRoot);
  assert.equal(result.changedFiles, EF_ENTRY_ROUTES.length * 2);
  await versionEfEntryAssets(publicRoot, { check: true });

  for (const { caseId, chainId } of EF_ENTRY_ROUTES) {
    const caseDir = path.join(publicRoot, "entry-cases", "cases", caseId);
    const root = await fs.readFile(path.join(caseDir, "index.html"), "utf8");
    const chain = await fs.readFile(path.join(caseDir, "chains", chainId, "index.html"), "utf8");
    assert.match(root, new RegExp(`case-shell\\.css\\?v=${EF_ASSET_VERSION}`));
    assert.match(root, new RegExp(`case-shell\\.js\\?v=${EF_ASSET_VERSION}`));
    assert.match(chain, new RegExp(`workbench\\.css\\?v=${EF_ASSET_VERSION}`));
    assert.match(chain, new RegExp(`workbench\\.js\\?v=${EF_ASSET_VERSION}`));
  }
});

test("Workbench shell and downstream EF scripts use the deploy version", async () => {
  const workbench = await fs.readFile(
    new URL("../public/entry-cases/__entry_v3_site__/workbench.js", import.meta.url),
    "utf8",
  );
  assert.match(workbench, new RegExp(`ef-workbench-shell\\.mjs\\?v=${EF_ASSET_VERSION}`));
  assert.match(workbench, new RegExp(`const EF_ASSET_VERSION = ["']${EF_ASSET_VERSION}["']`));
});
