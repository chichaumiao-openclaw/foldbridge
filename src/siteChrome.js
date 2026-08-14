// 站点骨架纯渲染片段。从 main.js 抽出以便 node --test 可 import 测试。
// 所有函数必须是纯函数：入参 → 返回 HTML 字符串，禁止访问模块级 window/route/mode。
// main.js 负责把这些片段接回并绑定 DOM 事件。

const PRIMARY_NAV_ITEMS = [
  { route: 'home', label: 'Home', activeRoutes: ['home'] },
  {
    route: 'entry',
    label: 'Entry',
    activeRoutes: [
      'entry',
      'sequence',
      'download-sequences',
      'pdb-case',
      'annojoin-atlas',
      'annojoin-case',
      'annojoin-confidence'
    ]
  },
  { route: 'search', label: 'Search', activeRoutes: ['search'] },
  { route: 'probing', label: 'Probing', activeRoutes: ['probing', 'detail'] },
  { route: 'stats', label: 'Stats', activeRoutes: ['stats'] },
  { route: 'download', label: 'Download', activeRoutes: ['download'] },
  { route: 'about', label: 'Help', activeRoutes: ['about'] }
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

// 首页指标（写死，集中一处便于一处更新）。最新口径（用户 2026-06-30）：
//   probingEntries       = 4,664 chemical probing entries
//   pdbStructures        = 2,386 PDB structures
//   highConfidencePaired = 510 high-confidence paired datas
//   probingArticles/mechanismFamilies = probing-articles 首页展示口径（26 篇文章 / 5 个 families）
// 口径再变化时只改这里的数字。
export const HOME_METRICS = {
  probingEntries: 4664,
  pdbStructures: 2386,
  highConfidencePaired: 510,
  probingArticles: 26,
  mechanismFamilies: 5
};

export function renderHomeHero(metrics = HOME_METRICS) {
  const probingEntries = metrics.probingEntries.toLocaleString('en-US');
  const pdbStructures = metrics.pdbStructures.toLocaleString('en-US');
  const highConfidencePaired = metrics.highConfidencePaired.toLocaleString('en-US');
  return `<section class="bundle-hero-card bundle-wide-card">
        <div class="bundle-hero-copy">
          <p class="bundle-kicker">RNA structure-linked database</p>
          <h2>FoldBridge</h2>
          <p class="bundle-hero-summary">
            A curated database that links RNA chemical probing data with experimentally resolved tertiary structures.
          </p>
          <div class="bundle-hero-actions">
            <button type="button" class="bundle-hero-primary" data-route="entry">Browse Entry table &rarr;</button>
            <button type="button" class="ghost" data-route="probing">Explore probing methods</button>
          </div>
        </div>

        <aside class="bundle-hero-metrics">
          <article class="bundle-metric-card bundle-metric-large">
            <p>chemical probing entries</p>
            <strong>${probingEntries}</strong>
            <span>RNA reactivity records</span>
          </article>
          <article class="bundle-metric-card">
            <p>PDB structures</p>
            <strong>${pdbStructures}</strong>
            <span>Structures matched to probing data</span>
          </article>
          <article class="bundle-metric-card">
            <p>high-confidence paired</p>
            <strong>${highConfidencePaired}</strong>
            <span>Structure-linked paired datasets</span>
          </article>
        </aside>
      </section>`;
}

const HOME_MODULE_CARDS = [
  {
    route: 'entry',
    kicker: 'master table',
    title: 'Entry table',
    summary: `${HOME_METRICS.pdbStructures.toLocaleString('en-US')} structure-linked PDB entries with search, grouping and export.`,
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
    return `<a data-carousel-slide="${i}" class="home-probing-slide${activeClass}" href="#probing?tech=${encodeURIComponent(a.slug)}">
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
  const records = HOME_METRICS.pdbStructures.toLocaleString('en-US');
  const intro = `<header class="hss-intro">
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

// === ABOUT PAGE (W-A 在此追加 renderAboutPage) ===

// About / 方法学页纯渲染。入参 content（about-content.json 解析对象）→ HTML 字符串。
// content 为空（未加载 / 加载失败）时降级为最小壳，含 <h1>About</h1>，绝不产出 undefined。
// 所有字段缺失用空串兜底；about-content.json 是入 git 的静态可信数据，无需 escape。
const aboutText = (v) => (v == null ? '' : String(v));

function renderAboutCards(section) {
  const items = (section.items || []).map((item) => `
        <article class="card about-source-card">
          <h3>${aboutText(item.name)}</h3>
          <p>${aboutText(item.body)}</p>
        </article>`).join('');
  return `<div class="about-card-grid">${items}
      </div>`;
}

function renderAboutPipeline(section) {
  const steps = Array.isArray(section.steps) ? section.steps : [];
  const nodeW = 150;
  const gap = 44;
  const h = 64;
  const stepW = nodeW + gap;
  const width = steps.length > 0 ? steps.length * stepW - gap : nodeW;
  const cy = h / 2;
  const parts = steps.map((step, i) => {
    const x = i * stepW;
    const rect = `<rect class="about-pipe-node" x="${x}" y="8" rx="12" ry="12" width="${nodeW}" height="${h - 16}"></rect>`;
    const label = `<text class="about-pipe-label" x="${x + nodeW / 2}" y="${cy}" text-anchor="middle" dominant-baseline="middle">${aboutText(step)}</text>`;
    const arrow = i < steps.length - 1
      ? `<line class="about-pipe-arrow" x1="${x + nodeW}" y1="${cy}" x2="${x + nodeW + gap}" y2="${cy}" marker-end="url(#about-arrow)"></line>`
      : '';
    return `${rect}${label}${arrow}`;
  }).join('');
  return `<div class="about-pipeline-figure">
        <svg viewBox="0 0 ${width} ${h}" role="img" aria-label="ANNOJOIN pipeline" class="about-pipeline-svg" preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="about-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z"></path>
            </marker>
          </defs>
          ${parts}
        </svg>
        ${section.body ? `<p class="about-pipeline-note">${aboutText(section.body)}</p>` : ''}
      </div>`;
}

function renderAboutProse(section) {
  return `<p class="about-prose">${aboutText(section.body)}</p>`;
}

function renderHelpContact(section) {
  const email = aboutText(section.email);
  if (!email) return renderAboutProse(section);
  return `<p class="about-prose">${aboutText(section.body)} <a class="help-contact-link" href="mailto:${email}">${email}</a>.</p>`;
}

function renderAboutTable(section) {
  const rows = (section.items || []).map((item) => `
        <dt>${aboutText(item.term)}</dt>
        <dd>${aboutText(item.body)}</dd>`).join('');
  return `<dl class="about-terms">${rows}
      </dl>`;
}

function renderAboutSection(section) {
  let inner = '';
  switch (section.kind) {
    case 'cards': inner = renderAboutCards(section); break;
    case 'pipeline': inner = renderAboutPipeline(section); break;
    case 'table': inner = renderAboutTable(section); break;
    case 'prose':
    default: inner = renderAboutProse(section); break;
  }
  const id = section.id ? ` id="about-${aboutText(section.id)}"` : '';
  return `<section class="card bundle-wide-card about-section"${id}>
      <h2>${aboutText(section.title)}</h2>
      ${inner}
    </section>`;
}

export function renderAboutPage(content) {
  if (!content || typeof content !== 'object') {
    return `<section class="card bundle-wide-card about-section">
      <h1>About</h1>
      <p>About content is unavailable right now.</p>
    </section>`;
  }
  const hero = content.hero || {};
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const heroHtml = `<section class="about-hero">
      ${hero.kicker ? `<p class="about-hero-kicker">${aboutText(hero.kicker)}</p>` : ''}
      <h1>${aboutText(hero.title) || 'About'}</h1>
      ${hero.summary ? `<p class="about-hero-summary">${aboutText(hero.summary)}</p>` : ''}
      ${hero.detail ? `<p class="about-hero-detail">${aboutText(hero.detail)}</p>` : ''}
    </section>`;
  const sectionsHtml = sections.map(renderAboutSection).join('\n    ');
  return `${heroHtml}
    ${sectionsHtml}`;
}

// Help / 使用指南页纯渲染。与 About 复用同一套 section 渲染器（cards/pipeline/
// table/prose），入参 content（help-content.json 解析对象）→ HTML 字符串。
// content 为空（未加载 / 加载失败）时降级为最小壳，含 <h1>Help</h1>，绝不产出
// undefined。help-content.json 是入 git 的静态可信数据，无需 escape。
function renderHelpMemberDetail(detail) {
  if (typeof detail === 'string') return aboutText(detail);
  if (!detail || typeof detail !== 'object') return '';
  const prefix = detail.prefix ? `${aboutText(detail.prefix)} · ` : '';
  const organization = aboutText(detail.organization);
  if (!organization) return prefix;
  if (!detail.url) return `${prefix}${organization}`;
  return `${prefix}<a class="help-member-link" href="${aboutText(detail.url)}" target="_blank" rel="noopener noreferrer">${organization}</a>`;
}

function renderHelpMemberRole(role) {
  if (typeof role === 'string') return aboutText(role);
  if (!role || typeof role !== 'object') return '';
  const prefix = role.prefix ? `${aboutText(role.prefix)} ` : '';
  const organization = aboutText(role.organization);
  if (!organization) return prefix;
  if (!role.url) return `${prefix}<span class="help-member-label">${organization}</span>`;
  return `${prefix}<a class="help-member-link" href="${aboutText(role.url)}" target="_blank" rel="noopener noreferrer">${organization}</a>`;
}

function renderHelpGuide(section) {
  const items = Array.isArray(section.items) ? section.items : [];
  return `<div class="help-guide-steps">
    ${items.map((item, index) => `<article class="help-guide-step">
      <div class="help-guide-step-number">${index + 1})</div>
      <div>
        <h3>${aboutText(item.term || item.title).replace(/^\d+\)\s*/, '')}</h3>
        <p>${aboutText(item.body)}</p>
        ${item.route ? `<a class="help-guide-link" href="${aboutText(item.route)}">${aboutText(item.linkLabel || 'Open this page')} →</a>` : ''}
      </div>
    </article>`).join('')}
  </div>`;
}

function renderHelpVisuals(section) {
  const items = Array.isArray(section.items) ? section.items : [];
  return `<div class="help-visual-grid">
    ${items.map((item, index) => `<article class="help-visual-card">
      <div class="help-visual-card-heading">
        <span>${index + 1}</span>
        <h3>${aboutText(item.term || item.title)}</h3>
      </div>
      ${item.image ? `<figure><img src="${aboutText(item.image)}" alt="${aboutText(item.alt || item.term || item.title)}" loading="lazy"></figure>` : ''}
      <p>${aboutText(item.body)}</p>
    </article>`).join('')}
  </div>`;
}

function renderHelpUsage(section) {
  const items = Array.isArray(section.items) ? section.items : [];
  return `<div class="help-usage-flow">
    ${items.map((item, index) => `<article class="help-usage-step">
      <div class="help-usage-copy">
        <span class="help-usage-step-number">${index + 1}</span>
        <div>
          <h3>${aboutText(item.title || item.term || `Step ${index + 1}`)}</h3>
          ${item.body ? `<p>${aboutText(item.body)}</p>` : ''}
        </div>
      </div>
      ${item.image ? `<figure class="help-usage-screenshot"><img src="${aboutText(item.image)}" alt="${aboutText(item.alt || item.title || `Usage step ${index + 1}`)}" loading="lazy"></figure>` : ''}
    </article>`).join('')}
  </div>`;
}

function renderHelpFeedback(section) {
  const route = section.route ? aboutText(section.route) : '#help-contact';
  const label = aboutText(section.linkLabel || 'Submit feedback');
  const externalAttributes = /^https?:\/\//.test(route) ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<div class="help-feedback">
      <p>${aboutText(section.body)}</p>
      <a class="help-feedback-button" href="${route}"${externalAttributes}>${label}</a>
    </div>`;
}

function renderHelpSection(section) {
  let inner = '';
  switch (section.kind) {
    case 'guide': inner = renderHelpGuide(section); break;
    case 'visuals': inner = renderHelpVisuals(section); break;
    case 'usage': inner = renderHelpUsage(section); break;
    case 'feedback': inner = renderHelpFeedback(section); break;
    case 'cards': inner = renderAboutCards(section); break;
    case 'table': inner = renderAboutTable(section); break;
    case 'prose':
    default: inner = section.id === 'contact' ? renderHelpContact(section) : renderAboutProse(section); break;
  }
  const id = section.id ? ` id="help-${aboutText(section.id)}"` : '';
  const className = section.kind === 'usage'
    ? 'help-guide-section help-guide-section--workflow'
    : 'help-guide-section';
  return `<section class="${className}"${id}>
      <header class="help-guide-section-header"><h2>${aboutText(section.title)}</h2></header>
      <div class="help-guide-section-body">${inner}</div>
    </section>`;
}

export function renderHelpPage(content) {
  if (!content || typeof content !== 'object') {
    return `<section class="card bundle-wide-card about-section">
      <h1>Help</h1>
      <p>Help content is unavailable right now.</p>
    </section>`;
  }
  const hero = content.hero || {};
  const sections = Array.isArray(content.sections) ? content.sections : [];
  const contactSection = sections.find((section) => section?.id === 'contact');
  const nonContactSections = sections.filter((section) => section?.id !== 'contact');
  const heroHtml = `<section class="help-guide-hero">
      ${hero.kicker ? `<p class="about-hero-kicker">${aboutText(hero.kicker)}</p>` : ''}
      <h1>${aboutText(hero.title) || 'Help'}</h1>
      ${hero.summary ? `<p class="about-hero-summary">${aboutText(hero.summary)}</p>` : ''}
      ${hero.detail ? `<p class="about-hero-detail">${aboutText(hero.detail)}</p>` : ''}
    </section>`;
  const sectionsHtml = nonContactSections.map(renderHelpSection).join('\n    ');
  const contactHtml = contactSection ? renderHelpSection(contactSection) : '';
  const members = Array.isArray(content.group_members) ? content.group_members : [];
  const membersHtml = members.length > 0 ? `<section class="help-guide-section help-group-members" aria-labelledby="help-group-members-title">
      <div class="help-group-members-heading">
        <h2 id="help-group-members-title">Group Members</h2>
      </div>
      <div class="help-group-members-grid">
        ${members.map((member) => {
          const details = Array.isArray(member.details) ? member.details : [];
          return `<article class="help-member-card">
            <div class="help-member-portrait">
              ${member.photo
                ? `<img src="${aboutText(member.photo)}" alt="${aboutText(member.name)}" loading="lazy">`
                : aboutText(member.initials)}
            </div>
            <div class="help-member-copy">
              <h3>${aboutText(member.name)}</h3>
              ${member.role ? `<p class="help-member-role">${renderHelpMemberRole(member.role)}</p>` : ''}
              <div class="help-member-details">${details.map((detail) => `<p>${renderHelpMemberDetail(detail)}</p>`).join('')}</div>
            </div>
            </article>`;
        }).join('')}
      </div>
    </section>` : '';
  return `<div class="help-page-shell">
    ${heroHtml}
    ${sectionsHtml}
    ${contactHtml}
    ${membersHtml}
  </div>`;
}

// === STATS PAGE (W-B 在此追加 renderStatsPage) ===

// 千分位格式化（纯展示）。非有限值 → '—'，绝不输出 undefined/NaN。
function statsNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

// RNA 链 partition 分布：竖向比例条，颜色与图例顺序固定，方便跨次构建比较。
const RNA_CHAIN_PARTITION_COLORS = [
  '#D5A52B', '#E6BF4D', '#C9864F', '#AAB75D', '#789B72', '#D1A667',
  '#B87983', '#839F8A', '#C9AE4B', '#B87859', '#9AA565', '#B89B70'
];
const RNA_CHAIN_PARTITION_LABELS = {
  other_RNA: 'other_<wbr>RNA',
  ribozyme: 'ribo<wbr>zyme',
  riboswitch: 'ribo<wbr>switch',
  snRNA: 'sn<wbr>RNA',
  aptamer: 'apt<wbr>amer',
  synthetic_RNA: 'synth<wbr>etic_<wbr>RNA',
  SRP_RNA: 'SRP_<wbr>RNA',
  designed_RNA: 'desi<wbr>gned_<wbr>RNA'
};

function renderStatsRnaChainChart(partitions) {
  if (!partitions || typeof partitions !== 'object') {
    return `<p class="stats-empty">RNA chain distribution not available.</p>`;
  }
  const rows = Object.entries(partitions)
    .map(([name, count], index) => ({ name, count: Number(count) || 0, color: RNA_CHAIN_PARTITION_COLORS[index % RNA_CHAIN_PARTITION_COLORS.length] }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);
  if (!rows.length) return `<p class="stats-empty">RNA chain distribution not available.</p>`;
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const maxCount = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  const bars = rows.map((r) => {
    const height = Math.max(2, Math.round((r.count / maxCount) * 100));
    const pct = total ? `${((r.count / total) * 100).toFixed(1)}%` : '0%';
    const label = RNA_CHAIN_PARTITION_LABELS[r.name] || r.name.replaceAll('_', '_<wbr>');
    return `<li class="stats-rna-chain-column" style="--stats-rna-fill:${r.color}">
        <span class="stats-rna-chain-value">${statsNumber(r.count)}</span>
        <span class="stats-rna-chain-track"><span class="stats-rna-chain-fill" style="height:${height}%"><span class="stats-rna-chain-pct">${pct}</span></span></span>
        <span class="stats-rna-chain-label" title="${r.name}">${label}</span>
      </li>`;
  }).join('\n      ');
  return `<ul class="stats-rna-chain-list" role="img" aria-label="RNA chain distribution across ${statsNumber(total)} chains">
      ${bars}
    </ul>`;
}

// 单张数字卡。
function statsMetricCard(value, label) {
  return `<div class="stats-metric">
      <span class="stats-metric-value">${statsNumber(value)}</span>
      <span class="stats-metric-label">${label}</span>
    </div>`;
}

// Stats 总览页纯渲染。stats 缺失（null/undefined）→ 最小壳（含 <h1>Statistics</h1>），
// 绝不输出 undefined。stats 是构建产物（build-site-stats.mjs），可信插值。
export function renderStatsPage(stats) {
  if (!stats || typeof stats !== 'object') {
    return `<section class="card bundle-wide-card stats-page">
      <header class="stats-head">
        <h1>Statistics</h1>
      </header>
      <p class="stats-empty">Statistics are still loading. If this persists, the stats asset may not be built yet.</p>
    </section>`;
  }
  const rnaChainPartitions = stats.rna_chain_partitions || {};

  return `<section class="card bundle-wide-card stats-page" data-pdb-total="${Number(stats.pdb_total) || 0}">
      <header class="stats-head">
        <h1>Statistics</h1>
      </header>

      <div class="stats-metric-grid">
        ${statsMetricCard(stats.probing_entries, 'Chemical probing entries')}
        ${statsMetricCard(stats.pdb_total, 'Published PDB structures')}
        ${statsMetricCard(stats.high_confidence_entries, 'High-confidence entries')}
        ${statsMetricCard(stats.technologies, 'Probe technologies')}
        ${statsMetricCard(stats.families, 'Measurement families')}
        ${statsMetricCard(stats.articles, 'Probing articles')}
      </div>
      <p class="stats-summary">Each entry groups PDB chains with the same biological-molecule name within one structure.</p>

      <section class="stats-section stats-rna-types">
        <h2>RNA types</h2>
        <p class="stats-section-lede">RNA chains are partitioned across 12 annotated types, for a total of
          ${statsNumber(Object.values(rnaChainPartitions).reduce((sum, count) => sum + (Number(count) || 0), 0))} chains.</p>
        ${renderStatsRnaChainChart(rnaChainPartitions)}
      </section>

    </section>`;
}

// === PROBING HUB (W-C 在此追加 renderProbingFamilyIndex/TechTable/Glossary) ===

function escapeProbingHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// 机制家族索引：6 个家族卡片，每张链回 #probing 总览的对应家族锚点。
export function renderProbingFamilyIndex(families, { embedded = false } = {}) {
  const list = Array.isArray(families) ? families : [];
  if (!list.length) {
    const emptyTag = embedded ? 'div' : 'section';
    return `<${emptyTag} class="${embedded ? 'probing-family-index probing-family-index--embedded' : 'card bundle-wide-card probing-family-index'} probing-family-index--empty">
      <p class="probing-hub-empty">Mechanism families are not available yet.</p>
    </${emptyTag}>`;
  }
  const visibleFamilies = list.filter((fam) => fam.id !== 'inference');
  const cards = visibleFamilies.map((fam) => {
    const id = escapeProbingHtml(fam.id);
    const isDmsFamily = fam.id === 'dms';
    const isShapeFamily = fam.id === 'shape';
    const isCleavageFamily = fam.id === 'in-cell-shape';
    const isNucleotideFamily = fam.id === 'footprinting';
    const isInteractionFamily = fam.id === 'carbodiimide-special';
    const title = isDmsFamily
      ? 'DMS-based methods'
      : (isShapeFamily
        ? 'SHAPE-based methods'
        : (isCleavageFamily
          ? 'Cleavage-based methods'
          : (isNucleotideFamily
            ? 'Nucleotide-specific chemical probing methods'
            : (isInteractionFamily ? 'RNA–RNA interaction mapping methods' : fam.title))));
    const summary = isInteractionFamily
      ? 'Crosslinking and proximity ligation capture RNA–RNA contacts and higher-order RNA organization.'
      : fam.summary;
    return `<a class="probing-family-card" href="#probing-family-${id}" data-probing-family-link="${id}">
        <h3 class="probing-family-card-title">${escapeProbingHtml(title)}</h3>
        <p class="probing-family-card-summary">${escapeProbingHtml(summary)}</p>
      </a>`;
  }).join('');
  const tag = embedded ? 'div' : 'section';
  const className = embedded
    ? 'probing-family-index probing-family-index--embedded'
    : 'card bundle-wide-card probing-family-index';
  return `<${tag} class="${className}" aria-label="Probing mechanism families">
      <div class="probing-hub-heading">
        <h2>Five mechanism families</h2>
      </div>
      <div class="probing-family-grid">${cards}</div>
    </${tag}>`;
}

// 34 行技术对照表：可按列排序（data-sort），无 JS 时仍可读（默认 registry 顺序）。
const PROBING_FAMILY_MEANING = {
  A: 'WC-face base-specific',
  B: 'SHAPE flexibility-proxy',
  C: 'enzymatic (REVERSED)',
  D: 'SASA dual-ref',
  E: 'contact-map',
  F: 'pair-set F1'
};

export function renderProbingTechTable(registry) {
  const rows = (registry && Array.isArray(registry.technologies)) ? registry.technologies : [];
  if (!rows.length) {
    return `<section class="card bundle-wide-card probing-tech-table probing-tech-table--empty">
      <p class="probing-hub-empty">The probe technology registry is not available yet.</p>
    </section>`;
  }
  const body = rows.map((row) => {
    const tech = escapeProbingHtml(row.technology);
    const fam = escapeProbingHtml(row.family);
    const famMeaning = escapeProbingHtml(PROBING_FAMILY_MEANING[row.family] || '');
    const bases = escapeProbingHtml(row.targetable_bases);
    const techCell = row.article_slug
      ? `<a class="probing-tech-article-link" href="#probing?tech=${encodeURIComponent(row.article_slug)}">${tech}</a>`
      : `<span class="probing-tech-name">${tech}</span>`;
    return `<tr data-tech-row>
        <td data-col="technology">${techCell}</td>
        <td data-col="family"><span class="probing-family-tag" title="${famMeaning}">${fam}</span> <span class="probing-family-meaning">${famMeaning}</span></td>
        <td data-col="bases">${bases}</td>
      </tr>`;
  }).join('');
  return `<section class="card bundle-wide-card probing-tech-table" aria-label="Probe technology comparison">
      <div class="probing-hub-heading">
        <p class="technology-kicker">technology registry</p>
        <h2>34 RNA probing technologies at a glance</h2>
        <p class="probing-tech-caption">In this table, <strong>family</strong> labels the physical quantity each method measures (A–F) — it is <strong>not a quality ranking</strong>. Technologies with an in-depth explainer are linked by name.</p>
      </div>
      <div class="probing-tech-table-scroll">
        <table class="probing-tech-grid">
          <thead>
            <tr>
              <th scope="col" data-sort="technology">Technology</th>
              <th scope="col" data-sort="family">Family</th>
              <th scope="col" data-sort="bases">Targetable bases</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>`;
}
