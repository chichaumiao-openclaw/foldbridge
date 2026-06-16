export const DATA_VERSION = '2026-06-11.pdb-case-contract.v1';
export const DETERMINISTIC_SEED = 20260307;
export const SOURCE_PACKAGE_ID = 'rmdb_pdb_sequence_cases_rasp_params_besthit_20260610';
export const PDB_CASE_SCHEMA_VERSION = 'pdb-case.v1';

export const pdbCaseManifest = {
  schemaVersion: PDB_CASE_SCHEMA_VERSION,
  sourcePackageId: SOURCE_PACKAGE_ID,
  buildMode: 'demo-contract',
  generatedAt: '2026-06-11',
  publicRoot: '/data/FoldBridgeShare/rmdb_pdb_sequence_cases_rasp_params_besthit_20260610',
  supportRoot: '/data/hsBack/05_devSpace/03_foldbridge_rmdb_rasp/06_compute_intermediates/rmdb_pdb_sequence_cases_rasp_params_besthit_20260610_support',
  browserBudget: {
    maxIndexBytes: 250000,
    maxCaseJsonBytes: 200000,
    maxTrackPreviewPoints: 64
  }
};

export const pdbCaseRows = [
  {
    caseId: 'PDBCASE-8QO5',
    pdbId: '8QO5',
    title: 'SARS-CoV-2 SL5 reference case',
    organism: 'Betacoronavirus',
    pdbReferenceCount: 1,
    rmdbUniqueSequenceCount: 1,
    profileCount: 1,
    pdbAxisReactivityRows: 128,
    projectionStatus: 'pass',
    baseMismatchRows: 0,
    identityPct: 100,
    queryCoveragePct: 100,
    subjectCoveragePct: 100,
    axisType: 'pdb_reference_sequence_position',
    residueMappingStatus: 'not-ready',
    detailHref: '#pdb-case?pdbId=8QO5'
  },
  {
    caseId: 'PDBCASE-5KPY',
    pdbId: '5KPY',
    title: '5-hydroxytryptophan RNA aptamer',
    organism: 'Synthetic RNA',
    pdbReferenceCount: 1,
    rmdbUniqueSequenceCount: 2,
    profileCount: 2,
    pdbAxisReactivityRows: 142,
    projectionStatus: 'pass',
    baseMismatchRows: 8,
    identityPct: 96.9,
    queryCoveragePct: 98.6,
    subjectCoveragePct: 97.2,
    axisType: 'pdb_reference_sequence_position',
    residueMappingStatus: 'not-ready',
    detailHref: '#pdb-case?pdbId=5KPY'
  },
  {
    caseId: 'PDBCASE-1AM0',
    pdbId: '1AM0',
    title: 'AMP RNA aptamer complex',
    organism: 'Synthetic RNA',
    pdbReferenceCount: 1,
    rmdbUniqueSequenceCount: 1,
    profileCount: 1,
    pdbAxisReactivityRows: 43,
    projectionStatus: 'pass',
    baseMismatchRows: 2,
    identityPct: 97.6,
    queryCoveragePct: 100,
    subjectCoveragePct: 95.1,
    axisType: 'pdb_reference_sequence_position',
    residueMappingStatus: 'not-ready',
    detailHref: '#pdb-case?pdbId=1AM0'
  },
  {
    caseId: 'PDBCASE-4L81',
    pdbId: '4L81',
    title: 'SAM-I/IV riboswitch aptamer domain',
    organism: 'Synthetic RNA',
    pdbReferenceCount: 1,
    rmdbUniqueSequenceCount: 2,
    profileCount: 2,
    pdbAxisReactivityRows: 188,
    projectionStatus: 'pass',
    baseMismatchRows: 5,
    identityPct: 98.1,
    queryCoveragePct: 99,
    subjectCoveragePct: 98,
    axisType: 'pdb_reference_sequence_position',
    residueMappingStatus: 'not-ready',
    detailHref: '#pdb-case?pdbId=4L81'
  },
  {
    caseId: 'PDBCASE-5TPY',
    pdbId: '5TPY',
    title: 'Zika virus exonuclease-resistant RNA',
    organism: 'Zika virus',
    pdbReferenceCount: 1,
    rmdbUniqueSequenceCount: 1,
    profileCount: 1,
    pdbAxisReactivityRows: 71,
    projectionStatus: 'pass',
    baseMismatchRows: 0,
    identityPct: 100,
    queryCoveragePct: 100,
    subjectCoveragePct: 100,
    axisType: 'pdb_reference_sequence_position',
    residueMappingStatus: 'not-ready',
    detailHref: '#pdb-case?pdbId=5TPY'
  }
];

