import { cssVarsFor, themeTokens } from './theme.js';
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
  initSequenceDetailSecondaryHeatmap
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
import { normalizeRoute, parseHashRoute, routeFromHash } from './router.js';
import { downloadRowsAsCsv } from './modules.js';
import { renderPdbCaseIndexPage, renderPdbCasePage } from './pdbCaseView.js';
import { createCaseStore } from './rmdbCaseStore.js';
import { createProbingArticleStore } from './probingArticleStore.js';
import { renderProbingArticleIndex, renderProbingArticlePage } from './probingArticleView.js';
import {
  buildAtlasSearchState,
  SAMPLE_ANNOJOIN_ATLAS_TABLES
} from './annojoinAtlasData.js';
import { renderAnnojointAtlasPage } from './annojoinAtlasView.js';
import { bindAnnojointAtlasTable } from './annojoinAtlasController.js';
import {
  annojoinExportRow,
  buildAnnojointTableGroups,
  defaultVisibleAnnojointColumnIds,
  isAnnojointSearchActive,
  normalizeVisibleAnnojointColumnIds,
  paginateAnnojointRows,
  rowCaseId,
  rowCaseKey,
  searchAnnojointRows,
  sortAnnojointCases
} from './annojoinAtlasTableModel.js';
import { createAnnojointAtlasStore } from './annojoinAtlasStore.js';
import { initAnnojointStructureViewers } from './annojoinStructureViewer.js';
import {
  initAnnojointCasePage,
  renderAnnojointCasePage
} from './annojoinCaseView.js';
import {
  buildSearchHash,
  createSearchService,
  filtersFromSearchParams,
  searchParamsFromHash
} from './search/searchService.js';
let sequenceRows = [];
let browseEntryRows = [];
let selectedBrowseIds = new Set();
let selectedSequenceIds = new Set();
let selectedAnnojointCaseIds = new Set();
let expandedAnnojointGroupIds = new Set();
let uncappedAnnojointGroupIds = new Set();
let visibleAnnojointColumnIds = defaultVisibleAnnojointColumnIds();
let annojoinPageSize = 50;
let sequenceSearchQuery = '';
// RMDB→PDB case 资产懒加载层与浏览器侧渲染缓存。
// store 命中内存缓存避免重复 fetch；下面三类 state 缓存“已加载”结果，
// 让同步的 pageFor()/render() 路径命中即渲染数据，未命中则渲染 loading 占位并触发后台加载。
const pdbCaseStore = createCaseStore();
const annojoinAtlasStore = createAnnojointAtlasStore();
const probingArticleStore = createProbingArticleStore();
let pdbCaseIndexState = null; // null=未加载, 'loading', 'error', 或 { cases: [...] }
const pdbCaseDetailState = new Map(); // pdbId -> 'loading' | 'error' | { detail, profiles, alignmentPage, reactivitySummary }
let annojoinAtlasIndexState = null; // null=未加载, 'loading', 'error', 或 index.json
let annojoinDetailRouteIndexState = null; // null=未加载, 'loading', 'error', 或 detail-route-index.json
const annojoinAtlasDetailState = new Map(); // caseKey/caseId -> 'loading' | 'error' | generated case asset
const annojoinCaseConfidenceState = new Map(); // caseKey/caseId -> 'loading' | 'error' | { summary, evidence, provenance }
let probingArticleIndexState = null; // null=未加载, 'loading', 'error', 或 index.json
const probingArticleDetailState = new Map(); // slug -> 'loading' | 'error' | detail.json
let pdbCaseConfidenceFilter = 'all';
let pdbCaseAlignmentPageByPdb = new Map(); // pdbId -> 当前 alignment 页码（1-based）
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
  foldbridgeUse,
  references
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
    foldbridgeUse: foldbridgeUse ?? `FoldBridge can use ${title} as a dedicated child page under ${category}, so users can browse by category first and then drill into method-specific details.`,
    references: references ?? [
      `${title} primary reference placeholder for project curation.`,
      `${category} overview reference placeholder for project curation.`
    ]
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
    references: [
      'Rouskin S et al. Genome-wide probing of RNA structure reveals active unfolding of mRNA structures in vivo. Nature. 2014.',
      'Spitale RC et al. Structural imprints in vivo decode RNA regulatory mechanisms. Nature. 2015.'
    ]
  }),
  createTechnologyMethod({ slug: 'structure-seq', title: 'Structure-seq', category: 'DMS-based probing', subtitle: 'In vivo DMS-guided structure sequencing across cellular transcriptomes.' }),
  createTechnologyMethod({ slug: 'structure-seq-cap', title: 'Structure-Seq', category: 'DMS-based probing', subtitle: 'Capitalized naming variant often used in literature and figure labels.' }),
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
    references: [
      'Weeks KM. Advances in RNA structure analysis by chemical probing. Curr Opin Struct Biol. 2010.',
      'Mortimer SA, Weeks KM. Time-resolved RNA SHAPE chemistry. Example overview reference.'
    ]
  }),
  createTechnologyMethod({ slug: 'shape-seq', title: 'SHAPE-seq', category: 'SHAPE-based probing', subtitle: 'Sequencing-enabled SHAPE workflow for high-throughput RNA structure analysis.' }),
  createTechnologyMethod({ slug: 'shape-map', title: 'SHAPE-MaP', category: 'SHAPE-based probing', subtitle: 'Mutational profiling implementation of SHAPE reactivity measurement.' }),
  createTechnologyMethod({ slug: 'nai-map', title: 'NAI-MaP', category: 'SHAPE-based probing', subtitle: 'NAI-based mutational profiling for structure probing in native-like settings.' }),
  createTechnologyMethod({ slug: 'icshape', title: 'icSHAPE', category: 'SHAPE-based probing', subtitle: 'In vivo click SHAPE workflow for transcriptome-wide structure profiling.' }),
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

