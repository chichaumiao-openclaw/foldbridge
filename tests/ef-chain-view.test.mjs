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
  { r: 198, g: 0, b: 0 }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(core.colorForValue(-6, chainPayload.header))),
  { r: 255, g: 255, b: 255 },
  "negative/non-contact signal must use the existing Workbench white baseline, never a blue diverging scale"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(core.colorForValue(0.8, {
    family: "E", bg_mean: 0, value_min: -2, value_max: 8,
  }))),
  { r: 255, g: 211, b: 0 },
  "EF must use the same white-yellow-red response ramp as the existing Workbench heatmap"
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
    this.style = {
      setProperty: (property, value) => { this.style[property] = String(value); },
    };
    this.handlers = {};
    this.innerHTML = "";
    this.className = "";
    this.textContent = "";
    this.classList = {
      add: (...names) => {
        const values = new Set(String(this.attrs.class || this.className || "").split(/\s+/).filter(Boolean));
        names.forEach((value) => values.add(value));
        this.attrs.class = [...values].join(" ");
      },
      remove: (...names) => {
        const removed = new Set(names);
        this.attrs.class = String(this.attrs.class || this.className || "").split(/\s+/).filter((value) => value && !removed.has(value)).join(" ");
      },
      contains: (name) => String(this.attrs.class || this.className || "").split(/\s+/).includes(name),
    };
  }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  removeEventListener(name) { delete this.handlers[name]; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 340 }; }
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

