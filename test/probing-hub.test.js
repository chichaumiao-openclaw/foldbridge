import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  renderProbingFamilyIndex,
  renderProbingTechTable
} from '../src/siteChrome.js';

const registry = JSON.parse(
  fs.readFileSync(new URL('../src/assets/data/probe-technology-registry.json', import.meta.url), 'utf8')
);
const articlesIndex = JSON.parse(
  fs.readFileSync(new URL('../src/assets/generated/probing-articles/index.json', import.meta.url), 'utf8')
);

// ---- renderProbingFamilyIndex ----

test('family index renders a card per mechanism family with titles', () => {
  const html = renderProbingFamilyIndex(articlesIndex.families);
  assert.doesNotMatch(html, /browse by mechanism/i);
  assert.match(html, /DMS-based methods/);
  assert.match(html, /SHAPE-based methods/);
  assert.match(html, /RNA–RNA interaction mapping methods/);
  assert.match(html, /Crosslinking and proximity ligation capture RNA–RNA contacts and higher-order RNA organization\./);
  assert.doesNotMatch(html, /Mutational \/ proximity inference/);
  // 5 visible families; inference is intentionally omitted.
  assert.equal((html.match(/data-probing-family-link=/g) || []).length, 5);
});

test('family index links to same-page family anchors', () => {
  const html = renderProbingFamilyIndex(articlesIndex.families);
  assert.match(html, /href="#probing-family-dms"/);
  assert.match(html, /data-probing-family-link="dms"/);
  assert.doesNotMatch(html, /href="#detail/);
});

test('family index escapes same-page anchor attributes', () => {
  const html = renderProbingFamilyIndex([
    { id: 'bad"id', title: 'Escaped family', summary: 'Summary', articles: [] }
  ]);
  assert.match(html, /href="#probing-family-bad&quot;id"/);
  assert.match(html, /data-probing-family-link="bad&quot;id"/);
  assert.doesNotMatch(html, /bad"id/);
});

test('family index empty input returns a degraded shell, not a throw', () => {
  const html = renderProbingFamilyIndex([]);
  assert.equal(typeof html, 'string');
  assert.match(html, /probing-family-index/);
  assert.doesNotMatch(html, /probing-family-card/);
});

// ---- renderProbingTechTable ----

test('tech table renders all 34 technology rows', () => {
  const html = renderProbingTechTable(registry);
  assert.equal((html.match(/data-tech-row/g) || []).length, 34);
});

test('tech table shows a known technology and its family', () => {
  const html = renderProbingTechTable(registry);
  assert.match(html, /DMS/);
  assert.match(html, /RL-Seq/);
  assert.match(html, /mutate-and-map_candidate/);
});

test('tech table caption clarifies family is the measured quantity, not a ranking', () => {
  const html = renderProbingTechTable(registry);
  assert.match(html, /physical quantity/i);
  assert.match(html, /not a quality ranking/i);
});

test('tech table links the technology name when article_slug present', () => {
  const html = renderProbingTechTable(registry);
  assert.match(html, /href="#probing\?tech=rl-seq"[^>]*>RL-Seq<\/a>/);
});

test('tech table drops the threshold-basis column and empty explainer cells', () => {
  const html = renderProbingTechTable(registry);
  assert.doesNotMatch(html, /Threshold basis/);
  assert.doesNotMatch(html, /probing-basis-badge/);
  assert.doesNotMatch(html, /Read explainer/);
  assert.doesNotMatch(html, /probing-tech-article-none/);
});

test('tech table columns carry data-sort hooks', () => {
  const html = renderProbingTechTable(registry);
  assert.match(html, /data-sort=/);
});

test('tech table empty input returns a degraded shell, not a throw', () => {
  const html = renderProbingTechTable({ technologies: [] });
  assert.equal(typeof html, 'string');
  assert.match(html, /probing-tech-table/);
  assert.doesNotMatch(html, /data-tech-row/);
});
