import { join, normalize, resolve, sep } from 'node:path';

export function injectReloadClient(html) {
  const client = `<script type="module">
const source = new EventSource('/__foldbridge_reload');
source.addEventListener('reload', () => window.location.reload());
</script>`;
  const text = String(html ?? '');
  if (text.includes('/__foldbridge_reload')) return text;
  if (text.includes('</body>')) return text.replace('</body>', `${client}\n  </body>`);
  return `${text}\n${client}`;
}

export function devServerUrl({ host = '127.0.0.1', port = 5173 } = {}) {
  return `http://${host}:${port}/`;
}

export function resolveStaticRequestPath(urlPath, { root, publicRootPrefixes = ['annojoin-smoke'] } = {}) {
  const rootPath = resolve(root ?? '.');
  const decoded = decodeURIComponent(String(urlPath ?? '/').split('?')[0]);
  if (decoded.split(/[\\/]+/).includes('..')) return null;

  const normalizedPath = normalize(decoded);
  const relativePath = normalizedPath.replace(/^[/\\]+/, '');
  const segments = relativePath.split(/[\\/]+/).filter(Boolean);
  const rootSegment = segments[0] || '';
  const requestPath = publicRootPrefixes.includes(rootSegment)
    ? join('public', ...segments)
    : relativePath;
  const candidate = resolve(join(rootPath, requestPath));
  if (candidate !== rootPath && !candidate.startsWith(`${rootPath}${sep}`)) return null;
  return candidate;
}
