import { brotliCompress, gzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const brotliCompressAsync = promisify(brotliCompress);

export const DETAIL_ROUTE_INDEX_SCHEMA_VERSION = 'annojoin-atlas.detail-routes.v1';

function jsonText(data) {
  return `${JSON.stringify(data)}\n`;
}

function text(value) {
  return String(value ?? '').trim();
}

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDisplayRow(row = {}) {
  return row.isMergedDisplayRow === true || row.isMergedDisplayRow === 'true';
}

export function compressedAssetDescriptor({ path, rawBytes, brotliBytes, gzipBytes } = {}) {
  const normalizedPath = text(path);
  return {
    path: normalizedPath,
    rawBytes: numberOrZero(rawBytes),
    brotli: {
      path: `${normalizedPath}.br`,
      codec: 'br',
      bytes: numberOrZero(brotliBytes)
    },
    gzip: {
      path: `${normalizedPath}.gz`,
      codec: 'gzip',
      bytes: numberOrZero(gzipBytes)
    }
  };
}

export async function buildCompressedJsonSidecars(path, data) {
  const raw = Buffer.from(jsonText(data), 'utf8');
  const [brotliBytes, gzipBytes] = await Promise.all([
    brotliCompressAsync(raw),
    gzipAsync(raw)
  ]);
  return {
    raw: { path: text(path), bytes: raw, sizeBytes: raw.byteLength },
    brotli: { path: `${text(path)}.br`, bytes: brotliBytes, sizeBytes: brotliBytes.byteLength },
    gzip: { path: `${text(path)}.gz`, bytes: gzipBytes, sizeBytes: gzipBytes.byteLength },
    descriptor: compressedAssetDescriptor({
      path,
      rawBytes: raw.byteLength,
      brotliBytes: brotliBytes.byteLength,
      gzipBytes: gzipBytes.byteLength
    })
  };
}

function compactCaseAsset(row = {}, compressedAssetsByPath = new Map()) {
  const caseAssetPath = text(row.caseAssetPath || row.case_asset_path);
  return {
    atlasCaseKey: text(row.atlasCaseKey || row.atlas_case_key),
    caseId: text(row.caseId || row.case_id),
    pdbId: text(row.pdbId || row.pdb_id),
    assetFamily: text(row.assetFamily || row.asset_family),
    caseAssetPath,
    compressed: compressedAssetsByPath.get(caseAssetPath) || null
  };
}

function registerLookup(lookup, key, value) {
  const normalized = text(key);
  if (!normalized || lookup[normalized]) return;
  lookup[normalized] = value;
}

export function buildDetailRouteIndexAsset({
  generatedAt = new Date().toISOString(),
  source = {},
  cases = [],
  displayCases = [],
  compressedAssetsByPath = new Map()
} = {}) {
  const lookup = {};
  const entries = [];

  for (const row of cases || []) {
    const asset = compactCaseAsset(row, compressedAssetsByPath);
    if (!asset.caseAssetPath) continue;
    const entry = { kind: 'sourceCase', asset };
    entries.push(entry);
    registerLookup(lookup, asset.atlasCaseKey, entry);
    registerLookup(lookup, asset.caseId, entry);
  }

  for (const row of displayCases || []) {
    if (!isDisplayRow(row)) continue;
    const sources = (row.sourceCaseAssetPaths || [])
      .map((sourceRow) => compactCaseAsset(sourceRow, compressedAssetsByPath))
      .filter((sourceRow) => sourceRow.caseAssetPath);
    if (!sources.length) continue;
    const entry = {
      kind: 'displayCase',
      atlasCaseKey: text(row.atlasCaseKey),
      caseId: text(row.caseId),
      pdbId: text(row.pdbId),
      asset: sources[0],
      sources
    };
    entries.push(entry);
    registerLookup(lookup, entry.atlasCaseKey, entry);
    registerLookup(lookup, entry.caseId, entry);
    registerLookup(lookup, entry.pdbId, entry);
  }

  return {
    schemaVersion: DETAIL_ROUTE_INDEX_SCHEMA_VERSION,
    generatedAt,
    source: {
      entryRoot: 'ANNOJOIN',
      annotationRoot: 'ANNOCONFIDENCE',
      browserLoadsAnnoconfidenceBigTables: false,
      ...source
    },
    caseCount: cases.length,
    displayCaseCount: displayCases.length,
    compression: {
      preferredCodec: 'br',
      fallbackCodec: 'gzip',
      rawJsonFallback: true
    },
    entries,
    lookup
  };
}
