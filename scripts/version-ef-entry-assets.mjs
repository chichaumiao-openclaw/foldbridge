import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const EF_ASSET_VERSION = "20260826-ef-ui-8";

// 缓存击穿只靠全局壳子模块的版本化文件名（下表）：无版本 workbench.js 内部 import
// 这些 *.<version>.mjs/js。这是线上实际部署的机制，与 EF case 数量无关。
// per-case 的 index 版本化（旧 EF_ENTRY_ROUTES 循环）从未真正部署，且随 EF case 增长
// 会带来多链/重发维护负担，已移除——所有 case（含 EF）统一走无版本 index.html + 无版本
// family-aware 壳，新增 EF case 只需重跑数据标注，无需再跑本步骤的 per-case 部分。
export const VERSIONED_ASSETS = Object.freeze([
  { directory: "__entry_v3_site__", assetName: "case-shell.css" },
  { directory: "__entry_v3_site__", assetName: "case-shell.js" },
  { directory: "__entry_v3_site__", assetName: "workbench.css" },
  { directory: "__entry_v3_site__", assetName: "workbench.js" },
  { directory: "__entry_v3_site__", assetName: "workbench-pure.mjs" },
  { directory: "__entry_v3_site__", assetName: "ef-workbench-shell.mjs" },
  { directory: "__entry_v3_site__", assetName: "residue-linkage.mjs" },
  { directory: "__entry_v3_site__", assetName: "residue-rail.mjs" },
  { directory: "__entry_ef_site__", assetName: "ef-heatmap-core.js" },
  { directory: "__entry_ef_site__", assetName: "ef-heatmap.js" },
  { directory: "__entry_ef_site__", assetName: "ef-case.js" },
]);

export function versionedAssetName(assetName) {
  const extension = path.extname(assetName);
  return `${assetName.slice(0, -extension.length)}.${EF_ASSET_VERSION}${extension}`;
}

async function syncCopy(sourcePath, targetPath, { check }) {
  const source = await fs.readFile(sourcePath);
  let target = null;
  try {
    target = await fs.readFile(targetPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (target && source.equals(target)) return false;
  if (check) throw new Error(`${targetPath} is missing or differs from ${sourcePath}`);
  await fs.copyFile(sourcePath, targetPath);
  return true;
}

async function assertWorkbenchPureContract(entryRoot) {
  const sourcePath = path.join(entryRoot, "__entry_v3_site__", "workbench-pure.mjs");
  const source = await fs.readFile(sourcePath, "utf8");
  if (!/export\s+function\s+buildCaseProfileDownloadItems\s*\(/.test(source)) {
    throw new Error(`${sourcePath} must export buildCaseProfileDownloadItems`);
  }
}

export async function versionEfEntryAssets(publicRoot, { check = false } = {}) {
  if (!publicRoot) throw new Error("versionEfEntryAssets requires a public root");
  const entryRoot = path.join(publicRoot, "entry-cases");
  await assertWorkbenchPureContract(entryRoot);
  let changedFiles = 0;
  let checkedFiles = 0;

  for (const { directory, assetName } of VERSIONED_ASSETS) {
    const assetDir = path.join(entryRoot, directory);
    if (await syncCopy(
      path.join(assetDir, assetName),
      path.join(assetDir, versionedAssetName(assetName)),
      { check },
    )) changedFiles += 1;
    checkedFiles += 1;
  }
  return { version: EF_ASSET_VERSION, checkedFiles, changedFiles };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const publicRoot = args.find((arg) => !arg.startsWith("--"));
  if (!publicRoot) throw new Error("Usage: node scripts/version-ef-entry-assets.mjs <public-root> [--check]");
  const result = await versionEfEntryAssets(path.resolve(publicRoot), { check });
  console.log(JSON.stringify(result));
}
