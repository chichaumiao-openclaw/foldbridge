import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  linkSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';

import {
  buildLocalGeometrySidecar,
  deterministicGzip,
  deterministicJson,
  parseAtomSiteResidues,
  prepareDssrInput,
  sha256Bytes,
} from '../scripts/local-geometry-sidecar-lib.mjs';
import { validateLocalGeometrySidecar } from '../public/entry-cases/__entry_v3_site__/workbench-pure.mjs';

const CASE_ID = 'case-demo';
const CHAIN_ID = 'X';
const CHAIN_KEY = `${CASE_ID}|chain|${CHAIN_ID}`;
const SCRIPT = new URL('../scripts/build-local-geometry-sidecar.mjs', import.meta.url);

function residueKey(position) {
  return `${CHAIN_KEY}|${position}`;
}

const STRUCTURE_CIF = `data_demo
_entry.id demo
loop_
_entity.id
_entity.type
1 polymer
#
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_alt_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_entity_id
_atom_site.label_seq_id
_atom_site.pdbx_PDB_ins_code
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.auth_seq_id
_atom_site.auth_comp_id
_atom_site.auth_asym_id
_atom_site.pdbx_PDB_model_num
ATOM 1 C "C1'" . G A 1 1 ? 1.0 2.0 3.0 101 G X 2
ATOM 2 C "C2'" A G A 1 1 ? 1.1 2.1 3.1 101 G X 2
ATOM 3 C "C2'" B G A 1 1 ? 1.2 2.2 3.2 101 G X 2
ATOM 4 C "C1'" . A A 1 2 A 2.0 3.0 4.0 102 A X 2
ATOM 5 C "C1'" . C A 1 3 ? 3.0 4.0 5.0 103 C X 2
ATOM 6 C "C1'" . U B 2 9 ? 4.0 5.0 6.0 9 U Y 2
ATOM 7 C "C1'" . G A 1 1 ? 9.0 9.0 9.0 101 G X 1
ATOM 8 C "C1'" . U B 2 9 ? 9.0 9.0 9.0 9 U Y 1
#
_audit_conform.dict_name mmcif_pdbx.dic
`;

function linkedView({ ambiguous = false } = {}) {
  const residueIndex = {
    residues: [
      { residueKey: residueKey(1), chainKey: CHAIN_KEY, labelSeqId: 1, compId: 'G', parentBase: 'G' },
      { residueKey: residueKey(2), chainKey: CHAIN_KEY, labelSeqId: 2, compId: 'A', parentBase: 'A' },
      { residueKey: residueKey(3), chainKey: CHAIN_KEY, labelSeqId: 3, compId: 'C', parentBase: 'C' },
    ],
  };
  const loci = [
    {
      residueKey: residueKey(1),
      coordinateStatus: 'resolved',
      locator: {
        label_asym_id: 'A', auth_asym_id: 'X', label_seq_id: 1, auth_seq_id: 101,
        pdbx_PDB_ins_code: '',
      },
    },
    {
      residueKey: residueKey(2),
      coordinateStatus: 'resolved',
      locator: {
        label_asym_id: 'A', auth_asym_id: 'X', label_seq_id: 2, auth_seq_id: 102,
        pdbx_PDB_ins_code: 'A',
      },
    },
    {
      residueKey: residueKey(3),
      coordinateStatus: 'resolved',
      locator: {
        label_asym_id: 'A', auth_asym_id: 'X', label_seq_id: 3, auth_seq_id: 103,
        pdbx_PDB_ins_code: '',
      },
    },
  ];
  if (ambiguous) loci.push(structuredClone(loci[0]));
  return { residueIndex, structureContexts: { loci } };
}

function dssrJson({ omitThirdNt = false } = {}) {
  const nts = [
    {
      nt_id: 'X.G101', chain_name: 'X', nt_resnum: '101', nt_name: 'G', nt_code: 'G',
      puckering: "C3'-endo", phase_angle: 18.25, amplitude: 42.5,
    },
    {
      nt_id: 'X.A102^A', chain_name: 'X', nt_resnum: '102', nt_ins_code: 'A', nt_name: 'A', nt_code: 'A',
      puckering: "C2'-endo", phase_angle: 155.5, amplitude: 37.75,
    },
    {
      nt_id: 'X.C103', chain_name: 'X', nt_resnum: '103', nt_name: 'C', nt_code: 'C',
      puckering: "C3'-endo", phase_angle: 20, amplitude: 40,
    },
    {
      nt_id: 'Y.U9', chain_name: 'Y', nt_resnum: '9', nt_name: 'U', nt_code: 'U',
      puckering: "C3'-endo", phase_angle: 12, amplitude: 39,
    },
  ];
  if (omitThirdNt) nts.splice(2, 1);
  return {
    nts,
    nonPairs: [
      {
        nt1: 'X.G101', nt2: 'X.A102^A',
        stacking: { type: 'pm(>>,forward)', oArea: 2.5, oArea_ring: 1.25 },
      },
      {
        nt1: 'X.G101', nt2: 'X.C103',
        stacking: { type: 'mp(><,backward)', oArea: 3.5, oArea_ring: 2.25 },
      },
      {
        nt1: 'X.A102^A', nt2: 'Y.U9',
        stacking: { type: 'pp(>>,forward)', oArea: 1.75, oArea_ring: 0.75 },
      },
      { nt1: 'X.C103', nt2: 'Y.U9' },
    ],
  };
}

function buildOptions(overrides = {}) {
  const structureBytes = Buffer.from(STRUCTURE_CIF);
  const prepared = prepareDssrInput(structureBytes);
  return {
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
    linkedView: linkedView(),
    dssr: dssrJson(),
    caseId: CASE_ID,
    chainId: CHAIN_ID,
    tool: 'x3dna-dssr',
    toolVersion: 'v1.9.10',
    containerImage: 'foldbridge/dssr:1.9.10',
    containerImageId: `sha256:${'a'.repeat(64)}`,
    command: 'x3dna-dssr --json --non-pair --input=dssr-input.cif',
    ...overrides,
  };
}

