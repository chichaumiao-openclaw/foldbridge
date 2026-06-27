import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNOJOIN_TABLE_COLUMNS,
  annojoinExportRow,
  buildAnnojointTableGroups,
  defaultVisibleAnnojointColumnIds,
  familyBadgeDescriptor,
  isAnnojointSearchActive,
  normalizeVisibleAnnojointColumnIds,
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
    conflictCandidateCount: 2
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
    conflictCandidateCount: 0
  },
  {
    caseId: '10ZV',
    pdbId: '10ZV',
    parentClassLabel: 'Ribosome',
    childClassLabel: '23S rRNA',
    biologicalMoleculeName: '23S ribosomal RNA',
    pdbMoleculeName: '50S ribosomal subunit RNA',
    confidenceDisplayLabel: 'A_HIGH_SUPPORT (1)',
    profileCount: 1
  }
];

test('table model defines conservative default visible columns', () => {
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'moleculeName'), true);
  assert.deepEqual(
    defaultVisibleAnnojointColumnIds().slice(0, 5),
    ['pdbId', 'moleculeName', 'confidenceDisplayLabel', 'profileCount', 'chains']
  );
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'biologicalMoleculeName'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'pdbMoleculeName'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'assayFamilies'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'parentClassLabel'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'childClassLabel'), false);
  assert.equal(ANNOJOIN_TABLE_COLUMNS.some((column) => column.id === 'sourceDatabases'), false);
});

test('normalizes visible columns and preserves valid ordering', () => {
  assert.deepEqual(
    normalizeVisibleAnnojointColumnIds(['profileCount', 'biologicalMoleculeName', 'parentClassLabel', 'unknown', 'pdbId', 'profileCount']),
    ['pdbId', 'profileCount']
  );
  assert.deepEqual(normalizeVisibleAnnojointColumnIds([]), defaultVisibleAnnojointColumnIds());
});

test('groups cases into parent and child buckets with parentless fallback', () => {
  const groups = buildAnnojointTableGroups(sortAnnojointCases(rows));

  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, 'MPNN-fixbb designed RNA molecule');
  assert.equal(groups[0].count, 1);
  assert.equal(groups[0].children[0].label, 'MPNN-fixbb designed RNA molecule');
  assert.equal(groups[1].label, 'Ribosome');
  assert.deepEqual(groups[1].children.map((child) => [child.label, child.count]), [
    ['16S rRNA', 1],
    ['23S rRNA', 1]
  ]);
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
    parent_class_label: 'Ribosome',
    child_class_label: '16S rRNA',
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
    parent_class_label: undefined,
    child_class_label: undefined,
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
