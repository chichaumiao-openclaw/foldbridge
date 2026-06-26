import {
  ANNOJOIN_TABLE_COLUMNS,
  buildAnnojointTableGroups,
  defaultVisibleAnnojointColumnIds,
  familyBadgeDescriptor,
  isAnnojointSearchActive,
  moleculeName,
  normalizeVisibleAnnojointColumnIds,
  paginateAnnojointRows,
  rowCaseId,
  rowCaseKey,
  searchAnnojointRows,
  sortAnnojointCases
} from './annojoinAtlasTableModel.js';

const DEFAULT_GROUP_ROW_LIMIT = 25;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function atlasHref(routeName = 'annojoin-atlas', params = {}) {
  const route = routeName || 'annojoin-atlas';
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  return `#${route}${suffix ? `?${suffix}` : ''}`;
}

function panelHref(routeName = 'annojoin-atlas', row = {}, field = '') {
  const caseId = rowCaseId(row);
  const caseKey = rowCaseKey(row);
  if (row.assetFamily || caseKey.includes(':')) return atlasHref(routeName, { caseKey, field });
  return atlasHref(routeName, { caseId, field });
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

function sourceTitle(source = '') {
  return source ? ` title="${escapeHtml(source)}"` : '';
}

function sourceValue(value = '', source = '') {
  return `<span${sourceTitle(source)}>${escapeHtml(value || 'not annotated')}</span>`;
}

function profileValue(row = {}) {
  const count = Number(row.profileCount) || 0;
  return `${count} ${count === 1 ? 'profile' : 'profiles'}`;
}

function fieldLink(row = {}, routeName = 'annojoin-atlas', field = '', label = '') {
  return `<a class="annojoin-field-link" href="${escapeHtml(panelHref(routeName, row, field))}">${label}</a>`;
}

function rowSourceFamilies(row = {}) {
  if (Array.isArray(row.sourceFamilies) && row.sourceFamilies.length) return row.sourceFamilies;
  return row.assetFamily ? [row.assetFamily] : [];
}

// 来源徽标：RMDB/RASP 激活态由 familyBadgeDescriptor 数据驱动。
// 浏览行、搜索行、侧栏三处共用此 helper（块 5 一致性护栏）。
function renderFamilyBadges(row = {}) {
  const families = rowSourceFamilies(row);
  if (!families.length) return '';
  return `<span class="annojoin-family-badges">${families.map((family) => {
    const descriptor = familyBadgeDescriptor(family);
    const stateClass = descriptor.active ? 'is-active' : 'is-inactive';
    const titleText = descriptor.note ? `${descriptor.label} (${descriptor.note})` : descriptor.label;
    const note = descriptor.note
      ? `<small class="annojoin-family-badge-note">${escapeHtml(descriptor.note)}</small>`
      : '';
    return `<span class="annojoin-family-badge ${stateClass}" title="${escapeHtml(titleText)}">${escapeHtml(descriptor.label)}${note}</span>`;
  }).join('')}</span>`;
}

// confidence 复合标签分段呈现且不截断；完整原文保留在 title，便于追溯与对比。
function renderConfidenceSegments(label = '') {
  const full = String(label ?? '');
  if (!full.trim()) {
    return `<span class="annojoin-confidence" title="not annotated"><span class="annojoin-confidence-seg">not annotated</span></span>`;
  }
  const parts = full.includes(';') ? full.split(';') : [full];
  const segs = parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => `<span class="annojoin-confidence-seg">${escapeHtml(part)}</span>`)
    .join('');
  return `<span class="annojoin-confidence" title="${escapeHtml(full)}">${segs || `<span class="annojoin-confidence-seg">${escapeHtml(full)}</span>`}</span>`;
}

