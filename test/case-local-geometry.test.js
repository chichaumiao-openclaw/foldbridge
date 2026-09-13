import assert from 'node:assert/strict';
import test from 'node:test';

import * as pure from '../public/entry-cases/__entry_v3_site__/workbench-pure.mjs';

const {
  LOCAL_GEOMETRY_SCHEMA,
  buildLocalGeometryWindow,
  validateLocalGeometrySidecar,
} = pure;

const CASE_ID = 'case-1ABC';
const CHAIN_ID = 'A';

function locator(position, chainId = CHAIN_ID) {
  return {
    modelId: '1',
    labelAsymId: chainId,
    authAsymId: chainId,
    labelSeqId: position,
    authSeqId: position,
    insertionCode: '',
    componentId: position % 2 === 0 ? 'C' : 'G',
  };
}

function computedPucker(position) {
  return {
    status: 'computed',
    class: position % 2 === 0 ? "C3'-endo" : "C2'-endo",
    phaseDeg: position * 1.25,
    amplitudeDeg: 38 + position / 10,
  };
}

function sameChainPartner(position, dssrStackClass, topology = 'non_adjacent_intrachain') {
  return {
    partnerResidueKey: `${CASE_ID}|${CHAIN_ID}|${position}`,
    partnerLocator: locator(position),
    partnerPosition: position,
    partnerBase: locator(position).componentId,
    topology,
    dssrStackClass,
    overlapArea: position / 10,
    ringOverlapArea: position / 20,
    sourcePairIndex: position,
  };
}

function crossChainPartner(position) {
  return {
    partnerResidueKey: null,
    partnerLocator: locator(position, 'B'),
    partnerPosition: null,
    partnerBase: locator(position, 'B').componentId,
    topology: 'interchain',
    dssrStackClass: 'mp(><,backward)',
    overlapArea: 1.75,
    ringOverlapArea: 0.75,
    sourcePairIndex: 101,
  };
}

function makePayload(length = 13) {
  const residues = Array.from({ length }, (_, index) => {
    const position = index + 1;
    return {
      residueKey: `${CASE_ID}|${CHAIN_ID}|${position}`,
      position,
      base: locator(position).componentId,
      locator: locator(position),
      pucker: computedPucker(position),
      stacking: { status: 'computed', partners: [] },
    };
  });
  residues[0].pucker = { status: 'not_computable', reason: 'DSSR nucleotide absent' };
  residues[1].stacking = { status: 'not_computable', reason: 'coordinates absent' };
  residues[5].stacking.partners = [
    sameChainPartner(8, 'pm(>>,forward)'),
    sameChainPartner(13, 'pp(>>,forward)'),
    crossChainPartner(4),
  ];
  return {
    schemaVersion: 'foldbridge-local-geometry.v1',
    caseId: CASE_ID,
    chainId: CHAIN_ID,
    source: {
      tool: 'x3dna-dssr',
      toolVersion: 'v1.9.10',
      containerImage: 'foldbridge/dssr:1.9.10',
      containerImageId: `sha256:${'a'.repeat(64)}`,
      command: 'x3dna-dssr --json --non-pair input.cif',
      structureSha256: 'b'.repeat(64),
      dssrInputSha256: 'c'.repeat(64),
      modelId: '1',
      modelPolicy: 'first_atom_site_model',
      altlocPolicy: 'preserve_input_altlocs_dssr_managed',
    },
    residues,
  };
}

function contextFor(payload) {
  return {
    caseId: payload.caseId,
    chainId: payload.chainId,
    residues: payload.residues.map((residue) => ({
      residueKey: residue.residueKey,
      position: residue.position,
      base: residue.base,
      locator: {
        labelAsymId: residue.locator.labelAsymId,
        authAsymId: residue.locator.authAsymId,
        labelSeqId: residue.locator.labelSeqId,
        authSeqId: residue.locator.authSeqId,
        insertionCode: residue.locator.insertionCode,
        componentId: residue.locator.componentId,
      },
    })),
  };
}

function clone(value) {
  return structuredClone(value);
}

