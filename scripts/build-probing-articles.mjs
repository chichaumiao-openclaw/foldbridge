#!/usr/bin/env node
// build-probing-articles.mjs — 薄 IO 壳：读 rna-probing-writing 仓库的 27 篇科普文章
// (markdown + paper figure manifest) → 解析为结构化 JSON + 复制图像 →
// 写 src/assets/generated/probing-articles/（index.json + 每篇 <slug>.json + assets/<slug>/*）。
//
// 数据源为 build-time 本地输入；源目录缺失时报清晰错误并退出（NO_FALLBACK）。
// 不修改任何上游文章或 manifest（只读）。

import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WRITING_ROOT = process.env.RNA_PROBING_WRITING_ROOT
  || path.resolve(process.env.HOME || '', 'docs/rna-probing-writing');
const TECH_ROOT = path.join(WRITING_ROOT, 'technologies');
const OUT_ROOT = path.resolve(__dirname, '../src/assets/generated/probing-articles');

const SCHEMA_VERSION = 'probing-articles.v1';
const SMOKE_EXCLUDE = 'smoke'; // 排除 dms/smoke 测试残留

// 机制家族分组（用于 index 页面，与 main.js technologyCategories 口径一致）。
const FAMILY_ORDER = [
  {
    id: 'dms',
    title: 'DMS 化学探针',
    summary: 'DMS 在 A 的 N1、C 的 N3 配对面留下甲基化修饰，读出 A/C 可及性。',
    slugs: ['dms', 'dms-seq', 'mod-seq', 'structure-seq', 'structure-seq2', 'dim-2p-seq']
  },
  {
    id: 'shape',
    title: 'SHAPE 2′-OH 酰化',
    summary: 'SHAPE 试剂酰化核糖 2′-OH，读出主链柔性 / 单链程度。',
    slugs: ['shape-reagents', 'shape-map', 'shape-2a3', 'nai-map', 'smartshape', 'chemmodseq']
  },
  {
    id: 'in-cell-shape',
    title: 'In-cell / 共转录 SHAPE',
    summary: '把 SHAPE/酰化探测搬进活细胞、细胞核或共转录场景。',
    slugs: ['icshape', 'icshape-map', 'nuc-shape-structure-seq', 'cotranscriptional-shape-seq', 'iclaser']
  },
  {
    id: 'footprinting',
    title: '羟自由基 / 酶切 footprinting',
    summary: '羟自由基或核酸酶切割，读出主链溶剂可及性或 ss/ds 状态。',
    slugs: ['hrf-seq', 'rl-seq', 'pars', 'parte', 'lead-seq']
  },
  {
    id: 'carbodiimide-special',
    title: 'Carbodiimide 与特殊化学',
    summary: 'CMC/CMCT 读 U/G 配对面，kethoxal 读 G，以及其它专门化学。',
    slugs: ['cmc-cmct', 'keth-seq', 'tnet-mapseq']
  },
  {
    id: 'inference',
    title: '突变 / 邻近推断法',
    summary: 'M² 突变扰动与 MCA 邻近图：配对/接触是推断出来的，不是直接测量。',
    slugs: ['mutate-and-map', 'mca']
  }
];

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 行内 markdown：`code`、**bold**、反引号代码。先转义，再恢复标记。
function renderInline(text) {
  let out = escapeHtml(text);
  // inline code `...`
  out = out.replace(/`([^`]+)`/g, (_m, c) => `<code class="article-code">${c}</code>`);
  // bold **...**
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, c) => `<strong>${c}</strong>`);
  return out;
}

async function findArticleFile(slug, genDir) {
  const files = await readdir(genDir);
  const md = files.find((f) => f.endsWith('-article.md'));
  if (!md) throw new Error(`[probing-articles] ${slug}: 找不到 *-article.md`);
  return path.join(genDir, md);
}

async function findManifestFile(slug, genDir) {
  const files = await readdir(genDir);
  const man = files.find((f) => f.endsWith('_paper_figure_manifest.json'));
  if (!man) throw new Error(`[probing-articles] ${slug}: 找不到 *_paper_figure_manifest.json`);
  return path.join(genDir, man);
}

// 把一篇文章 markdown 解析为有序 block 列表。
// 识别：H1 标题、日期行、H2 小节、figure 三元组(<a id> + ![] + **图...** legend)、普通段落。
function parseArticle(md, manifestFigures) {
  const figByAnchor = new Map();
  for (const f of manifestFigures) {
    if (f.article_anchor) figByAnchor.set(f.article_anchor, f);
  }

  const lines = md.split('\n');
  const blocks = [];
  let title = '';
  let date = '';
  let i = 0;
  let pendingAnchor = null;

  // 收集后续连续非空行为一个段落
  function flushParagraph(startIdx) {
    const buf = [];
    let j = startIdx;
    while (j < lines.length && lines[j].trim() !== '' && !lines[j].startsWith('#')
      && !lines[j].startsWith('<a id=') && !lines[j].startsWith('![')) {
      buf.push(lines[j]);
      j++;
    }
    return { text: buf.join(' ').trim(), next: j };
  }

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (line === '') { i++; continue; }

    // H1 标题
    if (line.startsWith('# ') && !title) {
      title = line.slice(2).trim();
      i++;
      continue;
    }
    // 日期
    if (/^日期[:：]/.test(line)) {
      date = line.replace(/^日期[:：]\s*/, '').trim();
      i++;
      continue;
    }
    // H2 小节
    if (line.startsWith('## ')) {
      blocks.push({ type: 'heading', text: line.slice(3).trim() });
      i++;
      continue;
    }
    // figure anchor
    const anchorMatch = line.match(/^<a id="([^"]+)"><\/a>$/);
    if (anchorMatch) {
      pendingAnchor = anchorMatch[1];
      i++;
      continue;
    }
    // image line ![alt](path)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1];
      const srcPath = imgMatch[2]; // e.g. assets/xxx.jpg
      const fig = pendingAnchor ? figByAnchor.get(pendingAnchor) : null;
      // 紧接着应有一段 **图 N。...** legend 段落
      let legend = '';
      let body = [];
      let j = i + 1;
      // skip blanks
      while (j < lines.length && lines[j].trim() === '') j++;
      // legend paragraph (starts with **图 or **)
      if (j < lines.length && lines[j].trim().startsWith('**')) {
        const para = flushParagraph(j);
        legend = para.text;
        j = para.next;
      }
      // following interpretive paragraphs until next structural marker
      while (j < lines.length) {
        while (j < lines.length && lines[j].trim() === '') j++;
        if (j >= lines.length) break;
        const t = lines[j].trim();
        if (t.startsWith('#') || t.startsWith('<a id=') || t.startsWith('![')) break;
        const para = flushParagraph(j);
        if (para.text) body.push(para.text);
        j = para.next;
      }
      blocks.push({
        type: 'figure',
        anchor: pendingAnchor,
        alt,
        srcBasename: path.basename(srcPath),
        legend,
        body,
        label: fig ? fig.label : '',
        pmid: fig ? fig.pmid : '',
        pmcid: fig ? fig.pmcid : '',
        doi: fig ? fig.doi : '',
        figureId: fig ? fig.figure_id : '',
        legendText: fig ? fig.legend_text : ''
      });
      pendingAnchor = null;
      i = j;
      continue;
    }
    // 普通段落
    const para = flushParagraph(i);
    if (para.text) blocks.push({ type: 'paragraph', text: para.text });
    i = para.next > i ? para.next : i + 1;
  }

  return { title, date, blocks };
}

// 从首两段提取卡片摘要（去掉行内标记）。
function plainText(s) {
  return String(s).replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
}

// ---- main IO ----

async function buildOne(slug, genDir) {
  const artPath = await findArticleFile(slug, genDir);
  const manPath = await findManifestFile(slug, genDir);
  const md = await readFile(artPath, 'utf8');
  const manifest = JSON.parse(await readFile(manPath, 'utf8'));
  const figures = manifest.figures || [];

  const parsed = parseArticle(md, figures);
  if (!parsed.title) throw new Error(`[probing-articles] ${slug}: 未解析到标题`);

  // 复制图像到输出 assets/<slug>/，校验 sha256 与 manifest 一致。
  const assetsOut = path.join(OUT_ROOT, 'assets', slug);
  await mkdir(assetsOut, { recursive: true });
  const figureBlocks = parsed.blocks.filter((b) => b.type === 'figure');
  for (const fb of figureBlocks) {
    const srcImg = path.join(genDir, 'assets', fb.srcBasename);
    if (!existsSync(srcImg)) {
      throw new Error(`[probing-articles] ${slug}: 图像缺失 ${srcImg}（NO_FALLBACK）`);
    }
    const bytes = await readFile(srcImg);
    const manFig = figures.find((f) => f.local_image_path && path.basename(f.local_image_path) === fb.srcBasename);
    if (manFig && manFig.image_sha256 && manFig.image_sha256 !== sha256Hex(bytes)) {
      throw new Error(`[probing-articles] ${slug}: ${fb.srcBasename} sha256 与 manifest 不符`);
    }
    await writeFile(path.join(assetsOut, fb.srcBasename), bytes);
  }

  // 卡片摘要 = 首个 paragraph 的前 90 字（去标记）。
  const firstPara = parsed.blocks.find((b) => b.type === 'paragraph');
  const summary = firstPara ? plainText(firstPara.text).slice(0, 90) : '';

  // 顶层引用元数据（取首个 figure 的 pmid/doi 作为代表）。
  const repFig = figureBlocks[0] || {};

  const detail = {
    schema_version: SCHEMA_VERSION,
    slug,
    title: parsed.title,
    date: parsed.date,
    figure_count: figureBlocks.length,
    rep_pmid: repFig.pmid || '',
    rep_pmcid: repFig.pmcid || '',
    rep_doi: repFig.doi || '',
    asset_base: `./src/assets/generated/probing-articles/assets/${slug}`,
    blocks: parsed.blocks
  };

  await writeFile(
    path.join(OUT_ROOT, `${slug}.json`),
    JSON.stringify(detail, null, 2) + '\n',
    'utf8'
  );

  return {
    slug,
    title: parsed.title,
    date: parsed.date,
    summary,
    figure_count: figureBlocks.length,
    section_count: parsed.blocks.filter((b) => b.type === 'heading').length,
    rep_pmid: repFig.pmid || '',
    rep_doi: repFig.doi || ''
  };
}

async function discoverSlugs() {
  const entries = await readdir(TECH_ROOT, { withFileTypes: true });
  const slugs = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('_')) continue; // _inventory
    if (e.name.startsWith('expert_review_package')) continue;
    const genDir = path.join(TECH_ROOT, e.name, 'generated');
    if (!existsSync(genDir)) continue;
    const files = await readdir(genDir);
    if (!files.some((f) => f.endsWith('-article.md'))) continue;
    slugs.push(e.name);
  }
  return slugs.sort();
}

async function main() {
  if (!existsSync(TECH_ROOT)) {
    console.error(`[probing-articles] 源目录不存在: ${TECH_ROOT}\n设置 RNA_PROBING_WRITING_ROOT 指向 rna-probing-writing 仓库。`);
    process.exit(1);
  }

  await rm(OUT_ROOT, { recursive: true, force: true });
  await mkdir(OUT_ROOT, { recursive: true });

  const slugs = await discoverSlugs();
  const cards = [];
  for (const slug of slugs) {
    const genDir = path.join(TECH_ROOT, slug, 'generated');
    const card = await buildOne(slug, genDir);
    cards.push(card);
    console.log(`  ✓ ${slug} (${card.figure_count} figs, ${card.section_count} sections)`);
  }

  const cardBySlug = new Map(cards.map((c) => [c.slug, c]));
  const families = FAMILY_ORDER.map((fam) => ({
    id: fam.id,
    title: fam.title,
    summary: fam.summary,
    articles: fam.slugs
      .filter((s) => cardBySlug.has(s))
      .map((s) => cardBySlug.get(s))
  })).filter((fam) => fam.articles.length > 0);

  // 兜底：任何未归入家族的 slug 单列 "其它"。
  const grouped = new Set(FAMILY_ORDER.flatMap((f) => f.slugs));
  const leftover = cards.filter((c) => !grouped.has(c.slug));
  if (leftover.length) {
    families.push({ id: 'other', title: '其它方法', summary: '尚未归入家族的探针方法。', articles: leftover });
  }

  const index = {
    schema_version: SCHEMA_VERSION,
    generated_at_utc: new Date().toISOString(),
    article_count: cards.length,
    family_count: families.length,
    families,
    articles: cards
  };

  await writeFile(
    path.join(OUT_ROOT, 'index.json'),
    JSON.stringify(index, null, 2) + '\n',
    'utf8'
  );

  console.log(`\n[probing-articles] 完成：${cards.length} 篇文章，${families.length} 个家族 → ${OUT_ROOT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
