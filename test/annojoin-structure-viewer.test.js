import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildColoredStructurePointCloud,
  parseMmcifAtomSites
} from '../src/annojoinStructureViewer.js';

const MMCIF_FIXTURE = `
data_10ZT
#
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_seq_id
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
ATOM 1 P P T A 2 1.0 2.0 3.0
ATOM 2 C C4' T A 2 1.5 2.5 3.5
ATOM 3 P P G A 3 4.0 5.0 6.0
#
`;

test('parseMmcifAtomSites reads atom_site coordinates and residue identity fields', () => {
  const parsed = parseMmcifAtomSites(MMCIF_FIXTURE);

  assert.equal(parsed.dataBlock, '10ZT');
  assert.equal(parsed.atoms.length, 3);
  assert.deepEqual(parsed.atoms[0], {
    atomId: '1',
    atomName: 'P',
    typeSymbol: 'P',
    compId: 'T',
    chainId: 'A',
    seqId: '2',
    x: 1,
    y: 2,
    z: 3
  });
});

test('buildColoredStructurePointCloud prefers one representative atom per residue and maps color bins', () => {
  const parsed = parseMmcifAtomSites(MMCIF_FIXTURE);
  const cloud = buildColoredStructurePointCloud({
    atoms: parsed.atoms,
    pdbId: parsed.dataBlock,
    colorPoints: [
      { coordinateKey: '10ZT|1|1|A|2|T', colorBin: 'mid', reactivityValue: 0.6 },
      { coordinateKey: '10ZT|1|1|A|3|G', colorBin: 'high', reactivityValue: 1.4 }
    ]
  });

  assert.equal(cloud.points.length, 2);
  assert.deepEqual(
    cloud.points.map((point) => [point.label, point.colorBin, point.reactivityValue]),
    [['A:2 T', 'mid', 0.6], ['A:3 G', 'high', 1.4]]
  );
  assert.deepEqual(cloud.bounds.min, { x: 1, y: 2, z: 3 });
  assert.deepEqual(cloud.bounds.max, { x: 4, y: 5, z: 6 });
});