function columnValue(row = {}, columnId, routeName = 'annojoin-atlas') {
  const caseId = rowCaseId(row);
  const values = {
    pdbId: `${fieldLink(row, routeName, 'pdbId', escapeHtml(row.pdbId || caseId))}${renderFamilyBadges(row)}`,
    moleculeName: fieldLink(row, routeName, 'moleculeName', sourceValue(moleculeName(row), row.biologicalMoleculeNameSource || row.pdbMoleculeNameSource)),
    confidenceDisplayLabel: fieldLink(row, routeName, 'confidenceDisplayLabel', renderConfidenceSegments(row.confidenceDisplayLabel || row.fecClaimCeilingDistribution)),
    profileCount: fieldLink(row, routeName, 'profileCount', `<span title="profile_count; profile preview, not a representative profile">${escapeHtml(profileValue(row))}</span>`),
    chains: fieldLink(row, routeName, 'chains', escapeHtml((row.chains || []).join(', ') || 'not annotated')),
    conflictCandidateCount: fieldLink(row, routeName, 'conflictCandidateCount', escapeHtml(row.conflictCandidateCount || 0))
  };
  return values[columnId] ?? escapeHtml(row[columnId] || '');
}

function renderColumnPicker(visibleColumnIds = []) {
  const visible = new Set(visibleColumnIds);
  return `<fieldset class="annojoin-column-picker">
    <legend>Columns</legend>
    ${ANNOJOIN_TABLE_COLUMNS.map((column) => `<label>
      <input type="checkbox" data-annojoin-column-toggle="${escapeHtml(column.id)}" ${visible.has(column.id) ? 'checked' : ''} />
      <span>${escapeHtml(column.label)}</span>
    </label>`).join('')}
  </fieldset>`;
}

function renderPagination(pagination) {
  const prevDisabled = pagination.page <= 1 ? 'disabled' : '';
  const nextDisabled = pagination.page >= pagination.pageCount ? 'disabled' : '';
  return `<section class="annojoin-pagination" aria-label="ANNOJOIN pagination">
    <div>
      <button type="button" class="download-outline-btn" data-annojoin-page="prev" ${prevDisabled}>Previous</button>
      <button type="button" class="download-outline-btn" data-annojoin-page="next" ${nextDisabled}>Next</button>
    </div>
    <span>Page ${escapeHtml(pagination.page)} / ${escapeHtml(pagination.pageCount)}</span>
    <span>Rows ${escapeHtml(pagination.start)}-${escapeHtml(pagination.end)} of ${escapeHtml(pagination.total)}</span>
    <label>Rows per page
      <select id="annojoin-page-size">
        ${[25, 50, 100, 250].map((size) => `<option value="${size}" ${Number(pagination.pageSize) === size ? 'selected' : ''}>${size}</option>`).join('')}
      </select>
    </label>
  </section>`;
}

function renderCaseRow({ row, visibleColumns, selectedCaseIds, routeName, rowClass = '' }) {
  const caseKey = rowCaseKey(row);
  return `<tr class="annojoin-case-row${rowClass ? ` ${rowClass}` : ''}" data-annojoin-case-row="${escapeHtml(caseKey)}">
      <td><input type="checkbox" class="annojoin-case-select" data-annojoin-case-id="${escapeHtml(caseKey)}" ${selectedCaseIds.has(caseKey) ? 'checked' : ''} /></td>
      ${visibleColumns.map((column) => `<td>${columnValue(row, column.id, routeName)}</td>`).join('')}
    </tr>`;
}

function renderFlatRows({ rows, visibleColumns, selectedCaseIds, routeName }) {
  if (!rows.length) return '';
  return rows.map((row) => renderCaseRow({ row, visibleColumns, selectedCaseIds, routeName })).join('');
}

