import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChainIdentityIndex } from '../scripts/lib/annojoin-atlas-chain-identity.mjs';
import { buildAtlasCaseAsset } from '../scripts/lib/annojoin-atlas-corpus.mjs';

test('buildChainIdentityIndex marks governed RNA chains verified with URS from display_label', () => {
  const index = buildChainIdentityIndex({
    declaredIdentityRows: [
      {
        pdb_reference_id: '8XT0_S1',
        pdb_id: '8XT0',
        entity_id: '1',
        label_asym_id: 'A',
        auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide',
        sequence_length: '120',
        parent_rna_name: 'Glycine riboswitch',
        parent_rna_class: 'riboswitch',
        declared_identity_phrase: 'glycine riboswitch aptamer',
        struct_ref_db_name: 'GenBank',
        struct_ref_accession: 'AB123456'
      }
    ],
    governedRows: [
      {
        pdb_id: '8XT0',
        pdb_reference_id: '8XT0_S1',
        registry_object_id: 'obj-1',
        display_label: 'URS0000ABCDEF',
        governance_state: 'final_identity'
      }
    ]
  });

  const chains = index.get('8XT0');
  assert.ok(Array.isArray(chains));
  assert.equal(chains.length, 1);
  assert.equal(chains[0].verified, true);
  assert.equal(chains[0].ursId, 'URS0000ABCDEF');
  assert.equal(chains[0].source, 'biological_layer:final_identity');
  assert.equal(chains[0].displayName, 'glycine riboswitch aptamer');
  assert.equal(chains[0].lengthNt, 120);
  assert.equal(chains[0].genbank, 'GenBank AB123456');
});

test('buildChainIdentityIndex leaves non-governed RNA chains unverified with null URS', () => {
  const index = buildChainIdentityIndex({
    declaredIdentityRows: [
      {
        pdb_reference_id: '8XT0_S2',
        pdb_id: '8XT0',
        label_asym_id: 'B',
        auth_asym_id: 'B',
        polymer_type: 'polyribonucleotide',
        sequence_length: '80',
        parent_rna_name: 'tRNA',
        parent_rna_class: 'tRNA',
        declared_identity_phrase: 'transfer RNA'
      }
    ],
    governedRows: []
  });

  const chains = index.get('8XT0');
  assert.equal(chains.length, 1);
  assert.equal(chains[0].verified, false);
  assert.equal(chains[0].ursId, null);
  assert.equal(chains[0].source, 'pdb_author_declared_identity');
});

test('buildChainIdentityIndex excludes non-RNA chains', () => {
  const index = buildChainIdentityIndex({
    declaredIdentityRows: [
      {
        pdb_reference_id: '8XT0_S1',
        pdb_id: '8XT0',
        auth_asym_id: 'A',
        polymer_type: 'polypeptide(L)',
        parent_rna_name: 'some protein'
      },
      {
        pdb_reference_id: '8XT0_S2',
        pdb_id: '8XT0',
        auth_asym_id: 'B',
        polymer_type: 'polyribonucleotide',
        parent_rna_name: 'ribozyme'
      }
    ],
    governedRows: []
  });

  const chains = index.get('8XT0');
  assert.equal(chains.length, 1);
  assert.equal(chains[0].chainId, 'B');
});

test('buildChainIdentityIndex sorts a PDB chains verified-first then by chainId', () => {
  const index = buildChainIdentityIndex({
    declaredIdentityRows: [
      {
        pdb_reference_id: '8XT0_S3',
        pdb_id: '8XT0',
        auth_asym_id: 'C',
        polymer_type: 'polyribonucleotide'
      },
      {
        pdb_reference_id: '8XT0_S1',
        pdb_id: '8XT0',
        auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide'
      },
      {
        pdb_reference_id: '8XT0_S2',
        pdb_id: '8XT0',
        auth_asym_id: 'B',
        polymer_type: 'polyribonucleotide'
      }
    ],
    governedRows: [
      {
        pdb_reference_id: '8XT0_S3',
        registry_object_id: 'obj-3',
        display_label: 'URS0000333333',
        governance_state: 'final_identity'
      }
    ]
  });

  const chains = index.get('8XT0');
  assert.deepEqual(chains.map((chain) => chain.chainId), ['C', 'A', 'B']);
  assert.equal(chains[0].verified, true);
  assert.equal(chains[1].verified, false);
  assert.equal(chains[2].verified, false);
});

test('buildChainIdentityIndex folds case/whitespace variants to the most-frequent spelling (display-only)', () => {
  // "16S ribosomal RNA" x3 across PDBs, "16S RIBOSOMAL RNA" x1 → all display the majority spelling.
  const index = buildChainIdentityIndex({
    declaredIdentityRows: [
      {
        pdb_reference_id: 'AAAA_S1', pdb_id: 'AAAA', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide', declared_identity_phrase: '16S ribosomal RNA'
      },
      {
        pdb_reference_id: 'BBBB_S1', pdb_id: 'BBBB', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide', declared_identity_phrase: '16S ribosomal RNA'
      },
      {
        pdb_reference_id: 'CCCC_S1', pdb_id: 'CCCC', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide', declared_identity_phrase: '16S ribosomal RNA'
      },
      {
        pdb_reference_id: 'DDDD_S1', pdb_id: 'DDDD', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide', declared_identity_phrase: '16S RIBOSOMAL RNA'
      }
    ],
    governedRows: []
  });

  assert.equal(index.get('AAAA')[0].displayName, '16S ribosomal RNA');
  assert.equal(index.get('BBBB')[0].displayName, '16S ribosomal RNA');
  assert.equal(index.get('CCCC')[0].displayName, '16S ribosomal RNA');
  // The minority all-caps row also displays the majority spelling.
  assert.equal(index.get('DDDD')[0].displayName, '16S ribosomal RNA');
});

