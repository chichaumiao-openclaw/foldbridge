export function bindAnnojointAtlasTable({
  root = document,
  selectedCaseIds,
  visibleColumnIds,
  pageRows = [],
  rows = [],
  setQuery,
  setPage,
  setPageSize,
  setVisibleColumns,
  exportSelectedRows,
  selectRows,
  clearSelection,
  toggleGroup,
  toggleGroupLimit,
  expandAllGroups,
  collapseAllGroups,
  removeFilter,
  clearFilters,
  rerender
} = {}) {
  const rowCaseKey = (row = {}) => String(row.atlasCaseKey || row.caseKey || row.caseId || row.pdbId || '').trim();
  const searchInput = root.getElementById?.('annojoin-search-input');
  if (searchInput) {
    let debounceTimer = null;
    const apply = () => setQuery?.(searchInput.value.trim());
    searchInput.addEventListener('input', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(apply, 150);
    });
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        if (debounceTimer) clearTimeout(debounceTimer);
        apply();
      }
    });
  }

  root.querySelectorAll?.('[data-annojoin-chip-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      removeFilter?.(button.getAttribute('data-annojoin-chip-remove'));
    });
  });

  root.querySelectorAll?.('[data-annojoin-clear-all]').forEach((button) => {
    button.addEventListener('click', () => clearFilters?.());
  });

  root.querySelectorAll?.('[data-annojoin-clear-search]').forEach((button) => {
    button.addEventListener('click', () => removeFilter?.('q'));
  });

  root.querySelectorAll?.('[data-annojoin-page]').forEach((button) => {
    button.addEventListener('click', () => setPage?.(button.getAttribute('data-annojoin-page')));
  });

  const pageSizeSelect = root.getElementById?.('annojoin-page-size');
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => setPageSize?.(Number(pageSizeSelect.value) || 50));
  }

  root.querySelectorAll?.('[data-annojoin-column-toggle]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const current = new Set(visibleColumnIds || []);
      const columnId = checkbox.getAttribute('data-annojoin-column-toggle');
      if (!columnId) return;
      if (checkbox.checked) current.add(columnId);
      else current.delete(columnId);
      setVisibleColumns?.([...current]);
    });
  });

  const exportSelectedBtn = root.getElementById?.('export-selected-annojoin-cases');
  if (exportSelectedBtn) {
    exportSelectedBtn.addEventListener('click', () => {
      const selectedRows = rows.filter((row) => selectedCaseIds?.has(rowCaseKey(row)));
      exportSelectedRows?.(selectedRows);
    });
  }

  const selectVisibleBtn = root.getElementById?.('select-visible-annojoin-cases');
  if (selectVisibleBtn) {
    selectVisibleBtn.addEventListener('click', () => selectRows?.(pageRows));
  }

  const selectAllBtn = root.getElementById?.('select-all-annojoin-cases');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => selectRows?.(rows));
  }

  const clearSelectedBtn = root.getElementById?.('clear-selected-annojoin-cases');
  if (clearSelectedBtn) {
    clearSelectedBtn.addEventListener('click', () => clearSelection?.());
  }

  root.querySelectorAll?.('.annojoin-case-select').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const caseId = event.target.getAttribute('data-annojoin-case-id');
      if (!caseId) return;
      if (event.target.checked) selectedCaseIds?.add(caseId);
      else selectedCaseIds?.delete(caseId);
      rerender?.();
    });
  });

  root.querySelectorAll?.('[data-annojoin-group-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const groupId = button.getAttribute('data-annojoin-group-toggle');
      if (groupId) toggleGroup?.(groupId);
    });
  });

  root.querySelectorAll?.('[data-annojoin-group-page-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const groupId = button.getAttribute('data-annojoin-group-page-toggle');
      if (groupId) toggleGroupLimit?.(groupId);
    });
  });

  const expandAllBtn = root.getElementById?.('expand-all-annojoin-groups');
  if (expandAllBtn) expandAllBtn.addEventListener('click', () => expandAllGroups?.());

  const collapseAllBtn = root.getElementById?.('collapse-all-annojoin-groups');
  if (collapseAllBtn) collapseAllBtn.addEventListener('click', () => collapseAllGroups?.());
}
