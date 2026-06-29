# FoldBridge Site

Static website for the FoldBridge RNA probing-to-structure demo. The site is plain ES modules under `src/`.

## Docker quick start

```bash
docker compose up --build
```

Open:

- Main site: `http://localhost:8081/dist/`

The Docker image installs the root package, builds the static site, and serves the repository with `scripts/serve.mjs`.

This checkout includes `.env` with the current local port. Set `FOLDBRIDGE_PORT` there if the port needs to change.

For the ANNOCONFIDENCE / ANNOJOIN Atlas route, Docker compose mounts the data
root read-only at `/annojoin-data` and serves mmCIF structures through the
local API instead of copying the structure tree into static assets. Open:

- ANNOJOIN Atlas: `http://localhost:8081/dist/#annojoin-atlas`

Use `FOLDBRIDGE_ANNO_ROOT` to point Docker at a different local mirror of the
stage package.

## Local development

```bash
npm ci
npm test
npm run build:annojoin-atlas
npm run build
npm run verify:mvp
npm run verify:annojoin-atlas -- --sample-size 20
npm run serve -- --port 8080
```

Open `http://127.0.0.1:8080/dist/`.

Search is built with Pagefind during `npm run build`. The build writes lightweight
search documents to `dist/search-docs/` and the browser search bundle to
`dist/pagefind/`.

## Fast release

```bash
npm run build:pages
```

This writes the publishable static artifact to `_site/`. GitHub Pages uses the same command through `.github/workflows/pages.yml`.

## Build outputs

Generated outputs are intentionally ignored:

- `dist/`
- `_site/`

Runtime data is kept in source control:

- `src/assets/data/`

ANNOJOIN Atlas assets under `src/assets/generated/annojoin-atlas/` are generated
from the stage package and can be large. Rebuild them with
`npm run build:annojoin-atlas`; see
[`docs/annojoin-atlas-web-handoff-20260618.md`](docs/annojoin-atlas-web-handoff-20260618.md)
for the data-entry contract, Docker mount, structure API, and verification
gates.
## Included pages

- Home: project overview, bundled RNA database links, and visualization modules.
- Browse: search, facets, and result tables.
- Sequence / Structure / Probing: FoldBridge demo records and downloadable assets.
- Search: Pagefind-backed full-site search with type/tag filters and saved queries.
- ANNOJOIN Atlas: ANNOCONFIDENCE / ANNOJOIN search, 1D/2D/3D evidence previews,
  mapped residue tables, confidence presets, conflicts, and current-filter
  downloads.

## Verification

`npm test` checks the source-level contracts. `npm run verify:mvp` checks that the built site artifacts, required themes, routes, and visualization modules are present.