function renderTableBody({
  groups,
  visibleColumns,
  selectedCaseIds,
  expandedGroupIds,
  uncappedGroupIds,
  routeName,
  groupRowLimit = DEFAULT_GROUP_ROW_LIMIT
}) {
  if (!groups.length) {
    return `<tr><td colspan="${visibleColumns.length + 1}">No ANNOJOIN cases match the current filters.</td></tr>`;
  }
  const rows = [];
  const renderRow = (row, rowClass = '') => renderCaseRow({ row, visibleColumns, selectedCaseIds, routeName, rowClass });
  const renderExpandedRows = (caseRows = [], groupToggleId) => {
    const isUncapped = uncappedGroupIds.has(groupToggleId);
    const visibleRows = isUncapped ? caseRows : caseRows.slice(0, groupRowLimit);
    for (const row of visibleRows) {
      rows.push(renderRow(row, 'is-in-expanded-group'));
    }
    if (caseRows.length > groupRowLimit) {
      rows.push(`<tr class="annojoin-group-overflow-row">
        <td colspan="${visibleColumns.length + 1}">
          <button type="button" class="download-outline-btn" data-annojoin-group-page-toggle="${escapeHtml(groupToggleId)}">${isUncapped ? 'Show less' : 'Show all in group'}</button>
          <span>${isUncapped ? `Showing all ${escapeHtml(caseRows.length)} cases in this group` : `Showing ${escapeHtml(groupRowLimit)} of ${escapeHtml(caseRows.length)} cases in this group`}</span>
        </td>
      </tr>`);
    }
  };
  for (const parent of groups) {
    if (parent.count <= 1) {
      parent.children.forEach((child) => child.rows.forEach((row) => rows.push(renderRow(row))));
      continue;
    }
    const parentToggleId = `parent:${parent.id}`;
    const parentExpanded = expandedGroupIds.has(parentToggleId);
    rows.push(`<tr class="annojoin-parent-group-row${parentExpanded ? ' is-expanded-group' : ''}" data-annojoin-parent-group="${escapeHtml(parent.id)}" data-annojoin-group-state="${parentExpanded ? 'expanded' : 'collapsed'}">
      <td colspan="${visibleColumns.length + 1}">
        <button type="button" data-annojoin-group-toggle="${escapeHtml(parentToggleId)}" aria-expanded="${parentExpanded ? 'true' : 'false'}">${parentExpanded ? '-' : '+'}</button>
        <strong>${escapeHtml(parent.label)}</strong>
        <span>${escapeHtml(parent.count)} cases</span>
      </td>
    </tr>`);
    if (!parentExpanded) continue;
    if (parent.children.length === 1) {
      renderExpandedRows(parent.children[0].rows, parentToggleId);
      continue;
    }
    for (const child of parent.children) {
      if (child.count <= 1) {
        child.rows.forEach((row) => rows.push(renderRow(row, 'is-in-expanded-group')));
        continue;
      }
      const childToggleId = `child:${child.id}`;
      const childExpanded = expandedGroupIds.has(childToggleId);
      rows.push(`<tr class="annojoin-child-group-row${childExpanded ? ' is-expanded-group' : ''}" data-annojoin-child-group="${escapeHtml(child.id)}" data-annojoin-group-state="${childExpanded ? 'expanded' : 'collapsed'}">
        <td colspan="${visibleColumns.length + 1}">
          <button type="button" data-annojoin-group-toggle="${escapeHtml(childToggleId)}" aria-expanded="${childExpanded ? 'true' : 'false'}">${childExpanded ? '-' : '+'}</button>
          <span>${escapeHtml(child.label)}</span>
          <small>${escapeHtml(child.count)} cases</small>
        </td>
      </tr>`);
      if (!childExpanded) continue;
      renderExpandedRows(child.rows, childToggleId);
    }
  }
  return rows.join('');
}

function sidebarField(label, value, source = '') {
  return `<dt>${escapeHtml(label)}</dt><dd>${sourceValue(value, source)}</dd>`;
}

