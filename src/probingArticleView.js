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
      if (a.figure_count) meta.push(`${a.figure_count} 图`);
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
        <h1>RNA 探针技术科普</h1>
        <p class="technology-intro">这里收录了 ${articleCount} 篇 RNA 结构探针方法的科普长文。每篇都从“信号不是配对真值”这条边界出发，逐张原文配图讲清楚该方法到底测了什么化学事件，以及它在 FoldBridge 的 raw / 可视化 / confidence 三层里应该怎么被解释。</p>
        <p class="technology-intro technology-intro-secondary">先按机制家族浏览，再点开任意方法进入完整阅读页。</p>
      </div>
      <aside class="technology-summary-panel">
        <article class="technology-summary-card">
          <p>articles</p>
          <strong>${articleCount}</strong>
          <span>篇逐图讲解的探针科普长文</span>
        </article>
        <article class="technology-summary-card">
          <p>families</p>
          <strong>${families.length}</strong>
          <span>个机制家族分组</span>
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
  if (detail.date) meta.push(`<div><dt>日期</dt><dd>${escapeHtml(detail.date)}</dd></div>`);
  if (familyTitle) meta.push(`<div><dt>机制家族</dt><dd>${escapeHtml(familyTitle)}</dd></div>`);
  if (detail.figure_count) meta.push(`<div><dt>原文配图</dt><dd>${detail.figure_count} 张</dd></div>`);
  if (detail.rep_doi) meta.push(`<div><dt>主要来源</dt><dd>DOI ${escapeHtml(detail.rep_doi)}</dd></div>`);

  const body = (detail.blocks || []).map((b) => renderBlock(b, assetBase)).join('\n');

  // 同家族上下篇导航。
  let siblingNav = '';
  if (siblings.length > 1) {
    const idx = siblings.findIndex((a) => a.slug === detail.slug);
    const prev = idx > 0 ? siblings[idx - 1] : null;
    const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;
    siblingNav = `
      <nav class="article-sibling-nav" aria-label="同家族文章导航">
        ${prev ? `<a class="article-sibling-link prev" href="#detail?tech=${encodeURIComponent(prev.slug)}"><span>上一篇</span><strong>${escapeHtml(prev.title)}</strong></a>` : '<span class="article-sibling-spacer"></span>'}
        ${next ? `<a class="article-sibling-link next" href="#detail?tech=${encodeURIComponent(next.slug)}"><span>下一篇</span><strong>${escapeHtml(next.title)}</strong></a>` : '<span class="article-sibling-spacer"></span>'}
      </nav>`;
  }

  return `<main class="page-detail page-probing-article">
    ${headerHtml}
    <section class="card bundle-wide-card technology-detail-hero">
      <a class="technology-back-link" href="#detail">← 返回探针技术总览</a>
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