test('local geometry validates the strict schema and returns a readonly indexed model', () => {
  assert.equal(typeof validateLocalGeometrySidecar, 'function',
    'export validateLocalGeometrySidecar(payload, context)');
  assert.equal(typeof buildLocalGeometryWindow, 'function',
    'export buildLocalGeometryWindow(model, selectedResidueKey, radius)');
  const payload = makePayload();
  const model = validateLocalGeometrySidecar(payload, contextFor(payload));

  assert.equal(LOCAL_GEOMETRY_SCHEMA, 'foldbridge-local-geometry.v1');
  assert.equal(model.schemaVersion, LOCAL_GEOMETRY_SCHEMA);
  assert.deepEqual(model.source, payload.source);
  assert.notEqual(model.source.structureSha256, model.source.dssrInputSha256,
    'the source structure and controlled DSSR input are distinct provenance artifacts');
  assert.deepEqual(model.orderedResidues.map(({ position }) => position),
    Array.from({ length: 13 }, (_, index) => index + 1));
  assert.equal(model.residues, model.orderedResidues);
  assert.equal(model.byResidueKey instanceof Map, true);
  assert.equal(model.byResidueKey.get(`${CASE_ID}|${CHAIN_ID}|6`), model.orderedResidues[5]);
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.source), true);
  assert.equal(Object.isFrozen(model.orderedResidues), true);
  assert.equal(Object.isFrozen(model.orderedResidues[0].pucker), true);
  assert.throws(() => model.byResidueKey.set('forged', {}), /read.?only/i);
  assert.throws(() => model.byResidueKey.delete(`${CASE_ID}|${CHAIN_ID}|1`), /read.?only/i);
  model.byResidueKey.forEach((_residue, _residueKey, readonlyIndex) => {
    assert.equal(readonlyIndex, model.byResidueKey, 'forEach must not expose the mutable backing Map');
    assert.throws(() => readonlyIndex.clear(), /read.?only/i);
  });
  const valueOfIndex = model.byResidueKey.valueOf();
  assert.equal(valueOfIndex, model.byResidueKey, 'valueOf must return the readonly proxy, not its backing Map');
  assert.throws(() => valueOfIndex.set('forged', {}), /read.?only/i);
  assert.equal(model.byResidueKey.toJSON, undefined, 'no serialization hook may expose the backing Map');
  assert.equal(model.byResidueKey.size, 13);
});

test('linked-view integer strings are normalized without accepting ambiguous numeric text', () => {
  const payload = makePayload();
  const context = contextFor(payload);
  for (const residue of context.residues) {
    residue.locator.labelSeqId = String(residue.locator.labelSeqId);
    residue.locator.authSeqId = String(residue.locator.authSeqId);
  }
  assert.doesNotThrow(() => validateLocalGeometrySidecar(payload, context));

  for (const invalidText of ['', ' 1', '1 ', '01', '1.0']) {
    const invalid = clone(context);
    invalid.residues[0].locator.authSeqId = invalidText;
    assert.throws(
      () => validateLocalGeometrySidecar(payload, invalid),
      /authSeqId must be an integer/i,
      `reject ambiguous linked-view integer text ${JSON.stringify(invalidText)}`,
    );
  }
});

test('modified nucleotides keep parent base and chemical component as distinct identities', () => {
  const payload = makePayload();
  payload.residues[0].base = 'U';
  payload.residues[0].locator.componentId = 'PSU';
  const context = contextFor(payload);

  assert.doesNotThrow(() => validateLocalGeometrySidecar(payload, context));
});

test('pucker and stacking statuses are independent and computed values must be finite', () => {
  const payload = makePayload();
  const model = validateLocalGeometrySidecar(payload, contextFor(payload));
  assert.equal(model.orderedResidues[0].pucker.status, 'not_computable');
  assert.equal(model.orderedResidues[0].stacking.status, 'computed');
  assert.equal(model.orderedResidues[1].pucker.status, 'computed');
  assert.equal(model.orderedResidues[1].stacking.status, 'not_computable');

  for (const path of [
    ['residues', 2, 'pucker', 'phaseDeg'],
    ['residues', 2, 'pucker', 'amplitudeDeg'],
    ['residues', 5, 'stacking', 'partners', 0, 'overlapArea'],
    ['residues', 5, 'stacking', 'partners', 0, 'ringOverlapArea'],
  ]) {
    const invalid = clone(payload);
    let target = invalid;
    for (const segment of path.slice(0, -1)) target = target[segment];
    target[path.at(-1)] = Infinity;
    assert.throws(
      () => validateLocalGeometrySidecar(invalid, contextFor(payload)),
      /finite/i,
      path.join('.'),
    );
  }
});

