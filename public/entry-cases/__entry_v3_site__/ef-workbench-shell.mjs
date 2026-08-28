import { classifyTechniqueFilter } from "./technique-filter-model.20260828-case-taxonomy-1.mjs";

export const MATRIX_PUBLIC_COPY = Object.freeze({
  subtitle: "Explore experimental contacts across sequence, secondary structure, and 3D structure.",
  sequence: "Sequence",
  contactMap: "Contact / pair map",
  secondaryStructure: "Secondary structure",
  structure3d: "3D structure",
  signal: "Signal",
  loading: "Loading matrix…",
  ready: "Linked data ready",
  linkageHint: "Select a residue to link the contact map, secondary structure, and 3D structure.",
  structureLegend: "Colors follow the selected matrix row or column.",
  loadingDetails: "Loading details",
  inspectorEmpty: "Hover or select a matrix, sequence, or secondary-structure position.",
  linkedCaption: "Secondary and 3D structures use the same validated residue coordinates and signal colors.",
});

function requireNode(document, selector) {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`EF Workbench missing required host ${selector}`);
  return node;
}

export function matrixPublicValueLabel(header) {
  if (header?.value_kind === "cohcoa_contact") return "Contact score";
  if (header?.value_kind === "m2_coupling_z") return "Pair coupling";
  throw new Error(`Unsupported matrix value_kind: ${String(header?.value_kind || "(missing)")}`);
}

export function matrixPublicTechnique(header) {
  const method = classifyTechniqueFilter(header?.technology || "").methods[0] || null;
  return {
    methodLabel: method?.label || "Technique metadata unavailable",
    categoryLabel: method?.categoryLabel || "Technique category unavailable",
  };
}

export function matrixPublicInteractionSource(source) {
  if (source === "matrix") return MATRIX_PUBLIC_COPY.contactMap;
  if (source === "sequence") return MATRIX_PUBLIC_COPY.sequence;
  if (source === "signal") return MATRIX_PUBLIC_COPY.signal;
  if (source === "varna") return MATRIX_PUBLIC_COPY.secondaryStructure;
  if (source === "3d") return MATRIX_PUBLIC_COPY.structure3d;
  return "Linked view";
}

function metric(document, label, value) {
  const item = document.createElement("div");
  item.className = "metric";
  const caption = document.createElement("span");
  caption.textContent = label;
  const strong = document.createElement("b");
  strong.textContent = String(value);
  item.append(caption, strong);
  return item;
}

function residueText(row) {
  if (!row) return "—";
  return `${row.base || "?"} · PDB ${row.pdb_pos ?? "unmapped"} · matrix ${row.matrix_index}`;
}

function inspectorCard(document, label, value) {
  const wrap = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  dd.textContent = value;
  wrap.append(dt, dd);
  return wrap;
}

export function prepareEfWorkbenchShell(document, { caseId, chainId }) {
  const shell = requireNode(document, ".workbench-shell");
  shell.classList.add("is-ef-mode");
  shell.dataset.case = caseId;
  shell.dataset.chain = chainId;

  const title = shell.querySelector("header h1");
  if (title) title.textContent = `${caseId} chain ${chainId}`;
  const subtitle = shell.querySelector("header .sub:not(#assetStatus)");
  if (subtitle) subtitle.textContent = MATRIX_PUBLIC_COPY.subtitle;

  const controls = shell.querySelector(".controls");
  if (controls) controls.hidden = true;
  shell.querySelectorAll(".technique-filter").forEach((node) => node.remove());
  const trackControls = shell.querySelector(".track-viewport-controls");
  if (trackControls) trackControls.hidden = true;
  const trackHeading = shell.querySelector(".track-panel .panel-head h2");
  if (trackHeading) trackHeading.textContent = MATRIX_PUBLIC_COPY.sequence;
  const trackStatus = shell.querySelector("#trackStatus");
  if (trackStatus) trackStatus.textContent = MATRIX_PUBLIC_COPY.linkageHint;

  let matrixPanel = shell.querySelector(".ef-workbench-matrix-panel");
  if (!matrixPanel) {
    matrixPanel = document.createElement("section");
    matrixPanel.className = "panel ef-workbench-matrix-panel";
    const head = document.createElement("div");
    head.className = "panel-head";
    const heading = document.createElement("h2");
    heading.textContent = MATRIX_PUBLIC_COPY.contactMap;
    const status = document.createElement("span");
    status.id = "ef-matrix-status";
    status.textContent = MATRIX_PUBLIC_COPY.loading;
    head.append(heading, status);
    const host = document.createElement("div");
    host.id = "ef-heatmap-host";
    host.className = "ef-workbench-heatmap-host";
    matrixPanel.append(head, host);
    requireNode(document, ".view-grid").before(matrixPanel);
  }

  const varnaPanel = requireNode(document, "#varnaViewport").closest(".panel");
  const varnaHeading = varnaPanel?.querySelector(".panel-head h2");
  if (varnaHeading) varnaHeading.textContent = MATRIX_PUBLIC_COPY.secondaryStructure;
  varnaPanel?.querySelector(".varna-zoom-controls")?.remove();
  const legend = varnaPanel?.querySelector(".legend");
  if (legend) legend.textContent = MATRIX_PUBLIC_COPY.structureLegend;

  const molstarHost = requireNode(document, "#molstar-host");
  const molstarPanel = molstarHost.closest(".panel");
  const molstarHeading = molstarPanel?.querySelector(".panel-head h2");
  if (molstarHeading) molstarHeading.textContent = MATRIX_PUBLIC_COPY.structure3d;
  molstarHost.closest(".molstar-view")?.querySelector(".molstar-label")?.replaceChildren("Selected chain");
  shell.querySelector("#molstar-full-host")?.closest(".molstar-view")?.remove();
  shell.querySelector("#molstarFullMeta")?.remove();

  const debug = shell.querySelector(".debug-panel");
  if (debug) {
    debug.removeAttribute("open");
    const summary = debug.querySelector("summary");
    if (summary) summary.textContent = MATRIX_PUBLIC_COPY.loadingDetails;
    debug.querySelector("#benchmarkButton")?.remove();
  }

  const inspector = requireNode(document, "#linked-inspector");
  inspector.replaceChildren();
  const empty = document.createElement("p");
  empty.className = "ef-inspector-empty";
  empty.textContent = MATRIX_PUBLIC_COPY.inspectorEmpty;
  inspector.appendChild(empty);

  return {
    sequence: requireNode(document, "#track-viewport"),
    heatmap: requireNode(document, "#ef-heatmap-host"),
    varna: requireNode(document, "#varnaViewport"),
    molstar: molstarHost,
    error: document.querySelector("#assetStatus") || requireNode(document, "#ef-matrix-status"),
  };
}

