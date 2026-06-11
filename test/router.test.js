import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoute, routeFromHash } from '../src/router.js';

test('normalizeRoute accepts supported routes only', () => {
  assert.equal(normalizeRoute('HOME'), 'home');
  assert.equal(normalizeRoute('browse'), 'browse');
  assert.equal(normalizeRoute('detail'), 'detail');
  assert.equal(normalizeRoute('unknown'), 'home');
});

test('routeFromHash parses url hash safely', () => {
  assert.equal(routeFromHash('#browse'), 'browse');
  assert.equal(routeFromHash('#DETAIL'), 'detail');
  assert.equal(routeFromHash(''), 'home');
  assert.equal(routeFromHash('#not-a-route'), 'home');
});
