import { cssVarsFor, themeTokens } from './theme.js';
import { caseManifest } from './generated/caseManifest.js';
import {
  predictedStructureIds as generatedPredictedStructureIds,
  rnaComposerPredictedStructureIds as generatedRnaComposerPredictedStructureIds
} from './generated/predictedStructureManifest.js';
import { reactivityGuidedStructurePredictions as generatedReactivityGuidedStructurePredictions } from './generated/reactivityGuidedStructureManifest.js';
import { rmdbPdbBlastRows } from './generated/rmdbPdbBlastRows.js';
import {
  renderGlobalSearch,
  renderFacetPanel,
  renderResultList,
  renderEvidenceTable,
  renderProvenanceSummary,
  renderProvenanceHistory,
  renderVisualizationShowcase,
  initHeaderSearch,
  initAptamerMultiSelect,
  initSecondaryStructureModule,
  initMolstarModule,
  initHomeStructureShowcase,
  initSequenceDetailMolstar,
  initSequenceDetailSecondaryHeatmap,
  initStructureDetailSecondaryForna,
  initStructureDetailSecondaryHeatmap,
  initStructureDetailMolstar,
  initPredictedStructureDetailMolstar
} from './modules.js';
import {
  dataTypeCards,
  detailRecord,
  featuredRecords,
  portalMetrics,
  recentPublications,
  siteSummaries,
  stageDiseaseCards
} from './data.js';
import { normalizeRoute, routeFromHash } from './router.js';
import { downloadRowsAsCsv } from './modules.js';
let sequenceRows = [];
let browseEntryRows = [];
let structureEntryRows = [];
let selectedBrowseIds = new Set();
let selectedStructureIds = new Set();
let browseCurrentPage = 1;
let case3dRows = [];
let case3dCurrentPage = 1;
let structureCurrentPage = 1;
let caseDetailSequencePage = 1;
let activeCaseDetailId = null;
let selectedSequenceIds = new Set();
let sequenceSearchQuery = '';
let advancedSearchQuery = '';
let advancedSearchSort = 'relevance';
let advancedSearchView = 'list';
let advancedSearchFiltersOpen = false;
let advancedSearchExperiment = 'all';
let advancedSearchModifier = 'all';
let advancedSearchLengthBand = 'all';
const BROWSE_PAGE_SIZE = 10;
const CASE3D_PAGE_SIZE = 10;
const CASE_DETAIL_SEQUENCE_PAGE_SIZE = 10;
const CASE_BUNDLE_ROOT = 'rmdb_pdb_sequence_cases_rasp_params_besthit_20260610';
const caseDetailCache = new Map();
const caseDetailLoading = new Set();
let homeActiveSpecies = '';
let homeActiveYear = '';
let homeTablePage = 1;
let homeDashboardFilters = {
  years: [],
  categories: []
};
const homeBundleSites = [
  {
    name: 'Ribocentre',
    short: 'RC',
    tone: 'blue',
    summary: 'Curated structured RNA entries, sequence annotations, and evidence-backed reference records.',
    tag: 'External portal',
    accent: 'core repository',
    topLabel: 'Ribozyme database',
    href: 'https://www.ribocentre.org/',
    action: { label: 'Open site', href: 'https://www.ribocentre.org/' }
  },
  {
    name: 'Switch',
    short: 'RS',
    tone: 'green',
    summary: 'Ligand-responsive riboswitch modules, families, and responsive motif collections for comparison.',
    tag: 'External portal',
    accent: 'switch systems',
    topLabel: 'Riboswitch database',
    href: 'https://riboswitch.ribocentre.org/',
    action: { label: 'Open site', href: 'https://riboswitch.ribocentre.org/' }
  },
  {
    name: 'Aptamer',
    short: 'RA',
    tone: 'violet',
    summary: 'Aptamer sequences, assay metadata, target classes, and structural evidence in one entrance.',
    tag: 'External portal',
    accent: 'aptamer discovery',
    topLabel: 'Aptamer database',
    href: 'https://aptamer.ribocentre.org/',
    action: { label: 'Open site', href: 'https://aptamer.ribocentre.org/' }
  },
  {
    name: 'GlycoRNA',
    short: 'GR',
    tone: 'blue',
    summary: 'GlycoRNA-focused records and reference content for glycosylated RNA exploration.',
    tag: 'External portal',
    accent: 'glycoRNA resource',
    topLabel: 'GlycoRNA database',
    href: 'http://www.glycornadb.com',
    action: { label: 'Open site', href: 'http://www.glycornadb.com' }
  },
  {
    name: 'FoldBridge',
    short: 'FB',
    tone: 'gold',
    summary: 'A structure bridge for folding, visualization, and comparative RNA exploration workflows.',
    tag: 'Current database',
    accent: 'folding workspace',
    topLabel: 'Probing-to-structure bridge',
    href: null,
    action: { label: 'Stay here', route: 'home' }
  }
];

const case10fzSummary = {
  pdbId: '10FZ',
  pdbReferenceId: '10FZ_A',
  candidatePairRows: 9,
  rmdbUniqueSequenceCount: 5,
  rmdbProfileCount: 9,
  alignmentRows: 436,
  pdbAxisReactivityRows: 838,
  projectionStatus: 'pass',
  projectionMethod: 'rmdb_sequence_position_to_blast_gapped_subject_position_v0',
  scientificScope: 'sequence alignment projection to a PDB reference axis',
  sourceNote:
    'RMDB best-hit sequence pairs were aligned to the 10FZ reference sequence and their per-base reactivity values were projected onto the PDB reference axis. This package does not claim a native 2D map layer or direct structural proof.',
  blastThresholds: {
    evalue: '1e-10',
    percIdentityMin: '90%',
    strand: 'plus',
    maxHsps: '1'
  }
};

const case10fzMatchedSequences = [
  {
    bundleSequenceId: 'top_x_279::seq_e29cf7af54a9ec85',
    sourceFile: 'data-rna-structures/PDB130_2A3_0000.rdat',
    sequenceLength: 207,
    identityFraction: '1.00',
    queryCoverage: '0.628',
    pdbCoverage: '0.084'
  },
  {
    bundleSequenceId: 'top_x_279::seq_c25f07344fe9e9f4',
    sourceFile: 'data-rna-structures/PDB130_DMS_0000.rdat',
    sequenceLength: 207,
    identityFraction: '1.00',
    queryCoverage: '0.628',
    pdbCoverage: '0.084'
  },
  {
    bundleSequenceId: 'top_x_279::seq_76782c154e2f23b4',
    sourceFile: 'data-eterna/OK2TRN_2A3_0000.rdat',
    sequenceLength: 177,
    identityFraction: '1.00',
    queryCoverage: '0.576',
    pdbCoverage: '0.066'
  },
  {
    bundleSequenceId: 'top_x_279::seq_3d84d5079bda7b01',
    sourceFile: 'data-eterna/RYOS2_1M7_0000.rdat',
    sequenceLength: 130,
    identityFraction: '1.00',
    queryCoverage: '0.669',
    pdbCoverage: '0.056'
  },
  {
    bundleSequenceId: 'nonpuzzle_fail_rescue::seq_c58e83f86f91235f',
    sourceFile: 'data-eterna/ETERNA_R74_0000.rdat',
    sequenceLength: 107,
    identityFraction: '1.00',
    queryCoverage: '0.589',
    pdbCoverage: '0.041'
  }
];

const case10fzReactivityPreview = [
  { pdbPos: 1, pdbBase: 'A', source: 'PDB130_DMS_0000', rmdbPos: 27, reactivity: '0.2489', error: '0.1505' },
  { pdbPos: 1, pdbBase: 'A', source: 'PDB130_2A3_0000', rmdbPos: 27, reactivity: '0.0059', error: '0.0279' },
  { pdbPos: 1, pdbBase: 'A', source: 'RYOS2_1M7_0000', rmdbPos: 5, reactivity: '0.7695', error: '0.1191' },
  { pdbPos: 2, pdbBase: 'A', source: 'RYOS2_MG50_0000', rmdbPos: 6, reactivity: '1.2238', error: '0.1945' },
  { pdbPos: 3, pdbBase: 'A', source: 'OK2TRN_DMS_0000', rmdbPos: 27, reactivity: '1.2304', error: '0.0981' },
  { pdbPos: 4, pdbBase: 'U', source: 'OK2TRN_2A3_0000', rmdbPos: 28, reactivity: '1.9489', error: '0.1257' }
];

const technologyCategories = [
  {
    id: 'shape-based-probing',
    title: 'SHAPE-based probing',
    summary: '2\'-OH acylation workflows spanning targeted assays, MaP readouts, and in vivo profiling.',
    methods: ['shape', 'shape-seq', 'shape-map', 'nai-map', 'icshape', 'icshape-map', 'smartshape', 'cotranscriptional-shape-seq', 'nuc-shape-structure-seq', 'chemmodseq']
  },
  {
    id: 'dms-based-probing',
    title: 'DMS-based probing',
    summary: 'DMS-centered methods for in-cell accessibility and transcriptome-scale readout.',
    methods: ['dms-seq', 'structure-seq', 'structure-seq-cap', 'structure-seq2', 'cirs-seq', 'mod-seq', 'dim-2p-seq', 'dms-mapseq', 'rapid-mapseq', 'tnet-mapseq']
  },
  {
    id: 'enzymatic-probing',
    title: 'Enzymatic probing',
    summary: 'Nuclease-based strategies for accessibility and cleavage profiling.',
    methods: ['pars', 'parte', 'tnet-rnase-seq']
  },
  {
    id: 'guanine-specific-probing',
    title: 'Guanine-specific probing',
    summary: 'Specialized methods focused on guanine reactivity and G-rich structural signals.',
    methods: ['keth-seq']
  },
  {
    id: 'cleavage-footprinting',
    title: 'Cleavage / footprinting',
    summary: 'Cleavage-style and footprinting approaches for protection and structural transition mapping.',
    methods: ['lead-seq', 'rl-seq']
  },
  {
    id: 'rna-protein-interaction',
    title: 'RNA-protein interaction related',
    summary: 'Methods that connect structural probing with RNA-protein interaction landscapes.',
    methods: ['iclaser']
  }
];

function createTechnologyMethod({
  slug,
  title,
  category,
  subtitle,
  reagent,
  readout,
  bestFor,
  whatItReads,
  outputs,
  strengths,
  caveats,
  workflow,
  workflowIntro,
  foldbridgeUse,
  references,
  literatureHighlights
}) {
  return {
    slug,
    title,
    category,
    subtitle: subtitle ?? `${title} within the ${category} family.`,
    reagent: reagent ?? 'See protocol-specific chemistry and library design',
    readout: readout ?? 'Sequencing-derived structure or accessibility signal',
    bestFor: bestFor ?? `Browsing ${category} workflows and expanding into a dedicated child page later`,
    whatItReads: whatItReads ?? 'Local RNA accessibility, flexibility, or protection signatures',
    outputs: outputs ?? [
      `${title} reactivity or cleavage profiles`,
      'Condition-to-condition comparison tables',
      'Structure interpretation summaries'
    ],
    strengths: strengths ?? [
      `Fits naturally inside the ${category} module`,
      'Provides a clear child-page entry for future expansion',
      'Can later hold figures, protocols, examples, and references'
    ],
    caveats: caveats ?? [
      'This page is currently a technology placeholder rather than a full protocol review',
      'Final interpretation depends on the exact experimental implementation',
      'Best understood together with complementary structural evidence'
    ],
    workflow: workflow ?? [
      `Introduce the core idea behind ${title}`,
      'Explain the chemistry or enzymatic logic used by the method',
      'Summarize how the sequencing readout is generated',
      'Show how the output is interpreted in structure analysis'
    ],
    workflowIntro: workflowIntro ?? `${title} usually follows a four-part logic: prepare the RNA system, perform the chemical or enzymatic probing reaction, capture the signal through reverse transcription or sequencing, and then interpret the resulting reactivity profile in structural terms.`,
    foldbridgeUse: foldbridgeUse ?? `FoldBridge can use ${title} as a dedicated child page under ${category}, so users can browse by category first and then drill into method-specific details.`,
    references: references ?? [
      `${title} primary reference placeholder for project curation.`,
      `${category} overview reference placeholder for project curation.`
    ],
    literatureHighlights: literatureHighlights ?? []
  };
}

const technologyMethods = [
  createTechnologyMethod({
    slug: 'pars',
    title: 'PARS',
    category: 'Enzymatic probing',
    subtitle: 'Parallel analysis of RNA structure using nuclease sensitivity.',
    reagent: 'Structure-specific RNases',
    readout: 'Sequencing counts from single- and double-strand cleavage products',
    bestFor: 'Transcriptome-scale secondary-structure profiling in vitro',
    whatItReads: 'Relative single-stranded versus double-stranded enzyme accessibility',
    outputs: [
      'Genome-scale single-strand versus double-strand cleavage scores',
      'Transcript-level secondary-structure profiles under in vitro conditions',
      'Comparative structural maps across transcripts or transcript regions'
    ],
    strengths: [
      'Well suited to transcriptome-scale in vitro structure profiling',
      'Directly contrasts single-strand and double-strand nuclease sensitivities',
      'Useful for broad structural landscape mapping before targeted follow-up experiments'
    ],
    caveats: [
      'Profiles are generated in vitro and may not fully capture cellular remodeling or protein-bound states',
      'Interpretation depends on enzyme specificity, digestion conditions, and library normalization',
      'Cleavage-based approaches can be less informative for fast dynamics than chemistry-based flexibility readouts'
    ],
    workflowIntro: 'PARS combines parallel nuclease digestion with deep sequencing to compare single-stranded and double-stranded accessibility across many RNAs at once.',
    literatureHighlights: [
      'The foundational PARS study showed that parallel treatment with structure-specific nucleases can generate transcriptome-wide secondary-structure maps in yeast.',
      'Later transcriptome-wide studies extended the same logic to mammalian systems and highlighted widespread structural variation across RNA regions and biological contexts.',
      'PARS is especially useful when the goal is broad structural landscape mapping rather than live-cell probing of RNA dynamics.'
    ],
    references: [
      'Kertesz M et al. Genome-wide measurement of RNA secondary structure in yeast. Nature. 2010.',
      'Wan Y et al. Landscape and variation of RNA secondary structure across the human transcriptome. Nature. 2014.'
    ]
  }),
  createTechnologyMethod({
    slug: 'parte',
    title: 'PARTE',
    category: 'Enzymatic probing',
    subtitle: 'Parallel analysis of RNA structures with temperature elevation.',
    reagent: 'RNase probing across temperature series',
    readout: 'Temperature-dependent cleavage signatures by sequencing',
    bestFor: 'Tracking structural melting behavior and thermodynamic transitions',
    whatItReads: 'How nuclease accessibility changes as RNA structures are destabilized'
  }),
  createTechnologyMethod({
    slug: 'tnet-rnase-seq',
    title: 'tNet-RNase-seq',
    category: 'Enzymatic probing',
    subtitle: 'RNase-network style sequencing for enzymatic probing at scale.',
    reagent: 'RNase-driven cleavage with network-scale sequencing analysis',
    readout: 'RNase cleavage signatures across transcript sets',
    bestFor: 'Comparing RNase-sensitive structural patterns across large RNA collections',
    whatItReads: 'RNase-sensitive accessibility and protection relationships across transcripts'
  }),
  createTechnologyMethod({
    slug: 'dms-seq',
    title: 'DMS-seq',
    category: 'DMS-based probing',
    subtitle: 'Sequencing-based DMS probing for base accessibility profiling.',
    reagent: 'Dimethyl sulfate',
    readout: 'Reverse-transcription stop signatures at modified bases',
    bestFor: 'Transcriptome-wide accessibility mapping under native-like conditions',
    whatItReads: 'Exposure of A and C bases that are not base-paired or are locally accessible',
    outputs: [
      'Transcriptome-wide DMS accessibility profiles at A and C residues',
      'Condition-specific maps of local RNA unfolding or protection in vivo',
      'Comparative datasets linking translation, RNA-binding, and structural accessibility'
    ],
    strengths: [
      'Native in vivo readout of base accessibility in cellular RNA populations',
      'Strong for identifying actively unfolded or remodeled RNA regions across transcripts',
      'Integrates naturally with transcriptome-scale regulatory analysis'
    ],
    caveats: [
      'DMS primarily reports on accessible A and C residues rather than all nucleotide positions',
      'RT-stop based readouts can miss some events relative to mutational-profiling implementations',
      'Signals reflect both structure and cellular context, including protein occupancy and translation'
    ],
    workflowIntro: 'DMS-seq uses dimethyl sulfate to methylate exposed adenines and cytosines in RNA, then captures those modification events through sequencing-based reverse-transcription stops.',
    literatureHighlights: [
      'The foundational DMS-seq work showed that many mRNA structures are actively unfolded in vivo, particularly by translating ribosomes.',
      'Subsequent studies used in-cell accessibility maps to connect RNA structure with regulatory logic, including protein binding and post-transcriptional control.',
      'DMS-seq established base-accessibility profiling as a practical transcriptome-wide strategy for studying RNA structure inside cells.'
    ],
    references: [
      'Rouskin S et al. Genome-wide probing of RNA structure reveals active unfolding of mRNA structures in vivo. Nature. 2014.',
      'Spitale RC et al. Structural imprints in vivo decode RNA regulatory mechanisms. Nature. 2015.'
    ]
  }),
  createTechnologyMethod({
    slug: 'structure-seq',
    title: 'Structure-seq',
    category: 'DMS-based probing',
    subtitle: 'In vivo DMS-guided structure sequencing across cellular transcriptomes.',
    reagent: 'Dimethyl sulfate in living cells',
    readout: 'Reverse-transcription stops at modified accessible bases',
    bestFor: 'Genome-wide RNA secondary-structure profiling in living cells and whole transcriptomes',
    whatItReads: 'In-cell accessibility of Watson-Crick faces at reactive adenines and cytosines',
    outputs: [
      'In vivo transcriptome-wide structure profiles',
      'Condition-aware accessibility maps for structured RNAs and mRNAs',
      'Structural features that can be integrated with regulation, stress, or developmental state'
    ],
    strengths: [
      'Captures RNA structure directly in living cells rather than only after extraction',
      'Adapted for large-scale transcriptome profiling with biological context preserved',
      'Useful for comparing structural regulation across conditions or species'
    ],
    caveats: [
      'Like related DMS-based methods, it is limited to reactive base types and does not directly report every nucleotide',
      'Library quality and reverse-transcription behavior strongly affect signal interpretation',
      'Observed accessibility can reflect both RNA folding and protein or ribosome occupancy'
    ],
    workflowIntro: 'Structure-seq applies in vivo DMS modification, enriches the resulting reverse-transcription stop information by sequencing, and reconstructs transcriptome-scale accessibility patterns under native cellular conditions.',
    literatureHighlights: [
      'The foundational Structure-seq study demonstrated that transcriptome-wide in vivo RNA structure profiling could reveal regulatory features not evident from sequence alone.',
      'Structure-seq helped establish that cellular RNA folding should be measured in context, because living systems reshape accessibility through translation, binding partners, and condition-specific remodeling.',
      'It became one of the central DMS-based frameworks for large-scale in vivo RNA secondary-structure analysis.'
    ],
    references: [
      'Ding Y et al. In vivo genome-wide profiling of RNA secondary structure reveals novel regulatory features. Nature. 2014.'
    ]
  }),
  createTechnologyMethod({
    slug: 'structure-seq-cap',
    title: 'Structure-Seq',
    category: 'DMS-based probing',
    subtitle: 'Capitalized naming variant often used in literature and figure labels.',
    reagent: 'Dimethyl sulfate in living cells',
    readout: 'Reverse-transcription stops at modified accessible bases',
    bestFor: 'Genome-wide RNA secondary-structure profiling in living cells and whole transcriptomes',
    whatItReads: 'In-cell accessibility of Watson-Crick faces at reactive adenines and cytosines',
    outputs: [
      'In vivo transcriptome-wide structure profiles',
      'Condition-aware accessibility maps for structured RNAs and mRNAs',
      'Structural features that can be integrated with regulation, stress, or developmental state'
    ],
    strengths: [
      'Captures RNA structure directly in living cells rather than only after extraction',
      'Adapted for large-scale transcriptome profiling with biological context preserved',
      'Useful for comparing structural regulation across conditions or species'
    ],
    caveats: [
      'Like related DMS-based methods, it is limited to reactive base types and does not directly report every nucleotide',
      'Library quality and reverse-transcription behavior strongly affect signal interpretation',
      'Observed accessibility can reflect both RNA folding and protein or ribosome occupancy'
    ],
    workflowIntro: 'Structure-Seq is the same method family as Structure-seq; this page preserves the capitalization variant commonly used in figures and method listings.',
    literatureHighlights: [
      'The foundational Structure-seq study demonstrated that transcriptome-wide in vivo RNA structure profiling could reveal regulatory features not evident from sequence alone.',
      'Structure-seq helped establish that cellular RNA folding should be measured in context, because living systems reshape accessibility through translation, binding partners, and condition-specific remodeling.',
      'It became one of the central DMS-based frameworks for large-scale in vivo RNA secondary-structure analysis.'
    ],
    references: [
      'Ding Y et al. In vivo genome-wide profiling of RNA secondary structure reveals novel regulatory features. Nature. 2014.'
    ]
  }),
  createTechnologyMethod({ slug: 'structure-seq2', title: 'Structure-seq2', category: 'DMS-based probing', subtitle: 'Updated Structure-seq workflow with improved transcriptome-scale handling.' }),
  createTechnologyMethod({ slug: 'cirs-seq', title: 'CIRS-seq', category: 'DMS-based probing', subtitle: 'Chemical inference of RNA structures by sequencing.' }),
  createTechnologyMethod({ slug: 'mod-seq', title: 'Mod-seq', category: 'DMS-based probing', subtitle: 'Modification sequencing workflow for RNA chemical probing readouts.' }),
  createTechnologyMethod({ slug: 'dim-2p-seq', title: 'DIM-2P-seq', category: 'DMS-based probing', subtitle: 'DMS-family sequencing workflow for differential structural profiling.' }),
  createTechnologyMethod({
    slug: 'dms-mapseq',
    title: 'DMS-MaPseq',
    category: 'DMS-based probing',
    subtitle: 'Mutational profiling readout for DMS-based RNA structure probing.',
    reagent: 'Dimethyl sulfate with MaP reverse transcription',
    readout: 'Mutation frequencies induced at modified A/C sites',
    bestFor: 'Robust in vivo probing with improved event capture through mutational profiling',
    whatItReads: 'Base accessibility encoded as mutation signatures instead of only RT stops',
    outputs: [
      'Per-base mutation-frequency maps reporting DMS accessibility',
      'Targeted or transcriptome-scale structure datasets with improved event capture',
      'Mutation-based profiles suited to comparative or multiplexed analysis'
    ],
    strengths: [
      'Captures modification events as mutations rather than relying only on reverse-transcription termination',
      'Works well for targeted and large-scale in vivo DMS probing workflows',
      'Improves quantitative event recovery for many RNAs and experimental designs'
    ],
    caveats: [
      'Interpretation still depends on DMS reactivity constraints and mutational-profiling calibration',
      'Mutation calling, background subtraction, and coverage thresholds matter substantially',
      'Accessibility signals remain shaped by cellular binding partners and translation state'
    ],
    workflowIntro: 'DMS-MaPseq couples DMS modification with mutational profiling reverse transcription so that chemical adducts are read out as sequence changes instead of primarily as stops.',
    literatureHighlights: [
      'DMS-MaPseq showed that mutational profiling can recover DMS accessibility information with a more tolerant and information-rich readout than classic stop-based approaches.',
      'The method helped standardize DMS probing workflows that scale from individual RNAs to transcriptome-wide analysis.',
      'Its main contribution was methodological: it made DMS-based structure probing more quantitative and broadly deployable in sequencing workflows.'
    ],
    references: [
      'Zubradt M et al. DMS-MaPseq for genome-wide or targeted RNA structure probing in vivo. Nat Methods. 2017.',
      'Busan S, Weeks KM. Accurate detection of chemical modifications in RNA by mutational profiling. Example overview reference.'
    ]
  }),
  createTechnologyMethod({ slug: 'rapid-mapseq', title: 'RAPiD-MaPseq', category: 'DMS-based probing', subtitle: 'Fast DMS-family mutational profiling workflow for comparative structure analysis.' }),
  createTechnologyMethod({ slug: 'tnet-mapseq', title: 'tNet-MaPseq', category: 'DMS-based probing', subtitle: 'Network-scale MaPseq-style DMS analysis across transcript sets.' }),
  createTechnologyMethod({
    slug: 'shape',
    title: 'SHAPE',
    category: 'SHAPE-based probing',
    subtitle: '2\'-OH acylation for nucleotide flexibility profiling.',
    reagent: '1M7 / NMIA / NAI',
    readout: 'Stops, mutations, or normalized SHAPE reactivity',
    bestFor: 'General secondary-structure modeling across diverse RNAs',
    whatItReads: 'Local nucleotide flexibility at the ribose 2\'-hydroxyl',
    outputs: [
      'Per-nucleotide SHAPE reactivity profiles',
      'Secondary-structure models constrained by experimental probing',
      'Comparative maps across ligand, mutant, or time-resolved conditions'
    ],
    strengths: [
      'Largely base-agnostic readout because modification occurs at the ribose 2\'-hydroxyl rather than a specific nucleobase',
      'Single-nucleotide resolution that can be folded directly into secondary-structure prediction pipelines',
      'Adaptable to focused RNAs, long viral genomes, and sequencing-based extensions such as SHAPE-Seq and SHAPE-MaP'
    ],
    caveats: [
      'SHAPE reactivity reports local flexibility, not base pairing alone, so tertiary contacts and dynamics can complicate interpretation',
      'Secondary-structure inference improves with SHAPE constraints but is not always unique; confidence estimates and orthogonal validation still matter',
      'Signal quality depends on reagent choice, reverse-transcription chemistry, normalization, and experimental context'
    ],
    workflow: [
      'Fold or prepare the RNA under the experimental condition of interest and split modified versus no-reagent control samples',
      'Treat the RNA with a SHAPE reagent such as NMIA, 1M7, or NAI so flexible nucleotides preferentially acquire 2\'-O adducts',
      'Read out modification events by primer extension or mutational profiling, then normalize the signal to obtain per-nucleotide reactivities',
      'Use the reactivity profile to guide structure modeling, compare conditions, and prioritize regions for mechanistic follow-up'
    ],
    workflowIntro: 'In practice, a SHAPE experiment moves from controlled RNA preparation to selective 2\'-hydroxyl acylation, then to signal readout and computational interpretation. The workflow below matches the way the foundational SHAPE papers describe the method.',
    foldbridgeUse: 'FoldBridge can present SHAPE as a core entry point for RNA chemical probing because the method links experimental flexibility measurements to practical secondary-structure modeling. A strong detail page should explain the chemistry, what the signal means biologically, and where SHAPE works especially well versus where complementary data are still needed.',
    literatureHighlights: [
      'The original SHAPE papers established that acylation of the ribose 2\'-hydroxyl can report nucleotide-by-nucleotide flexibility with broad applicability across RNA sequences and folds.',
      'Follow-up reagent development introduced faster chemistries such as 1M7, which improved temporal resolution and made dynamic or complex RNAs easier to probe reproducibly.',
      'Large-scale applications showed SHAPE could move beyond small model RNAs, including whole-genome structural mapping of HIV-1 and later sequencing-based implementations.',
      'Benchmarking studies also showed an important limitation: SHAPE-guided models are powerful but not automatically definitive, so helix-level confidence and orthogonal validation remain good practice.'
    ],
    references: [
      'Merino EJ, Wilkinson KA, Coughlan JL, Weeks KM. RNA structure analysis at single nucleotide resolution by selective 2\'-hydroxyl acylation and primer extension (SHAPE). J Am Chem Soc. 2005.',
      'Mortimer SA, Weeks KM. A fast-acting reagent for accurate analysis of RNA secondary and tertiary structure by SHAPE chemistry. J Am Chem Soc. 2008.',
      'Deigan KE, Li TW, Mathews DH, Weeks KM. Accurate SHAPE-directed RNA structure determination. Proc Natl Acad Sci U S A. 2009.',
      'Watts JM, Dang KK, Gorelick RJ, et al. Architecture and secondary structure of an entire HIV-1 RNA genome. Nature. 2009.',
      'Kladwang W, VanLang CC, Cordero P, Das R. Understanding the errors of SHAPE-directed RNA structure modeling. Biochemistry. 2011.',
      'Lucks JB, Mortimer SA, Trapnell C, et al. Multiplexed RNA structure characterization with selective 2\'-hydroxyl acylation analyzed by primer extension sequencing (SHAPE-Seq). Proc Natl Acad Sci U S A. 2011.',
      'Siegfried NA, Busan S, Rice GM, Nelson JAE, Weeks KM. RNA motif discovery by SHAPE and mutational profiling (SHAPE-MaP). Nat Methods. 2014.'
    ]
  }),
  createTechnologyMethod({ slug: 'shape-seq', title: 'SHAPE-seq', category: 'SHAPE-based probing', subtitle: 'Sequencing-enabled SHAPE workflow for high-throughput RNA structure analysis.' }),
  createTechnologyMethod({
    slug: 'shape-seq',
    title: 'SHAPE-seq',
    category: 'SHAPE-based probing',
    subtitle: 'Sequencing-enabled SHAPE workflow for high-throughput RNA structure analysis.',
    reagent: 'SHAPE reagents such as 1M7 followed by sequencing library preparation',
    readout: 'Sequencing-based quantification of SHAPE-induced reverse-transcription events',
    bestFor: 'High-throughput structure analysis of many RNAs or designed RNA libraries',
    whatItReads: 'Per-nucleotide backbone flexibility encoded through SHAPE chemistry and sequencing',
    outputs: [
      'Sequencing-based SHAPE reactivity profiles',
      'Parallel structural measurements across many RNAs or conditions',
      'Data suitable for constrained structure modeling and design analysis'
    ],
    strengths: [
      'Brings SHAPE chemistry into scalable sequencing workflows',
      'Useful for multiplexed experiments and synthetic or designed RNA sets',
      'Retains the structural interpretability of SHAPE while increasing throughput'
    ],
    caveats: [
      'Library construction and normalization can introduce additional technical variance',
      'Readout still reflects flexibility rather than base pairing alone',
      'Coverage depth can limit confidence for low-abundance or long targets'
    ],
    workflowIntro: 'SHAPE-seq integrates classic SHAPE chemistry with sequencing so that many RNAs can be profiled in parallel instead of one by one.',
    literatureHighlights: [
      'SHAPE-seq showed that SHAPE chemistry could be coupled to sequencing without losing its value for structure inference.',
      'The method was especially important for scaling RNA structure analysis to multiplexed libraries and many experimental conditions.',
      'It helped bridge small-scale biochemical probing and broader comparative RNA analysis workflows.'
    ],
    references: [
      'Lucks JB et al. Multiplexed RNA structure characterization with selective 2\'-hydroxyl acylation analyzed by primer extension sequencing (SHAPE-Seq). Proc Natl Acad Sci U S A. 2011.'
    ]
  }),
  createTechnologyMethod({
    slug: 'shape-map',
    title: 'SHAPE-MaP',
    category: 'SHAPE-based probing',
    subtitle: 'Mutational profiling implementation of SHAPE reactivity measurement.',
    reagent: 'SHAPE chemistry with mutational profiling reverse transcription',
    readout: 'Mutation frequencies induced by SHAPE adducts during reverse transcription',
    bestFor: 'Accurate and scalable SHAPE-guided structure analysis with sequencing readout',
    whatItReads: 'RNA backbone flexibility captured as mutation signatures rather than only extension stops',
    outputs: [
      'Mutation-based SHAPE reactivity profiles',
      'High-confidence datasets for motif discovery and constrained folding',
      'Comparative structure maps across conditions, mutants, or long RNAs'
    ],
    strengths: [
      'More information-rich readout than stop-only SHAPE approaches',
      'Strong fit for long RNAs, complex motifs, and sequencing-based comparative studies',
      'Widely used bridge between classical SHAPE chemistry and modern RNA informatics'
    ],
    caveats: [
      'Mutation calling and background correction are central to data quality',
      'Interpretation still depends on appropriate normalization and structural modeling',
      'Signal remains sensitive to protocol details such as RT conditions and reagent handling'
    ],
    workflowIntro: 'SHAPE-MaP replaces a purely stop-based SHAPE readout with mutational profiling, allowing SHAPE adducts to be recorded as sequence changes during reverse transcription.',
    literatureHighlights: [
      'SHAPE-MaP demonstrated that mutational profiling could substantially strengthen SHAPE-based structure analysis and motif discovery.',
      'The method became a key platform for applying SHAPE chemistry to long, structured, and information-dense RNAs.',
      'It is now one of the most influential sequencing-based descendants of the original SHAPE framework.'
    ],
    references: [
      'Siegfried NA, Busan S, Rice GM, Nelson JAE, Weeks KM. RNA motif discovery by SHAPE and mutational profiling (SHAPE-MaP). Nat Methods. 2014.'
    ]
  }),
  createTechnologyMethod({ slug: 'nai-map', title: 'NAI-MaP', category: 'SHAPE-based probing', subtitle: 'NAI-based mutational profiling for structure probing in native-like settings.' }),
  createTechnologyMethod({
    slug: 'icshape',
    title: 'icSHAPE',
    category: 'SHAPE-based probing',
    subtitle: 'In vivo click SHAPE workflow for transcriptome-wide structure profiling.',
    reagent: 'Cell-permeable SHAPE reagent with click-enrichment workflow',
    readout: 'Transcriptome-wide SHAPE accessibility after in-cell modification and enrichment',
    bestFor: 'Large-scale in vivo RNA structure profiling with cellular context preserved',
    whatItReads: 'In-cell nucleotide flexibility and accessibility across the transcriptome',
    outputs: [
      'Transcriptome-wide in vivo SHAPE profiles',
      'Structure maps linked to RNA processing, localization, or protein binding',
      'Comparative accessibility datasets across cellular compartments or states'
    ],
    strengths: [
      'Extends SHAPE-style probing into living cells at transcriptome scale',
      'Provides a direct route to studying structure in regulatory cellular contexts',
      'Useful for connecting RNA structure with functional genomic features'
    ],
    caveats: [
      'Signal interpretation still requires care because accessibility reflects both folding and molecular environment',
      'Enrichment and library preparation add complexity beyond classic focused SHAPE experiments',
      'Transcript abundance and recovery biases can affect apparent coverage across RNAs'
    ],
    workflowIntro: 'icSHAPE brings SHAPE-like chemistry into living cells and combines it with enrichment and sequencing to profile RNA structure transcriptome-wide in vivo.',
    literatureHighlights: [
      'The foundational icSHAPE paper showed that transcriptome-wide in vivo SHAPE-style structure profiling can reveal regulatory structure signatures not visible in sequence alone.',
      'It helped establish a framework for comparing RNA structure across cellular regions and biological states.',
      'icSHAPE is especially influential because it pushed backbone-flexibility probing from targeted RNAs into systems-scale cellular analysis.'
    ],
    references: [
      'Spitale RC et al. Structural imprints in vivo decode RNA regulatory mechanisms. Nature. 2015.'
    ]
  }),
  createTechnologyMethod({ slug: 'icshape-map', title: 'icSHAPE-MaP', category: 'SHAPE-based probing', subtitle: 'Combined icSHAPE and MaP-style workflow for in-cell structure analysis.' }),
  createTechnologyMethod({ slug: 'smartshape', title: 'smartSHAPE', category: 'SHAPE-based probing', subtitle: 'SHAPE workflow optimized for richer transcriptome-scale structure interpretation.' }),
  createTechnologyMethod({ slug: 'cotranscriptional-shape-seq', title: 'Cotranscriptional SHAPE-seq', category: 'SHAPE-based probing', subtitle: 'SHAPE-seq workflow designed to monitor cotranscriptional folding.' }),
  createTechnologyMethod({ slug: 'nuc-shape-structure-seq', title: 'Nuc-SHAPE-Structure-Seq', category: 'SHAPE-based probing', subtitle: 'SHAPE-family sequencing method focused on nuclear RNA structure landscapes.' }),
  createTechnologyMethod({ slug: 'chemmodseq', title: 'ChemModSeq', category: 'SHAPE-based probing', subtitle: 'Chemical modification sequencing workflow within the SHAPE-family module.' }),
  createTechnologyMethod({ slug: 'keth-seq', title: 'Keth-seq', category: 'Guanine-specific probing', subtitle: 'Guanine-focused sequencing method for specialized probing readout.' }),
  createTechnologyMethod({ slug: 'lead-seq', title: 'Lead-seq', category: 'Cleavage / footprinting', subtitle: 'Lead-dependent cleavage sequencing for RNA structure readout.' }),
  createTechnologyMethod({ slug: 'rl-seq', title: 'RL-seq', category: 'Cleavage / footprinting', subtitle: 'Cleavage-oriented sequencing workflow for structural accessibility analysis.' }),
  createTechnologyMethod({ slug: 'iclaser', title: 'icLASER', category: 'RNA-protein interaction related', subtitle: 'In-cell probing method linked to solvent accessibility and RNA-protein interaction context.' })
];

