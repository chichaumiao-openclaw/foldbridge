import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPrimaryNav } from '../src/siteChrome.js';

test('primary nav exposes the launch routes incl. Stats/Help/Download', () => {
  const html = renderPrimaryNav('home');
  for (const label of ['Home', 'Entry', 'Probing', 'Stats', 'Help', 'Download', 'Search']) {
    assert.match(html, new RegExp(`>${label}</button>`), `missing nav button: ${label}`);
  }
  assert.match(html, /data-route="stats"[^>]*>Stats<\/button>/);
  assert.match(html, /data-route="about"[^>]*>Help<\/button>/);
  assert.doesNotMatch(html, />About<\/button>/);
});

test('legacy help route marks Help active', () => {
  const html = renderPrimaryNav('about');
  assert.match(html, /class="nav-btn active"\s+data-route="about"/);
  assert.doesNotMatch(html, /data-route="help"/);
});

test('download route marks Download active', () => {
  const html = renderPrimaryNav('download');
  assert.match(html, /class="nav-btn active"\s+data-route="download"/);
});

test('primary nav drops removed entries', () => {
  const html = renderPrimaryNav('home');
  assert.doesNotMatch(html, />Browse<\/button>/);
  assert.doesNotMatch(html, />Structure<\/button>/);
  assert.doesNotMatch(html, />PDB Cases<\/button>/);
});

test('primary nav marks the active route', () => {
  const entryHtml = renderPrimaryNav('entry');
  assert.match(entryHtml, /class="nav-btn active"\s+data-route="entry"/);
  const seqHtml = renderPrimaryNav('sequence');
  assert.match(seqHtml, /class="nav-btn active"\s+data-route="entry"/);
  const dlHtml = renderPrimaryNav('download-sequences');
  assert.match(dlHtml, /class="nav-btn active"\s+data-route="entry"/);
});

test('entry detail routes keep the Entry tab active', () => {
  for (const route of ['pdb-case', 'annojoin-atlas', 'annojoin-case', 'annojoin-confidence']) {
    const html = renderPrimaryNav(route);
    assert.match(html, /class="nav-btn active"\s+data-route="entry"/, route);
    assert.doesNotMatch(html, /class="nav-btn active"\s+data-route="home"/, route);
  }
});

test('primary nav order is Home Entry Search Probing Stats Download Help', () => {
  const html = renderPrimaryNav('home');
  const labels = [...html.matchAll(/data-route="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['home', 'entry', 'search', 'probing', 'stats', 'download', 'about']);
});

import { renderHomeHero, HOME_METRICS } from '../src/siteChrome.js';

test('home hero shows real metrics, no placeholders', () => {
  const html = renderHomeHero();
  assert.match(html, /4,664/);
  assert.match(html, /2,386/);
  assert.match(html, />510</);
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
  assert.equal(HOME_METRICS.probingEntries, 4664);
  assert.equal(HOME_METRICS.pdbStructures, 2386);
  assert.equal(HOME_METRICS.highConfidencePaired, 510);
  assert.equal(HOME_METRICS.probingArticles, 26);
  assert.equal(HOME_METRICS.mechanismFamilies, 5);
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

test('each slide links to its probing route', () => {
  const html = renderHomeProbingCarousel(SAMPLE_ARTICLES);
  assert.match(html, /href="#probing\?tech=dms"/);
  assert.match(html, /href="#probing\?tech=shape-map"/);
  assert.match(html, /href="#probing\?tech=pars"/);
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

import { renderHelpPage, renderAboutPage } from '../src/siteChrome.js';

const SAMPLE_HELP = {
  hero: { kicker: 'Help · FoldBridge', title: 'How to use FoldBridge', summary: 'A practical guide.', detail: 'Usage, not methodology.' },
  sections: [
    { id: 'navigate', title: 'Finding your way around', kind: 'table', items: [{ term: 'Entry', body: 'The master table.' }] },
    { id: 'quickread', title: 'Reading a label', kind: 'prose', body: 'Family plus tier.' }
  ]
};

test('help page renders hero title and sections', () => {
  const html = renderHelpPage(SAMPLE_HELP);
  assert.match(html, /How to use FoldBridge/);
  assert.match(html, /Finding your way around/);
  assert.match(html, /The master table\./);
  assert.match(html, /Family plus tier\./);
});

test('help page falls back to a minimal shell with an H1 when content is missing', () => {
  const html = renderHelpPage(null);
  assert.match(html, /<h1>Help<\/h1>/);
  assert.doesNotMatch(html, /undefined/);
});

test('help page is distinct from about page for the same-shaped input', () => {
  const helpHtml = renderHelpPage(SAMPLE_HELP);
  const aboutHtml = renderAboutPage(null);
  assert.match(helpHtml, /How to use FoldBridge/);
  assert.doesNotMatch(aboutHtml, /How to use FoldBridge/);
});