test('prepare keeps every chain and altloc row from the first encountered atom-site model', () => {
  const sourceBytes = Buffer.from(STRUCTURE_CIF);
  const prepared = prepareDssrInput(sourceBytes);

  assert.equal(prepared.meta.modelId, '2', 'model policy is first encountered, not numerically smallest');
  assert.equal(prepared.meta.modelPolicy, 'first_atom_site_model');
  assert.equal(prepared.meta.altlocPolicy, 'preserve_input_altlocs_dssr_managed');
  assert.equal(prepared.meta.structureSha256, sha256Bytes(sourceBytes));
  assert.equal(prepared.meta.dssrInputSha256, sha256Bytes(prepared.bytes));

  const output = prepared.bytes.toString('utf8');
  assert.match(output, /_entity\.type/);
  assert.match(output, /_audit_conform\.dict_name/);
  const physicalAtomRows = output.split(/\r?\n/).filter((line) => /^(?:ATOM|HETATM)(?:\s|$)/.test(line));
  assert.equal(physicalAtomRows.length, 6);
  for (const line of physicalAtomRows) {
    assert.equal(line.trim().split(/\s+/).length, 17,
      'each atom_site row must occupy one complete physical line for DSSR');
  }
  const residues = parseAtomSiteResidues(prepared.bytes);
  assert.equal(residues.modelId, '2');
  assert.equal(residues.atomRows.length, 6, 'all selected-model atom rows remain, including two altlocs');
  assert.deepEqual([...new Set(residues.atomRows.map((row) => row.authAsymId))].sort(), ['X', 'Y']);
  assert.deepEqual(residues.atomRows.filter((row) => row.authSeqId === 101).map((row) => row.altId), ['', 'A', 'B']);
  assert.equal(residues.atomRows.some((row) => row.modelId === '1'), false);

  const preparedAgain = prepareDssrInput(prepared.bytes);
  const reparsed = parseAtomSiteResidues(preparedAgain.bytes);
  assert.deepEqual(preparedAgain.bytes, prepared.bytes);
  assert.deepEqual(reparsed.atomRows, residues.atomRows);
  assert.deepEqual(reparsed.residues, residues.residues);
});

test('prepare rejects an atom_site value containing a physical newline', () => {
  const multilineAtomSite = `data_multiline
loop_
_atom_site.group_PDB
_atom_site.label_atom_id
_atom_site.pdbx_PDB_model_num
ATOM
;
C1
invalid
;
1
`;
  assert.throws(
    () => prepareDssrInput(Buffer.from(multilineAtomSite)),
    /atom_site.*newline|single physical line/i,
  );
});

test('prepare rejects a malformed atom_site_anisotrop loop without silently dropping evidence', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF.replace(
    '#\n_audit_conform.dict_name mmcif_pdbx.dic',
    '#\nloop_\n_atom_site_anisotrop.id\n_atom_site_anisotrop.U[1][1]\n1 0.1 orphan\n#\n'
      + '_audit_conform.dict_name mmcif_pdbx.dic',
  ));

  assert.throws(() => prepareDssrInput(structureBytes), /loop _atom_site_anisotrop\.id value count/);
});

test('build materializes DSSR pucker and one pair per nonPair with independent topology', () => {
  const payload = buildLocalGeometrySidecar(buildOptions());
  const expectedLinkedView = linkedView();
  const contextLocusByResidueKey = new Map(
    expectedLinkedView.structureContexts.loci.map((locus) => [locus.residueKey, locus]),
  );

  assert.doesNotThrow(() => validateLocalGeometrySidecar(payload, {
    caseId: CASE_ID,
    chainId: CHAIN_ID,
    residues: expectedLinkedView.residueIndex.residues.map((residue) => {
      const contextLocator = contextLocusByResidueKey.get(residue.residueKey).locator;
      return {
        residueKey: residue.residueKey,
        position: residue.labelSeqId,
        base: residue.parentBase,
        locator: {
          labelAsymId: contextLocator.label_asym_id,
          authAsymId: contextLocator.auth_asym_id,
          labelSeqId: contextLocator.label_seq_id,
          authSeqId: contextLocator.auth_seq_id,
          insertionCode: contextLocator.pdbx_PDB_ins_code,
          componentId: residue.compId,
        },
      };
    }),
  }), 'builder output must satisfy the browser-side strict schema');

  assert.equal(payload.schemaVersion, 'foldbridge-local-geometry.v1');
  assert.deepEqual(payload.residues.map((residue) => residue.position), [1, 2, 3]);
  assert.deepEqual(payload.residues[0].pucker, {
    status: 'computed', class: "C3'-endo", phaseDeg: 18.25, amplitudeDeg: 42.5,
  });
  assert.deepEqual(payload.residues[0].stacking.partners.map((partner) => ({
    partnerPosition: partner.partnerPosition,
    topology: partner.topology,
    dssrStackClass: partner.dssrStackClass,
    sourcePairIndex: partner.sourcePairIndex,
  })), [
    { partnerPosition: 2, topology: 'three_prime_adjacent', dssrStackClass: 'pm(>>,forward)', sourcePairIndex: 0 },
    { partnerPosition: 3, topology: 'non_adjacent_intrachain', dssrStackClass: 'mp(><,backward)', sourcePairIndex: 1 },
  ]);
  assert.equal(payload.residues[1].stacking.partners[0].topology, 'five_prime_adjacent');
  const crossChain = payload.residues[1].stacking.partners[1];
  assert.equal(crossChain.topology, 'interchain');
  assert.equal(crossChain.partnerResidueKey, null);
  assert.equal(crossChain.partnerPosition, null);
  assert.equal(crossChain.partnerLocator.authAsymId, 'Y');
  assert.equal(crossChain.partnerBase, 'U');
  assert.equal(crossChain.overlapArea, 1.75);
  assert.equal(crossChain.ringOverlapArea, 0.75);
  assert.equal(payload.residues[2].stacking.partners.length, 1,
    'a nonPair without stacking is not reinterpreted as a stacking edge');
  assert.deepEqual(payload.source, {
    tool: 'x3dna-dssr',
    toolVersion: 'v1.9.10',
    containerImage: 'foldbridge/dssr:1.9.10',
    containerImageId: `sha256:${'a'.repeat(64)}`,
    command: 'x3dna-dssr --json --non-pair --input=dssr-input.cif',
    structureSha256: sha256Bytes(Buffer.from(STRUCTURE_CIF)),
    dssrInputSha256: buildOptions().prepareMeta.dssrInputSha256,
    modelId: '2',
    modelPolicy: 'first_atom_site_model',
    altlocPolicy: 'preserve_input_altlocs_dssr_managed',
  });
});