export function renderEfWorkbenchMetadata(document, result) {
  const header = result?.controller?.viewHeader;
  if (!header) throw new Error("EF controller missing viewHeader");
  const viewPayload = result?.controller?.viewPayload;
  if (!viewPayload) throw new Error("EF controller missing viewPayload");
  const stats = requireNode(document, "#stats");
  const kind = matrixPublicValueLabel(header);
  const mappedPositions = new Set(
    [...(viewPayload.axis_i || []), ...(viewPayload.axis_j || [])]
      .filter((row) => Number.isInteger(row.pdb_pos) && Number.isInteger(row.varna_index))
      .map((row) => row.pdb_pos)
  );
  const mappedLength = mappedPositions.size;
  stats.replaceChildren(
    metric(document, "Matrix value", kind),
    metric(document, "Matrix size", `${header.n_rows} × ${header.n_cols}`),
    metric(document, "Mapped chain", `${mappedLength} residues`),
    metric(document, "Visible range", `${header.value_min} … ${header.value_max}`),
  );
  if (header.technology) {
    const publicTechnique = matrixPublicTechnique(header);
    stats.appendChild(metric(document, "Technique", publicTechnique.methodLabel));
    stats.appendChild(metric(document, "Category", publicTechnique.categoryLabel));
  }
  const status = document.querySelector("#assetStatus");
  if (status) status.textContent = MATRIX_PUBLIC_COPY.ready;
  const matrixStatus = document.querySelector("#ef-matrix-status");
  if (matrixStatus) matrixStatus.textContent = MATRIX_PUBLIC_COPY.ready;
  const caption = document.querySelector("#viewCaption");
  if (caption) caption.textContent = MATRIX_PUBLIC_COPY.linkedCaption;
}

export function renderEfInteraction(document, event, lockedEvent = null) {
  const active = event?.kind === "hover-clear"
    ? lockedEvent
    : event?.kind === "select-clear"
      ? null
      : event;
  const inspector = requireNode(document, "#linked-inspector");
  const status = document.querySelector("#inspectorStatus");
  const molstarStatus = document.querySelector("#molstar-selection-status");
  if (!active) {
    inspector.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "ef-inspector-empty";
    empty.textContent = MATRIX_PUBLIC_COPY.inspectorEmpty;
    inspector.appendChild(empty);
    if (status) status.textContent = "no residue selected";
    if (molstarStatus) molstarStatus.textContent = "selection: none";
    return;
  }

  const grid = document.createElement("dl");
  grid.className = "inspector-grid ef-inspector-grid";
  if (active.kind === "hover") {
    grid.append(
      inspectorCard(document, "i residue", residueText(active.iResidue)),
      inspectorCard(document, "j residue", residueText(active.jResidue)),
      inspectorCard(document, "Matrix value", Number.isFinite(active.value) ? String(active.value) : "no signal"),
      inspectorCard(document, "State", "hover preview"),
    );
    if (status) status.textContent = `hover i=${active.i} j=${active.j}`;
    if (molstarStatus) molstarStatus.textContent = `hover PDB ${active.iResidue?.pdb_pos ?? "–"} / ${active.jResidue?.pdb_pos ?? "–"}`;
  } else {
    const cellValue = active.cell && Number.isFinite(active.cell.value) ? active.cell.value : "no signal";
    grid.append(
      inspectorCard(document, "Selected residue", residueText(active.residue)),
      inspectorCard(document, "Source", matrixPublicInteractionSource(active.source)),
      inspectorCard(document, "Active axis", `${active.axis} · index ${active.index}`),
      inspectorCard(document, "Matrix cell", active.cell ? `i=${active.cell.i}, j=${active.cell.j}, value=${cellValue}` : "—"),
    );
    if (status) status.textContent = `locked ${active.axis} index ${active.index}`;
    if (molstarStatus) molstarStatus.textContent = `selected PDB ${active.residue?.pdb_pos ?? "–"} ${active.residue?.base || ""}`.trim();
  }
  inspector.replaceChildren(grid);
}
