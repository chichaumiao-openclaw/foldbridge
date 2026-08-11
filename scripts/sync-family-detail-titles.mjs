#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const universes = [
  {
    id: "rmdb",
    publicDir: path.join(root, "public/rmdb-v3/cases"),
    indexPath: path.join(root, "src/assets/generated/annojoin-atlas-rmdb/index.json"),
    familyPrefix: "RMDB2PDB%3A",
  },
  {
    id: "rasp",
    publicDir: path.join(root, "public/rasp-v3/cases"),
    indexPath: path.join(root, "src/assets/generated/annojoin-atlas-rasp/index.json"),
    familyPrefix: "RASP2PDB%3A",
  },
];

function html(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function moleculeTitle(row) {
  return String(row.biologicalMoleculeName || row.pdbMoleculeName || row.caseId || "")
    .split("|")[0]
    .trim();
}

async function syncUniverse(universe) {
  const source = JSON.parse(await readFile(universe.indexPath, "utf8"));
  const rows = new Map((source.cases || []).map((row) => [String(row.caseId), row]));
  const caseDirs = (await readdir(universe.publicDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(universe.familyPrefix));

  let casePages = 0;
  let chainPages = 0;
  let skipped = 0;

  for (const caseDir of caseDirs) {
    const caseId = caseDir.name.slice(universe.familyPrefix.length);
    const row = rows.get(caseId);
    const title = moleculeTitle(row || { caseId });
    if (!title) {
      skipped++;
      continue;
    }

    const casePath = path.join(universe.publicDir, caseDir.name, "index.html");
    let caseMarkup = await readFile(casePath, "utf8");
    const escapedCaseId = caseId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedTitle = html(title);
    caseMarkup = caseMarkup
      .replace(new RegExp(`<title>${escapedCaseId} case page</title>`), `<title>${escapedTitle} · ${caseId} case page</title>`)
      .replace(new RegExp(`<h1>${escapedCaseId}</h1>`), `<h1>${escapedTitle}</h1>`)
      .replace(new RegExp(`title="${escapedCaseId} chain page"`), `title="${escapedTitle} chain page"`);
    await writeFile(casePath, caseMarkup);
    casePages++;

    const chainRoot = path.join(universe.publicDir, caseDir.name, "chains");
    let chainDirs = [];
    try {
      chainDirs = (await readdir(chainRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory());
    } catch {
      continue;
    }

    for (const chainDir of chainDirs) {
      const chainPath = path.join(chainRoot, chainDir.name, "index.html");
      let chainMarkup;
      try {
        chainMarkup = await readFile(chainPath, "utf8");
      } catch {
        continue;
      }
      const chain = chainDir.name;
      chainMarkup = chainMarkup
        .replace(new RegExp(`<title>${escapedCaseId} chain ([^<]+)</title>`), (_, chainLabel) =>
          `<title>${escapedTitle} · ${caseId} chain ${chainLabel}</title>`)
        .replace(new RegExp(`<h1>${escapedCaseId} chain ([^<]+)</h1>`), (_, chainLabel) =>
          `<h1>${escapedTitle} chain ${chainLabel}</h1>`);
      await writeFile(chainPath, chainMarkup);
      chainPages++;
    }
  }

  console.log(`[sync-family-detail-titles] ${universe.id}: ${casePages} case pages, ${chainPages} chain pages, ${skipped} skipped`);
}

for (const universe of universes) {
  await syncUniverse(universe);
}
