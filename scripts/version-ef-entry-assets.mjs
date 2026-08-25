import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const EF_ASSET_VERSION = "20260825-ef-ui-4";

export const EF_ENTRY_ROUTES = Object.freeze([
  { caseId: "7SYS", chainId: "z" },
  { caseId: "8QO5", chainId: "A" },
  { caseId: "8UYE", chainId: "A" },
  { caseId: "8UYL", chainId: "A" },
  { caseId: "9TMI", chainId: "a" },
  { caseId: "9ZC6", chainId: "A" },
  { caseId: "9WNR", chainId: "a" },
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function versionAsset(source, assetName) {
  const pattern = new RegExp(`(${escapeRegExp(assetName)})(?:\\?v=[^"'\\s<>]+)?`, "g");
  let matches = 0;
  const output = source.replace(pattern, (_match, name) => {
    matches += 1;
    return `${name}?v=${EF_ASSET_VERSION}`;
  });
  if (matches !== 1) {
    throw new Error(`Expected one ${assetName} reference, found ${matches}`);
  }
  return output;
}

async function versionHtml(filePath, assetNames, { check }) {
  const source = await fs.readFile(filePath, "utf8");
  const output = assetNames.reduce(versionAsset, source);
  if (check && output !== source) {
    throw new Error(`${filePath} does not use EF asset version ${EF_ASSET_VERSION}`);
  }
  if (!check && output !== source) {
    await fs.writeFile(filePath, output);
    return true;
  }
  return false;
}

export async function versionEfEntryAssets(publicRoot, { check = false } = {}) {
  if (!publicRoot) throw new Error("versionEfEntryAssets requires a public root");
  let changedFiles = 0;
  let checkedFiles = 0;
  for (const { caseId, chainId } of EF_ENTRY_ROUTES) {
    const caseDir = path.join(publicRoot, "entry-cases", "cases", caseId);
    const pages = [
      [path.join(caseDir, "index.html"), ["case-shell.css", "case-shell.js"]],
      [path.join(caseDir, "chains", chainId, "index.html"), ["workbench.css", "workbench.js"]],
    ];
    for (const [filePath, assetNames] of pages) {
      if (await versionHtml(filePath, assetNames, { check })) changedFiles += 1;
      checkedFiles += 1;
    }
  }
  return { version: EF_ASSET_VERSION, checkedFiles, changedFiles };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const publicRoot = args.find((arg) => !arg.startsWith("--"));
  if (!publicRoot) {
    throw new Error("Usage: node scripts/version-ef-entry-assets.mjs <public-root> [--check]");
  }
  const result = await versionEfEntryAssets(path.resolve(publicRoot), { check });
  console.log(JSON.stringify(result));
}
