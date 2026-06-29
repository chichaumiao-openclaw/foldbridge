import { existsSync } from 'node:fs';
import path from 'node:path';

export function normalizeStructureRoutePath(routePath) {
  const normalized = path.posix.normalize(String(routePath || '').replaceAll('\\', '/'));
  if (!normalized || normalized === '.' || normalized.startsWith('../') || path.isAbsolute(normalized)) {
    throw new Error(`[annojoin-structure] unsafe structure_file_path: ${routePath}`);
  }
  return normalized;
}

export function buildAnnojointStructureUrl(routePath) {
  const normalized = normalizeStructureRoutePath(routePath);
  return `/api/annojoin/structure?path=${encodeURIComponent(normalized)}`;
}

export function resolveAnnojointStructurePath({ annoRoot, routePath } = {}) {
  const root = path.resolve(String(annoRoot || ''));
  const normalized = normalizeStructureRoutePath(routePath);
  const candidates = [path.resolve(root, normalized)];
  if (normalized.startsWith('CONFIDENCE/')) {
    candidates.push(path.resolve(root, normalized.slice('CONFIDENCE/'.length)));
  }

  for (const candidate of candidates) {
    if ((candidate === root || candidate.startsWith(`${root}${path.sep}`)) && existsSync(candidate)) {
      return {
        routePath: normalized,
        fullPath: candidate,
        fileName: path.basename(candidate)
      };
    }
  }

  throw new Error(`[annojoin-structure] structure_file_path not found: ${normalized}`);
}