function getPdbCaseParamsFromHash() {
  const hash = window.location.hash || '';
  const [, queryString = ''] = hash.split('?');
  const params = new URLSearchParams(queryString);
  return {
    pdbId: params.get('pdbId'),
    pdbReferenceId: params.get('pdbReferenceId'),
    bundleProfileId: params.get('bundleProfileId'),
    rmdbUniqueId: params.get('rmdbUniqueId')
  };
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

function renderColoredSequence(sequence) {
  return String(sequence ?? '')
    .split('')
    .map((char) => {
      const upper = char.toUpperCase();
      if (!'AUGCT'.includes(upper)) return char;
      const cls = upper === 'T' ? 'nucleotide-u' : `nucleotide-${upper.toLowerCase()}`;
      const display = upper === 'T' ? 'U' : char;
      return `<span class="sequence-nucleotide ${cls}">${display}</span>`;
    })
    .join('');
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
      </div>
    </div>`;
  }

  return `<div class="sequence-detail-reference-card">
    <p>This tertiary structure is based on the PDB entry <strong>${row.pdbName ?? ''}</strong>.</p>
    <div class="sequence-detail-reference-links">
      <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/${encodeURIComponent(row.pdbName ?? '')}" target="_blank" rel="noopener noreferrer">Open PDB Entry</a>
    </div>
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

  return `<main class="page-sequence-detail">
    ${renderBundleHeader()}
    <section class="sequence-detail-card">
      <div class="sequence-detail-header">
        <a class="sequence-detail-back" href="#download-sequences">Back to sequence list</a>
        <div class="sequence-detail-title-row">
          <div>
            <p class="sequence-detail-kicker">${row.category ?? 'RNA'} record</p>
            <h1>${row.sequenceName ?? ''}</h1>
            <p>${row.aptamerName ?? ''}</p>
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

async function loadBrowseEntryRows() {
  try {
    const response = await fetch(dataAssetPath('rdat_summary.csv'));
    if (!response.ok) throw new Error('Failed to load RDAT summary');
    const text = await response.text();
    const [header, ...records] = parseCsv(text);
    if (!header?.length) {
      browseEntryRows = [];
      return;
    }

    browseEntryRows = records.map((record) => {
      const row = Object.fromEntries(header.map((key, index) => [key, record[index] ?? '']));
      return {
        foldBridgeId: row['FoldBridge ID'] || '',
        name: row.Name || '',
        sequence: row.Sequence || '',
        length: row.Length || '',
        fileCode: row['File Code'] || '',
        experimentType: row['Experiment Type'] || '',
        modifier: row.Modifier || ''
      };
    });
  } catch (error) {
    console.error(error);
    browseEntryRows = [];
  }
}

function rdatDownloadPath(foldBridgeId) {
  return dataAssetPath(`${foldBridgeId.replace(/^RMDB_/, '')}.rdat`);
}

function downloadSelectedRdatFiles() {
  const selectedIds = [...selectedBrowseIds];
  selectedIds.forEach((foldBridgeId, index) => {
    const link = document.createElement('a');
    link.href = rdatDownloadPath(foldBridgeId);
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



function downloadSequencesPage() {
  const visibleRows = getFilteredSequenceRows();
  const rows = visibleRows.map((row) => `
    <tr>
      <td>
        <input
          type="checkbox"
          class="sequence-select"
          data-sequence-id="${row.id}"
          ${selectedSequenceIds.has(row.id) ? 'checked' : ''}
        />
      </td>
      <td><a href="#sequence-detail?sequenceId=${encodeURIComponent(row.id ?? '')}" class="sequence-link">${row.sequenceName ?? ''}</a></td>
      <td>${row.aptamerName ?? ''}</td>
      <td>${row.article ?? ''}</td>
      <td>${row.category ?? ''}</td>
      <td>
        <span class="sequence-preview" title="${row.type ?? ''}">
          ${row.type ? `${row.type.slice(0, 10)}...` : ''}
        </span>
      </td>
      <td>${row.chemicalProbing ?? ''}</td>
      <td><a href="#pdb-case?pdbId=${encodeURIComponent(row.pdbName ?? '')}" class="sequence-link">${row.pdbName ?? ''}</a></td>
      <td>${row.sequence ?? ''}</td>
      <td>${row.confidence ?? ''}</td>
    </tr>
  `).join('');

  return `<main class="page-download-sequences">
    ${renderBundleHeader()}
    <section class="card download-card">
      <h1>Structures</h1>
      <p class="download-intro">Select one or more rows below to download example structure records. Current data are demo entries copied from the first available record.</p>

      <div class="download-toolbar browse-toolbar">
        <input
          id="sequence-search"
          class="download-search"
          type="search"
          placeholder="Search..."
          value="${sequenceSearchQuery.replace(/"/g, '&quot;')}"
        />
        <button id="export-selected-sequences" type="button" class="download-outline-btn" ${selectedSequenceIds.size ? '' : 'disabled'}>
          Export Selected (${selectedSequenceIds.size})
        </button>
        <button id="export-all-sequences" type="button" class="download-outline-btn">
          Export All Results
        </button>
        <button id="select-visible-sequences" type="button" class="download-outline-btn">
          Select Current Page
        </button>
        <button id="clear-selected-sequences" type="button" class="download-outline-btn">
          Clear Selection
        </button>
      </div>

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
        <span>Showing 1-${visibleRows.length} of ${visibleRows.length} entries</span>
      </div>
    </section>
  </main>`;
}





const routes = ['home', 'browse', 'sequence', 'structure', 'probing', 'download', 'search', 'help', 'pdb-case', 'annojoin-atlas', 'annojoin-case'];
let route = routeFromHash(window.location.hash);
let theme = 'ribocentre';
let mode = localStorage.getItem('foldbridge-mode') === 'dark' ? 'dark' : 'light';
const siteSearchService = createSearchService();
const SAVED_SEARCHES_KEY = 'foldbridge.savedSearches';

function isRouteActive(...names) {
  return names.includes(route);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
  const cards = homeBundleSites.map((site, index) => `
    <article class="bundle-site-card tone-${site.tone}">
      <div class="bundle-site-visual">
        <div class="bundle-site-strand strand-a"></div>
        <div class="bundle-site-strand strand-b"></div>
        <div class="bundle-site-orb orb-${(index % 3) + 1}"></div>
        <span class="bundle-site-badge">${site.short}</span>
      </div>
      <div class="bundle-site-copy">
        <p class="bundle-site-kicker">${site.accent}</p>
        <h3>${site.name}</h3>
        <p>${site.summary}</p>
      </div>
      <div class="bundle-site-footer">
        <span class="bundle-site-tag">${site.tag}</span>
        ${site.action.href
          ? `<a class="bundle-site-link" href="${site.action.href}" target="_blank" rel="noopener noreferrer">${site.action.label}</a>`
          : `<button type="button" class="bundle-site-link" data-route="${site.action.route}">${site.action.label}</button>`}
      </div>
    </article>
  `).join('');

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
            <strong>22</strong>
            <span>xx</span>
          </article>
          <article class="bundle-metric-card">
            <p>sequences</p>
            <strong>xx</strong>
            <span>xx</span>
          </article>
          <article class="bundle-metric-card">
            <p>structures</p>
            <strong>xx</strong>
            <span>xx</span>
          </article>
          <article class="bundle-metric-card">
            <p>technology</p>
            <strong>27</strong>
            <span>xx</span>
          </article>
        </aside>
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
            <form class="global-search-form" id="global-search-form">
              <input id="global-search-input" type="search" placeholder="Search FoldBridge" aria-label="Search FoldBridge" />
              <button type="submit">Search</button>
            </form>
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
          <button type="button" class="nav-btn ${isRouteActive('pdb-case') ? 'active' : ''}" data-route="pdb-case">PDB Cases</button>
          <button type="button" class="nav-btn ${isRouteActive('probing', 'detail') ? 'active' : ''}" data-route="probing">Probing</button>
          <button type="button" class="nav-btn ${isRouteActive('download') ? 'active' : ''}" data-route="download">Download</button>
          <button type="button" class="nav-btn ${isRouteActive('search') ? 'active' : ''}" data-route="search">Search</button>
          <button type="button" class="nav-btn ${isRouteActive('help') ? 'active' : ''}" data-route="help">Help</button>
        </nav>
      </div>
    </div>
  </header>`;
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
    <section class="card bundle-wide-card technology-hero-card">
      <div class="technology-hero-copy">
        <p class="technology-kicker">technology atlas</p>
        <h1>Technology Categories</h1>
        <p class="technology-intro">This page is now organized as a method directory: 5 large technology modules first, then concrete techniques inside each module. Every technique name below opens its own child page.</p>
        <p class="technology-intro technology-intro-secondary">That gives you the exact structure you described: users first browse by category, then click into a specific method page for principle, workflow, strengths, caveats, and references.</p>
        <div class="technology-chip-row">${categoryChips}</div>
      </div>
      <aside class="technology-summary-panel">
        <article class="technology-summary-card">
          <p>major categories</p>
          <strong>${technologyCategories.length}</strong>
          <span>top-level modules on the technology landing page</span>
        </article>
        <article class="technology-summary-card">
          <p>child pages</p>
          <strong>${technologyMethods.length}</strong>
          <span>clickable method pages ready for later expansion</span>
        </article>
      </aside>
    </section>

    <section class="card bundle-wide-card technology-section-card">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">browse by category</p>
          <h2>Category Cards</h2>
        </div>
        <p>Each large card represents one category. Desktop shows two cards per row, and every method stays clickable as its own child page.</p>
      </div>
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

  return `<main class="page-detail">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card technology-detail-hero">
      <a class="technology-back-link" href="#detail">Back to technology overview</a>
      <div class="technology-detail-header">
        <div>
          <p class="technology-kicker">${method.category}</p>
          <h1>${method.title}</h1>
          <p class="technology-intro">${method.subtitle}</p>
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

    <section class="card bundle-wide-card technology-section-card">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">workflow</p>
          <h2>Suggested Page Structure</h2>
        </div>
        <p>This is a good default layout for your future real content: principle first, then workflow, then interpretation, then examples.</p>
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
          <h2>Starter References</h2>
        </div>
        <p>These can later become linked citations, method notes, or protocol references.</p>
      </div>
      <ul class="technology-reference-list">
        ${references}
      </ul>
    </section>
  </main>`;
}

