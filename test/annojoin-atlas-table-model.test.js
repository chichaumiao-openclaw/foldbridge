import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNOJOIN_TABLE_COLUMNS,
  annojoinExportRow,
  buildAnnojointTableGroups,
  familyBadgeDescriptor,
  groupSlug,
  isAnnojointSearchActive,
  moleculeName,
  paginateAnnojointRows,
  scoreAnnojointMatch,
  searchAnnojointRows,
  sortAnnojointCases
} from '../src/annojoinAtlasTableModel.js';

const rows = [
  {
    caseId: '10ZT',
    pdbId: '10ZT',
    parentClassLabel: 'Ribosome',
    childClassLabel: '16S rRNA',
    biologicalMoleculeName: '16S ribosomal RNA',
    pdbMoleculeName: '30S ribosomal subunit RNA',
    confidenceDisplayLabel: 'B_CONTEXT_STRATIFIED (1)',
    profileCount: 3,
    assayFamilies: ['rmdb_chemical_probing'],
    chains: ['A'],
    sourceDatabases: ['RMDB', 'PDB'],
    conflictCandidateCount: 2,
    chainPlacements: [{ classLabel: 'rRNA', nameLabel: '16S ribosomal RNA' }]
  },
  {
    caseId: '10ZU',
    pdbId: '10ZU',
    parentClassLabel: '',
    childClassLabel: 'MPNN-fixbb designed RNA molecule',
    biologicalMoleculeName: 'MPNN-fixbb designed RNA molecule',
    pdbMoleculeName: 'MPNN-fixbb designed RNA molecule',
    confidenceDisplayLabel: 'C_EXPLORATORY_HINT (3)',
    profileCount: 3,
    assayFamilies: ['rmdb_chemical_probing'],
    chains: [],
    sourceDatabases: ['RMDB', 'PDB'],
    conflictCandidateCount: 0,
    chainPlacements: [{ classLabel: 'designed_RNA', nameLabel: 'MPNN-fixbb designed RNA molecule' }]
  },
  {
    caseId: '10ZV',
    pdbId: '10ZV',
    parentClassLabel: 'Ribosome',
    childClassLabel: '23S rRNA',
    biologicalMoleculeName: '23S ribosomal RNA',
    pdbMoleculeName: '50S ribosomal subunit RNA',
    confidenceDisplayLabel: 'A_HIGH_SUPPORT (1)',
    profileCount: 1,
    chainPlacements: [{ classLabel: 'rRNA', nameLabel: '23S ribosomal RNA' }]
  }
];

test('table model defines the five fixed master-table columns', () => {
  assert.deepEqual(
    ANNOJOIN_TABLE_COLUMNS.map((column) => column.id),
    ['pdbId', 'moleculeName', 'confidenceDisplayLabel', 'profileCount', 'chains']
  );
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'conflictCandidateCount'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'biologicalMoleculeName'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'pdbMoleculeName'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'assayFamilies'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'parentClassLabel'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'childClassLabel'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'sourceDatabases'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => 'defaultVisible' in column), false);
});

test('sortAnnojointCases orders by primary placement (class then name)', () => {
  const cases = [
    { pdbId: '1', chainPlacements: [{ classLabel: 'tRNA', nameLabel: 'tRNA-Lys' }] },
    { pdbId: '2', chainPlacements: [{ classLabel: 'rRNA', nameLabel: '16S ribosomal RNA' }] }
  ];
  const sorted = sortAnnojointCases(cases);
  assert.deepEqual(sorted.map((c) => c.pdbId), ['2', '1']); // rRNA < tRNA wins over pdbId 1<2
});

test('groups cases into parent and child buckets with parentless fallback', () => {
  const groups = buildAnnojointTableGroups(sortAnnojointCases(rows));
  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, 'designed_RNA');
  assert.equal(groups[0].count, 1);
  assert.equal(groups[0].children[0].label, 'MPNN-fixbb designed RNA molecule');
  assert.equal(groups[1].label, 'rRNA');
  assert.deepEqual(groups[1].children.map((c) => [c.label, c.count]), [
    ['16S ribosomal RNA', 1],
    ['23S ribosomal RNA', 1]
  ]);
});