test('unique polymer label identity restores an omitted author insertion code from atom_site', () => {
  const linked = linkedView();
  delete linked.structureContexts.loci[1].locator.pdbx_PDB_ins_code;

  const payload = buildLocalGeometrySidecar(buildOptions({ linkedView: linked }));

  assert.equal(payload.residues[1].locator.labelAsymId, 'A');
  assert.equal(payload.residues[1].locator.labelSeqId, 2);
  assert.equal(payload.residues[1].locator.authAsymId, 'X');
  assert.equal(payload.residues[1].locator.authSeqId, 102);
  assert.equal(payload.residues[1].locator.insertionCode, 'A');
});

test('label identity never masks explicit insertion-code or author-identity conflicts', () => {
  const wrongInsertion = linkedView();
  wrongInsertion.structureContexts.loci[1].locator.pdbx_PDB_ins_code = 'B';
  assert.throws(
    () => buildLocalGeometrySidecar(buildOptions({ linkedView: wrongInsertion })),
    /insertion.code|identity/i,
  );

  const wrongAuthorSequence = linkedView();
  wrongAuthorSequence.structureContexts.loci[1].locator.auth_seq_id = 999;
  assert.throws(
    () => buildLocalGeometrySidecar(buildOptions({ linkedView: wrongAuthorSequence })),
    /author.*identity|auth.*sequence|identity/i,
  );
});

test('analyzed nucleotide with no edges is computed empty while missing nucleotide is not computable', () => {
  const dssr = dssrJson({ omitThirdNt: true });
  dssr.nonPairs = [];
  const payload = buildLocalGeometrySidecar(buildOptions({ dssr }));

  assert.deepEqual(payload.residues[0].stacking, { status: 'computed', partners: [] });
  assert.deepEqual(payload.residues[2].pucker, {
    status: 'not_computable', reason: 'DSSR nucleotide absent',
  });
  assert.deepEqual(payload.residues[2].stacking, {
    status: 'not_computable', reason: 'DSSR nucleotide absent',
  });

  const incompletePucker = dssrJson();
  delete incompletePucker.nts[0].amplitude;
  const incomplete = buildLocalGeometrySidecar(buildOptions({ dssr: incompletePucker }));
  assert.deepEqual(incomplete.residues[0].pucker, {
    status: 'not_computable', reason: 'DSSR pucker incomplete',
  });
  assert.equal(incomplete.residues[0].stacking.status, 'computed');
});

test('identity ambiguity and a mismatched controlled-input digest fail the whole chain', () => {
  assert.throws(
    () => buildLocalGeometrySidecar(buildOptions({ linkedView: linkedView({ ambiguous: true }) })),
    /duplicate|ambiguous/i,
  );

  const options = buildOptions();
  options.prepareMeta = { ...options.prepareMeta, dssrInputSha256: 'f'.repeat(64) };
  assert.throws(() => buildLocalGeometrySidecar(options), /DSSR input SHA-256 mismatch/i);
});

test('unrelated polymer microheterogeneity does not block the linked RNA target', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF.replace(
    'ATOM 6 C "C1\'" . U B 2 9 ? 4.0 5.0 6.0 9 U Y 2\n',
    'ATOM 6 C "C1\'" . U B 2 9 ? 4.0 5.0 6.0 9 U Y 2\n'
      + 'ATOM 9 C CA A VAL P 3 1 ? 5.0 6.0 7.0 3 VAL BO 2\n'
      + 'ATOM 10 C CA B SER P 3 1 ? 5.1 6.1 7.1 3 SER BO 2\n',
  ));
  const prepared = prepareDssrInput(structureBytes);

  const payload = buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
  }));

  assert.deepEqual(payload.residues.map((residue) => residue.position), [1, 2, 3]);
});

test('target polymer microheterogeneity still rejects two label identities', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF.replace(
    'ATOM 7 C',
    'ATOM 9 C CA B A A 1 1 ? 5.0 6.0 7.0 101 A X 2\nATOM 7 C',
  ));
  const prepared = prepareDssrInput(structureBytes);
  assert.throws(() => buildLocalGeometrySidecar(buildOptions({
    structureBytes, dssrInputBytes: prepared.bytes, prepareMeta: prepared.meta,
  })), /resolved linked residue .* has 2 atom-site identities/);
});

test('DSSR author identity shared by different label residues remains ambiguous', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF.replace(
    'ATOM 7 C',
    'ATOM 9 C CA . G Q 3 1 ? 5.0 6.0 7.0 101 G X 2\nATOM 7 C',
  ));
  const prepared = prepareDssrInput(structureBytes);
  assert.throws(() => buildLocalGeometrySidecar(buildOptions({
    structureBytes, dssrInputBytes: prepared.bytes, prepareMeta: prepared.meta,
  })), /DSSR nucleotide X.G101 has 2 atom-site identities/);
});