test('schema, Case, Chain, and residue coverage must exactly match context', () => {
  const payload = makePayload();
  const cases = [
    ['schema', { ...clone(payload), schemaVersion: 'foldbridge-local-geometry.v2' }],
    ['case', { ...clone(payload), caseId: 'case-other' }],
    ['chain', { ...clone(payload), chainId: 'B' }],
    ['missing residue', { ...clone(payload), residues: clone(payload.residues.slice(0, -1)) }],
    ['extra residue', {
      ...clone(payload),
      residues: [...clone(payload.residues), {
        ...clone(payload.residues.at(-1)),
        residueKey: `${CASE_ID}|${CHAIN_ID}|14`,
        position: 14,
        locator: locator(14),
        base: locator(14).componentId,
      }],
    }],
  ];
  for (const [label, invalid] of cases) {
    assert.throws(
      () => validateLocalGeometrySidecar(invalid, contextFor(payload)),
      /schemaVersion|caseId|chainId|coverage/i,
      label,
    );
  }
});

test('same residue keys cannot hide position, base, or linked locator identity drift', () => {
  const payload = makePayload();
  const cases = [
    ['position', (residue) => {
      residue.position += 100;
      residue.locator.labelSeqId = residue.position;
    }, /context.*position.*match/i],
    ['base', (residue) => {
      residue.base = 'U';
      residue.locator.componentId = residue.base;
    }, /context.*base.*match/i],
    ['auth chain', (residue) => { residue.locator.authAsymId = 'X'; }, /context.*authAsymId.*match/i],
    ['label chain', (residue) => { residue.locator.labelAsymId = 'L'; }, /context.*labelAsymId.*match/i],
    ['auth sequence', (residue) => { residue.locator.authSeqId += 100; }, /context.*authSeqId.*match/i],
    ['label sequence', (residue) => { residue.locator.labelSeqId += 100; }, /context.*labelSeqId.*match/i],
    ['insertion code', (residue) => { residue.locator.insertionCode = 'A'; }, /context.*insertionCode.*match/i],
    ['component', (residue) => { residue.locator.componentId = 'U'; }, /context.*componentId.*match/i],
  ];
  for (const [label, mutate, expectedError] of cases) {
    const context = contextFor(payload);
    mutate(context.residues[2]);
    assert.throws(
      () => validateLocalGeometrySidecar(payload, context),
      expectedError,
      label,
    );
  }
});

test('context residue identity is exact, complete, unique, and internally consistent', () => {
  const payload = makePayload();
  const cases = [
    ['unknown context field', (context) => { context.unexpected = true; }, /context.*unknown field/i],
    ['missing context residue field', (context) => { delete context.residues[0].base; }, /context residue.*missing field.*base/i],
    ['unknown context locator field', (context) => { context.residues[0].locator.modelId = '1'; }, /context residue.*locator.*unknown field.*modelId/i],
    ['missing context locator field', (context) => { delete context.residues[0].locator.authSeqId; }, /context residue.*locator.*missing field.*authSeqId/i],
    ['duplicate context residue key', (context) => { context.residues.push(clone(context.residues[0])); }, /context.*duplicate residueKey/i],
    ['position-locator conflict', (context) => { context.residues[0].position = 2; }, /context.*labelSeqId.*position/i],
    ['base identity drift', (context) => { context.residues[0].base = 'A'; }, /context.*base.*match/i],
  ];
  for (const [label, mutate, expectedError] of cases) {
    const context = contextFor(payload);
    mutate(context);
    assert.throws(
      () => validateLocalGeometrySidecar(payload, context),
      expectedError,
      label,
    );
  }
});

test('target locators use payload chain identity and every partner uses source model identity', () => {
  const payload = makePayload();
  const wrongTargetChain = clone(payload);
  wrongTargetChain.residues[2].locator.authAsymId = 'B';
  assert.throws(
    () => validateLocalGeometrySidecar(wrongTargetChain, contextFor(payload)),
    /locator\.authAsymId.*chainId/i,
  );

  const wrongPartnerModel = clone(payload);
  wrongPartnerModel.residues[5].stacking.partners[2].partnerLocator.modelId = '2';
  assert.throws(
    () => validateLocalGeometrySidecar(wrongPartnerModel, contextFor(payload)),
    /partnerLocator\.modelId.*source\.modelId/i,
  );
});