function subNav() {
  return `<div class="hero-subnav">
    <div class="hero-subnav-inner">
      <button
        class="subnav-menu-toggle"
        id="subnav-menu-toggle"
        type="button"
        aria-label="Toggle navigation menu"
        aria-expanded="${isSubnavMenuOpen ? 'true' : 'false'}"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    <nav class="${isSubnavMenuOpen ? 'open' : ''}">
      <button
        class="nav-btn ${isRouteActive('home') ? 'active' : ''}"
        data-route="home"
        aria-current="${isRouteActive('home') ? 'page' : 'false'}"
      >
        Home
      </button>

      <button
        class="nav-btn ${isRouteActive('browse') ? 'active' : ''}"
        data-route="browse"
        aria-current="${isRouteActive('browse') ? 'page' : 'false'}"
      >
        Browse
      </button>

      <button
        class="nav-btn ${isRouteActive('sequence', 'download-sequences') ? 'active' : ''}"
        data-route="sequence"
        aria-current="${isRouteActive('sequence', 'download-sequences') ? 'page' : 'false'}"
      >
        Sequence
      </button>

      <button
        class="nav-btn ${isRouteActive('structure', 'download-structures') ? 'active' : ''}"
        data-route="structure"
        aria-current="${isRouteActive('structure', 'download-structures') ? 'page' : 'false'}"
      >
        Structure
      </button>

      <button
        class="nav-btn ${isRouteActive('probing', 'detail') ? 'active' : ''}"
        data-route="probing"
        aria-current="${isRouteActive('probing', 'detail') ? 'page' : 'false'}"
      >
        Probing
      </button>

      <button
        class="nav-btn ${isRouteActive('download') ? 'active' : ''}"
        data-route="download"
        aria-current="${isRouteActive('download') ? 'page' : 'false'}"
      >
        Download
      </button>

      <button
        class="nav-btn ${isRouteActive('search') ? 'active' : ''}"
        data-route="search"
        aria-current="${isRouteActive('search') ? 'page' : 'false'}"
      >
        Search
      </button>

      <button
        class="nav-btn ${isRouteActive('help') ? 'active' : ''}"
        data-route="help"
        aria-current="${isRouteActive('help') ? 'page' : 'false'}"
      >
        Help
      </button>
    </nav>
    </div>
  </div>`;
}


function getSequenceIdFromHash() {
  const hash = window.location.hash || '';
  const [, queryString = ''] = hash.split('?');
  const params = new URLSearchParams(queryString);
  return params.get('sequenceId');
}

function getPdbNameFromHash() {
  const hash = window.location.hash || '';
  const [, queryString = ''] = hash.split('?');
  const params = new URLSearchParams(queryString);
  return params.get('pdbName');
}

function getTechnologySlugFromHash() {
  const hash = window.location.hash || '';
  const [, queryString = ''] = hash.split('?');
  const params = new URLSearchParams(queryString);
  return params.get('tech');
}

function getCaseIdFromHash() {
  const hash = window.location.hash || '';
  const [, queryString = ''] = hash.split('?');
  const params = new URLSearchParams(queryString);
  return params.get('case');
}

function getStructureRecordIdFromHash() {
  const hash = window.location.hash || '';
  const [, queryString = ''] = hash.split('?');
  const params = new URLSearchParams(queryString);
  return params.get('foldBridgeId');
}

function getFilteredSequenceRows() {
  const query = sequenceSearchQuery.trim().toLowerCase();
  if (!query) return sequenceRows;
  return sequenceRows.filter((row) =>
    [
      row.sequenceName,
      row.aptamerName,
      row.category,
      row.type,
      row.chemicalProbing,
      row.pdbName,
      row.article,
      row.sequence
    ].some((value) => String(value ?? '').toLowerCase().includes(query))
  );
}

function renderColoredSequence(sequence, { forceUppercaseDisplay = false } = {}) {
  return String(sequence ?? '')
    .split('')
    .map((char) => {
      const upper = char.toUpperCase();
      if (!'AUGCT'.includes(upper)) return char;
      const cls = upper === 'T' ? 'nucleotide-u' : `nucleotide-${upper.toLowerCase()}`;
      const displayChar = forceUppercaseDisplay ? upper : char;
      const display = upper === 'T' ? 'U' : displayChar;
      return `<span class="sequence-nucleotide ${cls}">${display}</span>`;
    })
    .join('');
}

function renderFormattedDetailSequence(sequence, groupSize = 5, options = {}) {
  const cleanSequence = String(sequence ?? '').replace(/\s+/g, '').trim();
  if (!cleanSequence) return 'Sequence unavailable';

  const safeGroupSize = Math.max(1, Number(groupSize) || 5);
  const groups = [];
  for (let index = 0; index < cleanSequence.length; index += safeGroupSize) {
    groups.push(cleanSequence.slice(index, index + safeGroupSize));
  }

  const groupedMarkup = groups
    .map((group) => `<span class="case-sequence-group">${renderColoredSequence(group, options)}</span>`)
    .join('');

  return `<span class="case-sequence-direction">5′-</span>${groupedMarkup}<span class="case-sequence-direction">-3′</span>`;
}

function splitTextIntoChunks(text, chunkSize = 120) {
  const cleanText = String(text ?? '').replace(/\s+/g, '').trim();
  if (!cleanText) return [];

  const safeChunkSize = Math.max(1, Number(chunkSize) || 120);
  const chunks = [];
  for (let index = 0; index < cleanText.length; index += safeChunkSize) {
    chunks.push(cleanText.slice(index, index + safeChunkSize));
  }
  return chunks;
}

function renderAlignedSequenceStructure(sequence, structure = '') {
  const cleanSequence = String(sequence ?? '').replace(/\s+/g, '').trim();
  const cleanStructure = String(structure ?? '').replace(/\s+/g, '').trim();
  const chunkSize = 120;

  if (!cleanSequence) return 'Sequence unavailable';
  if (!cleanStructure || cleanStructure.length !== cleanSequence.length) {
    return cleanStructure || '';
  }

  const chunks = splitTextIntoChunks(cleanStructure, chunkSize);
  const chars = chunks
    .map((chunk) => {
      const chunkChars = chunk
        .split('')
        .map((structureChar) => `<span class="case-sequence-structure-char">${structureChar}</span>`)
        .join('');
      return `<span class="case-sequence-row case-sequence-structure-row">${chunkChars}</span>`;
    })
    .join('');

  return `<span class="case-sequence-structure-wrap" aria-label="RNA secondary structure in dot-bracket notation">${chars}</span>`;
}

function sequenceHasLowercaseAnnotation(sequence) {
  return /[a-z]/.test(String(sequence ?? ''));
}

function renderSequenceDetailTimeline() {
  const items = ['2004', '2009', '2013']
    .map((year) => `<article class="sequence-detail-timeline-item">
      <time>${year}</time>
      <div class="sequence-detail-timeline-card">
        <p>xxx</p>
      </div>
    </article>`)
    .join('');

  return `<section class="sequence-detail-panel sequence-detail-timeline-panel">
    <h2>Timeline</h2>
    <div class="sequence-detail-timeline">
      ${items}
    </div>
  </section>`;
}

function renderSequenceDetailFornaPanel() {
  return `<section class="sequence-secondary-card sequence-secondary-forna-card">
    <div class="sequence-detail-forna-copy">
      <h3>RNA Secondary Structure Viewer (Forna)</h3>
      <p>Forna module with custom nucleotide colors (aptamer-style).</p>
    </div>
    <div class="sequence-detail-forna-frame">
      <div class="sequence-detail-forna-host" aria-label="Blank Forna secondary structure viewer"></div>
    </div>
    <p class="sequence-detail-forna-note">Secondary structure viewer reserved for future rendering.</p>
  </section>`;
}

function renderSequenceDetailSecondaryContent(row) {
  if (row.pdbName === '8QO5') {
    return `<div class="sequence-secondary-layout">
      <div class="sequence-secondary-top">
        <div class="sequence-secondary-block">
          <span class="sequence-secondary-label">Sequence</span>
          <code class="sequence-secondary-code">${row.type ?? ''}</code>
        </div>
        <div class="sequence-secondary-block">
          <span class="sequence-secondary-label">Structure</span>
          <code class="sequence-secondary-code">${row.structureText ?? ''}</code>
        </div>
      </div>

      <section class="sequence-secondary-card sequence-secondary-figure-card">
        <div class="sequence-secondary-card-header">
          <h3>Secondary Structure Diagram</h3>
          <span class="mini-note">Annotated structure for the conserved SL5 region.</span>
        </div>
        <img
          class="sequence-secondary-image"
          src="./src/assets/references/8QO5-secondary-structure.png"
          alt="Secondary structure diagram for SARS-CoV-2-SL5"
        />
      </section>

      ${renderSequenceDetailFornaPanel()}
    </div>`;
  }

  if (row.pdbName !== '5KPY' && row.pdbName !== '1AM0' && row.pdbName !== '4L81' && row.pdbName !== '5TPY') {
    return `<div class="sequence-detail-placeholder">
      <p>Secondary structure content will be added here.</p>
    </div>`;
  }

  const is5kpy = row.pdbName === '5KPY';
  const is1am0 = row.pdbName === '1AM0';
  const is4l81 = row.pdbName === '4L81';
  const structureText = is5kpy
    ? '.......................................................................'
    : is1am0
      ? '((((((...........((((((....)))))).))))))'
      : is4l81
        ? '................................................................................................'
        : '....(((((((((....)))).(((((((.[[[[..)))))))..)))))...]]]](((((....)))))';
  const heatmapTitle = is5kpy ? 'Mutate-and-map Heatmap' : is1am0 ? 'ATP Titration Reactivity Map' : 'Mutate-and-map Heatmap';
  const rdatUrl = is5kpy
    ? './src/assets/data/RNAPZ9_1M7_0001.rdat'
    : is1am0
      ? './src/assets/data/ATPCON_TITR_0001.rdat'
      : is4l81
        ? './src/assets/data/RNAPZ8_1M7_0001.rdat'
        : './src/assets/data/RNAPZ18_1M7_0000.rdat';
  const summaryMarkup = is5kpy
    ? `<div><dt>Dataset</dt><dd>RNA Puzzle 9</dd></div>
          <div><dt>Modifier</dt><dd>SHAPE</dd></div>
          <div><dt>Ligand</dt><dd>5-hydroxytryptophan (8.5 mM)</dd></div>
          <div><dt>Buffer</dt><dd>50 mM Na-HEPES, pH 8.0</dd></div>
          <div><dt>MgCl2</dt><dd>10 mM</dd></div>
          <div><dt>Temperature</dt><dd>24 C</dd></div>`
    : is1am0
      ? `<div><dt>Dataset</dt><dd>control point ATP titration</dd></div>
          <div><dt>Assay</dt><dd>StandardState</dd></div>
          <div><dt>Ligand</dt><dd>ATP titration (0-5000 uM)</dd></div>
          <div><dt>Buffer</dt><dd>50 mM Na-HEPES, pH 8.0</dd></div>
          <div><dt>Temperature</dt><dd>24 C</dd></div>
          <div><dt>Processing</dt><dd>background subtraction, overmodification correction</dd></div>`
      : is4l81
        ? `<div><dt>Dataset</dt><dd>RNA Puzzle 8</dd></div>
          <div><dt>Modifier</dt><dd>SHAPE</dd></div>
          <div><dt>Ligand</dt><dd>S-adenosylmethionine (8.8 mM)</dd></div>
          <div><dt>Buffer</dt><dd>50 mM Na-HEPES, pH 8.0</dd></div>
          <div><dt>MgCl2</dt><dd>10 mM</dd></div>
          <div><dt>Temperature</dt><dd>24 C</dd></div>`
        : `<div><dt>Dataset</dt><dd>RNA Puzzle 18</dd></div>
          <div><dt>Experiment Type</dt><dd>Mutate and Map</dd></div>
          <div><dt>Modifier</dt><dd>1M7</dd></div>
          <div><dt>Buffer</dt><dd>50 mM Na-HEPES, pH 8.0</dd></div>
          <div><dt>MgCl2</dt><dd>10 mM</dd></div>
          <div><dt>Temperature</dt><dd>24 C</dd></div>
          <div><dt>Processing</dt><dd>background subtraction, overmodification correction, normalization GAGUA</dd></div>`;
  const filesMarkup = is5kpy
    ? `<a class="sequence-secondary-link" href="./src/assets/data/RNAPZ9_1M7_0001.rdat" download>Download RDAT</a>`
    : is1am0
      ? `<a class="sequence-secondary-link" href="./src/assets/data/ATPCON_TITR_0001.rdat" download>Download RDAT</a>
       <a class="sequence-secondary-link" href="./src/assets/data/ATPCON_TITR_0001_2.xls" download>Download XLS</a>`
      : is4l81
        ? `<a class="sequence-secondary-link" href="./src/assets/data/RNAPZ8_1M7_0001.rdat" download>Download RDAT</a>
       <a class="sequence-secondary-link" href="./src/assets/data/RNAPZ8_1M7_0001_2.xls" download>Download XLS</a>`
        : `<a class="sequence-secondary-link" href="./src/assets/data/RNAPZ18_1M7_0000.rdat" download>Download RDAT</a>
       <a class="sequence-secondary-link" href="./src/assets/data/RNAPZ18_1M7_0000_1.xls" download>Download XLS</a>`;
  const footnoteText = is5kpy
    ? 'The local RDAT file is included in this project for future heatmap or reactivity visualization work.'
    : is1am0
      ? 'The local RDAT and XLS files are included in this project as source data for the ATP-responsive aptamer record.'
      : is4l81
        ? 'The local RDAT and XLS files are included in this project as source data for the SAM-responsive aptamer record.'
        : 'The local RDAT and XLS files are included in this project as source data for the RNA Puzzle 18 record.';

  return `<div class="sequence-secondary-layout">
    <div class="sequence-secondary-top">
      <div class="sequence-secondary-block">
        <span class="sequence-secondary-label">Sequence</span>
        <code class="sequence-secondary-code">${row.type ?? ''}</code>
      </div>
      <div class="sequence-secondary-block">
        <span class="sequence-secondary-label">Structure</span>
        <code class="sequence-secondary-code">${structureText}</code>
      </div>
    </div>

    <div class="sequence-secondary-bottom">
      <div class="sequence-secondary-main">
      <section class="sequence-secondary-card sequence-secondary-heatmap-card">
        <div class="sequence-secondary-card-header">
          <h3>${heatmapTitle}</h3>
          <span id="sequence-secondary-heatmap-status" class="mini-note">Loading heatmap…</span>
        </div>
        <div
          id="sequence-secondary-heatmap"
          class="sequence-secondary-heatmap-host"
          data-rdat-url="${rdatUrl}"
          data-sequence="${(sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
        ></div>
      </section>

      ${renderSequenceDetailFornaPanel()}
      </div>

      <aside class="sequence-secondary-side">
      <div class="sequence-secondary-card">
        <h3>Experiment Summary</h3>
        <dl class="sequence-secondary-meta">
          ${summaryMarkup}
        </dl>
      </div>

      <div class="sequence-secondary-card">
        <h3>Files</h3>
        <div class="sequence-secondary-actions">
          ${filesMarkup}
        </div>
        <p class="sequence-secondary-footnote">${footnoteText}</p>
      </div>
      </aside>
    </div>
  </div>`;
}

function renderSequenceDetailTertiaryContent(row) {
  if (!row.structureFile) {
    return `<div class="sequence-detail-placeholder">
      <p>Tertiary structure content will be added here.</p>
    </div>`;
  }

  return `<div class="sequence-detail-media">
    <div id="sequence-detail-molstar-status" class="mini-note">Loading interactive 3D structure…</div>
    <div
      id="sequence-detail-molstar"
      class="sequence-detail-viewer"
      data-structure-url="./${row.structureFile}"
      data-structure-format="cif"
      data-structure-label="${row.pdbName ?? 'local structure'}"
      data-structure-sequence="${row.type ?? ''}"
    ></div>
  </div>`;
}

function getHomeSecondaryStructureMarkup(row) {
  const structureMap = {
    '8QO5': {
      image: './src/assets/references/8QO5-secondary-structure.png',
      alt: 'Secondary structure diagram for SARS-CoV-2-SL5',
      structure: row.structureText || '. . . . . . ( ( ( ( ( . ( ( ( ( ( . . . . ) ) ) ) ) . . ) ) ) ) ) . . . . . .'
    },
    '5KPY': {
      image: './src/assets/references/5KPY-secondary-heatmap.png',
      alt: 'Reference secondary map for 5-hydroxytryptophan RNA aptamer',
      structure: '.......................................................................'
    },
    '1AM0': {
      structure: '((((((...........((((((....)))))).))))))'
    },
    '4L81': {
      structure: '................................................................................................'
    },
    '5TPY': {
      structure: '....(((((((((....)))).(((((((.[[[[..)))))))..)))))...]]]](((((....)))))'
    }
  };

  const entry = structureMap[row.pdbName] || {};
  const structure = entry.structure || row.structureText || 'Secondary structure preview will be added here.';

  return `
    <div class="home-secondary-panel">
      <div class="home-secondary-header">
        <h3>Secondary Structure</h3>
        <span class="mini-note">${row.pdbName || 'N/A'}</span>
      </div>
      ${entry.image ? `
        <div class="home-secondary-figure-wrap">
          <img class="home-secondary-image" src="${entry.image}" alt="${entry.alt || 'Secondary structure preview'}" />
        </div>
      ` : `
        <div class="home-secondary-code-wrap">
          <span class="home-secondary-label">Dot-bracket preview</span>
          <code class="home-secondary-code">${structure}</code>
        </div>
      `}
      <div class="home-secondary-sequence">
        <span class="home-secondary-label">Sequence</span>
        <code class="home-secondary-code">${row.type ?? ''}</code>
      </div>
    </div>
  `;
}

function renderSequenceDetailReferenceContent(row) {
  if (row.pdbName === '8QO5') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item">
          <h3>[1] Conserved structures and dynamics in 5'-proximal regions of Betacoronavirus RNA genomes.</h3>
          <p class="sequence-detail-reference-authors">de Moura, T.R., Purta, E., Bernat, A., Martin-Cuevas, E.M., Kurkowska, M., Baulin, E.F., Mukherjee, S., Nowak, J., Biela, A.P., Rawski, M., Glatt, S., Moreno-Herrero, F., Bujnicki, J.M. (2024)</p>
          <p class="sequence-detail-reference-source">Nucleic Acids Research 52:3419-3432</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/38426934/" target="_blank" rel="noopener noreferrer">PubMed: 38426934</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1093/nar/gkae144" target="_blank" rel="noopener noreferrer">DOI: 10.1093/nar/gkae144</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item">
          <h3>[2] RCSB PDB entry 8QO5: SARS-CoV-2 SL5 structure model.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/8QO5" target="_blank" rel="noopener noreferrer">RCSB: 8QO5</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb8QO5/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb8QO5/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row.pdbName === '5KPY') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item">
          <h3>[1] RNA-Puzzles Round IV: 3D structure predictions of four ribozymes and two aptamers.</h3>
          <p class="sequence-detail-reference-authors">Miao Z, Adamiak RW, Antczak M, Boniecki MJ, Bujnicki J, Chen SJ, Cheng CY, Cheng Y, Chou FC, Das R, Dokholyan NV, Ding F, Geniesse C, Jiang Y, Joshi A, Krokhotin A, Magnus M, Mailhot O, Major F, Mann TH, Piatkowski P, Pluta R, Popenda M, Sarzynska J, Sun L, Szachniuk M, Tian S, Wang J, Wang J, Watkins AM, Wiedemann J, Xiao Y, Xu X, Yesselman JD, Zhang D, Zhang Y, Zhang Z, Zhao C, Zhao P, Zhou Y, Zok T, Zyla A, Ren A, Batey RT, Golden BL, Huang L, Lilley DM, Liu Y, Patel DJ, Westhof E. (2020)</p>
          <p class="sequence-detail-reference-source">RNA (New York, N.Y.) 26(8):982-995</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/32371455/" target="_blank" rel="noopener noreferrer">PMID: 32371455</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1261/rna.075341.120" target="_blank" rel="noopener noreferrer">DOI: 10.1261/rna.075341.120</a>
          </div>
        </article>

        <article class="sequence-detail-reference-item">
          <h3>[2] Recurrent RNA motifs as scaffolds for genetically encodable small-molecule biosensors.</h3>
          <p class="sequence-detail-reference-authors">Porter, E.B., Polaski, J.T., Morck, M.M., Batey, R.T. (2017)</p>
          <p class="sequence-detail-reference-source">Nature Chemical Biology 13:295-301</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/28092358/" target="_blank" rel="noopener noreferrer">PubMed: 28092358</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/nchembio.2278" target="_blank" rel="noopener noreferrer">DOI: 10.1038/nchembio.2278</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item">
          <h3>[3] RCSB PDB entry 5KPY: 5-HTP RNA aptamer structure.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/5KPY" target="_blank" rel="noopener noreferrer">RCSB: 5KPY</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb5KPY/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb5KPY/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row.pdbName === '1AM0') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item">
          <h3>[1] Computational design of three-dimensional RNA structure and function.</h3>
          <p class="sequence-detail-reference-authors">Yesselman JD, Eiler D, Carlson ED, Gotrik MR, d'Aquino AE, Ooms AN, Kladwang W, Carlson PD, Shi X, Costantino DA, Herschlag D, Lucks JB, Jewett MC, Kieft JS, Das R. (2019)</p>
          <p class="sequence-detail-reference-source">Nature Nanotechnology 14(9):866-873</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/31427748/" target="_blank" rel="noopener noreferrer">PMID: 31427748</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/s41565-019-0517-8" target="_blank" rel="noopener noreferrer">DOI: 10.1038/s41565-019-0517-8</a>
          </div>
        </article>

        <article class="sequence-detail-reference-item">
          <h3>[2] Structural Basis of RNA Folding and Recognition in an AMP-RNA Aptamer Complex.</h3>
          <p class="sequence-detail-reference-authors">Jiang, F., Kumar, R.A., Jones, R.A., Patel, D.J. (1996)</p>
          <p class="sequence-detail-reference-source">Nature 382:183-186</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/8700212/" target="_blank" rel="noopener noreferrer">PubMed: 8700212</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/382183a0" target="_blank" rel="noopener noreferrer">DOI: 10.1038/382183a0</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item">
          <h3>[3] RCSB PDB entry 1AM0: AMP-RNA aptamer complex.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/1AM0" target="_blank" rel="noopener noreferrer">RCSB: 1AM0</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb1AM0/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb1AM0/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row.pdbName === '4L81') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item">
          <h3>[1] RNA-Puzzles Round III: 3D RNA structure prediction of five riboswitches and one ribozyme.</h3>
          <p class="sequence-detail-reference-authors">Miao Z, Adamiak RW, Antczak M, Batey RT, Becka AJ, Biesiada M, Boniecki MJ, Bujnicki JM, Chen SJ, Cheng CY, Chou FC, Ferre-D'Amare AR, Das R, Dawson WK, Ding F, Dokholyan NV, Dunin-Horkawicz S, Geniesse C, Kappel K, Kladwang W, Krokhotin A, Lach GE, Major F, Mann TH, Magnus M, Pachulska-Wieczorek K, Patel DJ, Piccirilli JA, Popenda M, Purzycka KJ, Ren A, Rice GM, Santalucia J Jr, Sarzynska J, Szachniuk M, Tandon A, Trausch JJ, Tian S, Wang J, Weeks KM, Williams B 2nd, Xiao Y, Xu X, Zhang D, Zok T, Westhof E. (2017)</p>
          <p class="sequence-detail-reference-source">RNA (New York, N.Y.) 23(5):655-672</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/28138060/" target="_blank" rel="noopener noreferrer">PMID: 28138060</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1261/rna.060368.116" target="_blank" rel="noopener noreferrer">DOI: 10.1261/rna.060368.116</a>
          </div>
        </article>

        <article class="sequence-detail-reference-item">
          <h3>[2] Structural basis for diversity in the SAM clan of riboswitches.</h3>
          <p class="sequence-detail-reference-authors">Trausch, J.J., Xu, Z., Edwards, A.L., Reyes, F.E., Ross, P.E., Knight, R., Batey, R.T. (2014)</p>
          <p class="sequence-detail-reference-source">Proceedings of the National Academy of Sciences of the United States of America 111:6624-6629</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/24753586/" target="_blank" rel="noopener noreferrer">PubMed: 24753586</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1073/pnas.1312918111" target="_blank" rel="noopener noreferrer">DOI: 10.1073/pnas.1312918111</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item">
          <h3>[3] RCSB PDB entry 4L81: SAM I/IV variant riboswitch aptamer domain.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/4L81" target="_blank" rel="noopener noreferrer">RCSB: 4L81</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb4L81/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb4L81/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row.pdbName === '5TPY') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item">
          <h3>[1] Zika virus produces noncoding RNAs using a multi-pseudoknot structure that confounds a cellular exonuclease.</h3>
          <p class="sequence-detail-reference-authors">Akiyama, B.M., Laurence, H.M., Massey, A.R., Costantino, D.A., Xie, X., Yang, Y., Shi, P.Y., Nix, J.C., Beckham, J.D., Kieft, J.S. (2016)</p>
          <p class="sequence-detail-reference-source">Science 354:1148-1152</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/27934765/" target="_blank" rel="noopener noreferrer">PubMed: 27934765</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1126/science.aah3963" target="_blank" rel="noopener noreferrer">DOI: 10.1126/science.aah3963</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item">
          <h3>[2] RCSB PDB entry 5TPY: Crystal structure of an exonuclease resistant RNA from Zika virus.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/5TPY" target="_blank" rel="noopener noreferrer">RCSB: 5TPY</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb5TPY/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb5TPY/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  return `<div class="sequence-detail-reference-card">
    <p>This tertiary structure is based on the PDB entry <strong>${row.pdbName ?? ''}</strong>.</p>
    <div class="sequence-detail-reference-links">
      <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/${encodeURIComponent(row.pdbName ?? '')}" target="_blank" rel="noopener noreferrer">RCSB: ${row.pdbName ?? ''}</a>
      <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb${encodeURIComponent(row.pdbName ?? '')}/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb${row.pdbName ?? ''}/pdb</a>
    </div>
  </div>`;
}

function normalizeRecordTitle(value) {
  return String(value ?? '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderReferenceCard(items) {
  return `<div class="sequence-detail-reference-card">
    <div class="sequence-detail-reference-list">
      ${items.join('')}
    </div>
  </div>`;
}

function renderReferenceItem({ index, title, authors, source, links }) {
  return `<article class="sequence-detail-reference-item" id="reference-${index}">
    <h3>[${index}] ${title}</h3>
    <p class="sequence-detail-reference-authors">${authors}</p>
    <p class="sequence-detail-reference-source">${source}</p>
    <div class="sequence-detail-reference-links">
      ${links.join('')}
    </div>
  </article>`;
}

function renderReferenceLink(label, href) {
  return `<a class="sequence-detail-reference-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function inferRmdbReferenceFamily(row) {
  const id = String(row?.foldBridgeId ?? '');
  if (!id.startsWith('RMDB_') && !id.startsWith('RASP_')) return '';
  if (id.startsWith('RMDB_RNAPZ')) return 'rnaPuzzle';
  if (/^(?:RMDB|RASP)_(?:ETERNA|OK7BLIB|PDB130|POS240|PSEUDOB|RSTRND)/.test(id)) return 'designLibrary';
  if (/^RMDB_TRP4P6_/.test(id)) return 'p4p6';
  if (id === 'RMDB_RNASEP_1M7_0001') return 'inCellShapeSeq';
  if (id === 'RMDB_SRPECLI_BZCN_0001') return 'coTransShapeSeq';
  if (/^(?:RMDB|RASP)_(?:CIDGMP|SAMRSW|TRNAPH)/.test(id)) return 'shapeSeq20';
  if (id.startsWith('RASP_')) return 'raspGeneric';
  return 'rmdbGeneric';
}

function renderGenericRmdbDescription(row) {
  const title = normalizeRecordTitle(row?.name || row?.foldBridgeId || 'This RMDB entry');
  const pdbId = String(row?.pdbName || row?.bestPdbId || '').toUpperCase();
  const family = inferRmdbReferenceFamily(row);
  const pdbClause = pdbId ? ` represented here by PDB entry ${pdbId}` : '';
  const superScript = pdbId
    ? `<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`
    : `<sup><a href="/" data-scroll-target="references">[1]</a></sup>`;

  if (family === 'rnaPuzzle') {
    return `${title} is an RMDB record associated with an RNA-Puzzles community blind-prediction target. The bundled chemical mapping data provide an experimental constraint set or comparison point for a difficult tertiary fold, and FoldBridge links that record to the matched solved structure${pdbClause}.${superScript}`;
  }

  if (family === 'designLibrary') {
    return `${title} is a pooled design or benchmark-library RMDB entry rather than a single classical biological transcript. Its RDAT package stores high-throughput chemical mapping data for representative synthetic or benchmark sequences, and FoldBridge uses the matched target to connect that screen to the resolved tertiary structure${pdbClause}.${superScript}`;
  }

  if (family === 'p4p6') {
    return `${title} is a probing record for the Tetrahymena group I intron P4-P6 domain, a classic model system for RNA tertiary folding. Depending on the modifier used in this RMDB entry, the RDAT captures hydroxyl-radical, DMS, or CMCT accessibility across a construct that FoldBridge matches to the resolved P4-P6 architecture${pdbClause}.${superScript}`;
  }

  if (family === 'inCellShapeSeq') {
    return `${title} is an in-cell SHAPE-Seq RMDB record measured directly in <em>E. coli</em>, giving a cellular reactivity snapshot for the specificity-region fragment shown on this page. FoldBridge pairs that endogenous probing profile with the matched tertiary-structure target${pdbClause}, so the entry can be read as a bridge between cellular accessibility and an experimentally resolved RNA fold.${superScript}`;
  }

  if (family === 'coTransShapeSeq') {
    return `${title} is a cotranscriptional SHAPE-Seq RMDB record that emphasizes folding during transcription rather than after a separate refolding step. In FoldBridge, that pathway-sensitive chemical probing profile is linked to the matched resolved tertiary structure${pdbClause}, providing a useful comparison between kinetic accessibility and a structural endpoint.${superScript}`;
  }

  if (family === 'shapeSeq20') {
    return `${title} is a SHAPE-Seq 2.0 probing entry archived in RMDB under the packaged buffer and ligand conditions. For these records the curated STRUCTURE field may be intentionally left undefined, so the page should be interpreted primarily as an experimental reactivity profile that FoldBridge connects to the matched tertiary structure${pdbClause}.${superScript}`;
  }

  if (family === 'raspGeneric') {
    return `${title} is a transcript-level structure-probing record from RASP (RNA Atlas of Structure Probing), a curated repository of high-throughput transcriptome-wide RNA secondary structure profiles. FoldBridge links this experimental reactivity snapshot to the matched resolved tertiary structure${pdbClause}, bridging cellular or in vitro chemical accessibility with its spatial fold.${superScript}`;
  }

  return `${title} is an RMDB chemical probing record linked in FoldBridge to the matched tertiary structure${pdbClause}. This page is intended as a bridge between the archived RDAT experiment and the resolved or matched structural model used for comparison.${superScript}`;
}

