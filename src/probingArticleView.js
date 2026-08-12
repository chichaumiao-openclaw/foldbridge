// probingArticleView.js — RNA 探针科普文章的渲染层（纯函数，返回 HTML 字符串）。
// 复用站点既有 design tokens / card / technology-kicker 视觉语言；
// 文章正文用专门的 article-* class 控制阅读排版（行宽、行高、图注）。
//
// 两个入口：
//   renderProbingArticleIndex(index)        — 方法总览（按机制家族分组的卡片墙）
//   renderProbingArticlePage(detail, index) — 单篇阅读页（标题 + 有序 block + 图注）

import { HOME_METRICS } from './siteChrome.js';

const ENLARGED_FIGURE_ARTICLE_SLUGS = new Set([
  'structure-seq',
  'structure-seq2',
  'mod-seq',
  'dim-2p-seq'
]);

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shortArticleName(article) {
  const title = String(article?.title || '');
  const colonIndex = title.indexOf(':');
  if (colonIndex > 0) return title.slice(0, colonIndex).trim();
  if (article?.slug === 'parte') return 'PARTE';
  return title;
}

// 行内 markdown：先转义，再恢复 `code` 与 **bold**。
function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_m, c) => `<code class="article-code">${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, c) => `<strong>${c}</strong>`);
  return out;
}

function renderFigureLegend(text) {
  const legend = String(text == null ? '' : text);
  const titleMatch = legend.match(/^\*\*([^*]+)\*\*(.*)$/s);
  if (!titleMatch) return renderInline(legend);
  const title = `<strong>${escapeHtml(titleMatch[1])}</strong>`;
  const description = titleMatch[2].trimStart();
  return description ? `${title}<br />${renderInline(description)}` : title;
}

const DMS_METHOD_DESCRIPTIONS = [
  {
    slug: 'dms',
    title: 'DMS',
    description: 'Chemical probing of RNA secondary structures through selective base modification.'
  },
  {
    slug: 'dms-seq',
    title: 'DMS-seq',
    description: 'Transcriptome-wide RNA structure profiling by coupling DMS modification with sequencing.'
  },
  {
    slug: 'structure-seq',
    title: 'Structure-seq',
    description: 'In vivo transcriptome-wide RNA structure profiling using DMS.'
  },
  {
    slug: 'structure-seq2',
    title: 'Structure-seq2',
    description: 'Improved transcriptome-wide RNA structure mapping through optimized DMS probing and sequencing.'
  },
  {
    slug: 'mod-seq',
    title: 'Mod-seq',
    description: 'Genome-wide RNA structure profiling through modification-induced mutation detection.'
  },
  {
    slug: 'dms-mapseq',
    title: 'DMS-MaPseq',
    description: 'Quantitative RNA structure profiling through mutation-based DMS detection.'
  },
  {
    slug: 'dim-2p-seq',
    title: 'DIM-2P-seq',
    description: 'Mapping mRNA 3′-end RNA structures and their regulatory roles in polyadenylation.'
  }
];

const SHAPE_METHOD_DESCRIPTIONS = [
  {
    slug: 'shape',
    title: 'SHAPE',
    description: 'RNA structure probing through selective 2′-hydroxyl acylation of flexible nucleotides.'
  },
  {
    slug: 'shape-seq',
    title: 'SHAPE-Seq',
    description: 'Multiplexed RNA structure profiling by coupling SHAPE chemistry with high-throughput sequencing.'
  },
  {
    slug: 'shape-map',
    title: 'SHAPE-MaP',
    description: 'Mutation-based RNA structure profiling through SHAPE chemical probing.'
  },
  {
    slug: 'icshape',
    title: 'icSHAPE',
    description: 'In vivo transcriptome-wide RNA structure profiling using selective 2′-hydroxyl acylation.'
  },
  {
    slug: 'icshape-map',
    title: 'icSHAPE-MaP',
    description: 'In vivo RNA structure profiling using selective 2′-hydroxyl acylation and mutation detection by reverse transcription.'
  },
  {
    slug: 'nai-map',
    title: 'NAI-MaP',
    description: 'NAI-based mutational profiling for nucleotide-resolution RNA structure probing.'
  },
  {
    slug: 'smartshape',
    title: 'SmartSHAPE',
    description: 'Ultra-low-input SHAPE profiling for transcriptome-wide RNA structure analysis.'
  }
];

const CLEAVAGE_METHOD_DESCRIPTIONS = [
  {
    slug: 'pars',
    title: 'PARS',
    description: 'Parallel Analysis of RNA Structure by Enzymatic Cleavage.'
  },
  {
    slug: 'parte',
    title: 'PARTE',
    description: 'Parallel Analysis of RNA structures with Temperature Elevation.'
  },
  {
    slug: 'hrf-seq',
    title: 'HRF-seq',
    description: 'Sequencing-based mapping of RNA solvent accessibility by hydroxyl radical cleavage.'
  }
];

const NUCLEOTIDE_METHOD_DESCRIPTIONS = [
  {
    slug: 'keth-seq',
    title: 'Keth-seq',
    description: 'Sequencing-based mapping of guanine accessibility using N3-kethoxal modification.'
  },
  {
    slug: 'edc-probing',
    title: 'EDC probing',
    description: 'In-cell mapping of G and U base-pairing interactions.'
  },
  {
    slug: 'laser-seq',
    title: 'LASER-seq',
    description: 'Transcriptome-wide RNA solvent accessibility mapping using photoactivated chemical probing.'
  }
];

const RNA_INTERACTION_METHOD_DESCRIPTIONS = [
  {
    slug: 'paris',
    title: 'PARIS',
    description: 'Psoralen-based mapping of RNA duplex structures and RNA–RNA interactions.'
  },
  {
    slug: 'splash',
    title: 'SPLASH',
    description: 'Transcriptome-wide mapping of RNA–RNA interactions through psoralen-mediated proximity ligation.'
  },
  {
    slug: 'ligr-seq',
    title: 'LIGR-seq',
    description: 'Ligation-based RNA–RNA interaction mapping by in vivo crosslinking and proximity ligation.'
  },
  {
    slug: 'mario',
    title: 'MARIO',
    description: 'Global mapping of protein-mediated RNA–RNA interactions in living cells.'
  },
  {
    slug: 'ric-seq',
    title: 'RIC-seq',
    description: 'In situ mapping of RNA–RNA spatial interactions and higher-order RNA architecture.'
  },
  {
    slug: 'comrades',
    title: 'COMRADES',
    description: 'Targeted mapping of RNA–RNA interactions and RNA structures in living cells.'
  }
];

// ---- 总览页 ----

export function renderProbingArticleIndex(index, headerHtml = '', extraSectionsHtml = '') {
  const families = (index && index.families) || [];
  const visibleFamilies = families.filter((family) => family.id !== 'inference');
  const articleCount = HOME_METRICS.probingArticles;
  const articlesBySlug = new Map(
    families.flatMap((family) => Array.isArray(family.articles) ? family.articles : [])
      .map((article) => [article.slug, article])
  );

  const familySections = visibleFamilies.map((fam, familyIndex) => {
    const familyTitle = fam.id === 'dms'
      ? 'DMS-based methods'
      : (fam.id === 'shape'
        ? 'SHAPE-based methods'
        : (fam.id === 'in-cell-shape'
          ? 'Cleavage-based methods'
          : (fam.id === 'footprinting'
            ? 'Nucleotide-specific chemical probing methods'
            : (fam.id === 'carbodiimide-special' ? 'RNA–RNA interaction mapping methods' : fam.title))));
    const familySummary = fam.id === 'dms'
      ? 'DMS methylates the Watson–Crick faces of adenine (N1) and cytosine (N3), reporting base accessibility and pairing-dependent protection.'
      : (fam.id === 'shape'
        ? 'SHAPE reagents acylate the ribose 2′-hydroxyl of conformationally flexible nucleotides, reporting backbone flexibility.'
        : (fam.id === 'in-cell-shape'
          ? 'Selective cleavage of the RNA backbone generates accessibility footprints that reveal RNA structural features.'
          : (fam.id === 'footprinting'
            ? 'Chemical reagents selectively modify specific nucleobases or base-pairing environments, providing nucleotide identity–specific information on RNA structure and interactions.'
            : (fam.id === 'carbodiimide-special'
              ? 'Crosslinking and proximity ligation capture RNA–RNA contacts and higher-order RNA organization.'
              : fam.summary))));
    let familyArticles = fam.articles;
    if (fam.id === 'dms') {
      familyArticles = DMS_METHOD_DESCRIPTIONS;
    } else if (fam.id === 'shape') {
      familyArticles = SHAPE_METHOD_DESCRIPTIONS;
    } else if (fam.id === 'in-cell-shape') {
      familyArticles = CLEAVAGE_METHOD_DESCRIPTIONS;
    } else if (fam.id === 'footprinting') {
      familyArticles = NUCLEOTIDE_METHOD_DESCRIPTIONS;
    } else if (fam.id === 'carbodiimide-special') {
      familyArticles = RNA_INTERACTION_METHOD_DESCRIPTIONS;
    }
    familyArticles = familyArticles.map((method) => ({
      ...(articlesBySlug.get(method.slug) || {}),
      ...method
    }));
    const cards = familyArticles.map((a) => {
      const meta = [];
      if (a.figure_count) meta.push(`${a.figure_count} figures`);
      if (a.rep_pmid) meta.push(`PMID ${escapeHtml(a.rep_pmid)}`);
      return `
        <a class="probing-article-card" href="#probing?tech=${encodeURIComponent(a.slug)}">
          <div class="probing-article-card-head">
            <h3>${escapeHtml(a.title)}</h3>
          </div>
          <p class="probing-article-card-summary">${escapeHtml(a.description || a.summary)}${a.description ? '' : '…'}</p>
          <div class="probing-article-card-meta">
            ${meta.map((m) => `<span>${m}</span>`).join('')}
          </div>
        </a>`;
    }).join('');

    return `
      <details id="probing-family-${escapeHtml(fam.id)}" class="technology-section-card" data-probing-family="${escapeHtml(fam.id)}"${familyIndex === 0 ? ' open' : ''}>
        <summary class="technology-section-summary">
          <div class="technology-section-heading">
            <div>
              <h2>${escapeHtml(familyTitle)}</h2>
            </div>
            <p>${escapeHtml(familySummary)}</p>
          </div>
        </summary>
        <div class="probing-article-grid">${cards}</div>
      </details>`;
  }).join('');

  return `${headerHtml}
  <main class="page-detail page-probing-index">
    <section class="card bundle-wide-card technology-hero-card technology-hero-card-solo">
      <div class="technology-hero-copy">
        <h1>Chemical probing methods</h1>
        <p class="technology-intro">This curated overview presents ${articleCount} in-depth explainers on RNA structure probing methods. The articles use original figures to clarify the chemical events each method measures and, where applicable, relate those measurements to FoldBridge’s raw data, visualization, and confidence layers.</p>
        <p class="technology-intro technology-intro-secondary">Browse by mechanism family first, then open any method to enter its full reading page.</p>
      </div>
    </section>
    ${extraSectionsHtml || ''}
    <section class="card bundle-wide-card probing-family-collection" aria-label="Probing mechanism families">
      ${familySections}
    </section>
  </main>`;
}

// ---- 单篇阅读页 ----

function renderBlock(block, assetBase) {
  if (block.type === 'heading') {
    return `<h2 class="article-section-heading">${renderInline(block.text)}</h2>`;
  }
  if (block.type === 'paragraph') {
    return `<p class="article-paragraph">${renderInline(block.text)}</p>`;
  }
  if (block.type === 'figure') {
    const cite = [];
    if (block.pmid) cite.push(`PMID ${escapeHtml(block.pmid)}`);
    if (block.doi) cite.push(`DOI ${escapeHtml(block.doi)}`);
    const citeLine = cite.length
      ? `<p class="article-figure-cite">${cite.join(' · ')}</p>` : '';
    const bodyParas = (block.body || [])
      .map((t) => `<p class="article-paragraph">${renderInline(t)}</p>`)
      .join('');
    const src = `${assetBase}/${block.srcBasename}`;
    return `
      <figure class="article-figure" id="${escapeHtml(block.anchor || '')}">
        <img src="${src}" alt="${escapeHtml(block.alt || block.label || '')}" loading="lazy" />
        <figcaption class="article-figure-legend">${renderFigureLegend(block.legend || '')}</figcaption>
        ${citeLine}
      </figure>
      ${bodyParas}`;
  }
  return '';
}

function isRealCaseHeading(block) {
  return block?.type === 'heading'
    && /^a real (case|example)\b/i.test(String(block.text || '').trim());
}

function withoutRealCaseSections(blocks) {
  let skipping = false;
  return blocks.filter((block) => {
    if (block.type === 'heading') {
      if (isRealCaseHeading(block)) {
        skipping = true;
        return false;
      }
      if (skipping) skipping = false;
    }
    return !skipping;
  });
}

function renderPptOverview(detail, assetBase, introHtml = '', footerHtml = '') {
  const items = Array.isArray(detail.ppt_overview) ? detail.ppt_overview : [];
  if (!items.length) return '';
  return `
    <section class="card bundle-wide-card article-ppt-overview">
      ${introHtml}
      <div class="article-ppt-grid">
        ${items.map((item) => `
          <article class="article-ppt-item">
            <h2>${escapeHtml(item.title || '')}</h2>
            <img src="${assetBase}/${escapeHtml(item.srcBasename || '')}" alt="${escapeHtml(item.alt || item.title || '')}" loading="lazy" />
          <p>${item.captionTitle ? `<strong>${escapeHtml(item.captionTitle)}</strong><br />` : ''}${escapeHtml(item.text || '')}</p>
          </article>`).join('')}
      </div>
      ${footerHtml}
    </section>`;
}

export function renderProbingArticlePage(detail, index, headerHtml = '') {
  const assetBase = detail.asset_base || `./src/assets/generated/probing-articles/assets/${detail.slug}`;
  const enlargedFigureClass = ENLARGED_FIGURE_ARTICLE_SLUGS.has(detail.slug)
    ? ' page-probing-article--enlarged-figures'
    : '';

  // 家族归属（用于面包屑 / 上下篇导航）。
  let siblings = [];
  if (index && index.families) {
    for (const fam of index.families) {
      const found = fam.articles.find((a) => a.slug === detail.slug);
      if (found) {
        const order = Array.isArray(fam.article_order) ? new Map(fam.article_order.map((slug, position) => [slug, position])) : null;
        siblings = order
          ? fam.articles
              .filter((article) => order.has(article.slug))
              .sort((a, b) => order.get(a.slug) - order.get(b.slug))
          : fam.articles;
        break;
      }
    }
  }

  const meta = [];
  if (detail.date) meta.push(`<div><dt>Date</dt><dd>${escapeHtml(detail.date)}</dd></div>`);
  if (detail.rep_doi) {
    const doi = escapeHtml(detail.rep_doi);
    const doiHref = encodeURIComponent(detail.rep_doi);
    meta.push(`<div class="technology-detail-primary-source"><dt>Primary source:</dt><dd><a href="https://doi.org/${doiHref}" target="_blank" rel="noopener noreferrer">DOI ${doi}</a></dd></div>`);
  }

  const allBlocks = Array.isArray(detail.blocks) ? detail.blocks : [];
  const startIndex = detail.body_start_heading
    ? allBlocks.findIndex((block) => block.type === 'heading' && block.text === detail.body_start_heading)
    : -1;
  const visibleBlocks = withoutRealCaseSections(
    startIndex >= 0 ? allBlocks.slice(startIndex) : allBlocks
  );
  const body = visibleBlocks.map((b) => renderBlock(b, assetBase)).join('\n');

  // 同家族上下篇导航。
  let siblingNav = '';
  if (detail.sibling_navigation && typeof detail.sibling_navigation === 'object') {
    const configured = detail.sibling_navigation;
    siblings = [
      ...(configured.previous ? [{ slug: configured.previous.slug, title: configured.previous.title }] : []),
      { slug: detail.slug, title: detail.title },
      ...(configured.next ? [{ slug: configured.next.slug, title: configured.next.title }] : [])
    ];
  }
  if (siblings.length > 1) {
    const idx = siblings.findIndex((a) => a.slug === detail.slug);
    if (idx !== -1) {
      const prev = idx > 0 ? siblings[idx - 1] : null;
      const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;
      const siblingMode = prev && next ? '' : (next ? ' next-only' : ' prev-only');
      siblingNav = `
        <nav class="article-sibling-nav${siblingMode}" aria-label="Articles in the same family">
          ${prev ? `<a class="article-sibling-link prev" href="#probing?tech=${encodeURIComponent(prev.slug)}"><span>Previous</span><strong>${escapeHtml(shortArticleName(prev))}</strong></a>` : '<span class="article-sibling-spacer"></span>'}
          ${next ? `<a class="article-sibling-link next" href="#probing?tech=${encodeURIComponent(next.slug)}"><span>Next</span><strong>${escapeHtml(shortArticleName(next))}</strong></a>` : '<span class="article-sibling-spacer"></span>'}
        </nav>`;
    }
  }

  const keyInnovation = detail.key_innovation ? `
      <section class="article-key-innovation">
        <h2>Key innovation</h2>
        <p>${escapeHtml(detail.key_innovation)}</p>
      </section>` : '';
  const hasPptOverview = Array.isArray(detail.ppt_overview) && detail.ppt_overview.length > 0;
  const readingBody = body ? `
      <div class="article-reading-body">
        ${body}
      </div>` : '';
  const readingSection = body ? `
    <article class="card bundle-wide-card article-reading-card">
      ${hasPptOverview ? '' : keyInnovation}
      ${readingBody}
      ${siblingNav}
    </article>` : '';
  const pptOverview = renderPptOverview(
    detail,
    assetBase,
    keyInnovation,
    body ? '' : siblingNav
  );
  const keyInnovationOnlySection = !body && !hasPptOverview && keyInnovation ? `
    <article class="card bundle-wide-card article-reading-card">
      ${keyInnovation}
      ${siblingNav}
    </article>` : '';

  return `${headerHtml}
  <main class="page-detail page-probing-article${enlargedFigureClass}">
    <section class="card bundle-wide-card technology-detail-hero">
      <a class="technology-back-link" href="#probing">← Back to probing methods overview</a>
      <div class="technology-detail-header">
        <div>
          <h1>${escapeHtml(detail.title)}</h1>
        </div>
        ${meta.length ? `<dl class="technology-detail-meta">${meta.join('')}</dl>` : ''}
      </div>
    </section>
    ${pptOverview}

    ${readingSection}
    ${keyInnovationOnlySection}
    ${body || hasPptOverview || keyInnovation ? '' : siblingNav}
  </main>`;
}