test('unknown and missing fields are rejected at every schema layer', () => {
  const payload = makePayload();
  const mutations = [
    (value) => { value.unexpected = true; },
    (value) => { delete value.source.toolVersion; },
    (value) => { delete value.source.dssrInputSha256; },
    (value) => { value.source.unexpected = true; },
    (value) => { delete value.residues[2].base; },
    (value) => { value.residues[2].unexpected = true; },
    (value) => { delete value.residues[2].locator.authSeqId; },
    (value) => { value.residues[2].locator.unexpected = true; },
    (value) => { delete value.residues[2].pucker.phaseDeg; },
    (value) => { value.residues[2].pucker.unexpected = true; },
    (value) => { delete value.residues[5].stacking.partners; },
    (value) => { value.residues[5].stacking.unexpected = true; },
    (value) => { delete value.residues[5].stacking.partners[0].dssrStackClass; },
    (value) => { value.residues[5].stacking.partners[0].unexpected = true; },
  ];
  for (const mutate of mutations) {
    const invalid = clone(payload);
    mutate(invalid);
    assert.throws(
      () => validateLocalGeometrySidecar(invalid, contextFor(payload)),
      /unknown field|missing field/i,
    );
  }
});

test('DSSR input SHA-256 is independent from the source structure digest and strictly formatted', () => {
  const payload = makePayload();
  const model = validateLocalGeometrySidecar(payload, contextFor(payload));
  assert.equal(model.source.structureSha256, 'b'.repeat(64));
  assert.equal(model.source.dssrInputSha256, 'c'.repeat(64));

  for (const malformed of ['c'.repeat(63), 'C'.repeat(64), `sha256:${'c'.repeat(64)}`, 'not-a-digest']) {
    const invalid = clone(payload);
    invalid.source.dssrInputSha256 = malformed;
    assert.throws(
      () => validateLocalGeometrySidecar(invalid, contextFor(payload)),
      /dssrInputSha256.*lowercase SHA-256/i,
    );
  }
});

test('source model and altloc policies are fixed contract literals', () => {
  const payload = makePayload();
  const invalidModelPolicy = clone(payload);
  invalidModelPolicy.source.modelPolicy = 'all_atom_site_models';
  assert.throws(
    () => validateLocalGeometrySidecar(invalidModelPolicy, contextFor(payload)),
    /modelPolicy.*first_atom_site_model/i,
  );

  const invalidAltlocPolicy = clone(payload);
  invalidAltlocPolicy.source.altlocPolicy = 'prefer_highest_occupancy';
  assert.throws(
    () => validateLocalGeometrySidecar(invalidAltlocPolicy, contextFor(payload)),
    /altlocPolicy.*preserve_input_altlocs_dssr_managed/i,
  );
});

test('DSSR stack class accepts only raw pm/mp/mm/pp notation', () => {
  const payload = makePayload();
  for (const valid of [
    'pm(>>,forward)',
    'mp(<<,backward)',
    'mm(><,inward)',
    'pp(<>,outward)',
  ]) {
    const candidate = clone(payload);
    candidate.residues[5].stacking.partners[0].dssrStackClass = valid;
    assert.doesNotThrow(() => validateLocalGeometrySidecar(candidate, contextFor(payload)), valid);
  }

  for (const malformed of [
    's35',
    'arbitrary',
    'pm',
    'pm(>>,sideways)',
    'xx(>>,forward)',
    'pm(>>,forward) trailing',
  ]) {
    const invalid = clone(payload);
    invalid.residues[5].stacking.partners[0].dssrStackClass = malformed;
    assert.throws(
      () => validateLocalGeometrySidecar(invalid, contextFor(payload)),
      /dssrStackClass.*pm\/mp\/mm\/pp/i,
      malformed,
    );
  }
});

test('duplicate partner identity plus DSSR class is rejected', () => {
  const payload = makePayload();
  payload.residues[5].stacking.partners.push(clone(payload.residues[5].stacking.partners[0]));
  assert.throws(
    () => validateLocalGeometrySidecar(payload, contextFor(payload)),
    /duplicate stacking partner/i,
  );
});

