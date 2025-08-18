import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

const requiredFiles = [
  'src/main.js',
  'src/theme.js',
  'src/modules.js',
  'README.md',
  'dist/index.html',
  'dist/search-docs/manifest.json',
  'dist/pagefind/pagefind.js',
  'src/assets/generated/rmdb-pdb-cases/index.json',
  'src/assets/generated/rmdb-pdb-cases/manifest.json',
  'dist/src/assets/generated/rmdb-pdb-cases/index.json'
];

for (const rel of requiredFiles) {
  const p = resolve(root, rel);
  if (!existsSync(p)) {
    console.error(`Missing required artifact: ${rel}`);
    process.exit(1);
  }
}

const themeSource = readFileSync(resolve(root, 'src/theme.js'), 'utf8');
const pageSource = readFileSync(resolve(root, 'src/main.js'), 'utf8');
const moduleSource = readFileSync(resolve(root, 'src/modules.js'), 'utf8');

const requiredThemes = ['ribocentre', 'riboswitch', 'aptamer'];
for (const t of requiredThemes) {
  if (!themeSource.includes(`${t}:`) && !themeSource.includes(`'${t}'`) && !themeSource.includes(`"${t}"`)) {
    console.error(`Missing required theme token: ${t}`);
    process.exit(1);
  }
}

const requiredRoutes = ['home', 'browse', 'detail', 'search'];
for (const route of requiredRoutes) {
  const routeRegex = new RegExp(`['\"]${route}['\"]`, 'i');
  if (!routeRegex.test(pageSource)) {
    console.error(`Missing required page route/content for: ${route}`);
    process.exit(1);
  }
}

const requiredModules = ['V-MULTISELECT-001', 'V-RNA3D-001', 'V-SECONDARY-001'];
for (const moduleId of requiredModules) {
  if (!moduleSource.includes(moduleId)) {
    console.error(`Missing required visualization module: ${moduleId}`);
    process.exit(1);
  }
}

// RMDB→PDB case 资产接线校验：主流程必须经 store 懒加载生成资产（而非手写 demo）。
if (!pageSource.includes('createCaseStore')) {
  console.error('Missing RMDB case wiring: src/main.js must use createCaseStore from rmdbCaseStore.js');
  process.exit(1);
}

// 生成资产清单校验：每个资产带 path/size_bytes/sha256，且无文件触及 100MiB 硬上限。
const manifestPath = resolve(root, 'src/assets/generated/rmdb-pdb-cases/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
  console.error('Generated manifest has no assets. Run npm run build:rmdb-cases with the data volume mounted.');
  process.exit(1);
}
const HARD_LIMIT = 100 * 1024 * 1024;
for (const asset of manifest.assets) {
  if (!asset.path || typeof asset.size_bytes !== 'number' || !asset.sha256) {
    console.error(`Generated manifest asset missing provenance fields: ${JSON.stringify(asset)}`);
    process.exit(1);
  }
  if (asset.size_bytes >= HARD_LIMIT) {
    console.error(`Generated asset exceeds 100MiB hard limit: ${asset.path} (${asset.size_bytes} bytes)`);
    process.exit(1);
  }
}

// 索引与清单 schema 版本一致性。
const generatedIndex = JSON.parse(
  readFileSync(resolve(root, 'src/assets/generated/rmdb-pdb-cases/index.json'), 'utf8')
);
if (!Array.isArray(generatedIndex.cases) || generatedIndex.cases.length === 0) {
  console.error('Generated index.json has no cases.');
  process.exit(1);
}
if (generatedIndex.schema_version !== manifest.schema_version) {
  console.error(
    `Schema version mismatch: index=${generatedIndex.schema_version} manifest=${manifest.schema_version}`
  );
  process.exit(1);
}

console.log('MVP regression guard passed: themes/pages/modules/search/dist artifacts are present.');