test('buildAnnojointTableGroups fans a multi-identity case into multiple branches', () => {
  const groups = buildAnnojointTableGroups([{
    pdbId: '4V99',
    chainPlacements: [
      { classLabel: 'rRNA', nameLabel: '16S ribosomal RNA' },
      { classLabel: 'tRNA', nameLabel: 'tRNA-Lys' }
    ]
  }]);
  const labels = groups.map((p) => p.label).sort();
  assert.deepEqual(labels, ['rRNA', 'tRNA']);
  const rRNA = groups.find((p) => p.label === 'rRNA');
  assert.equal(rRNA.children[0].label, '16S ribosomal RNA');
  assert.equal(rRNA.children[0].rows[0].pdbId, '4V99');
  assert.equal(rRNA.children[0].id, `${groupSlug('rRNA')}::${groupSlug('16S ribosomal RNA')}`);
});

test('buildAnnojointTableGroups defends empty chainPlacements as Unclassified RNA', () => {
  const groups = buildAnnojointTableGroups([{ pdbId: '9ZZZ', chainPlacements: [] }]);
  assert.equal(groups[0].label, 'Unclassified RNA');
});

test('paginates rows with clamped page numbers', () => {
  assert.deepEqual(
    paginateAnnojointRows(rows, { page: 99, pageSize: 2 }),
    { page: 2, pageSize: 2, pageCount: 2, total: 3, start: 3, end: 3, rows: [rows[2]] }
  );
  assert.equal(paginateAnnojointRows([], { page: 3, pageSize: 50 }).page, 1);
});

test('exports case-level display fields without choosing a best profile', () => {
  assert.deepEqual(annojoinExportRow(rows[0]), {
    case_id: '10ZT',
    pdb_id: '10ZT',
    chain_class_labels: 'rRNA',
    chain_name_labels: '16S ribosomal RNA',
    biological_molecule_name: '16S ribosomal RNA',
    pdb_molecule_name: '30S ribosomal subunit RNA',
    confidence_display_label: 'B_CONTEXT_STRATIFIED (1)',
    profile_count: 3,
    assay_family_set: 'rmdb_chemical_probing',
    pdb_chain_ids: 'A',
    conflict_candidate_count: 2
  });
});

test('exports merged display row lineage back to source cases', () => {
  assert.deepEqual(annojoinExportRow({
    atlasCaseKey: 'PDB:10FZ',
    caseId: '10FZ',
    pdbId: '10FZ',
    biologicalMoleculeName: 'Short author molecule',
    pdbMoleculeName: 'Short author molecule',
    confidenceDisplayLabel: 'RMDB: B; RASP: not active',
    profileCount: 5,
    chains: ['A', 'B'],
    conflictCandidateCount: 3,
    sourceFamilies: ['RMDB2PDB', 'RASP2PDB'],
    sourceCaseKeys: ['RMDB2PDB:10FZ', 'RASP2PDB:10FZ']
  }), {
    case_id: '10FZ',
    pdb_id: '10FZ',
    chain_class_labels: '',
    chain_name_labels: '',
    biological_molecule_name: 'Short author molecule',
    pdb_molecule_name: 'Short author molecule',
    confidence_display_label: 'RMDB: B; RASP: not active',
    profile_count: 5,
    assay_family_set: '',
    pdb_chain_ids: 'A;B',
    conflict_candidate_count: 3,
    atlas_case_key: 'PDB:10FZ',
    source_families: 'RMDB2PDB;RASP2PDB',
    source_case_keys: 'RMDB2PDB:10FZ;RASP2PDB:10FZ'
  });
});

test('annojoinExportRow emits chain placement label columns', () => {
  const out = annojoinExportRow({
    pdbId: '4V99',
    chainPlacements: [
      { classLabel: 'rRNA', nameLabel: '16S ribosomal RNA' },
      { classLabel: 'tRNA', nameLabel: 'tRNA-Lys' }
    ]
  });
  assert.equal(out.chain_class_labels, 'rRNA;tRNA');
  assert.equal(out.chain_name_labels, '16S ribosomal RNA;tRNA-Lys');
  assert.equal('parent_class_label' in out, false);
});