function renderGenericRmdbReferenceContent(row) {
  const pdbId = String(row?.pdbName || row?.bestPdbId || '').toUpperCase();
  const family = inferRmdbReferenceFamily(row);
  const pdbTitle = pdbId
    ? `RCSB PDB entry ${pdbId}: matched tertiary-structure record used for this FoldBridge page.`
    : '';
  const pdbAuthors = 'RCSB Protein Data Bank structure record for the tertiary model linked to this RMDB entry.';
  const pdbSource = 'RCSB PDB / wwPDB structure record';
  const pdbLinks = [];
  if (pdbId) {
    pdbLinks.push(renderReferenceLink(`RCSB: ${pdbId}`, `https://www.rcsb.org/structure/${encodeURIComponent(pdbId)}`));
    pdbLinks.push(renderReferenceLink(`PDB DOI: 10.2210/pdb${pdbId}/pdb`, `https://doi.org/10.2210/pdb${pdbId}/pdb`));
  }

  const templates = {
    rnaPuzzle: {
      title: 'RNA-Puzzles toolkit: a computational resource of RNA 3D structure benchmark datasets, structure manipulation, and evaluation tools.',
      authors: 'Magnus M, Antczak M, Zok T, Wiedemann J, Lukasiak P, Cao Y, Bujnicki JM, Westhof E, Szachniuk M, Miao Z. (2016)',
      source: 'Nucleic Acids Research 48(2):576-588',
      pmid: '31799609',
      doi: '10.1093/nar/gkz1108'
    },
    designLibrary: {
      title: 'RNA design rules from a massive open laboratory.',
      authors: 'Lee J, Kladwang W, Lee M, Cantu D, Azizyan M, Kim H, Limpaecher A, Yoon S, Treuille A, Das R, EteRNA Participants. (2014)',
      source: 'Proceedings of the National Academy of Sciences 111(6):2122-2127',
      pmid: '24469816',
      doi: '10.1073/pnas.1313039111'
    },
    p4p6: {
      title: 'Crystal structure of a group I ribozyme domain: principles of RNA packing.',
      authors: 'Cate JH, Gooding AR, Podell E, Zhou K, Golden BL, Kundrot CE, Cech TR, Doudna JA. (1996)',
      source: 'Science 273(5282):1678-1685',
      pmid: '8781224',
      doi: '10.1126/science.273.5282.1678'
    },
    inCellShapeSeq: {
      title: 'Simultaneous Characterization of Cellular RNA Structure and Function with in-cell SHAPE-Seq.',
      authors: 'Watters KE, Abbott TR, Lucks JB. (2016)',
      source: 'Nucleic Acids Research 44(2):e12',
      pmid: '26350218',
      doi: '10.1093/nar/gkv879'
    },
    coTransShapeSeq: {
      title: 'Cotranscriptional Folding of a Riboswitch at Nucleotide Resolution.',
      authors: 'Watters KE, Strobel EJ, Yu AM, Lis JT, Lucks JB. (2016)',
      source: 'Nature Structural & Molecular Biology 23(12):1124-1131',
      pmid: '27798597',
      doi: '10.1038/nsmb.3316'
    },
    shapeSeq20: {
      title: 'SHAPE-Seq 2.0: systematic optimization and extension of high-throughput chemical probing of RNA secondary structure with next generation sequencing.',
      authors: 'Loughrey D, Watters KE, Settle AH, Lucks JB. (2014)',
      source: 'Nucleic Acids Research 42(21):e165',
      pmid: '25303992',
      doi: '10.1093/nar/gku909'
    },
    raspGeneric: {
      title: 'RASP: an atlas of transcriptome-wide RNA secondary structure probing data.',
      authors: 'Li P, Chang Y, Wei Y, Zhang Q, Zhao W, Zhang S, Zhang QC. (2021)',
      source: 'Nucleic Acids Research 49(D1):D222-D231',
      pmid: '33174984',
      doi: '10.1093/nar/gkaa1052'
    },
    rmdbGeneric: {
      title: 'Characterizing RNA structures in vitro and in vivo with selective 2\'-hydroxyl acylation analyzed by primer extension sequencing (SHAPE-Seq).',
      authors: 'Watters KE, Yu AM, Strobel EJ, Settle AH, Lucks JB. (2016)',
      source: 'Methods 103:34-48',
      pmid: '27064082',
      doi: '10.1016/j.ymeth.2016.04.002'
    }
  };

  const template = templates[family] || templates.rmdbGeneric;
  const items = [
    renderReferenceItem({
      index: 1,
      title: template.title,
      authors: template.authors,
      source: template.source,
      links: [
        renderReferenceLink(`PubMed: ${template.pmid}`, `https://pubmed.ncbi.nlm.nih.gov/${template.pmid}/`),
        renderReferenceLink(`DOI: ${template.doi}`, `https://doi.org/${template.doi}`)
      ]
    })
  ];

  if (pdbId) {
    items.push(
      renderReferenceItem({
        index: 2,
        title: pdbTitle,
        authors: pdbAuthors,
        source: pdbSource,
        links: pdbLinks
      })
    );
  }

  return renderReferenceCard(items);
}

function renderStructureDetailDescription(row) {
  if (row?.foldBridgeId === 'RMDB_ATTR03_DMS_0001') {
    return `ATP-TTR 3 is a computer-designed ATP-binding RNA aptamer reported within the Ribosolve workflow for RNA-only three-dimensional structure determination. The apo-state ATP-TTR-3 model was resolved as PDB entry 6WLK and was used as part of a benchmark set for evaluating accelerated cryo-EM-guided RNA structure modeling and comparison across apo and ligand-bound states.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ18_1M7_0000') {
    return `RNA Puzzle 18 corresponds to a Zika virus exonuclease-resistant RNA (xrRNA), a structured noncoding RNA element that promotes production of subgenomic flaviviral RNAs by blocking host exonuclease degradation. Its experimentally solved tertiary structure, represented by PDB entry 5TPY, revealed a compact multi-pseudoknot architecture that underlies exonuclease resistance and supports functional studies of flaviviral RNA biology.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_ATPCON_DMS_0001') {
    return `ATP control is a compact ATP-binding RNA aptamer used as a reference system for RNA structure probing and tertiary-structure analysis. Its experimentally determined structure is represented by PDB entry 1AM0, which captures the AMP-bound aptamer fold and has been widely used as a benchmark for RNA folding, ligand recognition, and RNA design studies. In this context, the ATP control construct provides a small, well-characterized model for comparing chemical probing signals with an established tertiary architecture.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_ADDSC_1M7_0007') {
    return `add Adenine Riboswitch, <em>Vibrio vulnificus</em> is an adenine-sensing bacterial riboswitch aptamer profiled here by 1M7 SHAPE-Seq v2.0 under standard-state conditions. The RMDB record notes that all replicates were probed in the presence of 1 uM adenine, making this entry a ligand-bound probing snapshot that can be compared against the matched tertiary structure represented by PDB entry 1Y26. Together, the chemical probing profile and the crystallographic model provide a compact reference for adenine recognition and local fold organization in the <em>add</em> riboswitch family.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_GLYCFN_KNK_0001') {
    return `glycine riboswitch, <em>Fusobacterium nucleatum</em> is a double glycine riboswitch construct used to test whether the inter-aptamer linker contains an additional structured element beyond the previously truncated core aptamers. In the packaged RDAT, this 205 nt RNA was profiled by multiple chemical probing conditions, and the lowercase flanking bases mark auxiliary sequence context included to preserve the native linker architecture. The matched tertiary structure, represented here by PDB entry 6WLM, makes this record a useful reference for comparing chemical reactivity with the kink-turn-containing linker model proposed for cooperative glycine sensing.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a>, <a href="/" data-scroll-target="references">[3]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_TPPSC_1M7_0005') {
    return `TPP Riboswitch is an <em>E. coli</em> thiamine pyrophosphate (TPP) riboswitch construct profiled by SHAPE-Seq to measure how the ligand-sensing RNA folds across its aptamer and expression-platform regions. TPP riboswitches directly bind the coenzyme thiamine pyrophosphate and regulate bacterial gene expression through metabolite-dependent structural rearrangements, making this record a compact model for comparing chemical probing reactivity with a well-studied riboswitch architecture.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a>, <a href="/" data-scroll-target="references">[3]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_SAMRSW_1M7_0001') {
    return `SAM I riboswitch, <em>T. tengcongensis</em> is a SHAPE-Seq 2.0 1M7 probing record collected for a SAM-bound SAM-I riboswitch aptamer under the packaged ligand and buffer conditions. The bundled RDAT intentionally leaves the curated STRUCTURE field as all dots, so this entry is best interpreted as an experimental reactivity profile linked to the matched SAM-I riboswitch tertiary architecture represented here by PDB entry 4KQY. In FoldBridge, it serves as a probing-to-structure example for comparing ligand-dependent chemical reactivity with a well-characterized SAM-I riboswitch fold.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a>, <a href="/" data-scroll-target="references">[3]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_16SFWJ_1M7_0001') {
    return `16S rRNA Four-Way Junction is a mutate-and-map 1M7 probing benchmark derived from a structured bacterial 16S ribosomal RNA junction domain. The packaged RDAT includes a curated dot-bracket annotation together with systematic single-nucleotide mutation measurements, making this entry a compact example of how perturbation-guided chemical mapping can sharpen secondary-structure inference in noncoding RNAs. In FoldBridge, the record links that benchmark probing dataset to a matched tertiary-structure fragment, providing a useful reference for comparing reactivity-guided modeling with an experimentally resolved RNA junction architecture.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a>, <a href="/" data-scroll-target="references">[3]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_TRP4P6_HRF_0003') {
    return `RMDB_TRP4P6_HRF_0003 is a hydroxyl-radical footprinting dataset for the P4-P6 domain of the <em>Tetrahymena</em> group I intron, one of the classic model RNAs for tertiary folding studies. The bundled RDAT contains a Mg<sup>2+</sup> titration series collected in a 2 M NaCl background, so the experimental signal can be read as a step-by-step view of which parts of P4-P6 become protected as the metal-ion core folds. FoldBridge links that footprinting series to the solved P4-P6 tertiary structure in PDB entry 1GID, making this page a straightforward comparison between folding-dependent protection and the final RNA architecture.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a>, <a href="/" data-scroll-target="references">[3]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ10_STD_0001') {
    return `RNA Puzzle 10 corresponds to the T-box riboswitch stem I in complex with tRNA, a biological RNA-RNA complex structure. The tertiary structure is represented by PDB entry 4TZZ, which captures the complex containing a T-box Stem I RNA, its cognate tRNA-Gly, and the B. subtilis YbxF protein, revealing key tertiary contacts and molecular recognition mechanisms.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ11_STD_0002') {
    return `RNA Puzzle 11 corresponds to a SAM-I/IV riboswitch variant, an engineered sequence used as a blind-prediction target in the RNA-Puzzles benchmark. The matched resolved structure, represented by PDB entry 5LYV, captures the riboswitch variant, providing a high-resolution model for comparing chemical probing reactivity with the target's folded conformation.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ14_HRF_0002') {
    return `RNA Puzzle 14 corresponds to the L-glutamine riboswitch (bound or free form), a metabolite-sensing riboswitch that regulates bacterial gene expression. The matched resolved structure, represented here by PDB entry 5DDO, captures the glutamine-bound state and serves as a high-resolution target in the RNA-Puzzles benchmark.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ5_HRF_0001') {
    return `RNA Puzzle 5 corresponds to the GIR1 lariat-capping ribozyme from the slime mold Didymium iridis. This catalytic RNA molecule forms a lariat junction to protect mature transcripts from exonucleolytic decay. Its experimentally solved structure, represented by PDB entry 4P8Z, serves as a major benchmark in the RNA-Puzzles project for assessing de novo RNA 3D structure prediction methods.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ6_STD_0001') {
    return `RNA Puzzle 6 corresponds to the adenosylcobalamin (AdoCbl) riboswitch aptamer from Symbiobacterium thermophilum, a ligand-sensing RNA. The crystallographic target, represented by PDB entry 4GXY, captures the complex in its ligand-bound folded state and serves as a classic blind-prediction benchmark for RNA 3D modeling programs.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ7_1M7_0001') {
    return `RNA Puzzle 7 corresponds to the Varkud satellite (VS) ribozyme G638A mutant from Neurospora mitochondria, a small catalytic RNA. Its experimentally solved structure, represented by PDB entry 4R4V, serves as a high-resolution target in the RNA-Puzzles benchmark for assessing structural modeling of complex catalytic folds.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ8_1M7_0001') {
    return `RNA Puzzle 8 corresponds to a SAM-I/IV riboswitch aptamer domain, a metabolite-sensing RNA that regulates translation in response to S-adenosylmethionine. The crystallographic target, represented by PDB entry 4L81, captures the variant riboswitch fold and acts as a blind-prediction benchmark for de novo 3D modeling programs.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ9_1M7_0001') {
    return `RNA Puzzle 9 corresponds to a 5-hydroxytryptophan RNA aptamer, a selectin biosensor designed to bind serotonin and related compounds. The crystal structure, represented by PDB entry 5KPY, serves as a high-resolution target in the RNA-Puzzles benchmark for assessing structural predictions of small-molecule binding pockets.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_ETERNA_R82_0000') {
    return `EteRNA Cloud Lab corresponds to the Bacillus anthracis glmS ribozyme, a metabolite-responsive self-cleaving ribozyme that binds glucosamine 6-phosphate (Glc6P). The crystallographic structure, represented by PDB entry 3L3C, captures the active cofactor-bound state, providing a benchmark for high-throughput RNA design and modeling.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_CIDGMP_1M7_0001') {
    return `cidGMP riboswitch, V. Cholerae corresponds to a cyclic di-GMP-I riboswitch aptamer from Vibrio cholerae bound to a linear dinucleotide analogue (GpG). The crystallographic structure, represented by PDB entry 3UCZ, serves as a high-resolution model for comparing chemical probing reactivity and investigating ligand selectivity.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_SRPECLI_BZCN_0001') {
    return `SRP RNA, E. coli corresponds to the 4.5S signal recognition particle (SRP) RNA component from Escherichia coli, involved in co-translational protein targeting. The Cryo-EM structure, represented by PDB entry 5GAH, captures the translating ribosome with the bound SRP complex and serves as a structural model for co-translational accessibility.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNASEP_1M7_0001') {
    return `RNase P specificity region, E. coli corresponds to the catalytic RNA component of Ribonuclease P from Escherichia coli, a ribozyme responsible for 5' maturation of precursor tRNAs. The Cryo-EM structure, represented by PDB entry 7UO5, captures the RNase P holoenzyme with precursor tRNA and Mg2+ ions, showing the dynamic active site details.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_TRP4P6_CMC_0001') {
    return `RMDB_TRP4P6_CMC_0001 is a CMCT probing record for the Tetrahymena group I intron P4-P6 domain, a classic model system for studying RNA tertiary folding and ligand interactions. The experimental probing data is mapped to the Cryo-EM structure of the Tetrahymena group I intron, represented by PDB entry 8I7N, which captures the G264A mutant intron state.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_TRNAPH_1M7_0000') {
    return `tRNAphe, E. coli corresponds to the phenylalanine transfer RNA (tRNA-Phe) from Escherichia coli, a key component of the translation machinery. The experimental chemical probing reactivity profile is matched to the resolved tRNA structure within the tuco-tuco ribosome complex, represented by PDB entry 9Y4G, providing a structural reference for tRNA conformation.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_TRP4P6_DMS_0014') {
    return `RMDB_TRP4P6_DMS_0014 is a DMS probing record for the Tetrahymena group I intron P4-P6 domain. The experimental chemical probing reactivity profile is matched to the resolved structure of the Tetrahymena ribozyme containing 5-methyl-cytidine modifications, represented by PDB entry 9ZC6.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (row?.foldBridgeId === 'RMDB_SARS-CoV-2-SL5') {
    return `RMDB_SARS-CoV-2-SL5 is a chemical probing record for the SARS-CoV-2 stem-loop 5 (SL5) domain within the 5' untranslated region of the viral genome. The experimental chemical probing reactivity profile is matched to the resolved structure of SL5, represented by PDB entry 8QO5, which captures the conserved Betacoronavirus RNA fold and dynamics.<sup><a href="/" data-scroll-target="references">[1]</a>, <a href="/" data-scroll-target="references">[2]</a></sup>`;
  }

  if (String(row?.foldBridgeId ?? '').startsWith('RMDB_') || String(row?.foldBridgeId ?? '').startsWith('RASP_')) {
    return renderGenericRmdbDescription(row);
  }

  return `${row?.name || 'Untitled record'} is a probing-centered FoldBridge record with a matched tertiary-structure target.`;
}

function renderStructureDetailReferenceContent(row) {
  if (row?.foldBridgeId === 'RMDB_ATTR03_DMS_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Accelerated cryo-EM-guided determination of three-dimensional RNA-only structures.</h3>
          <p class="sequence-detail-reference-authors">Kappel K, Zhang K, Su Z, Watkins AM, Kladwang W, Li S, Pintilie G, Topkar VV, Rangan R, Zheludev IN, Yesselman JD, Chiu W, Das R. (2020)</p>
          <p class="sequence-detail-reference-source">Nature Methods 17(7):699-707</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/32616928/" target="_blank" rel="noopener noreferrer">PubMed: 32616928</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/s41592-020-0878-9" target="_blank" rel="noopener noreferrer">DOI: 10.1038/s41592-020-0878-9</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 6WLK: Apo ATP-TTR-3 models, 10.0 Angstrom resolution.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the apo ATP-TTR-3 model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/6WLK" target="_blank" rel="noopener noreferrer">RCSB: 6WLK</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb6WLK/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb6WLK/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ18_1M7_0000') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Zika virus produces noncoding RNAs using a multi-pseudoknot structure that confounds a cellular exonuclease.</h3>
          <p class="sequence-detail-reference-authors">Akiyama BM, Laurence HM, Massey AR, Costantino DA, Xie X, Yang Y, Shi PY, Nix JC, Beckham JD, Kieft JS. (2016)</p>
          <p class="sequence-detail-reference-source">Science 354:1148-1152</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/27934765/" target="_blank" rel="noopener noreferrer">PubMed: 27934765</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1126/science.aah3963" target="_blank" rel="noopener noreferrer">DOI: 10.1126/science.aah3963</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 5TPY: Crystal structure of an exonuclease resistant RNA from Zika virus.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the Zika virus xrRNA model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/5TPY" target="_blank" rel="noopener noreferrer">RCSB: 5TPY</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb5TPY/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb5TPY/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_ATPCON_DMS_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Structural Basis of RNA Folding and Recognition in an AMP-RNA Aptamer Complex.</h3>
          <p class="sequence-detail-reference-authors">Jiang F, Kumar RA, Jones RA, Patel DJ. (1996)</p>
          <p class="sequence-detail-reference-source">Nature 382:183-186</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/8700212/" target="_blank" rel="noopener noreferrer">PubMed: 8700212</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/382183a0" target="_blank" rel="noopener noreferrer">DOI: 10.1038/382183a0</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] Computational design of three-dimensional RNA structure and function.</h3>
          <p class="sequence-detail-reference-authors">Yesselman JD, Eiler D, Carlson ED, Gotrik MR, d'Aquino AE, Ooms AN, Kladwang W, Carlson PD, Shi X, Costantino DA, Herschlag D, Lucks JB, Jewett MC, Kieft JS, Das R. (2019)</p>
          <p class="sequence-detail-reference-source">Nature Nanotechnology 14(9):866-873</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/31427748/" target="_blank" rel="noopener noreferrer">PubMed: 31427748</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/s41565-019-0517-8" target="_blank" rel="noopener noreferrer">DOI: 10.1038/s41565-019-0517-8</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-3">
          <h3>[3] RCSB PDB entry 1AM0: AMP-RNA aptamer complex.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the AMP-bound aptamer linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/1AM0" target="_blank" rel="noopener noreferrer">RCSB: 1AM0</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb1AM0/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb1AM0/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_ADDSC_1M7_0007') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Structural Basis for Discriminative Regulation of Gene Expression by Adenine- and Guanine-Sensing mRNAs.</h3>
          <p class="sequence-detail-reference-authors">Serganov A, Yuan YR, Pikovskaya O, Polonskaia A, Malinina L, Phan AT, Hobartner C, Micura R, Breaker RR, Patel DJ. (2004)</p>
          <p class="sequence-detail-reference-source">Chemistry &amp; Biology 11(12):1729-1741</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/15610857/" target="_blank" rel="noopener noreferrer">PubMed: 15610857</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1016/j.chembiol.2004.11.004" target="_blank" rel="noopener noreferrer">DOI: 10.1016/j.chembiol.2004.11.004</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 1Y26: A-riboswitch-adenine complex.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the ligand-bound <em>Vibrio vulnificus</em> adenine riboswitch aptamer linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/1Y26" target="_blank" rel="noopener noreferrer">RCSB: 1Y26</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb1Y26/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb1Y26/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_GLYCFN_KNK_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Automated RNA structure prediction uncovers a missing link in double glycine riboswitches.</h3>
          <p class="sequence-detail-reference-authors">Kladwang W, Chou FC, Das R. (2011)</p>
          <p class="sequence-detail-reference-source">Journal of the American Chemical Society 134(3):1204-1212</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/22192063/" target="_blank" rel="noopener noreferrer">PubMed: 22192063</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1021/ja2093508" target="_blank" rel="noopener noreferrer">DOI: 10.1021/ja2093508</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] Structural insights into ligand recognition by a sensing domain of the cooperative glycine riboswitch.</h3>
          <p class="sequence-detail-reference-authors">Huang L, Serganov A, Patel DJ. (2010)</p>
          <p class="sequence-detail-reference-source">Molecular Cell 40(5):774-786</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/21145485/" target="_blank" rel="noopener noreferrer">PubMed: 21145485</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1016/j.molcel.2010.11.026" target="_blank" rel="noopener noreferrer">DOI: 10.1016/j.molcel.2010.11.026</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-3">
          <h3>[3] RCSB PDB entry 6WLM: Glycine riboswitch with kink-turn containing linker.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the glycine riboswitch model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/6WLM" target="_blank" rel="noopener noreferrer">RCSB: 6WLM</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb6WLM/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb6WLM/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_TPPSC_1M7_0005') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Characterizing RNA structures in vitro and in vivo with selective 2'-hydroxyl acylation analyzed by primer extension sequencing (SHAPE-Seq).</h3>
          <p class="sequence-detail-reference-authors">Watters KE, Yu AM, Strobel EJ, Settle AH, Lucks JB. (2016)</p>
          <p class="sequence-detail-reference-source">Methods 103:34-48</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1016/j.ymeth.2016.04.002" target="_blank" rel="noopener noreferrer">DOI: 10.1016/j.ymeth.2016.04.002</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] Structural basis for gene regulation by a thiamine pyrophosphate-sensing riboswitch.</h3>
          <p class="sequence-detail-reference-authors">Serganov A, Polonskaia A, Phan AT, Breaker RR, Patel DJ. (2006)</p>
          <p class="sequence-detail-reference-source">Nature 441:1167-1171</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/16728979/" target="_blank" rel="noopener noreferrer">PubMed: 16728979</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/nature04740" target="_blank" rel="noopener noreferrer">DOI: 10.1038/nature04740</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-3">
          <h3>[3] RCSB PDB entry 7TZS: Crystal structure of the E. coli thiamine pyrophosphate (TPP) riboswitch.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the thiamine pyrophosphate-sensing riboswitch model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/7TZS" target="_blank" rel="noopener noreferrer">RCSB: 7TZS</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb7TZS/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb7TZS/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_SAMRSW_1M7_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] SHAPE-Seq 2.0: systematic optimization and extension of high-throughput chemical probing of RNA secondary structure with next generation sequencing.</h3>
          <p class="sequence-detail-reference-authors">Loughrey D, Watters KE, Settle AH, Lucks JB. (2014)</p>
          <p class="sequence-detail-reference-source">Nucleic Acids Research 42(21):e165</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/25303992/" target="_blank" rel="noopener noreferrer">PubMed: 25303992</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1093/nar/gku909" target="_blank" rel="noopener noreferrer">DOI: 10.1093/nar/gku909</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] SAM recognition and conformational switching mechanism in the Bacillus subtilis yitJ S box/SAM-I riboswitch.</h3>
          <p class="sequence-detail-reference-authors">Lu C, Ding F, Chowdhury A, Pradhan V, Tomsic J, Holmes WM, Henkin TM, Ke A. (2010)</p>
          <p class="sequence-detail-reference-source">Journal of Molecular Biology 404(5):803-818</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/20951706/" target="_blank" rel="noopener noreferrer">PubMed: 20951706</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1016/j.jmb.2010.09.059" target="_blank" rel="noopener noreferrer">DOI: 10.1016/j.jmb.2010.09.059</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-3">
          <h3>[3] RCSB PDB entry 4KQY: Crystal structure of the SAM-I riboswitch aptamer domain.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the SAM-I riboswitch model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/4KQY" target="_blank" rel="noopener noreferrer">RCSB: 4KQY</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb4KQY/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb4KQY/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_16SFWJ_1M7_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] A two-dimensional mutate-and-map strategy for non-coding RNA structure.</h3>
          <p class="sequence-detail-reference-authors">Kladwang W, VanLang CC, Cordero P, Das R. (2012)</p>
          <p class="sequence-detail-reference-source">Nature Chemistry 3(12):954-962</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/22109276/" target="_blank" rel="noopener noreferrer">PubMed: 22109276</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/nchem.1176" target="_blank" rel="noopener noreferrer">DOI: 10.1038/nchem.1176</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] High-throughput mutate-map-rescue evaluates SHAPE-directed RNA structure and uncovers excited states.</h3>
          <p class="sequence-detail-reference-authors">Tian S, Cordero P, Kladwang W, Das R. (2014)</p>
          <p class="sequence-detail-reference-source">RNA 20(11):1815-1826</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/25183835/" target="_blank" rel="noopener noreferrer">PubMed: 25183835</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1261/rna.044321.114" target="_blank" rel="noopener noreferrer">DOI: 10.1261/rna.044321.114</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-3">
          <h3>[3] RCSB PDB entry 4YBB: Crystal structure of the E. coli 70S ribosome showing 16S rRNA.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the ribosome structure containing the 16S rRNA fragment linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/4YBB" target="_blank" rel="noopener noreferrer">RCSB: 4YBB</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb4YBB/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb4YBB/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_TRP4P6_HRF_0003') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Determining the Mg2+ stoichiometry for folding an RNA's metal ion core.</h3>
          <p class="sequence-detail-reference-authors">Das R, Travers KJ, Bai Y, Herschlag D. (2005)</p>
          <p class="sequence-detail-reference-source">Journal of the American Chemical Society 127(23):8272-8273</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/15941263/" target="_blank" rel="noopener noreferrer">PubMed: 15941263</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1021/ja052131u" target="_blank" rel="noopener noreferrer">DOI: 10.1021/ja052131u</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] Crystal structure of a group I ribozyme domain: principles of RNA packing.</h3>
          <p class="sequence-detail-reference-authors">Cate JH, Gooding AR, Podell E, Zhou K, Golden BL, Kundrot CE, Cech TR, Doudna JA. (1996)</p>
          <p class="sequence-detail-reference-source">Science 273(5282):1678-1685</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/8781224/" target="_blank" rel="noopener noreferrer">PubMed: 8781224</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1126/science.273.5282.1678" target="_blank" rel="noopener noreferrer">DOI: 10.1126/science.273.5282.1678</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-3">
          <h3>[3] RCSB PDB entry 1GID: P4-P6 domain of the <em>Tetrahymena</em> group I ribozyme.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the crystallographic P4-P6 domain linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/1GID" target="_blank" rel="noopener noreferrer">RCSB: 1GID</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb1GID/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb1GID/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ10_STD_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Dramatic Improvement of Crystals of Large RNAs by Cation Replacement and Dehydration.</h3>
          <p class="sequence-detail-reference-authors">Zhang J, Ferré-D’Amaré AR. (2014)</p>
          <p class="sequence-detail-reference-source">Structure 22(9):1363-1371</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/25156430/" target="_blank" rel="noopener noreferrer">PubMed: 25156430</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1016/j.str.2014.07.011" target="_blank" rel="noopener noreferrer">DOI: 10.1016/j.str.2014.07.011</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 4TZZ: Ternary complex of T-box Stem I RNA, tRNA-Gly and YbxF protein.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the T-box-tRNA complex linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/4TZZ" target="_blank" rel="noopener noreferrer">RCSB: 4TZZ</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb4TZZ/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb4TZZ/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ11_STD_0002') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] The crystal structure of the 5' functional domain of the transcription riboregulator 7SK.</h3>
          <p class="sequence-detail-reference-authors">Martinez-Zapien D, Legrand P, McEwen AG, Pasquali S, Dock-Bregeon AC. (2017)</p>
          <p class="sequence-detail-reference-source">Nucleic Acids Research 45(6):3535-3544</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/28087754/" target="_blank" rel="noopener noreferrer">PubMed: 28087754</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1093/nar/gkw1355" target="_blank" rel="noopener noreferrer">DOI: 10.1093/nar/gkw1355</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 5LYV: The crystal structure of the 5' functional domain of the transcription riboregulator 7SK.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the 7SK snRNA domain model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/5LYV" target="_blank" rel="noopener noreferrer">RCSB: 5LYV</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb5LYV/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb5LYV/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ14_HRF_0002') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Structural and Dynamic Basis for Low-Affinity, High-Selectivity Binding of L-Glutamine by the Glutamine Riboswitch.</h3>
          <p class="sequence-detail-reference-authors">Ren A, Xue Y, Peselis A, Serganov A, Al-Hashimi HM, Patel DJ. (2015)</p>
          <p class="sequence-detail-reference-source">Cell Reports 13:1800-1813</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/26628365/" target="_blank" rel="noopener noreferrer">PubMed: 26628365</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1016/j.celrep.2015.10.062" target="_blank" rel="noopener noreferrer">DOI: 10.1016/j.celrep.2015.10.062</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 5DDO: Structure of the glutamine riboswitch bound to glutamine.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the glutamine riboswitch model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/5DDO" target="_blank" rel="noopener noreferrer">RCSB: 5DDO</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb5DDO/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb5DDO/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ5_HRF_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] RNA-Puzzles Round II: assessment of RNA structure prediction programs applied to three large RNA structures.</h3>
          <p class="sequence-detail-reference-authors">Miao Z, Adamiak RW, Blanchet MF, Boniecki M, Bujnicki JM, Chen SJ, ... Westhof E. (2015)</p>
          <p class="sequence-detail-reference-source">RNA 21(6):1066-1084</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/25904128/" target="_blank" rel="noopener noreferrer">PubMed: 25904128</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1261/rna.049502.114" target="_blank" rel="noopener noreferrer">DOI: 10.1261/rna.049502.114</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 4P8Z: Crystal structure of the GIR1 lariat-capping ribozyme.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the GIR1 lariat-capping ribozyme model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/4P8Z" target="_blank" rel="noopener noreferrer">RCSB: 4P8Z</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb4P8Z/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb4P8Z/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ6_STD_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] RNA-Puzzles Round II: assessment of RNA structure prediction programs applied to three large RNA structures.</h3>
          <p class="sequence-detail-reference-authors">Miao Z, Adamiak RW, Blanchet MF, Boniecki M, Bujnicki JM, Chen SJ, ... Westhof E. (2015)</p>
          <p class="sequence-detail-reference-source">RNA 21(6):1066-1084</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/25904128/" target="_blank" rel="noopener noreferrer">PubMed: 25904128</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1261/rna.049502.114" target="_blank" rel="noopener noreferrer">DOI: 10.1261/rna.049502.114</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 4GXY: Crystal structure of the Symbiobacterium thermophilum adenosylcobalamin riboswitch aptamer bound to cobalamin.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the cobalamin riboswitch model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/4GXY" target="_blank" rel="noopener noreferrer">RCSB: 4GXY</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb4GXY/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb4GXY/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ7_1M7_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] RNA-Puzzles Round II: assessment of RNA structure prediction programs applied to three large RNA structures.</h3>
          <p class="sequence-detail-reference-authors">Miao Z, Adamiak RW, Blanchet MF, Boniecki M, Bujnicki JM, Chen SJ, ... Westhof E. (2015)</p>
          <p class="sequence-detail-reference-source">RNA 21(6):1066-1084</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/25904128/" target="_blank" rel="noopener noreferrer">PubMed: 25904128</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1261/rna.049502.114" target="_blank" rel="noopener noreferrer">DOI: 10.1261/rna.049502.114</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 4R4V: Crystal structure of the Varkud satellite ribozyme mutant.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the VS ribozyme model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/4R4V" target="_blank" rel="noopener noreferrer">RCSB: 4R4V</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb4R4V/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb4R4V/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ8_1M7_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] RNA-Puzzles Round III: 3D RNA structure prediction of five riboswitches and one ribozyme.</h3>
          <p class="sequence-detail-reference-authors">Miao Z, Adamiak RW, Antczak M, Batey RT, Becka AJ, Biesiada M, Boniecki MJ, Bujnicki JM, ... Westhof E. (2017)</p>
          <p class="sequence-detail-reference-source">RNA 23(5):655-672</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/28138060/" target="_blank" rel="noopener noreferrer">PubMed: 28138060</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1261/rna.060368.116" target="_blank" rel="noopener noreferrer">DOI: 10.1261/rna.060368.116</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 4L81: Structure of the SAM-I/IV riboswitch.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the SAM-I/IV riboswitch model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/4L81" target="_blank" rel="noopener noreferrer">RCSB: 4L81</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb4L81/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb4L81/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNAPZ9_1M7_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] RNA-Puzzles Round IV: 3D structure predictions of four ribozymes and two aptamers.</h3>
          <p class="sequence-detail-reference-authors">Miao Z, Adamiak RW, Antczak M, Boniecki MJ, Bujnicki J, Chen SJ, Cheng CY, Cheng Y, Chou FC, Das R, Dokholyan NV, Ding F, Geniesse C, Jiang Y, Joshi A, Krokhotin A, Magnus M, Mailhot O, Major F, Mann TH, Piatkowski P, Pluta R, Popenda M, Sarzynska J, Sun L, Szachniuk M, Tian S, Wang J, Wang J, Watkins AM, Wiedemann J, Xiao Y, Xu X, Yesselman JD, Zhang D, Zhang Y, Zhang Z, Zhao C, Zhao P, Zhou Y, Zok T, Zyla A, Ren A, Batey RT, Golden BL, Huang L, Lilley DM, Liu Y, Patel DJ, Westhof E. (2020)</p>
          <p class="sequence-detail-reference-source">RNA 26(8):982-995</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/32371455/" target="_blank" rel="noopener noreferrer">PubMed: 32371455</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1261/rna.075341.120" target="_blank" rel="noopener noreferrer">DOI: 10.1261/rna.075341.120</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 5KPY: 5-HTP RNA aptamer structure.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the 5-HTP RNA aptamer model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/5KPY" target="_blank" rel="noopener noreferrer">RCSB: 5KPY</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb5KPY/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb5KPY/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_ETERNA_R82_0000') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Structural and chemical basis for glucosamine 6-phosphate binding and activation of the glmS ribozyme.</h3>
          <p class="sequence-detail-reference-authors">Cochrane JC, Lipchock SV, Smith KD, Strobel SA. (2009)</p>
          <p class="sequence-detail-reference-source">Biochemistry 48(15):3239-3246</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/19275185/" target="_blank" rel="noopener noreferrer">PubMed: 19275185</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1021/bi9001389" target="_blank" rel="noopener noreferrer">DOI: 10.1021/bi9001389</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 3L3C: Crystal structure of the Bacillus anthracis glmS ribozyme bound to Glc6P.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the glmS ribozyme model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/3L3C" target="_blank" rel="noopener noreferrer">RCSB: 3L3C</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb3L3C/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb3L3C/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_CIDGMP_1M7_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Structural and biochemical characterization of linear dinucleotide analogues bound to the c-di-GMP-I aptamer.</h3>
          <p class="sequence-detail-reference-authors">Smith KD, Lipchock SV, Strobel SA. (2012)</p>
          <p class="sequence-detail-reference-source">Biochemistry 51(10):2062-2070</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/22339598/" target="_blank" rel="noopener noreferrer">PubMed: 22339598</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1021/bi201736k" target="_blank" rel="noopener noreferrer">DOI: 10.1021/bi201736k</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 3UCZ: c-di-GMP-I riboswitch bound to the linear dinucleotide GpG.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the c-di-GMP-I riboswitch model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/3UCZ" target="_blank" rel="noopener noreferrer">RCSB: 3UCZ</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb3UCZ/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb3UCZ/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_SRPECLI_BZCN_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Structures of the E. coli translating ribosome with SRP and its receptor and with the translocon.</h3>
          <p class="sequence-detail-reference-authors">Jomaa A, Boehringer D, Leibundgut M, Ban N. (2016)</p>
          <p class="sequence-detail-reference-source">Nature Communications 7:10471</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/26829443/" target="_blank" rel="noopener noreferrer">PubMed: 26829443</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/ncomms10471" target="_blank" rel="noopener noreferrer">DOI: 10.1038/ncomms10471</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 5GAH: Cryo-EM structure of E. coli translating ribosome with SRP.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the SRP-containing ribosome model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/5GAH" target="_blank" rel="noopener noreferrer">RCSB: 5GAH</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb5GAH/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb5GAH/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_RNASEP_1M7_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Structural and mechanistic basis for recognition of alternative tRNA precursor substrates by bacterial ribonuclease P.</h3>
          <p class="sequence-detail-reference-authors">Zhu J, Huang W, Zhao J, Huynh L, Taylor DJ, Harris ME. (2022)</p>
          <p class="sequence-detail-reference-source">Nature Communications 13(1):5062</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/36038573/" target="_blank" rel="noopener noreferrer">PubMed: 36038573</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/s41467-022-32843-7" target="_blank" rel="noopener noreferrer">DOI: 10.1038/s41467-022-32843-7</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 7UO5: E. coli RNase P Holoenzyme with Mg2+.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the RNase P holoenzyme model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/7UO5" target="_blank" rel="noopener noreferrer">RCSB: 7UO5</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb7UO5/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb7UO5/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_TRP4P6_CMC_0001') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Cryo-EM reveals dynamics of Tetrahymena group I intron self-splicing.</h3>
          <p class="sequence-detail-reference-authors">Luo B, Zhang C, Ling X, Mukherjee S, Jia G, Xie J, Jia X, Liu L, Baulin EF, Luo Y, Jiang L, Dong H, Wei X, Bujnicki JM, Su Z. (2023)</p>
          <p class="sequence-detail-reference-source">Nature Catalysis 6:405–416</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/s41929-023-00934-3" target="_blank" rel="noopener noreferrer">DOI: 10.1038/s41929-023-00934-3</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 8I7N: Cryo-EM structure of the Tetrahymena group I intron in the Tet-S1 state.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the Tetrahymena intron model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/8I7N" target="_blank" rel="noopener noreferrer">RCSB: 8I7N</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb8I7N/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb8I7N/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_TRNAPH_1M7_0000') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Structures of naked mole-rat, tuco-tuco, and guinea pig ribosomes—is rRNA fragmentation linked to translational fidelity?</h3>
          <p class="sequence-detail-reference-authors">Gutierrez-Vargas C, De S, Maji S, Liu Z, Nieb M, Seluanov A, Gorbunova V, Frank J. (2026)</p>
          <p class="sequence-detail-reference-source">Nucleic Acids Research</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1093/nar/gkae144" target="_blank" rel="noopener noreferrer">DOI (Journal Base)</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 9Y4G: Structure of tuco-tuco ribosome.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the ribosome-tRNA complex linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/9Y4G" target="_blank" rel="noopener noreferrer">RCSB: 9Y4G</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb9Y4G/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb9Y4G/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_TRP4P6_DMS_0014') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Base modifications shift tertiary structure and activity in synthetic RNA origami and a natural ribozyme.</h3>
          <p class="sequence-detail-reference-authors">Yadav DK, Yang H, Lee S, McRae EKS. (2026)</p>
          <p class="sequence-detail-reference-source">Nature Communications</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1038/s41467-026-72891-x" target="_blank" rel="noopener noreferrer">DOI: 10.1038/s41467-026-72891-x</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 9ZC6: Tetrahymena Ribozyme with 5-methyl-cytidine.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the modified Tetrahymena ribozyme linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/9ZC6" target="_blank" rel="noopener noreferrer">RCSB: 9ZC6</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb9ZC6/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb9ZC6/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (row?.foldBridgeId === 'RMDB_SARS-CoV-2-SL5') {
    return `<div class="sequence-detail-reference-card">
      <div class="sequence-detail-reference-list">
        <article class="sequence-detail-reference-item" id="reference-1">
          <h3>[1] Conserved structures and dynamics in 5'-proximal regions of Betacoronavirus RNA genomes.</h3>
          <p class="sequence-detail-reference-authors">de Moura TR, Purta E, Bernat A, Martin-Cuevas EM, Kurkowska M, Baulin EF, Mukherjee S, Nowak J, Biela AP, Rawski M, Glatt S, Moreno-Herrero F, Bujnicki JM. (2024)</p>
          <p class="sequence-detail-reference-source">Nucleic Acids Research 52:3419-3432</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://pubmed.ncbi.nlm.nih.gov/38426934/" target="_blank" rel="noopener noreferrer">PubMed: 38426934</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.1093/nar/gkae144" target="_blank" rel="noopener noreferrer">DOI: 10.1093/nar/gkae144</a>
          </div>
        </article>
        <article class="sequence-detail-reference-item" id="reference-2">
          <h3>[2] RCSB PDB entry 8QO5: SARS-CoV-2 SL5 structure model.</h3>
          <p class="sequence-detail-reference-authors">RCSB Protein Data Bank structure record for the SARS-CoV-2 SL5 model linked to this FoldBridge entry.</p>
          <p class="sequence-detail-reference-source">RCSB PDB / wwPDB structure record</p>
          <div class="sequence-detail-reference-links">
            <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/8QO5" target="_blank" rel="noopener noreferrer">RCSB: 8QO5</a>
            <a class="sequence-detail-reference-link" href="https://doi.org/10.2210/pdb8QO5/pdb" target="_blank" rel="noopener noreferrer">PDB DOI: 10.2210/pdb8QO5/pdb</a>
          </div>
        </article>
      </div>
    </div>`;
  }

  if (String(row?.foldBridgeId ?? '').startsWith('RMDB_') || String(row?.foldBridgeId ?? '').startsWith('RASP_')) {
    return renderGenericRmdbReferenceContent(row);
  }

  return `<div class="sequence-detail-reference-card">
    <p>No curated references are attached to this structure-linked record yet.</p>
  </div>`;
}

