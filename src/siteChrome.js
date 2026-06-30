// 站点骨架纯渲染片段。从 main.js 抽出以便 node --test 可 import 测试。
// 所有函数必须是纯函数：入参 → 返回 HTML 字符串，禁止访问模块级 window/route/mode。
// main.js 负责把这些片段接回并绑定 DOM 事件。

const PRIMARY_NAV_ITEMS = [
  { route: 'home', label: 'Home', activeRoutes: ['home'] },
  { route: 'entry', label: 'Entry', activeRoutes: ['entry', 'sequence', 'download-sequences'] },
  { route: 'probing', label: 'Probing', activeRoutes: ['probing', 'detail'] },
  { route: 'search', label: 'Search', activeRoutes: ['search'] },
  { route: 'help', label: 'Help', activeRoutes: ['help'] }
];

export function renderPrimaryNav(activeRoute = 'home') {
  const buttons = PRIMARY_NAV_ITEMS.map((item) => {
    const isActive = item.activeRoutes.includes(activeRoute);
    return `<button type="button" class="nav-btn${isActive ? ' active' : ''}" data-route="${item.route}">${item.label}</button>`;
  }).join('\n          ');
  return `<nav class="bundle-home-route-nav" aria-label="Primary navigation">
          ${buttons}
        </nav>`;
}

// 首页指标（写死，集中一处便于一处更新）。来源（磁盘核对 2026-06-27）：
//   structureLinkedRecords = annojoin-atlas/index.json totalCaseCount(3610, = displayCases 行数)
//   sourceCases            = annojoin-atlas/index.json totalSourceCaseCount(4070, = cases 行数)
//   probingArticles/mechanismFamilies = probing-articles/index.json article_count(27)/family_count(6)
// Atlas 资产再变化时，只改这里的数字（与 Atlas index 顶层字段对齐）。
export const HOME_METRICS = {
  structureLinkedRecords: 3610,
  sourceCases: 4070,
  probingArticles: 27,
  mechanismFamilies: 6
};

export function renderHomeHero(metrics = HOME_METRICS) {
  const records = metrics.structureLinkedRecords.toLocaleString('en-US');
  const sources = metrics.sourceCases.toLocaleString('en-US');
  return `<section class="bundle-hero-card bundle-wide-card">
        <div class="bundle-hero-copy">
          <p class="bundle-kicker">RNA structure-linked database</p>
          <h2>FoldBridge Database Portal</h2>
          <p class="bundle-hero-summary">
            FoldBridge is a curated database that links RNA chemical probing data with experimentally resolved tertiary structures.
          </p>
          <p class="bundle-hero-detail">
            By matching probing-derived RNA sequences to corresponding sequences in PDB entries, FoldBridge identifies high-confidence structure-linked records and integrates their secondary- and tertiary-structure information.
          </p>
          <div class="bundle-hero-actions">
            <button type="button" class="bundle-hero-primary" data-route="entry">Browse Entry table &rarr;</button>
            <button type="button" class="ghost" data-route="probing">Explore probing methods</button>
          </div>
        </div>

        <aside class="bundle-hero-metrics">
          <article class="bundle-metric-card bundle-metric-large">
            <p>structure-linked records</p>
            <strong>${records}</strong>
            <span>PDB entries in the current build, from ${sources} source cases</span>
          </article>
          <article class="bundle-metric-card">
            <p>probing articles</p>
            <strong>${metrics.probingArticles}</strong>
            <span>across ${metrics.mechanismFamilies} mechanism families</span>
          </article>
          <article class="bundle-metric-card">
            <p>mechanism families</p>
            <strong>${metrics.mechanismFamilies}</strong>
            <span>chemical &amp; enzymatic probing groups</span>
          </article>
        </aside>
      </section>`;
}

const HOME_MODULE_CARDS = [
  {
    route: 'entry',
    kicker: 'master table',
    title: 'Entry table',
    summary: `${HOME_METRICS.structureLinkedRecords.toLocaleString('en-US')} structure-linked PDB entries with search, grouping and export.`,
    action: 'Open Entry table'
  },
  {
    route: 'probing',
    kicker: 'science library',
    title: 'Probing methods',
    summary: `${HOME_METRICS.probingArticles} explainer articles across ${HOME_METRICS.mechanismFamilies} mechanism families.`,
    action: 'Explore probing methods'
  },
  {
    route: 'search',
    kicker: 'site-wide',
    title: 'Search',
    summary: 'Search probing articles and PDB cases across the whole site.',
    action: 'Open search'
  }
];

