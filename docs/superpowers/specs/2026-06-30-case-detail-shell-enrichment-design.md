# Case detail-page shell enrichment — design

Date: 2026-06-30
Branch: release-public (worktree `~/docs/foldbridge-release`)
Status: approved design, pending spec-review + implementation

## Problem

The case detail page shell is sparse and scaffold-like. Every case page
(`public/{rasp-v3,rmdb-v3}/cases/*/index.html`) shows only:

- a `<section class="hero">` with the PDB id, a `RASP2PDB:<id>` / `RMDB2PDB:<id>`
  subtitle, and a few `.chip` metadata tags;
- a `<section class="layout">` whose entire body is a `Chain` status panel plus a
  full-height `<iframe id="chainFrame">` embedding the chain workbench.

All the rich confidence data — per-evidence AUC / Spearman, empirical p-values, tiers,
measurement families, technologies, evaluable counts — is **already inlined** in each
page's `family-case-bootstrap` JSON (`evidenceRows`), but **none of it is surfaced on the
shell**. A visitor sees a near-empty page wrapped around an iframe; the evidence that
makes the case meaningful is invisible until the iframe finishes loading its internal
viewer.

Goal: enrich the shell so it presents the confidence story directly — without touching
the iframe, and without re-running the (other-repo) page generator.

## Scope

In scope:
- Top-level **case pages** in both universes: `public/rasp-v3/cases/*/index.html` (1671)
  and `public/rmdb-v3/cases/*/index.html` (715) = 2386 pages, reached entirely through the
  two shared `case-shell.js` + `case-shell.css` files (one pair per universe).
- Render, from the already-inlined `evidenceRows`: a richer hero (tier badge + metadata
  chips), a confidence scoreboard (family badges + tier-count pills + best-evidence
  summary), and an expandable full evidence table.

Out of scope:
- The **iframe-embedded chain workbench** (`cases/*/chains/*/index.html`, `workbench.js`).
  The user handles the iframe / its eventual removal separately ("on the other side").
  This change must not depend on the iframe's internal behavior.
- The detail nav header (separate, already-landed change).
- The case-list pages (`public/{rasp-v3,rmdb-v3}/index.html`).
- Any change to the page generator in the rmdb2pdb repo (see Durability caveat).

## Verified baseline facts

- **Both universes' `case-shell.js` are byte-identical** (83 lines each). Plain top-level
  classic script (not a module), runs at parse time, shared by every case page in the
  bundle. The top IIFE injects `site-nav.js`; the rest parses `family-case-bootstrap` and
  drives the iframe.
- **The bootstrap JSON inlines everything needed.** Keys: `caseId`, `caseKey`,
  `defaultChainId`, `defaultEvidenceId`, `chainPageById` (chainId→relative chain-page
  href), `evidenceChainMap` (evidenceId→chainId), and `evidenceRows` (array). Each
  evidence row carries: `evidenceId`, `family` (A/B/D…), `technology`, `chain`,
  `lssTierCalibrated`, `lssTierUncalibrated`, `aucDirectional`, `aucEmpiricalPValue`,
  `aucEffectSizeZ`, `nEvaluable`, `conflictFraction`, `partnerInsideFraction`,
  `directionalMetricKind` (`auc_unpaired_vs_paired` | `spearman_rho`),
  `directionalMetricLabel`, `signalDirection`, `sasaReferenceStatus`, `profileKey`,
  `trackProfileId`, `selectedByDefault`, `bridgeStatus`, `recallPath`, `pairId`,
  `pairSegmentId`. RMDB cases typically have **1** row; RASP cases have up to **31** rows
  across families A/B/D.
- **No fetch needed.** Family counts, tier counts, total evidence count, and the
  best/default evidence are all derivable from `evidenceRows` + `defaultEvidenceId`
  client-side. (The sibling `case.json` / `confidence-summary.json` files exist but the
  shell will NOT read them — deriving from the already-parsed `evidenceRows` avoids async,
  works offline, and keeps a single source of truth.)
- Current case HTML body: `<main class="shell">` → `<section class="hero">` (with `<h1>`,
  `<p>`, `.meta` chips) → `<section class="layout">` → `<section class="viewer">`
  (`.panel` with `#chainStatus` + `<iframe id="chainFrame">`). `case-shell.css` is loaded
  in `<head>` and already styles `.hero`, `.chip`, `.meta`, `.panel`, `.layout`,
  `.viewer-frame`, plus the already-landed `.fb-detail-nav` block.
- **The two bundles have disjoint `:root` token NAMES** (rasp: `--surface`/`--textPrimary`
  /`--textSecondary`/`--primarySoft`; rmdb: `--panel`/`--text`/`--muted`/`--accent-soft`).
  Values currently coincide (warm cream + green accent `#2F8F6B`), but a style block keyed
  on one set of names renders unstyled in the other bundle. New enrichment CSS must use
  **self-contained literal values** (same precedent as the `.fb-detail-nav` block), so one
  identical block works in both bundles.

## Design

### Architecture: the viewer is a replaceable slot behind one function

The single coupling point between the (data-driven) shell and the (swappable) viewer is
the action "load this evidence's profile into the viewer." Today `updateFrame()` sets
`frame.src`. The refactor extracts that into one named seam:

```
function loadEvidence(evidenceId) {
  // resolve evidence → chain → profileId, then drive the viewer.
  // TODAY: set the iframe's src (current behavior, byte-equivalent outcome).
  // FUTURE (user, other side): when the iframe is replaced/removed, ONLY this
  // function body and the viewer container DOM change — the hero, scoreboard,
  // and evidence table never reference the iframe.
}
```

