import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderProbingArticleIndex } from '../src/probingArticleView.js';

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
});

test('omitting extraSectionsHtml keeps the legacy two-arg behavior', () => {
  const html = renderProbingArticleIndex(articlesIndex, '<header>H</header>');
  assert.match(html, /<header>H<\/header>/);
  assert.doesNotMatch(html, /data-extra-probing-block/);
});
