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
    .replace(/>/g, '&gt;');
}

// 行内 markdown：先转义，再恢复 `code` 与 **bold**。
function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_m, c) => `<code class="article-code">${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, c) => `<strong>${c}</strong>`);
  return out;
}

function familyAccent(id) {
  // 在主色系内做轻微区分，避免引入站点之外的颜色。
  const map = {
    dms: 'var(--primary)',
    shape: 'var(--accent)',
    'in-cell-shape': '#3a7d5d',
    footprinting: '#4a6b8a',
    'carbodiimide-special': '#8a6d3a',
    inference: '#6d4a8a',
    other: 'var(--textSecondary)'
  };
  return map[id] || 'var(--primary)';
}

// ---- 总览页 ----

export function renderProbingArticleIndex(index, headerHtml = '') {
  const families = (index && index.families) || [];
  const articleCount = (index && index.article_count) || 0;

  const familySections = families.map((fam) => {
    const cards = fam.articles.map((a) => {
      const meta = [];
      if (a.figure_count) meta.push(`${a.figure_count} figures`);
      if (a.rep_pmid) meta.push(`PMID ${escapeHtml(a.rep_pmid)}`);
      return `
        <a class="probing-article-card" href="#detail?tech=${encodeURIComponent(a.slug)}">
          <div class="probing-article-card-head">
            <h3>${escapeHtml(a.title)}</h3>
          </div>
          <p class="probing-article-card-summary">${escapeHtml(a.summary)}…</p>
          <div class="probing-article-card-meta">
            ${meta.map((m) => `<span>${m}</span>`).join('')}
          </div>
        </a>`;
    }).join('');

    return `
      <section class="card bundle-wide-card technology-section-card" data-probing-family="${escapeHtml(fam.id)}">
        <div class="technology-section-heading">
          <div>
            <p class="technology-kicker" style="color:${familyAccent(fam.id)}">${escapeHtml(fam.title)}</p>
            <h2>${escapeHtml(fam.title)}</h2>
          </div>
          <p>${escapeHtml(fam.summary)}</p>
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
          <strong>${families.length}</strong>
          <span>mechanism family groups</span>
        </article>
      </aside>
    </section>
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
        ${prev ? `<a class="article-sibling-link prev" href="#detail?tech=${encodeURIComponent(prev.slug)}"><span>Previous</span><strong>${escapeHtml(prev.title)}</strong></a>` : '<span class="article-sibling-spacer"></span>'}
        ${next ? `<a class="article-sibling-link next" href="#detail?tech=${encodeURIComponent(next.slug)}"><span>Next</span><strong>${escapeHtml(next.title)}</strong></a>` : '<span class="article-sibling-spacer"></span>'}
      </nav>`;
  }

  return `<main class="page-detail page-probing-article">
    ${headerHtml}
    <section class="card bundle-wide-card technology-detail-hero">
      <a class="technology-back-link" href="#detail">← Back to probing methods overview</a>
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
