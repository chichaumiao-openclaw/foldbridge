# Detail-page unified nav header — design

Date: 2026-06-30
Branch: release-public (worktree `~/docs/foldbridge-release`, baseline HEAD `6613730bb`)
Status: approved design, pending spec-review + implementation

## Problem

FoldBridge has two independent front-ends that do not share chrome:

1. **Main portal SPA** (`/index.html` → `src/main.js`): vanilla-JS, hash routing, has a
   full header + primary nav (`renderBundleHeader` / `renderPrimaryNav` in `src/`).
2. **Detail static site** (`public/rasp-v3/`, `public/rmdb-v3/`): pre-materialized
   static HTML trees with their own `case-shell.css` / `case-shell.js`. **No header or
   nav at all** — the top of every detail page is `<section class="hero">`. A user on a
   detail page has no way back to the portal home or entry table.

Goal: give the detail pages a unified header + nav consistent with the portal, so the
whole site shares one look and provides navigation home.

## Scope

In scope (per user decision):
- Top-level **case pages**: `public/rasp-v3/cases/*/index.html`,
  `public/rmdb-v3/cases/*/index.html` (1671+ rasp + N rmdb files).
- **Case-list pages** (2 files): `public/rasp-v3/index.html`, `public/rmdb-v3/index.html`.

Out of scope:
- The iframe-embedded chain workbench pages (`cases/*/chains/*/index.html`). Adding nav
  inside the embedded viewport would duplicate chrome and steal vertical space.

## Verified baseline facts (release-public `6613730bb`)

- Case pages load shared CSS + JS:
  `<link rel="stylesheet" href="../../__rasp_v3_site__/case-shell.css">` in `<head>`,
  `<script src="../../__rasp_v3_site__/case-shell.js"></script>` before `</body>`.
  Body opens with `<main class="shell"> <section class="hero">`.
- `case-shell.js` is a **plain top-level script** (not an ES module, 63 lines), runs at
  parse time. It can append DOM. It is shared by every case page in the bundle.
- **List pages have zero `<script>`** — they load only `case-shell.css`. Therefore JS
  injected through `case-shell.js` does NOT reach the list pages. They need a direct
  `<script>` tag.
- `case-shell.css` `:root` tokens available for styling the nav:
  `--surface #ffffff`, `--textPrimary #14221C`, `--textSecondary #5D6C64`,
  `--accent #2F8F6B`, `--primarySoft #E4EFE8`, `--radiusCard 22px`, `--line`,
  `--card-shadow`, `--fontFamily`. This is enough to render the nav natively without
  importing portal CSS (the portal's `src/styles.css` is not deployed under `public/`).
- Portal nav reference (`src/siteChrome.js:5-11`): 5 items —
  `Home` (`#home`), `Entry` (`#entry`), `Probing` (`#probing`), `Search` (`#search`),
  `Help` (`#help`). Routes are validated by `src/router.js` (`ALLOWED_ROUTES`).

## Design

### Architecture: one shared `site-nav.js` per bundle, two injection entry points

Each universe bundle gets a new self-contained script:
`public/rasp-v3/__rasp_v3_site__/site-nav.js`
`public/rmdb-v3/__family_d_site__/site-nav.js`

`site-nav.js` is an IIFE that, on load:
1. Resolves the **portal root** relative to its own URL (`document.currentScript.src`).
   The script lives at `<deployRoot>/{rasp-v3,rmdb-v3}/__<bundle>__/site-nav.js`, so the
   portal root is three directory levels up from the script. Computing from the script's
   own URL makes the links correct whether the site is served from the domain root or a
   sub-path. Links are therefore **relative** (user-approved), e.g. `<root>/#home`.
2. Builds a `<header class="fb-detail-nav">` containing a brand block
   (`FB` mark + `FoldBridge` wordmark) and the 5 nav links as `<a href>` anchors
   pointing at `<root>/#home`, `<root>/#entry`, `<root>/#probing`, `<root>/#search`,
   `<root>/#help`. **No** active-route highlighting (detail pages are not a portal route),
   **no** dark-mode toggle, **no** search box (user-approved: brand + nav only).
3. Inserts the header as the **first child of `<body>`** (before `<main class="shell">`),
   guarded so it never injects twice (check for an existing `.fb-detail-nav`).

The link list and root computation live only in `site-nav.js` — single source per bundle.

### Entry point 1 — case pages (1671+ files, never hand-edited)

`case-shell.js` gains a small loader at the **top** of the file that dynamically appends
`site-nav.js` from the same bundle directory. It resolves `site-nav.js` relative to
`case-shell.js`'s own script URL (the existing `<script src=".../case-shell.js">` tag),
so no path assumptions. This one edit reaches every case page in the bundle without
touching any per-case HTML.

The loader must not interfere with `case-shell.js`'s existing bootstrap logic (it throws
if `family-case-bootstrap` is missing). The nav loader runs independently and tolerates
the existing flow.

### Entry point 2 — list pages (2 files)

Add a single `<script src="./__rasp_v3_site__/site-nav.js"></script>` (resp.
`./__family_d_site__/site-nav.js`) immediately before `</body>` in each list
`index.html`. These two files are edited directly (only two of them).

### Styling

Add `.fb-detail-nav` rules to `case-shell.css` (loaded by BOTH case pages and list
pages — the single CSS lever that reaches everything). The nav replicates the portal
header's visual language using the existing `:root` tokens: surface background, accent
color for links, card radius/shadow, brand mark styling. Responsive: stack/condense on
narrow viewports. Both bundles' `case-shell.css` get the same block.

### Files touched

Per bundle (×2 = 8 files total):
- `+` new `__<bundle>__/site-nav.js`
- edit `__<bundle>__/case-shell.js` (one loader block at top)
- edit `__<bundle>__/case-shell.css` (nav style block)
- edit list `index.html` (one `<script>` tag before `</body>`)

## Durability caveat

Everything under `public/` is **materialized output** of `build_v3_universe_case_pages.py`,
which lives in the *other* repo (rmdb2pdb), not this worktree. These edits will be
overwritten the next time that generator runs. This change lands foldbridge-side now;
porting the same `site-nav.js` + CSS + the `case-shell.js` loader + list-page script tag
into the generator (so regeneration preserves them) is a tracked follow-up, out of scope
for this change.

## Non-goals

- iframe workbench chain pages get no nav.
- No active-route highlighting on detail pages.
- No dark-mode toggle, no search box (brand + nav links only).
- No generator port in this change (follow-up).
- No change to portal SPA chrome.

## Verification

- `node --check` on both `site-nav.js` and both modified `case-shell.js`.
- Open a rasp-v3 case page (e.g. `RASP2PDB%3A8AUV`), an rmdb-v3 case page, and both list
  pages; confirm the header renders once, links resolve to the portal hash routes, and no
  console errors.
- Confirm the header does not double-inject (case page that loads `case-shell.js`).
