function requireNode(document, selector) {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`EF Workbench missing required host ${selector}`);
  return node;
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
  if (subtitle) subtitle.textContent = "Linked EF matrix, mapped-chain sequence, VARNA secondary structure, 3D structure, and residue inspector.";

  const controls = shell.querySelector(".controls");
  if (controls) controls.hidden = true;
  shell.querySelectorAll(".technique-filter").forEach((node) => node.remove());
  const trackControls = shell.querySelector(".track-viewport-controls");
  if (trackControls) trackControls.hidden = true;
  const trackHeading = shell.querySelector(".track-panel .panel-head h2");
  if (trackHeading) trackHeading.textContent = "1D mapped chain sequence";
  const trackStatus = shell.querySelector("#trackStatus");
  if (trackStatus) trackStatus.textContent = "click a residue to link matrix, 2D, and 3D";

  let matrixPanel = shell.querySelector(".ef-workbench-matrix-panel");
  if (!matrixPanel) {
    matrixPanel = document.createElement("section");
    matrixPanel.className = "panel ef-workbench-matrix-panel";
    const head = document.createElement("div");
    head.className = "panel-head";
    const heading = document.createElement("h2");
    heading.textContent = "2D contact / pair heatmap";
    const status = document.createElement("span");
    status.id = "ef-matrix-status";
    status.textContent = "loading EF assets…";
    head.append(heading, status);
    const host = document.createElement("div");
    host.id = "ef-heatmap-host";
    host.className = "ef-workbench-heatmap-host";
    matrixPanel.append(head, host);
    requireNode(document, ".view-grid").before(matrixPanel);
  }

  const varnaPanel = requireNode(document, "#varnaViewport").closest(".panel");
  const varnaHeading = varnaPanel?.querySelector(".panel-head h2");
  if (varnaHeading) varnaHeading.textContent = "2D VARNA structure";
  varnaPanel?.querySelector(".varna-zoom-controls")?.remove();
  const legend = varnaPanel?.querySelector(".legend");
  if (legend) legend.textContent = "Colors follow the selected EF matrix row or column.";

  const molstarHost = requireNode(document, "#molstar-host");
  const molstarPanel = molstarHost.closest(".panel");
  const molstarHeading = molstarPanel?.querySelector(".panel-head h2");
  if (molstarHeading) molstarHeading.textContent = "3D linked structure";
  molstarHost.closest(".molstar-view")?.querySelector(".molstar-label")?.replaceChildren("Selected chain");
  shell.querySelector("#molstar-full-host")?.closest(".molstar-view")?.remove();
  shell.querySelector("#molstarFullMeta")?.remove();

  const debug = shell.querySelector(".debug-panel");
  if (debug) {
    debug.removeAttribute("open");
    const summary = debug.querySelector("summary");
    if (summary) summary.textContent = "EF loading details";
    debug.querySelector("#benchmarkButton")?.remove();
  }

  const inspector = requireNode(document, "#linked-inspector");
  inspector.replaceChildren();
  const empty = document.createElement("p");
  empty.className = "ef-inspector-empty";
  empty.textContent = "Hover or select a matrix, sequence, or VARNA position.";
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
  const kind = header.value_kind || header.metric || (header.family === "F" ? "pair coupling" : "contact score");
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
  if (header.technology) stats.appendChild(metric(document, "Technology", header.technology));
  const status = document.querySelector("#assetStatus");
  if (status) status.textContent = "EF assets linked";
  const matrixStatus = document.querySelector("#ef-matrix-status");
  if (matrixStatus) matrixStatus.textContent = `${kind} · ${header.n_rows} × ${header.n_cols}`;
  const caption = document.querySelector("#viewCaption");
  if (caption) caption.textContent = "VARNA and Mol* use the same validated mapped-chain coordinates and EF colors.";
}

export function renderEfInteraction(document, event, lockedEvent = null) {
  const active = event?.kind === "hover-clear" ? lockedEvent : event;
  const inspector = requireNode(document, "#linked-inspector");
  const status = document.querySelector("#inspectorStatus");
  const molstarStatus = document.querySelector("#molstar-selection-status");
  if (!active) {
    inspector.replaceChildren();
    const empty = document.createElement("p");
    empty.className = "ef-inspector-empty";
    empty.textContent = "Hover or select a matrix, sequence, or VARNA position.";
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
      inspectorCard(document, "Source", active.source),
      inspectorCard(document, "Active axis", `${active.axis} · index ${active.index}`),
      inspectorCard(document, "Matrix cell", active.cell ? `i=${active.cell.i}, j=${active.cell.j}, value=${cellValue}` : "—"),
    );
    if (status) status.textContent = `locked ${active.axis} index ${active.index}`;
    if (molstarStatus) molstarStatus.textContent = `selected PDB ${active.residue?.pdb_pos ?? "–"} ${active.residue?.base || ""}`.trim();
  }
  inspector.replaceChildren(grid);
}
