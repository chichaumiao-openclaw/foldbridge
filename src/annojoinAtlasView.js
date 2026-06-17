import { REQUIRED_ATLAS_CAPABILITIES } from './annojoinAtlasData.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderMetric(label, value, note = '') {
  return `<article class="annojoin-metric">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    ${note ? `<small>${escapeHtml(note)}</small>` : ''}
  </article>`;
}

function capabilitySection(id, title, body) {
  return `<section class="annojoin-panel" data-atlas-capability="${escapeHtml(id)}">
    <div class="annojoin-panel-heading">
      <p class="technology-kicker">Atlas capability</p>
      <h2>${escapeHtml(title)}</h2>
    </div>
    ${body}
  </section>`;
}

function renderCaseRows(cases) {
  if (!cases.length) {
    return `<tr><td colspan="7">No ANNOJOIN cases match the current filters.</td></tr>`;
  }
  return cases.map((row) => `<tr>
    <td><a class="sequence-link" href="#annojoin-atlas?caseId=${encodeURIComponent(row.caseId)}">${escapeHtml(row.pdbId || row.caseId)}</a></td>
    <td>${escapeHtml(row.rnaFamily || 'not annotated')}</td>
    <td>${escapeHtml(row.motif || 'not annotated')}</td>
    <td>${escapeHtml(row.structureClass || 'not annotated')}</td>
    <td>${escapeHtml(row.assayFamilies.join(', ') || 'not annotated')}</td>
    <td>${escapeHtml(row.profileCount)}</td>
    <td>${escapeHtml(row.conflictCandidateCount)}</td>
  </tr>`).join('');
}

function renderFacetBadges(facets) {
  return facets.map((facet) => `<span class="annojoin-badge" title="${escapeHtml(facet.sourceTable)}:${escapeHtml(facet.sourceColumn)}">${escapeHtml(facet.label)}</span>`).join('');
}

function routePreview(value) {
  if (Array.isArray(value)) {
    return { rows: value, totalRows: value.length, pageCount: value.length ? 1 : 0, path: '' };
  }
  return {
    rows: Array.isArray(value?.preview) ? value.preview : [],
    totalRows: value?.totalRows ?? 0,
    pageCount: value?.pageCount ?? 0,
    path: value?.path || ''
  };
}

function renderRoutePageNote(value) {
  const preview = routePreview(value);
  if (!preview.path) return '';
  return `<p class="annojoin-page-note">Previewing ${escapeHtml(preview.rows.length)} of ${escapeHtml(preview.totalRows)} rows. First page asset: <code>${escapeHtml(preview.path)}</code>${preview.pageCount ? ` (${escapeHtml(preview.pageCount)} pages)` : ''}.</p>`;
}

function visualPreview(detail) {
  return detail?.visualPreview || {
    reactivity1d: { points: [] },
    pairArcs: [],
    structureColoring: { points: [] },
    mappedResidues: []
  };
}

function colorForBin(bin) {
  if (bin === 'high') return '#b54b3a';
  if (bin === 'mid') return '#d9a441';
  if (bin === 'low') return '#2f8f6b';
  return '#9aa5a0';
}

