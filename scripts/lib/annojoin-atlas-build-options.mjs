function text(value) {
  return String(value ?? '').trim();
}

export function resolveVisualPreviewCaseIds(cases = [], rawLimit = undefined) {
  const ids = cases.map((row) => text(row.case_id || row.caseId)).filter(Boolean);
  if (rawLimit === undefined || rawLimit === null || text(rawLimit).toLowerCase() === 'all') {
    return ids;
  }
  const limit = Number(rawLimit);
  if (!Number.isFinite(limit)) return ids;
  return ids.slice(0, Math.max(0, Math.floor(limit)));
}
