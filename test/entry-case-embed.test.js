import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import {
  applyEntryCaseHeightMessage,
  ENTRY_CASE_HEIGHT_MESSAGE,
  mountEntryCaseHeightListener,
} from '../src/entryCaseEmbed.js';

test('entry Case iframe accepts a valid height only from its own trusted child', () => {
  const childWindow = {};
  const attributes = new Map();
  const frame = {
    contentWindow: childWindow,
    style: {},
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };

  const applied = applyEntryCaseHeightMessage({
    event: {
      origin: 'https://foldbridge.sunhao.uk',
      source: childWindow,
      data: { type: ENTRY_CASE_HEIGHT_MESSAGE, height: 1234.2 },
    },
    frame,
    expectedOrigin: 'https://foldbridge.sunhao.uk',
  });

  assert.equal(applied, true);
  assert.equal(frame.style.height, '1237px');
  assert.equal(attributes.get('scrolling'), 'no');
});

test('entry Case iframe rejects untrusted, unrelated, and unreasonable height messages', () => {
  const childWindow = {};
  const frame = {
    contentWindow: childWindow,
    style: { height: '640px' },
    setAttribute() {
      throw new Error('rejected messages must not mutate the iframe');
    },
  };
  const baseEvent = {
    origin: 'https://foldbridge.sunhao.uk',
    source: childWindow,
    data: { type: ENTRY_CASE_HEIGHT_MESSAGE, height: 900 },
  };

  const rejected = [
    { ...baseEvent, origin: 'https://example.com' },
    { ...baseEvent, source: {} },
    { ...baseEvent, data: { ...baseEvent.data, type: 'other-message' } },
    { ...baseEvent, data: { ...baseEvent.data, height: Number.NaN } },
    { ...baseEvent, data: { ...baseEvent.data, height: 200_000 } },
  ];

  for (const event of rejected) {
    assert.equal(applyEntryCaseHeightMessage({
      event,
      frame,
      expectedOrigin: 'https://foldbridge.sunhao.uk',
    }), false);
  }
  assert.equal(frame.style.height, '640px');
});

test('entry Case height listener detaches cleanly when the route rerenders', () => {
  const handlers = new Set();
  const fakeWindow = {
    addEventListener(type, handler) {
      if (type === 'message') handlers.add(handler);
    },
    removeEventListener(type, handler) {
      if (type === 'message') handlers.delete(handler);
    },
    dispatch(event) {
      for (const handler of handlers) handler(event);
    },
  };
  const childWindow = {};
  const frame = {
    contentWindow: childWindow,
    style: {},
    setAttribute() {},
  };
  const event = {
    origin: 'https://foldbridge.sunhao.uk',
    source: childWindow,
    data: { type: ENTRY_CASE_HEIGHT_MESSAGE, height: 880 },
  };

  const dispose = mountEntryCaseHeightListener({
    windowObject: fakeWindow,
    frame,
    expectedOrigin: 'https://foldbridge.sunhao.uk',
  });
  fakeWindow.dispatch(event);
  assert.equal(frame.style.height, '882px');
  assert.equal(handlers.size, 1);

  dispose();
  frame.style.height = '640px';
  fakeWindow.dispatch(event);
  assert.equal(frame.style.height, '640px');
  assert.equal(handlers.size, 0);
});

test('Case shell reports its stable content height to a cross-origin parent', () => {
  const source = readFileSync(new URL('../public/entry-cases/__entry_v3_site__/case-shell.js', import.meta.url), 'utf8');
  const context = {
    module: { exports: {} },
    Number,
    Math,
  };
  vm.runInNewContext(source, context);
  const { measureEmbeddedCaseHeight, postEmbeddedCaseHeight } = context.module.exports;
  const shell = {
    getBoundingClientRect() {
      return { bottom: 987.1 };
    },
  };

  assert.equal(measureEmbeddedCaseHeight(shell, 12, 28), 1028);

  const calls = [];
  const parentWindow = {
    postMessage(...args) {
      calls.push(args);
    },
  };
  assert.equal(postEmbeddedCaseHeight(parentWindow, 1028), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0].type, ENTRY_CASE_HEIGHT_MESSAGE);
  assert.equal(calls[0][0].height, 1028);
  assert.equal(calls[0][1], '*');
});

test('entry Case layout uses the shared centered width and content-driven height bridge', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../public/entry-cases/__entry_v3_site__/case-shell.js', import.meta.url), 'utf8');
  const shellStyles = readFileSync(new URL('../public/entry-cases/__entry_v3_site__/case-shell.css', import.meta.url), 'utf8');
  const embedStyles = styles.match(/\.entry-case-embed\s*\{[^}]+\}/s)?.[0] || '';
  const frameStyles = styles.match(/\.entry-case-embed-frame\s*\{[^}]+\}/s)?.[0] || '';

  assert.match(embedStyles, /width:\s*var\(--feature-card-width\)/);
  assert.match(embedStyles, /max-width:\s*var\(--feature-card-width\)/);
  assert.match(embedStyles, /margin:\s*0 auto/);
  assert.doesNotMatch(frameStyles, /height:\s*calc\(100vh/);
  assert.match(main, /mountEntryCaseHeightListener\(\{/);
  assert.match(shell, /classList\.add\("is-embedded"\)/);
  assert.match(shellStyles, /html\.is-embedded \.shell\s*\{[^}]*width:\s*100%[^}]*max-width:\s*100%/s);
  assert.match(shell, /ResizeObserver/);
  assert.match(shell, /foldbridge-case-height/);
});

test('main-site entry route forwards the requested chain into the case iframe', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const \{ pdb, chain \} = getEntryCaseParamsFromHash\(\)/);
  assert.match(main, /searchParams\.set\(['"]chain['"],\s*safeChain\)/);
});

test('Case shell accepts only a chain present in its own manifest', () => {
  const source = readFileSync(new URL('../public/entry-cases/__entry_v3_site__/case-shell.js', import.meta.url), 'utf8');
  const context = { module: { exports: {} }, Number, Math, URLSearchParams };
  vm.runInNewContext(source, context);
  const { initialChainId } = context.module.exports;
  const bootstrap = { defaultChainId: 'b', chainPageById: { a: 'chains/a/index.html', b: 'chains/b/index.html' } };
  assert.equal(initialChainId(bootstrap, '?chain=a'), 'a');
  assert.equal(initialChainId(bootstrap, '?chain=missing'), 'b');
  assert.equal(initialChainId(bootstrap, ''), 'b');
});