test('case, chain, and residue-index coverage must bind exactly to linked-view identity', () => {
  assert.throws(
    () => buildLocalGeometrySidecar(buildOptions({ caseId: 'wrong-case' })),
    /caseId|chainKey|residueKey|case identity|canonical/i,
  );
  const wrongChain = linkedView();
  wrongChain.residueIndex.residues[0].chainKey = `${CASE_ID}|chain|Y`;
  assert.throws(
    () => buildLocalGeometrySidecar(buildOptions({ linkedView: wrongChain })),
    /chain|coverage|residueKey/i,
  );
  const missingIndexChain = linkedView();
  for (const residue of missingIndexChain.residueIndex.residues) {
    residue.chainKey = `${CASE_ID}|chain|Y`;
  }
  assert.throws(
    () => buildLocalGeometrySidecar(buildOptions({ linkedView: missingIndexChain })),
    /chain|coverage|residueKey/i,
  );
  const wrongResidueKey = linkedView();
  wrongResidueKey.residueIndex.residues[0].residueKey = `${CASE_ID}|${CHAIN_ID}|1`;
  wrongResidueKey.structureContexts.loci[0].residueKey = `${CASE_ID}|${CHAIN_ID}|1`;
  assert.throws(
    () => buildLocalGeometrySidecar(buildOptions({ linkedView: wrongResidueKey })),
    /chainKey|residueKey|canonical/i,
  );
});

test('build requires explicit prepare provenance rather than reconstructing missing metadata', () => {
  const options = buildOptions();
  delete options.prepareMeta;
  assert.throws(() => buildLocalGeometrySidecar(options), /prepare meta.*required/i);
});

test('residue component is authoritative while optional context identities are strict cross-checks', () => {
  const mutations = [
    ['missing residue component', (value) => { delete value.residueIndex.residues[0].compId; }],
    ['blank residue component', (value) => { value.residueIndex.residues[0].compId = ''; }],
    ['conflicting context model', (value) => { value.structureContexts.loci[0].locator.modelId = '1'; }],
    ['conflicting context component', (value) => { value.structureContexts.loci[0].locator.componentId = 'C'; }],
    ['conflicting atom-site component', (value) => { value.residueIndex.residues[0].compId = 'C'; }],
    ['missing status', (value) => { delete value.structureContexts.loci[0].coordinateStatus; }],
    ['unknown status', (value) => { value.structureContexts.loci[0].coordinateStatus = 'unknown'; }],
  ];
  for (const [label, mutate] of mutations) {
    const value = linkedView();
    mutate(value);
    assert.throws(
      () => buildLocalGeometrySidecar(buildOptions({ linkedView: value })),
      /model|component|compId|atom-site|coordinateStatus/i,
      label,
    );
  }

  const matchingOptionalContext = linkedView();
  matchingOptionalContext.structureContexts.loci[0].locator.modelId = '2';
  matchingOptionalContext.structureContexts.loci[0].locator.componentId = 'G';
  assert.doesNotThrow(
    () => buildLocalGeometrySidecar(buildOptions({ linkedView: matchingOptionalContext })),
  );
});

test('digit-suffixed modified nucleotide keeps linked parent base and parses DSSR slash numbering', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF
    .replace('ATOM 1 C "C1\'" . G A 1 1 ? 1.0 2.0 3.0 101 G X 2',
      'ATOM 1 C "C1\'" . A23 A 1 1 ? 1.0 2.0 3.0 101 A23 X 2')
    .replace('ATOM 2 C "C2\'" A G A 1 1 ? 1.1 2.1 3.1 101 G X 2',
      'ATOM 2 C "C2\'" A A23 A 1 1 ? 1.1 2.1 3.1 101 A23 X 2')
    .replace('ATOM 3 C "C2\'" B G A 1 1 ? 1.2 2.2 3.2 101 G X 2',
      'ATOM 3 C "C2\'" B A23 A 1 1 ? 1.2 2.2 3.2 101 A23 X 2'));
  const prepared = prepareDssrInput(structureBytes);
  const linked = linkedView();
  linked.residueIndex.residues[0].compId = 'A';
  linked.residueIndex.residues[0].parentBase = 'A';
  const dssr = dssrJson();
  dssr.nts[0] = {
    ...dssr.nts[0],
    nt_id: 'X.A23/101',
    nt_name: 'A23',
    nt_code: 'a',
  };
  dssr.nonPairs[0].nt1 = 'X.A23/101';
  dssr.nonPairs[1].nt1 = 'X.A23/101';

  const payload = buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
    linkedView: linked,
    dssr,
  }));

  assert.equal(payload.residues[0].base, 'A');
  assert.equal(payload.residues[0].locator.componentId, 'A23');
});

test('modified atom component is accepted only when DSSR canonical code matches linked compId', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF
    .replace('ATOM 1 C "C1\'" . G A 1 1 ? 1.0 2.0 3.0 101 G X 2',
      'ATOM 1 C "C1\'" . 2MG A 1 1 ? 1.0 2.0 3.0 101 2MG X 2')
    .replace('ATOM 2 C "C2\'" A G A 1 1 ? 1.1 2.1 3.1 101 G X 2',
      'ATOM 2 C "C2\'" A 2MG A 1 1 ? 1.1 2.1 3.1 101 2MG X 2')
    .replace('ATOM 3 C "C2\'" B G A 1 1 ? 1.2 2.2 3.2 101 G X 2',
      'ATOM 3 C "C2\'" B 2MG A 1 1 ? 1.2 2.2 3.2 101 2MG X 2'));
  const prepared = prepareDssrInput(structureBytes);
  const linked = linkedView();
  linked.residueIndex.residues[0].compId = 'G';
  linked.residueIndex.residues[0].parentBase = 'A';
  const dssr = dssrJson();
  dssr.nts[0] = {
    ...dssr.nts[0],
    nt_id: 'X.2MG101',
    nt_name: '2MG',
    nt_code: 'g',
  };
  dssr.nonPairs[0].nt1 = 'X.2MG101';
  dssr.nonPairs[1].nt1 = 'X.2MG101';

  const payload = buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
    linkedView: linked,
    dssr,
  }));

  assert.equal(payload.residues[0].base, 'A');
  assert.equal(payload.residues[0].locator.componentId, '2MG');

  dssr.nts[0].nt_code = 'c';
  assert.throws(() => buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
    linkedView: linked,
    dssr,
  })), /component identity does not match atom-site/i);
});

