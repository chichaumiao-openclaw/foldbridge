export function bindAnnojointAtlasTable({
  root = document,
  selectedCaseIds,
  rows = [],
  setQuery,
  exportSelectedRows,
  selectRows,
  clearSelection,
  toggleGroup,
  toggleGroupLimit,
  expandAllGroups,
  collapseAllGroups,
  removeFilter,
  clearFilters,
  toggleTechniqueFamily,
  toggleTechniqueName,
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

  root.querySelectorAll?.('[data-technique-family]').forEach((button) => {
    button.addEventListener('click', () => {
      toggleTechniqueFamily?.(button.getAttribute('data-technique-family'));
    });
  });

  root.querySelectorAll?.('[data-technique-name]').forEach((button) => {
    button.addEventListener('click', () => {
      toggleTechniqueName?.(button.getAttribute('data-technique-name'));
    });
  });

  root.querySelectorAll?.('[data-annojoin-clear-search]').forEach((button) => {
    button.addEventListener('click', () => removeFilter?.('q'));
  });

  const exportSelectedBtn = root.getElementById?.('export-selected-annojoin-cases');
  if (exportSelectedBtn) {
    exportSelectedBtn.addEventListener('click', () => {
      const selectedRows = rows.filter((row) => selectedCaseIds?.has(rowCaseKey(row)));
      exportSelectedRows?.(selectedRows);
    });
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

  const scrollHintNote = root.querySelector?.('[data-annojoin-scroll-hint-note]');
  if (scrollHintNote) {
    const scrollWrap = root.querySelector?.('[data-annojoin-scroll-hint]');
    const hintKey = scrollWrap?.getAttribute?.('data-annojoin-scroll-hint') || 'foldbridge.entryTableScrollHintSeen';
    const readSeen = () => {
      try {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem(hintKey);
      } catch (error) {
        return null;
      }
    };
    if (readSeen()) scrollHintNote.hidden = true;
    root.querySelectorAll?.('[data-annojoin-scroll-hint-dismiss]').forEach((button) => {
      button.addEventListener('click', () => {
        try {
          if (typeof localStorage !== 'undefined') localStorage.setItem(hintKey, '1');
        } catch (error) {
          /* localStorage unavailable — dismiss visually only */
        }
        scrollHintNote.hidden = true;
      });
    });
  }
}
