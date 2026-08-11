import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderProbingArticleIndex, renderProbingArticlePage } from '../src/probingArticleView.js';

const articlesIndex = JSON.parse(
  fs.readFileSync(new URL('../src/assets/generated/probing-articles/index.json', import.meta.url), 'utf8')
);

test('article index family sections have same-page anchors without duplicate colored kickers', () => {
  const html = renderProbingArticleIndex(articlesIndex);
  assert.match(html, /id="probing-family-dms"/);
  assert.doesNotMatch(html, /<p class="technology-kicker"[^>]*>DMS chemical probing<\/p>/);
  assert.match(html, /<h2>DMS-based methods<\/h2>/);
});

test('article index escapes family section anchor attributes', () => {
  const html = renderProbingArticleIndex({
    article_count: 0,
    families: [
      { id: 'bad"id', title: 'Escaped family', summary: 'Summary', articles: [] }
    ]
  });
  assert.match(html, /id="probing-family-bad&quot;id"/);
  assert.match(html, /data-probing-family="bad&quot;id"/);
  assert.doesNotMatch(html, /bad"id/);
});

test('extraSectionsHtml is injected without breaking the family grid', () => {
  const marker = '<div data-extra-probing-block>HUB BLOCKS</div>';
  const html = renderProbingArticleIndex(articlesIndex, '', marker);
  // injected content present
  assert.match(html, /data-extra-probing-block/);
  assert.match(html, /HUB BLOCKS/);
  // existing structure intact (no regression)
  assert.match(html, /technology-section-card/);
  assert.match(html, /probing-article-card/);
  assert.match(html, /RNA probing methods explained/);
  assert.match(html, /This curated overview presents 26 in-depth explainers/);
  assert.match(html, /where applicable, relate those measurements/);
  assert.doesNotMatch(html, /probing articles/);
  assert.match(html, /Browse by mechanism family/);
});

test('omitting extraSectionsHtml keeps the legacy two-arg behavior', () => {
  const html = renderProbingArticleIndex(articlesIndex, '<header>H</header>');
  assert.match(html, /<header>H<\/header>/);
  assert.match(html, /<main class="page-detail page-probing-index">/);
  assert.doesNotMatch(html, /data-extra-probing-block/);
});

test('enlarges figures only on the requested DMS article pages', () => {
  const enlarged = renderProbingArticlePage({ slug: 'structure-seq', title: 'Structure-seq', blocks: [] }, articlesIndex);
  const regular = renderProbingArticlePage({ slug: 'dms', title: 'DMS', blocks: [] }, articlesIndex);
  assert.match(enlarged, /page-probing-article--enlarged-figures/);
  assert.doesNotMatch(regular, /page-probing-article--enlarged-figures/);
});

test('omits real-case and real-example sections from article pages', () => {
  const html = renderProbingArticlePage({
    slug: 'test-method',
    title: 'Test method',
    blocks: [
      { type: 'heading', text: 'Method details' },
      { type: 'paragraph', text: 'Keep this explanation.' },
      { type: 'heading', text: 'A real case (illustrative)' },
      { type: 'paragraph', text: 'Remove this illustrative scenario.' },
      { type: 'heading', text: 'Interpretation notes' },
      { type: 'paragraph', text: 'Keep this conclusion.' }
    ]
  }, articlesIndex);
  assert.match(html, /Method details/);
  assert.match(html, /Interpretation notes/);
  assert.doesNotMatch(html, /A real case/);
  assert.doesNotMatch(html, /Remove this illustrative scenario/);
});

test('places key innovation inside the following overview card', () => {
  const html = renderProbingArticlePage({
    slug: 'test-method',
    title: 'Test method',
    key_innovation: 'Key point.',
    ppt_overview: [{ title: 'Overview', srcBasename: 'figure.png', text: 'Overview text.' }],
    blocks: []
  }, articlesIndex);
  const overviewStart = html.indexOf('article-ppt-overview');
  const innovationStart = html.indexOf('article-key-innovation');
  const gridStart = html.indexOf('article-ppt-grid');
  assert.ok(innovationStart > overviewStart && innovationStart < gridStart);
  assert.doesNotMatch(html, /class="card bundle-wide-card article-key-innovation"/);
});

test('does not invent a next article for a page excluded from a family order', () => {
  const html = renderProbingArticlePage({
    slug: 'rl-seq',
    title: 'RL-Seq',
    blocks: []
  }, {
    families: [{
      article_order: ['pars', 'parte', 'hrf-seq'],
      articles: [
        { slug: 'rl-seq', title: 'RL-Seq' },
        { slug: 'pars', title: 'PARS: Method' },
        { slug: 'parte', title: 'PARTE: Method' },
        { slug: 'hrf-seq', title: 'HRF-Seq: Method' }
      ]
    }]
  });
  assert.doesNotMatch(html, /article-sibling-link/);
});

test('every article has a valid, reciprocal previous/next destination', () => {
  const directory = new URL('../src/assets/generated/probing-articles/', import.meta.url);
  const details = fs.readdirSync(directory)
    .filter((file) => file.endsWith('.json') && file !== 'index.json')
    .map((file) => JSON.parse(fs.readFileSync(new URL(file, directory), 'utf8')));
  const linksBySlug = new Map();
  const detailsBySlug = new Map(details.map((detail) => [detail.slug, detail]));

  for (const detail of details) {
    const html = renderProbingArticlePage(detail, articlesIndex);
    assert.match(html, /href="#probing">← Back to probing methods overview<\/a>/);
    linksBySlug.set(detail.slug, Object.fromEntries(
      [...html.matchAll(/class="article-sibling-link (prev|next)" href="#probing\?tech=([^"]+)"/g)]
        .map((match) => [match[1], decodeURIComponent(match[2])])
    ));
  }

  for (const [slug, links] of linksBySlug) {
    if (links.next) {
      assert.ok(detailsBySlug.has(links.next), `${slug} has a valid next destination`);
      assert.equal(linksBySlug.get(links.next).prev, slug, `${slug} and ${links.next} link back to each other`);
    }
    if (links.prev) {
      assert.ok(detailsBySlug.has(links.prev), `${slug} has a valid previous destination`);
      assert.equal(linksBySlug.get(links.prev).next, slug, `${slug} and ${links.prev} link back to each other`);
    }
  }
});

test('places sibling navigation inside the overview card when an article has no remaining body', () => {
  const html = renderProbingArticlePage({
    slug: 'test-method',
    title: 'Test method',
    sibling_navigation: { next: { slug: 'next-method', title: 'Next method' } },
    ppt_overview: [{ title: 'Overview', srcBasename: 'figure.png', text: 'Overview text.' }],
    blocks: [
      { type: 'heading', text: 'A real case (illustrative)' },
      { type: 'paragraph', text: 'Remove this example.' }
    ]
  }, articlesIndex);
  const overviewStart = html.indexOf('article-ppt-overview');
  const navStart = html.indexOf('article-sibling-nav');
  const overviewEnd = html.indexOf('</section>', overviewStart);
  assert.ok(navStart > overviewStart && navStart < overviewEnd);
});