function detailPage() {
  const slug = getTechnologySlugFromHash();
  const header = renderBundleHeader();

  // 探针科普文章优先：若 index 里存在该 slug，则渲染真实阅读页。
  const hasIndex = probingArticleIndexState && typeof probingArticleIndexState === 'object';
  const articleSlugs = hasIndex
    ? new Set((probingArticleIndexState.articles || []).map((a) => a.slug))
    : null;

  if (slug) {
    // 已加载详情 → 渲染阅读页
    const detailState = probingArticleDetailState.get(slug);
    if (detailState && typeof detailState === 'object') {
      return renderProbingArticlePage(detailState, hasIndex ? probingArticleIndexState : null, header);
    }
    // index 已确认该 slug 是真实文章 → 触发详情加载并显示 loading
    if (articleSlugs && articleSlugs.has(slug)) {
      if (detailState !== 'loading' && detailState !== 'error') loadProbingArticleDetail(slug);
      if (detailState === 'error') {
        // 加载失败时回退到旧占位方法页（若存在）
        const method = technologyMethods.find((item) => item.slug === slug);
        if (method) return renderTechnologyMethodPage(method);
      }
      return renderProbingArticleLoadingPage(slug, header, detailState === 'error');
    }
    // index 尚未加载 → 后台拉取，同时乐观触发该 slug 的详情加载
    if (!hasIndex) {
      if (probingArticleIndexState !== 'loading' && probingArticleIndexState !== 'error') {
        loadProbingArticleIndex();
      }
      if (detailState !== 'loading' && detailState !== 'error') loadProbingArticleDetail(slug);
      if (detailState === 'error') {
        const method = technologyMethods.find((item) => item.slug === slug);
        if (method) return renderTechnologyMethodPage(method);
      }
      return renderProbingArticleLoadingPage(slug, header, false);
    }
    // index 已加载但无此 slug → 回退到旧占位方法页（保留 legacy 方法目录）
    const method = technologyMethods.find((item) => item.slug === slug);
    if (method) return renderTechnologyMethodPage(method);
    return renderProbingArticleIndex(probingArticleIndexState, header);
  }

  // 无 slug：总览页。优先真实文章索引；未加载则后台拉取并显示原 technology 总览作为占位。
  if (hasIndex) {
    return renderProbingArticleIndex(probingArticleIndexState, header);
  }
  if (probingArticleIndexState !== 'loading' && probingArticleIndexState !== 'error') {
    loadProbingArticleIndex();
  }
  return renderTechnologyOverviewPage();
}

function renderProbingArticleLoadingPage(slug, headerHtml, isError) {
  const method = technologyMethods.find((item) => item.slug === slug);
  const title = method ? method.title : slug;
  return `<main class="page-detail page-probing-article">
    ${headerHtml}
    <section class="card bundle-wide-card technology-detail-hero">
      <a class="technology-back-link" href="#detail">← 返回探针技术总览</a>
      <div class="technology-detail-header">
        <div>
          <p class="technology-kicker">probing article</p>
          <h1>${title}</h1>
          <p class="technology-intro">${isError ? '文章资产加载失败，请稍后重试。' : '正在加载文章…'}</p>
        </div>
      </div>
    </section>
  </main>`;
}

