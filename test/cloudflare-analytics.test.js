import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('main entry includes the requested Cloudflare analytics beacon once', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal((html.match(/https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/g) || []).length, 1);
  assert.match(html, /data-cf-beacon='\{"token": "cc9e451022544e70bd3850ce0de0917d"\}'/);
});
