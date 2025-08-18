// Build a static primary-citation index for Entry detail pages.
//
// RCSB's API is intentionally queried only while building the site. The
// published browser then reads a local asset, avoiding CORS and giving every
// Entry page the same stable reference experience.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePrimaryCitation } from '../src/pdbCitationStore.js';

const RCSB_GRAPHQL_URL = 'https://data.rcsb.org/graphql';
const CITATION_FIELDS = `
  rcsb_id
  rcsb_primary_citation {
    title
    rcsb_authors
    rcsb_journal_abbrev
    journal_volume
    page_first
    page_last
    pdbx_database_id_PubMed
    pdbx_database_id_DOI
    year
  }
`;

function text(value) {
  return String(value ?? '').trim();
}

export function pdbIdsFromAtlasIndex(index = {}) {
  return [...new Set((Array.isArray(index.displayCases) ? index.displayCases : [])
    .map((row) => text(row?.pdbId).toUpperCase())
    .filter((pdbId) => /^[A-Z0-9]{4}$/.test(pdbId)))].sort();
}

export function primaryCitationQuery(pdbIds) {
  return `query FoldBridgePrimaryCitations {\n  entries(entry_ids: ${JSON.stringify(pdbIds)}) {\n    ${CITATION_FIELDS}\n  }\n}`;
}

export async function fetchCitationChunk(pdbIds, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(RCSB_GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: primaryCitationQuery(pdbIds) }),
  });
  if (!response?.ok) throw new Error(`RCSB returned ${response?.status || 'no response'}`);
  const payload = await response.json();
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    throw new Error(`RCSB GraphQL error: ${payload.errors[0]?.message || 'unknown error'}`);
  }
  return (payload?.data?.entries || [])
    .map((entry) => [text(entry?.rcsb_id).toUpperCase(), normalizePrimaryCitation(entry)])
    .filter(([pdbId, citation]) => pdbId && citation);
}

export async function buildCitationIndex({ pdbIds, existing = {}, fetchImpl = fetch, chunkSize = 100, onProgress = () => {} } = {}) {
  const citations = { ...existing };
  const missing = pdbIds.filter((pdbId) => !citations[pdbId]);
  for (let start = 0; start < missing.length; start += chunkSize) {
    const chunk = missing.slice(start, start + chunkSize);
    const rows = await fetchCitationChunk(chunk, { fetchImpl });
    for (const [pdbId, citation] of rows) citations[pdbId] = citation;
    onProgress({ completed: Math.min(start + chunk.length, missing.length), total: missing.length, found: Object.keys(citations).length });
  }
  return citations;
}

function readJsonOrEmpty(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const atlasIndex = readJsonOrEmpty(path.join(root, 'src/assets/generated/annojoin-atlas/index.json'));
  const outDir = path.join(root, 'src/assets/generated/pdb-primary-citations');
  const outPath = path.join(outDir, 'index.json');
  const existing = readJsonOrEmpty(outPath).citations || {};
  const pdbIds = pdbIdsFromAtlasIndex(atlasIndex);
  const citations = await buildCitationIndex({
    pdbIds,
    existing,
    onProgress: ({ completed, total, found }) => process.stdout.write(`[pdb-citations] ${completed}/${total} requested; ${found} citations cached\n`),
  });
  const payload = {
    schemaVersion: 'pdb-primary-citations.v1',
    generatedAt: new Date().toISOString(),
    source: 'RCSB PDB Data API GraphQL primary citation fields',
    requestedPdbCount: pdbIds.length,
    citationCount: Object.keys(citations).length,
    citations,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  process.stdout.write(`[pdb-citations] wrote ${outPath} (${payload.citationCount}/${payload.requestedPdbCount} citations)\n`);
}
