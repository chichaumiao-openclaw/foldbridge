import { readFileSync } from 'node:fs';
import { moleculeName, rowCaseId, rowCaseKey } from '../annojoinAtlasTableModel.js';

const ANNOJOIN_ATLAS_BASE = new URL('../assets/generated/annojoin-atlas/', import.meta.url);
const PROBING_ARTICLES_BASE = new URL('../assets/generated/probing-articles/', import.meta.url);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cleanToken(value) {
  const token = String(value ?? '').trim();
  return ['', '未注释', 'not annotated', 'missing source'].includes(token) ? '' : token;
}

function caseDocId(caseKey, caseId) {
  const raw = String(caseKey || caseId || '').trim().toLowerCase();
  return `pdb-case-${raw.replace(/[^0-9a-z]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

// 详情链接走站内 hash 路由 #annojoin-case。Atlas case 资产对每个 displayCase 都存在
// （cases/<atlasCaseKey>.json），因此该路由对所有 case 可解析——区别于只有部分 case
// 才物化的 public/<universe>/cases 静态页（静态页缺失时会 404）。
function caseDetailHref(caseId, caseKey) {
  const query = new URLSearchParams();
  if (caseId) query.set('caseId', caseId);
  if (caseKey && caseKey !== caseId) query.set('caseKey', caseKey);
  const suffix = query.toString();
  return `#annojoin-case${suffix ? `?${suffix}` : ''}`;
}

function tagForCase(row) {
  const structureClass = cleanToken(row.structureClass).toLowerCase();
  return [
    'rna',
    'structure',
    'pdb',
    cleanToken(row.assetFamily).toLowerCase(),
    structureClass.replace(/\s+/g, '-')
  ].filter(Boolean);
}

// pdb-case 文档来自新的 annojoin-atlas index.json（displayCases，链身份口径）。
// 资产缺失时静默降级为空集，搜索语料仍可构建。
// 标题/摘要/正文各司其职、互不重复：title=分子名，summary=PDB+结构类别，
// content=可检索 token（PDB id、RNA family、motif、assay 等），避免 pagefind 摘要堆叠。
function buildPdbCaseDocs() {
  let index;
  try {
    index = JSON.parse(readFileSync(new URL('index.json', ANNOJOIN_ATLAS_BASE), 'utf8'));
  } catch {
    return [];
  }
  return (index.displayCases || []).map((row) => {
    const caseId = rowCaseId(row);
    const caseKey = rowCaseKey(row);
    const title = moleculeName(row);
    const structureClass = cleanToken(row.structureClass);
    const rnaFamily = cleanToken(row.rnaFamily);
    const summaryParts = [caseId ? `PDB ${caseId}` : '', structureClass || rnaFamily].filter(Boolean);
    const contentTokens = [
      caseId,
      cleanToken(row.pdbId),
      cleanToken(row.assetFamily),
      rnaFamily,
      cleanToken(row.motif),
      structureClass,
      ...(Array.isArray(row.assayFamilies) ? row.assayFamilies.map(cleanToken) : []),
      ...(Array.isArray(row.sourceDatabases) ? row.sourceDatabases.map(cleanToken) : []),
      row.profileCount ? `profiles ${row.profileCount}` : ''
    ].filter((part) => part != null && String(part).trim() !== '');
    return {
      id: caseDocId(caseKey, caseId),
      type: 'pdb-case',
      title,
      href: caseDetailHref(caseId, caseKey),
      tags: tagForCase(row),
      summary: summaryParts.join(' · '),
      content: [...new Set(contentTokens)].join(' ')
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
