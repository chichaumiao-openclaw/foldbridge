import {
  dataTypeCards,
  pdbCaseRows,
  getPdbCaseDetail,
  recentPublications,
  siteSummaries
} from '../data.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function tagForCase(row) {
  const title = `${row.title} ${row.organism}`.toLowerCase();
  return [
    'rna',
    'structure',
    'pdb',
    title.includes('aptamer') ? 'aptamer' : '',
    title.includes('riboswitch') ? 'riboswitch' : '',
    title.includes('virus') || title.includes('viral') ? 'viral-rna' : ''
  ].filter(Boolean);
}

export function buildSearchDocuments() {
  const pdbDocs = pdbCaseRows.map((row) => {
    const detail = getPdbCaseDetail(row.pdbId);
    const profiles = detail?.profileSummaries
      ?.map((profile) => `${profile.bundleProfileId} ${profile.rmdbUniqueId} ${profile.modifier}`)
      .join(' ');

    return {
      id: `pdb-case-${row.pdbId.toLowerCase()}`,
      type: 'pdb-case',
      title: row.title,
      href: row.detailHref,
      tags: tagForCase(row),
      summary: `${row.pdbId} ${row.title}. ${detail?.description ?? ''}`,
      content: [
        row.pdbId,
        row.title,
        row.organism,
        `projection_status ${row.projectionStatus}`,
        `identity ${row.identityPct}`,
        `query coverage ${row.queryCoveragePct}`,
        `subject coverage ${row.subjectCoveragePct}`,
        `base mismatch rows ${row.baseMismatchRows}`,
        `profiles ${row.profileCount}`,
        profiles
      ].filter(Boolean).join(' ')
    };
  });

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