Contract: **the enrichment UI (hero / scoreboard / table) never touches the iframe or any
viewer internal.** It only computes from `evidenceRows` and, on a row click, calls
`loadEvidence(evidenceId)`. This makes shell-beautification and iframe-removal fully
independent work streams — the seam is pre-cut. This is why the work can ship now without
waiting on the iframe decision.

### Rendering (in `case-shell.js`, after bootstrap parse)

A single `renderEnrichment(bootstrap)` builds DOM (no innerHTML of untrusted data; all
case/evidence strings are inserted via `textContent` / escaped) and inserts it between the
hero and the existing `.layout`. It is a **pure function of `evidenceRows`**:

1. **Hero augmentation** — keep `<h1>` + subtitle; add a tier badge derived from the
   default/best evidence row (`family · <tier label>`, e.g. `A · WEAK`), and a metadata
   chip row: chains, profiles (= row count), families (distinct `family`), evidence rows.
   (For RMDB single-row cases this degrades to one family, one tier — still correct.)
2. **Confidence scoreboard** card:
   - **Family badges**: for each distinct `family`, a labeled count (e.g.
     `A · WC-face base-specific ×13`). Family→human label is a small fixed lookup
     (A=WC-face base-specific, B=SHAPE flexibility, C=enzymatic, D=SASA solvent access,
     E=contact-map, F=pair-set); unknown families fall back to the bare letter.
   - **Tier-count pills** (user-approved option B): one pill per distinct
     `lssTierCalibrated`, with a count (e.g. `DISCORDANT 8`, `NOT SUPPORTED 22`,
     `WEAK 1`). Tier→display name/colour is a fixed lookup; unknown tiers fall back to the
     raw token.
   - **Best-evidence summary**: the default evidence row (`selectedByDefault` /
     `defaultEvidenceId`), shown with its technology, directional metric (using
     `directionalMetricLabel` so AUC vs Spearman is labeled correctly), empirical p,
     `nEvaluable`, and tier — plus a one-line plain-language tier meaning.
3. **Expandable evidence table** — a `<details>` (collapsed by default; user can later
   flip to open) listing all rows: Family, Technology, Tier, directional metric value, p,
   n, profile. Each row is clickable; clicking calls `loadEvidence(row.evidenceId)` and
   marks the row selected. The currently-active evidence row is highlighted.

If `evidenceRows` is empty or missing, `renderEnrichment` renders nothing and the page
falls back to today's behavior (defensive, but not expected for materialized pages).

### Numeric / display rules

- **Directional metric**: show `aucDirectional` rounded to 2 dp, labeled by
  `directionalMetricLabel`. Spearman rows (`directionalMetricKind === "spearman_rho"`) may
  be negative — display the signed value as-is; do not coerce to an AUC-style 0–1 frame.
- **p-value**: show `aucEmpiricalPValue` to 3 dp.
- **null fields**: `conflictFraction` / `partnerInsideFraction` are `null` for Family D
  (Spearman path) — render as `—`, never `null`/`NaN`.
- **Best/default selection**: prefer the row whose `evidenceId === defaultEvidenceId`;
  fall back to the first `selectedByDefault === true` row; else the first row.

### Styling (in `case-shell.css`, both bundles)

Add one self-contained enrichment block (literal values, no `var(--…)`, per baseline
facts) styling: the tier badge, metadata chips, scoreboard card, family badges, tier
pills (with per-tier colour), best-evidence box, and the expandable table. Mirror the
warm-cream + green-accent portal language already used by `.hero` / `.fb-detail-nav`.
Responsive: chips/pills wrap; table stays horizontally scrollable on narrow viewports.
Both bundles get the **same** block (byte-identical).

### Files touched (4)

Per bundle (×2):
- edit `__<bundle>__/case-shell.js` — extract `loadEvidence` seam + add
  `renderEnrichment`, called once after bootstrap parse. (Both files stay byte-identical.)
- edit `__<bundle>__/case-shell.css` — add the enrichment style block (identical in both).

No per-case HTML is touched; all 2386 pages pick up the change through the shared files.

## Durability caveat

Everything under `public/` is materialized output of the page generator in the *other*
repo (rmdb2pdb), not this worktree. These edits will be overwritten the next time that
generator runs. This lands foldbridge-side now; porting the enrichment render + CSS into
the generator is a tracked follow-up, out of scope here (same posture as the nav-header
change).

## Non-goals

- No iframe change; no dependency on the iframe's internal viewer.
- No fetch of sibling JSON; everything derives from inlined `evidenceRows`.
- No generator port in this change (follow-up).
- No change to list pages or portal SPA.
- Evidence table default state stays **collapsed** (user may revisit; option E deferred).

## Verification

- `node --check` on both modified `case-shell.js`.
- Open a dense RASP case (`RASP2PDB%3A10FZ`, 31 rows / families A·B·D) and a single-row
  RMDB case; confirm: hero tier badge + chips correct, scoreboard family badges + tier
  pills counts match `evidenceRows`, best-evidence summary matches the default row,
  expandable table lists every row, row click drives the viewer (iframe src updates) and
  highlights the active row, no console errors.
- Confirm null `conflictFraction` / Spearman rows render `—` / signed values, not `NaN`.
- Confirm the enrichment renders identically in both bundles (shared block) and degrades
  gracefully on a hypothetical empty `evidenceRows`.
