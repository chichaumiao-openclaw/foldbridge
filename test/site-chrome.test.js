import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrimaryNav } from '../src/siteChrome.js';

test('primary nav exposes exactly the 5 launch routes', () => {
  const html = renderPrimaryNav('home');
  for (const label of ['Home', 'Entry', 'Probing', 'Search', 'Help']) {
    assert.match(html, new RegExp(`>${label}</button>`), `missing nav button: ${label}`);
  }
  assert.match(html, /data-route="entry"[^>]*>Entry<\/button>/);
});

test('primary nav drops removed entries', () => {
  const html = renderPrimaryNav('home');
  assert.doesNotMatch(html, />Browse<\/button>/);
  assert.doesNotMatch(html, />Structure<\/button>/);
  assert.doesNotMatch(html, />PDB Cases<\/button>/);
  assert.doesNotMatch(html, />Download<\/button>/);
});

test('primary nav marks the active route', () => {
  const entryHtml = renderPrimaryNav('entry');
  assert.match(entryHtml, /class="nav-btn active"\s+data-route="entry"/);
  const seqHtml = renderPrimaryNav('sequence');
  assert.match(seqHtml, /class="nav-btn active"\s+data-route="entry"/);
  const dlHtml = renderPrimaryNav('download-sequences');
  assert.match(dlHtml, /class="nav-btn active"\s+data-route="entry"/);
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
  assert.match(html, /data-route="entry"/);
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
  assert.match(html, /data-route="entry"/);
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
  assert.match(html, /Modules/i);
  assert.match(html, /Key terms/i);
  assert.match(html, /Data sources/i);
  assert.match(html, /href="#entry"/);
  assert.match(html, /href="#probing"/);
  assert.match(html, /href="#search"/);
  assert.match(html, /source case/i);
  assert.match(html, /not active/i);
  assert.doesNotMatch(html, /Browse/);
  assert.doesNotMatch(html, /Structure hub|Open structure/i);
  assert.doesNotMatch(html, /Download/);
});

import { renderHomeProbingCarousel } from '../src/siteChrome.js';

const SAMPLE_ARTICLES = [
  { slug: 'dms', title: 'Why DMS can only seriously interpret A/C', rep_figure: 'cordero2012_f1__PMC3448840__F1.jpg', family_title: 'DMS chemical probing' },
  { slug: 'shape-map', title: 'SHAPE-MaP: reading 2′-OH as mutations', rep_figure: 'sm_f1.jpg', family_title: 'SHAPE 2′-OH acylation' },
  { slug: 'pars', title: 'PARS: pairing via two nucleases', rep_figure: 'pars_f1.jpg', family_title: 'Hydroxyl-radical / nuclease footprinting' }
];

test('carousel renders one slide per article', () => {
  const html = renderHomeProbingCarousel(SAMPLE_ARTICLES);
  assert.equal((html.match(/data-carousel-slide=/g) || []).length, 3);
});

test('each slide links to its detail route', () => {
  const html = renderHomeProbingCarousel(SAMPLE_ARTICLES);
  assert.match(html, /href="#detail\/dms"/);
  assert.match(html, /href="#detail\/shape-map"/);
  assert.match(html, /href="#detail\/pars"/);
});

test('each slide uses the per-slug asset path for its figure', () => {
  const html = renderHomeProbingCarousel(SAMPLE_ARTICLES);
  assert.match(html, /src="\.\/src\/assets\/generated\/probing-articles\/assets\/dms\/cordero2012_f1__PMC3448840__F1\.jpg"/);
});

test('each slide shows its family badge', () => {
  const html = renderHomeProbingCarousel(SAMPLE_ARTICLES);
  assert.match(html, /DMS chemical probing/);
  assert.match(html, /SHAPE 2′-OH acylation/);
});

test('first slide and first dot are marked active', () => {
  const html = renderHomeProbingCarousel(SAMPLE_ARTICLES);
  assert.match(html, /data-carousel-slide="0"[^>]*class="[^"]*active/);
  assert.match(html, /data-carousel-dot="0"[^>]*class="[^"]*active/);
});

test('carousel exposes prev/next and per-slide dot controls', () => {
  const html = renderHomeProbingCarousel(SAMPLE_ARTICLES);
  assert.match(html, /data-carousel-prev/);
  assert.match(html, /data-carousel-next/);
  assert.equal((html.match(/data-carousel-dot=/g) || []).length, 3);
});

test('empty input returns a placeholder shell with no slides', () => {
  const html = renderHomeProbingCarousel([]);
  assert.doesNotMatch(html, /data-carousel-slide=/);
  assert.match(html, /home-probing-carousel/);
});
