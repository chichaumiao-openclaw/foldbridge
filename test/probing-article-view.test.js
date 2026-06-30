import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderProbingArticleIndex } from '../src/probingArticleView.js';

const articlesIndex = JSON.parse(
  fs.readFileSync(new URL('../src/assets/generated/probing-articles/index.json', import.meta.url), 'utf8')
);

test('article index still renders hero + family sections + article cards', () => {
  const html = renderProbingArticleIndex(articlesIndex);
  assert.match(html, /RNA probing methods explained/);
  assert.match(html, /technology-section-card/);
  assert.match(html, /probing-article-card/);
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
