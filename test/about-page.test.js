import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAboutPage } from '../src/siteChrome.js';

const CONTENT = {
  hero: { kicker: 'About', title: '关联探针与结构', summary: '摘要', detail: '细节' },
  sections: [
    { id: 'data-sources', title: '三源数据', kind: 'cards',
      items: [{ name: 'RMDB', body: 'a' }, { name: 'RASP', body: 'b' }, { name: 'PDB', body: 'c' }] },
    { id: 'pipeline', title: '流水线', kind: 'pipeline', steps: ['x', 'y', 'z'], body: 'p' },
    { id: 'thresholds', title: '阈值', kind: 'prose', body: '1 SUPPORTED / 10 INFORMED / 23 PENDING' }
  ]
};
test('renderAboutPage shows hero + all section titles', () => {
  const html = renderAboutPage(CONTENT);
  assert.match(html, /关联探针与结构/);
  assert.match(html, /三源数据/);
  assert.match(html, /流水线/);
  assert.match(html, /阈值/);
});
test('renderAboutPage renders pipeline as inline svg', () => {
  const html = renderAboutPage(CONTENT);
  assert.match(html, /<svg/);
  assert.match(html, /1 SUPPORTED \/ 10 INFORMED \/ 23 PENDING/);
});
test('renderAboutPage degrades to shell when content missing', () => {
  const html = renderAboutPage(null);
  assert.match(html, /<h1[^>]*>About<\/h1>/);
  assert.doesNotMatch(html, /undefined/);
});
