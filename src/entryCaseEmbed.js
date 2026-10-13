export const ENTRY_CASE_HEIGHT_MESSAGE = 'foldbridge-case-height';
export const ENTRY_CASE_READY_MESSAGE = 'foldbridge-case-ready';

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

export function mountEntryCaseFailureFallback({
  frame,
  indicator,
  fallback,
  retryButton,
  windowObject = typeof window !== 'undefined' ? window : null,
  expectedOrigin = '',
  fetchFn = typeof window !== 'undefined' ? window.fetch.bind(window) : null,
  timeoutMs = 15_000,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  now = Date.now,
}) {
  if (!frame || typeof frame.addEventListener !== 'function' || !indicator || !fallback) {
    return () => {};
  }

  let mounted = true;
  let timerId = null;
  let request = null;
  let generation = 0;
  let frameLoaded = false;
  let probeAvailable = false;
  let ready = false;
  const title = fallback.querySelector?.('[data-fallback-title]');
  const copy = fallback.querySelector?.('[data-fallback-copy]');
  const clearTimer = () => {
    if (timerId === null) return;
    clearTimeoutFn(timerId);
    timerId = null;
  };
  const showFailure = (status = 0) => {
    if (!mounted || ready) return;
    const notFound = status === 404;
    clearTimer();
    request?.abort();
    indicator.hidden = true;
    fallback.hidden = false;
    frame.hidden = true;
    if (title) title.textContent = notFound ? 'Case page not found' : 'Case data is temporarily unavailable';
    if (copy) copy.textContent = notFound
      ? 'This case page is not available. Return to the Entry table to choose another case.'
      : 'We could not reach the case service. Please try again in a moment.';
  };
  const finishReady = () => {
    if (!mounted) return;
    ready = true;
    generation += 1;
    request?.abort();
    clearTimer();
    indicator.hidden = true;
    fallback.hidden = true;
    frame.hidden = false;
  };
  const showLoading = () => {
    clearTimer();
    request?.abort();
    generation += 1;
    const attempt = generation;
    frameLoaded = false;
    probeAvailable = false;
    ready = false;
    indicator.hidden = false;
    fallback.hidden = true;
    frame.hidden = false;
    timerId = setTimeoutFn(() => showFailure(), timeoutMs);
    if (!fetchFn) return;
    request = new AbortController();
    const signal = request.signal;
    // HEAD is CORS-enabled by the origin. It distinguishes a real 404 or
    // Cloudflare error from the iframe's unconditional load event.
    Promise.resolve(fetchFn(frame.src, { method: 'HEAD', cache: 'no-store', signal }))
      .then((response) => {
        if (!mounted || attempt !== generation || signal.aborted || ready) return;
        if (!response.ok) { showFailure(response.status); return; }
        probeAvailable = true;
        if (frameLoaded) finishReady();
      })
      .catch(() => {
        if (mounted && attempt === generation && !signal.aborted && !ready) showFailure();
      });
  };
  const handleLoad = () => {
    if (!mounted || ready) return;
    frameLoaded = true;
    if (probeAvailable) finishReady();
  };
  const handleReady = (event) => {
    if (!mounted || !expectedOrigin || event?.origin !== expectedOrigin) return;
    if (event?.source !== frame.contentWindow) return;
    const type = event?.data?.type;
    const hasTrustedReadySignal = type === ENTRY_CASE_READY_MESSAGE
      || (type === ENTRY_CASE_HEIGHT_MESSAGE && normalizeEntryCaseHeight(event?.data?.height) !== null);
    if (hasTrustedReadySignal) finishReady();
  };
  const handleRetry = (event) => {
    if (!mounted) return;
    event?.preventDefault?.();
    const url = new URL(frame.src);
    url.searchParams.set('_foldbridge_retry', String(now()));
    frame.src = url.href;
    showLoading();
  };

  frame.addEventListener('load', handleLoad);
  frame.addEventListener('error', showFailure);
  retryButton?.addEventListener?.('click', handleRetry);
  windowObject?.addEventListener?.('message', handleReady);
  showLoading();

  return () => {
    if (!mounted) return;
    mounted = false;
    generation += 1;
    request?.abort();
    clearTimer();
    frame.removeEventListener('load', handleLoad);
    frame.removeEventListener('error', showFailure);
    retryButton?.removeEventListener?.('click', handleRetry);
    windowObject?.removeEventListener?.('message', handleReady);
  };
}