function sequenceDetailPage() {
  const sequenceId = getSequenceIdFromHash();
  const pdbName = getPdbNameFromHash();
  const row = sequenceRows.find((item) => item.id === sequenceId)
    ?? sequenceRows.find((item) => item.pdbName === pdbName);

  if (!row) {
    return `<main class="page-sequence-detail">
      ${renderBundleHeader()}
      <section class="card">
        <h1>Sequence Not Found</h1>
        <p>No sequence record matched this link.</p>
      </section>
    </main>`;
  }

  const heatmapSection = showReactivityHeatmap
    ? `<section class="sequence-detail-panel">
        <h2>Reactivity Heatmap</h2>
        <div class="sequence-detail-section-intro">
          <p>${
            isReactivityGuidedStructure
              ? 'This heatmap is the starting point for this record because no curated dot-bracket annotation was packaged with the RDAT. The secondary-structure view below is estimated from these reactivity measurements.'
              : 'This heatmap summarizes per-position chemical probing reactivity across the RDAT measurements, helping relate experimental signal to structural context.'
          }</p>
        </div>
        <section class="sequence-secondary-card sequence-secondary-heatmap-card structure-detail-heatmap-card">
          <div
            id="structure-detail-heatmap"
            class="sequence-secondary-heatmap-host"
            data-rdat-url="${row.rdatPath}"
            data-sequence="${(row.sourceSequence || row.sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
          ></div>
          <p id="structure-detail-heatmap-status" class="mini-note" hidden></p>
        </section>
      </section>`
    : '';

  const secondaryStructureSection = hasSecondaryStructureConstraints
    ? `<section class="sequence-detail-panel">
        <h2>${isReactivityGuidedStructure ? 'Predicted Secondary Structure' : 'Secondary Structure'}</h2>
        <div class="sequence-detail-section-intro">
          <p>${
            isReactivityGuidedStructure
              ? 'This panel shows a local reactivity-guided secondary-structure estimate derived from the bundled RDAT measurements and rendered as an interactive 2D layout.'
              : 'This panel shows the RNA secondary structure derived from the packaged dot-bracket annotation and rendered as an interactive 2D layout.'
          }</p>
        </div>
        <section class="sequence-secondary-card sequence-secondary-forna-card">
          <div class="sequence-detail-forna-copy">
            <p class="sequence-detail-forna-title">RNA Secondary Structure Viewer (Forna)</p>
            ${
              isReactivityGuidedStructure
                ? `<p class="mini-note">${predictedSecondaryStructure?.method || 'Reactivity-guided prediction.'}</p>
                   <p class="mini-note">Use this as a working hypothesis rather than a final curated structure. High reactivity often suggests flexible or exposed positions, but it does not guarantee a unique fold.</p>`
                : ''
            }
          </div>
          <div class="sequence-detail-forna-frame">
            <div
              id="structure-detail-forna-host"
              class="sequence-detail-forna-host"
              data-rdat-url="${rdatDownloadPath(row.foldBridgeId)}"
              data-foldbridge-id="${row.foldBridgeId}"
              data-sequence="${(row.sourceSequence || row.sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
              data-structure="${detailSecondaryStructure || ''}"
            ></div>
          </div>
          <div id="structure-detail-sequence-structure-block" class="sequence-detail-dot-bracket-block">
            <p class="case-sequence-structure-label">Dot-bracket notation</p>
            <code
              id="structure-detail-sequence-structure"
              class="case-sequence-structure"
              data-sequence="${detailSequence || ''}"
              data-chunk-size="120"
            >${renderAlignedSequenceStructure(detailSequence, detailSecondaryStructure)}</code>
          </div>
          <p id="structure-detail-forna-status" class="sequence-detail-forna-note" hidden></p>
        </section>
      </section>`
    : '';

  const showPredictedStructureSection = hasUsablePredictedStructure(row?.foldBridgeId) || hasSecondaryStructureConstraints;
  const showPredictedStructureViewer = hasUsablePredictedStructure(row?.foldBridgeId);
  const tertiaryStructureSection =
    hasSecondaryStructureConstraints && (showPredictedStructureSection || row.bestPdbId)
      ? `<section class="sequence-detail-panel">
          <h2>Tertiary Structure Comparison</h2>
          <div class="sequence-detail-section-intro">
            <p>${
              (!isReactivityGuidedStructure || (row.bestPdbId && hasUsablePredictedStructure(row.foldBridgeId)))
                ? 'Compare the secondary-structure-derived RNA model with the matched experimental PDB structure side by side.'
                : 'Three-dimensional follow-up depends on whether a precomputed model is available. When no predicted 3D file has been generated yet, the 2D structure above should be treated as the current endpoint.'
            }</p>
          </div>
          <div class="structure-detail-comparison-grid">
            <section class="structure-detail-comparison-card">
              <div class="structure-detail-comparison-copy">
                <h3>Predicted 3D from dot-bracket</h3>
              </div>
              ${
                showPredictedStructureViewer
                  ? `<div class="sequence-detail-media">
                      <div id="predicted-structure-detail-molstar-status" class="mini-note">Loading predicted 3D model…</div>
                      <div
                        id="predicted-structure-detail-molstar"
                        class="sequence-detail-viewer"
                        data-structure-url="${predictedStructurePath(row.foldBridgeId)}"
                        data-structure-format="pdb"
                        data-structure-label="${row.foldBridgeId.replace(/^RMDB_/, '')}"
                        data-structure-sequence="${(row.sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
                        data-structure-source="rnacomposer"
                      ></div>
                    </div>`
                  : `<div class="sequence-detail-media">
                      <div class="mini-note">${
                        unsupportedPredictedStructureIds.has(row?.foldBridgeId)
                          ? 'RNAComposer prediction unavailable for this record.'
                          : 'Predicted 3D model is not available yet for this record.'
                      }</div>
                      ${
                        isReactivityGuidedStructure && !unsupportedPredictedStructureIds.has(row?.foldBridgeId)
                          ? '<p class="mini-note">If we want a 3D view here, the next step is to run a dedicated generator such as RNAComposer or another RNA 3D modeling workflow from the predicted dot-bracket.</p>'
                          : ''
                      }
                    </div>`
              }
            </section>
            <section class="structure-detail-comparison-card">
              <div class="structure-detail-comparison-copy">
                <h3>Matched PDB tertiary structure</h3>
              </div>
              ${
                row.bestPdbId
                  ? `<div class="sequence-detail-media">
                      <div id="structure-detail-molstar-status" class="mini-note">Loading interactive 3D structure…</div>
                      <div
                        id="structure-detail-molstar"
                        class="sequence-detail-viewer"
                        data-structure-url="${structureDetailPdbUrl(row.bestPdbId, row.bestSubjectId)}"
                        data-structure-format="cif"
                        data-structure-label="${row.bestPdbId}"
                        data-structure-sequence="${(row.sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
                        data-structure-chain="${String(row.bestSubjectId || '').match(/_([A-Za-z0-9-]+)$/)?.[1] || ''}"
                      ></div>
                    </div>`
                  : `<div class="sequence-detail-placeholder">
                      <p>No matched PDB structure is available for this record.</p>
                    </div>`
              }
            </section>
          </div>
        </section>`
      : row.bestPdbId
        ? `<section class="sequence-detail-panel">
            <h2>Tertiary Structure</h2>
            <div class="sequence-detail-media">
              <div id="structure-detail-molstar-status" class="mini-note">Loading interactive 3D structure…</div>
              <div
                id="structure-detail-molstar"
                class="sequence-detail-viewer"
                data-structure-url="${structureDetailPdbUrl(row.bestPdbId, row.bestSubjectId)}"
                data-structure-format="cif"
                data-structure-label="${row.bestPdbId}"
                data-structure-sequence="${(row.sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
                data-structure-chain="${String(row.bestSubjectId || '').match(/_([A-Za-z0-9-]+)$/)?.[1] || ''}"
              ></div>
            </div>
          </section>`
        : '';

  const structureWorkflowSections = isReactivityGuidedStructure
    ? `${heatmapSection}${secondaryStructureSection}${tertiaryStructureSection}`
    : `${secondaryStructureSection}${heatmapSection}${tertiaryStructureSection}`;

  return `<main class="page-sequence-detail">
    ${renderBundleHeader()}
    <section class="sequence-detail-card">
      <div class="sequence-detail-header">
        <a class="sequence-detail-back" href="#download-sequences">Back to sequence list</a>
        <div class="sequence-detail-title-row">
          <div>
            <p class="sequence-detail-kicker">${row.category ?? 'RNA'} record</p>
            <h1>${row.sequenceName ?? ''}</h1>
          </div>
          <dl class="sequence-detail-meta">
            <div><dt>PDB</dt><dd>${row.pdbName ?? 'N/A'}</dd></div>
            <div><dt>Year</dt><dd>${row.article ?? 'N/A'}</dd></div>
            <div><dt>Coverage</dt><dd>${row.sequence ?? 'N/A'}</dd></div>
            <div><dt>Confidence</dt><dd>${row.confidence ?? 'N/A'}</dd></div>
          </dl>
        </div>
      </div>

      ${renderSequenceDetailTimeline()}

      <section class="sequence-detail-panel">
        <h2>Description</h2>
        <div class="sequence-detail-placeholder">
          <p>${row.aptamerName ?? 'Description content will be added here.'}</p>
        </div>
      </section>

      <section class="sequence-detail-panel">
        <h2>Primary Sequence</h2>
        <div class="sequence-secondary-block">
          <code class="sequence-secondary-code sequence-primary-code">${renderColoredSequence(row.type ?? '')}</code>
        </div>
      </section>

      <section class="sequence-detail-panel">
        <h2>Secondary Structure</h2>
        ${renderSequenceDetailSecondaryContent(row)}
      </section>

      <section class="sequence-detail-panel">
        <h2>Tertiary Structure</h2>
        ${renderSequenceDetailTertiaryContent(row)}
      </section>

      <section class="sequence-detail-panel">
        <h2>Reference</h2>
        ${renderSequenceDetailReferenceContent(row)}
      </section>
      ${renderDetailPageFooterActions()}
    </section>
  </main>`;
}



async function loadSequenceRows() {
  sequenceRows = [
    {
      id: '8QO5-SARS-COV-2-SL5',
      pdbName: '8QO5',
      sequenceName: 'SARS-CoV-2-SL5',
      aptamerName: "Conserved Structures and Dynamics in 5'-Proximal Regions of Betacoronavirus RNA Genomes",
      category: 'Virus',
      type: 'AUUAAAGGUUUAUACCUUCCCAGGUAACAAACCAACCAACUUUCGAUCUCUUGUAGAUCUGUUCUCUAAACGAACUUUAAAAUCUGUGUGGCUGUCACUCGGCUGCAUGCUUAGUGCACUCACGCAGUAUAAUUAAUAACUAAUUACUGUCGUUGACAGGACACGAGUAACUCGUCUAUCUUCUGCAGGCUGCUUACGGUUUCGUCCGUGUUGCAGCCGAUCAUCAGCACAUCUAGGUUUCGUCCGGGUGUGACCGAAAGGUAAGAUGGAGAGCCUUGUCCCUGGUUUCAACGAGAAAAC',
      chemicalProbing: 'XX',
      article: '2024',
      sequence: '100%',
      confidence: 'high',
      structureFile: 'src/assets/structures/8QO5-assembly1.cif',
      structureText: '. . . . . . ( ( ( ( ( . ( ( ( ( ( . . . . ) ) ) ) ) . . ) ) ) ) ) . . . . . . . . . . . ( ( ( ( ( . . . . . ) ) ) ) ) . ( ( ( ( . . . . . . . ) ) ) ) . . . . . . . . ( ( ( ( ( ( ( ( . ( ( . ( ( ( ( . ( ( ( . . . . . ) ) ) . ) ) ) ) ) ) . ) ) ) ) ) ) ) ) . . ( ( ( ( ( ( . . . . . ) ) ) ) ) ) . . . ( ( ( ( ( ( ( ( ( ( ( . . ( ( ( ( ( . . . ( ( ( . ( ( ( ( ( ( ( ( ( ( ( . . ( ( ( ( ( ( . ( ( ( ( ( . . . . . . ) ) ) ) ) . . ) ) ) ) ) ) . . . . . . ) ) ) ( ( ( ( ( ( ( . ( ( . . . . . . ) ) ) ) ) ) ) ) ) ( ( ( . . . . ) ) ) ) ) ) ) ) ) ) ) ) ) ) . ) ) ) ) ) . ) ) ) ) . . . ) ) ) ) ) ) ) . . . . . .',
    },
    {
      id: '5KPY-5-HTP-RNA-APTAMER',
      pdbName: '5KPY',
      sequenceName: '5-hydroxytryptophan RNA aptamer',
      aptamerName: 'Structure of a 5-hydroxytryptophan aptamer',
      category: 'RNA',
      type: 'GGACACUGAUGAUCGCGUGGAUAUGGCACGCAUUGAAUUGUUGGACACCGUAAAUGUCCUAACACGUGUCC',
      chemicalProbing: 'XX',
      article: '2017',
      sequence: '100%',
      confidence: 'high',
      structureFile: 'src/assets/structures/5KPY-assembly1.cif'
    },
    {
      id: '1AM0-RNA-APTAMER',
      pdbName: '1AM0',
      sequenceName: 'RNA APTAMER',
      aptamerName: 'AMP RNA APTAMER COMPLEX, NMR, 8 STRUCTURES',
      category: 'RNA',
      type: 'GGGUUGGGAAGAAACUGUGGCACUUCGGUGCCAGCAACCC',
      chemicalProbing: 'XX',
      article: '1997',
      sequence: '100%',
      confidence: 'high',
      structureFile: 'src/assets/structures/1AM0-assembly1.cif'
    },
    {
      id: '4L81-SAM-I-IV-VARIANT-RIBOSWITCH-APTAMER-DOMAIN',
      pdbName: '4L81',
      sequenceName: 'SAM-I/IV variant riboswitch aptamer domain',
      aptamerName: 'Structure of the SAM-I/IV riboswitch (env87(deltaU92, deltaG93))',
      category: 'RNA',
      type: 'GGAUCACGAGGGGGAGACCCCGGCAACCUGGGACGGACACCCAAGGUGCUCACACCGGAGACGGUGGAUCCGGCCCGAGAGGGCAACGAAGUCCGU',
      chemicalProbing: 'XX',
      article: '2014',
      sequence: '100%',
      confidence: 'high',
      structureFile: 'src/assets/structures/4L81-assembly1.cif'
    },
    {
      id: '5TPY-RNA-71-MER',
      pdbName: '5TPY',
      sequenceName: 'RNA (71-MER)',
      aptamerName: 'Crystal structure of an exonuclease resistant RNA from Zika virus',
      category: 'RNA',
      type: 'GGGUCAGGCCGGCGAAAGUCGCCACAGUUUGGGGAAAGCUGUGCAGCCUGUAACCCCCCCACGAAAGUGGG',
      chemicalProbing: 'XX',
      article: '2016',
      sequence: '100%',
      confidence: 'high',
      structureFile: 'src/assets/structures/5TPY-assembly1.cif'
    }
  ].map((row) => ({
    ...row,
    detailPage: `#sequence-detail?sequenceId=${encodeURIComponent(row.id)}`
  }));
}

function dataAssetPath(fileName) {
  return `./src/assets/data/rmdb-puzzle/${fileName}`;
}

function normalizeRdatAssetName(value) {
  const fileName = String(value ?? '').trim().replace(/^.*\//, '');
  if (!fileName) return '';
  return fileName.endsWith('.rdat') ? fileName : `${fileName}.rdat`;
}

function normalizeStructureMatchLabel(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/_/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\+/g, ' plus ')
    .replace(/\bfree\b/g, ' ')
    .replace(/\bbound\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSpeciesLabel(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const parts = text.split(/\s+/);
  if (parts.length >= 2 && /\.$/.test(parts[0])) {
    return `${parts[0]} ${parts[1].toLowerCase()}${parts.length > 2 ? ` ${parts.slice(2).join(' ')}` : ''}`;
  }
  return text;
}

function splitNameAndSpecies(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { name: '', species: '' };
  const parts = raw.split(/\s*,\s*/);
  if (parts.length < 2) return { name: raw, species: '' };
  return {
    name: parts[0].trim(),
    species: normalizeSpeciesLabel(parts.slice(1).join(', '))
  };
}

function parseScientificValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

const preferredStructureRepresentativeIds = new Map([
  ['rna puzzle 5', 'RMDB_RNAPZ5_HRF_0001'],
  ['rna puzzle 6', 'RMDB_RNAPZ6_STD_0001'],
  ['rna puzzle 11', 'RMDB_RNAPZ11_STD_0002'],
  ['rna puzzle 14', 'RMDB_RNAPZ14_HRF_0002']
]);

const puzzleDiscoveryYears = new Map([
  ['rna puzzle 5', '2015'],
  ['rna puzzle 6', '2015'],
  ['rna puzzle 7', '2015'],
  ['rna puzzle 8', '2017'],
  ['rna puzzle 9', '2020'],
  ['rna puzzle 10', 'NA'],
  ['rna puzzle 11', '2025'],
  ['rna puzzle 14', '2017'],
  ['rna puzzle 18', '2016']
]);

const predictedStructureIds = new Set(generatedPredictedStructureIds);

const curatedStructureOverrides = new Map([
  [
    'RMDB_RNAPZ18_1M7_0000',
    {
      sourceStructure: '....(((((((((....)))).(((((((.[[[[..)))))))..)))))...]]]](((((....)))))',
      species: 'Zika virus'
    }
  ],
  [
    'RMDB_ATTR03_DMS_0001',
    {
      discoveryYear: '2020',
      species: 'Synthetic construct'
    }
  ],
  [
    'RMDB_ATPCON_DMS_0001',
    {
      discoveryYear: '1996',
      species: 'Synthetic construct'
    }
  ],
  [
    'RMDB_ADDSC_1M7_0007',
    {
      discoveryYear: '2004'
    }
  ],
  [
    'RMDB_GLYCFN_KNK_0001',
    {
      discoveryYear: '2010'
    }
  ],
  [
    'RMDB_SARS-CoV-2-SL5',
    {
      discoveryYear: '2024',
      species: 'SARS-CoV-2',
      hasLocalRdat: false,
      rdatPath: '',
      sourceStructure: '......(((((.(((((....)))))..)))))...........(((((.....))))).((((.......))))........((((((((.((.((((.(((.....))).)))))).))))))))..((((((.....))))))...(((((((((((..(((((...(((.(((((((((((..((((((.(((((......)))))..))))))......)))(((((((.((......)))))))))(((....)))))))))))))).))))).))))...)))))))......'
    }
  ],
  [
    'RMDB_16SFWJ_1M7_0001',
    {
      discoveryYear: '2012',
      species: 'Bacterial 16S rRNA'
    }
  ],
  [
    'RMDB_SAMRSW_1M7_0001',
    {
      discoveryYear: '2010'
    }
  ],
  [
    'RMDB_TRP4P6_CMC_0001',
    {
      discoveryYear: '2005'
    }
  ],
  [
    'RMDB_TRP4P6_DMS_0014',
    {
      discoveryYear: '2005'
    }
  ],
  [
    'RMDB_TRP4P6_HRF_0003',
    {
      discoveryYear: '2005'
    }
  ],
  [
    'RMDB_TPPSC_1M7_0005',
    {
      discoveryYear: '2016'
    }
  ],
  [
    'RMDB_RNAPZ10_STD_0001',
    {
      discoveryYear: '2014',
      species: 'Bacillus subtilis'
    }
  ],
  [
    'RMDB_RNAPZ11_STD_0002',
    {
      discoveryYear: '2017',
      species: 'Synthetic construct'
    }
  ],
  [
    'RMDB_RNAPZ14_HRF_0002',
    {
      discoveryYear: '2015',
      species: 'Synthetic construct'
    }
  ],
  [
    'RMDB_RNAPZ5_HRF_0001',
    {
      discoveryYear: '2015',
      species: 'Didymium iridis'
    }
  ],
  [
    'RMDB_RNAPZ6_STD_0001',
    {
      discoveryYear: '2015',
      species: 'Symbiobacterium thermophilum'
    }
  ],
  [
    'RMDB_RNAPZ7_1M7_0001',
    {
      discoveryYear: '2015',
      species: 'Neurospora crassa'
    }
  ],
  [
    'RMDB_RNAPZ8_1M7_0001',
    {
      discoveryYear: '2017',
      species: 'Synthetic construct'
    }
  ],
  [
    'RMDB_RNAPZ9_1M7_0001',
    {
      discoveryYear: '2020',
      species: 'Synthetic construct'
    }
  ],
  [
    'RMDB_ETERNA_R82_0000',
    {
      discoveryYear: '2009',
      species: 'Bacillus anthracis'
    }
  ],
  [
    'RMDB_CIDGMP_1M7_0001',
    {
      discoveryYear: '2012',
      species: 'Vibrio cholerae'
    }
  ],
  [
    'RMDB_SRPECLI_BZCN_0001',
    {
      discoveryYear: '2016',
      species: 'Escherichia coli'
    }
  ],
  [
    'RMDB_RNASEP_1M7_0001',
    {
      discoveryYear: '2022',
      species: 'Escherichia coli'
    }
  ],
  [
    'RMDB_TRNAPH_1M7_0000',
    {
      discoveryYear: '2026',
      species: 'Escherichia coli'
    }
  ],
  [
    'RMDB_RSTRND_DMS_0000',
    {
      discoveryYear: '2023',
      species: 'Synthetic construct'
    }
  ],
  [
    'RMDB_PSEUDOB_DMS_0000',
    {
      discoveryYear: '2023',
      species: 'Synthetic construct'
    }
  ],
  [
    'RMDB_POS240_DMS_0000',
    {
      discoveryYear: '2023',
      species: 'Synthetic construct'
    }
  ],
  [
    'RMDB_PDB130_2A3_0000',
    {
      discoveryYear: '2023',
      species: 'Synthetic construct'
    }
  ],
  [
    'RMDB_OK7BLIB_2A3_0000',
    {
      discoveryYear: '2023',
      species: 'Synthetic construct'
    }
  ]
]);

const reactivityGuidedStructurePredictions = new Map([
  ...generatedReactivityGuidedStructurePredictions,
  [
    'RMDB_SAMRSW_1M7_0001',
    {
      structure: '..((((((((..(((((((.(.(((.....)))..))...))))(((.((((((.(.(((((.....)))))))))..))))))...))(..((((((...)..))))))..))))))))',
      method: 'Local reactivity-guided estimate from the bundled 1M7 and nomod rows in SAMRSW_1M7_0001.rdat.'
    }
  ],
  [
    'RMDB_CIDGMP_1M7_0001',
    {
      structure: '.(((((((((...)(((...((((((....)))))))((((...))((.((((((..(((((....).))))))))..))))))).))).))(((...)))))))',
      method: 'Local reactivity-guided estimate from the bundled 1M7 and nomod rows in CIDGMP_1M7_0001.rdat.'
    }
  ],
  [
    'RMDB_RNAPZ8_1M7_0001',
    {
      structure: '...((.(..((((....)))))).)(((((((.((((((((...)))).((.(((((....))))))))))).)))).).((((......))))))',
      method: 'Local reactivity-guided estimate from the bundled RNAPZ8_1M7_0001.rdat measurements.'
    }
  ],
  [
    'RMDB_RNAPZ9_1M7_0001',
    {
      structure: '(((((((....)(.(((((..(...))))))).......((((((((.......))))).))..)))))))',
      method: 'Local reactivity-guided estimate from the bundled RNAPZ9_1M7_0001.rdat measurements.'
    }
  ],
  [
    'RMDB_RNAPZ11_STD_0002',
    {
      structure: '((((((((((.(((((..(((((((....))).)))))))..))...))))))))))',
      method: 'Reactivity-guided comparison workflow for the bundled RNAPZ11_STD_0002.rdat measurements.'
    }
  ],
  [
    'RMDB_RNAPZ14_HRF_0002',
    {
      structure: '(((((.(((((....)))))((....))((((((..........))))))....)))))))',
      method: 'Reactivity-guided comparison workflow for the bundled RNAPZ14_HRF_0002.rdat measurements.'
    }
  ],
  [
    'RMDB_RNAPZ5_HRF_0001',
    {
      structure: '(((((..(((((..(((((((((.......)))))))))..((((.((((((((......(((((...((((((((((....))))....)).))))((....)).....[[[[[...))))).((((...))))))))))))....]]]]].((((....))))....))))...)))))..)))))',
      method: 'Reactivity-guided comparison workflow for the bundled RNAPZ5_HRF_0001.rdat measurements.'
    }
  ]
]);

const rnaComposerPredictedStructureIds = new Set(generatedRnaComposerPredictedStructureIds);
const forceReactivityGuidedWorkflowIds = new Set([
  'RMDB_RNAPZ5_HRF_0001',
  'RMDB_RNAPZ8_1M7_0001',
  'RMDB_RNAPZ9_1M7_0001',
  'RMDB_RNAPZ11_STD_0002',
  'RMDB_RNAPZ14_HRF_0002'
]);
const unsupportedPredictedStructureIds = new Set([
  'RMDB_OK7BLIB_2A3_0000'
]);

function hasUsablePredictedStructure(foldBridgeId) {
  return rnaComposerPredictedStructureIds.has(foldBridgeId) && !unsupportedPredictedStructureIds.has(foldBridgeId);
}

function predictedStructureDescription(foldBridgeId) {
  if (unsupportedPredictedStructureIds.has(foldBridgeId)) {
    return 'RNAComposer could not produce a usable 3D model for this record, so FoldBridge does not display a local fallback structure here.';
  }
  if (rnaComposerPredictedStructureIds.has(foldBridgeId)) {
    return 'This predicted 3D model is generated with RNAComposer from the RDAT sequence and available secondary-structure constraints, giving a more PDB-like atomic view for side-by-side comparison with the matched experimental structure below.';
  }
  return 'RNAComposer has not produced a 3D model for this record yet.';
}

function choosePreferredBlastHit(current, candidate) {
  if (!current) return candidate;
  const currentEvalue = parseScientificValue(current.evalue);
  const candidateEvalue = parseScientificValue(candidate.evalue);
  if (candidateEvalue !== currentEvalue) return candidateEvalue < currentEvalue ? candidate : current;
  const currentBitscore = Number(current.bitscore) || 0;
  const candidateBitscore = Number(candidate.bitscore) || 0;
  if (candidateBitscore !== currentBitscore) return candidateBitscore > currentBitscore ? candidate : current;
  const currentIdentity = Number(current.pident) || 0;
  const candidateIdentity = Number(candidate.pident) || 0;
  if (candidateIdentity !== currentIdentity) return candidateIdentity > currentIdentity ? candidate : current;
  const currentCoverage = Number(current.qcovs) || 0;
  const candidateCoverage = Number(candidate.qcovs) || 0;
  if (candidateCoverage !== currentCoverage) return candidateCoverage > currentCoverage ? candidate : current;
  return String(candidate.pdbId ?? '').localeCompare(String(current.pdbId ?? '')) < 0 ? candidate : current;
}

function buildBlastMatchIndex(rows) {
  return rows.reduce((index, row) => {
    const key = normalizeStructureMatchLabel(row.queryLabel);
    if (!key) return index;
    const entries = index.get(key) || [];
    entries.push(row);
    index.set(key, entries);
    return index;
  }, new Map());
}

const structureDatasetOrder = new Map([
  ['puzzle', 0],
  ['general', 1],
  ['riboswitches', 2],
  ['rna-structure', 3],
  ['eterna', 4],
  ['other', 5]
]);

function normalizeStructureDataset(value) {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('puzzle')) return 'puzzle';
  if (text.includes('general')) return 'general';
  if (text.includes('riboswitch')) return 'riboswitches';
  if (text.includes('rnastructure')) return 'rna-structure';
  if (text.includes('eterna')) return 'eterna';
  return 'other';
}

function compareStructureRows(a, b) {
  const identityDiff = (Number(b.bestIdentity) || 0) - (Number(a.bestIdentity) || 0);
  if (identityDiff !== 0) return identityDiff;
  const coverageDiff = (Number(b.bestCoverage) || 0) - (Number(a.bestCoverage) || 0);
  if (coverageDiff !== 0) return coverageDiff;
  const evalueDiff = parseScientificValue(a.bestEvalue) - parseScientificValue(b.bestEvalue);
  if (evalueDiff !== 0) return evalueDiff;
  const nameDiff = (a.name || a.foldBridgeId).localeCompare(b.name || b.foldBridgeId);
  if (nameDiff !== 0) return nameDiff;
  return a.foldBridgeId.localeCompare(b.foldBridgeId);
}

function buildStructureEntryRows(rows) {
  const grouped = new Map();

  rows
    .filter((row) => row.hasPdbMatch)
    .forEach((row) => {
      const groupKey = row.structureGroupKey || normalizeStructureMatchLabel(row.name) || row.foldBridgeId;
      const existing = grouped.get(groupKey);

      if (!existing) {
        grouped.set(groupKey, {
          representative: row,
          relatedRecords: [row]
        });
        return;
      }

      existing.relatedRecords.push(row);

      const current = existing.representative;
      const currentEvalue = parseScientificValue(current.bestEvalue);
      const candidateEvalue = parseScientificValue(row.bestEvalue);
      if (candidateEvalue < currentEvalue) {
        existing.representative = row;
        return;
      }

      if (candidateEvalue === currentEvalue) {
        const currentIdentity = Number(current.bestIdentity) || 0;
        const candidateIdentity = Number(row.bestIdentity) || 0;
        if (candidateIdentity > currentIdentity) {
          existing.representative = row;
          return;
        }

        if (candidateIdentity === currentIdentity) {
          const currentCoverage = Number(current.bestCoverage) || 0;
          const candidateCoverage = Number(row.bestCoverage) || 0;
          if (candidateCoverage > currentCoverage) {
            existing.representative = row;
            return;
          }

          if (candidateCoverage === currentCoverage && row.foldBridgeId.localeCompare(current.foldBridgeId) < 0) {
            existing.representative = row;
          }
        }
      }
    });

  return [...grouped.entries()]
    .map(([groupKey, { representative, relatedRecords }]) => {
      const preferredId = preferredStructureRepresentativeIds.get(groupKey);
      const sortedRelatedRecords = [...relatedRecords].sort(compareStructureRows);
      const preferredRecord = preferredId
        ? sortedRelatedRecords.find((record) => record.foldBridgeId === preferredId)
        : null;
      const finalRepresentative = preferredRecord || representative;

      return {
        ...finalRepresentative,
        relatedRecords: sortedRelatedRecords,
        relatedRecordCount: sortedRelatedRecords.length,
        detailPage: `#structure-detail?foldBridgeId=${encodeURIComponent(finalRepresentative.foldBridgeId)}`
      };
    })
    .sort((a, b) => {
      const dotBracketDiff = Number(Boolean(String(b.sourceStructure || '').trim())) - Number(Boolean(String(a.sourceStructure || '').trim()));
      if (dotBracketDiff !== 0) return dotBracketDiff;

      const secondaryStructureDiff = Number(structureHasSecondaryStructure(b)) - Number(structureHasSecondaryStructure(a));
      if (secondaryStructureDiff !== 0) return secondaryStructureDiff;

      const datasetOrderDiff =
        (structureDatasetOrder.get(a.structureDatasetGroup) ?? structureDatasetOrder.get('other')) -
        (structureDatasetOrder.get(b.structureDatasetGroup) ?? structureDatasetOrder.get('other'));
      if (datasetOrderDiff !== 0) return datasetOrderDiff;
      return compareStructureRows(a, b);
    });
}

function formatBlastPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  return `${numeric.toFixed(1)}%`;
}