export function renderHomeModuleCards(cards = HOME_MODULE_CARDS) {
  const items = cards.map((card) => `
    <article class="bundle-site-card">
      <div class="bundle-site-copy">
        <p class="bundle-site-kicker">${card.kicker}</p>
        <h3>${card.title}</h3>
        <p>${card.summary}</p>
      </div>
      <div class="bundle-site-footer">
        <button type="button" class="bundle-site-link" data-route="${card.route}">${card.action}</button>
      </div>
    </article>`).join('');
  return `<section class="bundle-site-grid" aria-label="Core modules">${items}
  </section>`;
}

export function renderHelpBody() {
  return `<section class="card bundle-wide-card">
      <h1>Help &amp; guide</h1>

      <h2>What is FoldBridge</h2>
      <p>FoldBridge links RNA chemical probing data with experimentally resolved tertiary structures. It matches probing-derived RNA sequences to PDB entries, identifies high-confidence structure-linked records, and integrates their secondary- and tertiary-structure information.</p>

      <h2>Modules</h2>
      <ul>
        <li><a href="#entry">Entry table</a> &mdash; the master browser table; search, group and export structure-linked PDB entries. Merged rows keep links back to their source cases.</li>
        <li>PDB case &mdash; a per-PDB detail entry, opened from a case row inside the Entry table.</li>
        <li><a href="#probing">Probing methods</a> &mdash; ${HOME_METRICS.probingArticles} explainer articles across ${HOME_METRICS.mechanismFamilies} mechanism families.</li>
        <li><a href="#search">Search</a> &mdash; site-wide search across probing articles and PDB cases.</li>
      </ul>

      <h2>Key terms</h2>
      <dl>
        <dt>source case vs display row</dt>
        <dd>Source cases are merged into one display row per PDB; RMDB/RASP sources of the same PDB are summarized but keep their source links.</dd>
        <dt>RMDB vs RASP</dt>
        <dd>Two source families. RASP is currently <code>positive_confidence_active_now=false</code> and shown as <strong>not active</strong> &mdash; do not read it as an activated positive confidence.</dd>
        <dt>Confidence (A/B/C)</dt>
        <dd>A case-level distribution summary, not a best-profile score. C is an exploratory hint and should be re-checked against route assets.</dd>
        <dt>Conflicts</dt>
        <dd>Flags annotation/evidence conflict candidates that need review.</dd>
      </dl>

      <h2>Data sources</h2>
      <p>Data come from RMDB / RASP / PDB; structure linkage is materialized through the ANNOJOIN master table. Where citation metadata is not provided in the current asset, fields are left unannotated rather than fabricated.</p>
    </section>`;
}

const PROBING_ASSET_BASE = './src/assets/generated/probing-articles/assets';

// 主页探针文章轮播：纯函数，入参 articles → 静态 HTML。
// 无 DOM、无定时器、无 window；翻页/自动轮换的行为层在 main.js。
// 每张 slide = 代表图 + 家族徽标 + 标题，整张是跳详情页的链接。
export function renderHomeProbingCarousel(articles = []) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return `<section class="home-probing-carousel home-probing-carousel-empty" aria-label="Probing method articles">
      <p class="home-probing-empty-note">Probing articles are loading…</p>
    </section>`;
  }

  const slides = articles.map((a, i) => {
    const activeClass = i === 0 ? ' active' : '';
    const img = a.rep_figure
      ? `<img class="home-probing-slide-img" src="${PROBING_ASSET_BASE}/${a.slug}/${a.rep_figure}" alt="${a.title || ''}" loading="lazy" />`
      : `<div class="home-probing-slide-img home-probing-slide-noimg" aria-hidden="true"></div>`;
    // 注意属性顺序：data-carousel-slide 在 class 之前，以匹配 active-slide 测试正则
    // （/data-carousel-slide="0"[^>]*class="[^"]*active/，[^>]* 不跨越 '>'）。
    return `<a data-carousel-slide="${i}" class="home-probing-slide${activeClass}" href="#detail/${a.slug}">
        ${img}
        <div class="home-probing-slide-copy">
          <span class="home-probing-slide-family">${a.family_title || ''}</span>
          <h3 class="home-probing-slide-title">${a.title || ''}</h3>
        </div>
      </a>`;
  }).join('\n      ');

  const dots = articles.map((_a, i) =>
    // 同上：data-carousel-dot 在 class 之前，匹配 active-dot 测试正则。
    `<button type="button" data-carousel-dot="${i}" class="home-probing-dot${i === 0 ? ' active' : ''}" aria-label="Go to slide ${i + 1}"></button>`
  ).join('\n        ');

  return `<section class="home-probing-carousel" aria-label="Probing method articles" aria-roledescription="carousel">
      <div class="home-probing-track" data-carousel-track>
        ${slides}
      </div>
      <button type="button" class="home-probing-nav home-probing-prev" data-carousel-prev aria-label="Previous article">&larr;</button>
      <button type="button" class="home-probing-nav home-probing-next" data-carousel-next aria-label="Next article">&rarr;</button>
      <div class="home-probing-dots">
        ${dots}
      </div>
    </section>`;
}

