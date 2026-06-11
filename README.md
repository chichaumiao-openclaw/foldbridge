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

## Local development

```bash
npm ci
npm test
npm run build
npm run verify:mvp
npm run serve -- --port 8080
```

Open `http://127.0.0.1:8080/dist/`.

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
## Included pages

- Home: project overview, bundled RNA database links, and visualization modules.
- Browse: search, facets, and result tables.
- Sequence / Structure / Probing: FoldBridge demo records and downloadable assets.

## Verification

`npm test` checks the source-level contracts. `npm run verify:mvp` checks that the built site artifacts, required themes, routes, and visualization modules are present.