const pdbCaseDetailById = {
  '8QO5': {
    ...pdbCaseRows[0],
    description: 'Local case contract for the SARS-CoV-2 SL5 structure-linked sequence record.',
    pdbReferenceIds: ['8QO5_A'],
    profileSummaries: [
      {
        bundleProfileId: 'RMDB_RNAPZ_SYNTH_8QO5',
        rmdbUniqueId: 'RMDB_UNIQUE_8QO5_001',
        bundleSequenceId: 'BUNDLE_SEQ_8QO5_001',
        modifier: 'summary-only',
        rowCount: 128,
        baseMismatchRows: 0
      }
    ],
    reactivityTrackPreview: [
      { pdbPos: 1, value: 0.18 },
      { pdbPos: 16, value: 0.24 },
      { pdbPos: 32, value: 0.41 },
      { pdbPos: 48, value: 0.29 },
      { pdbPos: 64, value: 0.12 }
    ]
  },
  '5KPY': {
    ...pdbCaseRows[1],
    description: 'Demo PDB case showing that one PDB case can carry multiple RMDB profiles.',
    pdbReferenceIds: ['5KPY_A'],
    profileSummaries: [
      {
        bundleProfileId: 'RMDB_RNAPZ9_1M7_0001',
        rmdbUniqueId: 'RMDB_UNIQUE_RNAPZ9_001',
        bundleSequenceId: 'BUNDLE_SEQ_5KPY_001',
        modifier: '1M7',
        rowCount: 71,
        baseMismatchRows: 3
      },
      {
        bundleProfileId: 'RMDB_RNAPZ9_STD_0001',
        rmdbUniqueId: 'RMDB_UNIQUE_RNAPZ9_002',
        bundleSequenceId: 'BUNDLE_SEQ_5KPY_002',
        modifier: 'standard-state',
        rowCount: 71,
        baseMismatchRows: 5
      }
    ],
    reactivityTrackPreview: [
      { pdbPos: 1, value: 0.12 },
      { pdbPos: 8, value: 0.38 },
      { pdbPos: 16, value: 0.72 },
      { pdbPos: 24, value: 0.31 },
      { pdbPos: 32, value: 0.21 },
      { pdbPos: 40, value: 0.58 },
      { pdbPos: 48, value: 0.83 },
      { pdbPos: 56, value: 0.27 },
      { pdbPos: 64, value: 0.17 }
    ]
  },
  '1AM0': {
    ...pdbCaseRows[2],
    description: 'Demo case for the AMP RNA aptamer complex.',
    pdbReferenceIds: ['1AM0_A'],
    profileSummaries: [
      {
        bundleProfileId: 'RMDB_ATPCON_TITR_0001',
        rmdbUniqueId: 'RMDB_UNIQUE_ATPCON_001',
        bundleSequenceId: 'BUNDLE_SEQ_1AM0_001',
        modifier: 'ATP titration',
        rowCount: 43,
        baseMismatchRows: 2
      }
    ],
    reactivityTrackPreview: [
      { pdbPos: 1, value: 0.22 },
      { pdbPos: 8, value: 0.61 },
      { pdbPos: 16, value: 0.34 },
      { pdbPos: 24, value: 0.49 },
      { pdbPos: 32, value: 0.18 },
      { pdbPos: 40, value: 0.25 }
    ]
  },
  '4L81': {
    ...pdbCaseRows[3],
    description: 'Demo case for the SAM-I/IV riboswitch aptamer domain.',
    pdbReferenceIds: ['4L81_A'],
    profileSummaries: [
      {
        bundleProfileId: 'RMDB_RNAPZ8_1M7_0001',
        rmdbUniqueId: 'RMDB_UNIQUE_RNAPZ8_001',
        bundleSequenceId: 'BUNDLE_SEQ_4L81_001',
        modifier: '1M7',
        rowCount: 94,
        baseMismatchRows: 2
      },
      {
        bundleProfileId: 'RMDB_RNAPZ8_DMS_0001',
        rmdbUniqueId: 'RMDB_UNIQUE_RNAPZ8_002',
        bundleSequenceId: 'BUNDLE_SEQ_4L81_002',
        modifier: 'DMS',
        rowCount: 94,
        baseMismatchRows: 3
      }
    ],
    reactivityTrackPreview: [
      { pdbPos: 1, value: 0.19 },
      { pdbPos: 12, value: 0.31 },
      { pdbPos: 24, value: 0.67 },
      { pdbPos: 36, value: 0.44 },
      { pdbPos: 48, value: 0.26 },
      { pdbPos: 60, value: 0.35 },
      { pdbPos: 72, value: 0.7 },
      { pdbPos: 84, value: 0.21 }
    ]
  },
  '5TPY': {
    ...pdbCaseRows[4],
    description: 'Demo case for an exonuclease-resistant viral RNA structure.',
    pdbReferenceIds: ['5TPY_A'],
    profileSummaries: [
      {
        bundleProfileId: 'RMDB_RNAPZ18_1M7_0000',
        rmdbUniqueId: 'RMDB_UNIQUE_RNAPZ18_001',
        bundleSequenceId: 'BUNDLE_SEQ_5TPY_001',
        modifier: '1M7',
        rowCount: 71,
        baseMismatchRows: 0
      }
    ],
    reactivityTrackPreview: [
      { pdbPos: 1, value: 0.14 },
      { pdbPos: 10, value: 0.22 },
      { pdbPos: 20, value: 0.51 },
      { pdbPos: 30, value: 0.73 },
      { pdbPos: 40, value: 0.45 },
      { pdbPos: 50, value: 0.28 },
      { pdbPos: 60, value: 0.36 },
      { pdbPos: 70, value: 0.19 }
    ]
  }
};