test('buildChainIdentityIndex tie-break picks localeCompare-smallest spelling deterministically', () => {
  // Each variant appears exactly once → tie. Documented winner: localeCompare ascending.
  // 'a name' vs 'A NAME' vs 'A Name': localeCompare ascending winner is 'a name'.
  const index = buildChainIdentityIndex({
    declaredIdentityRows: [
      {
        pdb_reference_id: 'P1_S1', pdb_id: 'P1', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide', declared_identity_phrase: 'A NAME'
      },
      {
        pdb_reference_id: 'P2_S1', pdb_id: 'P2', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide', declared_identity_phrase: 'A Name'
      },
      {
        pdb_reference_id: 'P3_S1', pdb_id: 'P3', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide', declared_identity_phrase: 'a name'
      }
    ],
    governedRows: []
  });

  const winner = ['A NAME', 'A Name', 'a name'].slice().sort((l, r) => l.localeCompare(r))[0];
  assert.equal(index.get('P1')[0].displayName, winner);
  assert.equal(index.get('P2')[0].displayName, winner);
  assert.equal(index.get('P3')[0].displayName, winner);
});

test('buildChainIdentityIndex folds by case only and preserves the chosen spelling verbatim (no title-casing)', () => {
  // "tRNA(Phe)" x2 vs "tRNA(PHE)" x1 → majority wins, preserved verbatim (punctuation/case untouched).
  const index = buildChainIdentityIndex({
    declaredIdentityRows: [
      {
        pdb_reference_id: 'Q1_S1', pdb_id: 'Q1', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide', declared_identity_phrase: 'tRNA(Phe)'
      },
      {
        pdb_reference_id: 'Q2_S1', pdb_id: 'Q2', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide', declared_identity_phrase: 'tRNA(Phe)'
      },
      {
        pdb_reference_id: 'Q3_S1', pdb_id: 'Q3', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide', declared_identity_phrase: 'tRNA(PHE)'
      }
    ],
    governedRows: []
  });

  const chosen = index.get('Q1')[0].displayName;
  // The winner must be one of the exact inputs, never a re-cased synthetic like 'Trna(phe)'.
  assert.ok(['tRNA(Phe)', 'tRNA(PHE)'].includes(chosen));
  assert.equal(chosen, 'tRNA(Phe)');
  assert.equal(index.get('Q3')[0].displayName, 'tRNA(Phe)');
});

test('buildChainIdentityIndex display fold leaves identity invariants untouched', () => {
  const index = buildChainIdentityIndex({
    declaredIdentityRows: [
      {
        pdb_reference_id: 'Z1_S1', pdb_id: 'Z1', auth_asym_id: 'A', label_asym_id: 'A',
        polymer_type: 'polyribonucleotide', sequence_length: '120',
        parent_rna_name: 'Glycine riboswitch', parent_rna_class: 'riboswitch',
        declared_identity_phrase: '16S ribosomal RNA'
      },
      {
        pdb_reference_id: 'Z2_S1', pdb_id: 'Z2', auth_asym_id: 'A',
        polymer_type: 'polyribonucleotide',
        declared_identity_phrase: '16S RIBOSOMAL RNA'
      }
    ],
    governedRows: [
      {
        pdb_reference_id: 'Z1_S1', registry_object_id: 'obj-z1',
        display_label: 'URS0000ZZZZZZ', governance_state: 'final_identity'
      }
    ]
  });

  const chain = index.get('Z1')[0];
  // displayName is canonicalized, but identity fields are untouched.
  assert.equal(chain.displayName, '16S ribosomal RNA');
  assert.equal(chain.verified, true);
  assert.equal(chain.ursId, 'URS0000ZZZZZZ');
  assert.equal(chain.rnaClass, 'riboswitch');
  assert.equal(chain.lengthNt, 120);
  assert.equal(chain.parentRnaName, 'Glycine riboswitch');
});

test('buildAtlasCaseAsset surfaces chainIdentities on asset.case', () => {
  const chainIdentities = [
    {
      pdbReferenceId: '10FZ_S1',
      chainId: 'A',
      authAsymId: 'A',
      labelAsymId: 'A',
      verified: true,
      ursId: 'URS0000ABCDEF',
      displayName: 'glycine riboswitch',
      parentRnaName: 'Glycine riboswitch',
      rnaClass: 'riboswitch',
      lengthNt: 120,
      genbank: 'GenBank AB123456',
      source: 'biological_layer:final_identity'
    }
  ];

  const asset = buildAtlasCaseAsset({
    caseId: '10FZ',
    cases: [{ case_id: '10FZ', pdb_id: '10FZ', profile_count: '1', profile_ids: 'profile-a' }],
    summaries: [{ case_id: '10FZ', profile_count: '1' }],
    routes: [{ case_id: '10FZ', detail_route_id: 'detail:10FZ' }],
    chainIdentities
  });

  assert.deepEqual(asset.case.chainIdentities, chainIdentities);
});

test('buildAtlasCaseAsset defaults chainIdentities to empty array when not provided', () => {
  const asset = buildAtlasCaseAsset({
    caseId: '10FZ',
    cases: [{ case_id: '10FZ', pdb_id: '10FZ', profile_count: '1', profile_ids: 'profile-a' }],
    summaries: [{ case_id: '10FZ', profile_count: '1' }],
    routes: [{ case_id: '10FZ', detail_route_id: 'detail:10FZ' }]
  });

  assert.deepEqual(asset.case.chainIdentities, []);
});
