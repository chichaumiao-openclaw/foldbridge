import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The published case-page renderers used to bundle a verbatim RCSB mmCIF mirror
// (structure.cif.gz) next to every case. That pushed the static artifact past
// the 1 GB GitHub Pages cap. We removed the mirrors and now resolve the source
// structure to RCSB at runtime, keeping the gzipped-text format so the existing
// fetch -> DecompressionStream -> text-crop -> reactivity-coloring pipeline is
// unchanged. resolveStructureSourceHref() does that mapping and MUST:
//   - rewrite a local structure.cif(.gz) mirror href to the RCSB download URL
//     using the PDB id (coverage.caseId)
//   - leave an already-absolute URL (e.g. the 5gag smoke demo) untouched
const RENDERERS = {
  'rasp-v3': path.resolve(here, '../public/rasp-v3/__rasp_v3_site__/workbench.js'),
  'rmdb-v3': path.resolve(here, '../public/rmdb-v3/__rmdb_v3_site__/workbench.js'),
  '5gag': path.resolve(here, '../public/annojoin-smoke/5gag/workbench.js'),
};

// Extract a named top-level function body from the workbench IIFE script so we
// can exercise its pure logic without a DOM. Brace-matched, no execution of the
// surrounding browser-only module code. (Same approach as
// rmdb-workbench-default-profile.test.js.)
function extractFunctionSource(src, name) {
  const sig = `function ${name}(`;
  const start = src.indexOf(sig);
  if (start < 0) throw new Error(`function ${name} not found in workbench.js`);
  let depth = 0;
  let i = src.indexOf('{', start);
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) { i += 1; break; }
    }
  }
  return src.slice(start, i);
}

function loadPureFunction(src, name) {
  const fnSource = extractFunctionSource(src, name);
  // eslint-disable-next-line no-new-func
  return new Function(`${fnSource}\nreturn ${name};`)();
}

for (const [label, workbenchPath] of Object.entries(RENDERERS)) {
  const source = fs.readFileSync(workbenchPath, 'utf8');

  test(`[${label}] resolveStructureSourceHref rewrites local mirror to RCSB by caseId`, () => {
    const resolve = loadPureFunction(source, 'resolveStructureSourceHref');
    assert.equal(
      resolve('../../../structure.cif.gz', '5ON6'),
      'https://files.rcsb.org/download/5ON6.cif.gz',
      'local gzipped mirror -> RCSB gzipped-text download (keeps .gz so decompress path is unchanged)'
    );
    assert.equal(
      resolve('../../structure.cif.gz', '7LYG'),
      'https://files.rcsb.org/download/7LYG.cif.gz',
      'depth of ../ relative prefix does not matter; caseId drives the PDB id'
    );
  });

  test(`[${label}] resolveStructureSourceHref uppercases the PDB id for RCSB`, () => {
    const resolve = loadPureFunction(source, 'resolveStructureSourceHref');
    assert.equal(
      resolve('../../../structure.cif.gz', '4v55'),
      'https://files.rcsb.org/download/4V55.cif.gz',
      'RCSB canonical ids are uppercase'
    );
  });

  test(`[${label}] resolveStructureSourceHref leaves absolute URLs untouched`, () => {
    const resolve = loadPureFunction(source, 'resolveStructureSourceHref');
    assert.equal(
      resolve('https://files.rcsb.org/download/5GAG.cif', '5GAG'),
      'https://files.rcsb.org/download/5GAG.cif',
      'already-absolute href (5gag smoke demo) must pass through unchanged'
    );
    assert.equal(
      resolve('http://example.org/foo.cif', '1ABC'),
      'http://example.org/foo.cif',
      'any absolute http(s) href passes through'
    );
  });

  test(`[${label}] resolveStructureSourceHref falls back to original href when caseId is missing`, () => {
    const resolve = loadPureFunction(source, 'resolveStructureSourceHref');
    assert.equal(
      resolve('../../../structure.cif.gz', ''),
      '../../../structure.cif.gz',
      'no PDB id -> cannot build RCSB url; keep original href rather than emit a broken url'
    );
  });
}
