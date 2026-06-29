#!/usr/bin/env node
import { runAnnojointAtlasSmoke } from './lib/annojoin-atlas-smoke.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  const value = process.argv[i + 1];
  if (key.startsWith('--') && value && !value.startsWith('--')) {
    args.set(key.slice(2), value);
    i += 1;
  }
}

const result = await runAnnojointAtlasSmoke({
  assetRoot: args.get('asset-root') || 'src/assets/generated/annojoin-atlas',
  sampleSize: Number(args.get('sample-size') || 20)
});

console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exit(1);
