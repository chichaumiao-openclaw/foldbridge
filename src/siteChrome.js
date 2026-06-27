// 站点骨架纯渲染片段。从 main.js 抽出以便 node --test 可 import 测试。
// 所有函数必须是纯函数：入参 → 返回 HTML 字符串，禁止访问模块级 window/route/mode。
// main.js 负责把这些片段接回并绑定 DOM 事件。

const PRIMARY_NAV_ITEMS = [
  { route: 'home', label: 'Home', activeRoutes: ['home'] },
  { route: 'sequence', label: 'Entry', activeRoutes: ['sequence', 'download-sequences'] },
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
            <button type="button" class="bundle-hero-primary" data-route="sequence">Browse Entry table &rarr;</button>
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
    route: 'sequence',
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
