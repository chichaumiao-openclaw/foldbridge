import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  renderProbingFamilyIndex,
  renderProbingTechTable,
  renderProbingGlossary
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
  assert.match(html, /DMS chemical probing/);
  assert.match(html, /SHAPE 2′-OH acylation/);
  assert.match(html, /Mutational \/ proximity inference/);
  // 6 families => 6 cards
  assert.equal((html.match(/data-probing-family-link=/g) || []).length, 6);
});

test('family index links into the probing detail route', () => {
  const html = renderProbingFamilyIndex(articlesIndex.families);
  assert.match(html, /href="#detail/);
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
  assert.match(html, /href="#detail\?tech=rl-seq"[^>]*>RL-Seq<\/a>/);
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

// ---- renderProbingGlossary ----

const SAMPLE_TERMS = [
  { term: 'WC-face', definition: 'The Watson-Crick edge of a base where pairing hydrogen bonds form.' },
  { term: 'SHAPE', definition: 'Acylation of the ribose 2′-OH that reads backbone flexibility.' },
  { term: 'SASA', definition: 'Solvent-accessible surface area of a residue.' },
  { term: 'paired_state', definition: 'Whether a nucleotide is paired or unpaired in the reference structure.' },
  { term: 'tier', definition: 'Confidence tier assigned to a linked-structure claim.' },
  { term: 'reactivity', definition: 'The per-nucleotide probing signal magnitude.' }
];

test('glossary renders one entry per term with definitions', () => {
  const html = renderProbingGlossary(SAMPLE_TERMS);
  assert.match(html, /WC-face/);
  assert.match(html, /paired_state/);
  assert.match(html, /Solvent-accessible surface area/);
  assert.equal((html.match(/probing-glossary-term/g) || []).length, 6);
});

test('glossary empty input returns a degraded shell, not a throw', () => {
  const html = renderProbingGlossary([]);
  assert.equal(typeof html, 'string');
  assert.match(html, /probing-glossary/);
  assert.doesNotMatch(html, /probing-glossary-term/);
});
