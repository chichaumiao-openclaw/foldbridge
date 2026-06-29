import { readFile } from 'node:fs/promises';
import path from 'node:path';

function text(value) {
  return String(value ?? '').trim();
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function firstRows(value) {
  return Array.isArray(value?.preview) ? value.preview : [];
}

function hasRows(value) {
  return Number(value?.totalRows || 0) > 0 || firstRows(value).length > 0;
}

function hasVisual(detail) {
  return Boolean(
    detail?.visualPreview?.browserLoadsAnnoconfidenceBigTables === false
      && detail.visualPreview.reactivity1d?.points?.length
      && detail.visualPreview.pairArcs?.length
      && detail.visualPreview.structureColoring?.points?.length
      && detail.visualPreview.mappedResidues?.length
  );
}

function firstPreviewRow(value) {
  return firstRows(value)[0] || {};
}

function routeBlocked(row = {}, blockerCode = '') {
  return text(row.routeAvailabilityStatus || row.route_availability_status) === 'blocked'
    && text(row.blockerCode || row.blocker_code) === blockerCode;
}

function hasDeclaredRaspVisualBlockers(detail) {
  return Boolean(
    hasRows(detail?.trackRoutes)
      && detail?.visualPreview?.browserLoadsAnnoconfidenceBigTables === false
      && routeBlocked(firstPreviewRow(detail?.pairContextRoutes), 'RASP_PUBLIC_2D_CONTEXT_NOT_MATERIALIZED_BLOCKER')
      && routeBlocked(firstPreviewRow(detail?.structureRoutes), 'RASP_PUBLIC_3D_STRUCTURE_ROUTE_NOT_MATERIALIZED_BLOCKER')
  );
}

function hasStructureUrl(detail) {
  const route = firstRows(detail?.structureRoutes)[0] || {};
  const preview = detail?.visualPreview?.structureColoring || {};
  if (routeBlocked(route, 'RASP_PUBLIC_3D_STRUCTURE_ROUTE_NOT_MATERIALIZED_BLOCKER')) return true;
  return text(route.structureFilePath).startsWith('CONFIDENCE/10_structure_context/')
    && text(route.structureUrl).startsWith('/api/annojoin/structure?path=')
    && text(preview.structureUrl).startsWith('/api/annojoin/structure?path=');
}

function hasWebDisplayFields(row) {
  // Web display uses the molecule-name fallback chain (moleculeDisplayName -> raw molecule names);
  // class labels are intentionally optional and may be blanked for placeholder-only rows
  // (e.g. RASP raw-hit cases), which then fold under their molecule name in the master table.
  const moleculeDisplayable = text(row.moleculeDisplayName)
    || text(row.biologicalMoleculeName)
    || text(row.pdbMoleculeName);
  return Boolean(moleculeDisplayable && text(row.confidenceDisplayLabel));
}

function sampleCases(cases, sampleSize) {
  const selected = [];
  const count = Math.min(sampleSize, cases.length);
  if (count <= 0) return selected;
  const step = cases.length / count;
  for (let i = 0; i < count; i += 1) {
    selected.push(cases[Math.floor(i * step)]);
  }
  return selected;
}

function checkCase(detail, caseId) {
  const failures = [];
  if (!detail?.case?.caseId) failures.push('missing case overview');
  if (!detail?.summary?.summaryRouteId) failures.push('missing summary route');
  if (!detail?.detailRoutes?.mappingTableRouteId) failures.push('missing mapping table route');
  if (!hasRows(detail?.memberships)) failures.push('missing profile membership preview');
  if (!hasRows(detail?.trackRoutes)) failures.push('missing 1D track route');
  if (!hasRows(detail?.pairContextRoutes)) failures.push('missing 2D pair context route');
  if (!hasRows(detail?.structureRoutes)) failures.push('missing 3D structure route');
  if (!hasStructureUrl(detail)) failures.push('missing 3D mmCIF structure URL');
  if (!hasVisual(detail) && !hasDeclaredRaspVisualBlockers(detail)) failures.push('missing visual preview for 1D/2D/3D/mapped residues');
  if (detail?.annotationPayloadRowsCopied !== 0) failures.push('annotation payload rows copied into browser asset');
  return failures.map((message) => ({ caseId, message }));
}

// Resolve the per-case detail asset path for a display row the same way the
// browser's annojoinCasePage() does: single rows carry a direct caseAssetPath;
// merged rows (caseAssetPath empty) reach a real asset via sourceCaseAssetPaths.
function resolveCaseAssetPath(row, caseId) {
  if (text(row.caseAssetPath)) return row.caseAssetPath;
  const sources = Array.isArray(row.sourceCaseAssetPaths) ? row.sourceCaseAssetPaths : [];
  for (const source of sources) {
    if (text(source?.caseAssetPath)) return source.caseAssetPath;
  }
  return `cases/${caseId}.json`;
}

export async function runAnnojointAtlasSmoke({ assetRoot, sampleSize = 20 } = {}) {
  const root = path.resolve(assetRoot || 'src/assets/generated/annojoin-atlas');
  const index = await readJson(path.join(root, 'index.json'));
  // The slimmed index (design 2026-06-29) drops the browser-dead top-level
  // `cases` array; displayCases is the array the browser renders. Prefer it,
  // falling back to `cases` for any un-slimmed index.
  const sampleSource = Array.isArray(index.displayCases) && index.displayCases.length
    ? index.displayCases
    : (Array.isArray(index.cases) ? index.cases : []);
  const sampled = sampleCases(sampleSource, sampleSize);
  const failures = [];

  if (index.source?.entryRoot !== 'ANNOJOIN') failures.push({ caseId: '', message: 'entry root is not ANNOJOIN' });
  if (index.source?.browserLoadsAnnoconfidenceBigTables !== false) failures.push({ caseId: '', message: 'browser big-table load is not disabled' });
  if ((index.facets || []).length < 12) failures.push({ caseId: '', message: 'facet count below 12' });
  if ((index.presets || []).length < 6) failures.push({ caseId: '', message: 'preset count below 6' });
  if (!(index.downloads || []).length) failures.push({ caseId: '', message: 'download manifest missing' });
  if (!Array.isArray(index.caseHierarchy) || !index.caseHierarchy.length) failures.push({ caseId: '', message: 'case hierarchy missing' });
  if (sampled.length < sampleSize) failures.push({ caseId: '', message: `sampled ${sampled.length}, expected ${sampleSize}` });

  for (const row of sampled) {
    const caseId = text(row.caseId);
    if (!hasWebDisplayFields(row)) failures.push({ caseId, message: 'missing web display fields in index row' });
    const assetPath = resolveCaseAssetPath(row, caseId);
    const detail = await readJson(path.join(root, assetPath));
    failures.push(...checkCase(detail, caseId));
  }

  return {
    status: failures.length ? 'fail' : 'pass',
    source: index.source || {},
    browserLoadsAnnoconfidenceBigTables: index.source?.browserLoadsAnnoconfidenceBigTables,
    totalCaseCount: sampleSource.length,
    sampledCaseCount: sampled.length,
    sampledCaseIds: sampled.map((row) => row.caseId),
    checkedCapabilities: [
      'searchable-web-interface',
      'facet-search',
      'reactivity-1d',
      'paired-unpaired-2d',
      'residue-coloring-3d',
      'mapped-residue-table',
      'confidence-view-builder',
      'conflict-candidate-viewer',
      'download-current-filter'
    ],
    failures
  };
}
