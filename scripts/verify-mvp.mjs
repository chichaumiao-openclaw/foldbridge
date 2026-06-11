import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

const requiredFiles = [
  'src/main.js',
  'src/theme.js',
  'src/modules.js',
  'README.md',
  'dist/index.html'
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

const requiredRoutes = ['home', 'browse', 'detail'];
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

console.log('MVP regression guard passed: themes/pages/modules/dist artifacts are present.');