function hasPairedSecondaryStructureText(structure) {
  return /[()[\]{}<>]/.test(String(structure || ''));
}

function getPredictedSecondaryStructure(row) {
  return reactivityGuidedStructurePredictions.get(row?.foldBridgeId) || null;
}

function usesReactivityGuidedWorkflow(row) {
  const predicted = getPredictedSecondaryStructure(row);
  if (!predicted) return false;
  return (
    forceReactivityGuidedWorkflowIds.has(row?.foldBridgeId)
    || !hasPairedSecondaryStructureText(String(row?.sourceStructure || '').trim())
  );
}

function getDisplaySecondaryStructure(row) {
  const sourceStructure = String(row?.sourceStructure || '').trim();
  if (usesReactivityGuidedWorkflow(row)) {
    return getPredictedSecondaryStructure(row)?.structure || sourceStructure;
  }
  if (hasPairedSecondaryStructureText(sourceStructure)) return sourceStructure;
  return getPredictedSecondaryStructure(row)?.structure || sourceStructure;
}

function structureHasSecondaryStructure(row) {
  return hasPairedSecondaryStructureText(getDisplaySecondaryStructure(row));
}

function formatBlastEvalue(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (numeric === 0) return '0.00';
  if (/e/i.test(String(value)) || Math.abs(numeric) < 0.01 || Math.abs(numeric) >= 100) {
    return numeric.toExponential(2).replace('e+', 'e');
  }
  return numeric.toFixed(2);
}

function normalizeSequenceForMetrics(sequence) {
  return String(sequence ?? '')
    .toUpperCase()
    .replace(/T/g, 'U')
    .replace(/[^AUGC]/g, '');
}

function parseStructurePairs(structure) {
  const openToClose = { '(': ')', '[': ']', '{': '}', '<': '>' };
  const closeToOpen = Object.fromEntries(Object.entries(openToClose).map(([open, close]) => [close, open]));
  const stacks = Object.fromEntries(Object.keys(openToClose).map((key) => [key, []]));
  const pairs = new Map();

  String(structure ?? '')
    .replace(/\s+/g, '')
    .split('')
    .forEach((char, index) => {
      if (openToClose[char]) {
        stacks[char].push(index);
        return;
      }
      const opener = closeToOpen[char];
      if (!opener || !stacks[opener].length) return;
      const partner = stacks[opener].pop();
      pairs.set(index, partner);
      pairs.set(partner, index);
    });

  return pairs;
}

function countStructureStems(structure) {
  const pairs = parseStructurePairs(structure);
  const seen = new Set();
  let stemCount = 0;

  [...pairs.keys()]
    .filter((index) => index < pairs.get(index))
    .sort((a, b) => a - b)
    .forEach((left) => {
      if (seen.has(left)) return;
      stemCount += 1;
      let currentLeft = left;
      let currentRight = pairs.get(left);
      while (pairs.get(currentLeft) === currentRight) {
        seen.add(currentLeft);
        seen.add(currentRight);
        currentLeft += 1;
        currentRight -= 1;
      }
    });

  return stemCount;
}

function parseSequenceLength(sequenceText) {
  return normalizeSequenceForMetrics(sequenceText).length || 0;
}

function estimateGlobalFoldSimilarity(row, secondaryStructure) {
  if (!hasUsablePredictedStructure(row?.foldBridgeId) || !structureHasSecondaryStructure(row)) {
    return { label: 'Unavailable', note: 'Predicted 3D model or secondary-structure constraints are missing.' };
  }

  const identity = Number(row?.bestIdentity) || 0;
  const coverage = Number(row?.bestCoverage) || 0;
  const stemCount = countStructureStems(secondaryStructure);
  const sequenceLength = parseSequenceLength(row?.sourceSequence || row?.sequence || '');

  if (identity >= 95 && coverage >= 95 && stemCount >= 4 && sequenceLength >= 80) {
    return { label: 'High', note: 'Estimated from very strong sequence match, full coverage, and a well-defined multi-stem fold.' };
  }
  if (identity >= 85 && coverage >= 80 && stemCount >= 3) {
    return { label: 'Medium', note: 'Estimated from good sequence match and a secondary structure likely to preserve the global topology.' };
  }
  return { label: 'Exploratory', note: 'Use visual comparison only; the current constraints are weaker for claiming a shared global fold.' };
}

function applyCuratedStructureOverrides(row) {
  if (!row?.foldBridgeId) return row;
  const override = curatedStructureOverrides.get(row.foldBridgeId);
  if (!override) return row;
  return {
    ...row,
    ...override,
    sourceStructure: override.sourceStructure ?? row.sourceStructure
  };
}

function renderPdbExternalLink(pdbId) {
  if (!pdbId) return 'N/A';
  const safePdbId = encodeURIComponent(pdbId);
  return `<a href="https://www.rcsb.org/structure/${safePdbId}" target="_blank" rel="noopener noreferrer" class="sequence-link pdb-external-link" title="Open in RCSB PDB">${pdbId}<span class="pdb-external-link-icon" aria-hidden="true">↗</span></a>`;
}

function summarizePdbMatch(row) {
  if (!row.bestPdbId) return 'Not matched';
  if (row.pdbIds.length <= 1) return row.bestPdbId;
  return `${row.bestPdbId} (+${row.pdbIds.length - 1})`;
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(current);
      current = '';
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

function parseTsv(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length);
  if (!lines.length) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const values = line.split('\t');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function trimRdatSuffix(value) {
  return String(value ?? '').replace(/\.rdat$/i, '');
}

function inferFileCodeFromSourceFile(sourceFile) {
  const tokens = trimRdatSuffix(sourceFile).split('_');
  return tokens[1] || '';
}

function inferModifierFromSupplementRow(row) {
  const annotation = String(row.source_sequence_type ?? '').toLowerCase();
  if (annotation.includes('modifier:1m7')) return '1M7';
  if (annotation.includes('mutation:wt')) return 'SHAPE';
  if (annotation.includes('chemical:atp')) return 'ATP';

  const fileCode = inferFileCodeFromSourceFile(row.source_file).toUpperCase();
  if (['1M7', 'DMS', 'CMC', 'CMCT', 'HRF', 'NMD', 'ALG', 'STD'].includes(fileCode)) return fileCode;
  return '';
}

function expandSpeciesAbbreviation(species) {
  const clean = String(species || '').trim().replace(/_/g, ' ').toLowerCase();
  const map = {
    'pputida': 'Pseudomonas putida',
    'p putida': 'Pseudomonas putida',
    'e coli': 'Escherichia coli',
    'b subtilis': 'Bacillus subtilis',
    'o sativa': 'Oryza sativa',
    'y pseudotuberculosis': 'Yersinia pseudotuberculosis',
    'yeast': 'Saccharomyces cerevisiae',
    'human': 'Homo sapiens',
    'mouse': 'Mus musculus'
  };
  return map[clean] || species;
}

function formatRaspRecordName(sourceName, pdbId) {
  const name = String(sourceName || '').trim();
  const cleanPdb = String(pdbId || '').toLowerCase().replace(/_[a-z0-9]+$/i, '').trim();

  // 1. Map raw coords or IDs to clean RNA names using matched PDB ID
  const pdbToName = {
    '1xjr': 'SARS-CoV-2 s2m element',
    '7b9v': 'U6 snRNA',
    '6spg': '5S rRNA',
    '8t5h': '5S rRNA',
    '8rgw': '16S rRNA',
    '8rwg': '16S rRNA',
    '9n2c': '16S rRNA',
    '8buu': '16S rRNA',
    '9ss6': '16S rRNA',
    '7unw': '23S rRNA',
    '7nbu': '23S rRNA',
    '3j3w': '23S rRNA',
    '8vsa': 'tmRNA',
    '7uo5': 'tmRNA',
    '7pnw': 'Mitochondrial 12S rRNA',
    '7l08': 'Mitochondrial 12S rRNA',
    '3jcr': '7SL RNA (SRP RNA)',
    '8jiw': '18S rRNA',
    '9evt': '18S rRNA',
    '5x8r': '18S rRNA',
    '9si0': '5.8S rRNA'
  };

  if (pdbToName[cleanPdb]) {
    return pdbToName[cleanPdb];
  }

  // Handle specific tRNAs by locus/transcript name or PDB
  const isTrna = 
    /^[4689][a-z0-9]{3}/.test(cleanPdb) || 
    /trna/i.test(name) ||
    /RS02040|RS03150|RS03155|RS03315|RS03325|RS06225|RS08755|RS09650/i.test(name) ||
    /EBT00049907297|EBT00049907359|EBT00049907667|2IZe0JzJzkFApyV|75SfIwioE-pBoQo|IlICJX4O9Pa4-Mj|W_9xYfxP6Mp8nHP|8XT3|8CBO|8RR3|8Z1G|6ZM6/i.test(name);

  if (isTrna) {
    if (/RS03315|5LZF|9LPC|8XT3/i.test(name)) return 'tRNA-Ala';
    if (/RS03150|EBT00049907297|8Z1G/i.test(name)) return 'tRNA-Gly';
    if (/RS02040|RS03155|RS08755|RS09650|EBT00049907359|EBT00049907667|75Sf|8RR3|1EFW/i.test(name)) return 'tRNA-Phe';
    if (/RS03325|2IZe0J|9SLZ/i.test(name)) return 'tRNA-Thr';
    if (/RS06225|9TEX/i.test(name)) return 'tRNA-Met';
    if (/8CBO|6ZM6/i.test(name)) return 'tRNA-Asn';
    return 'tRNA';
  }

  // 2. If it is a transcript name, strip prefix and format
  let cleanName = name.replace(/^transcript:/i, '');
  if (cleanName.endsWith('_rRNA') || cleanName.endsWith('_snRNA') || cleanName.endsWith('_snoRNA') || cleanName.endsWith('_ncRNA') || cleanName.endsWith('_tRNA')) {
    if (cleanName === 'LSR1_snRNA') return 'LSR1 snRNA (U2 snRNA)';
    if (cleanName === 'snR14_snRNA') return 'snR14 snRNA (U4 snRNA)';
    if (cleanName === 'snR17a_snoRNA') return 'snR17a snoRNA (U3 snoRNA)';
    if (cleanName === 'snR17b_snoRNA') return 'snR17b snoRNA (U3 snoRNA)';
    if (cleanName === 'snR19_snRNA') return 'snR19 snRNA (U1 snRNA)';
    if (cleanName === 'snR6-L_snRNA') return 'snR6-L snRNA (U6 snRNA)';
    if (cleanName === 'snR7-L_snRNA') return 'snR7-L snRNA (U5 snRNA)';
    if (cleanName === 'snR7-S_snRNA') return 'snR7-S snRNA (U5 snRNA)';

    if (cleanName.startsWith('tA(AGC)D_')) return 'tRNA-Ala (tA(AGC)D)';
    if (cleanName.startsWith('tA(UGC)A_')) return 'tRNA-Ala (tA(UGC)A)';
    if (cleanName.startsWith('tC(GCA)B_')) return 'tRNA-Cys (tC(GCA)B)';
    if (cleanName.startsWith('tD(GUC)B_')) return 'tRNA-Asp (tD(GUC)B)';
    if (cleanName.startsWith('tG(GCC)C_')) return 'tRNA-Gly (tG(GCC)C)';
    if (cleanName.startsWith('tM(CAU)C_')) return 'tRNA-Met (tM(CAU)C)';
    if (cleanName.startsWith('tR(ACG)D_')) return 'tRNA-Arg (tR(ACG)D)';
    if (cleanName.startsWith('tT(UGU)Q1_')) return 'tRNA-Thr (tT(UGU)Q1)';

    return cleanName.replace(/_/g, ' ');
  }

  return cleanName;
}

function getPdbDiscoveryYear(pdbId) {
  const clean = String(pdbId || '').toLowerCase().trim();
  const map = {
    '1xjr': '2004',
    '1efw': '1996',
    '3epl': '2008',
    '3j3w': '2013',
    '3jcr': '2016',
    '486d': '1997',
    '4wj4': '2015',
    '4yye': '2015',
    '5lzf': '2017',
    '5x8r': '2017',
    '5zwm': '2018',
    '6ah3': '2018',
    '6exn': '2018',
    '6gsk': '2019',
    '6spg': '2019',
    '6w6v': '2020',
    '6zm6': '2020',
    '7b9v': '2021',
    '7l08': '2020',
    '7nbu': '2022',
    '7pnw': '2022',
    '7r81': '2022',
    '7unw': '2022',
    '7uo5': '2022',
    '8asw': '2023',
    '8buu': '2023',
    '8cbo': '2023',
    '8rgw': '2023',
    '8rwg': '2023',
    '8rr3': '2023',
    '8s1u': '2023',
    '8t5h': '2023',
    '8uti': '2024',
    '8v87': '2023',
    '8vsa': '2023',
    '8w2o': '2023',
    '8xt3': '2024',
    '8yus': '2024',
    '8z1g': '2024',
    '8ztv': '2024',
    '8zyd': '2024',
    '9bdp': '2024',
    '9dtr': '2024',
    '9evt': '2024',
    '9g28': '2024',
    '9hm5': '2024',
    '9lpc': '2024',
    '9n2c': '2024',
    '9n78': '2024',
    '9n7b': '2024',
    '9si0': '2024',
    '9slz': '2024',
    '9ss6': '2025',
    '9tex': '2025',
    '9zxr': '2026'
  };
  if (map[clean]) return map[clean];

  const first = clean.charAt(0);
  if (first === '9') return '2024';
  if (first === '8') return '2023';
  if (first === '7') return '2021';
  if (first === '6') return '2019';
  if (first === '5') return '2016';
  if (first === '4') return '2012';
  if (first === '3') return '2008';
  if (first === '2') return '2004';
  if (first === '1') return '1998';
  return '';
}

function buildSupplementStructureRows(rows, existingIds = new Set()) {
  return rows
    .map((row) => {
      const explicitFoldBridgeId = String(row.foldbridge_id ?? row.foldBridgeId ?? '').trim();
      const sourceStem = trimRdatSuffix(row.source_file || explicitFoldBridgeId.replace(/^(?:RMDB|RASP)_/, ''));
      const foldBridgeId = explicitFoldBridgeId || (sourceStem ? `RMDB_${sourceStem}` : '');
      if (!foldBridgeId || existingIds.has(foldBridgeId)) return null;

      const sequenceLength = String(row.source_sequence_length ?? '').trim();
      const sequenceText = String(row.source_sequence ?? '').trim();
      const nameParts = splitNameAndSpecies(row.source_name || '');
      const isRasp = foldBridgeId.startsWith('RASP_');

      let nameVal = nameParts.name || row.source_name || '';
      let speciesVal = nameParts.species || '';

      if (isRasp) {
        nameVal = formatRaspRecordName(row.source_name, row.pdb_id || row.bestPdbId);
        if (!speciesVal && row.source_annotation_data_id) {
          speciesVal = expandSpeciesAbbreviation(row.source_annotation_data_id);
        }
      }

      const matchedPdb = row.pdb_id || row.bestPdbId || '';
      const yearVal = matchedPdb ? getPdbDiscoveryYear(matchedPdb) : '';

      return {
        foldBridgeId,
        name: nameVal,
        species: speciesVal,
        discoveryYear: yearVal,
        sequence: sequenceText && sequenceLength ? `${sequenceText} (${sequenceLength}nt)` : sequenceText,
        length: sequenceLength ? `${sequenceLength}nt` : '',
        structureGroupKey: `${normalizeStructureMatchLabel(row.source_name || sourceStem)}::${sequenceLength || sourceStem}`,
        fileCode: inferFileCodeFromSourceFile(row.source_file),
        experimentType: '',
        modifier: inferModifierFromSupplementRow(row),
        hasPdbMatch: Boolean(row.pdb_id),
        pdbMatchCount: row.pdb_id ? 1 : 0,
        pdbIds: row.pdb_id ? [String(row.pdb_id).toUpperCase()] : [],
        bestPdbId: row.pdb_id ? String(row.pdb_id).toUpperCase() : '',
        bestSubjectId: row.sseqid || '',
        bestEvalue: row.evalue || '',
        bestIdentity: row.pident || '',
        bestCoverage: row.qcovs || '',
        structureDatasetGroup: normalizeStructureDataset(row.dataset),
        rdatPath: normalizeRdatAssetName(row.source_file || sourceStem)
          ? dataAssetPath(normalizeRdatAssetName(row.source_file || sourceStem))
          : '',
        hasLocalRdat: Boolean(normalizeRdatAssetName(row.source_file || sourceStem)),
        sourceStructure: String(row.source_structure ?? '').trim(),
        sourceSequence: sequenceText
      };
    })
    .filter(Boolean);
}

function parseFasta(text) {
  const records = [];
  let current = null;

  String(text ?? '')
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (trimmed.startsWith('>')) {
        if (current) {
          current.sequence = current.sequence.join('');
          current.length = current.sequence.length;
          records.push(current);
        }
        const header = trimmed.slice(1).trim();
        const [id = 'sequence'] = header.split(/\s+/);
        current = {
          id,
          header,
          sequence: []
        };
        return;
      }

      if (current) current.sequence.push(trimmed);
    });

  if (current) {
    current.sequence = current.sequence.join('');
    current.length = current.sequence.length;
    records.push(current);
  }

  return records;
}

function humanizeCaseToken(value) {
  return String(value ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatCaseBoolean(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Unknown';
}

function formatFractionPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'N/A';
  return `${(numeric * 100).toFixed(1)}%`;
}

function formatCaseDetailValue(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value === 'boolean') return formatCaseBoolean(value);
  return String(value);
}

function caseBundleFilePath(caseId, fileName) {
  return `./${CASE_BUNDLE_ROOT}/${encodeURIComponent(caseId)}/${fileName}`;
}

function chooseBetterAlignmentRow(current, candidate) {
  if (!current) return candidate;
  const currentBitscore = Number(current.bitscore) || 0;
  const candidateBitscore = Number(candidate.bitscore) || 0;
  if (candidateBitscore !== currentBitscore) return candidateBitscore > currentBitscore ? candidate : current;
  const currentIdentity = Number(current.identity_fraction) || 0;
  const candidateIdentity = Number(candidate.identity_fraction) || 0;
  if (candidateIdentity !== currentIdentity) return candidateIdentity > currentIdentity ? candidate : current;
  const currentCoverage = Number(current.rmdb_query_coverage) || 0;
  const candidateCoverage = Number(candidate.rmdb_query_coverage) || 0;
  return candidateCoverage > currentCoverage ? candidate : current;
}

function buildCaseDetailData(caseJson, pdbFastaText, rmdbFastaText, alignmentPairSummaryText) {
  const pdbSequences = parseFasta(pdbFastaText);
  const rmdbFastaRecords = parseFasta(rmdbFastaText);
  const rmdbSequenceMap = new Map(rmdbFastaRecords.map((record) => [record.id, record]));
  const alignmentRows = parseTsv(alignmentPairSummaryText);
  const rmdbSummaryMap = new Map();

  alignmentRows.forEach((row) => {
    const rmdbUniqueId = row.rmdb_unique_id || row.source_sequence_id || 'unknown';
    const existing = rmdbSummaryMap.get(rmdbUniqueId);
    const bestRow = chooseBetterAlignmentRow(existing?.bestRow, row);
    const sequence = row.rmdb_sequence || row.bundle_sequence || rmdbSequenceMap.get(rmdbUniqueId)?.sequence || '';
    rmdbSummaryMap.set(rmdbUniqueId, {
      rmdbUniqueId,
      sequence,
      length: sequence.length || Number(rmdbSequenceMap.get(rmdbUniqueId)?.length) || 0,
      pairCount: (existing?.pairCount || 0) + 1,
      bestRow
    });
  });

  if (!rmdbSummaryMap.size) {
    rmdbFastaRecords.forEach((record) => {
      rmdbSummaryMap.set(record.id, {
        rmdbUniqueId: record.id,
        sequence: record.sequence,
        length: record.length,
        pairCount: 1,
        bestRow: null
      });
    });
  }

  const rmdbSequences = [...rmdbSummaryMap.values()]
    .map((item) => ({
      rmdbUniqueId: item.rmdbUniqueId,
      sequence: item.sequence,
      length: item.length,
      pairCount: item.pairCount,
      pdbReferenceId: item.bestRow?.pdb_reference_id || '',
      identityFraction: Number(item.bestRow?.identity_fraction || 0),
      rmdbQueryCoverage: Number(item.bestRow?.rmdb_query_coverage || 0),
      pdbSubjectCoverage: Number(item.bestRow?.pdb_subject_coverage || 0),
      alignmentLength: Number(item.bestRow?.alignment_length || 0),
      bitscore: Number(item.bestRow?.bitscore || 0)
    }))
    .sort((a, b) => {
      if (b.pairCount !== a.pairCount) return b.pairCount - a.pairCount;
      if (b.identityFraction !== a.identityFraction) return b.identityFraction - a.identityFraction;
      if (b.length !== a.length) return b.length - a.length;
      return a.rmdbUniqueId.localeCompare(b.rmdbUniqueId);
    });

  return {
    pdbId: caseJson.pdb_id,
    caseInfo: caseJson,
    pdbSequences,
    rmdbSequences
  };
}

async function ensureCaseDetailLoaded(caseId) {
  if (!caseId || caseDetailCache.has(caseId) || caseDetailLoading.has(caseId)) return;
  caseDetailLoading.add(caseId);

  try {
    const [caseJsonResponse, pdbFastaResponse, rmdbFastaResponse, alignmentSummaryResponse] = await Promise.all([
      fetch(caseBundleFilePath(caseId, 'case.json')),
      fetch(caseBundleFilePath(caseId, 'pdb.fasta')),
      fetch(caseBundleFilePath(caseId, 'rmdb.fasta')),
      fetch(caseBundleFilePath(caseId, 'alignment_pair_summary.tsv'))
    ]);

    if (!caseJsonResponse.ok) throw new Error(`Failed to load case.json for ${caseId}`);
    if (!pdbFastaResponse.ok) throw new Error(`Failed to load pdb.fasta for ${caseId}`);
    if (!rmdbFastaResponse.ok) throw new Error(`Failed to load rmdb.fasta for ${caseId}`);
    if (!alignmentSummaryResponse.ok) throw new Error(`Failed to load alignment_pair_summary.tsv for ${caseId}`);

    const [caseJson, pdbFastaText, rmdbFastaText, alignmentSummaryText] = await Promise.all([
      caseJsonResponse.json(),
      pdbFastaResponse.text(),
      rmdbFastaResponse.text(),
      alignmentSummaryResponse.text()
    ]);

    caseDetailCache.set(caseId, buildCaseDetailData(caseJson, pdbFastaText, rmdbFastaText, alignmentSummaryText));
  } catch (error) {
    console.error(error);
    caseDetailCache.set(caseId, {
      error: true,
      message: error instanceof Error ? error.message : 'Failed to load case detail'
    });
  } finally {
    caseDetailLoading.delete(caseId);
    if (route === 'case-detail' && getCaseIdFromHash() === caseId) {
      render({ preserveScroll: true });
    }
  }
}

async function loadBrowseEntryRows() {
  try {
    const [summaryResponse, supplementResponse, resultsResponse] = await Promise.all([
      fetch(dataAssetPath('rdat_summary.csv')),
      fetch(dataAssetPath('structure_page_supplement.tsv')),
      fetch(dataAssetPath('structure_page_results.tsv'))
    ]);
    if (!summaryResponse.ok) throw new Error('Failed to load RDAT summary');
    if (!supplementResponse.ok) throw new Error('Failed to load structure supplement');
    if (!resultsResponse.ok) throw new Error('Failed to load structure results supplement');

    const [summaryText, supplementText, resultsText] = await Promise.all([
      summaryResponse.text(),
      supplementResponse.text(),
      resultsResponse.text()
    ]);
    const [header, ...records] = parseCsv(summaryText);
    if (!header?.length) {
      browseEntryRows = [];
      return;
    }

    const blastMatchIndex = buildBlastMatchIndex(rmdbPdbBlastRows);

    browseEntryRows = records.map((record) => {
      const row = Object.fromEntries(header.map((key, index) => [key, record[index] ?? '']));
      const matchKey = normalizeStructureMatchLabel(row.Name || '');
      const nameParts = splitNameAndSpecies(row.Name || '');
      const blastMatches = blastMatchIndex.get(matchKey) || [];
      const bestMatch = blastMatches.reduce((best, candidate) => choosePreferredBlastHit(best, candidate), null);
      const pdbIds = [...new Set(blastMatches.map((item) => item.pdbId).filter(Boolean))].sort();
      return {
        foldBridgeId: row['FoldBridge ID'] || '',
        name: nameParts.name || row.Name || '',
        species: nameParts.species || '',
        discoveryYear: puzzleDiscoveryYears.get(matchKey) || 'N/A',
        sequence: row.Sequence || '',
        length: row.Length || '',
        structureGroupKey: matchKey || row['FoldBridge ID'] || '',
        fileCode: row['File Code'] || '',
        experimentType: row['Experiment Type'] || '',
        modifier: row.Modifier || '',
        hasPdbMatch: Boolean(bestMatch),
        pdbMatchCount: blastMatches.length,
        pdbIds,
        bestPdbId: bestMatch?.pdbId || '',
        bestSubjectId: bestMatch?.subjectId || '',
        bestEvalue: bestMatch?.evalue || '',
        bestIdentity: bestMatch?.pident || '',
        bestCoverage: bestMatch?.qcovs || '',
        structureDatasetGroup: 'puzzle',
        rdatPath: dataAssetPath(`${(row['FoldBridge ID'] || '').replace(/^RMDB_/, '')}.rdat`),
        hasLocalRdat: true
      };
    });
    const existingIds = new Set(browseEntryRows.map((row) => row.foldBridgeId).filter(Boolean));
    const supplementRows = [
      ...buildSupplementStructureRows(parseTsv(supplementText), existingIds),
      ...buildSupplementStructureRows(parseTsv(resultsText), existingIds)
    ];
    browseEntryRows = [...browseEntryRows, ...supplementRows].map(applyCuratedStructureOverrides);
    browseEntryRows.forEach((row, idx) => {
      row.index = idx + 1;
    });
    structureEntryRows = buildStructureEntryRows(browseEntryRows);
  } catch (error) {
    console.error(error);
    browseEntryRows = [];
    structureEntryRows = [];
  }
}

async function loadCase3dRows() {
  case3dRows = Array.isArray(caseManifest) ? caseManifest : [];
}

function rdatDownloadPath(foldBridgeId) {
  const row = browseEntryRows.find((item) => item.foldBridgeId === foldBridgeId);
  return row?.rdatPath || '';
}

function downloadSelectedRdatFiles(selectedIds = [...selectedBrowseIds]) {
  selectedIds.forEach((foldBridgeId, index) => {
    const downloadPath = rdatDownloadPath(foldBridgeId);
    if (!downloadPath) return;
    const link = document.createElement('a');
    link.href = downloadPath;
    link.download = `${foldBridgeId.replace(/^RMDB_/, '')}.rdat`;
    link.style.display = 'none';
    document.body.appendChild(link);
    window.setTimeout(() => {
      link.click();
      link.remove();
    }, index * 120);
  });
}

function bindPseudoButton(element, handler) {
  if (!element || element.getAttribute('aria-disabled') === 'true') return;
  element.addEventListener('click', handler);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler();
    }
  });
}

function clampPage(value, totalPages) {
  return Math.min(Math.max(value, 1), totalPages);
}

