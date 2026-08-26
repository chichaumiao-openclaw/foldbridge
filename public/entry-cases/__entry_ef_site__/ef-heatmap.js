// ef-heatmap.js — EF matrix renderer and linked 1D / 2D / 3D interactions.
"use strict";
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const NEUTRAL_GRAY = { r: 200, g: 200, b: 200 };

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

  window.createEfHeatmap = function ({ sequenceHost, heatmapHost, varnaHost, molstarHost, molstarPlugin, payload, onInteraction = () => {} }) {
    if (!sequenceHost || !heatmapHost || !varnaHost || !molstarHost) {
      throw new Error("createEfHeatmap requires separate sequence, heatmap, VARNA, and Mol* hosts");
    }
    if (!molstarPlugin || !molstarPlugin.visual) {
      throw new Error("createEfHeatmap requires a molstar plugin with .visual (full-3d linkage required)");
    }
    const core = window.EfHeatmapCore;
    const viewPayload = payload.header?.render_scope === "mapped_chain"
      ? core.materializeMappedChain(payload)
      : payload;
    core.assertContract(viewPayload);
    const idx = core.buildIndices(viewPayload);
    const H = viewPayload.header;
    const mappedAxisI = viewPayload.axis_i.filter((row) =>
      Number.isInteger(row.pdb_pos) && Number.isInteger(row.varna_index)
    );
    const mappedAxisJ = viewPayload.axis_j.filter((row) =>
      Number.isInteger(row.pdb_pos) && Number.isInteger(row.varna_index)
    );
    const sequenceAxis = mappedAxisJ.length > mappedAxisI.length ? "j" : "i";
    const sequenceRows = sequenceAxis === "j" ? mappedAxisJ : mappedAxisI;
    const focusChain = H.focus_chain === true;
    const state = { hoveredCell: null, selected: null, selectedCell: null };
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
    const status = htmlNode("div", "ef-interaction-status", "Hover a cell; click to lock its row and recolor 2D / 3D");
    root.appendChild(status);

    const sequenceHeight = 118;
    const sequenceLeft = 210;
    const sequenceRight = 18;
    const sequenceWidth = Math.max(1120, sequenceLeft + sequenceRight + sequenceRows.length * 24);
    const sequenceUsable = sequenceWidth - sequenceLeft - sequenceRight;
    const sequenceX = (position) => sequenceLeft + ((position + 0.5) / sequenceRows.length) * sequenceUsable;
    const sequenceHitWidth = Math.max(24, sequenceUsable / sequenceRows.length);
    const sequenceCellWidth = Math.max(4, sequenceHitWidth - 1);
    const sequenceTrack = svgNode("svg", {
      class: "ef-sequence-track",
      viewBox: `0 0 ${sequenceWidth} ${sequenceHeight}`,
      width: sequenceWidth,
      height: sequenceHeight,
      role: "group",
      "aria-label": "1D mapped chain sequence and dynamically linked EF intensity",
    });
    sequenceTrack.appendChild(svgNode("rect", {
      class: "ef-sequence-background", x: 0, y: 0, width: sequenceWidth, height: sequenceHeight,
    }));
    for (const [label, y] of [["PDB pos", 24], ["Mapped chain seq", 52], ["Intensity", 84]]) {
      const text = svgNode("text", { class: "ef-track-label", x: 2, y: y + 6 });
      text.textContent = label;
      sequenceTrack.appendChild(text);
      sequenceTrack.appendChild(svgNode("line", {
        class: "ef-track-rule", x1: sequenceLeft, x2: sequenceWidth - sequenceRight, y1: y, y2: y,
      }));
    }

    const sequenceMarks = [];
    const intensityMarksByPdb = new Map();
    const intensityTargetsByPdb = new Map();
    const intensityBarsByPdb = new Map();
    const intensityTitlesByPdb = new Map();
    const noSignalColor = core.colorForValue(null, H);
    const noSignalFill = `rgb(${noSignalColor.r},${noSignalColor.g},${noSignalColor.b})`;

    function wireSequenceMark(mark, row, trackKind) {
      const index = row.matrix_index;
      mark.setAttribute("data-index", index);
      mark.setAttribute("data-pdb-pos", row.pdb_pos ?? "");
      mark.setAttribute("data-track-kind", trackKind);
      mark.setAttribute("role", "button");
      mark.setAttribute("tabindex", "0");
      mark.setAttribute("aria-pressed", "false");
      const select = () => selectAxis(sequenceAxis, index, "sequence");
      const keydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select();
      };
      mark.addEventListener("click", select);
      mark.addEventListener("keydown", keydown);
      cleanup.push(() => mark.removeEventListener("click", select));
      cleanup.push(() => mark.removeEventListener("keydown", keydown));
      sequenceMarks.push(mark);
    }

    sequenceRows.forEach((row, position) => {
      const x = sequenceX(position);
      if (position === 0 || (position + 1) % 10 === 0 || position === sequenceRows.length - 1) {
        sequenceTrack.appendChild(svgNode("line", {
          class: "ef-position-tick-line", x1: x, x2: x, y1: 15, y2: 30,
        }));
        const tick = svgNode("text", { class: "ef-position-tick", x, y: 14, "text-anchor": "middle" });
        tick.textContent = String(row.pdb_pos ?? position + 1);
        sequenceTrack.appendChild(tick);
      }

      const baseTarget = svgNode("g", {
        class: "ef-sequence-target residue-mark",
        "data-hit-width": sequenceHitWidth,
        "aria-label": `PDB ${row.pdb_pos ?? "unmapped"} ${row.base || ""}; select residue`,
      });
      wireSequenceMark(baseTarget, row, "mapped_chain_sequence");
      baseTarget.appendChild(svgNode("rect", {
        class: "ef-sequence-hit",
        x: x - sequenceHitWidth / 2,
        y: 40,
        width: sequenceHitWidth,
        height: 24,
        rx: 1,
      }));
      const base = svgNode("rect", {
        class: "ef-sequence-base",
        x: x - sequenceCellWidth / 2,
        y: 40,
        width: sequenceCellWidth,
        height: 24,
        rx: 1,
        "data-base": String(row.base || "N").toUpperCase(),
      });
      baseTarget.appendChild(base);
      sequenceTrack.appendChild(baseTarget);
      const baseLetter = svgNode("text", {
        class: "ef-sequence-letter", x, y: 56, "text-anchor": "middle",
      });
      baseLetter.textContent = row.base || "·";
      sequenceTrack.appendChild(baseLetter);

      const intensityTarget = svgNode("g", {
        class: "ef-sequence-target residue-mark",
        "data-hit-width": sequenceHitWidth,
        "aria-label": `PDB ${row.pdb_pos ?? "unmapped"} ${row.base || ""}; no EF intensity selected`,
      });
      wireSequenceMark(intensityTarget, row, "ef_intensity");
      intensityTarget.appendChild(svgNode("rect", {
        class: "ef-sequence-hit",
        x: x - sequenceHitWidth / 2,
        y: 76,
        width: sequenceHitWidth,
        height: 24,
        rx: 1,
      }));
      const intensity = svgNode("rect", {
        class: "ef-sequence-intensity",
        x: x - sequenceCellWidth / 2,
        y: 76,
        width: sequenceCellWidth,
        height: 24,
        rx: 1,
        fill: noSignalFill,
      });
      intensityTarget.appendChild(intensity);
      const intensityTitle = svgNode("title");
      intensityTitle.textContent = `PDB ${row.pdb_pos ?? "unmapped"} ${row.base || ""} · no EF intensity selected`;
      intensityTarget.appendChild(intensityTitle);
      sequenceTrack.appendChild(intensityTarget);
      const bar = svgNode("rect", {
        class: "ef-intensity-bar", x: x - 2, y: 99, width: 4, height: 0, visibility: "hidden",
      });
      sequenceTrack.appendChild(bar);
      intensityMarksByPdb.set(row.pdb_pos, intensity);
      intensityTargetsByPdb.set(row.pdb_pos, intensityTarget);
      intensityBarsByPdb.set(row.pdb_pos, bar);
      intensityTitlesByPdb.set(row.pdb_pos, intensityTitle);
    });
    sequenceHost.appendChild(sequenceTrack);

    const plotWrap = htmlNode("div", "ef-plot-wrap");
    const svg = svgNode("svg", {
      class: "ef-matrix-svg",
      viewBox: `0 0 ${TOTAL_W} ${TOTAL_H}`,
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
      "aria-label": `${H.value_kind || "EF"} matrix ${H.n_rows} by ${H.n_cols}, PDB chain coordinates`,
    });
    svg.appendChild(svgNode("rect", {
      class: "ef-matrix-background", x: PLOT_X, y: PLOT_Y, width: PLOT_W, height: PLOT_H,
    }));

    const gCells = svgNode("g", { class: "ef-cells" });
    for (const [i, j, value] of viewPayload.cells) {
      const c = core.colorForValue(value, H);
      gCells.appendChild(svgNode("rect", {
        x: PLOT_X + j, y: PLOT_Y + i, width: 1.02, height: 1.02,
        fill: `rgb(${c.r},${c.g},${c.b})`, "data-i": i, "data-j": j,
      }));
    }
    svg.appendChild(gCells);
    svg.appendChild(svgNode("rect", {
      class: "ef-matrix-border",
      x: PLOT_X, y: PLOT_Y, width: PLOT_W, height: PLOT_H,
    }));

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
        text.addEventListener("click", click);
        cleanup.push(() => text.removeEventListener("click", click));
        gAxes.appendChild(text);
      } else {
        const y = PLOT_Y + index + 0.75;
        gAxes.appendChild(svgNode("line", { class: "ef-axis-tick-line", x1: PLOT_X - 1.2, y1: y, x2: PLOT_X, y2: y }));
        const text = svgNode("text", { x: PLOT_X - 2, y, "text-anchor": "end", "font-size": 2.7, class: "ef-axis-tick ef-axis-i", "data-index": index });
        text.textContent = label;
        const click = () => selectAxis("i", index, "axis-i");
        text.addEventListener("click", click);
        cleanup.push(() => text.removeEventListener("click", click));
        gAxes.appendChild(text);
      }
    }
    viewPayload.axis_j.forEach((row, index) => {
      if (index === 0 || index === H.n_cols - 1 || (row.pdb_pos ?? index + 1) % tickStep === 0) addTick("j", index, row);
    });
    viewPayload.axis_i.forEach((row, index) => {
      if (index === 0 || index === H.n_rows - 1 || (row.pdb_pos ?? index + 1) % tickStep === 0) addTick("i", index, row);
    });
    const xTitle = svgNode("text", { class: "ef-axis-title", x: PLOT_X + PLOT_W / 2, y: TOTAL_H - 2, "text-anchor": "middle", "font-size": 3.2, "font-weight": 600 });
    xTitle.textContent = "j · PDB residue";
    gAxes.appendChild(xTitle);
    const yTitle = svgNode("text", { class: "ef-axis-title", x: 3.2, y: PLOT_Y + PLOT_H / 2, "text-anchor": "middle", "font-size": 3.2, "font-weight": 600, transform: `rotate(-90 3.2 ${PLOT_Y + PLOT_H / 2})` });
    yTitle.textContent = "i · PDB residue";
    gAxes.appendChild(yTitle);
    svg.appendChild(gAxes);

    const gSelection = svgNode("g", { class: "ef-selection", "pointer-events": "none" });
    const selectedRow = svgNode("rect", { class: "ef-selection-row", visibility: "hidden" });
    const selectedCol = svgNode("rect", { class: "ef-selection-column", visibility: "hidden" });
    const selectedCell = svgNode("rect", { class: "ef-selection-cell", visibility: "hidden" });
    gSelection.appendChild(selectedRow);
    gSelection.appendChild(selectedCol);
    gSelection.appendChild(selectedCell);
    svg.appendChild(gSelection);

    const gHover = svgNode("g", { class: "ef-hover", "pointer-events": "none", visibility: "hidden" });
    const hoverH = svgNode("line", { class: "ef-hover-guide" });
    const hoverV = svgNode("line", { class: "ef-hover-guide" });
    const hoverCell = svgNode("rect", { class: "ef-hover-cell" });
    gHover.appendChild(hoverH);
    gHover.appendChild(hoverV);
    gHover.appendChild(hoverCell);
    svg.appendChild(gHover);

    const overlay = svgNode("rect", {
      x: PLOT_X, y: PLOT_Y, width: PLOT_W, height: PLOT_H,
      fill: "transparent", class: "ef-hitgrid", tabindex: 0,
    });
    svg.appendChild(overlay);
    plotWrap.appendChild(svg);
    const tooltip = htmlNode("div", "ef-tooltip");
    tooltip.setAttribute("role", "status");
    plotWrap.appendChild(tooltip);
    root.appendChild(plotWrap);

    const colorbar = htmlNode("div", "ef-colorbar");
    const scaleName = H.family === "F" ? "F coupling z" : "E contact score";
    const legendTitle = htmlNode("div", "ef-colorbar-title", `${H.value_kind || scaleName} · no / negative signal → strong positive signal`);
    const legendRow = htmlNode("div", "ef-colorbar-row");
    const ramp = htmlNode("span", "rmdb-heatmap-gradient ef-colorbar-ramp");
    legendRow.appendChild(htmlNode("span", "ef-colorbar-min", "≤ 0"));
    legendRow.appendChild(ramp);
    legendRow.appendChild(htmlNode("span", "ef-colorbar-max", fmt(H.value_max)));
    colorbar.appendChild(legendTitle);
    colorbar.appendChild(legendRow);
    root.appendChild(colorbar);
    heatmapHost.appendChild(root);

    const varnaSvg = varnaHost?.querySelector("svg");
    if (!varnaSvg) throw new Error("EF linkage requires a loaded VARNA SVG");
    const circles = varnaSvg.querySelectorAll('circle[stroke="none"][r="5.0"]');
    if (!circles.length) throw new Error("EF linkage found no VARNA nucleotide circles");

    function setVarnaHover(i, j) {
      clearVarnaHover();
      const rows = [idx.axisByIndex.i.get(i), idx.axisByIndex.j.get(j)];
      for (const row of rows) {
        const circle = row && circles[row.varna_index];
        if (!circle) continue;
        circle.setAttribute("data-ef-hover", "1");
        circle.classList.add("is-ef-hovered");
      }
    }

    function clearVarnaHover() {
      for (const circle of circles) {
        if (circle.getAttribute("data-ef-hover") === "1") {
          circle.removeAttribute("data-ef-hover");
          circle.classList.remove("is-ef-hovered");
        }
      }
    }

    function pointInSvg(evt) {
      if (typeof svg.createSVGPoint === "function" && svg.getScreenCTM?.()) {
        const point = svg.createSVGPoint();
        point.x = evt.clientX;
        point.y = evt.clientY;
        return point.matrixTransform(svg.getScreenCTM().inverse());
      }
      const box = svg.getBoundingClientRect();
      return { x: (evt.clientX - box.left) * TOTAL_W / box.width, y: (evt.clientY - box.top) * TOTAL_H / box.height };
    }

    function cellFromEvent(evt) {
      const point = pointInSvg(evt);
      return {
        i: Math.min(H.n_rows - 1, Math.max(0, Math.floor(point.y - PLOT_Y))),
        j: Math.min(H.n_cols - 1, Math.max(0, Math.floor(point.x - PLOT_X))),
      };
    }

    function showHover(i, j, evt) {
      const rowI = idx.axisByIndex.i.get(i);
      const rowJ = idx.axisByIndex.j.get(j);
      const value = idx.cellMap.get(`${i},${j}`) ?? null;
      gHover.setAttribute("visibility", "visible");
      hoverH.setAttribute("x1", PLOT_X); hoverH.setAttribute("x2", PLOT_X + PLOT_W);
      hoverH.setAttribute("y1", PLOT_Y + i + 0.5); hoverH.setAttribute("y2", PLOT_Y + i + 0.5);
      hoverV.setAttribute("x1", PLOT_X + j + 0.5); hoverV.setAttribute("x2", PLOT_X + j + 0.5);
      hoverV.setAttribute("y1", PLOT_Y); hoverV.setAttribute("y2", PLOT_Y + PLOT_H);
      hoverCell.setAttribute("x", PLOT_X + j); hoverCell.setAttribute("y", PLOT_Y + i);
      hoverCell.setAttribute("width", 1); hoverCell.setAttribute("height", 1);
      const valueText = Number.isFinite(value) ? fmt(value) : "no signal / masked";
      tooltip.textContent = `value ${valueText} · i ${rowI?.pdb_pos ?? "–"} ${rowI?.base || ""} · j ${rowJ?.pdb_pos ?? "–"} ${rowJ?.base || ""}`;
      tooltip.style.display = "block";
      const wrapBox = plotWrap.getBoundingClientRect();
      tooltip.style.left = `${Math.max(4, Math.min(wrapBox.width - 250, evt.clientX - wrapBox.left + 12))}px`;
      tooltip.style.top = `${Math.max(4, evt.clientY - wrapBox.top + 12)}px`;
      status.textContent = `i ${rowI?.pdb_pos ?? "–"} ${rowI?.base || ""} × j ${rowJ?.pdb_pos ?? "–"} ${rowJ?.base || ""} · ${valueText}`;
      setVarnaHover(i, j);
      const targets = core.buildHoverTargets(i, j, idx, H);
      if (targets.length) molstarPlugin.visual.highlight({ data: targets });
      onInteraction({ kind: "hover", source: "matrix", i, j, value, iResidue: rowI, jResidue: rowJ });
    }

    function onMove(evt) {
      const { i, j } = cellFromEvent(evt);
      state.hoveredCell = { i_index: i, j_index: j };
      showHover(i, j, evt);
    }

    function onLeave() {
      state.hoveredCell = null;
      gHover.setAttribute("visibility", "hidden");
      tooltip.style.display = "none";
      clearVarnaHover();
      molstarPlugin.visual.clearHighlight();
      if (!state.selected) status.textContent = "Hover a cell; click to lock its row and recolor 2D / 3D";
      onInteraction({ kind: "hover-clear", source: "matrix" });
    }

    function markSelectedCell(i, j) {
      state.selectedCell = { i_index: i, j_index: j };
      selectedCell.setAttribute("x", PLOT_X + j); selectedCell.setAttribute("y", PLOT_Y + i);
      selectedCell.setAttribute("width", 1); selectedCell.setAttribute("height", 1);
      selectedCell.setAttribute("visibility", "visible");
    }

    function onClick(evt) {
      const { i, j } = cellFromEvent(evt);
      markSelectedCell(i, j);
      const value = idx.cellMap.get(`${i},${j}`) ?? null;
      const cell = { i, j, value, iResidue: idx.axisByIndex.i.get(i), jResidue: idx.axisByIndex.j.get(j) };
      selectAxis("i", i, "matrix", cell);
    }

    const originalVarnaFills = [...circles].map((circle) => circle.getAttribute("fill"));
    function recolorVarna(colorMap) {
      circles.forEach((circle, index) => {
        const fill = originalVarnaFills[index];
        if (fill == null) circle.removeAttribute("fill");
        else circle.setAttribute("fill", fill);
      });
      colorMap.forEach((rgb, varnaIdx) => {
        const circle = circles[varnaIdx];
        if (!circle) throw new Error(`recolorVarna: varna_index ${varnaIdx} outside ${circles.length} circles`);
        circle.setAttribute("fill", rgb);
      });
    }

    function selectAxis(axis, index, source = `axis-${axis}`, cell = null) {
      if ((axis !== "i" && axis !== "j") || !Number.isInteger(index)) {
        throw new Error(`selectAxis requires i/j and an integer index; received ${axis}/${index}`);
      }
      const limit = axis === "i" ? H.n_rows : H.n_cols;
      if (index < 0 || index >= limit) throw new Error(`selectAxis ${axis} index ${index} outside 0-${limit - 1}`);
      state.selected = { axis, index, source };
      if (!cell) {
        state.selectedCell = null;
        selectedCell.setAttribute("visibility", "hidden");
      }
      const row = idx.axisByIndex[axis].get(index);
      if (axis === "i") {
        selectedRow.setAttribute("x", PLOT_X); selectedRow.setAttribute("y", PLOT_Y + index);
        selectedRow.setAttribute("width", PLOT_W); selectedRow.setAttribute("height", 1);
        selectedRow.setAttribute("visibility", "visible"); selectedCol.setAttribute("visibility", "hidden");
      } else {
        selectedCol.setAttribute("x", PLOT_X + index); selectedCol.setAttribute("y", PLOT_Y);
        selectedCol.setAttribute("width", 1); selectedCol.setAttribute("height", PLOT_H);
        selectedCol.setAttribute("visibility", "visible"); selectedRow.setAttribute("visibility", "hidden");
      }
      for (const mark of sequenceMarks) {
        const active = row?.pdb_pos != null && Number(mark.getAttribute("data-pdb-pos")) === row.pdb_pos;
        mark.classList[active ? "add" : "remove"]("selected");
        mark.setAttribute("aria-pressed", active ? "true" : "false");
      }
      updateSequenceIntensity(axis, index);
      for (const circle of circles) circle.classList.remove("is-ef-selected");
      const selectedVarnaCircle = row && circles[row.varna_index];
      if (selectedVarnaCircle) selectedVarnaCircle.classList.add("is-ef-selected");
      status.textContent = `locked ${axis} · PDB ${row?.pdb_pos ?? "–"} ${row?.base || ""} · linked 1D intensity / 2D / 3D recolored`;
      molstarPlugin.visual.select({
        data: core.buildMolstarSelectPayload(index, axis, idx, H),
        nonSelectedColor: focusChain ? { r: 255, g: 255, b: 255 } : NEUTRAL_GRAY,
      });
      recolorVarna(core.buildVarnaColorMap(index, axis, idx, H));
      onInteraction({ kind: "select", source, axis, index, residue: row, cell });
    }

    function updateSequenceIntensity(axis, index) {
      const entries = axis === "i" ? idx.rowIndex.get(index) || [] : idx.colIndex.get(index) || [];
      const partnerAxis = axis === "i" ? "j" : "i";
      const valuesByPdb = new Map();
      for (const entry of entries) {
        const partnerIndex = axis === "i" ? entry.j : entry.i;
        const partner = idx.axisByIndex[partnerAxis].get(partnerIndex);
        if (Number.isInteger(partner?.pdb_pos)) valuesByPdb.set(partner.pdb_pos, entry.value);
      }
      const maximum = Math.max(0, Number(H.value_max) || 0) || 1;
      for (const sequenceRow of sequenceRows) {
        const value = valuesByPdb.get(sequenceRow.pdb_pos);
        const color = core.colorForValue(value ?? null, H);
        const intensity = intensityMarksByPdb.get(sequenceRow.pdb_pos);
        const intensityTarget = intensityTargetsByPdb.get(sequenceRow.pdb_pos);
        const bar = intensityBarsByPdb.get(sequenceRow.pdb_pos);
        const title = intensityTitlesByPdb.get(sequenceRow.pdb_pos);
        const valueLabel = Number.isFinite(value) ? fmt(value) : "no signal";
        intensity.setAttribute("fill", `rgb(${color.r},${color.g},${color.b})`);
        intensity.setAttribute("data-value", Number.isFinite(value) ? String(value) : "");
        intensityTarget.setAttribute("data-value", Number.isFinite(value) ? String(value) : "");
        intensityTarget.setAttribute("aria-label", `PDB ${sequenceRow.pdb_pos} ${sequenceRow.base || ""}; EF intensity ${valueLabel}`);
        title.textContent = `PDB ${sequenceRow.pdb_pos} ${sequenceRow.base || ""} · EF intensity ${valueLabel}`;
        const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value / maximum)) : 0;
        const barHeight = normalized > 0 ? Math.max(1, Math.round(normalized * 21)) : 0;
        bar.setAttribute("y", 99 - barHeight);
        bar.setAttribute("height", barHeight);
        bar.setAttribute("visibility", barHeight ? "visible" : "hidden");
      }
    }

    overlay.addEventListener("mousemove", onMove);
    overlay.addEventListener("mouseleave", onLeave);
    overlay.addEventListener("click", onClick);
    cleanup.push(() => overlay.removeEventListener("mousemove", onMove));
    cleanup.push(() => overlay.removeEventListener("mouseleave", onLeave));
    cleanup.push(() => overlay.removeEventListener("click", onClick));

    const matrixRefByVarna = new Map();
    for (const axis of [sequenceAxis, sequenceAxis === "i" ? "j" : "i"]) {
      for (const row of viewPayload[`axis_${axis}`]) {
        if (!Number.isInteger(row.varna_index) || matrixRefByVarna.has(row.varna_index)) continue;
        matrixRefByVarna.set(row.varna_index, { axis, index: row.matrix_index });
      }
    }
    function onVarnaClick(evt) {
      let nearestVarna = null;
      let nearestDistance = Infinity;
      let nearestRadius = 0;
      for (let varnaIndex = 0; varnaIndex < circles.length; varnaIndex += 1) {
        const rect = circles[varnaIndex].getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const distance = Math.hypot(evt.clientX - cx, evt.clientY - cy);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestVarna = varnaIndex;
          nearestRadius = Math.max(8, Math.max(rect.width, rect.height) * 1.5);
        }
      }
      if (nearestVarna == null || nearestDistance > nearestRadius) return;
      const matrixRef = matrixRefByVarna.get(nearestVarna);
      if (matrixRef) selectAxis(matrixRef.axis, matrixRef.index, "varna");
    }
    varnaSvg.addEventListener("click", onVarnaClick);
    cleanup.push(() => varnaSvg.removeEventListener("click", onVarnaClick));

    function selectPdbPosition(pdbPosition, source = "3d") {
      if (!Number.isInteger(pdbPosition)) return false;
      const axes = [sequenceAxis, sequenceAxis === "i" ? "j" : "i"];
      for (const axis of axes) {
        const matrixIndex = idx.axisByPdbPos[axis].get(pdbPosition);
        if (Number.isInteger(matrixIndex)) {
          selectAxis(axis, matrixIndex, source);
          return true;
        }
      }
      return false;
    }
    function onMolstarClick(event) {
      const pdbPosition = core.pdbPositionFromMolstarEvent(event, H);
      if (pdbPosition != null) selectPdbPosition(pdbPosition, "3d");
    }
    molstarHost.addEventListener("PDB.molstar.click", onMolstarClick);
    cleanup.push(() => molstarHost.removeEventListener("PDB.molstar.click", onMolstarClick));

    if (focusChain) molstarPlugin.visual.select(core.buildMolstarChainFocusPayload(viewPayload));
    return {
      viewHeader: H,
      state,
      selectAxis,
      selectPdbPosition,
      viewPayload,
      selectCell(i, j) {
        markSelectedCell(i, j);
        const cell = { i, j, value: idx.cellMap.get(`${i},${j}`) ?? null, iResidue: idx.axisByIndex.i.get(i), jResidue: idx.axisByIndex.j.get(j) };
        selectAxis("i", i, "matrix", cell);
      },
      destroy() {
        cleanup.forEach((fn) => fn());
        clearVarnaHover();
        sequenceHost.innerHTML = "";
        heatmapHost.innerHTML = "";
      },
    };
  };
})();
