// probingArticleView.js — RNA 探针科普文章的渲染层（纯函数，返回 HTML 字符串）。
// 复用站点既有 design tokens / card / technology-kicker 视觉语言；
// 文章正文用专门的 article-* class 控制阅读排版（行宽、行高、图注）。
//
// 两个入口：
//   renderProbingArticleIndex(index)        — 文章总览（按机制家族分组的卡片墙）
//   renderProbingArticlePage(detail, index) — 单篇阅读页（标题 + 有序 block + 图注）

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 行内 markdown：先转义，再恢复 `code` 与 **bold**。
function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_m, c) => `<code class="article-code">${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, c) => `<strong>${c}</strong>`);
  return out;
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
  const articleCount = (index && index.article_count) || 0;
  const articlesBySlug = new Map(
    families.flatMap((family) => Array.isArray(family.articles) ? family.articles : [])
      .map((article) => [article.slug, article])
  );

  const familySections = visibleFamilies.map((fam) => {
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
      <section id="probing-family-${escapeHtml(fam.id)}" class="card bundle-wide-card technology-section-card" data-probing-family="${escapeHtml(fam.id)}">
        <div class="technology-section-heading">
          <div>
            <h2>${escapeHtml(familyTitle)}</h2>
          </div>
          <p>${escapeHtml(familySummary)}</p>
        </div>
        <div class="probing-article-grid">${cards}</div>
      </section>`;
  }).join('');

  return `<main class="page-detail">
    ${headerHtml}
    <section class="card bundle-wide-card technology-hero-card">
      <div class="technology-hero-copy">
        <p class="technology-kicker">probing articles</p>
        <h1>RNA probing methods explained</h1>
        <p class="technology-intro">This collection gathers ${articleCount} in-depth explainers on RNA structure probing methods. Each one starts from the boundary that "signal is not pairing ground truth", and walks through the original figures to make clear what chemical event the method actually measures, and how it should be interpreted across FoldBridge's three layers: raw, visualization, and confidence.</p>
        <p class="technology-intro technology-intro-secondary">Browse by mechanism family first, then open any method to enter its full reading page.</p>
      </div>
      <aside class="technology-summary-panel">
        <article class="technology-summary-card">
          <p>articles</p>
          <strong>${articleCount}</strong>
          <span>in-depth probing explainers, walked through figure by figure</span>
        </article>
        <article class="technology-summary-card">
          <p>families</p>
          <strong>${visibleFamilies.length}</strong>
          <span>mechanism family groups</span>
        </article>
      </aside>
    </section>
    ${extraSectionsHtml || ''}
    ${familySections}
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
        <figcaption class="article-figure-legend">${renderInline(block.legend || '')}</figcaption>
        ${citeLine}
      </figure>
      ${bodyParas}`;
  }
  return '';
}

export function renderProbingArticlePage(detail, index, headerHtml = '') {
  const assetBase = detail.asset_base || `./src/assets/generated/probing-articles/assets/${detail.slug}`;

  // 家族归属（用于面包屑 / 上下篇导航）。
  let familyTitle = '';
  let siblings = [];
  if (index && index.families) {
    for (const fam of index.families) {
      const found = fam.articles.find((a) => a.slug === detail.slug);
      if (found) {
        familyTitle = fam.title;
        siblings = fam.articles;
        break;
      }
    }
  }

  const meta = [];
  if (detail.date) meta.push(`<div><dt>Date</dt><dd>${escapeHtml(detail.date)}</dd></div>`);
  if (familyTitle) meta.push(`<div><dt>Mechanism family</dt><dd>${escapeHtml(familyTitle)}</dd></div>`);
  if (detail.figure_count) meta.push(`<div><dt>Original figures</dt><dd>${detail.figure_count}</dd></div>`);
  if (detail.rep_doi) meta.push(`<div><dt>Primary source</dt><dd>DOI ${escapeHtml(detail.rep_doi)}</dd></div>`);

  const body = (detail.blocks || []).map((b) => renderBlock(b, assetBase)).join('\n');

  // 同家族上下篇导航。
  let siblingNav = '';
  if (siblings.length > 1) {
    const idx = siblings.findIndex((a) => a.slug === detail.slug);
    const prev = idx > 0 ? siblings[idx - 1] : null;
    const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;
    siblingNav = `
      <nav class="article-sibling-nav" aria-label="Articles in the same family">
        ${prev ? `<a class="article-sibling-link prev" href="#probing?tech=${encodeURIComponent(prev.slug)}"><span>Previous</span><strong>${escapeHtml(prev.title)}</strong></a>` : '<span class="article-sibling-spacer"></span>'}
        ${next ? `<a class="article-sibling-link next" href="#probing?tech=${encodeURIComponent(next.slug)}"><span>Next</span><strong>${escapeHtml(next.title)}</strong></a>` : '<span class="article-sibling-spacer"></span>'}
      </nav>`;
  }

  return `<main class="page-detail page-probing-article">
    ${headerHtml}
    <section class="card bundle-wide-card technology-detail-hero">
      <a class="technology-back-link" href="#probing">← Back to probing methods overview</a>
      <div class="technology-detail-header">
        <div>
          <p class="technology-kicker">${escapeHtml(familyTitle || 'probing article')}</p>
          <h1>${escapeHtml(detail.title)}</h1>
        </div>
        ${meta.length ? `<dl class="technology-detail-meta">${meta.join('')}</dl>` : ''}
      </div>
    </section>

    <article class="card bundle-wide-card article-reading-card">
      <div class="article-reading-body">
        ${body}
      </div>
      ${siblingNav}
    </article>
  </main>`;
}