test('DSSR three-character component truncation maps only to one exact author-locus prefix', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF
    .replace('ATOM 1 C "C1\'" . G A 1 1 ? 1.0 2.0 3.0 101 G X 2',
      'ATOM 1 C "C1\'" . A1LZ3 A 1 1 ? 1.0 2.0 3.0 101 A1LZ3 X 2')
    .replace('ATOM 2 C "C2\'" A G A 1 1 ? 1.1 2.1 3.1 101 G X 2',
      'ATOM 2 C "C2\'" A A1LZ3 A 1 1 ? 1.1 2.1 3.1 101 A1LZ3 X 2')
    .replace('ATOM 3 C "C2\'" B G A 1 1 ? 1.2 2.2 3.2 101 G X 2',
      'ATOM 3 C "C2\'" B A1LZ3 A 1 1 ? 1.2 2.2 3.2 101 A1LZ3 X 2'));
  const prepared = prepareDssrInput(structureBytes);
  const linked = linkedView();
  linked.residueIndex.residues[0].compId = 'A';
  linked.residueIndex.residues[0].parentBase = 'A';
  const dssr = dssrJson();
  dssr.nts[0] = {
    ...dssr.nts[0],
    nt_id: 'X.A1L101',
    nt_name: 'A1L',
    nt_code: 'a',
  };
  dssr.nonPairs[0].nt1 = 'X.A1L101';
  dssr.nonPairs[1].nt1 = 'X.A1L101';

  const payload = buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
    linkedView: linked,
    dssr,
  }));
  assert.equal(payload.residues[0].locator.componentId, 'A1LZ3');

  dssr.nts[0].nt_name = 'A1X';
  dssr.nts[0].nt_id = 'X.A1X101';
  dssr.nonPairs[0].nt1 = 'X.A1X101';
  dssr.nonPairs[1].nt1 = 'X.A1X101';
  assert.throws(() => buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
    linkedView: linked,
    dssr,
  })), /DSSR nucleotide .* has 0 atom-site identities/i);
});

test('mmCIF entity canonical sequence verifies a modified residue absent from DSSR', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF
    .replace('. C A 1 3 ? 3.0 4.0 5.0 103 C X 2', '. PSU A 1 3 ? 3.0 4.0 5.0 103 PSU X 2')
    + '\nloop_\n_struct_asym.id\n_struct_asym.entity_id\nA 1\n#\n'
    + 'loop_\n_entity_poly.entity_id\n_entity_poly.type\n_entity_poly.pdbx_seq_one_letter_code_can\n'
    + '1 polyribonucleotide GAU\n#\n'
    + 'loop_\n_entity_poly_seq.entity_id\n_entity_poly_seq.num\n_entity_poly_seq.mon_id\n'
    + '1 1 G\n1 2 A\n1 3 PSU\n#\n');
  const prepared = prepareDssrInput(structureBytes);
  const linked = linkedView();
  linked.residueIndex.residues[2].compId = 'U';
  linked.residueIndex.residues[2].parentBase = 'C';
  const dssr = dssrJson({ omitThirdNt: true });
  dssr.nonPairs = [];
  const options = buildOptions({ structureBytes, dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta, linkedView: linked, dssr });
  const payload = buildLocalGeometrySidecar(options);
  assert.equal(payload.residues[2].locator.componentId, 'PSU');
  assert.equal(payload.residues[2].base, 'C');
  assert.deepEqual(payload.residues[2].pucker,
    { status: 'not_computable', reason: 'DSSR nucleotide absent' });
  for (const [before, after] of [
    ['A 1\n#', 'A 1\nA 2\n#'],
    ['1 3 PSU\n#', '1 3 C\n#'],
    ['. PSU A 1 3', '. PSU A 2 3'],
  ]) {
    const conflictingBytes = Buffer.from(structureBytes.toString().replace(before, after));
    const conflictingPrepared = prepareDssrInput(conflictingBytes);
    assert.throws(() => buildLocalGeometrySidecar({ ...options,
      structureBytes: conflictingBytes, dssrInputBytes: conflictingPrepared.bytes,
      prepareMeta: conflictingPrepared.meta }), /component identity/);
  }
  const conflictingDssr = structuredClone(dssr);
  conflictingDssr.nts.push({ ...dssrJson().nts[2], nt_id: 'X.PSU103',
    nt_name: 'PSU', nt_code: 'c' });
  assert.throws(() => buildLocalGeometrySidecar({ ...options, dssr: conflictingDssr }), /component identity/);
  const modifiedCodeDssr = structuredClone(conflictingDssr);
  modifiedCodeDssr.nts.at(-1).nt_code = 'P';
  assert.equal(buildLocalGeometrySidecar({ ...options, dssr: modifiedCodeDssr })
    .residues[2].locator.componentId, 'PSU');
  linked.residueIndex.residues[2].compId = 'N';
  linked.residueIndex.residues[2].parentBase = 'U';
  assert.equal(buildLocalGeometrySidecar({ ...options, dssr: modifiedCodeDssr })
    .residues[2].base, 'U');
  linked.residueIndex.residues[2].compId = 'G';
  assert.throws(() => buildLocalGeometrySidecar(options), /component identity/);
});