function parseLengthValue(value) {
  const numeric = Number.parseInt(String(value ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeModifierValue(value) {
  return String(value ?? '').trim() || 'Unspecified';
}

function searchMatchesLengthBand(row, band) {
  const length = parseLengthValue(row.length);
  if (!length || band === 'all') return band === 'all';
  if (band === 'short') return length < 60;
  if (band === 'medium') return length >= 60 && length <= 100;
  if (band === 'long') return length > 100;
  return true;
}

function scoreSearchRow(row, query) {
  if (!query) return 0;
  const terms = query.split(/\s+/).filter(Boolean);
  const haystacks = {
    index: String(row.index ?? '').toLowerCase(),
    foldBridgeId: String(row.foldBridgeId ?? '').toLowerCase(),
    name: String(row.name ?? '').toLowerCase(),
    sequence: String(row.sequence ?? '').toLowerCase(),
    fileCode: String(row.fileCode ?? '').toLowerCase(),
    experimentType: String(row.experimentType ?? '').toLowerCase(),
    modifier: normalizeModifierValue(row.modifier).toLowerCase(),
    species: String(row.species ?? '').toLowerCase(),
    year: String(row.discoveryYear ?? '').toLowerCase(),
    bestPdbId: String(row.bestPdbId ?? '').toLowerCase()
  };

  return terms.reduce((score, term) => {
    // Perfect match boosts
    if (haystacks.index === term) return score + 200;
    if (haystacks.foldBridgeId === term) return score + 160;
    if (haystacks.bestPdbId === term) return score + 140;
    if (haystacks.name === term) return score + 120;
    if (haystacks.species === term) return score + 100;
    if (haystacks.year === term) return score + 90;
    
    // Partial inclusion matches
    if (haystacks.foldBridgeId.includes(term)) return score + 110;
    if (haystacks.name.includes(term)) return score + 80;
    if (haystacks.species.includes(term)) return score + 70;
    if (haystacks.year.includes(term)) return score + 60;
    if (haystacks.bestPdbId.includes(term)) return score + 50;
    if (haystacks.fileCode.includes(term)) return score + 42;
    if (haystacks.experimentType.includes(term)) return score + 34;
    if (haystacks.modifier.includes(term)) return score + 24;
    if (haystacks.sequence.includes(term)) return score + 18;
    
    return score;
  }, 0);
}

function getAdvancedSearchOptions() {
  const experimentTypes = [...new Set(browseEntryRows.map((row) => row.experimentType).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
  const modifiers = [...new Set(browseEntryRows.map((row) => normalizeModifierValue(row.modifier)))].sort((a, b) =>
    a.localeCompare(b)
  );
  return { experimentTypes, modifiers };
}

function getAdvancedSearchRows() {
  const query = advancedSearchQuery.trim().toLowerCase();
  if (!query) return [];

  const rows = browseEntryRows
    .map((row) => ({
      ...row,
      modifierLabel: normalizeModifierValue(row.modifier),
      lengthValue: parseLengthValue(row.length),
      relevanceScore: scoreSearchRow(row, query)
    }))
    .filter((row) => {
      if (query && row.relevanceScore <= 0) return false;
      if (advancedSearchExperiment !== 'all' && row.experimentType !== advancedSearchExperiment) return false;
      if (advancedSearchModifier !== 'all' && row.modifierLabel !== advancedSearchModifier) return false;
      if (!searchMatchesLengthBand(row, advancedSearchLengthBand)) return false;
      return true;
    });

  rows.sort((a, b) => {
    if (advancedSearchSort === 'name') return a.name.localeCompare(b.name);
    if (advancedSearchSort === 'length') return (b.lengthValue || 0) - (a.lengthValue || 0) || a.name.localeCompare(b.name);
    if (advancedSearchSort === 'experiment') {
      return a.experimentType.localeCompare(b.experimentType) || a.name.localeCompare(b.name);
    }
    return b.relevanceScore - a.relevanceScore || a.name.localeCompare(b.name);
  });

  return rows;
}

function renderAdvancedSearchFilterPills() {
  const pills = [];
  if (advancedSearchExperiment !== 'all') pills.push(`Experiment: ${advancedSearchExperiment}`);
  if (advancedSearchModifier !== 'all') pills.push(`Modifier: ${advancedSearchModifier}`);
  if (advancedSearchLengthBand !== 'all') {
    const labels = { short: '< 60 nt', medium: '60-100 nt', long: '> 100 nt' };
    pills.push(`Length: ${labels[advancedSearchLengthBand]}`);
  }
  if (!pills.length) return '<span class="search-filter-empty">No active filters</span>';
  return pills.map((pill) => `<span class="search-filter-pill">${pill}</span>`).join('');
}

function renderAdvancedSearchResults(rows) {
  if (!advancedSearchQuery.trim()) {
    return `<div class="search-empty-state">
      <h3>No results yet</h3>
      <p>Start typing a record name, sequence fragment, FoldBridge ID, or experiment keyword to search the database.</p>
    </div>`;
  }

  if (!rows.length) {
    return `<div class="search-empty-state">
      <h3>No matching records</h3>
      <p>Try a different name, sequence fragment, target code, or relax the filters above.</p>
    </div>`;
  }

  if (advancedSearchView === 'grid') {
    return `<div class="search-card-grid">
      ${rows
        .map(
          (row) => {
            const detailUrl = `#structure-detail?foldBridgeId=${encodeURIComponent(row.foldBridgeId)}`;
            return `<article class="search-result-card">
              <div class="search-result-card-top">
                <span class="search-record-id"><a href="${detailUrl}" class="sequence-link">${row.foldBridgeId}</a></span>
                <span class="search-record-code">No. ${row.index}</span>
              </div>
              <h3>${row.name || 'Untitled record'}</h3>
              <p class="search-result-sequence" title="${row.sequence || ''}">${row.sequence || 'Sequence unavailable'}</p>
              <dl class="search-result-meta">
                <div><dt>Species</dt><dd>${row.species || 'N/A'}</dd></div>
                <div><dt>Discovery Year</dt><dd>${row.discoveryYear || 'N/A'}</dd></div>
                <div><dt>PDB ID</dt><dd>${row.bestPdbId ? renderPdbExternalLink(row.bestPdbId) : 'N/A'}</dd></div>
                <div><dt>Length</dt><dd>${row.length || 'N/A'}</dd></div>
                <div><dt>Experiment</dt><dd>${row.experimentType || 'N/A'}</dd></div>
                <div><dt>Modifier</dt><dd>${row.modifierLabel}</dd></div>
              </dl>
            </article>`;
          }
        )
        .join('')}
    </div>`;
  }

  return `<div class="search-table-wrap">
    <table class="search-results-table case-detail-table">
      <thead>
        <tr>
          <th>No.</th>
          <th>FoldBridge ID</th>
          <th>Name</th>
          <th>Species</th>
          <th>Discovery year</th>
          <th>Sequence</th>
          <th>PDB ID</th>
          <th>Experiment</th>
          <th>Modifier</th>
          <th>Length</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => {
              const detailUrl = `#structure-detail?foldBridgeId=${encodeURIComponent(row.foldBridgeId)}`;
              return `<tr>
                <td class="structure-index-cell">${row.index}</td>
                <td><a href="${detailUrl}" class="sequence-link">${row.foldBridgeId}</a></td>
                <td><strong>${row.name || 'Untitled record'}</strong></td>
                <td>${row.species || 'N/A'}</td>
                <td>${row.discoveryYear || 'N/A'}</td>
                <td><span class="search-sequence-inline" title="${row.sequence || ''}">${row.sequence || 'N/A'}</span></td>
                <td>${renderPdbExternalLink(row.bestPdbId)}</td>
                <td>${row.experimentType || 'N/A'}</td>
                <td>${row.modifierLabel}</td>
                <td>${row.length || 'N/A'}</td>
              </tr>`;
            }
          )
          .join('')}
      </tbody>
    </table>
  </div>`;
}

function renderPageJumpControls(prefix, totalPages, currentPage) {
  return `<div class="browse-page-jump">
    <label class="browse-page-jump-label" for="${prefix}-page-input">Go to</label>
    <input
      id="${prefix}-page-input"
      class="browse-page-jump-input"
      type="number"
      min="1"
      max="${totalPages}"
      step="1"
      value="${currentPage}"
      inputmode="numeric"
    />
    <button
      id="${prefix}-page-go"
      type="button"
      class="download-outline-btn browse-page-jump-btn"
    >
      Go
    </button>
  </div>`;
}

function bindPageJump({ inputId, buttonId, totalPages, getCurrentPage, setCurrentPage }) {
  const input = document.getElementById(inputId);
  const button = document.getElementById(buttonId);
  if (!input || !button) return;

  const submit = () => {
    const rawValue = Number.parseInt(input.value, 10);
    const nextPage = clampPage(Number.isFinite(rawValue) ? rawValue : getCurrentPage(), totalPages());
    if (nextPage === getCurrentPage()) {
      input.value = String(nextPage);
      return;
    }
    setCurrentPage(nextPage);
    render({ preserveScroll: true });
  };

  button.addEventListener('click', submit);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submit();
  });
  input.addEventListener('blur', () => {
    const rawValue = Number.parseInt(input.value, 10);
    input.value = String(clampPage(Number.isFinite(rawValue) ? rawValue : getCurrentPage(), totalPages()));
  });
}



function downloadSequencesPage() {
  const rows = `<tr><td colspan="10" class="entry-table-empty">Sequence records will be added here later.</td></tr>`;

  return `<main class="page-download-sequences">
    ${renderBundleHeader()}
    <section class="card download-card">
      <h1>Sequence</h1>
      <p class="download-intro">This page is reserved for future curated sequence entries.</p>

      <div class="download-table-wrap">
      <table class="structure-table download-table">
        <thead>
          <tr>
            <th>Select</th>
            <th>Name</th>
            <th>Description(PDB)</th>
            <th>Discovery Year</th>
            <th>Category</th>
            <th>Sequence</th>
            <th>Chemical Probing</th>
            <th>PDB ID</th>
            <th>PDB Coverage</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      </div>

      <div class="download-footnote">
        <span>Showing 0 entries</span>
      </div>
    </section>
  </main>`;
}





const routes = ['home', 'browse', 'sequence', 'structure', 'probing', 'download', 'search', 'help'];
let route = routeFromHash(window.location.hash);
let theme = 'blue';
let mode = localStorage.getItem('foldbridge-mode') === 'dark' ? 'dark' : 'light';

function isRouteActive(...names) {
  return names.includes(route);
}

function setTheme(themeKey, modeKey) {
  const styleTag = document.getElementById('theme-vars') ?? document.createElement('style');
  styleTag.id = 'theme-vars';
  styleTag.textContent = `:root { ${cssVarsFor(themeKey, modeKey)} }`;
  document.head.appendChild(styleTag);
  document.body.setAttribute('data-mode', modeKey);
  localStorage.setItem('foldbridge-mode', modeKey);
}

let isDownloadMenuOpen = false;
let isSubnavMenuOpen = false;

function nav() {
  return `<header>
    <div class="black-nav" aria-label="GZNL global navigation">
      <a href="http://www.gznl.org/" target="_blank" rel="noopener noreferrer"><img src="./src/assets/header/home.svg" alt=""/>Home</a>
      <a href="https://www.gznl.org/database/" target="_blank" rel="noopener noreferrer"><img src="./src/assets/header/database.svg" alt=""/>Database</a>
      <a href="https://www.gznl.org/research/" target="_blank" rel="noopener noreferrer"><img src="./src/assets/header/research.svg" alt=""/>Research</a>
      <a href="https://www.gznl.org/aboutus/" target="_blank" rel="noopener noreferrer"><img src="./src/assets/header/aboutus.svg" alt=""/>About us</a>
      <a class="gznl-rdc-link" href="https://gzlab.ac.cn/" target="_blank" rel="noopener noreferrer"><img src="./src/assets/header/gznl2.svg" alt=""/>GZNL-RDC</a>
    </div>
  </header>`;
}



function parseMetricValue(raw) {
  const text = String(raw).trim();
  const multiplier = text.endsWith('M') ? 1_000_000 : text.endsWith('K') ? 1_000 : 1;
  const numeric = Number(text.replace(/[^\d.]/g, '')) * multiplier;
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function formatAnimatedValue(target, original) {
  const text = String(original).trim();
  if (text.endsWith('M')) return `${(target / 1_000_000).toFixed(1)}M`;
  if (text.endsWith('K')) return `${(target / 1_000).toFixed(1)}K`;
  return target.toLocaleString();
}

function initAnimatedStats() {
  const nodes = Array.from(document.querySelectorAll('[data-animate-number="true"]'));
  const duration = 1200;

  nodes.forEach((node) => {
    if (node.dataset.animated === 'true') return;
    const target = Number(node.dataset.target || '0');
    const original = node.dataset.original || '0';
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(target * eased);
      node.textContent = formatAnimatedValue(value, original);
      if (t < 1) requestAnimationFrame(tick);
      else {
        node.textContent = original;
        node.dataset.animated = 'true';
      }
    }

    requestAnimationFrame(tick);
  });
}

function renderFooter() {
  return `<footer class="black-footer">
    <div class="black-footer-inner">
      <div class="footer-stack">
        <div class="footer-row">
          <span>© RNAcentre</span>
          <span class="sep">|</span>
          <a href="https://www.rnacentre.org/" target="_blank" rel="noopener noreferrer">www.rnacentre.org</a>
        </div>
        <div class="footer-row footer-address">
          <span class="footer-heading">Address</span>
          <span class="footer-address-text">Building F, Guangzhou National Laboratory 9 Xingdao North Road, Guangzhou International Bio Island, Haizhu District, Guangzhou, Guangdong, China.</span>
        </div>
        <div class="footer-row footer-bundle">
          <span class="footer-heading">Bundle</span>
          <a href="https://www.ribocentre.org/" target="_blank" rel="noopener noreferrer">Ribocentre</a>
          <a href="https://riboswitch.ribocentre.org/" target="_blank" rel="noopener noreferrer">Switch</a>
          <a href="https://aptamer.ribocentre.org/" target="_blank" rel="noopener noreferrer">Aptamer</a>
          <a href="http://www.glycornadb.com" target="_blank" rel="noopener noreferrer">GlycoRNA</a>
          <a href="#home" aria-current="page">FoldBridge</a>
        </div>
        <div class="footer-row footer-domain">
          <span class="footer-heading">GitHub Pages</span>
          <a href="http://github.com/chichaumiao-openclaw/foldbridge" target="_blank" rel="noopener noreferrer">http://github.com/chichaumiao-openclaw/foldbridge</a>
          <span class="sep">|</span>
          <span class="footer-heading">Custom domain</span>
          <strong>foldbridge.gznl.org</strong>
        </div>
      </div>
    </div>
  </footer>`;
}

function buildHomeDashboardData() {
  const rows = sequenceRows;
  const yearCounts = new Map();
  const categoryCounts = new Map();

  rows.forEach((row) => {
    const year = String(row.article ?? '');
    const category = String(row.category ?? 'Unknown');
    yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  });

  const yearEntries = [...yearCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  const years = rows.map((row) => Number(row.article)).filter((value) => Number.isFinite(value));
  const minYear = years.length ? Math.min(...years) : null;
  const maxYear = years.length ? Math.max(...years) : null;
  const denseYearEntries = minYear !== null && maxYear !== null
    ? Array.from({ length: maxYear - minYear + 1 }, (_, offset) => {
        const year = String(minYear + offset);
        return [year, yearCounts.get(year) || 0];
      })
    : yearEntries;
  const displayYearEntries = denseYearEntries.filter(([year, count], index, entries) => {
    const numericYear = Number(year);
    const isBoundary = index === 0 || index === entries.length - 1;
    const isFiveYearTick = numericYear % 5 === 0;
    const hasData = count > 0;
    return isBoundary || isFiveYearTick || hasData;
  });
  const categoryEntries = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);
  const totalSequenceLength = rows.reduce((sum, row) => sum + String(row.type ?? '').length, 0);
  const avgLength = rows.length ? Math.round(totalSequenceLength / rows.length) : 0;
  const yearValues = displayYearEntries.map(([, count]) => count);
  const maxYearCount = Math.max(...yearValues, 1);
  const donutPalette = ['#8FC8BE', '#E8BF8B', '#B9C8EC', '#DDBEE9', '#BFD8A5', '#E7B4AA', '#C7B9E8'];
  const barPalette = ['#E9A693', '#B8D9EE', '#C7E8D2', '#E8D6B0', '#D0BCEB', '#B9E2DB', '#EAB8CF', '#CFE3AE', '#B8C8EF', '#E6C39A', '#B9E7EA', '#DDB8B8'];
  const highConfidenceCount = rows.filter((row) => String(row.confidence).toLowerCase() === 'high').length;

  return {
    rows,
    yearEntries,
    displayYearEntries,
    categoryEntries,
    maxYearCount,
    avgLength,
    minYear: minYear ?? '—',
    maxYear: maxYear ?? '—',
    highConfidenceCount,
    barPalette,
    donutPalette
  };
}

function getFilteredHomeDashboardRows(rows) {
  return rows.filter((row) => {
    const matchesYear = homeDashboardFilters.years.length
      ? homeDashboardFilters.years.includes(String(row.article ?? ''))
      : true;
    const matchesCategory = homeDashboardFilters.categories.length
      ? homeDashboardFilters.categories.includes(String(row.category ?? ''))
      : true;
    return matchesYear && matchesCategory;
  });
}

function filterRowsByDashboardFilters(rows, filters = homeDashboardFilters) {
  return rows.filter((row) => {
    const matchesYear = filters.years?.length ? filters.years.includes(String(row.article ?? '')) : true;
    const matchesCategory = filters.categories?.length ? filters.categories.includes(String(row.category ?? '')) : true;
    return matchesYear && matchesCategory;
  });
}

function summarizeRowsByYear(rows, availableYears) {
  const counts = new Map();
  rows.forEach((row) => {
    const year = String(row.article ?? '');
    counts.set(year, (counts.get(year) || 0) + 1);
  });
  return availableYears.map(([year]) => [year, counts.get(String(year)) || 0]);
}

function summarizeRowsByCategory(rows, availableCategories) {
  const counts = new Map();
  rows.forEach((row) => {
    const category = String(row.category ?? '');
    counts.set(category, (counts.get(category) || 0) + 1);
  });
  return availableCategories.map(([category]) => [category, counts.get(String(category)) || 0]);
}

function createDonutSegments(entries, palette) {
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (!total) return [];
  let startAngle = 0;
  return entries.map(([label, count], index) => {
    const angle = (count / total) * 360;
    const endAngle = startAngle + angle;
    const segment = {
      label,
      count,
      color: palette[index % palette.length],
      startAngle,
      endAngle
    };
    startAngle = endAngle;
    return segment;
  });
}

function describeDonutArc(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const polarToCartesian = (radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(angleInRadians),
      y: cy + radius * Math.sin(angleInRadians)
    };
  };

  const startOuter = polarToCartesian(outerRadius, endAngle);
  const endOuter = polarToCartesian(outerRadius, startAngle);
  const startInner = polarToCartesian(innerRadius, startAngle);
  const endInner = polarToCartesian(innerRadius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z'
  ].join(' ');
}

function homePage() {
  const featuredNames = homeBundleSites.map((site, index) => {
    const activeClass = site.href ? '' : 'active';
    if (site.href) {
      return `<a class="bundle-switch-pill tone-${site.tone} ${activeClass}" href="${site.href}" target="_blank" rel="noopener noreferrer">
        <strong>${site.name}</strong>
        <span>${site.topLabel ?? ''}</span>
      </a>`;
    }

    return `<span class="bundle-switch-pill tone-${site.tone} ${activeClass}" aria-current="page">
      <strong>${site.name}</strong>
      <span>${site.topLabel ?? ''}</span>
    </span>`;
  }).join('');

  // Calculate dynamic metrics from browseEntryRows
  const totalSequences = browseEntryRows.length || 95;
  const totalStructures = new Set(browseEntryRows.map(r => r.bestPdbId).filter(Boolean)).size || 102;
  const totalSpecies = new Set(browseEntryRows.map(r => r.species).filter(Boolean)).size || 22;
  const predictedCount = new Set(browseEntryRows.map(r => r.foldBridgeId).filter(id => hasUsablePredictedStructure(id))).size || 27;

  // Species Distribution (All species)
  const speciesCounts = {};
  browseEntryRows.forEach(row => {
    const sp = row.species || '';
    if (!sp || sp === 'Unknown' || sp === 'N/A' || sp === 'NA') return;
    speciesCounts[sp] = (speciesCounts[sp] || 0) + 1;
  });

  const donutPalette = [
    '#e2a4f4', '#829fd9', '#78e08f', '#fad390', '#e55039',
    '#f8c291', '#82ccdd', '#38ada9', '#f6b93b', '#ff9ff3',
    '#feca57', '#ff6b6b', '#48dbfb', '#1dd1a1', '#a29bfe',
    '#fd79a8', '#ffeaa7', '#fab1a0', '#74b9ff', '#0984e3',
    '#00cec9', '#00b894'
  ];

  const speciesList = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1]); // Sort descending
  const totalSpeciesRecords = Object.values(speciesCounts).reduce((a, b) => a + b, 0);

  let accumulatedPercent = 0;
  const speciesSegments = speciesList.map(([name, count], index) => {
    const percent = count / totalSpeciesRecords;
    const strokeLength = 201.06 * percent;
    const strokeOffset = -201.06 * accumulatedPercent;
    accumulatedPercent += percent;
    const color = donutPalette[index % donutPalette.length];
    return {
      name,
      count,
      percent,
      color,
      strokeLength,
      strokeOffset
    };
  });

  const donutCirclesMarkup = speciesSegments.map(seg => {
    const isActive = homeActiveSpecies === seg.name ? 'is-active' : '';
    return `<circle cx="50" cy="50" r="32" fill="transparent" stroke="${seg.color}" stroke-width="12" stroke-dasharray="${seg.strokeLength} 201.06" stroke-dashoffset="${seg.strokeOffset}" transform="rotate(-90 50 50)" class="donut-segment ${isActive}" data-filter-species="${seg.name}" title="${seg.name}: ${seg.count} records (${Math.round(seg.percent*100)}%)" />`;
  }).join('');

  const legendItemsMarkup = speciesSegments.map(seg => {
    const isActive = homeActiveSpecies === seg.name ? 'is-active' : '';
    return `
      <div class="legend-item clickable-legend-item ${isActive}" data-filter-species="${seg.name}">
        <span class="legend-color-box" style="background-color: ${seg.color}"></span>
        <span class="legend-label">${seg.name}</span>
        <span class="legend-count">${seg.count}</span>
      </div>
    `;
  }).join('');

  // Year Distribution (Only showing years with records)
  const yearCounts = {};
  browseEntryRows.forEach(row => {
    const yStr = row.discoveryYear;
    if (!yStr || yStr === 'N/A' || yStr === 'NA') return;
    const y = parseInt(yStr, 10);
    if (y >= 1996 && y <= 2026) {
      yearCounts[y] = (yearCounts[y] || 0) + 1;
    }
  });

  const yearCountsSorted = Object.entries(yearCounts)
    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10));

  const maxYearRecords = Math.max(...Object.values(yearCounts), 1);
  const yearBarsMarkup = yearCountsSorted.map(([year, count]) => {
    const heightPercent = (count / maxYearRecords) * 100;
    const isActive = String(homeActiveYear) === String(year) ? 'is-active' : '';
    const barColor = parseInt(year) < 2000 ? '#e2a4f4' :
                     parseInt(year) < 2010 ? '#fad390' :
                     parseInt(year) < 2020 ? '#82ccdd' : '#78e08f';
    
    const showLabel = (parseInt(year) % 5 === 0) || year === yearCountsSorted[0][0] || year === yearCountsSorted[yearCountsSorted.length - 1][0];
    const labelText = showLabel ? year : '';

    return `
      <div class="year-chart-column clickable-year-bar ${isActive}" data-filter-year="${year}" title="${year}: ${count} records">
        <div class="year-chart-bar-track">
          <div class="year-chart-bar-fill" style="height: ${heightPercent}%; background-color: ${barColor};"></div>
        </div>
        <span class="year-chart-label">${labelText}</span>
      </div>
    `;
  }).join('');

  // 1. Dynamic Table Filtering
  let filteredStructureRows = structureEntryRows;
  if (homeActiveSpecies) {
    filteredStructureRows = filteredStructureRows.filter(r => r.species === homeActiveSpecies);
  }
  if (homeActiveYear) {
    filteredStructureRows = filteredStructureRows.filter(r => String(r.discoveryYear) === String(homeActiveYear));
  }

  // 2. Filter Badges Markup
  let activeFiltersMarkup = '';
  if (homeActiveSpecies || homeActiveYear) {
    activeFiltersMarkup = `<div class="home-active-filters">
      <span class="filters-label">Active Filters:</span>
      <div class="filters-badges-wrap">
        ${homeActiveSpecies ? `<span class="filter-badge" data-clear-filter="species" title="Clear species filter">${homeActiveSpecies} <span class="badge-close">×</span></span>` : ''}
        ${homeActiveYear ? `<span class="filter-badge" data-clear-filter="year" title="Clear year filter">${homeActiveYear} <span class="badge-close">×</span></span>` : ''}
        <button type="button" class="clear-all-btn" id="home-clear-all-filters">Clear All</button>
      </div>
    </div>`;
  }

  // 3. Table Rows Pagination & Rendering
  const homeTablePageSize = 10;
  const totalHomePages = Math.max(1, Math.ceil(filteredStructureRows.length / homeTablePageSize));
  if (homeTablePage > totalHomePages) homeTablePage = totalHomePages;
  const homeStartIndex = (homeTablePage - 1) * homeTablePageSize;
  const visibleHomeRows = filteredStructureRows.slice(homeStartIndex, homeStartIndex + homeTablePageSize);

  const tableRowsMarkup = visibleHomeRows.length
    ? visibleHomeRows.map((row, idx) => {
        const globalIndex = homeStartIndex + idx + 1;
        return `<tr>
          <td class="structure-index-cell">${globalIndex}</td>
          <td><a href="${row.detailPage}" class="sequence-link">${row.foldBridgeId}</a></td>
          <td>${row.name || 'Untitled record'}</td>
          <td>${row.species || 'N/A'}</td>
          <td>${row.discoveryYear || 'N/A'}</td>
          <td><span class="entry-sequence" title="${row.sequence || 'Sequence unavailable'}">${row.sequence || 'N/A'}</span></td>
          <td>${renderPdbExternalLink(row.bestPdbId)}</td>
          <td>${formatBlastEvalue(row.bestEvalue)}</td>
          <td>${formatBlastPercent(row.bestIdentity)}</td>
          <td>${formatBlastPercent(row.bestCoverage)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="10" class="entry-table-empty">No structure matches match the active filters.</td></tr>`;

  const paginationMarkup = totalHomePages > 1
    ? `<div class="browse-pagination">
        <div class="browse-pagination-info">
          <span class="browse-pagination-status">Page ${homeTablePage} of ${totalHomePages}</span>
        </div>
        <div class="browse-pagination-controls">
          <button type="button" class="browse-pagination-btn" id="home-page-prev" ${homeTablePage === 1 ? 'disabled' : ''}>Previous</button>
          <button type="button" class="browse-pagination-btn" id="home-page-next" ${homeTablePage === totalHomePages ? 'disabled' : ''}>Next</button>
        </div>
      </div>`
    : '';

  const bundleHeader = renderBundleHeader(featuredNames);

  return `<main class="page-home bundle-home-page">
    <section class="bundle-home-shell">
      ${bundleHeader}
      <section class="bundle-hero-card bundle-wide-card">
        <div class="bundle-hero-copy">
          <p class="bundle-kicker">five database bundle</p>
          <h2>FoldBridge Database Portal</h2>
          <p class="bundle-hero-summary">
            FoldBridge is a curated database that links RNA chemical probing data with experimentally resolved tertiary structures.
          </p>
          <p class="bundle-hero-detail">
            By matching probing-derived RNA sequences to corresponding sequences in PDB entries, FoldBridge identifies high-confidence structure-linked records and integrates their secondary- and tertiary-structure information. The database is intended to support the analysis of relationships between RNA structural signals and 3D organization, and to facilitate improved RNA structure interpretation and prediction.
          </p>
          <div class="bundle-hero-actions">
            <button type="button" class="bundle-hero-primary" data-route="download-sequences">Browse FoldBridge</button>
            <button type="button" class="ghost" data-route="structure">Open structure hub</button>
          </div>
        </div>

        <aside class="bundle-hero-metrics">
          <article class="bundle-metric-card bundle-metric-large">
            <p>current build</p>
            <strong>Release 0.1</strong>
            <span>4 aligned database entrances with a unified visual system</span>
          </article>
          <article class="bundle-metric-card">
            <p>species</p>
            <strong>${totalSpecies}</strong>
            <span>Unique host organisms mapped</span>
          </article>
          <article class="bundle-metric-card">
            <p>sequences</p>
            <strong>${totalSequences}</strong>
            <span>Chemical probing experimental rows</span>
          </article>
          <article class="bundle-metric-card">
            <p>structures</p>
            <strong>${totalStructures}</strong>
            <span>Aligned tertiary structural targets</span>
          </article>
          <article class="bundle-metric-card">
            <p>technology</p>
            <strong>${predictedCount}</strong>
            <span>Predicted 3D models integrated</span>
          </article>
        </aside>
      </section>

      <!-- Combined Statistics Card -->
      <section class="card bundle-stats-section-combined">
        <div class="combined-stats-header">
          <h3>Database Statistics & Insights</h3>
          <p>Explore the distribution of RNA families, species, and structural solved dates within FoldBridge. Click on any year bar or category segment to dynamically filter the structure table below.</p>
        </div>
        <div class="combined-stats-grid">
          <!-- Left side: Year Distribution -->
          <div class="combined-stats-column">
            <div class="card-v2-header">
              <h4>Year Distribution</h4>
              <span class="card-v2-sub">Click bars for multi-selection</span>
            </div>
            <div class="year-chart-container">
              <div class="year-chart-y-axis">
                <span>${maxYearRecords}</span>
                <span>${Math.round(maxYearRecords / 2)}</span>
                <span>0</span>
              </div>
              <div class="year-chart-bars-wrap">
                ${yearBarsMarkup}
              </div>
            </div>
          </div>

          <!-- Right side: Category Distribution -->
          <div class="combined-stats-column">
            <div class="card-v2-header">
              <h4>Category Distribution</h4>
              <span class="card-v2-sub">Click sectors for multi-selection</span>
            </div>
            <div class="donut-layout">
              <div class="donut-chart-wrap">
                <svg viewBox="0 0 100 100" class="donut-svg">
                  ${donutCirclesMarkup}
                  <!-- Inner circle hole and text in the center -->
                  <circle cx="50" cy="50" r="23" fill="var(--panel-card-bg)" class="donut-center" />
                  <text x="50" y="54" text-anchor="middle" class="donut-center-text">${totalSpeciesRecords}</text>
                </svg>
              </div>
              <div class="donut-legend-wrap">
                ${legendItemsMarkup}
              </div>
            </div>
          </div>
        </div>

        <!-- Divider Line -->
        <hr class="dashboard-section-divider" />

        <!-- Linked Structure Matches Table -->
        <div class="home-table-container">
          <div class="home-table-header">
            <div class="home-table-title-row">
              <h3>Data Details</h3>
              <span class="home-table-count">Showing <strong>${filteredStructureRows.length}</strong> records (out of ${structureEntryRows.length} total)</span>
            </div>
            ${activeFiltersMarkup}
          </div>
          <div class="entry-table-wrap">
            <table class="entry-table case-detail-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>FoldBridge ID</th>
                  <th>Name</th>
                  <th>Species</th>
                  <th>Discovery year</th>
                  <th>Sequence</th>
                  <th>PDB ID</th>
                  <th>E-value</th>
                  <th>Identity</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>${tableRowsMarkup}</tbody>
            </table>
          </div>
          ${paginationMarkup}
        </div>
      </section>

    </section>
  </main>`;
}

function renderBundleHeader(featuredNamesMarkup = null) {
  const featuredNames = featuredNamesMarkup ?? homeBundleSites.map((site, index) => {
    const activeClass = site.href ? '' : 'active';
    if (site.href) {
      return `<a class="bundle-switch-pill tone-${site.tone} ${activeClass}" href="${site.href}" target="_blank" rel="noopener noreferrer">
        <strong>${site.name}</strong>
        <span>${site.topLabel ?? ''}</span>
      </a>`;
    }

    return `<span class="bundle-switch-pill tone-${site.tone} ${activeClass}" aria-current="page">
      <strong>${site.name}</strong>
      <span>${site.topLabel ?? ''}</span>
    </span>`;
  }).join('');

  return `<header class="bundle-home-header">
    <div class="bundle-home-header-inner">
      <div class="bundle-home-brand-column">
        <div class="bundle-home-brand">
          <div class="bundle-home-mark">FB</div>
          <div class="bundle-home-brand-copy">
            <p class="bundle-home-bundle-label">FoldBridge axis</p>
            <h1>FoldBridge</h1>
            <span>FoldBridge is a curated database that links RNA chemical probing data with experimentally resolved tertiary structures.</span>
          </div>
        </div>
      </div>

      <div class="bundle-home-nav-column">
        <div class="bundle-home-topline">
          <div class="bundle-home-bundle-block">
            <p class="bundle-home-switch-label">RNA database bundle</p>
            <div class="bundle-home-switches">
              ${featuredNames}
            </div>
          </div>
          <div class="bundle-home-meta">
            <span class="bundle-home-domain">foldbridge.gznl.org</span>
            <button type="button" class="mode-toggle" id="mode-toggle">
              ${mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            </button>
          </div>
        </div>

        <nav class="bundle-home-route-nav" aria-label="Primary navigation">
          <button type="button" class="nav-btn ${isRouteActive('home') ? 'active' : ''}" data-route="home">Home</button>
          <button type="button" class="nav-btn ${isRouteActive('browse') ? 'active' : ''}" data-route="browse">Browse</button>
          <button type="button" class="nav-btn ${isRouteActive('sequence', 'download-sequences') ? 'active' : ''}" data-route="sequence">Sequence</button>
          <button type="button" class="nav-btn ${isRouteActive('structure', 'download-structures') ? 'active' : ''}" data-route="structure">Structure</button>
          <button type="button" class="nav-btn ${isRouteActive('probing', 'detail') ? 'active' : ''}" data-route="probing">Probing</button>
          <button type="button" class="nav-btn ${isRouteActive('download') ? 'active' : ''}" data-route="download">Download</button>
          <button type="button" class="nav-btn ${isRouteActive('search') ? 'active' : ''}" data-route="search">Search</button>
          <button type="button" class="nav-btn ${isRouteActive('help') ? 'active' : ''}" data-route="help">Help</button>
        </nav>
      </div>
    </div>
  </header>`;
}

function renderDetailPageFooterActions() {
  return `<div class="detail-page-footer-actions" style="display: flex !important; justify-content: center !important; align-items: center !important; gap: 16px !important; margin-top: 40px !important; padding-top: 20px !important; width: 100% !important;">
    <button type="button" class="footer-action-btn back-to-top-btn" style="display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; height: 42px !important; width: 190px !important; padding: 0 !important; border-radius: 8px !important; font-size: 0.94rem !important; font-weight: 600 !important; cursor: pointer !important; border: none !important; white-space: nowrap !important; flex-shrink: 0 !important; box-shadow: none !important; background: rgba(184, 132, 14, 0.08) !important; color: #b8840e !important;"><svg class="footer-btn-icon" style="width: 16px !important; height: 16px !important; min-width: 16px !important; min-height: 16px !important; max-width: 16px !important; max-height: 16px !important; stroke: currentColor !important; fill: none !important; margin: 0 !important; display: inline-block !important; flex-shrink: 0 !important; vertical-align: middle !important;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg><span style="color: inherit !important; display: inline-block !important; margin: 0 !important; padding: 0 !important; font-weight: 600 !important;">Back to Top</span></button>
    <button type="button" class="footer-action-btn back-to-structure-btn" data-route="structure" style="display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 8px !important; height: 42px !important; width: 190px !important; padding: 0 !important; border-radius: 8px !important; font-size: 0.94rem !important; font-weight: 600 !important; cursor: pointer !important; border: none !important; white-space: nowrap !important; flex-shrink: 0 !important; box-shadow: none !important; background: rgba(184, 132, 14, 0.08) !important; color: #b8840e !important;"><svg class="footer-btn-icon" style="width: 16px !important; height: 16px !important; min-width: 16px !important; min-height: 16px !important; max-width: 16px !important; max-height: 16px !important; stroke: currentColor !important; fill: none !important; margin: 0 !important; display: inline-block !important; flex-shrink: 0 !important; vertical-align: middle !important;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5v-13A2.5 2.5 0 0 1 6.5 4H20v18H6.5a2.5 2.5 0 0 1-2.5-2.5z"></path></svg><span style="color: inherit !important; display: inline-block !important; margin: 0 !important; padding: 0 !important; font-weight: 600 !important;">Back to Structure</span></button>
  </div>`;
}

function renderTechnologyOverviewPage() {
  const categoryCards = technologyCategories.map((category) => {
    const methodsMarkup = category.methods
      .map((slug) => technologyMethods.find((method) => method.slug === slug))
      .filter(Boolean)
      .map((method) => `<a class="technology-method-pill" href="#detail?tech=${encodeURIComponent(method.slug)}">${method.title}</a>`)
      .join('');

    return `
      <article class="technology-category-card">
        <div class="technology-category-card-head">
          <p class="technology-method-kicker">Category</p>
          <h3>${category.title}</h3>
          <p>${category.summary}</p>
        </div>
        <div class="technology-category-card-body">
          <div class="technology-category-label-row">
            <span>Methods</span>
          </div>
          <div class="technology-method-grid-buttons">
            ${methodsMarkup}
          </div>
        </div>
      </article>
    `;
  }).join('');

  const categoryChips = technologyCategories
    .map((category) => `<span class="technology-chip">${category.title.replace(/^\d+\.\s*/, '')}</span>`)
    .join('');

  return `<main class="page-detail">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card technology-section-card">
      <div class="technology-category-grid" role="list">
        ${categoryCards}
      </div>
    </section>
  </main>`;
}

function renderTechnologyMethodPage(method) {
  const workflow = method.workflow.map((step, index) => `
    <article class="technology-step-card">
      <span class="technology-step-index">0${index + 1}</span>
      <p>${step}</p>
    </article>
  `).join('');

  const strengths = method.strengths.map((item) => `<li>${item}</li>`).join('');
  const caveats = method.caveats.map((item) => `<li>${item}</li>`).join('');
  const outputs = method.outputs.map((item) => `<li>${item}</li>`).join('');
  const references = method.references.map((item) => `<li>${item}</li>`).join('');
  const literatureHighlights = (method.literatureHighlights ?? [])
    .map((item) => `<li>${item}</li>`)
    .join('');

  return `<main class="page-detail">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card technology-detail-hero">
      <a class="technology-back-link" href="#detail">Back to technology overview</a>
      <div class="technology-detail-header">
        <div>
          <p class="technology-kicker">${method.category}</p>
          <h1>${method.title}</h1>
        </div>
        <dl class="technology-detail-meta">
          <div><dt>Reagent</dt><dd>${method.reagent}</dd></div>
          <div><dt>Readout</dt><dd>${method.readout}</dd></div>
          <div><dt>Best for</dt><dd>${method.bestFor}</dd></div>
          <div><dt>Primary signal</dt><dd>${method.whatItReads}</dd></div>
        </dl>
      </div>
    </section>

    <section class="card bundle-wide-card technology-section-card">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">concept</p>
          <h2>What This Method Measures</h2>
        </div>
        <p>${method.foldbridgeUse}</p>
      </div>
      <div class="technology-dual-grid">
        <article class="technology-note-card">
          <h3>Typical outputs</h3>
          <ul>${outputs}</ul>
        </article>
        <article class="technology-note-card">
          <h3>When to choose it</h3>
          <p>${method.bestFor}</p>
        </article>
      </div>
    </section>

    ${literatureHighlights ? `
    <section class="card bundle-wide-card technology-section-card">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">literature summary</p>
          <h2>What The Papers Established</h2>
        </div>
        <p>This summary condenses the main takeaways that repeatedly appear across foundational SHAPE method papers and later validation studies.</p>
      </div>
      <article class="technology-note-card">
        <ul>${literatureHighlights}</ul>
      </article>
    </section>` : ''}

    <section class="card bundle-wide-card technology-section-card">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">workflow</p>
          <h2>Experimental Workflow</h2>
        </div>
        <p>${method.workflowIntro}</p>
      </div>
      <div class="technology-step-grid">
        ${workflow}
      </div>
    </section>

    <section class="card bundle-wide-card technology-section-card">
      <div class="technology-dual-grid">
        <article class="technology-note-card">
          <h3>Strengths</h3>
          <ul>${strengths}</ul>
        </article>
        <article class="technology-note-card">
          <h3>Caveats</h3>
          <ul>${caveats}</ul>
        </article>
      </div>
    </section>

    <section class="card bundle-wide-card technology-section-card">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">references</p>
          <h2>Key References</h2>
        </div>
        <p>These papers define the method, establish how the signal should be interpreted, or show important later extensions and limitations.</p>
      </div>
      <ul class="technology-reference-list">
        ${references}
      </ul>
    </section>
    ${renderDetailPageFooterActions()}
  </main>`;
}

function detailPage() {
  const slug = getTechnologySlugFromHash();
  const method = technologyMethods.find((item) => item.slug === slug);
  if (method) return renderTechnologyMethodPage(method);
  return renderTechnologyOverviewPage();
}

function case10fzPage() {
  const matchedRows = case10fzMatchedSequences
    .map(
      (row) => `<tr>
        <td><span class="entry-sequence" title="${row.bundleSequenceId}">${row.bundleSequenceId}</span></td>
        <td><span class="entry-sequence" title="${row.sourceFile}">${row.sourceFile}</span></td>
        <td>${row.sequenceLength}</td>
        <td>${row.identityFraction}</td>
        <td>${row.queryCoverage}</td>
        <td>${row.pdbCoverage}</td>
      </tr>`
    )
    .join('');

  const reactivityRows = case10fzReactivityPreview
    .map(
      (row) => `<tr>
        <td>${row.pdbPos}</td>
        <td>${row.pdbBase}</td>
        <td>${row.source}</td>
        <td>${row.rmdbPos}</td>
        <td>${row.reactivity}</td>
        <td>${row.error}</td>
      </tr>`
    )
    .join('');

  return `<main class="page-sequence-detail page-case-detail">
    ${renderBundleHeader()}
    <section class="sequence-detail-card case-detail-card">
      <div class="sequence-detail-header">
        <a class="sequence-detail-back" href="#browse">Back to browse</a>
        <div class="sequence-detail-title-row">
          <div>
            <p class="sequence-detail-kicker">PDB-centered case bundle</p>
            <h1>10FZ Projection Case</h1>
          </div>
          <dl class="sequence-detail-meta">
            <div><dt>PDB ID</dt><dd>${case10fzSummary.pdbId}</dd></div>
            <div><dt>Reference chain</dt><dd>${case10fzSummary.pdbReferenceId}</dd></div>
            <div><dt>Projection status</dt><dd>${case10fzSummary.projectionStatus}</dd></div>
            <div><dt>Scientific scope</dt><dd>${case10fzSummary.scientificScope}</dd></div>
          </dl>
        </div>
      </div>

      <section class="sequence-detail-panel">
        <div class="sequence-detail-section-heading">
          <h2>Case Summary</h2>
          <p>${case10fzSummary.sourceNote}</p>
        </div>
        <div class="sequence-detail-insight-grid">
          <article class="sequence-detail-insight-card">
            <span>Candidate pair rows</span>
            <strong>${case10fzSummary.candidatePairRows}</strong>
          </article>
          <article class="sequence-detail-insight-card">
            <span>RMDB unique sequences</span>
            <strong>${case10fzSummary.rmdbUniqueSequenceCount}</strong>
          </article>
          <article class="sequence-detail-insight-card">
            <span>RMDB profiles</span>
            <strong>${case10fzSummary.rmdbProfileCount}</strong>
          </article>
          <article class="sequence-detail-insight-card">
            <span>Alignment rows</span>
            <strong>${case10fzSummary.alignmentRows}</strong>
          </article>
          <article class="sequence-detail-insight-card">
            <span>PDB-axis reactivity rows</span>
            <strong>${case10fzSummary.pdbAxisReactivityRows}</strong>
          </article>
          <article class="sequence-detail-insight-card">
            <span>Projection method</span>
            <strong>BLAST projection</strong>
          </article>
        </div>
      </section>

      <section class="sequence-detail-panel">
        <div class="sequence-detail-section-heading">
          <h2>Alignment Policy</h2>
          <p>The delivered case keeps only best-hit sequence pairs under the published thresholds below. This page presents the case as sequence-to-axis projection evidence, not as direct structural proof.</p>
        </div>
        <div class="technology-detail-meta case-detail-meta-grid">
          <div><dt>E-value</dt><dd>${case10fzSummary.blastThresholds.evalue}</dd></div>
          <div><dt>Min identity</dt><dd>${case10fzSummary.blastThresholds.percIdentityMin}</dd></div>
          <div><dt>Strand</dt><dd>${case10fzSummary.blastThresholds.strand}</dd></div>
          <div><dt>Max HSPs</dt><dd>${case10fzSummary.blastThresholds.maxHsps}</dd></div>
        </div>
      </section>

      <section class="sequence-detail-panel">
        <div class="sequence-detail-section-heading">
          <h2>Matched RMDB Sequences</h2>
          <p>Representative matched bundle sequences aligned to the 10FZ reference axis.</p>
        </div>
        <div class="entry-table-wrap">
          <table class="entry-table case-detail-table">
            <thead>
              <tr>
                <th>Bundle sequence ID</th>
                <th>Source RDAT</th>
                <th>Length</th>
                <th>Identity</th>
                <th>Query coverage</th>
                <th>PDB coverage</th>
              </tr>
            </thead>
            <tbody>${matchedRows}</tbody>
          </table>
        </div>
      </section>

      <section class="sequence-detail-panel">
        <div class="sequence-detail-section-heading">
          <h2>PDB-axis Reactivity Preview</h2>
          <p>Preview rows from the projected reactivity table, indexed on the PDB reference sequence axis.</p>
        </div>
        <div class="entry-table-wrap">
          <table class="entry-table case-detail-table">
            <thead>
              <tr>
                <th>PDB position</th>
                <th>Base</th>
                <th>Profile</th>
                <th>RMDB position</th>
                <th>Reactivity</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>${reactivityRows}</tbody>
          </table>
        </div>
      </section>
    </section>
  </main>`;
}

function caseDetailPage() {
  const caseId = getCaseIdFromHash();
  const row = case3dRows.find((item) => item.pdbId === caseId);
  if (caseId && activeCaseDetailId !== caseId) {
    activeCaseDetailId = caseId;
    caseDetailSequencePage = 1;
  }
  if (!row) {
    return `<main class="page-sequence-detail page-case-detail">
      ${renderBundleHeader()}
      <section class="sequence-detail-card case-detail-card">
        <div class="sequence-detail-header">
          <a class="sequence-detail-back" href="#browse">Back to browse</a>
          <div class="sequence-detail-title-row">
            <div>
              <p class="sequence-detail-kicker">3D Entry</p>
              <h1>Case not found</h1>
              <p class="technology-intro">The requested 3D case could not be found in the current manifest.</p>
            </div>
          </div>
        </div>
      </section>
    </main>`;
  }

  const detail = caseDetailCache.get(caseId);
  if (!detail) {
    ensureCaseDetailLoaded(caseId);
    return `<main class="page-sequence-detail page-case-detail">
      ${renderBundleHeader()}
      <section class="sequence-detail-card case-detail-card">
        <div class="sequence-detail-header">
          <a class="sequence-detail-back" href="#browse">Back to browse</a>
          <div class="sequence-detail-title-row">
            <div>
              <p class="sequence-detail-kicker">3D Entry case bundle</p>
              <h1>${row.pdbId}</h1>
              <p class="technology-intro">Loading packaged case details, sequences, and case metadata...</p>
            </div>
          </div>
        </div>

        <section class="sequence-detail-panel">
          <div class="sequence-detail-placeholder">
            <p>The case package is being loaded from the bundled 3D entry files.</p>
          </div>
        </section>
      </section>
    </main>`;
  }

  if (detail.error) {
    return `<main class="page-sequence-detail page-case-detail">
      ${renderBundleHeader()}
      <section class="sequence-detail-card case-detail-card">
        <div class="sequence-detail-header">
          <a class="sequence-detail-back" href="#browse">Back to browse</a>
          <div class="sequence-detail-title-row">
            <div>
              <p class="sequence-detail-kicker">3D Entry case bundle</p>
              <h1>${row.pdbId}</h1>
              <p class="technology-intro">This case is listed in the manifest, but the detailed packaged files could not be opened.</p>
            </div>
          </div>
        </div>

        <section class="sequence-detail-panel">
          <div class="sequence-detail-placeholder">
            <p>${detail.message || 'Failed to load case detail.'}</p>
          </div>
        </section>
      </section>
    </main>`;
  }

  const caseInfo = detail.caseInfo || {};
  const selectedInfoCards = [
    ['Projection status', caseInfo.projection_status],
    ['Scientific scope', humanizeCaseToken(caseInfo.scientific_scope)],
    ['Reactivity axis', humanizeCaseToken(caseInfo.reactivity_axis)],
    ['2D map status', humanizeCaseToken(caseInfo.map2d_status)],
    ['Structural evidence', formatCaseBoolean(caseInfo.projection_is_structural_evidence)],
    ['Release snapshot', caseInfo.release_snapshot_id]
  ];
  const implementationCards = [
    ['Projection method', humanizeCaseToken(caseInfo.projection_method)],
    ['Query position map', humanizeCaseToken(caseInfo.query_feature_position_map_method)],
    ['Candidate policy', humanizeCaseToken(caseInfo.candidate_selection_policy)],
    ['Package type', humanizeCaseToken(caseInfo.package_type)],
    ['Bundle sequence status', humanizeCaseToken(caseInfo.self_contained_bundle_sequence_status)],
    ['Sequence member rows', caseInfo.rmdb_sequence_member_rows]
  ];
  const blastThresholdEntries = Object.entries(caseInfo.blast_thresholds || {})
    .map(([key, value]) => `<div><dt>${humanizeCaseToken(key)}</dt><dd>${formatCaseDetailValue(value)}</dd></div>`)
    .join('');
  const pdbSequenceMarkup = (detail.pdbSequences || [])
    .map((sequence) => `<article class="case-sequence-card">
      <div class="case-sequence-card-header">
        <div>
          <p class="case-sequence-card-kicker">PDB reference</p>
          <h3>${sequence.id}</h3>
        </div>
        <span class="case-sequence-card-length">${sequence.length} nt</span>
      </div>
      <code class="case-sequence-block">${sequence.sequence}</code>
    </article>`)
    .join('');
  const totalSequencePages = Math.max(1, Math.ceil((detail.rmdbSequences?.length || 0) / CASE_DETAIL_SEQUENCE_PAGE_SIZE));
  if (caseDetailSequencePage > totalSequencePages) caseDetailSequencePage = totalSequencePages;
  const sequenceStartIndex = (caseDetailSequencePage - 1) * CASE_DETAIL_SEQUENCE_PAGE_SIZE;
  const visibleRmdbSequences = (detail.rmdbSequences || []).slice(
    sequenceStartIndex,
    sequenceStartIndex + CASE_DETAIL_SEQUENCE_PAGE_SIZE
  );
  const rmdbSequenceRows = visibleRmdbSequences.length
    ? visibleRmdbSequences
        .map((sequence) => `<tr>
          <td title="${sequence.rmdbUniqueId}">
            <span class="case-table-truncate">${sequence.rmdbUniqueId}</span>
          </td>
          <td>${sequence.length}</td>
          <td>${formatFractionPercent(sequence.identityFraction)}</td>
          <td>${formatFractionPercent(sequence.rmdbQueryCoverage)}</td>
          <td>${formatFractionPercent(sequence.pdbSubjectCoverage)}</td>
          <td>${sequence.pairCount}</td>
          <td title="${sequence.sequence}">
            <code class="case-sequence-inline case-table-truncate">${sequence.sequence}</code>
          </td>
        </tr>`)
        .join('')
    : `<tr><td class="entry-table-empty" colspan="7">No RMDB sequences were packaged for this case.</td></tr>`;

  return `<main class="page-sequence-detail page-case-detail">
    ${renderBundleHeader()}
    <section class="sequence-detail-card case-detail-card">
      <div class="sequence-detail-header">
        <a class="sequence-detail-back" href="#browse">Back to browse</a>
        <div class="sequence-detail-title-row">
          <div>
            <p class="sequence-detail-kicker">3D Entry case bundle</p>
            <h1>${row.pdbId}</h1>
          </div>
        </div>
      </div>

      <section class="sequence-detail-panel">
        <div class="sequence-detail-section-heading">
          <h2>Case Metrics</h2>
          <p>This detail page summarizes the packaged case-level metrics currently available from the imported 3D entry bundle.</p>
        </div>
        <div class="sequence-detail-insight-grid">
          <article class="sequence-detail-insight-card"><span>Candidate pair rows</span><strong>${row.candidatePairRows ?? 0}</strong></article>
          <article class="sequence-detail-insight-card"><span>Unique RMDB sequences</span><strong>${row.rmdbUniqueSequenceCount ?? 0}</strong></article>
          <article class="sequence-detail-insight-card"><span>RMDB profiles</span><strong>${row.rmdbProfileCount ?? 0}</strong></article>
          <article class="sequence-detail-insight-card"><span>Alignment rows</span><strong>${row.alignmentRows ?? 0}</strong></article>
          <article class="sequence-detail-insight-card"><span>PDB-axis reactivity rows</span><strong>${row.pdbAxisReactivityRows ?? 0}</strong></article>
        </div>
      </section>

      <section class="sequence-detail-panel">
        <div class="sequence-detail-section-heading">
          <h2>Case Interpretation</h2>
          <p>These fields come directly from the packaged <code>case.json</code> and help explain what this 3D entry actually represents.</p>
        </div>
        <div class="sequence-detail-insight-grid">
          ${selectedInfoCards
            .map(
              ([label, value]) => `<article class="sequence-detail-insight-card">
                <span>${label}</span>
                <strong>${formatCaseDetailValue(value)}</strong>
              </article>`
            )
            .join('')}
        </div>
        <div class="sequence-detail-placeholder case-detail-note">
          <p>${caseInfo.source_note || 'No source note was packaged for this case.'}</p>
        </div>
      </section>

      <section class="sequence-detail-panel">
        <div class="sequence-detail-section-heading">
          <h2>Projection Rules</h2>
          <p>These fields describe how RMDB sequence information was aligned and projected onto the PDB reference axis.</p>
        </div>
        <div class="sequence-detail-insight-grid">
          ${implementationCards
            .map(
              ([label, value]) => `<article class="sequence-detail-insight-card">
                <span>${label}</span>
                <strong>${formatCaseDetailValue(value)}</strong>
              </article>`
            )
            .join('')}
        </div>
        <div class="case-detail-threshold-card">
          <h3>BLAST Thresholds</h3>
          <dl class="case-detail-threshold-grid">
            ${blastThresholdEntries || '<div><dt>Status</dt><dd>No threshold block found</dd></div>'}
          </dl>
        </div>
      </section>

      <section class="sequence-detail-panel">
        <div class="sequence-detail-section-heading">
          <h2>PDB Reference Sequence</h2>
          <p>The structural reference sequence packaged with this case is shown below.</p>
        </div>
        <div class="case-sequence-stack">
          ${pdbSequenceMarkup || '<div class="sequence-detail-placeholder"><p>No PDB reference sequence was packaged for this case.</p></div>'}
        </div>
      </section>

      <section class="sequence-detail-panel">
        <div class="sequence-detail-section-heading">
          <h2>Matched RMDB Sequences</h2>
          <p>These are the unique RMDB sequences carried by this case package, summarized from <code>alignment_pair_summary.tsv</code>.</p>
        </div>
        <div class="entry-table-wrap case-sequence-table-wrap">
          <table class="entry-table case-sequence-table">
            <thead>
              <tr>
                <th>RMDB unique ID</th>
                <th>Length</th>
                <th>Identity</th>
                <th>RMDB coverage</th>
                <th>PDB coverage</th>
                <th>Pair rows</th>
                <th>Sequence</th>
              </tr>
            </thead>
            <tbody>${rmdbSequenceRows}</tbody>
          </table>
        </div>
        <div class="browse-pagination">
          <span class="browse-pagination-status">Page ${caseDetailSequencePage} of ${totalSequencePages}</span>
          <div class="browse-pagination-actions">
            <button
              id="case-detail-prev-page"
              type="button"
              class="download-outline-btn"
              ${caseDetailSequencePage <= 1 ? 'disabled' : ''}
            >
              Previous
            </button>
            <button
              id="case-detail-next-page"
              type="button"
              class="download-outline-btn"
              ${caseDetailSequencePage >= totalSequencePages ? 'disabled' : ''}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      ${renderDetailPageFooterActions()}
    </section>
  </main>`;
}

function browsePage() {
  const totalPages = Math.max(1, Math.ceil(browseEntryRows.length / BROWSE_PAGE_SIZE));
  if (browseCurrentPage > totalPages) browseCurrentPage = totalPages;
  const startIndex = (browseCurrentPage - 1) * BROWSE_PAGE_SIZE;
  const visibleBrowseRows = browseEntryRows.slice(startIndex, startIndex + BROWSE_PAGE_SIZE);
  const total3dPages = Math.max(1, Math.ceil(case3dRows.length / CASE3D_PAGE_SIZE));
  if (case3dCurrentPage > total3dPages) case3dCurrentPage = total3dPages;
  const case3dStartIndex = (case3dCurrentPage - 1) * CASE3D_PAGE_SIZE;
  const visibleCase3dRows = case3dRows.slice(case3dStartIndex, case3dStartIndex + CASE3D_PAGE_SIZE);
  const rows = visibleBrowseRows.length
    ? visibleBrowseRows
        .map(
          (row) => `<tr>
            <td>
              <input
                type="checkbox"
                class="browse-select"
                data-browse-id="${row.foldBridgeId}"
                ${selectedBrowseIds.has(row.foldBridgeId) ? 'checked' : ''}
              />
            </td>
            <td>${row.foldBridgeId}</td>
            <td>${row.name}</td>
            <td>
              <span class="entry-sequence" title="${row.sequence}">${row.sequence}</span>
            </td>
            <td>${row.fileCode}</td>
            <td>${row.experimentType}</td>
            <td>${row.modifier}</td>
            <td>
              <span class="browse-match-pill ${row.hasPdbMatch ? 'is-hit' : 'is-miss'}">
                ${row.hasPdbMatch ? 'Matched' : 'Pending'}
              </span>
            </td>
            <td>${summarizePdbMatch(row)}</td>
            <td>${formatBlastEvalue(row.bestEvalue)}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="10" class="entry-table-empty">No entries yet.</td></tr>`;
  const case3dTableRows = visibleCase3dRows.length
    ? visibleCase3dRows
        .map(
          (row) => `<tr>
            <td><a href="#case-detail?case=${encodeURIComponent(row.pdbId ?? '')}" class="sequence-link">${row.pdbId ?? ''}</a></td>
            <td>${row.rmdbUniqueSequenceCount ?? 0}</td>
            <td>${row.rmdbProfileCount ?? 0}</td>
            <td>${row.candidatePairRows ?? 0}</td>
            <td>${row.alignmentRows ?? 0}</td>
            <td>${row.pdbAxisReactivityRows ?? 0}</td>
            <td>${row.projectionStatus ?? ''}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="7" class="entry-table-empty">No 3D entries yet.</td></tr>`;

  return `<main class="page-download-sequences page-browse">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card browse-entry-section">
      <div class="browse-section-heading">
        <div>
          <h2>2D Entry</h2>
        </div>
      </div>
      <p class="browse-section-note">
        All RMDB records stay in one table. Entries without a PDB hit remain visible and are marked as pending.
      </p>
      <div class="download-toolbar browse-toolbar">
        <button
          type="button"
          id="select-all-rdat"
          class="browse-action-btn ${browseEntryRows.length ? '' : 'is-disabled'}"
          ${browseEntryRows.length ? '' : 'disabled'}
          aria-disabled="${browseEntryRows.length ? 'false' : 'true'}"
        >
          Select All
        </button>
        <button
          type="button"
          id="download-selected-rdat"
          class="browse-action-btn ${selectedBrowseIds.size ? 'is-active' : 'is-disabled'}"
          ${selectedBrowseIds.size ? '' : 'disabled'}
          aria-disabled="${selectedBrowseIds.size ? 'false' : 'true'}"
        >
          Export Selected (${selectedBrowseIds.size})
        </button>
        <button
          type="button"
          id="clear-selected-rdat"
          class="browse-action-btn ${selectedBrowseIds.size ? 'is-active' : 'is-disabled'}"
          ${selectedBrowseIds.size ? '' : 'disabled'}
          aria-disabled="${selectedBrowseIds.size ? 'false' : 'true'}"
        >
          Clear Selection
        </button>
      </div>
      <div class="entry-table-wrap">
        <table class="entry-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>FoldBridge ID</th>
              <th>Name</th>
              <th>Sequence</th>
              <th>File Code</th>
              <th>Experiment Type</th>
              <th>Modifier</th>
              <th>Status</th>
              <th>Best PDB</th>
              <th>E-value</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
      <div class="browse-pagination">
        <div class="browse-pagination-info">
          <span class="browse-pagination-status">Page ${browseCurrentPage} of ${totalPages}</span>
          ${renderPageJumpControls('browse', totalPages, browseCurrentPage)}
        </div>
        <div class="browse-pagination-actions">
          <button
            type="button"
            id="browse-prev-page"
            class="download-outline-btn"
            ${browseCurrentPage === 1 ? 'disabled' : ''}
          >
            Previous
          </button>
          <button
            type="button"
            id="browse-next-page"
            class="download-outline-btn"
            ${browseCurrentPage === totalPages ? 'disabled' : ''}
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <section class="card bundle-wide-card browse-entry-section">
      <div class="browse-section-heading">
        <div>
          <h2>3D Entry</h2>
        </div>
      </div>
      <div class="entry-table-wrap">
          <table class="entry-table case-detail-table">
            <thead>
            <tr>
              <th>PDB ID</th>
              <th>Unique RMDB sequences</th>
              <th>RMDB profiles</th>
              <th>Candidate pair rows</th>
              <th>Alignment rows</th>
              <th>Reactivity rows</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${case3dTableRows}</tbody>
        </table>
      </div>
      <div class="browse-pagination">
        <div class="browse-pagination-info">
          <span class="browse-pagination-status">Page ${case3dCurrentPage} of ${total3dPages}</span>
          ${renderPageJumpControls('case3d', total3dPages, case3dCurrentPage)}
        </div>
        <div class="browse-pagination-actions">
          <button
            type="button"
            id="case3d-prev-page"
            class="download-outline-btn"
            ${case3dCurrentPage === 1 ? 'disabled' : ''}
          >
            Previous
          </button>
          <button
            type="button"
            id="case3d-next-page"
            class="download-outline-btn"
            ${case3dCurrentPage === total3dPages ? 'disabled' : ''}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  </main>`;
}

function structurePage() {
  return downloadStructuresPage();
}

function structureDetailPdbUrl(pdbId, subjectId = '') {
  if (!pdbId) return '';

  const uppercasePdbId = String(pdbId).toUpperCase();
  const chainMatch = String(subjectId || '').match(/_([A-Za-z0-9-]+)$/);
  const authAsymId = chainMatch?.[1];
  const localPdbMap = {
    '1AM0': './src/assets/structures/1AM0-assembly1.cif',
    '4L81': './src/assets/structures/4L81-assembly1.cif',
    '5KPY': './src/assets/structures/5KPY-assembly1.cif',
    '5TPY': './src/assets/structures/5TPY-assembly1.cif',
    '8QO5': './src/assets/structures/8QO5-assembly1.cif'
  };

  if (!authAsymId && localPdbMap[uppercasePdbId]) {
    return localPdbMap[uppercasePdbId];
  }

  const normalizedPdbId = encodeURIComponent(uppercasePdbId);

  if (!authAsymId) {
    return `https://files.rcsb.org/download/${normalizedPdbId}.cif`;
  }

  return `https://www.ebi.ac.uk/pdbe/model-server/v1/${normalizedPdbId}/atoms?auth_asym_id=${encodeURIComponent(authAsymId)}&encoding=cif`;
}

function predictedStructurePath(foldBridgeId) {
  if (!hasUsablePredictedStructure(foldBridgeId)) return '';
  const stem = foldBridgeId.replace(/^RMDB_/, '');
  return `./src/assets/predicted-structures/${stem}.rnacomposer.pdb`;
}

function structureDetailPage() {
  const foldBridgeId = getStructureRecordIdFromHash();
  const row =
    structureEntryRows.find((item) => item.foldBridgeId === foldBridgeId)
    || browseEntryRows.find((item) => item.foldBridgeId === foldBridgeId);

  if (!row) {
    return `<main class="page-sequence-detail">
      ${renderBundleHeader()}
      <section class="sequence-detail-card">
        <div class="sequence-detail-header">
          <a class="sequence-detail-back" href="#structure">Back to structure</a>
          <div class="sequence-detail-title-row">
            <div>
              <h1>Record not found</h1>
              <p class="technology-intro">The requested FoldBridge structure-linked record could not be found.</p>
            </div>
          </div>
        </div>
      </section>
    </main>`;
  }

  const detailSequence = String(row?.sourceSequence || row?.sequence || '').replace(/\s*\(\d+nt\)$/i, '');
  const detailSequenceLength = detailSequence.replace(/\s+/g, '').length;
  const detailSecondaryStructure = getDisplaySecondaryStructure(row);
  const predictedSecondaryStructure = getPredictedSecondaryStructure(row);
  const isReactivityGuidedStructure = usesReactivityGuidedWorkflow(row);
  const hasLowercaseSequenceAnnotation = sequenceHasLowercaseAnnotation(detailSequence);
  const hasSecondaryStructureConstraints = structureHasSecondaryStructure(row);
  const showPredictedStructureSection = hasUsablePredictedStructure(row?.foldBridgeId) || hasSecondaryStructureConstraints;
  const showReactivityHeatmap = Boolean(row?.hasLocalRdat && row?.rdatPath);
  const showPredictedStructureViewer = hasUsablePredictedStructure(row?.foldBridgeId);
  const heatmapSection = showReactivityHeatmap
    ? `<section class="sequence-detail-panel">
        <h2>Reactivity Heatmap</h2>
        <div class="sequence-detail-section-intro">
          <p>${
            isReactivityGuidedStructure
              ? 'This heatmap is the starting point for this record because no curated dot-bracket annotation was packaged with the RDAT. The secondary-structure view below is estimated from these reactivity measurements.'
              : 'This heatmap summarizes per-position chemical probing reactivity across the RDAT measurements, helping relate experimental signal to structural context.'
          }</p>
        </div>
        <section class="sequence-secondary-card sequence-secondary-heatmap-card structure-detail-heatmap-card">
          <div
            id="structure-detail-heatmap"
            class="sequence-secondary-heatmap-host"
            data-rdat-url="${row.rdatPath}"
            data-sequence="${(row.sourceSequence || row.sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
          ></div>
          <p id="structure-detail-heatmap-status" class="mini-note" hidden></p>
        </section>
      </section>`
    : '';
  const secondaryStructureSection = hasSecondaryStructureConstraints
    ? `<section class="sequence-detail-panel">
        <h2>${isReactivityGuidedStructure ? 'Predicted Secondary Structure' : 'Secondary Structure'}</h2>
        <div class="sequence-detail-section-intro">
          <p>${
            isReactivityGuidedStructure
              ? 'This panel shows a local reactivity-guided secondary-structure estimate derived from the bundled RDAT measurements and rendered as an interactive 2D layout.'
              : 'This panel shows the RNA secondary structure derived from the packaged dot-bracket annotation and rendered as an interactive 2D layout.'
          }</p>
        </div>
        <section class="sequence-secondary-card sequence-secondary-forna-card">
          <div class="sequence-detail-forna-copy">
            <p class="sequence-detail-forna-title">RNA Secondary Structure Viewer (Forna)</p>
            ${
              isReactivityGuidedStructure
                ? `<p class="mini-note">${predictedSecondaryStructure?.method || 'Reactivity-guided prediction.'}</p>
                   <p class="mini-note">Treat this as a working hypothesis, not a final curated structure.</p>`
                : ''
            }
          </div>
          <div class="sequence-detail-forna-frame">
            <div
              id="structure-detail-forna-host"
              class="sequence-detail-forna-host"
              data-rdat-url="${rdatDownloadPath(row.foldBridgeId)}"
              data-foldbridge-id="${row.foldBridgeId}"
              data-sequence="${(row.sourceSequence || row.sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
              data-structure="${detailSecondaryStructure || ''}"
            ></div>
          </div>
          <div id="structure-detail-sequence-structure-block" class="sequence-detail-dot-bracket-block">
            <p class="case-sequence-structure-label">Dot-bracket notation</p>
            <code
              id="structure-detail-sequence-structure"
              class="case-sequence-structure"
              data-sequence="${detailSequence || ''}"
              data-chunk-size="120"
            >${renderAlignedSequenceStructure(detailSequence, detailSecondaryStructure)}</code>
          </div>
          <p id="structure-detail-forna-status" class="sequence-detail-forna-note" hidden></p>
        </section>
      </section>`
    : '';
  const tertiaryStructureSection =
    hasSecondaryStructureConstraints && (showPredictedStructureSection || row.bestPdbId)
      ? `<section class="sequence-detail-panel">
          <h2>Tertiary Structure Comparison</h2>
          <div class="sequence-detail-section-intro">
            <p>${
              (!isReactivityGuidedStructure || (row.bestPdbId && hasUsablePredictedStructure(row.foldBridgeId)))
                ? 'Compare the secondary-structure-derived RNA model with the matched experimental PDB structure side by side.'
                : 'Three-dimensional follow-up depends on whether a precomputed model is available. When no predicted 3D file has been generated yet, the 2D structure above should be treated as the current endpoint.'
            }</p>
          </div>
          <div class="structure-detail-comparison-grid">
            <section class="structure-detail-comparison-card">
              <div class="structure-detail-comparison-copy">
                <h3>Predicted 3D from dot-bracket</h3>
              </div>
              ${
                showPredictedStructureViewer
                  ? `<div class="sequence-detail-media">
                      <div id="predicted-structure-detail-molstar-status" class="mini-note">Loading predicted 3D model…</div>
                      <div
                        id="predicted-structure-detail-molstar"
                        class="sequence-detail-viewer"
                        data-structure-url="${predictedStructurePath(row.foldBridgeId)}"
                        data-structure-format="pdb"
                        data-structure-label="${row.foldBridgeId.replace(/^RMDB_/, '')}"
                        data-structure-sequence="${(row.sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
                        data-structure-source="rnacomposer"
                      ></div>
                    </div>`
                  : `<div class="sequence-detail-media">
                      <div class="mini-note">${
                        unsupportedPredictedStructureIds.has(row?.foldBridgeId)
                          ? 'RNAComposer prediction unavailable for this record.'
                          : 'Predicted 3D model is not available yet for this record.'
                      }</div>
                      ${
                        isReactivityGuidedStructure && !unsupportedPredictedStructureIds.has(row?.foldBridgeId)
                          ? '<p class="mini-note">If we want a 3D view here, the next step is to run a dedicated generator such as RNAComposer or another RNA 3D modeling workflow from the predicted dot-bracket.</p>'
                          : ''
                      }
                    </div>`
              }
            </section>
            <section class="structure-detail-comparison-card">
              <div class="structure-detail-comparison-copy">
                <h3>Matched PDB tertiary structure</h3>
              </div>
              ${
                row.bestPdbId
                  ? `<div class="sequence-detail-media">
                      <div id="structure-detail-molstar-status" class="mini-note">Loading interactive 3D structure…</div>
                      <div
                        id="structure-detail-molstar"
                        class="sequence-detail-viewer"
                        data-structure-url="${structureDetailPdbUrl(row.bestPdbId, row.bestSubjectId)}"
                        data-structure-format="cif"
                        data-structure-label="${row.bestPdbId}"
                        data-structure-sequence="${(row.sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
                        data-structure-chain="${String(row.bestSubjectId || '').match(/_([A-Za-z0-9-]+)$/)?.[1] || ''}"
                      ></div>
                    </div>`
                  : `<div class="sequence-detail-placeholder">
                      <p>No matched PDB structure is available for this record.</p>
                    </div>`
              }
            </section>
          </div>
        </section>`
      : row.bestPdbId
        ? `<section class="sequence-detail-panel">
            <h2>Tertiary Structure</h2>
            <div class="sequence-detail-media">
              <div id="structure-detail-molstar-status" class="mini-note">Loading interactive 3D structure…</div>
              <div
                id="structure-detail-molstar"
                class="sequence-detail-viewer"
                data-structure-url="${structureDetailPdbUrl(row.bestPdbId, row.bestSubjectId)}"
                data-structure-format="cif"
                data-structure-label="${row.bestPdbId}"
                data-structure-sequence="${(row.sequence || '').replace(/\s*\(\d+nt\)$/i, '')}"
                data-structure-chain="${String(row.bestSubjectId || '').match(/_([A-Za-z0-9-]+)$/)?.[1] || ''}"
              ></div>
            </div>
          </section>`
        : '';
  const structureWorkflowSections = isReactivityGuidedStructure
    ? `${heatmapSection}${secondaryStructureSection}${tertiaryStructureSection}`
    : `${secondaryStructureSection}${heatmapSection}${tertiaryStructureSection}`;

  return `<main class="page-sequence-detail">
    ${renderBundleHeader()}
    <section class="sequence-detail-card">
      <div class="sequence-detail-header">
        <a class="sequence-detail-back" href="#structure">Back to structure</a>
        <div class="sequence-detail-title-row">
          <div>
            <h1>${row.foldBridgeId}</h1>
          </div>
          <dl class="sequence-detail-meta">
            <div><dt>PDB ID</dt><dd>${renderPdbExternalLink(row.bestPdbId)}</dd></div>
            <div><dt>E-value</dt><dd>${formatBlastEvalue(row.bestEvalue)}</dd></div>
            <div><dt>Identity</dt><dd>${formatBlastPercent(row.bestIdentity)}</dd></div>
            <div><dt>Coverage</dt><dd>${formatBlastPercent(row.bestCoverage)}</dd></div>
          </dl>
        </div>
      </div>

      <section class="sequence-detail-panel">
        <h2>Description</h2>
        <div class="sequence-detail-placeholder">
          <p>${renderStructureDetailDescription(row)}</p>
        </div>
      </section>

      <section class="sequence-detail-panel">
        <h2>Sequence${detailSequenceLength ? ` (${detailSequenceLength} nt)` : ''}</h2>
        <article class="case-sequence-card">
          <code class="case-sequence-block case-sequence-block-formatted">${detailSequence ? renderFormattedDetailSequence(detailSequence, 5, { forceUppercaseDisplay: true }) : 'Sequence unavailable'}</code>
        </article>
        ${
          hasLowercaseSequenceAnnotation
            ? `<p class="mini-note">The source RDAT marks auxiliary sequence context in lowercase. This view shows those bases in uppercase for readability only.</p>`
            : ''
        }
      </section>

      ${structureWorkflowSections}


      <section class="sequence-detail-panel" id="references">
        <h2>References</h2>
        ${renderStructureDetailReferenceContent(row)}
      </section>
      ${renderDetailPageFooterActions()}

    </section>
  </main>`;
}

function downloadPage() {
  return `<main class="page-download">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card download-card">
      <h1>Download</h1>
      <p class="download-intro">Use this page as the download entry for FoldBridge sequence and structure assets.</p>
      <div class="actions">
        <button type="button" data-route="sequence">Sequence downloads</button>
        <button type="button" data-route="structure">Structure downloads</button>
      </div>
    </section>
  </main>`;
}

function searchPage() {
  const { experimentTypes, modifiers } = getAdvancedSearchOptions();
  const rows = getAdvancedSearchRows();

  return `<main class="page-detail page-browse page-search">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card search-page-shell">
      <div class="search-page-header">
        <h1>Advanced FoldBridge Search</h1>
      </div>

      <section class="search-hero-panel">
        <div class="search-hero-input-shell">
          <label class="search-hero-input">
            <span class="search-hero-icon" aria-hidden="true">⌕</span>
            <input
              id="advanced-search-input"
              type="search"
              placeholder="Search by name, sequence, FoldBridge ID, file code, or keyword..."
              value="${advancedSearchQuery.replace(/"/g, '&quot;')}"
            />
            <button id="advanced-search-clear" type="button" class="search-inline-clear" ${advancedSearchQuery ? '' : 'disabled'}>Clear</button>
          </label>
        </div>
      </section>

      <section class="search-filter-band">
        <button id="advanced-search-filters-toggle" type="button" class="search-filter-toggle ${advancedSearchFiltersOpen ? 'open' : ''}">
          <span class="search-filter-toggle-label">Filters</span>
          <span class="search-filter-toggle-summary">${renderAdvancedSearchFilterPills()}</span>
          <span class="search-filter-toggle-caret" aria-hidden="true">${advancedSearchFiltersOpen ? '−' : '+'}</span>
        </button>
        <div class="search-filter-drawer ${advancedSearchFiltersOpen ? 'open' : ''}">
          <label>
            <span>Experiment Type</span>
            <select id="advanced-search-experiment">
              <option value="all">All experiment types</option>
              ${experimentTypes
                .map(
                  (item) =>
                    `<option value="${item.replace(/"/g, '&quot;')}" ${advancedSearchExperiment === item ? 'selected' : ''}>${item}</option>`
                )
                .join('')}
            </select>
          </label>
          <label>
            <span>Modifier</span>
            <select id="advanced-search-modifier">
              <option value="all">All modifiers</option>
              ${modifiers
                .map(
                  (item) =>
                    `<option value="${item.replace(/"/g, '&quot;')}" ${advancedSearchModifier === item ? 'selected' : ''}>${item}</option>`
                )
                .join('')}
            </select>
          </label>
          <label>
            <span>Length</span>
            <select id="advanced-search-length-band">
              <option value="all" ${advancedSearchLengthBand === 'all' ? 'selected' : ''}>All lengths</option>
              <option value="short" ${advancedSearchLengthBand === 'short' ? 'selected' : ''}>&lt; 60 nt</option>
              <option value="medium" ${advancedSearchLengthBand === 'medium' ? 'selected' : ''}>60-100 nt</option>
              <option value="long" ${advancedSearchLengthBand === 'long' ? 'selected' : ''}>&gt; 100 nt</option>
            </select>
          </label>
          <button id="advanced-search-reset" type="button" class="ghost search-reset-btn">Reset filters</button>
        </div>
      </section>

      <section class="search-results-shell">
        <div class="search-results-toolbar">
          <div class="search-results-count">
            <strong>${rows.length}</strong>
            <span>${rows.length === 1 ? 'result' : 'results'}</span>
          </div>
          <div class="search-results-controls">
            <label class="search-sort-control">
              <span>Sort by</span>
              <select id="advanced-search-sort">
                <option value="relevance" ${advancedSearchSort === 'relevance' ? 'selected' : ''}>Relevance</option>
                <option value="name" ${advancedSearchSort === 'name' ? 'selected' : ''}>Name</option>
                <option value="length" ${advancedSearchSort === 'length' ? 'selected' : ''}>Length</option>
                <option value="experiment" ${advancedSearchSort === 'experiment' ? 'selected' : ''}>Experiment type</option>
              </select>
            </label>
            <button id="advanced-search-export" type="button" class="search-export-btn">Export CSV</button>
            <div class="search-view-toggle" role="group" aria-label="Search result view">
              <button id="advanced-search-view-list" type="button" class="${advancedSearchView === 'list' ? 'active' : ''}">List</button>
              <button id="advanced-search-view-grid" type="button" class="${advancedSearchView === 'grid' ? 'active' : ''}">Cards</button>
            </div>
          </div>
        </div>

        <div class="search-results-body">
          ${renderAdvancedSearchResults(rows)}
        </div>
      </section>
    </section>
  </main>`;
}


function downloadStructuresPage() {
  const totalStructurePages = Math.max(1, Math.ceil(structureEntryRows.length / CASE3D_PAGE_SIZE));
  if (structureCurrentPage > totalStructurePages) structureCurrentPage = totalStructurePages;
  const structureStartIndex = (structureCurrentPage - 1) * CASE3D_PAGE_SIZE;
  const visibleStructureRows = structureEntryRows.slice(structureStartIndex, structureStartIndex + CASE3D_PAGE_SIZE);
  const structureRows = visibleStructureRows.length
    ? visibleStructureRows
        .map(
          (row, idx) => {
            const globalIndex = structureStartIndex + idx + 1;
            return `<tr>
              <td>
                <input
                  type="checkbox"
                  class="structure-select"
                  data-structure-id="${row.foldBridgeId}"
                  ${selectedStructureIds.has(row.foldBridgeId) ? 'checked' : ''}
                />
              </td>
              <td class="structure-index-cell">${globalIndex}</td>
              <td><a href="${row.detailPage}" class="sequence-link">${row.foldBridgeId}</a></td>
              <td>${row.name || 'Untitled record'}</td>
              <td>${row.species || 'N/A'}</td>
              <td>${row.discoveryYear || 'N/A'}</td>
              <td><span class="entry-sequence" title="${row.sequence || 'Sequence unavailable'}">${row.sequence || 'N/A'}</span></td>
              <td>${renderPdbExternalLink(row.bestPdbId)}</td>
              <td>${formatBlastEvalue(row.bestEvalue)}</td>
              <td>${formatBlastPercent(row.bestIdentity)}</td>
              <td>${formatBlastPercent(row.bestCoverage)}</td>
            </tr>`;
          }
        )
        .join('')
    : `<tr><td colspan="11" class="entry-table-empty">No structure matches yet.</td></tr>`;

  return `<main class="page-download">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card browse-entry-section">
      <h1>Structure</h1>
      <p class="browse-section-note">This page lists probing-centered FoldBridge records that already have a best tertiary-structure match in the current BLAST mapping table.</p>
      <div class="download-toolbar browse-toolbar">
        <button
          type="button"
          id="select-all-structure"
          class="browse-action-btn ${structureEntryRows.length ? '' : 'is-disabled'}"
          ${structureEntryRows.length ? '' : 'disabled'}
          aria-disabled="${structureEntryRows.length ? 'false' : 'true'}"
        >
          Select All
        </button>
        <button
          type="button"
          id="download-selected-structure"
          class="browse-action-btn ${selectedStructureIds.size ? 'is-active' : 'is-disabled'}"
          ${selectedStructureIds.size ? '' : 'disabled'}
          aria-disabled="${selectedStructureIds.size ? 'false' : 'true'}"
        >
          Export Selected (${selectedStructureIds.size})
        </button>
        <button
          type="button"
          id="clear-selected-structure"
          class="browse-action-btn ${selectedStructureIds.size ? 'is-active' : 'is-disabled'}"
          ${selectedStructureIds.size ? '' : 'disabled'}
          aria-disabled="${selectedStructureIds.size ? 'false' : 'true'}"
        >
          Clear Selection
        </button>
      </div>
      <div class="entry-table-wrap">
        <table class="entry-table case-detail-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>No.</th>
              <th>FoldBridge ID</th>
              <th>Name</th>
              <th>Species</th>
              <th>Discovery year</th>
              <th>Sequence</th>
              <th>PDB ID</th>
              <th>E-value</th>
              <th>Identity</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>${structureRows}</tbody>
        </table>
      </div>
      <div class="browse-pagination">
        <div class="browse-pagination-info">
          <span class="browse-pagination-status">Page ${structureCurrentPage} of ${totalStructurePages}</span>
          ${renderPageJumpControls('structure', totalStructurePages, structureCurrentPage)}
        </div>
        <div class="browse-pagination-actions">
          <button
            type="button"
            id="structure-prev-page"
            class="download-outline-btn"
            ${structureCurrentPage === 1 ? 'disabled' : ''}
          >
            Previous
          </button>
          <button
            type="button"
            id="structure-next-page"
            class="download-outline-btn"
            ${structureCurrentPage === totalStructurePages ? 'disabled' : ''}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  </main>`;
}

function publicationsPage() {
  const headers = Array.from({ length: 10 }, (_, i) => `<th>Column ${i + 1}</th>`).join('');
  const rows = Array.from({ length: 5 }, () => `
    <tr>
      ${Array.from({ length: 10 }, () => '<td>&nbsp;</td>').join('')}
    </tr>
  `).join('');

  return `<main class="page-publications">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card">
      <h1>Publications Page</h1>
      <table class="structure-table">
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>
  </main>`;
}

function helpPage() {
  return `<main class="page-help">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card help-page-shell">
      <div class="help-page-header">
        <h1>Help</h1>
        <p class="page-explainer">This page provides database documentation, usage guidelines, research group details, and contact options for FoldBridge.</p>
      </div>

      <section class="help-module-grid">
        <article class="help-module-card help-module-card-wide">
          <div class="help-module-titlebar">
            <h2>About FoldBridge database</h2>
          </div>
          <div class="help-module-body" style="color: var(--textSecondary); line-height: 1.7; font-size: 0.98rem;">
            <p style="margin: 0;">
              <strong>FoldBridge</strong> Database is designed to provide comprehensive mappings between high-throughput RNA chemical probing experiments and 3D tertiary structures. Each RNA mapping page includes a brief introduction and offers various search options, such as sequence, structures, and chemical probing reactivities. Users can submit new RNA structure-mapping cases or related comments through the feedback portal to help us enhance our database. The <strong style="background: #fff7df; color: #a26f0c; padding: 2px 6px; border-radius: 6px; font-weight: 600; font-size: 0.9em; margin-inline: 2px; display: inline-block;">Sequence</strong> page compiles information on chemical probing targets and their primary sequences verified by published studies. The <strong style="background: #fff7df; color: #a26f0c; padding: 2px 6px; border-radius: 6px; font-weight: 600; font-size: 0.9em; margin-inline: 2px; display: inline-block;">Structure</strong> page showcases 3D structural details and alignment statistics, updated regularly. The <strong style="background: #fff7df; color: #a26f0c; padding: 2px 6px; border-radius: 6px; font-weight: 600; font-size: 0.9em; margin-inline: 2px; display: inline-block;">Probing</strong> page offers detailed insights into the per-base chemical reactivity (e.g., SHAPE/DMS profiles) mapped onto structural models, and the <strong style="background: #fff7df; color: #a26f0c; padding: 2px 6px; border-radius: 6px; font-weight: 600; font-size: 0.9em; margin-inline: 2px; display: inline-block;">Browse</strong> and <strong style="background: #fff7df; color: #a26f0c; padding: 2px 6px; border-radius: 6px; font-weight: 600; font-size: 0.9em; margin-inline: 2px; display: inline-block;">Search</strong> pages provide links to individual entry details, structural alignments, and interactive visualizations.
            </p>
          </div>
        </article>

        <article class="help-module-card">
          <div class="help-module-titlebar">
            <h2>How to contact us</h2>
          </div>
          <div class="help-module-body">
            <p>For any inquiries or concerns regarding the database, please reach out to xxx</p>
          </div>
        </article>

        <article class="help-module-card">
          <div class="help-module-titlebar">
            <h2>Usage</h2>
          </div>
          <div class="help-module-body help-module-body-empty"></div>
        </article>

        <article class="help-module-card">
          <div class="help-module-titlebar">
            <h2>How to make a feedback</h2>
          </div>
          <div class="help-module-body" style="color: var(--textSecondary); line-height: 1.7; font-size: 0.98rem;">
            <p style="margin: 0;">
              You are welcomed to send us feedback and your ideas or suggestions will be greatly valued. We will continue to have our database improved to be fully functional and user-friendly. Your opinions will be fully considered. Click the <strong style="background: #fff7df; color: #a26f0c; padding: 2px 6px; border-radius: 6px; font-weight: 600; font-size: 0.9em; margin-inline: 2px; display: inline-block;">Submit</strong> button or figures to record your suggestions and comments on Google sheet. We provide more than one entrence you can find to send your feedback.
            </p>
          </div>
        </article>

        <article class="help-module-card help-module-card-wide">
          <div class="help-module-titlebar">
            <h2>Group members</h2>
          </div>
          <div class="help-module-body">
            <div class="help-member-grid">
              <article class="help-member-card">
                <div class="help-member-avatar">
                  <img src="./src/assets/groupmember/Chichau_photo.jpg" alt="Portrait of Zhichao (Chichau) Miao" />
                </div>
                <div class="help-member-content">
                  <h3><a class="help-member-name-link" href="mailto:miao_zhichao@gzlab.ac.cn">Zhichao (Chichau) Miao</a></h3>
                  <p class="help-member-role"><span class="help-member-role-initial">P</span>rincipal Investigator of Guangzhou Lab</p>
                  <ul class="help-member-history">
                    <li>PhD <a class="help-member-link" href="https://ibp.cas.cn/" target="_blank" rel="noopener noreferrer">Institute of Biophysics, CAS</a></li>
                    <li>Chercheur at <a class="help-member-link" href="https://ibmc.cnrs.fr/en/" target="_blank" rel="noopener noreferrer">IBMC, CNRS</a></li>
                    <li>PostDoc at <a class="help-member-link" href="https://www.ebi.ac.uk/" target="_blank" rel="noopener noreferrer">EMBL-EBI</a></li>
                    <li>Visiting Scientist at <a class="help-member-link" href="https://www.sanger.ac.uk/" target="_blank" rel="noopener noreferrer">Wellcome Sanger Institute</a></li>
                    <li>Senior Bioinformatician at <a class="help-member-link" href="https://www.ebi.ac.uk/" target="_blank" rel="noopener noreferrer">EMBL-EBI</a></li>
                  </ul>
                </div>
              </article>

              <article class="help-member-card">
                <div class="help-member-avatar">
                  <img src="./src/assets/groupmember/Lin_Huang.jpg" alt="Portrait of Lin Huang" />
                </div>
                <div class="help-member-content">
                  <h3><a class="help-member-name-link" href="mailto:huanglin36@mail.sysu.edu.cn">Lin Huang</a></h3>
                  <p class="help-member-role"><span class="help-member-role-initial">P</span>rincipal Investigator of Sun Yat-sen University</p>
                  <ul class="help-member-history">
                    <li>PhD <a class="help-member-link" href="https://en.whu.edu.cn/" target="_blank" rel="noopener noreferrer">Wuhan University</a></li>
                    <li>Postdoctoral research assistant at <a class="help-member-link" href="https://www.dundee.ac.uk/" target="_blank" rel="noopener noreferrer">University of<br />Dundee, UK</a></li>
                    <li>Senior research associate at <a class="help-member-link" href="https://www.dundee.ac.uk/" target="_blank" rel="noopener noreferrer">University of<br />Dundee, UK</a></li>
                  </ul>
                </div>
              </article>
            </div>
          </div>
        </article>
      </section>
    </section>
  </main>`;
}


function pageFor(name) {
  const safeRoute = normalizeRoute(name);
  if (safeRoute === 'browse') return browsePage();
  if (safeRoute === 'case-10fz') return case10fzPage();
  if (safeRoute === 'case-detail') return caseDetailPage();
  if (safeRoute === 'structure-detail') return structureDetailPage();
  if (safeRoute === 'sequence') return downloadSequencesPage();
  if (safeRoute === 'structure') return structurePage();
  if (safeRoute === 'probing') return detailPage();
  if (safeRoute === 'download') return downloadPage();
  if (safeRoute === 'search') return searchPage();
  if (safeRoute === 'download-sequences') return downloadSequencesPage();
  if (safeRoute === 'download-structures') return downloadStructuresPage();
  if (safeRoute === 'detail') return detailPage();
  if (safeRoute === 'publications') return publicationsPage();
  if (safeRoute === 'help') return helpPage();
  if (safeRoute === 'sequence-detail') return sequenceDetailPage();
  return homePage();
}

function render(options = {}) {
  const { preserveScroll = false } = options;
  const previousScrollX = window.scrollX;
  const previousScrollY = window.scrollY;
  const activeElement = document.activeElement;
  const shouldRestoreTextFocus =
    activeElement &&
    (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') &&
    typeof activeElement.id === 'string' &&
    activeElement.id.length > 0;
  const focusState = shouldRestoreTextFocus
    ? {
        id: activeElement.id,
        selectionStart: typeof activeElement.selectionStart === 'number' ? activeElement.selectionStart : null,
        selectionEnd: typeof activeElement.selectionEnd === 'number' ? activeElement.selectionEnd : null,
        selectionDirection: typeof activeElement.selectionDirection === 'string' ? activeElement.selectionDirection : 'none'
      }
    : null;

  setTheme(theme, mode);
  document.getElementById('app').innerHTML = `${nav()}${pageFor(route)}${renderFooter()}`;
  const exportAllBtn = document.getElementById('export-all-sequences');
  const modeToggle = document.getElementById('mode-toggle');
  if (modeToggle) {
    modeToggle.addEventListener('click', () => {
      mode = mode === 'dark' ? 'light' : 'dark';
      render({ preserveScroll: true });
    });
  }
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => {
      downloadRowsAsCsv(getFilteredSequenceRows(), 'sequences-export.csv');
    });
  }
  const exportSelectedBtn = document.getElementById('export-selected-sequences');
  if (exportSelectedBtn) {
    exportSelectedBtn.addEventListener('click', () => {
      const selectedRows = sequenceRows.filter((row) => selectedSequenceIds.has(row.id));
      downloadRowsAsCsv(selectedRows, 'sequences-selected.csv');
    });
  }
  const selectVisibleBtn = document.getElementById('select-visible-sequences');
  if (selectVisibleBtn) {
    selectVisibleBtn.addEventListener('click', () => {
      getFilteredSequenceRows().forEach((row) => selectedSequenceIds.add(row.id));
      render({ preserveScroll: true });
    });
  }
  const clearSelectedBtn = document.getElementById('clear-selected-sequences');
  if (clearSelectedBtn) {
    clearSelectedBtn.addEventListener('click', () => {
      selectedSequenceIds.clear();
      render({ preserveScroll: true });
    });
  }
  const sequenceSearchInput = document.getElementById('sequence-search');
  if (sequenceSearchInput) {
    sequenceSearchInput.addEventListener('input', (event) => {
      sequenceSearchQuery = event.target.value;
      render({ preserveScroll: true });
    });
  }
  const advancedSearchInput = document.getElementById('advanced-search-input');
  if (advancedSearchInput) {
    advancedSearchInput.addEventListener('input', (event) => {
      advancedSearchQuery = event.target.value;
      render({ preserveScroll: true });
    });
  }
  const advancedSearchClear = document.getElementById('advanced-search-clear');
  if (advancedSearchClear) {
    advancedSearchClear.addEventListener('click', () => {
      advancedSearchQuery = '';
      render({ preserveScroll: true });
    });
  }
  const advancedSearchFiltersToggle = document.getElementById('advanced-search-filters-toggle');
  if (advancedSearchFiltersToggle) {
    advancedSearchFiltersToggle.addEventListener('click', () => {
      advancedSearchFiltersOpen = !advancedSearchFiltersOpen;
      render({ preserveScroll: true });
    });
  }
  const advancedSearchExperimentSelect = document.getElementById('advanced-search-experiment');
  if (advancedSearchExperimentSelect) {
    advancedSearchExperimentSelect.addEventListener('change', (event) => {
      advancedSearchExperiment = event.target.value;
      render({ preserveScroll: true });
    });
  }
  const advancedSearchModifierSelect = document.getElementById('advanced-search-modifier');
  if (advancedSearchModifierSelect) {
    advancedSearchModifierSelect.addEventListener('change', (event) => {
      advancedSearchModifier = event.target.value;
      render({ preserveScroll: true });
    });
  }
  const advancedSearchLengthBandSelect = document.getElementById('advanced-search-length-band');
  if (advancedSearchLengthBandSelect) {
    advancedSearchLengthBandSelect.addEventListener('change', (event) => {
      advancedSearchLengthBand = event.target.value;
      render({ preserveScroll: true });
    });
  }
  const advancedSearchReset = document.getElementById('advanced-search-reset');
  if (advancedSearchReset) {
    advancedSearchReset.addEventListener('click', () => {
      advancedSearchExperiment = 'all';
      advancedSearchModifier = 'all';
      advancedSearchLengthBand = 'all';
      render({ preserveScroll: true });
    });
  }
  const advancedSearchSortSelect = document.getElementById('advanced-search-sort');
  if (advancedSearchSortSelect) {
    advancedSearchSortSelect.addEventListener('change', (event) => {
      advancedSearchSort = event.target.value;
      render({ preserveScroll: true });
    });
  }
  const advancedSearchExport = document.getElementById('advanced-search-export');
  if (advancedSearchExport) {
    advancedSearchExport.addEventListener('click', () => {
      downloadRowsAsCsv(getAdvancedSearchRows(), 'foldbridge-search-results.csv');
    });
  }
  const advancedSearchViewList = document.getElementById('advanced-search-view-list');
  if (advancedSearchViewList) {
    advancedSearchViewList.addEventListener('click', () => {
      if (advancedSearchView === 'list') return;
      advancedSearchView = 'list';
      render({ preserveScroll: true });
    });
  }
  const advancedSearchViewGrid = document.getElementById('advanced-search-view-grid');
  if (advancedSearchViewGrid) {
    advancedSearchViewGrid.addEventListener('click', () => {
      if (advancedSearchView === 'grid') return;
      advancedSearchView = 'grid';
      render({ preserveScroll: true });
    });
  }
  const downloadSelectedRdatBtn = document.getElementById('download-selected-rdat');
  bindPseudoButton(downloadSelectedRdatBtn, () => {
    downloadSelectedRdatFiles();
  });
  const clearSelectedRdatBtn = document.getElementById('clear-selected-rdat');
  bindPseudoButton(clearSelectedRdatBtn, () => {
    selectedBrowseIds.clear();
    render({ preserveScroll: true });
  });
  const browsePrevPageBtn = document.getElementById('browse-prev-page');
  if (browsePrevPageBtn) {
    browsePrevPageBtn.addEventListener('click', () => {
      if (browseCurrentPage <= 1) return;
      browseCurrentPage -= 1;
      render({ preserveScroll: true });
    });
  }
  const browseNextPageBtn = document.getElementById('browse-next-page');
  if (browseNextPageBtn) {
    browseNextPageBtn.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(browseEntryRows.length / BROWSE_PAGE_SIZE));
      if (browseCurrentPage >= totalPages) return;
      browseCurrentPage += 1;
      render({ preserveScroll: true });
    });
  }
  bindPageJump({
    inputId: 'browse-page-input',
    buttonId: 'browse-page-go',
    totalPages: () => Math.max(1, Math.ceil(browseEntryRows.length / BROWSE_PAGE_SIZE)),
    getCurrentPage: () => browseCurrentPage,
    setCurrentPage: (value) => {
      browseCurrentPage = value;
    }
  });
  const case3dPrevPageBtn = document.getElementById('case3d-prev-page');
  if (case3dPrevPageBtn) {
    case3dPrevPageBtn.addEventListener('click', () => {
      if (case3dCurrentPage <= 1) return;
      case3dCurrentPage -= 1;
      render({ preserveScroll: true });
    });
  }
  const case3dNextPageBtn = document.getElementById('case3d-next-page');
  if (case3dNextPageBtn) {
    case3dNextPageBtn.addEventListener('click', () => {
      const total3dPages = Math.max(1, Math.ceil(case3dRows.length / CASE3D_PAGE_SIZE));
      if (case3dCurrentPage >= total3dPages) return;
      case3dCurrentPage += 1;
      render({ preserveScroll: true });
    });
  }
  bindPageJump({
    inputId: 'case3d-page-input',
    buttonId: 'case3d-page-go',
    totalPages: () => Math.max(1, Math.ceil(case3dRows.length / CASE3D_PAGE_SIZE)),
    getCurrentPage: () => case3dCurrentPage,
    setCurrentPage: (value) => {
      case3dCurrentPage = value;
    }
  });
  const structurePrevPageBtn = document.getElementById('structure-prev-page');
  if (structurePrevPageBtn) {
    structurePrevPageBtn.addEventListener('click', () => {
      if (structureCurrentPage <= 1) return;
      structureCurrentPage -= 1;
      render({ preserveScroll: true });
    });
  }
  const structureNextPageBtn = document.getElementById('structure-next-page');
  if (structureNextPageBtn) {
    structureNextPageBtn.addEventListener('click', () => {
      const totalStructurePages = Math.max(1, Math.ceil(structureEntryRows.length / CASE3D_PAGE_SIZE));
      if (structureCurrentPage >= totalStructurePages) return;
      structureCurrentPage += 1;
      render({ preserveScroll: true });
    });
  }
  bindPageJump({
    inputId: 'structure-page-input',
    buttonId: 'structure-page-go',
    totalPages: () => Math.max(1, Math.ceil(structureEntryRows.length / CASE3D_PAGE_SIZE)),
    getCurrentPage: () => structureCurrentPage,
    setCurrentPage: (value) => {
      structureCurrentPage = value;
    }
  });
  const selectAllStructureBtn = document.getElementById('select-all-structure');
  bindPseudoButton(selectAllStructureBtn, () => {
    structureEntryRows.forEach((row) => selectedStructureIds.add(row.foldBridgeId));
    render({ preserveScroll: true });
  });
  const downloadSelectedStructureBtn = document.getElementById('download-selected-structure');
  bindPseudoButton(downloadSelectedStructureBtn, () => {
    downloadSelectedRdatFiles([...selectedStructureIds]);
  });
  const clearSelectedStructureBtn = document.getElementById('clear-selected-structure');
  bindPseudoButton(clearSelectedStructureBtn, () => {
    selectedStructureIds.clear();
    render({ preserveScroll: true });
  });
  const caseDetailPrevPageBtn = document.getElementById('case-detail-prev-page');
  if (caseDetailPrevPageBtn) {
    caseDetailPrevPageBtn.addEventListener('click', () => {
      if (caseDetailSequencePage <= 1) return;
      caseDetailSequencePage -= 1;
      render({ preserveScroll: true });
    });
  }
  const caseDetailNextPageBtn = document.getElementById('case-detail-next-page');
  if (caseDetailNextPageBtn) {
    caseDetailNextPageBtn.addEventListener('click', () => {
      const caseId = getCaseIdFromHash();
      const detail = caseId ? caseDetailCache.get(caseId) : null;
      const totalPages = Math.max(
        1,
        Math.ceil(((detail && !detail.error ? detail.rmdbSequences.length : 0) || 0) / CASE_DETAIL_SEQUENCE_PAGE_SIZE)
      );
      if (caseDetailSequencePage >= totalPages) return;
      caseDetailSequencePage += 1;
      render({ preserveScroll: true });
    });
  }
  const selectAllRdatBtn = document.getElementById('select-all-rdat');
  bindPseudoButton(selectAllRdatBtn, () => {
    browseEntryRows.forEach((row) => selectedBrowseIds.add(row.foldBridgeId));
    render({ preserveScroll: true });
  });
  document.querySelectorAll('.browse-select').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const id = event.target.getAttribute('data-browse-id');
      if (!id) return;
      if (event.target.checked) selectedBrowseIds.add(id);
      else selectedBrowseIds.delete(id);
      render({ preserveScroll: true });
    });
  });
  document.querySelectorAll('.structure-select').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const id = event.target.getAttribute('data-structure-id');
      if (!id) return;
      if (event.target.checked) selectedStructureIds.add(id);
      else selectedStructureIds.delete(id);
      render({ preserveScroll: true });
    });
  });
  document.querySelectorAll('.sequence-select').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const id = event.target.getAttribute('data-sequence-id');
      if (event.target.checked) {
        selectedSequenceIds.add(id);
      } else {
        selectedSequenceIds.delete(id);
      }
      render({ preserveScroll: true });
    });
  });


  initHeaderSearch();
  initAptamerMultiSelect();
  initSecondaryStructureModule();
  initMolstarModule();
  initHomeStructureShowcase();
  initSequenceDetailMolstar();
  initSequenceDetailSecondaryHeatmap();
  initStructureDetailSecondaryForna();
  initStructureDetailSecondaryHeatmap();
  initStructureDetailMolstar();
  initPredictedStructureDetailMolstar();
  initAnimatedStats();
  initHomeDashboardFilters();
  initHomeInteractiveDashboard();

const subnavMenuToggle = document.getElementById('subnav-menu-toggle');
const subnavNav = document.querySelector('.hero-subnav nav');

if (subnavMenuToggle && subnavNav) {
  subnavMenuToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    isSubnavMenuOpen = !isSubnavMenuOpen;
    render({ preserveScroll: true });
  });

  subnavNav.addEventListener('click', (event) => {
    event.stopPropagation();
  });
}

document.addEventListener('click', () => {
  let shouldRender = false;
  if (isDownloadMenuOpen) {
    isDownloadMenuOpen = false;
    shouldRender = true;
  }
  if (isSubnavMenuOpen) {
    isSubnavMenuOpen = false;
    shouldRender = true;
  }
  if (shouldRender) {
    render({ preserveScroll: true });
  }
});


  document.querySelectorAll('[data-route]').forEach((el) => {
    el.addEventListener('click', () => {
      isDownloadMenuOpen = false;
      isSubnavMenuOpen = false;
      route = normalizeRoute(el.getAttribute('data-route'));
      window.location.hash = route;
    });
  });

  document.querySelectorAll('.back-to-top-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.querySelectorAll('[data-scroll-target]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = el.getAttribute('data-scroll-target');
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  if (preserveScroll || focusState) {
    requestAnimationFrame(() => {
      if (preserveScroll) {
        window.scrollTo(previousScrollX, previousScrollY);
      }

      if (!focusState) return;
      const nextActive = document.getElementById(focusState.id);
      if (!nextActive || (nextActive.tagName !== 'INPUT' && nextActive.tagName !== 'TEXTAREA')) return;
      nextActive.focus({ preventScroll: true });
      if (typeof nextActive.setSelectionRange === 'function' && focusState.selectionStart !== null && focusState.selectionEnd !== null) {
        nextActive.setSelectionRange(focusState.selectionStart, focusState.selectionEnd, focusState.selectionDirection);
      }
    });
  }
}

function initHomeDashboardFilters() {
  const filterButtons = document.querySelectorAll('[data-home-filter-kind]');
  if (!filterButtons.length) return;

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.getAttribute('data-home-filter-kind');
      const value = button.getAttribute('data-home-filter-value');
      if (!kind || !value) return;
      const key = kind === 'year' ? 'years' : 'categories';
      const values = new Set(homeDashboardFilters[key]);
      if (values.has(value)) values.delete(value);
      else values.add(value);
      homeDashboardFilters[key] = [...values];
      render({ preserveScroll: true });
    });
  });

  document.querySelectorAll('[data-home-filter-clear]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.getAttribute('data-home-filter-clear');
      const value = button.getAttribute('data-home-filter-value');
      if (!kind || !value) return;
      const key = kind === 'year' ? 'years' : 'categories';
      homeDashboardFilters[key] = homeDashboardFilters[key].filter((item) => item !== value);
      render({ preserveScroll: true });
    });
  });

  const resetButton = document.getElementById('home-dashboard-reset');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      homeDashboardFilters = { years: [], categories: [] };
      render({ preserveScroll: true });
    });
  }

  const exportButton = document.getElementById('home-dashboard-export');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      const rows = getFilteredHomeDashboardRows(sequenceRows);
      downloadRowsAsCsv(rows, 'home-dashboard-filtered.csv');
    });
  }
}

function initHomeInteractiveDashboard() {
  document.querySelectorAll('[data-filter-species]').forEach((el) => {
    el.addEventListener('click', () => {
      const species = el.getAttribute('data-filter-species');
      if (homeActiveSpecies === species) {
        homeActiveSpecies = '';
      } else {
        homeActiveSpecies = species;
      }
      homeTablePage = 1;
      render({ preserveScroll: true });
    });
  });

  document.querySelectorAll('[data-filter-year]').forEach((el) => {
    el.addEventListener('click', () => {
      const year = el.getAttribute('data-filter-year');
      if (homeActiveYear === year) {
        homeActiveYear = '';
      } else {
        homeActiveYear = year;
      }
      homeTablePage = 1;
      render({ preserveScroll: true });
    });
  });

  document.querySelectorAll('[data-clear-filter]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      const type = el.getAttribute('data-clear-filter');
      if (type === 'species') homeActiveSpecies = '';
      if (type === 'year') homeActiveYear = '';
      homeTablePage = 1;
      render({ preserveScroll: true });
    });
  });

  const clearAllBtn = document.getElementById('home-clear-all-filters');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      homeActiveSpecies = '';
      homeActiveYear = '';
      homeTablePage = 1;
      render({ preserveScroll: true });
    });
  }

  const prevBtn = document.getElementById('home-page-prev');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (homeTablePage > 1) {
        homeTablePage -= 1;
        render({ preserveScroll: true });
        const section = document.querySelector('.home-table-section');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  const nextBtn = document.getElementById('home-page-next');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      homeTablePage += 1;
      render({ preserveScroll: true });
      const section = document.querySelector('.home-table-section');
      if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

window.addEventListener('hashchange', () => {
  route = routeFromHash(window.location.hash);
  if (route !== 'case-detail') {
    activeCaseDetailId = null;
    caseDetailSequencePage = 1;
  }
  render();
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
  });
});


async function initApp() {
  await loadSequenceRows();
  await loadBrowseEntryRows();
  await loadCase3dRows();
  render();
}

initApp();
