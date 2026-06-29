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
