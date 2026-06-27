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

import { renderHomeHero, HOME_METRICS } from '../src/siteChrome.js';

test('home hero shows real metrics, no placeholders', () => {
  const html = renderHomeHero();
  assert.match(html, /3,610/);
  assert.match(html, /4,070/);
  assert.match(html, />27</);
  assert.match(html, />6</);
  assert.doesNotMatch(html, /\bxx\b/);
  assert.doesNotMatch(html, /Release 0\.1/);
});

test('home hero CTAs target live routes', () => {
  const html = renderHomeHero();
  assert.match(html, /data-route="sequence"/);
  assert.match(html, /data-route="probing"/);
  assert.doesNotMatch(html, /data-route="download-sequences"/);
  assert.doesNotMatch(html, /data-route="structure"/);
});

test('HOME_METRICS carries the launch numbers', () => {
  assert.equal(HOME_METRICS.structureLinkedRecords, 3610);
  assert.equal(HOME_METRICS.sourceCases, 4070);
  assert.equal(HOME_METRICS.probingArticles, 27);
  assert.equal(HOME_METRICS.mechanismFamilies, 6);
});

import { renderHomeModuleCards } from '../src/siteChrome.js';

test('home module cards link to the three core modules', () => {
  const html = renderHomeModuleCards();
  assert.match(html, /data-route="sequence"/);
  assert.match(html, /data-route="probing"/);
  assert.match(html, /data-route="search"/);
  assert.match(html, /Entry table/);
  assert.match(html, /Probing methods/);
  assert.match(html, />Search</);
  assert.equal((html.match(/bundle-site-card/g) || []).length, 3);
});

import { renderHelpBody } from '../src/siteChrome.js';

test('help body has four sections and live module links', () => {
  const html = renderHelpBody();
  assert.match(html, /What is FoldBridge/i);
  assert.match(html, /href="#sequence"/);
  assert.match(html, /href="#probing"/);
  assert.match(html, /href="#search"/);
  assert.match(html, /source case/i);
  assert.match(html, /not active/i);
  assert.doesNotMatch(html, /Browse/);
  assert.doesNotMatch(html, /Structure hub|Open structure/i);
  assert.doesNotMatch(html, /Download/);
});