export function getPdbCaseDetail(pdbId) {
  const normalized = String(pdbId ?? '').trim().toUpperCase();
  return pdbCaseDetailById[normalized] ?? null;
}

export const portalMetrics = [
  { label: 'Total records', value: '312,540' },
  { label: 'Data types', value: '8' },
  { label: 'Reactivity profiles', value: '26.1K' },
  { label: 'Publications', value: '2,318' }
];

export const dataTypeCards = [
  { name: 'SHAPE-MaP', desc: 'Mutational profiling reactivity', count: '9.8K profiles' },
  { name: 'DMS-MaPseq', desc: 'Base accessibility probing', count: '6.4K profiles' },
  { name: 'RDAT', desc: 'Chemical probing experiments', count: '3.2K files' },
  { name: 'PDB/mmCIF', desc: 'Resolved RNA structures', count: '1,840 structures' }
];

export const stageDiseaseCards = [
  { name: 'Aptamer', count: '4.2K records' },
  { name: 'Riboswitch', count: '7.1K records' },
  { name: 'Viral RNA', count: '8.0K records' },
  { name: 'Ribozyme', count: '6.8K records' }
];

export const featuredRecords = [
  {
    id: 'FB-RDAT-0021',
    title: 'RNA Puzzle reactivity profile linked to tertiary structure',
    confidence: 'high'
  },
  {
    id: 'FB-PDB-0142',
    title: 'Riboswitch structure with ligand-bound probing evidence',
    confidence: 'high'
  },
  {
    id: 'APT-HSA-1007',
    title: 'VEGF DNA aptamer binding assay panel',
    confidence: 'experimental'
  }
];

export const siteSummaries = [
  {
    site: 'RiboCentre',
    scope: 'Curated structured RNA elements',
    records: 12430
  },
  {
    site: 'Riboswitch',
    scope: 'Ligand-responsive RNA motif atlas',
    records: 3912
  },
  {
    site: 'Aptamer',
    scope: 'RNA/DNA binder assays and metadata',
    records: 1884
  }
];

