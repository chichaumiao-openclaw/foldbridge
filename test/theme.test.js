import test from 'node:test';
import assert from 'node:assert/strict';
import { cssVarsFor, themeTokens } from '../src/theme.js';

test('theme token coverage for required site themes', () => {
  assert.deepEqual(Object.keys(themeTokens).sort(), [
    'aptamer',
    'ribocentre',
    'riboswitch'
  ]);
});

test('light mode vars include expected tokens', () => {
  const vars = cssVarsFor('ribocentre', 'light');
  assert.ok(vars.includes('--primary: #1D4ED8;'));
  assert.ok(vars.includes('--background: #F4F7F2;'));
  assert.ok(vars.includes('--textPrimary: #14221C;'));
});

test('dark mode vars include dark tokens', () => {
  const vars = cssVarsFor('aptamer', 'dark');
  assert.ok(vars.includes('--background: #08110e;'));
  assert.ok(vars.includes('--textPrimary: #edf4ef;'));
  assert.ok(vars.includes('--mode: dark;'));
});

test('dark mode includes onPrimary for button contrast', () => {
  const vars = cssVarsFor('riboswitch', 'dark');
  assert.ok(vars.includes('--onPrimary: #08110e;'));
});

test('fallback theme works', () => {
  const vars = cssVarsFor('unknown', 'light');
  assert.ok(vars.includes('--primary: #1D4ED8;'));
});
