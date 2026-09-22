export const ENTRY_CASE_HEIGHT_MESSAGE = 'foldbridge-case-height';

const MIN_ENTRY_CASE_HEIGHT = 320;
const MAX_ENTRY_CASE_HEIGHT = 100_000;
const FRAME_HEIGHT_PADDING = 2;

export function parseEntryCaseMatrixFamily(queryString = '') {
  const params = new URLSearchParams(queryString);
  const families = params.getAll('family');
  if (families.length === 0) return null;
  if (families.length !== 1) throw new Error('Case matrix family must appear exactly once');
  const [family] = families;
  if (family !== 'E' && family !== 'F') throw new Error(`Invalid Case matrix family "${family}"`);
  return family;
}

export function normalizeEntryCaseHeight(value) {
  const height = Number(value);
  if (!Number.isFinite(height) || height < MIN_ENTRY_CASE_HEIGHT || height > MAX_ENTRY_CASE_HEIGHT) {
    return null;
  }
  return Math.ceil(height) + FRAME_HEIGHT_PADDING;
}

export function applyEntryCaseHeightMessage({ event, frame, expectedOrigin }) {
  if (!frame || !expectedOrigin) return false;
  if (event?.origin !== expectedOrigin) return false;
  if (event?.source !== frame.contentWindow) return false;
  if (event?.data?.type !== ENTRY_CASE_HEIGHT_MESSAGE) return false;

  const height = normalizeEntryCaseHeight(event.data.height);
  if (height === null) return false;

  frame.style.height = `${height}px`;
  frame.setAttribute('scrolling', 'no');
  return true;
}

export function mountEntryCaseHeightListener({ windowObject, frame, expectedOrigin }) {
  if (!windowObject || typeof windowObject.addEventListener !== 'function' || !frame) {
    return () => {};
  }

  const handler = (event) => {
    applyEntryCaseHeightMessage({ event, frame, expectedOrigin });
  };
  let mounted = true;
  windowObject.addEventListener('message', handler);

  return () => {
    if (!mounted) return;
    mounted = false;
    windowObject.removeEventListener('message', handler);
  };
}

export const ENTRY_CASE_VIEW_MODE_MESSAGE = 'foldbridge-view-mode-change';

// Rewrite an #entry-case hash so its family param matches `family` (E|F to set,
// null to clear). Returns the new hash string (with leading '#'), or null when
// the hash is not an entry-case route or already matches — so callers can skip
// a no-op navigation.
export function entryCaseHashWithFamily(hash, family) {
  const raw = String(hash || '').replace(/^#/, '');
  const [route, queryString = ''] = raw.split('?');
  if (route !== 'entry-case') return null;
  const normalized = family === 'E' || family === 'F' ? family : null;
  const params = new URLSearchParams(queryString);
  const current = params.get('family');
  if ((current || null) === normalized) return null;
  if (normalized) params.set('family', normalized);
  else params.delete('family');
  const next = params.toString();
  return next ? `#${route}?${next}` : `#${route}`;
}

export function mountEntryCaseViewModeListener({ windowObject, frame, expectedOrigin }) {
  if (!windowObject || typeof windowObject.addEventListener !== 'function' || !frame) {
    return () => {};
  }
  const handler = (event) => {
    if (expectedOrigin && event?.origin !== expectedOrigin) return;
    if (event?.source !== frame.contentWindow) return;
    if (event?.data?.type !== ENTRY_CASE_VIEW_MODE_MESSAGE) return;
    const family = event.data.family === 'E' || event.data.family === 'F' ? event.data.family : null;
    const nextHash = entryCaseHashWithFamily(windowObject.location.hash, family);
    if (nextHash === null) return;
    windowObject.location.hash = nextHash;
  };
  let mounted = true;
  windowObject.addEventListener('message', handler);
  return () => {
    if (!mounted) return;
    mounted = false;
    windowObject.removeEventListener('message', handler);
  };
}

export function mountEntryCaseLoadingIndicator({ frame, indicator }) {
  if (!frame || typeof frame.addEventListener !== 'function' || !indicator) {
    return () => {};
  }

  indicator.hidden = false;
  const handleLoad = () => {
    indicator.hidden = true;
  };
  frame.addEventListener('load', handleLoad, { once: true });

  return () => {
    frame.removeEventListener('load', handleLoad);
  };
}
