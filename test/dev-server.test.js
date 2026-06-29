import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { injectReloadClient, devServerUrl, resolveStaticRequestPath } from '../scripts/lib/dev-server.mjs';

test('dev server injects a reload client into html', () => {
  const html = injectReloadClient('<html><body><div id="app"></div></body></html>');

  assert.match(html, /EventSource\('\/__foldbridge_reload'\)/);
  assert.match(html, /window\.location\.reload\(\)/);
  assert.match(html, /<\/body>/);
});

test('dev server reload injection is idempotent', () => {
  const once = injectReloadClient('<html><body></body></html>');
  const twice = injectReloadClient(once);

  assert.equal(twice, once);
});

test('dev server url defaults to localhost dev port', () => {
  assert.equal(devServerUrl(), 'http://127.0.0.1:5173/');
});

test('dev server exposes public assets at site root', () => {
  const root = path.resolve('.');

  assert.equal(
    resolveStaticRequestPath('/annojoin-smoke/5gag/index.html', { root }),
    path.join(root, 'public/annojoin-smoke/5gag/index.html')
  );
  assert.equal(
    resolveStaticRequestPath('/annojoin-smoke/5gag/assets/linked-view/structure-coverage.json', { root }),
    path.join(root, 'public/annojoin-smoke/5gag/assets/linked-view/structure-coverage.json')
  );
  assert.equal(resolveStaticRequestPath('/../package.json', { root }), null);
});