function jsonScript(value) {
  return JSON.stringify(value ?? [])
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function renderReactivityTrack(detail) {
  const points = visualPreview(detail).reactivity1d?.points || [];
  if (!points.length) {
    return '<p class="annojoin-page-note">No residue-level reactivity preview is available for this case yet; use the route table for server-side lookup.</p>';
  }
  const bars = points.slice(0, 48).map((point) => {
    const value = Number.isFinite(point.reactivityValue) ? point.reactivityValue : 0;
    const height = Math.max(8, Math.min(100, Math.round(value * 60)));
    return `<span class="annojoin-reactivity-bar" data-reactivity-value="${escapeHtml(point.reactivityValue)}" title="${escapeHtml(`${point.pdbResidue}: ${point.reactivityValue ?? 'missing'}`)}" style="height:${height}%;background:${colorForBin(point.colorBin)}"></span>`;
  }).join('');
  return `<div class="annojoin-reactivity-track" role="img" aria-label="1D residue reactivity preview">${bars}</div>`;
}

function renderPairArcView(detail) {
  const arcs = visualPreview(detail).pairArcs || [];
  if (!arcs.length) {
    return '<p class="annojoin-page-note">No pair-arc preview is available for this case yet; use the pair context route for server-side lookup.</p>';
  }
  const arcPaths = arcs.slice(0, 6).map((arc, index) => {
    const start = Number.isFinite(arc.start) ? arc.start : 1 + (index * 8);
    const end = Number.isFinite(arc.end) ? arc.end : start + 20;
    const x1 = 24 + (index * 26);
    const x2 = Math.min(420, x1 + Math.max(72, Math.min(260, (end - start) * 4)));
    const height = 28 + (index * 16);
    return `<path data-pair-segment="${escapeHtml(arc.segmentLabel)}" d="M ${x1} 110 C ${x1} ${110 - height}, ${x2} ${110 - height}, ${x2} 110" />`;
  }).join('');
  const labels = arcs.slice(0, 3).map((arc) => `<span>${escapeHtml(arc.segmentLabel)} ${escapeHtml(arc.lssStatus)}</span>`).join('');
  return `<div class="annojoin-pair-arc-view">
    <svg class="annojoin-pair-arc-svg" viewBox="0 0 460 130" role="img" aria-label="2D paired and unpaired segment preview">${arcPaths}<line x1="18" y1="110" x2="442" y2="110" /></svg>
    <div class="annojoin-arc-labels">${labels}</div>
  </div>`;
}

function renderStructureColorPreview(detail) {
  const preview = visualPreview(detail).structureColoring || { points: [] };
  const points = preview.points || [];
  if (!points.length) {
    return '<p class="annojoin-page-note">No residue coloring preview is available for this case yet; use the structure route and coordinate key for server-side lookup.</p>';
  }
  const swatches = points.slice(0, 24).map((point) => `<span class="annojoin-color-swatch" data-structure-color-bin="${escapeHtml(point.colorBin)}" title="${escapeHtml(`${point.pdbResidue}: ${point.coordinateKey}`)}" style="background:${colorForBin(point.colorBin)}"></span>`).join('');
  const structureHref = preview.structureUrl || '';
  return `<div class="annojoin-structure-color-preview">
    ${structureHref ? `<div class="annojoin-structure-viewer" data-annojoin-structure-viewer data-structure-url="${escapeHtml(structureHref)}">
      <canvas class="annojoin-structure-canvas" width="640" height="360" aria-label="Interactive 3D residue coloring preview"></canvas>
      <div class="annojoin-structure-viewer-footer">
        <span data-annojoin-structure-status>Loading mmCIF coordinates...</span>
        <span>Drag to rotate</span>
      </div>
      <script type="application/json" data-annojoin-structure-colors>${jsonScript(points)}</script>
    </div>` : ''}
    <div class="annojoin-color-strip">${swatches}</div>
    ${structureHref ? `<p class="annojoin-page-note"><a class="download-outline-btn" href="${escapeHtml(structureHref)}">Open mmCIF</a> Route source: <code>${escapeHtml(preview.structureFilePath)}</code>.</p>` : ''}
    <p class="annojoin-page-note">Color key: <code>${escapeHtml(preview.coordinateKeyColumn || 'pdb_residue_coordinate_key')}</code>; value: <code>${escapeHtml(preview.valueColumn || 'reactivity_value')}</code>.</p>
  </div>`;
}

function renderProfiles(detail) {
  const preview = routePreview(detail?.memberships);
  const rows = preview.rows.slice(0, 8).map((row) => `<tr>
    <td>${escapeHtml(row.pairId)}</td>
    <td><code>${escapeHtml(row.profileId)}</code></td>
    <td>${escapeHtml(row.routeId || detail.profileMembershipRouteId)}</td>
  </tr>`).join('');
  return `<div class="download-table-wrap">
    <table class="structure-table download-table">
      <caption>Complete profile membership is read through ${escapeHtml(detail?.profileMembershipRouteId || 'anno_case_profile_membership.tsv')} when the search preview is bounded.</caption>
      <thead><tr><th>Pair</th><th>Profile ID</th><th>Membership route</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">No profile membership preview loaded.</td></tr>'}</tbody>
    </table>
  </div>${renderRoutePageNote(detail?.memberships)}`;
}

function renderTrackRows(detail) {
  return routePreview(detail?.trackRoutes).rows.slice(0, 5).map((row) => `<tr>
    <td>${escapeHtml(row.trackRouteId)}</td>
    <td>${escapeHtml(row.trackDataPath)}</td>
    <td>${escapeHtml(row.colorPolicyId)}</td>
  </tr>`).join('') || '<tr><td colspan="3">No 1D route preview loaded.</td></tr>';
}

function renderPairRows(detail) {
  return routePreview(detail?.pairContextRoutes).rows.slice(0, 5).map((row) => `<tr>
    <td>${escapeHtml(row.contextRouteId)}</td>
    <td>${escapeHtml(row.pairContextDataPath)}</td>
    <td>${row.supportsPairArcView ? 'pair arc' : ''}${row.supportsResidueHover ? ' + residue hover' : ''}${row.supportsDotBracketView ? ' + dot-bracket' : ''}</td>
  </tr>`).join('') || '<tr><td colspan="3">No 2D route preview loaded.</td></tr>';
}

function renderStructureRows(detail) {
  return routePreview(detail?.structureRoutes).rows.slice(0, 5).map((row) => `<tr>
    <td>${escapeHtml(row.structureFilePath)}</td>
    <td>${row.structureUrl ? `<a href="${escapeHtml(row.structureUrl)}">Open mmCIF</a>` : 'not available'}</td>
    <td>${escapeHtml(row.residueColoringDataPath)}</td>
    <td>${escapeHtml(row.coordinateKeyColumn)}</td>
  </tr>`).join('') || '<tr><td colspan="4">No 3D route preview loaded.</td></tr>';
}

function renderMappedResidueRows(detail) {
  const track = routePreview(detail?.trackRoutes).rows[0];
  const structure = routePreview(detail?.structureRoutes).rows[0];
  const rows = (visualPreview(detail).mappedResidues || []).slice(0, 10).map((row) => `<tr>
    <td>${escapeHtml(row.pdbResidue)}</td>
    <td>${escapeHtml(row.rmdbPosition ?? '')}</td>
    <td>${escapeHtml(row.reactivityValue ?? '')}</td>
    <td>${escapeHtml(row.numericStatus)}</td>
    <td><code>${escapeHtml(row.coordinateKey)}</code></td>
  </tr>`).join('');
  return `<div class="annojoin-residue-map">
    ${renderMetric('Table route', detail?.detailRoutes?.mappingTableRouteId || 'annojoin mapping route')}
    ${renderMetric('Numeric path', track?.trackDataPath || 'ANNOCONFIDENCE/assay_numeric_usability_annotation.tsv')}
    ${renderMetric('Coordinate key', structure?.coordinateKeyColumn || 'pdb_residue_coordinate_key')}
    ${renderMetric('Value column', structure?.valueColumn || 'reactivity_value')}
  </div>
  <div class="download-table-wrap">
    <table class="structure-table download-table">
      <caption>Mapped residue preview rows</caption>
      <thead><tr><th>PDB residue</th><th>RMDB pos</th><th>Value</th><th>Numeric status</th><th>Coordinate key</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No residue-level mapped preview loaded.</td></tr>'}</tbody>
    </table>
  </div>`;
}

function renderPresets(state) {
  return state.presets.map((preset) => `<article class="annojoin-preset">
    <h3>${escapeHtml(preset.name)}</h3>
    <p>${escapeHtml(preset.description || preset.filterExpression)}</p>
    <code>${escapeHtml(preset.filterExpression || preset.id)}</code>
    ${preset.warningText ? `<small>${escapeHtml(preset.warningText)}</small>` : ''}
  </article>`).join('') || '<p>No preset definitions loaded.</p>';
}

function renderConflicts(detail) {
  return routePreview(detail?.conflicts).rows.slice(0, 8).map((row) => `<tr>
    <td>${escapeHtml(row.type || row.id)}</td>
    <td>${escapeHtml(row.status)}</td>
    <td>${escapeHtml(row.fecClaimCeiling)}</td>
    <td>${escapeHtml(row.reviewPriorityHint)}</td>
  </tr>`).join('') || '<tr><td colspan="4">No conflict candidate preview loaded for this case.</td></tr>';
}

function renderDownloads(state) {
  return state.downloads.map((download) => `<tr>
    <td>${escapeHtml(download.label)}</td>
    <td>${escapeHtml(download.filePath)}</td>
    <td>${escapeHtml(download.rowCount)}</td>
    <td><code>${escapeHtml(download.sha256 || 'pending dynamic export')}</code></td>
  </tr>`).join('') || '<tr><td colspan="4">No download manifest loaded.</td></tr>';
}

function currentFilterExportHref(filters = {}, format = 'csv') {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.rnaFamily) params.set('rnaFamily', filters.rnaFamily);
  if (filters.probeType) params.set('probeType', filters.probeType);
  if (filters.pdbId) params.set('pdbId', filters.pdbId);
  if (filters.motif) params.set('motif', filters.motif);
  if (filters.structureClass) params.set('structureClass', filters.structureClass);
  params.set('format', format);
  return `/api/annojoin/export-current-filter?${params.toString()}`;
}