test('interchain nucleotide ligand without label_seq_id remains an exact DSSR stacking partner', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF.replace(
    'ATOM 8 C "C1\'" . U B 2 9 ? 9.0 9.0 9.0 9 U Y 1\n',
    'ATOM 8 C "C1\'" . U B 2 9 ? 9.0 9.0 9.0 9 U Y 1\n'
      + 'HETATM 9 C "C1\'" . WSB L 3 . ? 5.0 6.0 7.0 1005 WSB Z 2\n',
  ));
  const prepared = prepareDssrInput(structureBytes);
  const dssr = dssrJson();
  dssr.nts[3] = {
    ...dssr.nts[3],
    nt_id: 'Z.WSB1005',
    chain_name: 'Z',
    nt_resnum: '1005',
    nt_name: 'WSB',
    nt_code: 'u',
  };
  dssr.nonPairs[2].nt2 = 'Z.WSB1005';
  dssr.nonPairs[3].nt2 = 'Z.WSB1005';

  const payload = buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
    dssr,
  }));
  const ligand = payload.residues[1].stacking.partners.find((partner) => partner.topology === 'interchain');
  assert.deepEqual(ligand.partnerLocator, {
    modelId: '2',
    labelAsymId: 'L',
    authAsymId: 'Z',
    labelSeqId: null,
    authSeqId: 1005,
    insertionCode: '',
    componentId: 'WSB',
  });
});

test('same-author-chain non-polymer ligand is a read-only non-target stacking partner', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF.replace(
    'ATOM 8 C "C1\'" . U B 2 9 ? 9.0 9.0 9.0 9 U Y 1\n',
    'ATOM 8 C "C1\'" . U B 2 9 ? 9.0 9.0 9.0 9 U Y 1\n'
      + 'HETATM 9 C "C1\'" . AMP L 3 . ? 5.0 6.0 7.0 1005 AMP X 2\n',
  ));
  const prepared = prepareDssrInput(structureBytes);
  const dssr = dssrJson();
  dssr.nts.push({
    nt_id: 'X.AMP1005', chain_name: 'X', nt_resnum: '1005', nt_name: 'AMP', nt_code: 'a',
    puckering: "C3'-endo", phase_angle: 12, amplitude: 39,
  });
  dssr.nonPairs[0].nt2 = 'X.AMP1005';

  const payload = buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
    dssr,
  }));
  const ligand = payload.residues[0].stacking.partners.find(
    (partner) => partner.partnerLocator.componentId === 'AMP',
  );
  assert.ok(ligand);

  assert.equal(ligand.topology, 'non_target_intrachain');
  assert.equal(ligand.partnerResidueKey, null);
  assert.equal(ligand.partnerPosition, null);
  assert.equal(ligand.partnerBase, 'a');
  assert.equal(ligand.dssrStackClass, 'pm(>>,forward)');
  assert.equal(ligand.overlapArea, 2.5);
  assert.equal(ligand.ringOverlapArea, 1.25);
  assert.deepEqual(ligand.partnerLocator, {
    modelId: '2',
    labelAsymId: 'L',
    authAsymId: 'X',
    labelSeqId: null,
    authSeqId: 1005,
    insertionCode: '',
    componentId: 'AMP',
  });
});

test('extra same-author-chain polymer coordinates remain a coverage failure without DSSR edges', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF.replace(
    'ATOM 8 C "C1\'" . U B 2 9 ? 9.0 9.0 9.0 9 U Y 1\n',
    'ATOM 8 C "C1\'" . U B 2 9 ? 9.0 9.0 9.0 9 U Y 1\n'
      + 'ATOM 9 C "C1\'" . A L 3 4 ? 5.0 6.0 7.0 1005 A X 2\n',
  ));
  const prepared = prepareDssrInput(structureBytes);
  assert.throws(() => buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
  })), /target-chain residue coverage mismatch; 1 extra atom-site residues/);
});

test('same-author-chain polymer residue absent from linked-view remains a build failure', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF.replace(
    'ATOM 8 C "C1\'" . U B 2 9 ? 9.0 9.0 9.0 9 U Y 1\n',
    'ATOM 8 C "C1\'" . U B 2 9 ? 9.0 9.0 9.0 9 U Y 1\n'
      + 'ATOM 9 C "C1\'" . A L 3 4 ? 5.0 6.0 7.0 1005 A X 2\n',
  ));
  const prepared = prepareDssrInput(structureBytes);
  const dssr = dssrJson();
  dssr.nts.push({
    nt_id: 'X.A1005', chain_name: 'X', nt_resnum: '1005', nt_name: 'A', nt_code: 'A',
    puckering: "C3'-endo", phase_angle: 12, amplitude: 39,
  });
  dssr.nonPairs[0].nt2 = 'X.A1005';

  assert.throws(
    () => buildLocalGeometrySidecar(buildOptions({
      structureBytes,
      dssrInputBytes: prepared.bytes,
      prepareMeta: prepared.meta,
      dssr,
    })),
    /linked-view and atom-site target-chain residue coverage mismatch|same-chain DSSR partner/i,
  );
});

test('production sequence_only residues are accepted only when atom-site coordinates are absent', () => {
  const structureBytes = Buffer.from(STRUCTURE_CIF.replace(
    'ATOM 5 C "C1\'" . C A 1 3 ? 3.0 4.0 5.0 103 C X 2\n',
    '',
  ));
  const prepared = prepareDssrInput(structureBytes);
  const value = linkedView();
  value.structureContexts.loci[2].coordinateStatus = 'sequence_only';
  const dssr = dssrJson({ omitThirdNt: true });
  dssr.nonPairs = [];
  const payload = buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
    linkedView: value,
    dssr,
  }));
  assert.equal(payload.residues[2].pucker.status, 'not_computable');
  assert.equal(payload.residues[2].stacking.status, 'not_computable');

  value.structureContexts.loci[2].coordinateStatus = 'sequence_only_no_atom_site_coordinate';
  assert.throws(() => buildLocalGeometrySidecar(buildOptions({
    structureBytes,
    dssrInputBytes: prepared.bytes,
    prepareMeta: prepared.meta,
    linkedView: value,
    dssr,
  })), /recognized linked-view status/i);
});

