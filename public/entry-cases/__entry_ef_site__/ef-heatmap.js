// ef-heatmap.js — EF matrix renderer linked to the shared Case residue contract.
"use strict";
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const NEUTRAL_GRAY = { r: 200, g: 200, b: 200 };
  const SELECTED_RGB = { r: 155, g: 28, b: 28 };
  const MATRIX_PUBLIC_COPY = Object.freeze({
    position: "PDB pos",
    sequence: "Sequence",
    signal: "Signal",
    sequenceAria: "Sequence with dynamically linked signal",
    contactMap: "Contact / pair map",
    secondaryStructure: "Secondary structure",
    structure3d: "3D structure",
    idleStatus: "Hover a measured cell; click to link a residue or pair across sequence, secondary structure, and 3D structure.",
    noSignalSelected: "no signal selected",
    signalLegend: "Signal · no / negative signal → strong positive signal",
  });
  window.FoldBridgeMatrixPublicCopy = MATRIX_PUBLIC_COPY;

  function svgNode(name, attrs = {}) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function htmlNode(name, className, text) {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function fmt(value) {
    if (!Number.isFinite(value)) return "no signal";
    if (Math.abs(value) >= 100) return value.toFixed(1);
    if (Math.abs(value) >= 10) return value.toFixed(2);
    return value.toFixed(3);
  }

  function publicSourceLabel(source) {
    if (source === "sequence") return MATRIX_PUBLIC_COPY.sequence;
    if (source === "signal") return MATRIX_PUBLIC_COPY.signal;
    if (source === "varna") return MATRIX_PUBLIC_COPY.secondaryStructure;
    if (source === "3d") return MATRIX_PUBLIC_COPY.structure3d;
    return "Linked view";
  }

  function canonicalResidues(residues, header) {
    if (!Array.isArray(residues) || !residues.length) {
      throw new Error("createEfHeatmap requires linked-view residueIndex.residues");
    }
    const byPosition = new Map();
    const seenKeys = new Set();
    const expectedChainKey = `${header?.pdb_id}|chain|${header?.chain}`;
    for (const residue of residues) {
      const position = Number(residue?.labelSeqId);
      const key = String(residue?.residueKey || "");
      if (!Number.isInteger(position) || position < 1 || !key) {
        throw new Error("linked-view residue is missing labelSeqId/residueKey");
      }
      if (byPosition.has(position)) throw new Error(`linked-view has duplicate labelSeqId ${position}`);
      if (seenKeys.has(key)) throw new Error(`linked-view has duplicate residueKey ${key}`);
      if (residue?.chainKey !== expectedChainKey || key !== `${expectedChainKey}|${position}`) {
        throw new Error(`linked-view residue identity ${key || "(missing)"} does not match ${expectedChainKey}`);
      }
      byPosition.set(position, residue);
      seenKeys.add(key);
    }
    return byPosition;
  }

  window.createEfHeatmap = function ({
    sequenceHost,
    heatmapHost,
    varnaHost,
    molstarHost,
    molstarPlugin,
    payload,
    residues,
    onInteraction = () => {},
  }) {
    if (!sequenceHost || !heatmapHost || !varnaHost || !molstarHost) {
      throw new Error("createEfHeatmap requires separate sequence, heatmap, VARNA, and Mol* hosts");
    }
    if (!molstarPlugin || !molstarPlugin.visual) {
      throw new Error("createEfHeatmap requires a molstar plugin with .visual (full-3d linkage required)");
    }
    const core = window.EfHeatmapCore;
    const linkage = window.FoldBridgeResidueLinkage;
    const railApi = window.FoldBridgeResidueRail;
    if (!core || !linkage?.setResidueMarkState || !linkage?.installVarnaHitLayer || !linkage?.wireResidueMark) {
      throw new Error("EF requires the shared FoldBridgeResidueLinkage API");
    }
    if (!railApi?.createResidueRail) throw new Error("EF requires the shared FoldBridgeResidueRail API");

    const sourceViewPayload = payload.header?.render_scope === "mapped_chain"
      ? core.materializeMappedChain(payload)
      : payload;
    core.assertContract(sourceViewPayload);
    const viewPayload = core.presentationPayload(sourceViewPayload);
    const idx = core.buildIndices(viewPayload);
    const H = viewPayload.header;
    const linkedByPosition = canonicalResidues(residues, H);
    const residueKeyForRow = (row) => {
      if (!Number.isInteger(row?.pdb_pos)) return null;
      const residue = linkedByPosition.get(row.pdb_pos);
      if (!residue?.residueKey) throw new Error(`matrix pdb_pos ${row.pdb_pos} has no linked-view residueKey`);
      return residue.residueKey;
    };
    for (const axis of ["i", "j"]) {
      for (const row of viewPayload[`axis_${axis}`]) {
        if (row.pdb_pos == null) continue;
        residueKeyForRow(row);
        if (row.observed !== true && row.observed !== false) {
          throw new Error(`axis_${axis}[${row.matrix_index}] mapped residue is missing boolean observed state`);
        }
      }
    }

    const mappedAxisI = viewPayload.axis_i.filter((row) => Number.isInteger(row.pdb_pos) && Number.isInteger(row.varna_index));
    const mappedAxisJ = viewPayload.axis_j.filter((row) => Number.isInteger(row.pdb_pos) && Number.isInteger(row.varna_index));
    const sequenceAxis = mappedAxisJ.length > mappedAxisI.length ? "j" : "i";
    const sequenceRows = sequenceAxis === "j" ? mappedAxisJ : mappedAxisI;
    const focusChain = H.focus_chain === true;
    const isE = String(H.family || "").toUpperCase() === "E" || H.value_kind === "cohcoa_contact";
    const state = { hoveredCell: null, selected: null, selectedCell: null, selectedKeys: [], keyboardCell: null, sequenceAxis };
    const cleanup = [];

    const PLOT_X = 19;
    const PLOT_Y = 10;
    const PLOT_W = H.n_cols;
    const PLOT_H = H.n_rows;
    const TOTAL_W = PLOT_X + PLOT_W + 18;
    const TOTAL_H = PLOT_Y + PLOT_H + 22;

    sequenceHost.innerHTML = "";
    heatmapHost.innerHTML = "";
    const root = htmlNode("div", "ef-heatmap-component");
    const idleText = MATRIX_PUBLIC_COPY.idleStatus;
    const status = htmlNode("div", "ef-interaction-status", idleText);
    root.appendChild(status);

    const sequenceRail = railApi.createResidueRail(document, {
      positions: sequenceRows,
      rows: [[MATRIX_PUBLIC_COPY.position, 24], [MATRIX_PUBLIC_COPY.sequence, 52], [MATRIX_PUBLIC_COPY.signal, 84]],
      height: 118,
      ariaLabel: MATRIX_PUBLIC_COPY.sequenceAria,
      positionLabel: (row) => String(row.pdb_pos),
    });
    const sequenceTrack = sequenceRail.svg;
    sequenceTrack.classList.add("ef-sequence-track");
    const sequenceMarks = [];
    const intensityMarksByPdb = new Map();
    const intensityTargetsByPdb = new Map();
    const intensityBarsByPdb = new Map();
    const intensityTitlesByPdb = new Map();
    const noSignalColor = core.colorForValue(null, H);
    const noSignalFill = `rgb(${noSignalColor.r},${noSignalColor.g},${noSignalColor.b})`;
    let varnaSvg = null;

    function setLinkedState(className, rows) {
      const keys = (rows || []).map(residueKeyForRow).filter(Boolean);
      linkage.setResidueMarkState(sequenceHost, className, keys);
      if (varnaSvg) linkage.setResidueMarkState(varnaSvg, className, keys);
      return keys;
    }

    function wireSequenceMark(mark, visibleMark, row, trackKind, publicSource) {
      const residueKey = residueKeyForRow(row);
      mark.setAttribute("data-residue-key", residueKey);
      mark.setAttribute("data-pdb-pos", row.pdb_pos);
      mark.setAttribute("data-track-kind", trackKind);
      visibleMark.setAttribute("data-residue-key", residueKey);
      visibleMark.setAttribute("data-pdb-pos", row.pdb_pos);
      mark.setAttribute("data-index", row.matrix_index);
      mark.setAttribute("aria-pressed", "false");
      const dispose = linkage.wireResidueMark(mark, {
        onHover: (event) => showResidueHover(row, publicSource, event),
        onLeave: () => clearHover(publicSource),
        onSelect: () => selectAxis(sequenceAxis, row.matrix_index, publicSource),
      });
      cleanup.push(dispose);
      sequenceMarks.push(mark);
    }

    sequenceRows.forEach((row, position) => {
      const x = sequenceRail.xForIndex(position);
      const residueKey = residueKeyForRow(row);
      const baseTarget = svgNode("g", {
        class: "ef-sequence-target residue-mark", "data-hit-width": sequenceRail.hitWidth,
        "data-residue-key": residueKey, "aria-label": `PDB ${row.pdb_pos} ${row.base || ""}; select residue`,
      });
      baseTarget.appendChild(svgNode("rect", {
        class: "ef-sequence-hit", x: x - sequenceRail.hitWidth / 2, y: 40,
        width: sequenceRail.hitWidth, height: 24, rx: 1,
      }));
      const base = svgNode("rect", {
        class: "ef-sequence-base residue-mark", x: x - sequenceRail.cellWidth / 2, y: 40,
        width: sequenceRail.cellWidth, height: 24, rx: 1,
        "data-base": String(row.base || "N").toUpperCase(), "data-residue-key": residueKey,
      });
      baseTarget.appendChild(base);
      wireSequenceMark(baseTarget, base, row, "mapped_chain_sequence", "sequence");
      sequenceTrack.appendChild(baseTarget);
      const baseLetter = svgNode("text", { class: "ef-sequence-letter", x, y: 56, "text-anchor": "middle" });
      baseLetter.textContent = row.base || "·";
      sequenceTrack.appendChild(baseLetter);

      const intensityTarget = svgNode("g", {
        class: "ef-sequence-target residue-mark", "data-hit-width": sequenceRail.hitWidth,
        "data-residue-key": residueKey, "aria-label": `PDB ${row.pdb_pos} ${row.base || ""}; ${MATRIX_PUBLIC_COPY.noSignalSelected}`,
      });
      intensityTarget.appendChild(svgNode("rect", {
        class: "ef-sequence-hit", x: x - sequenceRail.hitWidth / 2, y: 76,
        width: sequenceRail.hitWidth, height: 24, rx: 1,
      }));
      const intensity = svgNode("rect", {
        class: "ef-sequence-intensity residue-mark", x: x - sequenceRail.cellWidth / 2, y: 76,
        width: sequenceRail.cellWidth, height: 24, rx: 1, fill: noSignalFill, "data-residue-key": residueKey,
      });
      intensityTarget.appendChild(intensity);
      wireSequenceMark(intensityTarget, intensity, row, "ef_intensity", "signal");
      const intensityTitle = svgNode("title");
      intensityTitle.textContent = `PDB ${row.pdb_pos} ${row.base || ""} · ${MATRIX_PUBLIC_COPY.noSignalSelected}`;
      intensityTarget.appendChild(intensityTitle);
      sequenceTrack.appendChild(intensityTarget);
      const bar = svgNode("rect", { class: "ef-intensity-bar", x: x - 2, y: 99, width: 4, height: 0, visibility: "hidden" });
      sequenceTrack.appendChild(bar);
      intensityMarksByPdb.set(row.pdb_pos, intensity);
      intensityTargetsByPdb.set(row.pdb_pos, intensityTarget);
      intensityBarsByPdb.set(row.pdb_pos, bar);
      intensityTitlesByPdb.set(row.pdb_pos, intensityTitle);
    });
    sequenceHost.appendChild(sequenceTrack);

    const plotWrap = htmlNode("div", "ef-plot-wrap");
    const svg = svgNode("svg", {
      class: "ef-matrix-svg", viewBox: `0 0 ${TOTAL_W} ${TOTAL_H}`,
      preserveAspectRatio: "xMidYMid meet", role: "group",
      "aria-label": `${MATRIX_PUBLIC_COPY.contactMap}, ${H.n_rows} by ${H.n_cols}, PDB chain coordinates`,
    });
    svg.appendChild(svgNode("rect", { class: "ef-matrix-background", x: PLOT_X, y: PLOT_Y, width: PLOT_W, height: PLOT_H }));
    const gCells = svgNode("g", { class: "ef-cells" });
    for (const [i, j, value] of viewPayload.cells) {
      const color = core.colorForValue(value, H);
      gCells.appendChild(svgNode("rect", {
        x: PLOT_X + j, y: PLOT_Y + i, width: 1.02, height: 1.02,
        fill: `rgb(${color.r},${color.g},${color.b})`, "data-i": i, "data-j": j,
      }));
    }
    svg.appendChild(gCells);
    svg.appendChild(svgNode("rect", { class: "ef-matrix-border", x: PLOT_X, y: PLOT_Y, width: PLOT_W, height: PLOT_H }));

    const gAxes = svgNode("g", { class: "ef-axes" });
    const tickStep = Math.max(1, Math.ceil(Math.max(H.n_rows, H.n_cols) / 12 / 5) * 5);
    function addTick(axis, index, row) {
      const label = String(row?.pdb_pos ?? index + 1);
      if (axis === "j") {
        const x = PLOT_X + index + 0.5;
        gAxes.appendChild(svgNode("line", { class: "ef-axis-tick-line", x1: x, y1: PLOT_Y - 1.2, x2: x, y2: PLOT_Y }));
        const text = svgNode("text", { x, y: PLOT_Y - 2, "text-anchor": "middle", "font-size": 2.7, class: "ef-axis-tick ef-axis-j", "data-index": index });
        text.textContent = label;
        const click = () => selectAxis("j", index, "axis-j");
        text.addEventListener("click", click); cleanup.push(() => text.removeEventListener("click", click)); gAxes.appendChild(text);
      } else {
        const y = PLOT_Y + index + 0.75;
        gAxes.appendChild(svgNode("line", { class: "ef-axis-tick-line", x1: PLOT_X - 1.2, y1: y, x2: PLOT_X, y2: y }));
        const text = svgNode("text", { x: PLOT_X - 2, y, "text-anchor": "end", "font-size": 2.7, class: "ef-axis-tick ef-axis-i", "data-index": index });
        text.textContent = label;
        const click = () => selectAxis("i", index, "axis-i");
        text.addEventListener("click", click); cleanup.push(() => text.removeEventListener("click", click)); gAxes.appendChild(text);
      }
    }
    viewPayload.axis_j.forEach((row, index) => {
      if (index === 0 || index === H.n_cols - 1 || (row.pdb_pos ?? index + 1) % tickStep === 0) addTick("j", index, row);
    });
    viewPayload.axis_i.forEach((row, index) => {
      if (index === 0 || index === H.n_rows - 1 || (row.pdb_pos ?? index + 1) % tickStep === 0) addTick("i", index, row);
    });
    const xTitle = svgNode("text", { class: "ef-axis-title", x: PLOT_X + PLOT_W / 2, y: TOTAL_H - 2, "text-anchor": "middle", "font-size": 3.2, "font-weight": 600 });
    xTitle.textContent = "j · PDB residue"; gAxes.appendChild(xTitle);
    const yTitle = svgNode("text", { class: "ef-axis-title", x: 3.2, y: PLOT_Y + PLOT_H / 2, "text-anchor": "middle", "font-size": 3.2, "font-weight": 600, transform: `rotate(-90 3.2 ${PLOT_Y + PLOT_H / 2})` });
    yTitle.textContent = "i · PDB residue"; gAxes.appendChild(yTitle); svg.appendChild(gAxes);

    const gSelection = svgNode("g", { class: "ef-selection", "pointer-events": "none" });
    const selectedRow = svgNode("rect", { class: "ef-selection-row", visibility: "hidden" });
    const selectedCol = svgNode("rect", { class: "ef-selection-column", visibility: "hidden" });
    const selectedCell = svgNode("rect", { class: "ef-selection-cell", visibility: "hidden" });
    gSelection.appendChild(selectedRow); gSelection.appendChild(selectedCol); gSelection.appendChild(selectedCell); svg.appendChild(gSelection);
    const gHover = svgNode("g", { class: "ef-hover", "pointer-events": "none", visibility: "hidden" });
    const hoverH = svgNode("line", { class: "ef-hover-guide", visibility: "hidden" });
    const hoverV = svgNode("line", { class: "ef-hover-guide", visibility: "hidden" });
    const hoverCell = svgNode("rect", { class: "ef-hover-cell", visibility: "hidden" });
    gHover.appendChild(hoverH); gHover.appendChild(hoverV); gHover.appendChild(hoverCell); svg.appendChild(gHover);
    const overlay = svgNode("rect", { x: PLOT_X, y: PLOT_Y, width: PLOT_W, height: PLOT_H, fill: "transparent", class: "ef-hitgrid", tabindex: 0 });
    svg.appendChild(overlay); plotWrap.appendChild(svg);
    const tooltip = htmlNode("div", "ef-tooltip"); tooltip.setAttribute("role", "status"); plotWrap.appendChild(tooltip);
    root.appendChild(plotWrap);
    const colorbar = htmlNode("div", "ef-colorbar");
    colorbar.appendChild(htmlNode("div", "ef-colorbar-title", MATRIX_PUBLIC_COPY.signalLegend));
    const legendRow = htmlNode("div", "ef-colorbar-row");
    legendRow.appendChild(htmlNode("span", "ef-colorbar-min", "≤ 0"));
    legendRow.appendChild(htmlNode("span", "rmdb-heatmap-gradient ef-colorbar-ramp"));
    legendRow.appendChild(htmlNode("span", "ef-colorbar-max", fmt(H.value_max)));
    colorbar.appendChild(legendRow); root.appendChild(colorbar); heatmapHost.appendChild(root);

    varnaSvg = varnaHost.querySelector("svg");
    if (!varnaSvg) throw new Error("EF linkage requires a loaded VARNA SVG");
    const circles = Array.from(varnaSvg.querySelectorAll('circle[stroke="none"][r="5.0"]'));
    if (!circles.length) throw new Error("EF linkage found no VARNA nucleotide circles");
    const orderedResidues = Array.from(linkedByPosition.values()).sort((a, b) => a.labelSeqId - b.labelSeqId);
    if (orderedResidues.length !== circles.length) {
      throw new Error(`VARNA/linked residue identity mismatch: circles=${circles.length}, residues=${orderedResidues.length}`);
    }
    const originalVarnaFills = circles.map((circle) => circle.getAttribute("fill"));
    const varnaHits = linkage.installVarnaHitLayer(document, varnaSvg, circles, orderedResidues.map((row) => row.residueKey));
    const matrixRefByKey = new Map();
    for (const axis of [sequenceAxis, sequenceAxis === "i" ? "j" : "i"]) {
      for (const row of viewPayload[`axis_${axis}`]) {
        if (!Number.isInteger(row.pdb_pos)) continue;
        const key = residueKeyForRow(row);
        if (!matrixRefByKey.has(key)) matrixRefByKey.set(key, { axis, index: row.matrix_index, row });
      }
    }

    function observedTargets(rows, color = null) {
      return rows.filter((row) => row?.observed === true && Number.isInteger(row.pdb_pos)).map((row) => ({
        struct_asym_id: H.label_asym_id, start_residue_number: row.pdb_pos, end_residue_number: row.pdb_pos,
        ...(color ? { color } : {}),
      }));
    }

    function recolorVarna(colorMap = new Map()) {
      circles.forEach((circle, index) => {
        const fill = originalVarnaFills[index];
        if (fill == null) circle.removeAttribute("fill"); else circle.setAttribute("fill", fill);
      });
      colorMap.forEach((rgb, varnaIndex) => {
        const circle = circles[varnaIndex];
        if (!circle) throw new Error(`recolorVarna: varna_index ${varnaIndex} outside ${circles.length} circles`);
        circle.setAttribute("fill", rgb);
      });
    }

    function hideHoverGuides() {
      gHover.setAttribute("visibility", "hidden"); hoverH.setAttribute("visibility", "hidden");
      hoverV.setAttribute("visibility", "hidden"); hoverCell.setAttribute("visibility", "hidden");
    }
    function showPairGuides(i, j) {
      gHover.setAttribute("visibility", "visible");
      hoverH.setAttribute("visibility", "visible"); hoverH.setAttribute("x1", PLOT_X); hoverH.setAttribute("x2", PLOT_X + PLOT_W);
      hoverH.setAttribute("y1", PLOT_Y + i + 0.5); hoverH.setAttribute("y2", PLOT_Y + i + 0.5);
      hoverV.setAttribute("visibility", "visible"); hoverV.setAttribute("x1", PLOT_X + j + 0.5); hoverV.setAttribute("x2", PLOT_X + j + 0.5);
      hoverV.setAttribute("y1", PLOT_Y); hoverV.setAttribute("y2", PLOT_Y + PLOT_H);
      hoverCell.setAttribute("visibility", "visible"); hoverCell.setAttribute("x", PLOT_X + j); hoverCell.setAttribute("y", PLOT_Y + i);
      hoverCell.setAttribute("width", 1); hoverCell.setAttribute("height", 1);
    }
    function showResidueGuides(row) {
      hideHoverGuides();
      if (!Number.isInteger(row?.pdb_pos)) return;
      const i = idx.axisByPdbPos.i.get(row.pdb_pos); const j = idx.axisByPdbPos.j.get(row.pdb_pos);
      if (!Number.isInteger(i) && !Number.isInteger(j)) return;
      gHover.setAttribute("visibility", "visible");
      if (Number.isInteger(i)) {
        hoverH.setAttribute("visibility", "visible"); hoverH.setAttribute("x1", PLOT_X); hoverH.setAttribute("x2", PLOT_X + PLOT_W);
        hoverH.setAttribute("y1", PLOT_Y + i + 0.5); hoverH.setAttribute("y2", PLOT_Y + i + 0.5);
      }
      if (Number.isInteger(j)) {
        hoverV.setAttribute("visibility", "visible"); hoverV.setAttribute("x1", PLOT_X + j + 0.5); hoverV.setAttribute("x2", PLOT_X + j + 0.5);
        hoverV.setAttribute("y1", PLOT_Y); hoverV.setAttribute("y2", PLOT_Y + PLOT_H);
      }
    }
    function showResidueHover(row, source, event = null) {
      if (!row) return;
      state.hoveredCell = null; setLinkedState("hovered", [row]); showResidueGuides(row);
      status.textContent = `hover ${publicSourceLabel(source)} · PDB ${row.pdb_pos} ${row.base || ""}`;
      if (source !== "3d") {
        const targets = observedTargets([row]); if (targets.length) molstarPlugin.visual.highlight({ data: targets });
      }
      if (event) tooltip.style.display = "none";
      onInteraction({ kind: "hover", source, residue: row });
    }
    function clearHover(source = "matrix") {
      state.hoveredCell = null;
      linkage.setResidueMarkState(sequenceHost, "hovered", null); linkage.setResidueMarkState(varnaSvg, "hovered", null);
      hideHoverGuides(); tooltip.style.display = "none"; molstarPlugin.visual.clearHighlight();
      if (!state.selected) status.textContent = idleText;
      onInteraction({ kind: "hover-clear", source });
    }

    function pointInSvg(event) {
      if (typeof svg.createSVGPoint === "function" && svg.getScreenCTM?.()) {
        const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
        return point.matrixTransform(svg.getScreenCTM().inverse());
      }
      const box = svg.getBoundingClientRect();
      return { x: (event.clientX - box.left) * TOTAL_W / box.width, y: (event.clientY - box.top) * TOTAL_H / box.height };
    }
    function cellFromEvent(event) {
      const point = pointInSvg(event);
      return { i: Math.min(H.n_rows - 1, Math.max(0, Math.floor(point.y - PLOT_Y))), j: Math.min(H.n_cols - 1, Math.max(0, Math.floor(point.x - PLOT_X))) };
    }
    function cellAt(i, j) {
      const key = `${i},${j}`;
      if (!idx.cellMap.has(key)) return null;
      const value = idx.cellMap.get(key);
      return { i, j, value, iResidue: idx.axisByIndex.i.get(i), jResidue: idx.axisByIndex.j.get(j) };
    }
    function showCellHover(cell, event) {
      state.hoveredCell = { i_index: cell.i, j_index: cell.j }; showPairGuides(cell.i, cell.j);
      setLinkedState("hovered", [cell.iResidue, cell.jResidue]);
      const valueText = fmt(cell.value);
      tooltip.textContent = `value ${valueText} · i ${cell.iResidue?.pdb_pos ?? "–"} ${cell.iResidue?.base || ""} · j ${cell.jResidue?.pdb_pos ?? "–"} ${cell.jResidue?.base || ""}`;
      tooltip.style.display = "block";
      const wrapBox = plotWrap.getBoundingClientRect();
      tooltip.style.left = `${Math.max(4, Math.min(wrapBox.width - 250, event.clientX - wrapBox.left + 12))}px`;
      tooltip.style.top = `${Math.max(4, event.clientY - wrapBox.top + 12)}px`;
      status.textContent = `i ${cell.iResidue?.pdb_pos ?? "–"} × j ${cell.jResidue?.pdb_pos ?? "–"} · ${valueText}`;
      const targets = observedTargets([cell.iResidue, cell.jResidue]); if (targets.length) molstarPlugin.visual.highlight({ data: targets });
      onInteraction({ kind: "hover", source: "matrix", ...cell });
    }
    function onMove(event) {
      const { i, j } = cellFromEvent(event); const cell = cellAt(i, j);
      if (!cell) { clearHover("matrix-masked"); return; }
      state.keyboardCell = { i, j }; showCellHover(cell, event);
    }

    function markSelectedCell(cell) {
      state.selectedCell = { i_index: cell.i, j_index: cell.j };
      selectedCell.setAttribute("x", PLOT_X + cell.j); selectedCell.setAttribute("y", PLOT_Y + cell.i);
      selectedCell.setAttribute("width", 1); selectedCell.setAttribute("height", 1); selectedCell.setAttribute("visibility", "visible");
    }
    function clearSequenceIntensity() {
      for (const row of sequenceRows) {
        const intensity = intensityMarksByPdb.get(row.pdb_pos); const target = intensityTargetsByPdb.get(row.pdb_pos);
        const bar = intensityBarsByPdb.get(row.pdb_pos); const title = intensityTitlesByPdb.get(row.pdb_pos);
        intensity.setAttribute("fill", noSignalFill); intensity.setAttribute("data-value", ""); target.setAttribute("data-value", "");
        target.setAttribute("aria-label", `PDB ${row.pdb_pos} ${row.base || ""}; ${MATRIX_PUBLIC_COPY.noSignalSelected}`);
        title.textContent = `PDB ${row.pdb_pos} ${row.base || ""} · ${MATRIX_PUBLIC_COPY.noSignalSelected}`;
        bar.setAttribute("height", 0); bar.setAttribute("visibility", "hidden");
      }
    }
    function sliceEntries(axis, index) {
      const selected = idx.axisByIndex[axis].get(index); if (!selected) return [];
      const byPartnerPdb = new Map();
      const add = (entries, partnerAxis, partnerField) => {
        for (const entry of entries) {
          const partner = idx.axisByIndex[partnerAxis].get(entry[partnerField]);
          if (Number.isInteger(partner?.pdb_pos)) byPartnerPdb.set(partner.pdb_pos, { partner, value: entry.value });
        }
      };
      if (isE) {
        const i = idx.axisByPdbPos.i.get(selected.pdb_pos); const j = idx.axisByPdbPos.j.get(selected.pdb_pos);
        if (Number.isInteger(i)) add(idx.rowIndex.get(i) || [], "j", "j");
        if (Number.isInteger(j)) add(idx.colIndex.get(j) || [], "i", "i");
      } else if (axis === "i") add(idx.rowIndex.get(index) || [], "j", "j");
      else add(idx.colIndex.get(index) || [], "i", "i");
      return Array.from(byPartnerPdb.values());
    }
    function updateSequenceIntensity(axis, index) {
      const values = new Map(sliceEntries(axis, index).map((entry) => [entry.partner.pdb_pos, entry.value]));
      const maximum = Math.max(0, Number(H.value_max) || 0) || 1;
      for (const row of sequenceRows) {
        const value = values.get(row.pdb_pos); const color = core.colorForValue(value ?? null, H);
        const intensity = intensityMarksByPdb.get(row.pdb_pos); const target = intensityTargetsByPdb.get(row.pdb_pos);
        const bar = intensityBarsByPdb.get(row.pdb_pos); const title = intensityTitlesByPdb.get(row.pdb_pos);
        const valueLabel = Number.isFinite(value) ? fmt(value) : "no signal";
        intensity.setAttribute("fill", `rgb(${color.r},${color.g},${color.b})`);
        intensity.setAttribute("data-value", Number.isFinite(value) ? String(value) : ""); target.setAttribute("data-value", Number.isFinite(value) ? String(value) : "");
        target.setAttribute("aria-label", `PDB ${row.pdb_pos} ${row.base || ""}; ${MATRIX_PUBLIC_COPY.signal} ${valueLabel}`);
        title.textContent = `PDB ${row.pdb_pos} ${row.base || ""} · ${MATRIX_PUBLIC_COPY.signal} ${valueLabel}`;
        const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value / maximum)) : 0;
        const barHeight = normalized > 0 ? Math.max(1, Math.round(normalized * 21)) : 0;
        bar.setAttribute("y", 99 - barHeight); bar.setAttribute("height", barHeight); bar.setAttribute("visibility", barHeight ? "visible" : "hidden");
      }
    }
    function sliceVarnaColors(axis, index) {
      const colors = new Map();
      for (const { partner, value } of sliceEntries(axis, index)) {
        if (!Number.isInteger(partner.varna_index)) continue;
        const color = core.colorForValue(value, H); colors.set(partner.varna_index, `rgb(${color.r},${color.g},${color.b})`);
      }
      return colors;
    }
    function sliceMolstarTargets(axis, index) {
      return sliceEntries(axis, index).filter(({ partner }) => partner.observed === true).map(({ partner, value }) => ({
        struct_asym_id: H.label_asym_id, start_residue_number: partner.pdb_pos, end_residue_number: partner.pdb_pos,
        color: core.colorForValue(value, H),
      }));
    }
    function clearSelection(source = "clear") {
      state.selected = null; state.selectedCell = null; state.selectedKeys = [];
      selectedRow.setAttribute("visibility", "hidden"); selectedCol.setAttribute("visibility", "hidden"); selectedCell.setAttribute("visibility", "hidden");
      linkage.setResidueMarkState(sequenceHost, "selected", null); linkage.setResidueMarkState(varnaSvg, "selected", null);
      sequenceMarks.forEach((mark) => mark.setAttribute("aria-pressed", "false"));
      clearSequenceIntensity(); recolorVarna();
      if (focusChain) molstarPlugin.visual.select(core.buildMolstarChainFocusPayload(viewPayload));
      status.textContent = idleText; onInteraction({ kind: "select-clear", source });
    }
    function selectAxis(axis, index, source = `axis-${axis}`, cell = null) {
      if ((axis !== "i" && axis !== "j") || !Number.isInteger(index)) throw new Error(`selectAxis requires i/j and an integer index; received ${axis}/${index}`);
      const limit = axis === "i" ? H.n_rows : H.n_cols;
      if (index < 0 || index >= limit) throw new Error(`selectAxis ${axis} index ${index} outside 0-${limit - 1}`);
      const row = idx.axisByIndex[axis].get(index); const selectedRows = cell ? [cell.iResidue, cell.jResidue] : [row];
      const signature = cell ? `cell:${cell.i}:${cell.j}` : `axis:${axis}:${index}`;
      if (state.selected?.signature === signature) { clearSelection(source); return; }
      state.selected = { axis, index, source, signature }; state.selectedKeys = selectedRows.map(residueKeyForRow).filter(Boolean);
      if (cell) {
        markSelectedCell(cell);
        selectedRow.setAttribute("x", PLOT_X); selectedRow.setAttribute("y", PLOT_Y + cell.i); selectedRow.setAttribute("width", PLOT_W); selectedRow.setAttribute("height", 1); selectedRow.setAttribute("visibility", "visible");
        selectedCol.setAttribute("x", PLOT_X + cell.j); selectedCol.setAttribute("y", PLOT_Y); selectedCol.setAttribute("width", 1); selectedCol.setAttribute("height", PLOT_H); selectedCol.setAttribute("visibility", "visible");
      } else if (axis === "i") {
        state.selectedCell = null; selectedCell.setAttribute("visibility", "hidden");
        selectedRow.setAttribute("x", PLOT_X); selectedRow.setAttribute("y", PLOT_Y + index); selectedRow.setAttribute("width", PLOT_W); selectedRow.setAttribute("height", 1); selectedRow.setAttribute("visibility", "visible"); selectedCol.setAttribute("visibility", "hidden");
      } else {
        state.selectedCell = null; selectedCell.setAttribute("visibility", "hidden");
        selectedCol.setAttribute("x", PLOT_X + index); selectedCol.setAttribute("y", PLOT_Y); selectedCol.setAttribute("width", 1); selectedCol.setAttribute("height", PLOT_H); selectedCol.setAttribute("visibility", "visible"); selectedRow.setAttribute("visibility", "hidden");
      }
      setLinkedState("selected", selectedRows);
      const activeKeys = linkage.residueKeySet(state.selectedKeys);
      sequenceMarks.forEach((mark) => mark.setAttribute("aria-pressed", activeKeys.has(mark.getAttribute("data-residue-key")) ? "true" : "false"));
      updateSequenceIntensity(axis, index); recolorVarna(sliceVarnaColors(axis, index));
      const selectionByPosition = new Map();
      sliceMolstarTargets(axis, index).forEach((target) => selectionByPosition.set(target.start_residue_number, target));
      observedTargets(selectedRows, SELECTED_RGB).forEach((target) => selectionByPosition.set(target.start_residue_number, target));
      const selectionData = [...selectionByPosition.values()];
      molstarPlugin.visual.select({ data: selectionData, nonSelectedColor: focusChain ? { r: 255, g: 255, b: 255 } : NEUTRAL_GRAY });
      status.textContent = cell
        ? `locked pair · i ${cell.iResidue?.pdb_pos ?? "–"} × j ${cell.jResidue?.pdb_pos ?? "–"} · ${fmt(cell.value)}`
        : `locked ${axis} · PDB ${row?.pdb_pos ?? "–"} ${row?.base || ""} · ${isE ? "row and column" : `${axis}-axis`} signal`;
      onInteraction({ kind: "select", source, axis, index, residue: row, cell, residueKeys: [...state.selectedKeys] });
    }
    function selectCell(i, j, source = "matrix") { const cell = cellAt(i, j); if (!cell) return false; selectAxis("i", i, source, cell); return true; }
    function onClick(event) { const { i, j } = cellFromEvent(event); selectCell(i, j, "matrix"); }
    function firstDisplayCell() { const cell = viewPayload.cells[0]; return cell ? { i: cell[0], j: cell[1] } : null; }
    function moveKeyboardCell(di, dj) {
      let current = state.keyboardCell || firstDisplayCell(); if (!current) return null;
      for (let step = 0; step < H.n_rows + H.n_cols; step += 1) {
        const i = Math.max(0, Math.min(H.n_rows - 1, current.i + di)); const j = Math.max(0, Math.min(H.n_cols - 1, current.j + dj));
        current = { i, j }; if (cellAt(i, j)) return current;
        if ((i === 0 && di < 0) || (i === H.n_rows - 1 && di > 0) || (j === 0 && dj < 0) || (j === H.n_cols - 1 && dj > 0)) break;
      }
      return state.keyboardCell;
    }
    function onGridKeydown(event) {
      const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[event.key]) {
        event.preventDefault(); state.keyboardCell = moveKeyboardCell(...moves[event.key]);
        const cell = state.keyboardCell && cellAt(state.keyboardCell.i, state.keyboardCell.j);
        if (cell) showCellHover(cell, { clientX: 0, clientY: 0 });
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault(); const current = state.keyboardCell || firstDisplayCell(); if (current) selectCell(current.i, current.j, "matrix-keyboard");
      } else if (event.key === "Escape") { event.preventDefault(); clearSelection("matrix-keyboard"); }
    }

    overlay.addEventListener("mousemove", onMove); overlay.addEventListener("mouseleave", () => clearHover("matrix"));
    overlay.addEventListener("click", onClick); overlay.addEventListener("keydown", onGridKeydown);
    cleanup.push(() => overlay.removeEventListener("mousemove", onMove)); cleanup.push(() => overlay.removeEventListener("click", onClick)); cleanup.push(() => overlay.removeEventListener("keydown", onGridKeydown));
    varnaHits.forEach((hit) => {
      const ref = matrixRefByKey.get(hit.getAttribute("data-residue-key")); if (!ref) return;
      cleanup.push(linkage.wireResidueMark(hit, {
        onHover: (event) => showResidueHover(ref.row, "varna", event), onLeave: () => clearHover("varna"),
        onSelect: () => selectAxis(ref.axis, ref.index, "varna"),
      }));
    });

    function selectPdbPosition(pdbPosition, source = "3d") {
      if (!Number.isInteger(pdbPosition)) return false;
      const residue = linkedByPosition.get(pdbPosition); const ref = residue && matrixRefByKey.get(residue.residueKey);
      if (!ref) return false; selectAxis(ref.axis, ref.index, source); return true;
    }
    function hoverPdbPosition(pdbPosition, source = "3d") {
      if (!Number.isInteger(pdbPosition)) return false;
      const residue = linkedByPosition.get(pdbPosition); const ref = residue && matrixRefByKey.get(residue.residueKey);
      if (!ref) return false; showResidueHover(ref.row, source); return true;
    }
    function onMolstarClick(event) { const pos = core.pdbPositionFromMolstarEvent(event, H); if (pos != null) selectPdbPosition(pos, "3d"); }
    function onMolstarMouseover(event) { const pos = core.pdbPositionFromMolstarEvent(event, H); if (pos != null) hoverPdbPosition(pos, "3d"); }
    function onMolstarMouseout() { clearHover("3d"); }
    molstarHost.addEventListener("PDB.molstar.click", onMolstarClick); molstarHost.addEventListener("PDB.molstar.mouseover", onMolstarMouseover); molstarHost.addEventListener("PDB.molstar.mouseout", onMolstarMouseout);
    cleanup.push(() => molstarHost.removeEventListener("PDB.molstar.click", onMolstarClick)); cleanup.push(() => molstarHost.removeEventListener("PDB.molstar.mouseover", onMolstarMouseover)); cleanup.push(() => molstarHost.removeEventListener("PDB.molstar.mouseout", onMolstarMouseout));

    if (focusChain) molstarPlugin.visual.select(core.buildMolstarChainFocusPayload(viewPayload));
    return {
      viewHeader: H, state, selectAxis, selectCell, selectPdbPosition, hoverPdbPosition, clearSelection, viewPayload, sourceViewPayload,
      destroy() { cleanup.forEach((fn) => fn()); clearHover("destroy"); sequenceHost.innerHTML = ""; heatmapHost.innerHTML = ""; },
    };
  };
})();
