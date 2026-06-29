import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.resolve(
  __dirname,
  '../src/assets/generated/probing-articles/index.json'
);
const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));

test('every article card carries a string rep_figure', () => {
  assert.ok(Array.isArray(index.articles) && index.articles.length === 27);
  for (const a of index.articles) {
    assert.equal(typeof a.rep_figure, 'string', `${a.slug} rep_figure not string`);
  }
});

test('every article card carries a non-empty family_title', () => {
  for (const a of index.articles) {
    assert.ok(a.family_title && a.family_title.length > 0, `${a.slug} missing family_title`);
  }
});

test('articles with figures get a non-empty rep_figure basename', () => {
  const withFigs = index.articles.filter((a) => a.figure_count > 0);
  assert.ok(withFigs.length > 0, 'expected at least one article with figures');
  for (const a of withFigs) {
    // 契约：有图的文章必须给出首图 basename（无路径分隔符）。
    assert.ok(a.rep_figure.length > 0, `${a.slug} has figures but empty rep_figure`);
    assert.ok(!a.rep_figure.includes('/'), `${a.slug} rep_figure should be a basename`);
  }
  // 零 figure 文章的契约：rep_figure === ""。当前 27 篇全部有图，
  // 故该分支为契约性声明（无样本可断言）。
});
