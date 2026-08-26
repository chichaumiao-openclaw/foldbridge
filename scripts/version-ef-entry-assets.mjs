import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const EF_ASSET_VERSION = "20260826-ef-ui-5";

export const EF_ENTRY_ROUTES = Object.freeze([
  { caseId: "7SYS", chainId: "z" },
  { caseId: "8QO5", chainId: "A" },
  { caseId: "8UYE", chainId: "A" },
  { caseId: "8UYL", chainId: "A" },
  { caseId: "9TMI", chainId: "a" },
  { caseId: "9ZC6", chainId: "A" },
  { caseId: "9WNR", chainId: "a" },
]);

export const VERSIONED_ASSETS = Object.freeze([
  { directory: "__entry_v3_site__", assetName: "case-shell.css" },
  { directory: "__entry_v3_site__", assetName: "case-shell.js" },
  { directory: "__entry_v3_site__", assetName: "workbench.css" },
  { directory: "__entry_v3_site__", assetName: "workbench.js" },
  { directory: "__entry_v3_site__", assetName: "ef-workbench-shell.mjs" },
  { directory: "__entry_ef_site__", assetName: "ef-heatmap-core.js" },
  { directory: "__entry_ef_site__", assetName: "ef-heatmap.js" },
  { directory: "__entry_ef_site__", assetName: "ef-case.js" },
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function versionedAssetName(assetName) {
  const extension = path.extname(assetName);
  return `${assetName.slice(0, -extension.length)}.${EF_ASSET_VERSION}${extension}`;
}

function versionAsset(source, assetName) {
  const extension = path.extname(assetName);
  const stem = assetName.slice(0, -extension.length);
  const pattern = new RegExp(
    `${escapeRegExp(stem)}(?:\\.[A-Za-z0-9_-]+)*${escapeRegExp(extension)}(?:\\?v=[^"'\\s<>]+)?`,
    "g",
  );
  let matches = 0;
  const output = source.replace(pattern, () => {
    matches += 1;
    return versionedAssetName(assetName);
  });
  if (matches !== 1) throw new Error(`Expected one ${assetName} reference, found ${matches}`);
  return output;
}

function versionChainPage(source, chainId) {
  const pattern = new RegExp(
    `chains/${escapeRegExp(chainId)}/index(?:\\.[A-Za-z0-9_-]+)*\\.html`,
    "g",
  );
  let matches = 0;
  const output = source.replace(pattern, () => {
    matches += 1;
    return `chains/${chainId}/index.${EF_ASSET_VERSION}.html`;
  });
  if (matches < 1) throw new Error(`Expected at least one chains/${chainId}/index.html reference`);
  return output;
}

async function writeIfChanged(filePath, output, { check }) {
  const source = await fs.readFile(filePath, "utf8");
  if (source === output) return false;
  if (check) throw new Error(`${filePath} does not use EF asset version ${EF_ASSET_VERSION}`);
  await fs.writeFile(filePath, output);
  return true;
}

async function versionHtml(filePath, assetNames, { check, transform = (value) => value }) {
  const source = await fs.readFile(filePath, "utf8");
  const output = transform(assetNames.reduce(versionAsset, source));
  return writeIfChanged(filePath, output, { check });
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

export async function versionEfEntryAssets(publicRoot, { check = false } = {}) {
  if (!publicRoot) throw new Error("versionEfEntryAssets requires a public root");
  const entryRoot = path.join(publicRoot, "entry-cases");
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

  for (const { caseId, chainId } of EF_ENTRY_ROUTES) {
    const caseDir = path.join(entryRoot, "cases", caseId);
    const rootPath = path.join(caseDir, "index.html");
    const chainPath = path.join(caseDir, "chains", chainId, "index.html");
    if (await versionHtml(rootPath, ["case-shell.css", "case-shell.js"], {
      check,
      transform: (source) => versionChainPage(source, chainId),
    })) changedFiles += 1;
    if (await versionHtml(chainPath, ["workbench.css", "workbench.js"], { check })) changedFiles += 1;
    checkedFiles += 2;

    if (await syncCopy(rootPath, path.join(caseDir, `index.${EF_ASSET_VERSION}.html`), { check })) changedFiles += 1;
    if (await syncCopy(chainPath, path.join(caseDir, "chains", chainId, `index.${EF_ASSET_VERSION}.html`), { check })) changedFiles += 1;
    checkedFiles += 2;
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
