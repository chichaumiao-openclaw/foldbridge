import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildAnnojointStructureUrl,
  resolveAnnojointStructurePath
} from '../scripts/lib/annojoin-atlas-structure.mjs';

test('buildAnnojointStructureUrl preserves ANNOJOIN structure route as an API parameter', () => {
  assert.equal(
    buildAnnojointStructureUrl('CONFIDENCE/10_structure_context/x/10zt.cif'),
    '/api/annojoin/structure?path=CONFIDENCE%2F10_structure_context%2Fx%2F10zt.cif'
  );
});

test('resolveAnnojointStructurePath accepts the local mirror without CONFIDENCE prefix', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'annojoin-structure-'));
  const cifPath = path.join(root, '10_structure_context/x/10zt.cif');
  await mkdir(path.dirname(cifPath), { recursive: true });
  await writeFile(cifPath, 'data_10zt\n_atom_site.id 1\n');

  const resolved = resolveAnnojointStructurePath({
    annoRoot: root,
    routePath: 'CONFIDENCE/10_structure_context/x/10zt.cif'
  });

  assert.equal(resolved.fullPath, cifPath);
  assert.equal(resolved.routePath, 'CONFIDENCE/10_structure_context/x/10zt.cif');
  assert.equal(resolved.fileName, '10zt.cif');
});

test('resolveAnnojointStructurePath rejects traversal outside the annotation root', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'annojoin-structure-'));

  assert.throws(
    () => resolveAnnojointStructurePath({ annoRoot: root, routePath: '../secret.cif' }),
    /unsafe structure_file_path/
  );
});