test('scoreAnnojointMatch ranks PDB exact over prefix over molecule substring over PDB substring', () => {
  const exact = { pdbId: '11DG', biologicalMoleculeName: 'x' };
  const prefix = { pdbId: '11DGA', biologicalMoleculeName: 'x' };
  const molSub = { pdbId: 'ZZZZ', biologicalMoleculeName: 'has 11dg inside' };
  const pdbSub = { pdbId: 'A11DGZ', biologicalMoleculeName: 'x' };
  const none = { pdbId: 'ZZZZ', biologicalMoleculeName: 'nothing' };
  assert.ok(scoreAnnojointMatch(exact, '11dg') > scoreAnnojointMatch(prefix, '11dg'));
  assert.ok(scoreAnnojointMatch(prefix, '11dg') > scoreAnnojointMatch(molSub, '11dg'));
  assert.ok(scoreAnnojointMatch(molSub, '11dg') > scoreAnnojointMatch(pdbSub, '11dg'));
  assert.equal(scoreAnnojointMatch(none, '11dg'), 0);
});

test('scoreAnnojointMatch is case and whitespace insensitive', () => {
  const row = { pdbId: '3NKB', biologicalMoleculeName: 'HDV ribozyme' };
  assert.ok(scoreAnnojointMatch(row, '  3nkb ') > 0);
  assert.ok(scoreAnnojointMatch(row, 'HDV') > 0);
});

test('searchAnnojointRows returns matches sorted by score, stable within tier, empty query returns all', () => {
  const rows = [
    { pdbId: 'A11DGZ', biologicalMoleculeName: 'x' },
    { pdbId: '11DG', biologicalMoleculeName: 'x' },
    { pdbId: '11DGA', biologicalMoleculeName: 'x' }
  ];
  const out = searchAnnojointRows(rows, '11dg');
  assert.deepEqual(out.map((r) => r.pdbId), ['11DG', '11DGA', 'A11DGZ']);
  assert.equal(searchAnnojointRows(rows, '').length, 3);
  assert.equal(searchAnnojointRows(rows, 'zzz').length, 0);
});

test('isAnnojointSearchActive true only when query non-empty after trim', () => {
  assert.equal(isAnnojointSearchActive(''), false);
  assert.equal(isAnnojointSearchActive('   '), false);
  assert.equal(isAnnojointSearchActive('11dg'), true);
});

test('familyBadgeDescriptor marks RASP non-active and RMDB active by default', () => {
  const rmdb = familyBadgeDescriptor('RMDB2PDB');
  assert.equal(rmdb.active, true);
  assert.equal(rmdb.label, 'RMDB');
  const rasp = familyBadgeDescriptor('RASP2PDB');
  assert.equal(rasp.active, false);
  assert.equal(rasp.label, 'RASP');
  assert.equal(rasp.note, 'not active');
});

test('familyBadgeDescriptor respects activation override for future RASP activation', () => {
  const rasp = familyBadgeDescriptor('RASP2PDB', { RASP2PDB: true });
  assert.equal(rasp.active, true);
  assert.equal(rasp.note, '');
});

test('export row never contains a derived UI column', () => {
  const exported = annojoinExportRow({ pdbId: '9ELY', chains: ['A'] });
  assert.equal('pdbCaseDetail' in exported, false);
});

test('moleculeName prefers the additive canonical moleculeDisplayName for display', () => {
  assert.equal(
    moleculeName({ moleculeDisplayName: '16S ribosomal RNA', biologicalMoleculeName: '16S RIBOSOMAL RNA' }),
    '16S ribosomal RNA'
  );
});

test('moleculeName falls back to raw fields when moleculeDisplayName is absent', () => {
  assert.equal(moleculeName({ biologicalMoleculeName: 'X' }), 'X');
  assert.equal(moleculeName({ pdbMoleculeName: 'Y' }), 'Y');
  assert.equal(moleculeName({ caseId: 'ABCD' }), 'ABCD');
});
