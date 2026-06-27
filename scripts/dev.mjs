import { createReadStream, readFileSync, statSync, watch } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAnnojointCurrentFilterResponse } from './lib/annojoin-atlas-export.mjs';
import { resolveAnnojointStructurePath } from './lib/annojoin-atlas-structure.mjs';
import { devServerUrl, injectReloadClient, resolveStaticRequestPath } from './lib/dev-server.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultAnnoRoot = '/Users/joseperezmartinez/docs/rmdb2pdb/task_packages/confidence_v3_restart_20260613/remote_root';
const annoRoot = process.env.FOLDBRIDGE_ANNO_ROOT || defaultAnnoRoot;
const args = new Map();

for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  const value = process.argv[i + 1];
  if (key.startsWith('--') && value && !value.startsWith('--')) {
    args.set(key.slice(2), value);
    i += 1;
  }
}

const host = args.get('host') ?? '127.0.0.1';
const port = Number(args.get('port') ?? 5173);
const annojoinIndexPath = join(root, 'src/assets/generated/annojoin-atlas/index.json');
const reloadClients = new Set();

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.pdb': 'chemical/x-pdb',
  '.cif': 'chemical/x-cif',
  '.br': 'application/octet-stream',
  '.gz': 'application/gzip',
  '.wasm': 'application/wasm',
  '.rdat': 'text/plain; charset=utf-8',
  '.xls': 'application/vnd.ms-excel'
};

function sendHtml(res, filePath) {
  const html = injectReloadClient(readFileSync(filePath, 'utf8'));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendFile(res, filePath) {
  if (extname(filePath) === '.html') {
    sendHtml(res, filePath);
    return;
  }
  const type = contentTypes[extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  createReadStream(filePath).pipe(res);
}

function sendAnnojointCurrentFilterExport(req, res) {
  const url = new URL(req.url ?? '/', devServerUrl({ host, port }));
  const params = Object.fromEntries(url.searchParams.entries());
  const indexAsset = JSON.parse(readFileSync(annojoinIndexPath, 'utf8'));
  const response = buildAnnojointCurrentFilterResponse(indexAsset, params);
  res.writeHead(response.status, response.headers);
  res.end(response.body);
}

function sendAnnojointStructure(req, res) {
  const url = new URL(req.url ?? '/', devServerUrl({ host, port }));
  const routePath = url.searchParams.get('path') || '';
  const resolved = resolveAnnojointStructurePath({ annoRoot, routePath });
  res.writeHead(200, {
    'Content-Type': 'chemical/x-cif',
    'Content-Disposition': `inline; filename="${resolved.fileName.replaceAll('"', '')}"`,
    'X-FoldBridge-Entry-Root': 'ANNOJOIN',
    'X-FoldBridge-Structure-Route': resolved.routePath
  });
  createReadStream(resolved.fullPath).pipe(res);
}

function sendReloadStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
  res.write('event: connected\ndata: ready\n\n');
  reloadClients.add(res);
  req.on('close', () => reloadClients.delete(res));
}

function broadcastReload() {
  for (const client of reloadClients) {
    client.write(`event: reload\ndata: ${Date.now()}\n\n`);
  }
}

function isGeneratedAssetReloadEvent(target, filename) {
  const changedPath = filename ? join(target, String(filename)) : target;
  return changedPath.includes(join('src', 'assets', 'generated'));
}

function watchForReloads() {
  const watchTargets = ['index.html', 'src'].map((item) => join(root, item));
  let timer = null;
  for (const target of watchTargets) {
    try {
      watch(target, { recursive: true }, (_event, filename) => {
        if (isGeneratedAssetReloadEvent(target, filename)) return;
        clearTimeout(timer);
        timer = setTimeout(broadcastReload, 80);
      });
    } catch (error) {
      console.warn(`[dev] watch unavailable for ${target}: ${error.message}`);
    }
  }
}

const server = createServer((req, res) => {
  if ((req.url ?? '').startsWith('/__foldbridge_reload')) {
    sendReloadStream(req, res);
    return;
  }

  if ((req.url ?? '').startsWith('/api/annojoin/export-current-filter')) {
    try {
      sendAnnojointCurrentFilterExport(req, res);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ error: 'annojoin_export_failed', message: error.message })}\n`);
    }
    return;
  }

  if ((req.url ?? '').startsWith('/api/annojoin/structure')) {
    try {
      sendAnnojointStructure(req, res);
    } catch (error) {
      const status = /unsafe structure_file_path/.test(error.message) ? 403 : 404;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(`${JSON.stringify({ error: 'annojoin_structure_unavailable', message: error.message })}\n`);
    }
    return;
  }

  const requestPath = req.url === '/' ? '/index.html' : req.url ?? '/index.html';
  let filePath = resolveStaticRequestPath(requestPath, { root });

  if (!filePath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stats = statSync(filePath);
    if (stats.isDirectory()) filePath = join(filePath, 'index.html');
    sendFile(res, filePath);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});

watchForReloads();
server.listen(port, host, () => {
  console.log(`FoldBridge dev server serving ${devServerUrl({ host, port })}`);
  console.log('Reloading on changes under index.html and src/.');
});
