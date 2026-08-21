// entry 浏览入口表的视图层：纯函数，输入归一化行 → 输出 HTML 字符串。
// 无 DOM 副作用、无 fetch。跳转链接由 entryCaseHref 生成，指向静态 case 页树。

import { ENTRY_TABLE_COLUMNS, entryCaseHref, buildEntryTableGroups } from './entryTable.js';

// technique 筛选选项：对齐 #probing 页的公开口径（SHAPE/DMS/enzymatic 等）。
// id 与 entry-table.json 的 probing_category 值逐字对应；label 为公开展示名。
// 绝不含内部 family(ABCDEF) 分类。
export const ENTRY_TECHNIQUE_OPTIONS = [
  { id: 'shape-based-probing', label: 'SHAPE' },
  { id: 'dms-based-probing', label: 'DMS' },
  { id: 'enzymatic-probing', label: 'Enzymatic' },
  { id: 'cleavage-footprinting', label: 'Cleavage footprinting' },
  { id: 'carbodiimide', label: 'Carbodiimide' },
  { id: 'rna-protein-interaction', label: 'RNA–protein interaction' },
  { id: 'guanine-specific-probing', label: 'Guanine-specific' }
];

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

// entry 行唯一键：pdbId + TAB + auth（与 main.js entryRowId 保持一致，pdb×chain 唯一）。
function rowId(row) {
  return `${row.pdbId}\t${row.auth}`;
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

// 勾选单元格：checkbox，data-entry-select 承载行唯一键，供 main.js 委托绑定。
function selectCell(row, selectedSet) {
  const id = rowId(row);
  const checked = selectedSet.has(id) ? ' checked' : '';
  return `<td class="entry-select-cell"><input type="checkbox" class="entry-select-box" data-entry-select="${escapeHtml(id)}"${checked} aria-label="Select ${escapeHtml(row.pdbId)} chain ${escapeHtml(row.auth)}"></td>`;
}

function renderRow(row, caseBase, missingSet, selectedSet) {
  const href = entryCaseHref(caseBase, row);
  // 缺页降级：命中缺页集合（逐字节精确，不折叠大小写）则强制纯文本，不渲染死链 <a>。
  const isMissing = missingSet.has(row.pdbId);
  const cells = ENTRY_TABLE_COLUMNS.map((col) => {
    if (col.id === 'pdbId') {
      // PDB 列作为跳转入口：有链接且非缺页则渲染 <a>，否则纯文本（占位不可跳）。
      const label = escapeHtml(row.pdbId);
      const inner = href && !isMissing
        ? `<a class="entry-table-link" href="${escapeHtml(href)}">${label}</a>`
        : label;
      return `<td>${inner}</td>`;
    }
    return `<td>${cellValue(row, col.id)}</td>`;
  }).join('');
  return `<tr>${selectCell(row, selectedSet)}${cells}</tr>`;
}

// 两层折叠分组渲染：外层 partition(RNA class)，内层 sciName(分子名)。
// toggle id 方案：parent:<id> / child:<id>（与 annojoin 一致但用 entry 前缀属性委托，互不干扰）。
// parent 展开才显示其 child 行；child 展开才显示其 chain 数据行。chain 行全保留、不漏行。
// colCount = 列数 + 1（勾选列），保证分组表头 colspan 跨满整表。
function renderGroups(rows, caseBase, missingSet, expandedSet, selectedSet) {
  const groups = buildEntryTableGroups(rows);
  const colCount = ENTRY_TABLE_COLUMNS.length + 1;
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
        out.push(renderRow(row, caseBase, missingSet, selectedSet));
      }
    }
  }
  return out.join('');
}

// technique 筛选栏（对齐 #probing 公开口径）：一排可切换 chip + 清空按钮。
// data-entry-technique-toggle 承载 technique id，供 main.js 委托绑定。
function renderTechniqueFilter(techniqueSet) {
  const chips = ENTRY_TECHNIQUE_OPTIONS.map((opt) => {
    const active = techniqueSet.has(opt.id);
    return `<button type="button" class="entry-technique-chip${active ? ' is-active' : ''}" data-entry-technique-toggle="${escapeHtml(opt.id)}" aria-pressed="${active ? 'true' : 'false'}">${escapeHtml(opt.label)}</button>`;
  }).join('');
  const clearBtn = techniqueSet.size
    ? `<button type="button" class="entry-filter-clear" id="clear-entry-technique-filter">Clear filter</button>`
    : '';
  return `<div class="entry-technique-filter" role="group" aria-label="Filter by probing technique">
      <span class="entry-filter-label">Technique</span>
      ${chips}
      ${clearBtn}
    </div>`;
}

// 选择工具条：导出选中 + 清空选择。
function renderSelectionToolbar(selectedCount) {
  return `<div class="entry-selection-toolbar">
      <button type="button" class="entry-action-btn" id="export-selected-entry"${selectedCount ? '' : ' disabled'}>Download selected (${selectedCount})</button>
      <button type="button" class="entry-action-btn entry-action-secondary" id="clear-selected-entry"${selectedCount ? '' : ' disabled'}>Clear selection</button>
    </div>`;
}

// 主渲染。rows=null → loading/error 态由 statusMessage 承载。
// missingPdbs（Set 或 Array，缺省空集合）：命中的 PDB 行降级为纯文本，不渲染死链。
// grouped=true 时按 partition→分子名 两层折叠渲染；expandedGroupIds 控制展开状态。
// selectedIds（Set/Array）：已勾选行键；techniqueFilter（Set/Array）：已选 technique 筛选。
// totalRowCount：过滤前总行数（用于展示 "N of M"）。
export function renderEntryTablePage({ rows, caseBase = './public/entry-cases', statusMessage = null, missingPdbs = null, grouped = false, expandedGroupIds = null, selectedIds = null, techniqueFilter = null, totalRowCount = null } = {}) {
  const missingSet = toMissingSet(missingPdbs);
  const expandedSet = toSet(expandedGroupIds);
  const selectedSet = toSet(selectedIds);
  const techniqueSet = toSet(techniqueFilter);
  // 勾选列表头（空 <th>）+ 数据列表头。
  const head = `<th scope="col" class="entry-select-head"><span class="visually-hidden">Select</span></th>`
    + ENTRY_TABLE_COLUMNS.map((col) => `<th scope="col">${escapeHtml(col.label)}</th>`).join('');
  const totalColCount = ENTRY_TABLE_COLUMNS.length + 1;

  let body;
  if (statusMessage) {
    body = `<tr><td class="entry-table-status ${escapeHtml(statusMessage.tone || '')}" colspan="${totalColCount}">${escapeHtml(statusMessage.text || '')}</td></tr>`;
  } else if (!rows || rows.length === 0) {
    body = `<tr><td class="entry-table-status" colspan="${totalColCount}">No entries.</td></tr>`;
  } else if (grouped) {
    body = renderGroups(rows, caseBase, missingSet, expandedSet, selectedSet);
  } else {
    body = rows.map((row) => renderRow(row, caseBase, missingSet, selectedSet)).join('');
  }

  const count = Array.isArray(rows) ? rows.length : 0;
  const total = Number.isFinite(totalRowCount) ? totalRowCount : count;
  const countLabel = techniqueSet.size && total !== count
    ? `${count.toLocaleString()} of ${total.toLocaleString()} chains`
    : `${count.toLocaleString()} chains`;
  const controls = statusMessage
    ? ''
    : `${renderTechniqueFilter(techniqueSet)}${renderSelectionToolbar(selectedSet.size)}`;

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
