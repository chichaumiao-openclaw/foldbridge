// entry 浏览入口表的视图层：纯函数，输入归一化行 → 输出 HTML 字符串。
// 无 DOM 副作用、无 fetch。跳转链接由 entryCaseHref 生成（base 占位）。

import { ENTRY_TABLE_COLUMNS, entryCaseHref } from './entryTable.js';

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

function renderRow(row, caseBase) {
  const href = entryCaseHref(caseBase, row);
  const cells = ENTRY_TABLE_COLUMNS.map((col) => {
    if (col.id === 'pdbId') {
      // PDB 列作为跳转入口：有链接则渲染 <a>，否则纯文本（占位不可跳）。
      const label = escapeHtml(row.pdbId);
      const inner = href
        ? `<a class="entry-table-link" href="${escapeHtml(href)}">${label}</a>`
        : label;
      return `<td>${inner}</td>`;
    }
    return `<td>${cellValue(row, col.id)}</td>`;
  }).join('');
  return `<tr>${cells}</tr>`;
}

// 主渲染。rows=null → loading/error 态由 statusMessage 承载。
export function renderEntryTablePage({ rows, caseBase = '#pdb-case', statusMessage = null } = {}) {
  const head = ENTRY_TABLE_COLUMNS
    .map((col) => `<th scope="col">${escapeHtml(col.label)}</th>`)
    .join('');

  let body;
  if (statusMessage) {
    body = `<tr><td class="entry-table-status ${escapeHtml(statusMessage.tone || '')}" colspan="${ENTRY_TABLE_COLUMNS.length}">${escapeHtml(statusMessage.text || '')}</td></tr>`;
  } else if (!rows || rows.length === 0) {
    body = `<tr><td class="entry-table-status" colspan="${ENTRY_TABLE_COLUMNS.length}">No entries.</td></tr>`;
  } else {
    body = rows.map((row) => renderRow(row, caseBase)).join('');
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