test('source.tool is required by the library and never defaulted', () => {
  const options = buildOptions();
  delete options.tool;
  assert.throws(() => buildLocalGeometrySidecar(options), /tool.*non-empty|required/i);
});

test('build rejects provenance that cannot satisfy the strict sidecar source schema', () => {
  assert.throws(
    () => buildLocalGeometrySidecar(buildOptions({ containerImageId: 'latest' })),
    /containerImageId.*sha256/i,
  );
});

test('CLI prepare/build is strict, supports gzip inputs, and emits byte-stable canonical gzip', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'foldbridge-local-geometry-'));
  const structurePath = path.join(root, 'structure.cif.gz');
  const dssrInputPath = path.join(root, 'dssr-input.cif');
  const prepareMetaPath = path.join(root, 'prepare.json');
  const dssrPath = path.join(root, 'dssr.json');
  const linkedViewPath = path.join(root, 'linked-view.json.gz');
  const outputA = path.join(root, 'local-geometry-a.json.gz');
  const outputB = path.join(root, 'local-geometry-b.json.gz');
  writeFileSync(structurePath, gzipSync(Buffer.from(STRUCTURE_CIF)));
  writeFileSync(dssrPath, deterministicJson(dssrJson()));
  writeFileSync(linkedViewPath, gzipSync(Buffer.from(deterministicJson(linkedView()))));

  execFileSync(process.execPath, [SCRIPT.pathname, 'prepare',
    '--structure', structurePath, '--output', dssrInputPath, '--meta', prepareMetaPath,
  ]);
  const meta = JSON.parse(readFileSync(prepareMetaPath, 'utf8'));
  assert.equal(meta.dssrInputSha256, sha256Bytes(readFileSync(dssrInputPath)));

  const buildArgs = (output) => [SCRIPT.pathname, 'build',
    '--structure', structurePath,
    '--dssr-input', dssrInputPath,
    '--prepare-meta', prepareMetaPath,
    '--dssr-json', dssrPath,
    '--linked-view', linkedViewPath,
    '--case-id', CASE_ID,
    '--chain-id', CHAIN_ID,
    '--tool', 'x3dna-dssr',
    '--tool-version', 'v1.9.10',
    '--container-image', 'foldbridge/dssr:1.9.10',
    '--container-image-id', `sha256:${'a'.repeat(64)}`,
    '--command', 'x3dna-dssr --json --non-pair --input=dssr-input.cif',
    '--output', output,
  ];
  execFileSync(process.execPath, buildArgs(outputA));
  execFileSync(process.execPath, buildArgs(outputB));

  const bytesA = readFileSync(outputA);
  assert.deepEqual(bytesA, readFileSync(outputB));
  assert.equal(bytesA.readUInt32LE(4), 0, 'gzip mtime is normalized');
  assert.equal(bytesA[9], 255, 'gzip OS is normalized');
  const payloadText = gunzipSync(bytesA).toString('utf8');
  assert.equal(payloadText, deterministicJson(JSON.parse(payloadText)));
  assert.deepEqual(bytesA, deterministicGzip(JSON.parse(payloadText)));

  const missingToolArgs = buildArgs(outputB);
  const toolIndex = missingToolArgs.indexOf('--tool');
  missingToolArgs.splice(toolIndex, 2);
  const missingTool = spawnSync(process.execPath, missingToolArgs, { encoding: 'utf8' });
  assert.notEqual(missingTool.status, 0);
  assert.match(missingTool.stderr, /--tool/i);

  writeFileSync(dssrInputPath, Buffer.concat([readFileSync(dssrInputPath), Buffer.from('\n# tampered\n')]));
  const failed = spawnSync(process.execPath, buildArgs(outputA), { encoding: 'utf8' });
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /DSSR input SHA-256 mismatch/i);

  const missingPrepareArg = buildArgs(outputB);
  const prepareIndex = missingPrepareArg.indexOf('--prepare-meta');
  missingPrepareArg.splice(prepareIndex, 2);
  const missingPrepare = spawnSync(process.execPath, missingPrepareArg, { encoding: 'utf8' });
  assert.notEqual(missingPrepare.status, 0);
  assert.match(missingPrepare.stderr, /--prepare-meta/i);
});