export const recentPublications = [
  {
    doi: '10.1038/s41593-026-01421-3',
    title: 'Chemical probing atlas of structured RNA regulatory elements',
    year: 2026
  },
  {
    doi: '10.1016/j.cell.2026.02.019',
    title: 'Structure-aware integration of RNA probing experiments',
    year: 2026
  },
  {
    doi: '10.1093/nar/gkae1142',
    title: 'Unified evidence grading for structured RNA annotations',
    year: 2026
  }
];

export const browseRows = [
  {
    id: 'PDBCASE-5KPY',
    name: '5-hydroxytryptophan RNA aptamer case',
    species: 'Synthetic RNA',
    ligand: 'N/A',
    evidence: 'High'
  },
  {
    id: 'PDBCASE-4L81',
    name: 'SAM-I/IV riboswitch aptamer case',
    species: 'Synthetic RNA',
    ligand: 'N/A',
    evidence: 'High'
  },
  {
    id: 'RB-014',
    name: 'Glycine tandem switch motif',
    species: 'B. subtilis',
    ligand: 'Glycine',
    evidence: 'Medium'
  }
];

export const aptamerMultiSelectRows = [
  {
    id: 'APT-BC-8K7W',
    sequenceName: 'Broccoli aptamer',
    aptamerName: 'Broccoli',
    year: 2025,
    category: 'Fluorogenic',
    sequence: 'GGGACGGUCGGGUCCAGAUAUUCGUAUCUGUCGAGUAGAGUGUGGGCUC',
    description: 'Broccoli-DFHBI-1T complex; local PDB test model (8K7W).',
    pdbId: '8K7W'
  },
  {
    id: 'APT-PSMA-A9',
    sequenceName: 'PSMA binding aptamer',
    aptamerName: 'A9',
    year: 2010,
    category: 'Cancer Targeting',
    sequence: 'GGGAGGACGAUGCGGAUCAGCCAUGUUUACGUCACUCCU',
    description: 'Cell targeting aptamer for prostate-specific membrane antigen.',
    pdbId: '3D2V'
  },
  {
    id: 'APT-MALAT1',
    sequenceName: 'MALAT1 motif aptamer',
    aptamerName: 'MALAT1-motif',
    year: 2021,
    category: 'RNA Motif',
    sequence: 'GGAUCCGGAUUGAGGCUAGUGAAGCUCC',
    description: 'RNA motif recognition and structure-informed design example.',
    pdbId: '7ELR'
  },
  {
    id: 'APT-G4-DFHBI',
    sequenceName: 'Spinach-like G4 aptamer',
    aptamerName: 'Spinach-like G4',
    year: 2020,
    category: 'Fluorogenic',
    sequence: 'GGGUGGUGGUGGUGGUGAAGCCGAUGC',
    description: 'G-quadruplex fluorogenic aptamer family example.',
    pdbId: '5OB3'
  },
  {
    id: 'APT-THR-SELEX',
    sequenceName: 'Thrombin SELEX aptamer',
    aptamerName: 'TBA-like',
    year: 2008,
    category: 'Protein Binding',
    sequence: 'GGTTGGTGTGGTTGG',
    description: 'Protein-binding aptamer class for assay and sensing workflows.',
    pdbId: '4DII'
  }
];

export const detailRecord = {
  id: 'FB-RNA-001',
  name: 'RNA probing-to-structure evidence map',
  status: 'reviewed',
  organism: 'Homo sapiens',
  family: 'RNA chemical probing and structure bridge',
  updated: '2026-03-07',
  sequenceLength: 76,
  genomicContext: 'Curated RDAT and PDB evidence integration'
};

export const detailEvidenceRows = [
  { method: 'SHAPE-MaP', metric: 'reactivity agreement', score: '0.91' },
  { method: 'PDB projection', metric: 'residue coverage', score: '0.87' }
];

export const provenanceHistory = [
  '2026-02-01 imported from FoldBridge candidate release v1.8',
  '2026-02-20 probing and structure mapping harmonization complete',
  '2026-03-07 unified template validation complete'
];