function descendants(node, predicate) {
  const matches = [];
  for (const child of node.children || []) {
    if (predicate(child)) matches.push(child);
    matches.push(...descendants(child, predicate));
  }
  return matches;
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
const molstarHost = new FakeElement("host");

const controller = integrationSandbox.window.createEfHeatmap({
  sequenceHost,
  heatmapHost,
  varnaHost,
  molstarHost,
  molstarPlugin,
  payload: constructPayload,
});
assert.equal(controller.viewHeader.n_rows, 2);
assert.equal(controller.viewHeader.n_cols, 2);
assert.ok(heatmapHost.querySelector(".ef-axes"), "heatmap must render coordinate axes");
assert.ok(heatmapHost.querySelector(".ef-hover"), "heatmap must render hover crosshair layer");
assert.ok(heatmapHost.querySelector(".ef-selection"), "heatmap must render locked selection layer");
const sequenceTrack = sequenceHost.querySelector(".ef-sequence-track");
assert.ok(sequenceTrack, "sequence host must render the Workbench-style SVG 1D track");
assert.equal(sequenceTrack.getAttribute("role"), "group", "interactive SVG track must expose a group, not flattened image semantics");
assert.equal(heatmapHost.querySelector(".ef-sequence-track"), null, "matrix host must not duplicate the 1D track");
const trackLabels = descendants(sequenceTrack, (node) => node.getAttribute("class") === "ef-track-label").map((node) => node.textContent);
assert.deepEqual(trackLabels, ["PDB pos", "Mapped chain seq", "Intensity"]);
const baseMarks = descendants(sequenceTrack, (node) => node.getAttribute("data-track-kind") === "mapped_chain_sequence");
const intensityMarks = descendants(sequenceTrack, (node) => node.getAttribute("data-track-kind") === "ef_intensity");
const baseCells = descendants(sequenceTrack, (node) => String(node.getAttribute("class") || "").split(/\s+/).includes("ef-sequence-base"));
const intensityCells = descendants(sequenceTrack, (node) => String(node.getAttribute("class") || "").split(/\s+/).includes("ef-sequence-intensity"));
assert.equal(baseMarks.length, 2, "mapped chain sequence row must render one interactive cell per mapped residue");
assert.equal(intensityMarks.length, 2, "intensity row must align one cell per mapped residue");
assert.ok(baseMarks.every((mark) => Number(mark.getAttribute("data-hit-width")) >= 24), "every interactive sequence target must be at least 24 px wide");
assert.ok(baseCells.every((cell, index) => Number(cell.getAttribute("width")) <= Number(baseMarks[index].getAttribute("data-hit-width")) - 1), "visible sequence cells retain the normal Workbench inter-cell gap");
assert.ok([...baseMarks, ...intensityMarks].every((mark) => mark.getAttribute("aria-pressed") === "false"), "track cells start unpressed");
assert.deepEqual(intensityCells.map((cell) => cell.getAttribute("fill")), ["rgb(255,255,255)", "rgb(255,255,255)"], "intensity row starts at the no-signal baseline");
assert.ok(heatmapHost.querySelector(".ef-colorbar"), "heatmap must render a visible colorbar");
const hitgrid = heatmapHost.querySelector(".ef-hitgrid");
const hoverLayer = heatmapHost.querySelector(".ef-hover");
const tooltip = heatmapHost.querySelector(".ef-tooltip");
hitgrid.handlers.mousemove({ clientX: 195, clientY: 105 });
assert.equal(hoverLayer.getAttribute("visibility"), "visible", "matrix hover must reveal the crosshair layer");
assert.equal(tooltip.style.display, "block", "matrix hover must reveal the value tooltip");
assert.equal(varnaSvg.circles[0].classList.contains("is-ef-hovered"), true, "matrix hover must mark linked VARNA residues");
hitgrid.handlers.mouseleave();
assert.equal(hoverLayer.getAttribute("visibility"), "hidden", "matrix leave must hide the crosshair layer");
assert.equal(tooltip.style.display, "none", "matrix leave must hide the value tooltip");
assert.equal(varnaSvg.circles[0].classList.contains("is-ef-hovered"), false, "matrix leave must clear linked VARNA hover");
assert.deepEqual(JSON.parse(JSON.stringify(selectCalls[0])), {
  data: [{ struct_asym_id: "HA", start_residue_number: 1, end_residue_number: 2, color: { r: 200, g: 200, b: 200 }, focus: true }],
  nonSelectedColor: { r: 255, g: 255, b: 255 },
});
controller.selectAxis("i", 0);
assert.deepEqual(JSON.parse(JSON.stringify(selectCalls[1].nonSelectedColor)), { r: 255, g: 255, b: 255 });
assert.equal(controller.state.selected.axis, "i");
assert.equal(controller.state.selected.index, 0);
assert.deepEqual(
  intensityCells.map((cell) => cell.getAttribute("fill")),
  [1.5, 6].map((value) => {
    const color = core.colorForValue(value, chainPayload.header);
    return `rgb(${color.r},${color.g},${color.b})`;
  }),
  "selecting a residue must render that matrix slice in the aligned intensity row"
);
assert.equal(baseMarks[0].classList.contains("selected"), true, "selection uses the existing Workbench residue-mark state");
assert.equal(intensityMarks[0].classList.contains("selected"), true, "selection stays linked across sequence and intensity rows");
assert.equal(baseMarks[0].getAttribute("aria-pressed"), "true", "selected sequence cell exposes pressed state");
assert.equal(intensityMarks[0].getAttribute("aria-pressed"), "true", "selected intensity cell exposes pressed state");
assert.equal(typeof varnaSvg.handlers.click, "function", "VARNA SVG must delegate clicks from overlaid base labels");
varnaSvg.handlers.click({ clientX: 25, clientY: 25, target: new FakeElement("text") });
assert.equal(controller.state.selected.index, 1, "clicking a VARNA base label must select its nearest nucleotide circle");
assert.equal(varnaSvg.circles[1].classList.contains("is-ef-selected"), true, "VARNA selection must remain visibly locked");

assert.equal(typeof molstarHost.handlers["PDB.molstar.click"], "function", "3D host must listen for PDBe Mol* residue clicks");
molstarHost.handlers["PDB.molstar.click"]({
  detail: {
    label_asym_id: "HA",
    auth_asym_id: "a",
    label_seq_id: 1,
  },
});
assert.equal(controller.state.selected.index, 0, "clicking a 3D residue must select its mapped matrix axis");
assert.equal(controller.state.selected.source, "3d", "3D selection must retain its interaction source");
assert.equal(varnaSvg.circles[0].classList.contains("is-ef-selected"), true, "3D selection must update the linked VARNA residue");
assert.equal(sequenceHost.querySelector(".selected")?.getAttribute("data-pdb-pos"), "1", "3D selection must update the 1D track");

const fPayload = {
  header: {
    pdb_id: "8QO5",
    chain: "A",
    label_asym_id: "A",
    family: "F",
    n_rows: 2,
    n_cols: 4,
    value_min: -1,
    value_max: 8,
    render_scope: "mapped_chain",
    focus_chain: true,
  },
  axis_i: [
    { matrix_index: 0, pdb_pos: 10, varna_index: 0, observed: true, base: "A" },
    { matrix_index: 1, pdb_pos: 20, varna_index: 1, observed: true, base: "C" },
  ],
  axis_j: [
    { matrix_index: 0, pdb_pos: 10, varna_index: 0, observed: true, base: "A" },
    { matrix_index: 1, pdb_pos: 20, varna_index: 1, observed: true, base: "C" },
    { matrix_index: 2, pdb_pos: 30, varna_index: 2, observed: true, base: "G" },
    { matrix_index: 3, pdb_pos: 40, varna_index: 3, observed: true, base: "U" },
  ],
  cells: [
    [0, 0, 1], [0, 1, 2], [0, 2, 3], [0, 3, 4],
    [1, 0, 5], [1, 1, 6], [1, 2, 7], [1, 3, 8],
  ],
};
const fSequenceHost = new FakeElement("host");
const fHeatmapHost = new FakeElement("host");
const fVarnaHost = new FakeElement("host");
const fVarnaSvg = new FakeElement("svg");
fVarnaSvg.circles = Array.from({ length: 4 }, (_, index) => {
  const circle = new FakeElement("circle");
  circle.getBoundingClientRect = () => ({ left: index * 20, top: index * 20, width: 10, height: 10 });
  return circle;
});
fVarnaHost.appendChild(fVarnaSvg);
const fMolstarHost = new FakeElement("host");
const fInteractions = [];
const fController = integrationSandbox.window.createEfHeatmap({
  sequenceHost: fSequenceHost,
  heatmapHost: fHeatmapHost,
  varnaHost: fVarnaHost,
  molstarHost: fMolstarHost,
  molstarPlugin: { visual: { select() {}, highlight() {}, clearHighlight() {} } },
  payload: fPayload,
  onInteraction(event) { fInteractions.push(event); },
});
const fTrack = fSequenceHost.querySelector(".ef-sequence-track");
const fBases = descendants(fTrack, (node) => node.getAttribute("data-track-kind") === "mapped_chain_sequence");
const fIntensities = descendants(fTrack, (node) => node.getAttribute("data-track-kind") === "ef_intensity");
assert.equal(fBases.length, 4, "F sequence track follows the longer j axis");

fController.selectCell(1, 2);
assert.equal(fController.state.selected.axis, "i", "matrix selection locks its i row");
assert.equal(fController.state.selected.source, "matrix");
assert.deepEqual(fIntensities.map((mark) => mark.getAttribute("data-value")), ["5", "6", "7", "8"], "i selection renders the full j-axis matrix row");

fBases[2].handlers.click();
assert.equal(fController.state.selected.axis, "j", "clicking a j-only sequence residue selects the j axis");
assert.equal(fController.state.selected.index, 2);
assert.equal(fController.state.selected.source, "sequence");
assert.deepEqual(fIntensities.map((mark) => mark.getAttribute("data-value")), ["3", "7", "", ""], "j selection renders the i-axis column and leaves j-only positions blank");

let enterPrevented = false;
fBases[3].handlers.keydown({ key: "Enter", preventDefault() { enterPrevented = true; } });
assert.equal(enterPrevented, true, "Enter activates a sequence cell without browser default behavior");
assert.equal(fController.state.selected.index, 3);
let spacePrevented = false;
fIntensities[2].handlers.keydown({ key: " ", preventDefault() { spacePrevented = true; } });
assert.equal(spacePrevented, true, "Space activates an intensity cell without scrolling");
assert.equal(fController.state.selected.index, 2);

fVarnaSvg.handlers.click({ clientX: 45, clientY: 45, target: new FakeElement("text") });
assert.equal(fController.state.selected.axis, "j");
assert.equal(fController.state.selected.index, 2);
assert.equal(fController.state.selected.source, "varna");
assert.deepEqual(fIntensities.map((mark) => mark.getAttribute("data-value")), ["3", "7", "", ""], "VARNA uses the same F column intensity slice");

fMolstarHost.handlers["PDB.molstar.click"]({ detail: { label_asym_id: "A", auth_asym_id: "A", label_seq_id: 40 } });
assert.equal(fController.state.selected.axis, "j");
assert.equal(fController.state.selected.index, 3);
assert.equal(fController.state.selected.source, "3d");
assert.deepEqual(fIntensities.map((mark) => mark.getAttribute("data-value")), ["4", "8", "", ""], "3D uses the same F column intensity slice");
assert.ok(fInteractions.some((event) => event.source === "matrix"), "matrix path emits a normalized interaction event");
assert.ok(fInteractions.some((event) => event.source === "sequence"), "sequence path emits a normalized interaction event");
assert.ok(fInteractions.some((event) => event.source === "varna"), "VARNA path emits a normalized interaction event");
assert.ok(fInteractions.some((event) => event.source === "3d"), "3D path emits a normalized interaction event");

console.log("ok - EF chain view uses one 2D/3D coordinate system");
