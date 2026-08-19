// entry 浏览入口表的视图层：纯函数，输入归一化行 → 输出 HTML 字符串。
// 无 DOM 副作用、无 fetch。跳转链接由 entryCaseHref 生成，指向静态 case 页树。

import { ENTRY_TABLE_COLUMNS, entryCaseHref, buildEntryTableGroups } from './entryTable.js';

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

function toExpandedSet(expandedGroupIds) {
  if (expandedGroupIds instanceof Set) return expandedGroupIds;
  if (Array.isArray(expandedGroupIds)) return new Set(expandedGroupIds);
  return new Set();
}

function renderRow(row, caseBase, missingSet) {
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
  return `<tr>${cells}</tr>`;
}

// 两层折叠分组渲染：外层 partition(RNA class)，内层 sciName(分子名)。
// toggle id 方案：parent:<id> / child:<id>（与 annojoin 一致但用 entry 前缀属性委托，互不干扰）。
// parent 展开才显示其 child 行；child 展开才显示其 chain 数据行。chain 行全保留、不漏行。
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

// 主渲染。rows=null → loading/error 态由 statusMessage 承载。
// missingPdbs（Set 或 Array，缺省空集合）：命中的 PDB 行降级为纯文本，不渲染死链。
// grouped=true 时按 partition→分子名 两层折叠渲染；expandedGroupIds 控制展开状态。
export function renderEntryTablePage({ rows, caseBase = './public/entry-cases', statusMessage = null, missingPdbs = null, grouped = false, expandedGroupIds = null } = {}) {
  const missingSet = toMissingSet(missingPdbs);
  const expandedSet = toExpandedSet(expandedGroupIds);
  const head = ENTRY_TABLE_COLUMNS
    .map((col) => `<th scope="col">${escapeHtml(col.label)}</th>`)
    .join('');

  let body;
  if (statusMessage) {
    body = `<tr><td class="entry-table-status ${escapeHtml(statusMessage.tone || '')}" colspan="${ENTRY_TABLE_COLUMNS.length}">${escapeHtml(statusMessage.text || '')}</td></tr>`;
  } else if (!rows || rows.length === 0) {
    body = `<tr><td class="entry-table-status" colspan="${ENTRY_TABLE_COLUMNS.length}">No entries.</td></tr>`;
  } else if (grouped) {
    body = renderGroups(rows, caseBase, missingSet, expandedSet);
  } else {
    body = rows.map((row) => renderRow(row, caseBase, missingSet)).join('');
  }

  const count = Array.isArray(rows) ? rows.length : 0;
  return `<main class="entry-table-page">
    <section class="entry-table-hero">
      <h1>Entry table</h1>
      <p class="entry-table-intro">Browse the database by RNA chain. Each row is one chain (PDB &times; chain); click a PDB to open its case page.</p>
      ${statusMessage ? '' : `<p class="entry-table-count">${count.toLocaleString()} chains</p>`}
    </section>
    <div class="entry-table-wrap">
      <table class="entry-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </main>`;
}