test('CLI prepare rejects same-path, symlink, and hardlink aliases without changing inputs', () => {
  {
    const root = mkdtempSync(path.join(tmpdir(), 'foldbridge-prepare-same-path-'));
    const structurePath = path.join(root, 'structure.cif');
    const original = Buffer.from(STRUCTURE_CIF);
    writeFileSync(structurePath, original);
    const result = spawnSync(process.execPath, [SCRIPT.pathname, 'prepare',
      '--structure', structurePath,
      '--output', structurePath,
      '--meta', path.join(root, 'prepare.json'),
    ], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /alias|same|distinct/i);
    assert.deepEqual(readFileSync(structurePath), original);
  }

  {
    const root = mkdtempSync(path.join(tmpdir(), 'foldbridge-prepare-symlink-'));
    const structurePath = path.join(root, 'structure.cif');
    const metaAlias = path.join(root, 'meta-alias.json');
    const original = Buffer.from(STRUCTURE_CIF);
    writeFileSync(structurePath, original);
    symlinkSync(structurePath, metaAlias);
    const result = spawnSync(process.execPath, [SCRIPT.pathname, 'prepare',
      '--structure', structurePath,
      '--output', path.join(root, 'dssr-input.cif'),
      '--meta', metaAlias,
    ], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /alias|same|distinct/i);
    assert.deepEqual(readFileSync(structurePath), original);
  }

  {
    const root = mkdtempSync(path.join(tmpdir(), 'foldbridge-prepare-hardlink-'));
    const structurePath = path.join(root, 'structure.cif');
    const outputPath = path.join(root, 'dssr-input.cif');
    const metaAlias = path.join(root, 'prepare.json');
    const sentinel = Buffer.from('existing final\n');
    writeFileSync(structurePath, STRUCTURE_CIF);
    writeFileSync(outputPath, sentinel);
    linkSync(outputPath, metaAlias);
    const result = spawnSync(process.execPath, [SCRIPT.pathname, 'prepare',
      '--structure', structurePath,
      '--output', outputPath,
      '--meta', metaAlias,
    ], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /alias|same|distinct/i);
    assert.deepEqual(readFileSync(outputPath), sentinel);
    assert.deepEqual(readFileSync(metaAlias), sentinel);
  }
});

test('CLI prepare rejects two nonexistent leaves that alias through a symlink parent', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'foldbridge-prepare-parent-alias-'));
  const aliasDirectory = path.join(root, 'alias');
  const structurePath = path.join(root, 'structure.cif');
  const outputPath = path.join(root, 'controlled.cif');
  const metaPath = path.join(aliasDirectory, 'controlled.cif');
  writeFileSync(structurePath, STRUCTURE_CIF);
  symlinkSync(root, aliasDirectory, 'dir');

  const result = spawnSync(process.execPath, [SCRIPT.pathname, 'prepare',
    '--structure', structurePath,
    '--output', outputPath,
    '--meta', metaPath,
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /alias|same|distinct/i);
  assert.deepEqual(readdirSync(root).filter((name) => name === 'controlled.cif'), []);
});

function makeBuildCliFixture(prefix) {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  const paths = {
    structure: path.join(root, 'structure.cif.gz'),
    dssrInput: path.join(root, 'dssr-input.cif'),
    prepareMeta: path.join(root, 'prepare.json'),
    dssrJson: path.join(root, 'dssr.json'),
    linkedView: path.join(root, 'linked-view.json.gz'),
  };
  writeFileSync(paths.structure, gzipSync(Buffer.from(STRUCTURE_CIF)));
  writeFileSync(paths.dssrJson, deterministicJson(dssrJson()));
  writeFileSync(paths.linkedView, gzipSync(Buffer.from(deterministicJson(linkedView()))));
  execFileSync(process.execPath, [SCRIPT.pathname, 'prepare',
    '--structure', paths.structure,
    '--output', paths.dssrInput,
    '--meta', paths.prepareMeta,
  ]);
  const buildArgs = (output) => [SCRIPT.pathname, 'build',
    '--structure', paths.structure,
    '--dssr-input', paths.dssrInput,
    '--prepare-meta', paths.prepareMeta,
    '--dssr-json', paths.dssrJson,
    '--linked-view', paths.linkedView,
    '--case-id', CASE_ID,
    '--chain-id', CHAIN_ID,
    '--tool', 'x3dna-dssr',
    '--tool-version', 'v1.9.10',
    '--container-image', 'foldbridge/dssr:1.9.10',
    '--container-image-id', `sha256:${'a'.repeat(64)}`,
    '--command', 'x3dna-dssr --json --non-pair --input=dssr-input.cif',
    '--output', output,
  ];
  return { paths, buildArgs };
}

test('CLI build rejects output aliases to every input without overwriting that input', () => {
  for (const field of ['structure', 'dssrInput', 'prepareMeta', 'dssrJson', 'linkedView']) {
    const fixture = makeBuildCliFixture(`foldbridge-build-alias-${field}-`);
    const target = fixture.paths[field];
    const original = readFileSync(target);
    const result = spawnSync(process.execPath, fixture.buildArgs(target), { encoding: 'utf8' });
    assert.notEqual(result.status, 0, field);
    assert.match(result.stderr, /alias|same|distinct/i, field);
    assert.deepEqual(readFileSync(target), original, field);
  }
});

test('CLI build detects a nonexistent input aliased by output through a symlink parent', () => {
  const fixture = makeBuildCliFixture('foldbridge-build-parent-alias-');
  const root = path.dirname(fixture.paths.structure);
  const aliasDirectory = path.join(root, 'alias');
  symlinkSync(root, aliasDirectory, 'dir');
  const inputPath = path.join(root, 'not-yet-dssr.json');
  const outputPath = path.join(aliasDirectory, 'not-yet-dssr.json');
  const args = fixture.buildArgs(outputPath);
  args[args.indexOf('--dssr-json') + 1] = inputPath;

  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /path alias rejected/i,
    'alias must be detected before the missing input is read');
});

test('CLI prepare stages both outputs before publishing and preserves an existing final on staging failure', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'foldbridge-prepare-stage-failure-'));
  const structurePath = path.join(root, 'structure.cif');
  const outputPath = path.join(root, 'dssr-input.cif');
  const sentinel = Buffer.from('existing controlled input\n');
  writeFileSync(structurePath, STRUCTURE_CIF);
  writeFileSync(outputPath, sentinel);

  const result = spawnSync(process.execPath, [SCRIPT.pathname, 'prepare',
    '--structure', structurePath,
    '--output', outputPath,
    '--meta', path.join(root, 'missing-parent', 'prepare.json'),
  ], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.deepEqual(readFileSync(outputPath), sentinel, 'the existing final must never be truncated');
  assert.deepEqual(
    readdirSync(root).filter((name) => name.includes('.tmp-')),
    [],
    'failed prepare must clean every staged temporary file',
  );
});