function browsePage() {
  const rows = browseEntryRows.length
    ? browseEntryRows
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
          </tr>`
        )
        .join('')
    : `<tr><td colspan="7" class="entry-table-empty">No entries yet.</td></tr>`;

  return `<main class="page-download-sequences page-browse">
    ${renderBundleHeader()}
    <section class="card download-card entry-table-card">
      <div class="download-toolbar browse-toolbar">
        <span
          id="select-all-rdat"
          class="browse-action-btn ${browseEntryRows.length ? '' : 'is-disabled'}"
          role="button"
          tabindex="${browseEntryRows.length ? '0' : '-1'}"
          aria-disabled="${browseEntryRows.length ? 'false' : 'true'}"
        >
          Select All
        </span>
        <span
          id="download-selected-rdat"
          class="browse-action-btn ${selectedBrowseIds.size ? '' : 'is-disabled'}"
          role="button"
          tabindex="${selectedBrowseIds.size ? '0' : '-1'}"
          aria-disabled="${selectedBrowseIds.size ? 'false' : 'true'}"
        >
          Download Selected RDAT (${selectedBrowseIds.size})
        </span>
        <span
          id="clear-selected-rdat"
          class="browse-action-btn ${selectedBrowseIds.size ? '' : 'is-disabled'}"
          role="button"
          tabindex="${selectedBrowseIds.size ? '0' : '-1'}"
          aria-disabled="${selectedBrowseIds.size ? 'false' : 'true'}"
        >
          Clear Selection
        </span>
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
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </section>
  </main>`;
}

function structurePage() {
  return downloadStructuresPage();
}

function renderPdbCaseLoadingPage(message) {
  return `<main class="page-pdb-case">
    <section class="card bundle-wide-card pdb-case-hero">
      <a class="technology-back-link" href="#pdb-case">Back to PDB case index</a>
      <p class="technology-kicker">PDB case</p>
      <h1>${message}</h1>
      <div class="pdb-case-track-empty">Loading…</div>
    </section>
  </main>`;
}

async function loadPdbCaseIndex() {
  if (pdbCaseIndexState === 'loading') return;
  pdbCaseIndexState = 'loading';
  try {
    const index = await pdbCaseStore.loadCaseIndex();
    pdbCaseIndexState = { cases: index.cases || [] };
  } catch (err) {
    console.error('[main] 加载 PDB case 索引失败', err);
    pdbCaseIndexState = 'error';
  }
  if (route === 'pdb-case') render({ preserveScroll: true });
}

async function loadPdbCaseDetail(pdbId) {
  if (pdbCaseDetailState.get(pdbId) === 'loading') return;
  pdbCaseDetailState.set(pdbId, 'loading');
  try {
    const detail = await pdbCaseStore.loadCase(pdbId);
    const profilesDoc = await pdbCaseStore.loadProfiles(pdbId).catch(() => null);
    const profiles = profilesDoc?.profiles || [];
    const page = pdbCaseAlignmentPageByPdb.get(pdbId) || 1;
    let alignmentPage = null;
    if ((detail.alignmentPageCount || 0) > 0) {
      alignmentPage = await pdbCaseStore.loadAlignmentPage(pdbId, page).catch(() => null);
    }
    let reactivitySummary = null;
    const firstReac = (detail.reactivity || [])[0];
    if (firstReac?.profileKey) {
      reactivitySummary = await pdbCaseStore
        .loadReactivitySummary(pdbId, firstReac.profileKey)
        .catch(() => null);
    }
    pdbCaseDetailState.set(pdbId, { detail, profiles, alignmentPage, reactivitySummary });
  } catch (err) {
    console.error('[main] 加载 PDB case 详情失败', pdbId, err);
    pdbCaseDetailState.set(pdbId, 'error');
  }
  if (route === 'pdb-case') render({ preserveScroll: true });
}

async function loadProbingArticleIndex() {
  if (probingArticleIndexState === 'loading') return;
  probingArticleIndexState = 'loading';
  try {
    probingArticleIndexState = await probingArticleStore.loadIndex();
  } catch (err) {
    console.error('[main] 加载探针文章索引失败', err);
    probingArticleIndexState = 'error';
  }
  if (route === 'detail') render({ preserveScroll: true });
}

async function loadProbingArticleDetail(slug) {
  if (!slug || probingArticleDetailState.get(slug) === 'loading') return;
  probingArticleDetailState.set(slug, 'loading');
  try {
    const detail = await probingArticleStore.loadArticle(slug);
    probingArticleDetailState.set(slug, detail);
  } catch (err) {
    console.error('[main] 加载探针文章详情失败', slug, err);
    probingArticleDetailState.set(slug, 'error');
  }
  if (route === 'detail') render({ preserveScroll: true });
}

async function loadAnnojointAtlasIndex() {
  if (annojoinAtlasIndexState === 'loading') return;
  annojoinAtlasIndexState = 'loading';
  try {
    annojoinAtlasIndexState = await annojoinAtlasStore.loadIndex();
  } catch (err) {
    console.error('[main] 加载 ANNOJOIN Atlas 索引失败', err);
    annojoinAtlasIndexState = 'error';
  }
  if (route === 'sequence' || route === 'annojoin-atlas' || route === 'annojoin-case') render({ preserveScroll: true });
}

async function loadAnnojointDetailRouteIndex() {
  if (annojoinDetailRouteIndexState === 'loading') return;
  annojoinDetailRouteIndexState = 'loading';
  try {
    annojoinDetailRouteIndexState = await annojoinAtlasStore.loadDetailRouteIndex();
  } catch (err) {
    console.error('[main] 加载 ANNOJOIN Atlas detail route index 失败', err);
    annojoinDetailRouteIndexState = 'error';
  }
  if (route === 'annojoin-case') render({ preserveScroll: true });
}

function resolveAnnojointDetailRouteEntry(caseKey, caseId = '') {
  if (!annojoinDetailRouteIndexState || typeof annojoinDetailRouteIndexState !== 'object') return null;
  const lookup = annojoinDetailRouteIndexState.lookup || {};
  return lookup[caseKey] || lookup[String(caseKey || '').toUpperCase()] || lookup[caseId] || lookup[String(caseId || '').toUpperCase()] || null;
}

function annojoinConfidenceAssetPaths(caseKey = '') {
  const normalizedKey = String(caseKey || '').trim();
  const segment = encodeURIComponent(normalizedKey);
  return {
    summaryPath: `cases/${segment}/confidence-summary.json`,
    evidencePath: `cases/${segment}/confidence-evidence.json`,
    provenancePath: `cases/${segment}/confidence-provenance.json`,
  };
}

async function loadAnnojointAtlasDetail(caseKey, caseAssetPath = '') {
  if (!caseKey || annojoinAtlasDetailState.get(caseKey) === 'loading') return;
  annojoinAtlasDetailState.set(caseKey, 'loading');
  try {
    const asset = caseAssetPath
      ? await annojoinAtlasStore.loadCaseAssetPath(caseAssetPath, { compressed: true })
      : await annojoinAtlasStore.loadCase(caseKey, { compressed: true });
    annojoinAtlasDetailState.set(caseKey, asset);
  } catch (err) {
    console.error('[main] 加载 ANNOJOIN Atlas case 失败', caseKey, err);
    annojoinAtlasDetailState.set(caseKey, 'error');
  }
  if (route === 'annojoin-case') render({ preserveScroll: true });
}

async function loadAnnojointCaseConfidence(caseKey, caseAsset) {
  if (!caseKey || annojoinCaseConfidenceState.get(caseKey) === 'loading') return;
  if (String(caseAsset?.case?.assetFamily || '').trim() !== 'RMDB2PDB') return;
  annojoinCaseConfidenceState.set(caseKey, 'loading');
  try {
    const assetPaths = caseAsset?.supplementalAssets || annojoinConfidenceAssetPaths(caseKey);
    const [summary, evidence, provenance] = await Promise.all([
      annojoinAtlasStore.loadAssetPath(assetPaths.confidenceSummaryPath || assetPaths.summaryPath, { compressed: true }),
      annojoinAtlasStore.loadAssetPath(assetPaths.confidenceEvidencePath || assetPaths.evidencePath, { compressed: true }),
      annojoinAtlasStore.loadAssetPath(assetPaths.confidenceProvenancePath || assetPaths.provenancePath, { compressed: true }),
    ]);
    annojoinCaseConfidenceState.set(caseKey, { summary, evidence, provenance });
  } catch (err) {
    console.error('[main] 加载 ANNOJOIN case confidence sidecars 失败', caseKey, err);
    annojoinCaseConfidenceState.set(caseKey, 'error');
  }
  if (route === 'annojoin-case') render({ preserveScroll: true });
}

// alignment 分页导航：保留已加载的 detail/profiles/reactivity，只换 alignment 页，避免整页 loading 闪烁。
async function loadAlignmentForCase(pdbId, page) {
  pdbCaseAlignmentPageByPdb.set(pdbId, page);
  const state = pdbCaseDetailState.get(pdbId);
  if (!state || typeof state === 'string') {
    loadPdbCaseDetail(pdbId);
    return;
  }
  try {
    const alignmentPage = await pdbCaseStore.loadAlignmentPage(pdbId, page);
    pdbCaseDetailState.set(pdbId, { ...state, alignmentPage });
  } catch (err) {
    console.error('[main] 加载 alignment 页失败', pdbId, page, err);
  }
  if (route === 'pdb-case') render({ preserveScroll: true });
}

function pdbCasePage() {
  const params = getPdbCaseParamsFromHash();
  if (!params.pdbId) {
    if (pdbCaseIndexState && typeof pdbCaseIndexState === 'object') {
      return renderPdbCaseIndexPage(pdbCaseIndexState.cases);
    }
    if (pdbCaseIndexState !== 'loading') loadPdbCaseIndex();
    return renderPdbCaseLoadingPage(
      pdbCaseIndexState === 'error' ? 'PDB case index unavailable' : 'Loading PDB case index…'
    );
  }
  const state = pdbCaseDetailState.get(params.pdbId);
  if (state && typeof state === 'object') {
    return renderPdbCasePage(state.detail, params, {
      profiles: state.profiles,
      alignmentPage: state.alignmentPage,
      reactivitySummary: state.reactivitySummary
    });
  }
  if (state === 'error') return renderPdbCasePage(null, params);
  if (state !== 'loading') loadPdbCaseDetail(params.pdbId);
  return renderPdbCaseLoadingPage(`Loading case assets for ${params.pdbId}…`);
}

function annojoinAtlasPage() {
  const parsed = parseHashRoute(window.location.hash);
  const params = parsed.params;
  const routeName = parsed.route === 'sequence' ? 'sequence' : 'annojoin-atlas';
  const filters = getAnnojointAtlasFilters(params);
  const page = Number(params.get('page')) || 1;
  const pageSize = Number(params.get('pageSize')) || annojoinPageSize;
  const selectedCaseId = params.get('caseId') || '';
  const selectedCaseKey = params.get('caseKey') || '';
  const selectedField = params.get('field') || '';
  if (!annojoinAtlasIndexState || annojoinAtlasIndexState === 'loading') {
    if (annojoinAtlasIndexState !== 'loading') loadAnnojointAtlasIndex();
    const state = buildAtlasSearchState(SAMPLE_ANNOJOIN_ATLAS_TABLES, filters);
    return renderAnnojointAtlasPage({
      state,
      routeName,
      selectedCaseIds: selectedAnnojointCaseIds,
      expandedGroupIds: expandedAnnojointGroupIds,
      uncappedGroupIds: uncappedAnnojointGroupIds,
      visibleColumnIds: visibleAnnojointColumnIds,
      page,
      pageSize,
      selectedCaseId,
      selectedCaseKey,
      selectedField
    });
  }
  if (annojoinAtlasIndexState === 'error') {
    const state = buildAtlasSearchState(SAMPLE_ANNOJOIN_ATLAS_TABLES, filters);
    return renderAnnojointAtlasPage({
      state,
      routeName,
      selectedCaseIds: selectedAnnojointCaseIds,
      expandedGroupIds: expandedAnnojointGroupIds,
      uncappedGroupIds: uncappedAnnojointGroupIds,
      visibleColumnIds: visibleAnnojointColumnIds,
      page,
      pageSize,
      selectedCaseId,
      selectedCaseKey,
      selectedField
    });
  }

  const state = buildAtlasSearchState(annojoinAtlasIndexState, filters);
  return renderAnnojointAtlasPage({
    state,
    routeName,
    selectedCaseIds: selectedAnnojointCaseIds,
    expandedGroupIds: expandedAnnojointGroupIds,
    uncappedGroupIds: uncappedAnnojointGroupIds,
    visibleColumnIds: visibleAnnojointColumnIds,
    page,
    pageSize,
    selectedCaseId,
    selectedCaseKey,
    selectedField
  });
}

function getAnnojointAtlasFilters(params) {
  return {
    query: params.get('q') || '',
    rnaFamily: params.get('rnaFamily') || '',
    probeType: params.get('probeType') || '',
    pdbId: params.get('pdbId') || '',
    motif: params.get('motif') || '',
    structureClass: params.get('structureClass') || ''
  };
}

function currentAnnojointAtlasTables() {
  return annojoinAtlasIndexState && typeof annojoinAtlasIndexState === 'object'
    ? annojoinAtlasIndexState
    : SAMPLE_ANNOJOIN_ATLAS_TABLES;
}

function currentAnnojointAtlasState() {
  const parsed = parseHashRoute(window.location.hash);
  const params = parsed.params;
  const filters = getAnnojointAtlasFilters(params);
  const pageSize = Number(params.get('pageSize')) || annojoinPageSize;
  const page = Number(params.get('page')) || 1;
  const sortedRows = sortAnnojointCases(buildAtlasSearchState(currentAnnojointAtlasTables(), filters).cases);
  const rows = isAnnojointSearchActive(filters.query)
    ? searchAnnojointRows(sortedRows, filters.query)
    : sortedRows;
  const pagination = paginateAnnojointRows(rows, { page, pageSize });
  return { rows, pageRows: pagination.rows, pagination };
}

function getAnnojointCaseIdFromHash() {
  const parsed = parseHashRoute(window.location.hash);
  return String(parsed.params.get('caseId') || '10ZT').trim().toUpperCase();
}

function getAnnojointCaseKeyFromHash() {
  const parsed = parseHashRoute(window.location.hash);
  return String(parsed.params.get('caseKey') || getAnnojointCaseIdFromHash()).trim();
}

function findAnnojointIndexRowByKey(caseKey) {
  const normalizedKey = String(caseKey || '').trim().toUpperCase();
  if (!normalizedKey) return null;
  const state = buildAtlasSearchState(currentAnnojointAtlasTables(), {}).cases;
  return state.find((row) => rowCaseKey(row).toUpperCase() === normalizedKey || rowCaseId(row).toUpperCase() === normalizedKey) || null;
}

function annojoinCasePage() {
  const caseId = getAnnojointCaseIdFromHash();
  const caseKey = getAnnojointCaseKeyFromHash();
  const detailState = annojoinAtlasDetailState.get(caseKey);
  const confidenceState = annojoinCaseConfidenceState.get(caseKey);
  if (!annojoinDetailRouteIndexState) loadAnnojointDetailRouteIndex();
  const detailRouteEntry = resolveAnnojointDetailRouteEntry(caseKey, caseId);
  const caseAssetPath = detailRouteEntry?.asset?.caseAssetPath || findAnnojointIndexRowByKey(caseKey)?.caseAssetPath;
  if (!detailState && (annojoinDetailRouteIndexState === 'error' || detailRouteEntry || caseAssetPath)) {
    loadAnnojointAtlasDetail(caseKey, caseAssetPath);
  }
  if (detailState && typeof detailState === 'object' && !confidenceState) {
    loadAnnojointCaseConfidence(caseKey, detailState);
  }
  return renderAnnojointCasePage({
    caseAsset: detailState && typeof detailState === 'object' ? detailState : null,
    confidenceBundle: confidenceState && typeof confidenceState === 'object' ? confidenceState : null,
    confidenceStatus: confidenceState || 'idle',
    caseId,
    caseKey
  });
}

function setAnnojointAtlasFilter(key, value, { replace = false } = {}) {
  const parsed = parseHashRoute(window.location.hash);
  const params = parsed.params;
  const routeName = parsed.route === 'sequence' ? 'sequence' : 'annojoin-atlas';
  if (value) params.set(key, value);
  else params.delete(key);
  params.set('page', '1');
  params.delete('caseId');
  params.delete('caseKey');
  params.delete('field');
  const next = params.toString();
  const composedHash = next ? `${routeName}?${next}` : routeName;
  if (replace) {
    // replaceState 不触发 hashchange，需手动同步 route 并重渲染（保留滚动与焦点）。
    history.replaceState(null, '', '#' + composedHash);
    route = routeFromHash(window.location.hash);
    render({ preserveScroll: true });
  } else {
    window.location.hash = composedHash;
  }
}

function clearAnnojointAtlasFilters() {
  const parsed = parseHashRoute(window.location.hash);
  const params = parsed.params;
  const routeName = parsed.route === 'sequence' ? 'sequence' : 'annojoin-atlas';
  ['q', 'rnaFamily', 'probeType', 'pdbId', 'motif', 'structureClass'].forEach((key) => params.delete(key));
  params.set('page', '1');
  params.delete('caseId');
  params.delete('caseKey');
  params.delete('field');
  const next = params.toString();
  window.location.hash = next ? `${routeName}?${next}` : routeName;
}

function setAnnojointAtlasQuery(query) {
  setAnnojointAtlasFilter('q', query, { replace: true });
}

function setAnnojointAtlasPage(value) {
  const parsed = parseHashRoute(window.location.hash);
  const params = parsed.params;
  const routeName = parsed.route === 'sequence' ? 'sequence' : 'annojoin-atlas';
  const current = currentAnnojointAtlasState().pagination;
  let nextPage = Number(value) || current.page;
  if (value === 'prev') nextPage = current.page - 1;
  if (value === 'next') nextPage = current.page + 1;
  nextPage = Math.min(Math.max(1, nextPage), current.pageCount);
  if (nextPage > 1) params.set('page', String(nextPage));
  else params.delete('page');
  const next = params.toString();
  window.location.hash = next ? `${routeName}?${next}` : routeName;
}

function setAnnojointAtlasPageSize(value) {
  annojoinPageSize = Number(value) || 50;
  const parsed = parseHashRoute(window.location.hash);
  const params = parsed.params;
  const routeName = parsed.route === 'sequence' ? 'sequence' : 'annojoin-atlas';
  params.set('pageSize', String(annojoinPageSize));
  params.delete('page');
  const next = params.toString();
  window.location.hash = next ? `${routeName}?${next}` : routeName;
}

function setAnnojointAtlasVisibleColumns(columnIds) {
  visibleAnnojointColumnIds = normalizeVisibleAnnojointColumnIds(columnIds);
  render({ preserveScroll: true });
}

function toggleAnnojointAtlasGroup(groupId) {
  if (expandedAnnojointGroupIds.has(groupId)) expandedAnnojointGroupIds.delete(groupId);
  else expandedAnnojointGroupIds.add(groupId);
  render({ preserveScroll: true });
}

function allAnnojointAtlasGroupIds() {
  const groups = buildAnnojointTableGroups(currentAnnojointAtlasState().rows);
  return groups.flatMap((parent) => [
    `parent:${parent.id}`,
    ...parent.children.map((child) => `child:${child.id}`)
  ]);
}

function toggleAnnojointAtlasGroupLimit(groupId) {
  if (uncappedAnnojointGroupIds.has(groupId)) uncappedAnnojointGroupIds.delete(groupId);
  else uncappedAnnojointGroupIds.add(groupId);
  render({ preserveScroll: true });
}

function downloadPage() {
  return `<main class="page-download">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card">
      <h1>Download</h1>
      <p>Use this page as the download entry for FoldBridge sequence and structure assets.</p>
      <div class="actions">
        <button type="button" data-route="sequence">Sequence downloads</button>
        <button type="button" data-route="structure">Structure downloads</button>
        <button type="button" data-route="annojoin-atlas">ANNOJOIN Atlas</button>
      </div>
    </section>
  </main>`;
}

function searchPage() {
  const params = searchParamsFromHash(window.location.hash);
  const query = params.get('q') ?? '';
  const filters = filtersFromSearchParams(params);
  const activeTags = Array.isArray(filters.tag) ? filters.tag : filters.tag ? [filters.tag] : [];
  const activeType = filters.type ?? '';

  return `<main class="page-detail page-browse page-search">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card site-search-card">
      <div class="site-search-header">
        <div>
          <p class="technology-kicker">central search</p>
          <h1>Search</h1>
        </div>
        <button id="save-search-query" type="button" class="download-outline-btn">Save Search</button>
      </div>
      <form class="site-search-form" id="site-search-form">
        <input
          id="site-search-input"
          class="site-search-input"
          type="search"
          placeholder="Search sequence, PDB ID, method, profile, DOI..."
          value="${escapeHtml(query)}"
          aria-label="Search query"
        />
        <button type="submit">Search</button>
      </form>
      <div class="site-search-active">
        ${activeType ? `<span class="chip">type: ${escapeHtml(activeType)}</span>` : ''}
        ${activeTags.map((tag) => `<span class="chip">tag: ${escapeHtml(tag)}</span>`).join('')}
      </div>
    </section>

    <section class="site-search-layout bundle-wide-card">
      <aside class="card site-search-filter-card">
        <h2>Filters</h2>
        <div id="site-search-filters" class="site-search-filters">
          <span class="mini-note">Loading filters...</span>
        </div>
        <h2>Saved</h2>
        <div id="site-search-saved" class="site-search-saved"></div>
      </aside>
      <section class="card site-search-results-card">
        <div id="site-search-summary" class="mini-note">Loading search index...</div>
        <div id="site-search-results" class="site-search-results"></div>
      </section>
    </section>
  </main>`;
}


function downloadStructuresPage() {
  return `<main class="page-download">
    ${renderBundleHeader()}
    <section class="card bundle-wide-card">
      <h1>Structure</h1>
      <p>Structure-linked downloads and related assets are collected here.</p>
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
    <section class="card bundle-wide-card">
      <h1>Help</h1>
      <p>Use the navigation above to move across Home, Browse, Sequence, Structure, Probing, Download, Search, and Help.</p>
      <p>If you cannot find a record, start from Browse or Search and then open the related sequence or probing page.</p>
    </section>
  </main>`;
}


function pageFor(name) {
  const safeRoute = normalizeRoute(name);
  if (safeRoute === 'browse') return browsePage();
  if (safeRoute === 'sequence') return annojoinAtlasPage();
  if (safeRoute === 'structure') return structurePage();
  if (safeRoute === 'pdb-case') return pdbCasePage();
  if (safeRoute === 'annojoin-atlas') return annojoinAtlasPage();
  if (safeRoute === 'annojoin-case') return annojoinCasePage();
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

function readSavedSearches() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function writeSavedSearches(items) {
  localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(items.slice(0, 8)));
}

function currentSearchState() {
  const params = searchParamsFromHash(window.location.hash);
  return {
    q: params.get('q') ?? '',
    filters: filtersFromSearchParams(params)
  };
}

function setSearchState(nextState) {
  const nextHash = buildSearchHash(nextState);
  if (window.location.hash === nextHash) {
    render({ preserveScroll: true });
    return;
  }
  window.location.hash = nextHash;
}

function isFilterActive(filters, key, value) {
  const active = filters[key];
  return Array.isArray(active) ? active.includes(value) : active === value;
}

function toggleSearchFilter(key, value) {
  const state = currentSearchState();
  const filters = { ...state.filters };

  if (key === 'type') {
    filters.type = filters.type === value ? '' : value;
  } else {
    const values = new Set(Array.isArray(filters[key]) ? filters[key] : filters[key] ? [filters[key]] : []);
    if (values.has(value)) values.delete(value);
    else values.add(value);
    filters[key] = [...values];
  }

  setSearchState({ q: state.q, filters });
}

function renderSearchFilters(filters, activeFilters) {
  const allowedKeys = ['type', 'tag'];
  return allowedKeys
    .map((key) => {
      const values = filters?.[key] ?? {};
      const buttons = Object.entries(values)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 12)
        .map(([value, count]) => `<button
          type="button"
          class="site-search-filter ${isFilterActive(activeFilters, key, value) ? 'active' : ''}"
          data-search-filter-key="${escapeHtml(key)}"
          data-search-filter-value="${escapeHtml(value)}"
        >
          <span>${escapeHtml(value)}</span>
          <small>${escapeHtml(count)}</small>
        </button>`)
        .join('');

      return `<div class="site-search-filter-group">
        <h3>${escapeHtml(key)}</h3>
        <div>${buttons || '<span class="mini-note">No filters yet.</span>'}</div>
      </div>`;
    })
    .join('');
}

function renderSavedSearches() {
  const saved = readSavedSearches();
  if (!saved.length) return '<span class="mini-note">No saved searches.</span>';

  return saved
    .map((item, index) => `<div class="saved-search-item">
      <a href="${escapeHtml(item.hash)}">${escapeHtml(item.label)}</a>
      <button type="button" data-remove-saved-search="${index}" aria-label="Remove saved search">×</button>
    </div>`)
    .join('');
}

function renderSearchResults(result) {
  if (!result.items.length) {
    return '<div class="entry-table-empty">No results.</div>';
  }

  return result.items
    .map((item) => `<article class="site-search-result">
      <div>
        <a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a>
        <p>${item.excerpt}</p>
      </div>
      <div class="site-search-result-tags">
        ${item.type ? `<span>${escapeHtml(item.type)}</span>` : ''}
        ${item.tags.slice(0, 4).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
      </div>
    </article>`)
    .join('');
}

function bindSearchPageControls() {
  const form = document.getElementById('site-search-form');
  const input = document.getElementById('site-search-input');
  const saveButton = document.getElementById('save-search-query');
  const savedHost = document.getElementById('site-search-saved');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const state = currentSearchState();
    setSearchState({ q: input?.value ?? '', filters: state.filters });
  });

  saveButton?.addEventListener('click', () => {
    const state = currentSearchState();
    const hash = buildSearchHash(state);
    if (hash === '#search') return;
    const labelParts = [state.q || 'Filtered search'];
    if (state.filters.type) labelParts.push(`type:${state.filters.type}`);
    const tags = Array.isArray(state.filters.tag) ? state.filters.tag : state.filters.tag ? [state.filters.tag] : [];
    if (tags.length) labelParts.push(`tag:${tags.join(',')}`);
    const item = { hash, label: labelParts.join(' · ') };
    const next = [item, ...readSavedSearches().filter((saved) => saved.hash !== hash)];
    writeSavedSearches(next);
    if (savedHost) savedHost.innerHTML = renderSavedSearches();
  });

  savedHost?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-saved-search]');
    if (!button) return;
    const index = Number(button.getAttribute('data-remove-saved-search'));
    const next = readSavedSearches().filter((_, itemIndex) => itemIndex !== index);
    writeSavedSearches(next);
    savedHost.innerHTML = renderSavedSearches();
  });
}

async function initSearchPage() {
  if (route !== 'search') return;

  const filterHost = document.getElementById('site-search-filters');
  const resultHost = document.getElementById('site-search-results');
  const summaryHost = document.getElementById('site-search-summary');
  const savedHost = document.getElementById('site-search-saved');
  if (!filterHost || !resultHost || !summaryHost || !savedHost) return;

  bindSearchPageControls();
  savedHost.innerHTML = renderSavedSearches();

  const state = currentSearchState();

  try {
    const result = await siteSearchService.search({ q: state.q, filters: state.filters, pageSize: 20 });
    filterHost.innerHTML = renderSearchFilters(result.availableFilters, state.filters);
    resultHost.innerHTML = renderSearchResults(result);
    summaryHost.textContent = state.q || Object.keys(state.filters).length
      ? `${result.total} results`
      : 'Enter a query or choose a filter.';

    filterHost.querySelectorAll('[data-search-filter-key]').forEach((button) => {
      button.addEventListener('click', () => {
        toggleSearchFilter(button.getAttribute('data-search-filter-key'), button.getAttribute('data-search-filter-value'));
      });
    });
  } catch (_error) {
    summaryHost.textContent = 'Search index unavailable. Run npm run build:pages.';
    resultHost.innerHTML = '';
    filterHost.innerHTML = '<span class="mini-note">No index loaded.</span>';
  }
}

function initGlobalSearch() {
  const form = document.getElementById('global-search-form');
  const input = document.getElementById('global-search-input');
  if (!form || !input) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    setSearchState({ q: input.value, filters: {} });
  });

  input.addEventListener('focus', () => {
    siteSearchService.warm().catch(() => {});
  });
}

function render(options = {}) {
  const { preserveScroll = false } = options;
  const previousScrollX = window.scrollX;
  const previousScrollY = window.scrollY;
  let activeSearch = null;
  if (document.activeElement?.id === 'annojoin-search-input') {
    const el = document.activeElement;
    activeSearch = {
      selectionStart: el.selectionStart ?? null,
      selectionEnd: el.selectionEnd ?? null
    };
  }

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
  const annojoinState = document.getElementById('annojoin-search-input') ? currentAnnojointAtlasState() : null;
  if (annojoinState) {
    bindAnnojointAtlasTable({
      root: document,
      selectedCaseIds: selectedAnnojointCaseIds,
      visibleColumnIds: visibleAnnojointColumnIds,
      pageRows: annojoinState.pageRows,
      rows: annojoinState.rows,
      setQuery: setAnnojointAtlasQuery,
      setPage: setAnnojointAtlasPage,
      setPageSize: setAnnojointAtlasPageSize,
      setVisibleColumns: setAnnojointAtlasVisibleColumns,
      exportSelectedRows: (selectedRows) => {
        downloadRowsAsCsv(selectedRows.map(annojoinExportRow), 'annojoin-selected-cases.csv');
      },
      selectRows: (rows) => {
        rows.forEach((row) => {
          const caseKey = rowCaseKey(row);
          if (caseKey) selectedAnnojointCaseIds.add(caseKey);
        });
        render({ preserveScroll: true });
      },
      clearSelection: () => {
        selectedAnnojointCaseIds.clear();
        render({ preserveScroll: true });
      },
      toggleGroup: toggleAnnojointAtlasGroup,
      toggleGroupLimit: toggleAnnojointAtlasGroupLimit,
      expandAllGroups: () => {
        expandedAnnojointGroupIds = new Set(allAnnojointAtlasGroupIds());
        render({ preserveScroll: true });
      },
      collapseAllGroups: () => {
        expandedAnnojointGroupIds.clear();
        uncappedAnnojointGroupIds.clear();
        render({ preserveScroll: true });
      },
      rerender: () => render({ preserveScroll: true }),
      removeFilter: (key) => setAnnojointAtlasFilter(key, ''),
      clearFilters: () => clearAnnojointAtlasFilters()
    });
  }
  initAnnojointStructureViewers().catch((error) => {
    console.error('[main] 初始化 ANNOJOIN 3D viewer 失败', error);
  });
  initAnnojointCasePage().catch((error) => {
    console.error('[main] 初始化 ANNOJOIN case page 失败', error);
  });
  const downloadSelectedRdatBtn = document.getElementById('download-selected-rdat');
  bindPseudoButton(downloadSelectedRdatBtn, () => {
    downloadSelectedRdatFiles();
  });
  const clearSelectedRdatBtn = document.getElementById('clear-selected-rdat');
  bindPseudoButton(clearSelectedRdatBtn, () => {
    selectedBrowseIds.clear();
    render({ preserveScroll: true });
  });
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
  initGlobalSearch();
  initAptamerMultiSelect();
  initSecondaryStructureModule();
  initMolstarModule();
  initHomeStructureShowcase();
  initSequenceDetailMolstar();
  initSequenceDetailSecondaryHeatmap();
  initAnimatedStats();
  initHomeDashboardFilters();
  initPdbCasePage();
  initSearchPage();

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

  if (activeSearch) {
    const el = document.getElementById('annojoin-search-input');
    if (el) {
      el.focus();
      if (typeof activeSearch.selectionStart === 'number' && typeof activeSearch.selectionEnd === 'number') {
        try {
          el.setSelectionRange(activeSearch.selectionStart, activeSearch.selectionEnd);
        } catch (error) {
          // type="search" 可能不支持 setSelectionRange，忽略。
        }
      }
    }
  }

  if (preserveScroll) {
    requestAnimationFrame(() => window.scrollTo(previousScrollX, previousScrollY));
  }
}

function initPdbCasePage() {
  // 索引页 confidence 过滤：纯前端切换行可见性，不触发整页重渲染。
  const filterButtons = document.querySelectorAll('[data-confidence-filter]');
  if (filterButtons.length) {
    const applyFilter = () => {
      document.querySelectorAll('[data-confidence-class]').forEach((row) => {
        const cls = row.getAttribute('data-confidence-class');
        const isParentRow = row.classList.contains('pdb-case-parent-row');
        if (pdbCaseConfidenceFilter === 'all') {
          // parent 行始终可见；child 行取决于其 parent 是否展开
          if (isParentRow) { row.hidden = false; }
          else if (row.classList.contains('pdb-case-child-row')) {
            // 由 parent toggle 控制
          } else { row.hidden = false; }
        } else {
          row.hidden = cls !== pdbCaseConfidenceFilter;
          // 过滤时强制折叠 child 行
          if (row.classList.contains('pdb-case-child-row')) row.hidden = true;
        }
      });
      // parent 行特殊逻辑：如果过滤后没有子行匹配，隐藏 parent
      document.querySelectorAll('[data-parent-toggle]').forEach((parentRow) => {
        const parentName = parentRow.getAttribute('data-parent-toggle');
        if (pdbCaseConfidenceFilter === 'all') {
          parentRow.hidden = false;
        } else {
          const hasVisible = !!document.querySelector(
            `[data-parent-name="${CSS.escape(parentName)}"][data-confidence-class="${pdbCaseConfidenceFilter}"]`
          );
          parentRow.hidden = !hasVisible;
        }
      });
      filterButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-confidence-filter') === pdbCaseConfidenceFilter);
      });
    };
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        pdbCaseConfidenceFilter = btn.getAttribute('data-confidence-filter') || 'all';
        applyFilter();
      });
    });
    applyFilter();
  }

  // Parent group 折叠/展开切换
  document.querySelectorAll('[data-parent-toggle]').forEach((parentRow) => {
    const toggleBtn = parentRow.querySelector('.pdb-case-parent-toggle');
    if (!toggleBtn) return;
    toggleBtn.addEventListener('click', () => {
      const parentName = parentRow.getAttribute('data-parent-toggle');
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', String(!expanded));
      const arrow = toggleBtn.querySelector('.pdb-case-parent-arrow');
      if (arrow) arrow.textContent = expanded ? '\u25B6' : '\u25BC';
      document.querySelectorAll(`.pdb-case-child-row[data-parent-name="${CSS.escape(parentName)}"]`).forEach((child) => {
        child.hidden = expanded; // toggle: was expanded → collapse, was collapsed → expand
      });
    });
  });

  // Detail 按钮：导航到本站详情页
  document.querySelectorAll('.pdb-case-detail-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const href = btn.getAttribute('data-detail-href');
      if (href) window.location.hash = href.replace(/^#/, '');
    });
  });

  // 详情页 alignment 分页导航。
  const params = getPdbCaseParamsFromHash();
  if (params.pdbId) {
    const section = document.querySelector('[data-alignment-page]');
    const current = section ? Number(section.getAttribute('data-alignment-page')) || 1 : 1;
    document.querySelectorAll('[data-alignment-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const dir = btn.getAttribute('data-alignment-nav');
        const next = dir === 'prev' ? current - 1 : current + 1;
        if (next < 1) return;
        loadAlignmentForCase(params.pdbId, next);
      });
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

window.addEventListener('hashchange', () => {
  route = routeFromHash(window.location.hash);
  render();
});


async function initApp() {
  await loadSequenceRows();
  await loadBrowseEntryRows();
  render();
}

initApp();