export function renderAnnojointAtlasPage({ state, detail } = {}) {
  const atlasState = state || { cases: [], facets: [], presets: [], downloads: [], source: {}, totalCaseCount: 0 };
  const selectedDetail = detail || null;
  const firstCase = atlasState.cases[0];
  const detailLabel = selectedDetail?.caseId || firstCase?.caseId || 'No case selected';

  return `<main class="page-annojoin-atlas page-download-sequences">
    <section class="annojoin-hero">
      <p class="technology-kicker">FoldBridge Atlas</p>
      <h1>ANNOCONFIDENCE / ANNOJOIN Atlas</h1>
      <p class="pdb-case-lede">ANNOJOIN is the browser-facing entry for search, route indexes, presets, and downloads. ANNOCONFIDENCE stays server-side or route-lazy for large annotation tables.</p>
      <div class="pdb-case-status-grid">
        ${renderMetric('Entry root', atlasState.source?.entryRoot || 'ANNOJOIN')}
        ${renderMetric('Cases loaded', `${atlasState.cases.length} / ${atlasState.totalCaseCount || atlasState.cases.length}`)}
        ${renderMetric('Facets', atlasState.facets.length)}
        ${renderMetric('Browser big-table load', atlasState.source?.browserLoadsAnnoconfidenceBigTables ? 'blocked' : 'off')}
      </div>
    </section>

    ${capabilitySection(REQUIRED_ATLAS_CAPABILITIES[0].id, REQUIRED_ATLAS_CAPABILITIES[0].label, `
      <div class="annojoin-searchbar">
        <input type="search" id="annojoin-search-input" placeholder="Search PDB, RNA family, motif, probe type..." value="${escapeHtml(atlasState.filters?.query || '')}" />
        <a class="download-outline-btn" href="#annojoin-atlas">Reset</a>
      </div>
      <div class="download-table-wrap">
        <table class="structure-table download-table annojoin-case-table">
          <thead><tr><th>PDB</th><th>RNA family</th><th>Motif</th><th>Structure class</th><th>Probe family</th><th>Profiles</th><th>Conflicts</th></tr></thead>
          <tbody>${renderCaseRows(atlasState.cases)}</tbody>
        </table>
      </div>
    `)}

    ${capabilitySection(REQUIRED_ATLAS_CAPABILITIES[1].id, REQUIRED_ATLAS_CAPABILITIES[1].label, `
      <div class="annojoin-badge-row">${renderFacetBadges(atlasState.facets)}</div>
      <div class="annojoin-filter-grid">
        <label>RNA family<input data-annojoin-filter="rnaFamily" type="search" value="${escapeHtml(atlasState.filters?.rnaFamily || '')}" /></label>
        <label>Probe type<input data-annojoin-filter="probeType" type="search" value="${escapeHtml(atlasState.filters?.probeType || '')}" /></label>
        <label>PDB ID<input data-annojoin-filter="pdbId" type="search" value="${escapeHtml(atlasState.filters?.pdbId || '')}" /></label>
        <label>Motif<input data-annojoin-filter="motif" type="search" value="${escapeHtml(atlasState.filters?.motif || '')}" /></label>
        <label>Structure class<input data-annojoin-filter="structureClass" type="search" value="${escapeHtml(atlasState.filters?.structureClass || '')}" /></label>
      </div>
      <p>Facet metadata comes from <code>ANNOJOIN/anno_facet_catalog.tsv</code>; probe type points to server-side numeric annotation instead of a browser-loaded ANNOCONFIDENCE table.</p>
    `)}

    <section class="annojoin-detail-grid">
      <div class="annojoin-detail-summary">
        <p class="technology-kicker">Selected case</p>
        <h2>${escapeHtml(detailLabel)}</h2>
        <div class="annojoin-residue-map">
          ${renderMetric('Summary route', selectedDetail?.summary?.summaryRouteId || 'not loaded')}
          ${renderMetric('Detail route', selectedDetail?.detailRoutes?.detailRouteId || 'not loaded')}
          ${renderMetric('Profile count', selectedDetail?.profileCount ?? 'not loaded')}
          ${renderMetric('Preset', selectedDetail?.summary?.recommendedDefaultPreset || 'not loaded')}
        </div>
      </div>
      <div class="annojoin-detail-summary">
        <p class="technology-kicker">Profile membership</p>
        <h2>Bounded preview boundary</h2>
        <p><code>profile_ids</code> is a preview; complete rows come from <code>ANNOJOIN/anno_case_profile_membership.tsv</code>.</p>
      </div>
    </section>

    ${capabilitySection(REQUIRED_ATLAS_CAPABILITIES[2].id, REQUIRED_ATLAS_CAPABILITIES[2].label, `
      ${renderReactivityTrack(selectedDetail)}
      <div class="download-table-wrap"><table class="structure-table download-table">
        <thead><tr><th>Track route</th><th>Data path</th><th>Color policy</th></tr></thead>
        <tbody>${renderTrackRows(selectedDetail)}</tbody>
      </table></div>
      ${renderRoutePageNote(selectedDetail?.trackRoutes)}
    `)}

    ${capabilitySection(REQUIRED_ATLAS_CAPABILITIES[3].id, REQUIRED_ATLAS_CAPABILITIES[3].label, `
      ${renderPairArcView(selectedDetail)}
      <div class="download-table-wrap"><table class="structure-table download-table">
        <thead><tr><th>2D route</th><th>Context path</th><th>View support</th></tr></thead>
        <tbody>${renderPairRows(selectedDetail)}</tbody>
      </table></div>
      ${renderRoutePageNote(selectedDetail?.pairContextRoutes)}
    `)}

    ${capabilitySection(REQUIRED_ATLAS_CAPABILITIES[4].id, REQUIRED_ATLAS_CAPABILITIES[4].label, `
      ${renderStructureColorPreview(selectedDetail)}
      <div class="download-table-wrap"><table class="structure-table download-table">
        <thead><tr><th>mmCIF route path</th><th>Generated mmCIF</th><th>Coloring path</th><th>Residue key</th></tr></thead>
        <tbody>${renderStructureRows(selectedDetail)}</tbody>
      </table></div>
      ${renderRoutePageNote(selectedDetail?.structureRoutes)}
    `)}

    ${capabilitySection(REQUIRED_ATLAS_CAPABILITIES[5].id, REQUIRED_ATLAS_CAPABILITIES[5].label, `
      ${renderMappedResidueRows(selectedDetail)}
      ${renderProfiles(selectedDetail)}
    `)}

    ${capabilitySection(REQUIRED_ATLAS_CAPABILITIES[6].id, REQUIRED_ATLAS_CAPABILITIES[6].label, `
      <div class="annojoin-preset-grid">${renderPresets(atlasState)}</div>
    `)}

    ${capabilitySection(REQUIRED_ATLAS_CAPABILITIES[7].id, REQUIRED_ATLAS_CAPABILITIES[7].label, `
      <div class="download-table-wrap"><table class="structure-table download-table">
        <thead><tr><th>Candidate</th><th>Status</th><th>Claim ceiling</th><th>Review hint</th></tr></thead>
        <tbody>${renderConflicts(selectedDetail)}</tbody>
      </table></div>
      ${renderRoutePageNote(selectedDetail?.conflicts)}
    `)}

    ${capabilitySection(REQUIRED_ATLAS_CAPABILITIES[8].id, REQUIRED_ATLAS_CAPABILITIES[8].label, `
      <p>Static downloads come from <code>ANNOJOIN/atlas_download_manifest.tsv</code>. The current-filter export is generated by the FoldBridge web server from the ANNOJOIN case universe and records the active filter expression plus source version.</p>
      <div class="annojoin-export-actions">
        <a class="download-outline-btn" href="${escapeHtml(currentFilterExportHref(atlasState.filters, 'csv'))}">Download filtered CSV</a>
        <a class="download-outline-btn" href="${escapeHtml(currentFilterExportHref(atlasState.filters, 'json'))}">Download filtered JSON</a>
      </div>
      <div class="download-table-wrap"><table class="structure-table download-table">
        <thead><tr><th>Download</th><th>Path</th><th>Rows</th><th>SHA256</th></tr></thead>
        <tbody>${renderDownloads(atlasState)}</tbody>
      </table></div>
    `)}
  </main>`;
}
