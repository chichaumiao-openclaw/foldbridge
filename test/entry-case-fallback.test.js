import assert from 'node:assert/strict';
import test from 'node:test';
import { mountEntryCaseFailureFallback } from '../src/entryCaseEmbed.js';

function fixture(fetchFn) {
  const handlers = new Map();
  const messages = new Set();
  const timers = new Map();
  let timerId = 0;
  const heading = { textContent: '' };
  const copy = { textContent: '' };
  const fallback = { hidden: true, dataset: {}, querySelector: (selector) => selector.includes('title') ? heading : copy };
  const indicator = { hidden: true };
  const frame = {
    src: 'https://foldbridge.sunhao.uk/entry-cases/cases/9ZC6/index.html?chain=A&family=E',
    hidden: false, contentWindow: {},
    addEventListener: (type, fn) => handlers.set(type, fn),
    removeEventListener: (type) => handlers.delete(type),
  };
  const retryButton = {
    addEventListener: (type, fn) => handlers.set(`retry:${type}`, fn),
    removeEventListener: (type) => handlers.delete(`retry:${type}`),
  };
  const dispose = mountEntryCaseFailureFallback({
    frame, indicator, fallback, retryButton, fetchFn,
    expectedOrigin: 'https://foldbridge.sunhao.uk',
    windowObject: { addEventListener: (_type, fn) => messages.add(fn), removeEventListener: (_type, fn) => messages.delete(fn) },
    setTimeoutFn: (fn) => { timers.set(++timerId, fn); return timerId; },
    clearTimeoutFn: (id) => timers.delete(id), now: () => 12345,
  });
  return { handlers, messages, timers, frame, indicator, fallback, heading, dispose };
}

test('iframe load on a 503 error document displays maintenance instead of success', async () => {
  const ui = fixture(async () => ({ ok: false, status: 503 }));
  ui.handlers.get('load')();
  await new Promise(setImmediate);
  assert.equal(ui.fallback.hidden, false);
  assert.equal(ui.frame.hidden, true);
  assert.match(ui.heading.textContent, /temporarily unavailable/);
  ui.dispose();
});

test('a single case 404 is identified as not found, not maintenance', async () => {
  const ui = fixture(async () => ({ ok: false, status: 404 }));
  ui.handlers.get('load')();
  await new Promise(setImmediate);
  assert.equal(ui.fallback.hidden, false);
  assert.match(ui.heading.textContent, /not found/i);
  ui.dispose();
});

test('200 probe alone waits for frame load; legacy shell needs no new ready message', async () => {
  const ui = fixture(async () => ({ ok: true, status: 200 }));
  await new Promise(setImmediate);
  assert.equal(ui.indicator.hidden, false);
  ui.handlers.get('load')();
  await new Promise(setImmediate);
  assert.equal(ui.indicator.hidden, true);
  assert.equal(ui.fallback.hidden, true);
  assert.equal(ui.frame.hidden, false);
  ui.dispose();
});

test('retry retains chain and family with one retry param; stale failed probe cannot overwrite success', async () => {
  const pending = [];
  const ui = fixture(() => new Promise((resolve) => pending.push(resolve)));
  ui.handlers.get('retry:click')();
  ui.handlers.get('retry:click')();
  const url = new URL(ui.frame.src);
  assert.equal(url.searchParams.getAll('_foldbridge_retry').length, 1);
  assert.equal(url.searchParams.get('chain'), 'A');
  assert.equal(url.searchParams.get('family'), 'E');
  ui.handlers.get('load')();
  pending.at(-1)({ ok: true, status: 200 });
  await new Promise(setImmediate);
  pending[0]({ ok: false, status: 503 });
  await new Promise(setImmediate);
  assert.equal(ui.indicator.hidden, true);
  assert.equal(ui.fallback.hidden, true);
  ui.dispose();
});

test('trusted height marks legacy shell ready while untrusted and stale events are ignored', async () => {
  const ui = fixture(async () => { throw new Error('CORS/network failure'); });
  await new Promise(setImmediate);
  const listener = [...ui.messages][0];
  listener({ origin: 'https://example.com', source: ui.frame.contentWindow, data: { type: 'foldbridge-case-height', height: 800 } });
  assert.equal(ui.fallback.hidden, false);
  listener({ origin: 'https://foldbridge.sunhao.uk', source: ui.frame.contentWindow, data: { type: 'foldbridge-case-height', height: 800 } });
  assert.equal(ui.fallback.hidden, true);
  ui.dispose();
  listener({ origin: 'https://foldbridge.sunhao.uk', source: ui.frame.contentWindow, data: { type: 'foldbridge-case-ready' } });
  assert.equal(ui.messages.size, 0);
});
