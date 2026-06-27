import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrimaryNav } from '../src/siteChrome.js';

test('primary nav exposes exactly the 5 launch routes', () => {
  const html = renderPrimaryNav('home');
  for (const label of ['Home', 'Entry', 'Probing', 'Search', 'Help']) {
    assert.match(html, new RegExp(`>${label}</button>`), `missing nav button: ${label}`);
  }
  assert.match(html, /data-route="sequence"[^>]*>Entry<\/button>/);
});

test('primary nav drops removed entries', () => {
  const html = renderPrimaryNav('home');
  assert.doesNotMatch(html, />Browse<\/button>/);
  assert.doesNotMatch(html, />Structure<\/button>/);
  assert.doesNotMatch(html, />PDB Cases<\/button>/);
  assert.doesNotMatch(html, />Download<\/button>/);
});

test('primary nav marks the active route', () => {
  const seqHtml = renderPrimaryNav('sequence');
  assert.match(seqHtml, /class="nav-btn active"\s+data-route="sequence"/);
  const dlHtml = renderPrimaryNav('download-sequences');
  assert.match(dlHtml, /class="nav-btn active"\s+data-route="sequence"/);
});
