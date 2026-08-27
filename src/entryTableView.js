// entry 浏览入口表的视图层：纯函数，输入归一化行 → 输出 HTML 字符串。
// 无 DOM 副作用、无 fetch。跳转链接由 entryCaseHref 生成，指向静态 case 页树。

import { ENTRY_TABLE_COLUMNS, entryCaseHref, entryEfLinks, rcsbStructureHref, buildEntryTableGroups } from './entryTable.js';
import { renderTechniqueFilterControls } from './annojoinAtlasView.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cellValue(row, columnId) {
  if (columnId === 'nProfiles') return String(row.nProfiles ?? 0);
  return escapeHtml(row[columnId] ?? '');
}

// 把 missingPdbs 入参（Set | Array | null/undefined）归一为 Set。
function toMissingSet(missingPdbs) {
  if (missingPdbs instanceof Set) return missingPdbs;
  if (Array.isArray(missingPdbs)) return new Set(missingPdbs);
  return new Set();
}

function toSet(value) {
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

function renderRow(row, caseBase, missingSet) {
  const caseHref = entryCaseHref(caseBase, row);
  const rcsbHref = rcsbStructureHref(row);
  // 缺页降级：命中缺页集合（逐字节精确，不折叠大小写）则详情页链接强制纯文本，不渲染死链 <a>。
  const isMissing = missingSet.has(row.pdbId);
  const cells = ENTRY_TABLE_COLUMNS.map((col) => {
    if (col.id === 'pdbId') {
      // PDB 列 → RCSB 结构页外链（新窗口）。RCSB 永不缺页，无需降级。
      const label = escapeHtml(row.pdbId);
      const inner = rcsbHref
        ? `<a class="entry-table-link" href="${escapeHtml(rcsbHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label;
      return `<td>${inner}</td>`;
    }
    if (col.id === 'sciName') {
      // Molecule 列 → 站内详情页链接（#entry-case）。有链接且非缺页则 <a>，否则纯文本。
      const label = escapeHtml(row.sciName ?? '');
      const inner = caseHref && !isMissing
        ? `<a class="entry-table-link" href="${escapeHtml(caseHref)}">${label}</a>`
        : label;
      // E/F 2D 热图徽标：按产物存在性渲染，不受 missingSet 影响(产物存在=页面存在)。
      const efLinks = entryEfLinks(caseBase, row)
        .map((l) => `<a class="entry-table-link entry-ef-link entry-ef-link-${l.family.toLowerCase()}" href="${escapeHtml(l.href)}" title="${escapeHtml(l.label)} 2D contact map">${escapeHtml(l.label)}</a>`)
        .join('');
      const efSpan = efLinks ? ` <span class="entry-ef-links">${efLinks}</span>` : '';
      return `<td>${inner}${efSpan}</td>`;
    }
    return `<td>${cellValue(row, col.id)}</td>`;
  }).join('');
  return `<tr>${cells}</tr>`;
}

// 两层折叠分组渲染：外层 partition(RNA class)，内层 sciName(分子名)。
// toggle id 方案：parent:<id> / child:<id>（与 annojoin 一致但用 entry 前缀属性委托，互不干扰）。
// parent 展开才显示其 child 行；child 展开才显示其 chain 数据行。chain 行全保留、不漏行。
// colCount = 数据列数，保证分组表头 colspan 跨满整表。
function renderGroups(rows, caseBase, missingSet, expandedSet) {
  const groups = buildEntryTableGroups(rows);
  const colCount = ENTRY_TABLE_COLUMNS.length;
  const out = [];
  for (const parent of groups) {
    const parentToggleId = `parent:${parent.id}`;
    const parentExpanded = expandedSet.has(parentToggleId);
    out.push(`<tr class="entry-parent-group-row${parentExpanded ? ' is-expanded-group' : ''}" data-entry-group-state="${parentExpanded ? 'expanded' : 'collapsed'}">
      <td class="entry-group-head" colspan="${colCount}">
        <button type="button" class="entry-group-toggle" data-entry-group-toggle="${escapeHtml(parentToggleId)}" aria-expanded="${parentExpanded ? 'true' : 'false'}">${parentExpanded ? '−' : '+'}</button>
        <span class="entry-group-label">${escapeHtml(parent.label)}</span>
        <span class="entry-group-count">${parent.count.toLocaleString()}</span>
      </td>
    </tr>`);
    if (!parentExpanded) continue;
    for (const child of parent.children) {
      const childToggleId = `child:${child.id}`;
      const childExpanded = expandedSet.has(childToggleId);
      out.push(`<tr class="entry-child-group-row${childExpanded ? ' is-expanded-group' : ''}" data-entry-group-state="${childExpanded ? 'expanded' : 'collapsed'}">
        <td class="entry-group-head entry-group-head-child" colspan="${colCount}">
          <button type="button" class="entry-group-toggle" data-entry-group-toggle="${escapeHtml(childToggleId)}" aria-expanded="${childExpanded ? 'true' : 'false'}">${childExpanded ? '−' : '+'}</button>
          <span class="entry-group-label">${escapeHtml(child.label)}</span>
          <span class="entry-group-count">${child.count.toLocaleString()}</span>
        </td>
      </tr>`);
      if (!childExpanded) continue;
      for (const row of child.rows) {
        out.push(renderRow(row, caseBase, missingSet));
      }
    }
  }
  return out.join('');
}

function renderEntryTechniqueFilter(rows, selection) {
  const families = selection.families instanceof Set ? selection.families : new Set(selection.families || []);
  const techniques = selection.techniques instanceof Set ? selection.techniques : new Set(selection.techniques || []);
  const controls = renderTechniqueFilterControls(rows, {
    techniqueFamilies: [...families],
    techniqueNames: [...techniques]
  });
  const clear = families.size || techniques.size
    ? `<button type="button" class="entry-filter-clear" id="clear-entry-technique-filter">Clear filter</button>`
    : '';
  return `${controls}${clear}`;
}

// Entry 只保留一个导出动作：导出当前筛选后的整张表及 profile meta。
function renderExportToolbar() {
  return `<div class="entry-selection-toolbar">
      <a id="export-entry" class="entry-action-btn" href="#" download="foldbridge-entry-filtered.json">Export</a>
    </div>`;
}

// 主渲染。rows=null → loading/error 态由 statusMessage 承载。
// missingPdbs（Set 或 Array，缺省空集合）：命中的 PDB 行降级为纯文本，不渲染死链。
// grouped=true 时按 partition→分子名 两层折叠渲染；expandedGroupIds 控制展开状态。
// totalRowCount：过滤前总行数（用于展示 "N of M"）。
export function renderEntryTablePage({ rows, caseBase = './public/entry-cases', statusMessage = null, missingPdbs = null, grouped = false, expandedGroupIds = null, techniqueSelection = null, totalRowCount = null } = {}) {
  const missingSet = toMissingSet(missingPdbs);
  const expandedSet = toSet(expandedGroupIds);
  const normalizedTechniqueSelection = {
    families: toSet(techniqueSelection?.families),
    techniques: toSet(techniqueSelection?.techniques)
  };
  const head = ENTRY_TABLE_COLUMNS.map((col) => `<th scope="col">${escapeHtml(col.label)}</th>`).join('');
  const totalColCount = ENTRY_TABLE_COLUMNS.length;

  let body;
  if (statusMessage) {
    body = `<tr><td class="entry-table-status ${escapeHtml(statusMessage.tone || '')}" colspan="${totalColCount}">${escapeHtml(statusMessage.text || '')}</td></tr>`;
  } else if (!rows || rows.length === 0) {
    body = `<tr><td class="entry-table-status" colspan="${totalColCount}">No entries.</td></tr>`;
  } else if (grouped) {
    body = renderGroups(rows, caseBase, missingSet, expandedSet);
  } else {
    body = rows.map((row) => renderRow(row, caseBase, missingSet)).join('');
  }

  const count = Array.isArray(rows) ? rows.length : 0;
  const total = Number.isFinite(totalRowCount) ? totalRowCount : count;
  const filterActive = normalizedTechniqueSelection.families.size || normalizedTechniqueSelection.techniques.size;
  const countLabel = filterActive && total !== count
    ? `${count.toLocaleString()} of ${total.toLocaleString()} chains`
    : `${count.toLocaleString()} chains`;
  const controls = statusMessage
    ? ''
    : `${renderEntryTechniqueFilter(rows || [], normalizedTechniqueSelection)}${renderExportToolbar()}`;

  return `<main class="entry-table-page">
    <section class="entry-table-hero">
      <h1>Entry table</h1>
      <p class="entry-table-intro">Browse the database by RNA chain. Each row is one chain (PDB &times; chain); click a PDB to open its case page.</p>
      ${statusMessage ? '' : `<p class="entry-table-count">${countLabel}</p>`}
    </section>
    ${controls}
    <div class="entry-table-wrap">
      <table class="entry-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </main>`;
}
