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

function hasStructureUrl(detail) {
  const route = firstRows(detail?.structureRoutes)[0] || {};
  const preview = detail?.visualPreview?.structureColoring || {};
  return text(route.structureFilePath).startsWith('CONFIDENCE/10_structure_context/')
    && text(route.structureUrl).startsWith('/api/annojoin/structure?path=')
    && text(preview.structureUrl).startsWith('/api/annojoin/structure?path=');
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
  if (!hasVisual(detail)) failures.push('missing visual preview for 1D/2D/3D/mapped residues');
  if (detail?.annotationPayloadRowsCopied !== 0) failures.push('annotation payload rows copied into browser asset');
  return failures.map((message) => ({ caseId, message }));
}

export async function runAnnojointAtlasSmoke({ assetRoot, sampleSize = 20 } = {}) {
  const root = path.resolve(assetRoot || 'src/assets/generated/annojoin-atlas');
  const index = await readJson(path.join(root, 'index.json'));
  const cases = Array.isArray(index.cases) ? index.cases : [];
  const sampled = sampleCases(cases, sampleSize);
  const failures = [];

  if (index.source?.entryRoot !== 'ANNOJOIN') failures.push({ caseId: '', message: 'entry root is not ANNOJOIN' });
  if (index.source?.browserLoadsAnnoconfidenceBigTables !== false) failures.push({ caseId: '', message: 'browser big-table load is not disabled' });
  if ((index.facets || []).length < 12) failures.push({ caseId: '', message: 'facet count below 12' });
  if ((index.presets || []).length < 6) failures.push({ caseId: '', message: 'preset count below 6' });
  if (!(index.downloads || []).length) failures.push({ caseId: '', message: 'download manifest missing' });
  if (sampled.length < sampleSize) failures.push({ caseId: '', message: `sampled ${sampled.length}, expected ${sampleSize}` });

  for (const row of sampled) {
    const caseId = text(row.caseId);
    const assetPath = row.caseAssetPath || `cases/${caseId}.json`;
    const detail = await readJson(path.join(root, assetPath));
    failures.push(...checkCase(detail, caseId));
  }

  return {
    status: failures.length ? 'fail' : 'pass',
    source: index.source || {},
    browserLoadsAnnoconfidenceBigTables: index.source?.browserLoadsAnnoconfidenceBigTables,
    totalCaseCount: cases.length,
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
