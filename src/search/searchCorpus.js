import { readFileSync } from 'node:fs';

const GENERATED_CASES_BASE = new URL('../assets/generated/rmdb-pdb-cases/', import.meta.url);
const PROBING_ARTICLES_BASE = new URL('../assets/generated/probing-articles/', import.meta.url);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readGeneratedJson(relPath) {
  return JSON.parse(readFileSync(new URL(relPath, GENERATED_CASES_BASE), 'utf8'));
}

function tagForCase(row) {
  const title = `${row.title} ${row.subtitle ?? ''}`.toLowerCase();
  return [
    'rna',
    'structure',
    'pdb',
    title.includes('aptamer') ? 'aptamer' : '',
    title.includes('riboswitch') ? 'riboswitch' : '',
    title.includes('virus') || title.includes('viral') ? 'viral-rna' : ''
  ].filter(Boolean);
}

// pdb-case 文档来自构建期生成的 index.json（轻量索引）+ 每个 case.json（科学口径字段）。
// 生成资产缺失时（外接卷未挂载且未提交）静默降级为空集，搜索语料仍可构建。
function buildPdbCaseDocs() {
  let index;
  try {
    index = readGeneratedJson('index.json');
  } catch {
    return [];
  }
  return (index.cases || []).map((row) => {
    let detail = null;
    try {
      detail = readGeneratedJson(`cases/${row.pdbId}/case.json`);
    } catch {
      detail = null;
    }
    const reactivityKeys = (detail?.reactivity || [])
      .map((entry) => `${entry.profileId} ${entry.profileKey}`)
      .join(' ');

    return {
      id: `pdb-case-${row.pdbId.toLowerCase()}`,
      type: 'pdb-case',
      title: row.title,
      href: row.detailHref,
      tags: tagForCase(row),
      summary: `${row.pdbId} ${row.title}. ${row.subtitle ?? ''}`.trim(),
      content: [
        row.pdbId,
        row.pdbReferenceId,
        row.title,
        row.subtitle,
        `confidence ${row.confidenceClass} ${row.confidenceScore}`,
        `projection_status ${detail?.projectionStatus ?? ''}`,
        `identity ${detail?.identityPct ?? ''}`,
        `query coverage ${detail?.queryCoveragePct ?? ''}`,
        `subject coverage ${detail?.subjectCoveragePct ?? ''}`,
        `base mismatch rows ${detail?.baseMismatchRows ?? ''}`,
        `profiles ${row.profileCount}`,
        reactivityKeys
      ].filter((part) => part != null && String(part).trim() !== '').join(' ')
    };
  });
}

function buildProbingArticleDocs() {
  let index;
  try {
    index = JSON.parse(readFileSync(new URL('index.json', PROBING_ARTICLES_BASE), 'utf8'));
  } catch {
    return [];
  }
  const slugToFamily = {};
  for (const family of index.families || []) {
    for (const art of family.articles || []) {
      slugToFamily[art.slug] = { id: family.id, title: family.title };
    }
  }
  return (index.articles || []).map((art) => {
    const fam = slugToFamily[art.slug] || { id: 'probing', title: '' };
    return {
      id: `probing-article-${art.slug}`,
      type: 'probing-article',
      title: art.title,
      href: `#detail?tech=${art.slug}`,
      tags: ['probing', fam.id].filter(Boolean),
      summary: art.summary || '',
      content: [art.title, art.summary, fam.title].filter(Boolean).join(' ')
    };
  });
}

export function buildSearchDocuments() {
  return [...buildPdbCaseDocs(), ...buildProbingArticleDocs()];
}

export function renderSearchDocumentHtml(doc) {
  const tags = (doc.tags ?? [])
    .map((tag) => `<span data-pagefind-filter="tag:${escapeHtml(tag)}"></span>`)
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(doc.title)}</title>
  </head>
  <body>
    <main
      data-pagefind-body
      data-pagefind-filter="type:${escapeHtml(doc.type)}"
      data-pagefind-meta="href:${escapeHtml(doc.href)}"
    >
      ${tags}
      <span data-pagefind-meta="type:${escapeHtml(doc.type)}"></span>
      <span data-pagefind-meta="tags:${escapeHtml((doc.tags ?? []).join(','))}"></span>
      <h1 data-pagefind-meta="title">${escapeHtml(doc.title)}</h1>
      <p>${escapeHtml(doc.summary)}</p>
      <p>${escapeHtml(doc.content)}</p>
    </main>
  </body>
</html>
`;
}