// 反应性色标（单一权威）：0 冷绿 #174B3A → .5 金 #E6C260 → 1 暖橙 #E8743E。
// 1D 实时着色与 2D/3D 离线快照共用同一组锚点（见 home-scroll-story/README.md）。
const HSS_COLOR_STOPS = [[23, 75, 58], [230, 194, 96], [232, 116, 62]];
// 无反应性数据的残基中性灰（spec §3：禁色标外推，与 2D/3D 渲染器一致）。
const HSS_NEUTRAL = '#E9EDEA';

export function reactivityColor(norm) {
  const t = Math.max(0, Math.min(1, Number(norm) || 0));
  const [a, b, c] = HSS_COLOR_STOPS;
  let lo, hi, f;
  if (t < 0.5) { lo = a; hi = b; f = t / 0.5; }
  else { lo = b; hi = c; f = (t - 0.5) / 0.5; }
  const mix = lo.map((v, i) => Math.round(v + (hi[i] - v) * f));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

// 单格着色：每残基一个格。无反应性数据 → 中性灰（数据诚实，spec §3）。
// null/undefined/非有限 视为缺失；Number(null)===0 是有限值，须显式判 null。
function alignmentCellHtml(base, datum, ceiling) {
  const raw = Number(datum);
  if (datum == null || !Number.isFinite(raw)) {
    return `<span class="hss-cell hss-cell-nodata" style="background:${HSS_NEUTRAL}">${base}</span>`;
  }
  const norm = Math.min(1, raw / ceiling);
  return `<span class="hss-cell" style="background:${reactivityColor(norm)}">${base}</span>`;
}

// 单根信号柱：柱高 = 归一化反应性，颜色同色标。无数据 → 中性灰矮桩（数据诚实，spec §3）。
const HSS_BAR_TRACK_PX = 40;
function alignmentBarHtml(datum, ceiling) {
  const raw = Number(datum);
  if (datum == null || !Number.isFinite(raw)) {
    return `<div class="hss-bar hss-bar-nodata" style="height:3px;background:${HSS_NEUTRAL}"></div>`;
  }
  const norm = Math.min(1, raw / ceiling);
  const h = Math.max(3, Math.round(norm * HSS_BAR_TRACK_PX));
  return `<div class="hss-bar" style="height:${h}px;background:${reactivityColor(norm)}"></div>`;
}

// 1D alignment 态：每个残基一列（信号柱 / 连接竖线 / PDB 链格 垂直堆叠）。
// 顶行是 per-base 反应性柱状图（量级），底行是结构链着色格；连线锁定在同一残基
// 柱与格之间——换行时整列一起换，对齐永不错位。柱与格共用同一色标。
// 无 DOM / 无 window。色标与缺数据中性灰保持单一权威。
export function renderReactivityAlignment(caseData = {}) {
  const seq = Array.isArray(caseData.sequence) ? caseData.sequence : [];
  const react = Array.isArray(caseData.reactivity) ? caseData.reactivity : [];
  const ceiling = Number(caseData.norm_ceiling) || 1;
  const pdbId = caseData.pdb_id || '';
  const chain = caseData.chain || '';
  const pdbLabel = `PDB ${pdbId} · chain ${chain}`.replace(/\s+$/,'').replace(/·\s*chain\s*$/,'· chain');
  const columns = seq.map((base, i) => {
    const bar = alignmentBarHtml(react[i], ceiling);
    const cell = alignmentCellHtml(base, react[i], ceiling);
    return `<div class="hss-aln-col"><div class="hss-bar-track">${bar}</div><span class="hss-match-tick">|</span>${cell}</div>`;
  }).join('');
  return `<div class="hss-alignment" role="img" aria-label="Per-base probing reactivity (bars) aligned to the PDB chain residues">
    <div class="hss-aln-key">
      <span class="hss-aln-label">Probing signal (reactivity)</span>
      <span class="hss-aln-label hss-aln-label-pdb">${pdbLabel}</span>
    </div>
    <div class="hss-aln-columns">${columns}</div>
  </div>`;
}

// 确定性按访问次序选主角案例。空/非数组 → null；visitIndex 非有限数 → 0。
export function pickFeaturedCase(cases, visitIndex) {
  if (!Array.isArray(cases) || cases.length === 0) return null;
  const idx = Number.isFinite(Number(visitIndex)) ? Math.abs(Math.trunc(Number(visitIndex))) : 0;
  return cases[idx % cases.length];
}

// 招牌滚动叙事区。左侧三态层 + 右侧三场景 + 图例。无 DOM/无 window/无定时器。
// 资产基址由调用方注入（与 probing 轮播一致），渲染层只拼 src。
export function renderHomeScrollStory(caseData, opts = {}) {
  const base = String(opts.assetBase || '.').replace(/\/$/, '');
  if (!caseData || !Array.isArray(caseData.scenes) || caseData.scenes.length === 0) {
    return `<section class="home-scroll-story hss-placeholder" aria-hidden="true"></section>`;
  }
  const meta = `${caseData.molecule_label || ''} · PDB ${caseData.pdb_id || ''} · ${caseData.confidence_label || ''}`;
  const layer0 = `<div class="hss-layer is-active" data-stage="0"><div class="hss-tag">1 · Alignment</div>${renderReactivityAlignment(caseData)}</div>`;
  const layer1 = caseData.svg_2d
    ? `<div class="hss-layer" data-stage="1"><div class="hss-tag">2 · Secondary structure</div><img class="hss-snapshot" src="${base}/${caseData.svg_2d}" alt="${caseData.pdb_id || ''} secondary structure, reactivity-colored" loading="lazy"></div>`
    : `<div class="hss-layer" data-stage="1"><div class="hss-tag">2 · Secondary structure</div><div class="hss-missing">2D snapshot unavailable</div></div>`;
  const layer2 = caseData.png_3d
    ? `<div class="hss-layer" data-stage="2"><div class="hss-tag">3 · Tertiary structure</div><img class="hss-snapshot" src="${base}/${caseData.png_3d}" alt="${caseData.pdb_id || ''} tertiary structure, reactivity-colored" loading="lazy"></div>`
    : `<div class="hss-layer" data-stage="2"><div class="hss-tag">3 · Tertiary structure</div><div class="hss-missing">3D snapshot unavailable</div></div>`;
  const scenes = caseData.scenes.map((s, i) => {
    const chip = s.chip ? `\n      <span class="hss-chip">${s.chip}</span>` : '';
    return `
    <div class="hss-scene${i === 0 ? ' is-active' : ''}" data-scene="${i}">
      <div class="hss-scene-num">${s.n || ''}</div>
      <h3 class="hss-scene-title">${s.title || ''}</h3>
      <p class="hss-scene-body">${s.body || ''}</p>${chip}
    </div>`;
  }).join('');
  const legend = `<div class="hss-legend"><span>low</span><span class="hss-legend-bar"></span><span>high reactivity</span></div>`;
  const records = HOME_METRICS.structureLinkedRecords.toLocaleString('en-US');
  const kicker = `A FoldBridge story · ${caseData.molecule_label || ''} (PDB ${caseData.pdb_id || ''})`;
  const intro = `<header class="hss-intro">
      <p class="hss-kicker">${kicker}</p>
      <h1 class="hss-headline">Follow one RNA from<br><span class="hss-headline-grad">probing signal to 3D fold</span></h1>
      <p class="hss-lede">The same reactivity colors travel with every nucleotide — from the raw alignment, into the secondary structure, and onto the deposited tertiary structure. Scroll to watch it transform.</p>
      <p class="hss-scrollcue">↓ Scroll</p>
    </header>`;
  const closing = `<footer class="hss-closing">
      <h2>Every record in FoldBridge tells this story</h2>
      <p>${records} structure-linked records, each with calibrated confidence.</p>
      <button type="button" class="hss-cta" data-route="entry">Browse the Entry table &rarr;</button>
    </footer>`;
  return `<section class="home-scroll-story" aria-label="From probing signal to 3D fold">
    ${intro}
    <div class="hss-grid">
      <div class="hss-sticky"><div class="hss-card"><div class="hss-meta">${meta}</div>${layer0}${layer1}${layer2}${legend}</div></div>
      <div class="hss-scenes">${scenes}</div>
    </div>
    ${closing}
  </section>`;
}
