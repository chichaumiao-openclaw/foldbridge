import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../public/entry-cases/__entry_ef_site__/ef-heatmap-core.js", import.meta.url),
  "utf8"
);
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);
const core = sandbox.window.EfHeatmapCore;

const constructPayload = {
  header: {
    pdb_id: "9WNR",
    chain: "a",
    label_asym_id: "HA",
    family: "E",
    n_rows: 4,
    n_cols: 4,
    bg_mean: 0,
    bg_sd: 2,
    value_min: -100,
    value_max: 100,
    color_scale: "bg_sd",
    color_sd_cap: 3,
    render_scope: "mapped_chain",
    focus_chain: true,
  },
  axis_i: [
    { matrix_index: 0, construct_pos: -1, pdb_pos: null, varna_index: null },
    { matrix_index: 1, construct_pos: 2, pdb_pos: 1, varna_index: 0, observed: true, base: "A" },
    { matrix_index: 2, construct_pos: 3, pdb_pos: 2, varna_index: 1, observed: true, base: "C" },
    { matrix_index: 3, construct_pos: 4, pdb_pos: null, varna_index: null },
  ],
  axis_j: [
    { matrix_index: 0, construct_pos: -1, pdb_pos: null, varna_index: null },
    { matrix_index: 1, construct_pos: 2, pdb_pos: 1, varna_index: 0, observed: true, base: "A" },
    { matrix_index: 2, construct_pos: 3, pdb_pos: 2, varna_index: 1, observed: true, base: "C" },
    { matrix_index: 3, construct_pos: 4, pdb_pos: null, varna_index: null },
  ],
  cells: [
    [0, 1, 99],
    [1, 1, 1.5],
    [1, 2, 6],
    [2, 1, -6],
    [2, 2, 2.5],
    [3, 2, 88],
  ],
};

assert.equal(typeof core.materializeMappedChain, "function");
const chainPayload = core.materializeMappedChain(constructPayload);

assert.equal(chainPayload.header.n_rows, 2);
assert.equal(chainPayload.header.n_cols, 2);
assert.deepEqual(
  JSON.parse(JSON.stringify(chainPayload.axis_i.map((row) => [row.matrix_index, row.source_matrix_index, row.pdb_pos, row.varna_index]))),
  [[0, 1, 1, 0], [1, 2, 2, 1]]
);
assert.deepEqual(JSON.parse(JSON.stringify(chainPayload.cells)), [
  [0, 0, 1.5],
  [0, 1, 6],
  [1, 0, -6],
  [1, 1, 2.5],
]);
assert.equal(chainPayload.header.value_min, -6);
assert.equal(chainPayload.header.value_max, 6);
assert.equal(chainPayload.header.color_scale, "matrix_extent");

assert.deepEqual(
  JSON.parse(JSON.stringify(core.colorForValue(6, chainPayload.header))),
  { r: 235, g: 0, b: 0 }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(core.colorForValue(-6, chainPayload.header))),
  { r: 0, g: 0, b: 235 }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(core.colorForValue(-2, {
    family: "E", bg_mean: 0, value_min: -2, value_max: 8,
  }))),
  { r: 0, g: 0, b: 235 },
  "an asymmetric E matrix must still use the full cold half of the visible colorbar"
);

assert.deepEqual(
  JSON.parse(JSON.stringify(core.buildMolstarChainFocusPayload(chainPayload))),
  {
    data: [{ struct_asym_id: "HA", start_residue_number: 1, end_residue_number: 2, color: { r: 200, g: 200, b: 200 }, focus: true }],
    nonSelectedColor: { r: 255, g: 255, b: 255 },
  }
);

class FakeElement {
  constructor(name) {
    this.name = name;
    this.attrs = {};
    this.children = [];
    this.style = {};
    this.handlers = {};
    this.innerHTML = "";
    this.className = "";
    this.textContent = "";
  }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  removeEventListener(name) { delete this.handlers[name]; }
  querySelector(selector) {
    const matches = (node) => selector === "svg"
      ? node.name === "svg"
      : selector.startsWith(".") && String(node.attrs.class || node.className || "").split(/\s+/).includes(selector.slice(1));
    for (const child of this.children) {
      if (matches(child)) return child;
      const nested = child.querySelector?.(selector);
      if (nested) return nested;
    }
    return null;
  }
  querySelectorAll(selector) {
    if (selector === 'circle[stroke="none"][r="5.0"]') return this.circles || [];
    return [];
  }
}

const heatmapSource = fs.readFileSync(
  new URL("../public/entry-cases/__entry_ef_site__/ef-heatmap.js", import.meta.url),
  "utf8"
);
const integrationSandbox = {
  window: { EfHeatmapCore: core },
  document: {
    createElementNS: (_ns, name) => new FakeElement(name),
    createElement: (name) => new FakeElement(name),
  },
};
vm.runInNewContext(heatmapSource, integrationSandbox);

const heatmapHost = new FakeElement("host");
const sequenceHost = new FakeElement("host");
const varnaHost = new FakeElement("host");
const varnaSvg = new FakeElement("svg");
varnaSvg.circles = [new FakeElement("circle"), new FakeElement("circle")];
varnaSvg.circles[0].getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 });
varnaSvg.circles[1].getBoundingClientRect = () => ({ left: 20, top: 20, width: 10, height: 10 });
varnaHost.appendChild(varnaSvg);
const selectCalls = [];
const molstarPlugin = {
  visual: {
    select(args) { selectCalls.push(args); },
    highlight() {},
    clearHighlight() {},
  },
};

const controller = integrationSandbox.window.createEfHeatmap({
  sequenceHost,
  heatmapHost,
  varnaHost,
  molstarPlugin,
  payload: constructPayload,
});
assert.equal(controller.viewHeader.n_rows, 2);
assert.equal(controller.viewHeader.n_cols, 2);
assert.ok(heatmapHost.querySelector(".ef-axes"), "heatmap must render coordinate axes");
assert.ok(heatmapHost.querySelector(".ef-hover"), "heatmap must render hover crosshair layer");
assert.ok(heatmapHost.querySelector(".ef-selection"), "heatmap must render locked selection layer");
assert.ok(sequenceHost.querySelector(".ef-sequence-strip"), "sequence host must render the clickable 1D sequence strip");
assert.equal(heatmapHost.querySelector(".ef-sequence-strip"), null, "matrix host must not duplicate the 1D strip");
assert.ok(heatmapHost.querySelector(".ef-colorbar"), "heatmap must render a visible colorbar");
assert.deepEqual(JSON.parse(JSON.stringify(selectCalls[0])), {
  data: [{ struct_asym_id: "HA", start_residue_number: 1, end_residue_number: 2, color: { r: 200, g: 200, b: 200 }, focus: true }],
  nonSelectedColor: { r: 255, g: 255, b: 255 },
});
controller.selectAxis("i", 0);
assert.deepEqual(JSON.parse(JSON.stringify(selectCalls[1].nonSelectedColor)), { r: 255, g: 255, b: 255 });
assert.equal(controller.state.selected.axis, "i");
assert.equal(controller.state.selected.index, 0);
assert.equal(typeof varnaSvg.handlers.click, "function", "VARNA SVG must delegate clicks from overlaid base labels");
varnaSvg.handlers.click({ clientX: 25, clientY: 25, target: new FakeElement("text") });
assert.equal(controller.state.selected.index, 1, "clicking a VARNA base label must select its nearest nucleotide circle");

console.log("ok - EF chain view uses one 2D/3D coordinate system");
