const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(
  __dirname, "..", "public", "rmdb-v3", "__family_d_site__", "case-shell.js"
), "utf8");
// Run the classic script in this realm: `document` is passed undefined so the DOM
// bootstrap guard is skipped, while `module`/`exports` trigger the export guard.
// Staying in-realm keeps returned plain objects on the host Object.prototype so
// assert.deepStrictEqual works; no package.json is needed under public/.
const sandbox = { module: { exports: {} } };
sandbox.exports = sandbox.module.exports;
const loadShell = new Function("module", "exports", "document", SRC);
loadShell(sandbox.module, sandbox.exports, undefined);

const {
  familyCounts, tierCounts, distinctChains, familyLabel, tierDisplay,
  fmtMetric, fmtP, fmtFraction, fmtCount, pickBestEvidence,
} = sandbox.module.exports;

const ROWS = [
  { family: "A", chain: "A", lssTierCalibrated: "LSS_WEAK", evidenceId: "e1",
    aucDirectional: 0.557105, aucEmpiricalPValue: 0.005994, nEvaluable: 699,
    conflictFraction: 0.230769, directionalMetricKind: "auc_unpaired_vs_paired",
    selectedByDefault: true },
  { family: "A", chain: "A", lssTierCalibrated: "LSS_DISCORDANT", evidenceId: "e2",
    aucDirectional: 0.447859, aucEmpiricalPValue: 0.992008, nEvaluable: 721,
    conflictFraction: 0.285714, directionalMetricKind: "auc_unpaired_vs_paired",
    selectedByDefault: false },
  { family: "D", chain: "A", lssTierCalibrated: "LSS_DISCORDANT", evidenceId: "e3",
    aucDirectional: -0.012703, aucEmpiricalPValue: 0.547453, nEvaluable: 194,
    conflictFraction: null, directionalMetricKind: "spearman_rho",
    selectedByDefault: false },
];

test("familyCounts aggregates distinct families", () => {
  assert.deepStrictEqual(familyCounts(ROWS), { A: 2, D: 1 });
});

test("tierCounts aggregates calibrated tiers", () => {
  assert.deepStrictEqual(tierCounts(ROWS),
    { LSS_WEAK: 1, LSS_DISCORDANT: 2 });
});

test("distinctChains counts unique chains", () => {
  assert.strictEqual(distinctChains(ROWS), 1);
});

test("familyLabel maps known + falls back to bare letter", () => {
  assert.strictEqual(familyLabel("A"), "WC-face base-specific");
  assert.strictEqual(familyLabel("Z"), "Z");
});

test("tierDisplay maps known token", () => {
  const w = tierDisplay("LSS_WEAK");
  assert.strictEqual(w.label, "WEAK");
  assert.strictEqual(w.tone, "weak");
  assert.match(w.meaning, /directional but not yet self-contained/i);
});

test("tierDisplay unknown token strips LSS_ and uses not-supported tone, empty meaning", () => {
  const u = tierDisplay("LSS_FUTURE_TIER");
  assert.strictEqual(u.label, "FUTURE TIER");
  assert.strictEqual(u.tone, "not-supported");
  assert.strictEqual(u.meaning, "");
});

test("fmtMetric 2dp signed for spearman, fmtP 3dp, fmtFraction handles null", () => {
  assert.strictEqual(fmtMetric(0.557105), "0.56");
  assert.strictEqual(fmtMetric(-0.012703), "-0.01");
  assert.strictEqual(fmtP(0.005994), "0.006");
  assert.strictEqual(fmtFraction(null), "—");
  assert.strictEqual(fmtFraction(0.230769), "0.23");
});

test("fmtCount stringifies counts and renders missing as em dash", () => {
  assert.strictEqual(fmtCount(699), "699");
  assert.strictEqual(fmtCount(0), "0");
  assert.strictEqual(fmtCount(null), "—");
  assert.strictEqual(fmtCount(undefined), "—");
});

test("pickBestEvidence: defaultEvidenceId > selectedByDefault > first", () => {
  assert.strictEqual(pickBestEvidence(ROWS, "e2").evidenceId, "e2");
  assert.strictEqual(pickBestEvidence(ROWS, "nope").evidenceId, "e1"); // selectedByDefault
  const noFlag = ROWS.map((r) => ({ ...r, selectedByDefault: false }));
  assert.strictEqual(pickBestEvidence(noFlag, "nope").evidenceId, "e1"); // first
  assert.strictEqual(pickBestEvidence([], "x"), null);
});

// Guard-path regression: executing the document-guard block must NOT throw.
// Before the TDZ fix, renderEnrichment() read FAMILY_LABELS/TIER_DISPLAY/TIER_ORDER
// while those `const`s were still uninitialized (declared below the guard) →
// ReferenceError. This runs the guard against a minimal DOM stub to catch it.
test("document-guard path executes without throwing (TDZ regression)", () => {
  const BOOTSTRAP_JSON = JSON.stringify({
    defaultChainId: "A",
    defaultEvidenceId: "e1",
    chainPageById: { A: "chains/A/index.html" },
    evidenceChainMap: { e1: "A" },
    evidenceRows: [{
      evidenceId: "e1", family: "A", technology: "DMS-seq", chain: "A",
      lssTierCalibrated: "LSS_WEAK", aucDirectional: 0.56, aucEmpiricalPValue: 0.006,
      nEvaluable: 699, conflictFraction: 0.23,
      directionalMetricKind: "auc_unpaired_vs_paired",
      directionalMetricLabel: "AUC unpaired vs paired",
      trackProfileId: "p1", profileKey: "pk1", selectedByDefault: true,
    }],
  });

  function makeEl() {
    const node = {
      className: "",
      textContent: "",
      src: "",
      dataset: {},
      children: [],
      classList: { toggle() {} },
      appendChild(child) { this.children.push(child); return child; },
      insertBefore(child) { this.children.push(child); return child; },
      insertAdjacentElement(_pos, child) { this.children.push(child); return child; },
      setAttribute() {},
      addEventListener() {},
      querySelector() { return null; },
      replaceChildren() { this.children = []; },
    };
    return node;
  }

  const bootstrapNode = { textContent: BOOTSTRAP_JSON };
  const heroSubtitle = makeEl();
  const hero = makeEl();
  hero.querySelector = (sel) => (sel === "p" ? heroSubtitle : null);
  const metaNode = makeEl();
  const layoutParent = makeEl();
  const layout = makeEl();
  layout.parentNode = layoutParent;

  const fakeDocument = {
    currentScript: { src: "https://example.test/__family_d_site__/case-shell.js" },
    head: makeEl(),
    body: makeEl(),
    documentElement: makeEl(),
    getElementById(id) {
      if (id === "family-case-bootstrap") return bootstrapNode;
      return makeEl(); // chainFrame / chainStatus
    },
    querySelector(sel) {
      if (sel === ".hero") return hero;
      if (sel === ".hero .meta") return metaNode;
      if (sel === ".layout") return layout;
      return null;
    },
    querySelectorAll() { return []; },
    createElement() { return makeEl(); },
  };

  const fn = new Function("document", "module", "exports", SRC);
  assert.doesNotThrow(() => fn(fakeDocument, undefined, undefined));
  // Prove renderEnrichment actually ran: .meta got its 3 derived chips.
  assert.strictEqual(metaNode.children.length, 3);
});