function renderPanelList(items = []) {
  if (!items.length) return '<p class="mini-note">Current index asset does not provide row-level entries for this field.</p>';
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function sourceCaseEntries(row = {}) {
  return Array.isArray(row.sourceCaseAssetPaths) ? row.sourceCaseAssetPaths.filter((entry) => entry?.atlasCaseKey) : [];
}

function sourceCaseCountLabel(row = {}) {
  const count = Number(row.sourceCaseCount) || sourceCaseEntries(row).length || 0;
  if (!count) return '';
  return `${count} ${count === 1 ? 'source case' : 'source cases'}`;
}

function renderSourceCaseLinks(row = {}) {
  const entries = sourceCaseEntries(row);
  if (!entries.length) return '';
  return `<section class="annojoin-source-case-section">
    <h3>Source cases</h3>
    <ul class="annojoin-source-case-list">
      ${entries.map((entry) => {
        const caseId = entry.caseId || rowCaseId(row);
        const family = entry.familyLabel || entry.assetFamily || 'source';
        const confidence = entry.compactConfidenceLabel || entry.confidenceDisplayLabel || 'confidence not annotated';
        const profiles = Number(entry.profileCount) || 0;
        return `<li>
          <div>
            <strong>${escapeHtml(family)}</strong>
            <span>${escapeHtml(entry.atlasCaseKey)}</span>
            <small>${escapeHtml(`${profiles} ${profiles === 1 ? 'profile' : 'profiles'}; ${confidence}`)}</small>
          </div>
          <a class="download-outline-btn" href="${escapeHtml(atlasHref('annojoin-case', { caseId, caseKey: entry.atlasCaseKey }))}">Open detail page</a>
        </li>`;
      }).join('')}
    </ul>
  </section>`;
}

function renderProfileTraceRows(traces = []) {
  const rows = (traces || []).filter(Boolean);
  if (!rows.length) {
    return '<p class="mini-note">Current index asset does not provide reproducible RDAT trace rows for this case.</p>';
  }
  return `<div class="annojoin-profile-trace-list" role="region" aria-label="Reproducible profile trace rows">
    <table>
      <thead><tr><th>Pair</th><th>RDAT file</th><th>Trace</th></tr></thead>
      <tbody>
        ${rows.map((entry) => {
          const traceLabel = entry.rdatLine
            ? `line ${entry.rdatLine}`
            : entry.rdatRecord || entry.profileId || entry.traceType || 'route profile';
          const title = entry.rdatPath || entry.profileId || '';
          return `<tr>
            <td>${escapeHtml(entry.pairId || 'case-level')}</td>
            <td title="${escapeHtml(title)}">${escapeHtml(entry.rdatFile || entry.rdatPath || 'route profile')}</td>
            <td>${escapeHtml(traceLabel)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

function renderEmptySidebar() {
  return `<aside class="annojoin-detail-sidebar annojoin-detail-sidebar-empty" aria-label="ANNOJOIN field explanation">
    <p class="technology-kicker">Field inspector</p>
    <h2>Click a table field</h2>
    <p>Molecule, confidence, PDB, profiles, chains, and conflicts each open a focused explanation here.</p>
  </aside>`;
}

function renderMoleculePanel(row, routeName) {
  const caseId = rowCaseId(row);
  const caseKey = rowCaseKey(row);
  const detailParams = row.assetFamily || caseKey.includes(':') ? { caseId, caseKey } : { caseId };
  const entries = sourceCaseEntries(row);
  const isMergedDisplayRow = row.isMergedDisplayRow || entries.length > 1;
  return `<aside class="annojoin-detail-sidebar" aria-label="ANNOJOIN index row detail">
    <div class="annojoin-detail-sidebar-head">
      <div>
        <p class="technology-kicker">Index row detail</p>
        <h2>${escapeHtml(moleculeName(row))}</h2>
      </div>
      ${isMergedDisplayRow
    ? `<span class="mini-note">${escapeHtml(sourceCaseCountLabel(row))}</span>`
    : `<a class="download-outline-btn" href="${escapeHtml(atlasHref('annojoin-case', detailParams))}">Open detail page</a>`}
    </div>
    <dl>
      ${sidebarField('Molecule name', moleculeName(row), row.biologicalMoleculeNameSource || row.pdbMoleculeNameSource)}
      ${sidebarField('Biological source value', row.biologicalMoleculeName, row.biologicalMoleculeNameSource)}
      ${sidebarField('PDB source value', row.pdbMoleculeName, row.pdbMoleculeNameSource)}
      ${sidebarField('Confidence distribution', row.confidenceDisplayLabel || row.fecClaimCeilingDistribution, row.confidenceSource || 'fec_claim_ceiling_distribution')}
      <dt>Profiles</dt><dd>${escapeHtml(profileValue(row))}</dd>
      <dt>Chains</dt><dd>${escapeHtml((row.chains || []).join(', ') || 'not annotated')}</dd>
    </dl>
    ${isMergedDisplayRow ? renderSourceCaseLinks(row) : ''}
  </aside>`;
}

function renderConfidencePanel(row) {
  const hasContext = row.hasContextAnnotation ? 'context annotation present' : 'context annotation not present';
  const hasLss = row.hasLssAnnotation ? 'LSS annotation present' : 'LSS annotation not present';
  const entries = sourceCaseEntries(row);
  return `<aside class="annojoin-detail-sidebar" aria-label="ANNOJOIN confidence explanation">
    <p class="technology-kicker">Confidence classification</p>
    <h2>${escapeHtml(row.confidenceDisplayLabel || 'not annotated')}</h2>
    <p>This is a case-level distribution, not a best-profile confidence score.</p>
    <dl>
      ${sidebarField('Current case', row.confidenceDisplayLabel || row.fecClaimCeilingDistribution, row.confidenceSource || 'fec_claim_ceiling_distribution')}
      <dt>Annotation coverage</dt><dd>${escapeHtml(`${hasContext}; ${hasLss}`)}</dd>
      <dt>Coverage topology</dt><dd>${escapeHtml(row.coverageShapeDistribution || 'Current index asset points to ANNOCONFIDENCE coverage topology annotations.')}</dd>
    </dl>
    ${entries.length > 1 ? renderSourceCaseLinks(row) : ''}
    <p class="mini-note">A/B/C labels summarize confidence-relevant annotation support. C-level labels are exploratory hints and should be reviewed with the underlying route assets.</p>
  </aside>`;
}

function renderPdbPanel(row) {
  const pdbId = row.pdbId || rowCaseId(row);
  return `<aside class="annojoin-detail-sidebar" aria-label="ANNOJOIN PDB metadata">
    <p class="technology-kicker">PDB metadata</p>
    <h2>${escapeHtml(pdbId)}${renderFamilyBadges(row)}</h2>
    <dl>
      ${sidebarField('Author-provided molecule name', row.pdbMoleculeName, row.pdbMoleculeNameSource)}
      <dt>Published article</dt><dd>Current index asset does not provide citation metadata.</dd>
      <dt>Chains</dt><dd>${escapeHtml((row.chains || []).join(', ') || 'not annotated')} (${escapeHtml((row.chains || []).length)} chains listed)</dd>
    </dl>
    <p><a class="download-outline-btn" href="https://www.rcsb.org/structure/${escapeHtml(pdbId)}" target="_blank" rel="noreferrer">Open in RCSB</a></p>
  </aside>`;
}

function renderProfilesPanel(row) {
  const entries = sourceCaseEntries(row);
  return `<aside class="annojoin-detail-sidebar" aria-label="ANNOJOIN profile hits">
    <p class="technology-kicker">Profile hits</p>
    <h2>${escapeHtml(profileValue(row))}</h2>
    <p>Profiles are source signal records linked to this case. They are membership evidence, not representative best profiles.</p>
    ${entries.length > 1 ? renderSourceCaseLinks(row) : ''}
    <h3>RDAT trace</h3>
    ${renderProfileTraceRows(row.profileTracePreview || [])}
    <h3>RASP profiles</h3>
    <p class="mini-note">RASP hit details are not present in the current index asset. A later join should provide species, genome, feature, and coordinate fields.</p>
  </aside>`;
}

function renderChainsPanel(row) {
  return `<aside class="annojoin-detail-sidebar" aria-label="ANNOJOIN chain definitions">
    <p class="technology-kicker">Chain definitions</p>
    <h2>${escapeHtml((row.chains || []).join(', ') || 'not annotated')}</h2>
    <p>Chains are PDB chain identifiers associated with this ANNOJOIN case.</p>
    <pre class="annojoin-sequence-box">Chain sequences are not present in the current index asset.</pre>
  </aside>`;
}

function renderConflictsPanel(row) {
  const count = Number(row.conflictCandidateCount) || 0;
  return `<aside class="annojoin-detail-sidebar" aria-label="ANNOJOIN conflict candidates">
    <p class="technology-kicker">Conflict candidates</p>
    <h2>${escapeHtml(count)} conflict candidates</h2>
    <p>Conflicts mark cases where annotation or evidence routes may need review before interpretation.</p>
    <p class="mini-note">${count ? 'This case has at least one review candidate in the ANNOJOIN conflict index.' : 'No review candidate is listed for this case in the current index.'}</p>
  </aside>`;
}

function renderDetailSidebar({ row, routeName, selectedField }) {
  if (!row || !selectedField) return renderEmptySidebar();
  if (selectedField === 'moleculeName') return renderMoleculePanel(row, routeName);
  if (selectedField === 'confidenceDisplayLabel') return renderConfidencePanel(row);
  if (selectedField === 'pdbId') return renderPdbPanel(row);
  if (selectedField === 'profileCount') return renderProfilesPanel(row);
  if (selectedField === 'chains') return renderChainsPanel(row);
  if (selectedField === 'conflictCandidateCount') return renderConflictsPanel(row);
  return renderEmptySidebar();
}

const ANNOJOIN_FILTER_CHIP_KEYS = ['rnaFamily', 'pdbId', 'motif', 'structureClass', 'probeType'];

function renderFilterChip(removeKey, label) {
  return `<span class="annojoin-filter-chip">${escapeHtml(label)} <button type="button" data-annojoin-chip-remove="${escapeHtml(removeKey)}">×</button></span>`;
}

function renderActiveConditionChips(filters = {}, query = '') {
  const chips = [];
  if (query) chips.push(renderFilterChip('q', `"${query}"`));
  for (const key of ANNOJOIN_FILTER_CHIP_KEYS) {
    const value = filters?.[key];
    if (value) chips.push(renderFilterChip(key, value));
  }
  if (!chips.length) return '';
  return `<section class="annojoin-filter-chips" aria-label="Active conditions">
      ${chips.join('')}
      <button type="button" data-annojoin-clear-all>Clear all</button>
    </section>`;
}

export function renderAnnojointAtlasPage({
  state,
  routeName = 'annojoin-atlas',
  selectedCaseIds = new Set(),
  collapsedGroupIds = new Set(),
  expandedGroupIds,
  uncappedGroupIds = new Set(),
  visibleColumnIds,
  page = 1,
  pageSize = 50,
  selectedCaseId = '',
  selectedCaseKey = '',
  selectedField = ''
} = {}) {
  const atlasState = state || { cases: [], source: {}, totalCaseCount: 0, filters: {} };
  const selected = selectedCaseIds instanceof Set ? selectedCaseIds : new Set(selectedCaseIds || []);
  const expanded = expandedGroupIds instanceof Set ? expandedGroupIds : new Set(expandedGroupIds || []);
  const uncapped = uncappedGroupIds instanceof Set ? uncappedGroupIds : new Set(uncappedGroupIds || []);
  const visibleIds = visibleColumnIds ? normalizeVisibleAnnojointColumnIds(visibleColumnIds) : defaultVisibleAnnojointColumnIds();
  const visibleColumns = ANNOJOIN_TABLE_COLUMNS.filter((column) => visibleIds.includes(column.id));
  const sortedRows = sortAnnojointCases(atlasState.cases);
  const query = atlasState.filters?.query || '';
  const searchActive = isAnnojointSearchActive(query);
  const baseRows = searchActive ? searchAnnojointRows(sortedRows, query) : sortedRows;
  const pagination = paginateAnnojointRows(baseRows, { page, pageSize });
  const groups = searchActive ? [] : buildAnnojointTableGroups(pagination.rows);
  const detailKey = String(selectedCaseKey || selectedCaseId || '').toUpperCase();
  const detailRow = detailKey
    ? sortedRows.find((row) => rowCaseKey(row).toUpperCase() === detailKey || rowCaseId(row).toUpperCase() === detailKey)
    : null;

  const searchModeNotice = searchActive && pagination.rows.length
    ? `<section class="annojoin-search-mode-banner" role="status">
      <span>Search results for "${escapeHtml(query)}" — grouping is flattened and rows are ranked by match.</span>
      <button type="button" class="download-outline-btn" data-annojoin-clear-search>Clear search</button>
    </section>`
    : '';

  const emptySearchRow = searchActive && !pagination.rows.length
    ? `<tr class="annojoin-empty-search-row"><td colspan="${visibleColumns.length + 1}">
      <p>No entries match "${escapeHtml(query)}". Check the PDB ID, or try a molecule name.</p>
      <button type="button" class="download-outline-btn" data-annojoin-clear-search>Clear search</button>
    </td></tr>`
    : '';

  const tableBody = searchActive
    ? (emptySearchRow || renderFlatRows({ rows: pagination.rows, visibleColumns, selectedCaseIds: selected, routeName }))
    : renderTableBody({ groups, visibleColumns, selectedCaseIds: selected, expandedGroupIds: expanded, uncappedGroupIds: uncapped, routeName });

  const matched = baseRows;
  const displayCount = atlasState.totalCaseCount || atlasState.cases.length;
  const sourceCount = atlasState.totalSourceCaseCount;
  const metaCountText = searchActive
    ? `Showing ${escapeHtml(matched.length)} of ${escapeHtml(displayCount)} entries matching "${escapeHtml(query)}"`
    : `${escapeHtml(displayCount)} PDB entries${sourceCount ? ` (${escapeHtml(sourceCount)} source cases)` : ''}`;

  const searchModeNote = searchActive
    ? `<p class="annojoin-search-mode-note">Search results — grouping is paused. Clear the filter to return to grouped browsing.</p>`
    : '';

  return `<main class="page-annojoin-atlas page-annojoin-master-table">
    <section class="annojoin-table-heading">
      <p class="technology-kicker">ANNOJOIN</p>
      <h1>ANNOJOIN master table</h1>
      <p class="pdb-case-lede">PDB-level browser table from <code>ANNOJOIN/anno_case_search_index.tsv</code>. Duplicate RMDB/RASP source cases are summarized into one PDB entry; profile count is not a representative profile, and confidence is a source-level summary.</p>
    </section>

    <section class="annojoin-table-toolbar" aria-label="ANNOJOIN table controls">
      <input type="search" id="annojoin-search-input" placeholder="Filter this table by PDB ID or molecule name" value="${escapeHtml(atlasState.filters?.query || '')}" />
      <button id="export-selected-annojoin-cases" type="button" class="download-outline-btn" ${selected.size ? '' : 'disabled'}>Export Selected (${escapeHtml(selected.size)})</button>
      <a class="download-outline-btn" href="${escapeHtml(currentFilterExportHref(atlasState.filters, 'csv'))}">Export All Results</a>
      <button id="select-visible-annojoin-cases" type="button" class="download-outline-btn">Select Current Page</button>
      <button id="select-all-annojoin-cases" type="button" class="download-outline-btn">Select All Results</button>
      <button id="clear-selected-annojoin-cases" type="button" class="download-outline-btn" ${selected.size ? '' : 'disabled'}>Clear Selection</button>
      <button id="expand-all-annojoin-groups" type="button" class="download-outline-btn">Expand All</button>
      <button id="collapse-all-annojoin-groups" type="button" class="download-outline-btn">Collapse All</button>
      <a class="download-outline-btn" href="${escapeHtml(atlasHref(routeName))}">Reset</a>
    </section>

    ${renderColumnPicker(visibleIds)}
    ${renderActiveConditionChips(atlasState.filters, query)}
    ${searchModeNotice}
    ${renderPagination(pagination)}

    <section class="annojoin-table-meta">
      <span>${metaCountText}</span>
      <span>${escapeHtml(selected.size)} selected</span>
      <span>Case-level profile/confidence summary</span>
    </section>

    ${searchModeNote}

    <section class="annojoin-table-layout">
      <div class="annojoin-master-table-wrap">
        <table class="annojoin-master-table">
          <thead>
            <tr>
              <th>Select</th>
              ${visibleColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
      ${renderDetailSidebar({ row: detailRow, routeName, selectedField })}
    </section>
  </main>`;
}