test('same-chain partners require local identity while interchain partners require null navigation keys', () => {
  const payload = makePayload();
  const invalidSameChain = clone(payload);
  invalidSameChain.residues[5].stacking.partners[0].partnerResidueKey = null;
  invalidSameChain.residues[5].stacking.partners[0].partnerPosition = null;
  assert.throws(
    () => validateLocalGeometrySidecar(invalidSameChain, contextFor(payload)),
    /same-chain.*partnerResidueKey|intrachain.*partnerResidueKey/i,
  );

  const invalidCrossChain = clone(payload);
  invalidCrossChain.residues[5].stacking.partners[2].partnerResidueKey = `${CASE_ID}|B|4`;
  invalidCrossChain.residues[5].stacking.partners[2].partnerPosition = 4;
  assert.throws(
    () => validateLocalGeometrySidecar(invalidCrossChain, contextFor(payload)),
    /interchain.*null/i,
  );
});

test('same-chain topology must agree with the exact residue position relationship', () => {
  const payload = makePayload();
  const cases = [
    [sameChainPartner(7, 'pm(>>,forward)', 'non_adjacent_intrachain'), /three_prime_adjacent/i],
    [sameChainPartner(5, 'pm(>>,forward)', 'three_prime_adjacent'), /five_prime_adjacent/i],
    [sameChainPartner(8, 'pm(>>,forward)', 'three_prime_adjacent'), /non_adjacent_intrachain/i],
  ];
  for (const [partner, expectedError] of cases) {
    const invalid = clone(payload);
    invalid.residues[5].stacking.partners[0] = partner;
    assert.throws(
      () => validateLocalGeometrySidecar(invalid, contextFor(payload)),
      expectedError,
    );
  }
});

test('interchain topology cannot hide a locator belonging to the validated chain', () => {
  const payload = makePayload();
  payload.residues[5].stacking.partners[2].partnerLocator = locator(4);
  assert.throws(
    () => validateLocalGeometrySidecar(payload, contextFor(payload)),
    /interchain.*locator.*current chain/i,
  );
});

test('local window is centered, capped at 11 nt, sorted, and classifies selected stacking partners', () => {
  const payload = makePayload();
  const model = validateLocalGeometrySidecar(payload, contextFor(payload));
  const selectedResidueKey = `${CASE_ID}|${CHAIN_ID}|6`;
  const window = buildLocalGeometryWindow(model, selectedResidueKey);

  assert.equal(window.selectedResidueKey, selectedResidueKey);
  assert.equal(window.selectedResidue, model.byResidueKey.get(selectedResidueKey));
  assert.deepEqual(window.residues.map(({ position }) => position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(window.withinWindowPartners.map(({ partnerPosition }) => partnerPosition), [8]);
  assert.deepEqual(window.sameChainOutsideWindowPartners.map(({ partnerPosition }) => partnerPosition), [13]);
  assert.deepEqual(window.crossChainPartners.map(({ partnerPosition }) => partnerPosition), [null]);
  assert.equal(Object.isFrozen(window), true);
  assert.equal(Object.isFrozen(window.residues), true);
  assert.equal(Object.isFrozen(window.withinWindowPartners), true);
});

test('local window truncates directly at chain ends and rejects invalid selections or radii', () => {
  const payload = makePayload();
  const model = validateLocalGeometrySidecar(payload, contextFor(payload));
  assert.deepEqual(
    buildLocalGeometryWindow(model, `${CASE_ID}|${CHAIN_ID}|2`).residues.map(({ position }) => position),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.deepEqual(
    buildLocalGeometryWindow(model, `${CASE_ID}|${CHAIN_ID}|13`).residues.map(({ position }) => position),
    [8, 9, 10, 11, 12, 13],
  );
  assert.deepEqual(
    buildLocalGeometryWindow(model, `${CASE_ID}|${CHAIN_ID}|6`, 2).residues.map(({ position }) => position),
    [4, 5, 6, 7, 8],
  );
  assert.throws(() => buildLocalGeometryWindow(model, 'missing'), /selected residue/i);
  for (const radius of [-1, 1.5, 6, Infinity]) {
    assert.throws(() => buildLocalGeometryWindow(model, `${CASE_ID}|${CHAIN_ID}|6`, radius), /radius/i);
  }
});
