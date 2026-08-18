import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderPrimaryNav } from '../src/siteChrome.js';

test('primary nav exposes the launch routes incl. Stats/Help/Download', () => {
  const html = renderPrimaryNav('home');
  for (const label of ['Home', 'Entry', 'Probing', 'Stats', 'Help', 'Download', 'Search']) {
    assert.match(html, new RegExp(`>${label}</button>`), `missing nav button: ${label}`);
  }
  assert.match(html, /data-route="stats"[^>]*>Stats<\/button>/);
  assert.match(html, /data-route="help"[^>]*>Help<\/button>/);
  assert.doesNotMatch(html, /data-route="about"/);
  assert.doesNotMatch(html, />About<\/button>/);
});

test('Help route marks the canonical Help nav item active', () => {
  const html = renderPrimaryNav('help');
  assert.match(html, /class="nav-btn active"\s+data-route="help"/);
  assert.doesNotMatch(html, /data-route="about"/);
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
  assert.deepEqual(labels, ['home', 'entry', 'search', 'probing', 'stats', 'download', 'help']);
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

import { renderHelpPage } from '../src/siteChrome.js';

const PUBLISHED_HELP = JSON.parse(fs.readFileSync(new URL('../src/assets/data/help-content.json', import.meta.url), 'utf8'));

const SAMPLE_HELP = {
  hero: { kicker: 'Help · FoldBridge', title: 'How to use FoldBridge', summary: 'A practical guide.', detail: 'Usage, not methodology.' },
  sections: [
    { id: 'navigate', title: 'Finding your way around', kind: 'table', items: [{ term: 'Entry', body: 'The master table.' }] },
    { id: 'quickread', title: 'Reading a label', kind: 'prose', body: 'Family plus tier.' }
  ]
};

test('help page renders hero title and sections', () => {
  const html = renderHelpPage(SAMPLE_HELP);
  assert.match(html, /class="help-page-shell"/);
  assert.match(html, /How to use FoldBridge/);
  assert.match(html, /Finding your way around/);
  assert.match(html, /The master table\./);
  assert.match(html, /Family plus tier\./);
});

test('published Help content merges usage, contact, and group members in order', () => {
  const html = renderHelpPage(PUBLISHED_HELP);
  const orderedHeadings = [
    'About FoldBridge',
    'Search channels',
    'Interactive visualisation',
    'How to make a feedback',
    'How to contact us',
    'Group Members'
  ];
  let previousIndex = -1;
  for (const heading of orderedHeadings) {
    const index = html.indexOf(heading);
    assert.ok(index > previousIndex, `${heading} is missing or out of order`);
    previousIndex = index;
  }
});

test('help page renders a screenshot-led usage flow', () => {
  const html = renderHelpPage({
    hero: { title: 'Help' },
    sections: [{
      id: 'usage',
      title: 'Search channels',
      kind: 'usage',
      items: [{
        title: 'Open Search',
        body: 'Choose Search in the navigation bar.',
        image: './src/assets/guide/help-usage-open-search.png',
        alt: 'Search help'
      }]
    }]
  });
  assert.match(html, /class="help-usage-flow"/);
  assert.match(html, /help-guide-section--workflow/);
  assert.match(html, /class="help-usage-step"/);
  assert.match(html, /help-usage-open-search\.png/);
  assert.match(html, /alt="Search help"/);
});

test('help page renders an interactive-visualisation workflow', () => {
  const html = renderHelpPage({
    hero: { title: 'Help' },
    sections: [{
      id: 'interactive',
      title: 'Interactive visualisation',
      kind: 'usage',
      items: [{
        title: 'Explore the 3D structure',
        image: './src/assets/guide/help-interactive-3d-structure.png',
        alt: '3D structure viewer'
      }]
    }]
  });
  assert.match(html, /Interactive visualisation/);
  assert.match(html, /help-interactive-3d-structure\.png/);
  assert.match(html, /alt="3D structure viewer"/);
});

test('help page places the contact section directly above group members', () => {
  const html = renderHelpPage({
    hero: { title: 'Help' },
    sections: [
      { id: 'usage', title: 'Usage', kind: 'prose', body: 'Use the database.' },
      { id: 'contact', title: 'How to contact us', kind: 'prose', body: 'Please reach out to the group members below.' }
    ],
    group_members: [{ initials: 'FB', name: 'FoldBridge Team', details: [] }]
  });
  const contactIndex = html.indexOf('How to contact us');
  const membersIndex = html.indexOf('Group Members');
  assert.ok(contactIndex > html.indexOf('Usage'));
  assert.ok(contactIndex < membersIndex);
  assert.match(html, /Please reach out to the group members below\./);
});

test('help contact section renders a mailto link when a contact email is provided', () => {
  const html = renderHelpPage({
    hero: { title: 'Help' },
    sections: [{
      id: 'contact',
      title: 'How to contact us',
      kind: 'prose',
      body: 'For any inquiries, please reach out to',
      email: 'hu_linyan@gzlab.ac.cn',
    }],
  });
  assert.match(html, /href="mailto:hu_linyan@gzlab\.ac\.cn"/);
  assert.match(html, />hu_linyan@gzlab\.ac\.cn<\/a>/);
});

test('help page renders a dedicated feedback call to action', () => {
  const html = renderHelpPage({
    hero: { title: 'Help' },
    sections: [{
      id: 'feedback',
      title: 'How to make a feedback',
      kind: 'feedback',
      body: 'We welcome your feedback.',
      route: '#help-contact',
      linkLabel: 'Submit feedback'
    }]
  });
  assert.match(html, /How to make a feedback/);
  assert.match(html, /class="help-feedback"/);
  assert.match(html, /class="help-feedback-button" href="#help-contact">Submit feedback/);
});

test('help page opens an external feedback spreadsheet in a new tab', () => {
  const html = renderHelpPage({
    hero: { title: 'Help' },
    sections: [{
      id: 'feedback',
      title: 'How to make a feedback',
      kind: 'feedback',
      body: 'We welcome your feedback.',
      route: 'https://docs.google.com/spreadsheets/d/example/edit',
      linkLabel: 'Submit feedback'
    }]
  });
  assert.match(html, /href="https:\/\/docs\.google\.com\/spreadsheets\/d\/example\/edit" target="_blank" rel="noopener noreferrer">Submit feedback/);
});

test('help page falls back to a minimal shell with an H1 when content is missing', () => {
  const html = renderHelpPage(null);
  assert.match(html, /<h1>Help<\/h1>/);
  assert.doesNotMatch(html, /undefined/);
});
