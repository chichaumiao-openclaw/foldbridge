import { readFileSync } from 'node:fs';
import {
  dataTypeCards,
  recentPublications,
  siteSummaries
} from '../data.js';

const GENERATED_CASES_BASE = new URL('../assets/generated/rmdb-pdb-cases/', import.meta.url);

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

export function buildSearchDocuments() {
  const pdbDocs = buildPdbCaseDocs();

  const dataTypeDocs = dataTypeCards.map((card) => ({
    id: `data-type-${card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: 'data-type',
    title: card.name,
    href: '#browse',
    tags: ['data', 'probing', 'technology'],
    summary: card.desc,
    content: `${card.name} ${card.desc} ${card.count}`
  }));

  const siteDocs = siteSummaries.map((site) => ({
    id: `site-${site.site.toLowerCase()}`,
    type: 'site',
    title: site.site,
    href: '#home',
    tags: ['database', 'portal'],
    summary: site.scope,
    content: `${site.site} ${site.scope} records ${site.records}`
  }));

  const publicationDocs = recentPublications.map((paper) => ({
    id: `publication-${paper.doi.replace(/[^a-z0-9]+/gi, '-')}`,
    type: 'publication',
    title: paper.title,
    href: '#publications',
    tags: ['publication', 'reference'],
    summary: `${paper.year} ${paper.doi}`,
    content: `${paper.title} ${paper.doi} ${paper.year}`
  }));

  const technologyDocs = [
    {
      id: 'technology-shape',
      type: 'technology',
      title: 'SHAPE probing',
      href: '#detail?tech=shape',
      tags: ['technology', 'probing', 'structure'],
      summary: '2-OH acylation workflows for RNA flexibility and structure probing.',
      content: 'SHAPE SHAPE-MaP NAI-MaP icSHAPE smartSHAPE chemical probing RNA structure'
    },
    {
      id: 'technology-dms',
      type: 'technology',
      title: 'DMS probing',
      href: '#detail?tech=dms-seq',
      tags: ['technology', 'probing', 'accessibility'],
      summary: 'DMS-based probing for base accessibility and transcriptome-scale structure readouts.',
      content: 'DMS DMS-seq DMS-MaPseq Structure-seq CIRS-seq RNA accessibility probing'
    },
    {
      id: 'technology-enzymatic',
      type: 'technology',
      title: 'Enzymatic probing',
      href: '#detail?tech=pars',
      tags: ['technology', 'probing'],
      summary: 'RNase and enzymatic probing workflows for single-strand and double-strand accessibility.',
      content: 'PARS PARTE tNet-RNase-seq enzymatic RNase RNA structure probing'
    }
  ];

  return [...pdbDocs, ...dataTypeDocs, ...siteDocs, ...publicationDocs, ...technologyDocs];
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
