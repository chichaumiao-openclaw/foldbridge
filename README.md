# Web Template MVP Example

Runnable visual-review example for the unified scientific database frontend.

## Included pages
- **Home**: project overview + animated stats + aptamer-style search + visualization modules.
- **Browse**: global search + facets + result table.
- **Detail**: entity overview + evidence + provenance sections.

## Current feature highlights
- Hash routes in `src/main.js`: `#home`, `#browse`, `#detail`.
- **3 required site themes** + Light/Dark mode:
  - RiboCentre Blue, Riboswitch Teal-Green, Aptamer Purple-Indigo
- Aptamer-style statistics dashboard module:
  - clickable **Year bar chart**
  - clickable **Category pie chart**
  - filter tags/reset/export + filtered data table/summary
- Mol* 3D viewer block with local test PDB path support (`/src/assets/pdb/8k7w_RNA_only.pdb`).
- Forna-based secondary structure module.
- Black top nav + black footer.

---

## ✅ Run with `python3 -m http.server 8080` (recommended)

> Do **not** open `dist/index.html` directly with `file://`.

### 1) Build main template
```bash
cd /Users/macmini/coding/web_template
npm install
npm test
npm run build
npm run verify:mvp
```

### 2) Build single-cell React viewer + local data
```bash
cd /Users/macmini/coding/web_template/singlecell-viewer
npm install
python3 data_setup.py --n-cells 10000
npm run build
```

### 2.1) Convert real h5ad to static JSON/columnar files (GitHub Pages mode)
```bash
cd /Users/macmini/coding/web_template/singlecell-viewer
# converts /Users/macmini/coding/data/pbmc3k.h5ad into static files under public/data/
npm run convert:data
npm run validate:h5ad
npm run build
```
Generated artifacts:
- `public/data/umap_columns.json` (columnar x/y + selected obs metadata)
- `public/data/metadata.json` (obs schema + default color field + full gene index from var_names)
- `public/data/gene_expr/<GENE>.json` (lazy single-gene vectors loaded on demand)

Behavior (no backend required):
- base view loads local static UMAP columns
- gene search uses static `metadata.json` gene index
- selecting a gene loads local static vector file from `data/gene_expr/`
- numeric obs and gene expression both use viridis-like gradient
- categorical obs use stable category colors

### 3) Serve everything from web_template root
```bash
cd /Users/macmini/coding/web_template
python3 -m http.server 8080
```

### 4) Open in browser
- Main template: `http://localhost:8080/dist/`
- Single-cell viewer: `http://localhost:8080/singlecell-viewer/dist/`

---

## Single-cell viewer (React + Deck.gl)
Location: `singlecell-viewer/`

- `src/App.jsx` — main state/data loading + coordinated layout
- `src/AnatomicalMap.jsx` — clickable respiratory SVG map
- `src/SingleCellPlot.jsx` — WebGL UMAP scatterplot (Deck.gl / OrthographicView)
- `public/data/umap_columns.json` — local UMAP columns + obs metadata
- `public/data/metadata.json` — local metadata schema + gene index + default color field
- `public/data/gene_expr/*.json` — per-gene expression vectors loaded lazily
- `validate_h5ad_loader.py` — validation script for selective single-gene fetch + fallback color logic

---

## Data stewardship artifacts
- Schema/provenance contract: `docs/data-stewardship/schema-provenance-contract.md`
- Validation checklist: `docs/data-stewardship/validation-checklist.md`

## Notes
- Placeholder scientific content is synthetic and intended only for UI validation.
- Shared placeholder datasets live in `src/data.js` for deterministic visual review.
- Repro metadata: `DATA_VERSION` and `DETERMINISTIC_SEED` are exported from `src/data.js` and validated in tests.
- Main build output: `dist/` (local build artifact, ignored by Git)
- Single-cell viewer build output: `singlecell-viewer/dist/` (local build artifact, ignored by Git)
- Large local datasets and archived build outputs should live under `local_archive/` instead of the repo root.
