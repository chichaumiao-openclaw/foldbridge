// ef-heatmap-core.js — shared EF coordinate and color logic for browser rendering.
"use strict";
(function () {
  function buildIndices(payload) {
    const cellMap = new Map();
    const rowIndex = new Map();
    const colIndex = new Map();
    for (const [i, j, value] of payload.cells) {
      cellMap.set(`${i},${j}`, value);
      if (!rowIndex.has(i)) rowIndex.set(i, []);
      rowIndex.get(i).push({ j, value });
      if (!colIndex.has(j)) colIndex.set(j, []);
      colIndex.get(j).push({ i, value });
    }
    const axisByIndex = { i: new Map(), j: new Map() };
    const axisByPdbPos = { i: new Map(), j: new Map() };
    for (const axis of ["i", "j"]) {
      for (const row of payload[`axis_${axis}`]) {
        axisByIndex[axis].set(row.matrix_index, row);
        if (row.pdb_pos != null) axisByPdbPos[axis].set(row.pdb_pos, row.matrix_index);
      }
    }
    return { cellMap, rowIndex, colIndex, axisByIndex, axisByPdbPos };
  }

  function assertContract(payload) {
    if (!payload || !payload.header) throw new Error("EF payload missing header");
    if (!Array.isArray(payload.axis_i) || !Array.isArray(payload.axis_j) || !Array.isArray(payload.cells)) {
      throw new Error("EF payload missing axis_i / axis_j / cells arrays");
    }
    if (payload.axis_i.length !== payload.header.n_rows) {
      throw new Error(`axis_i length ${payload.axis_i.length} != header.n_rows ${payload.header.n_rows}`);
    }
    if (payload.axis_j.length !== payload.header.n_cols) {
      throw new Error(`axis_j length ${payload.axis_j.length} != header.n_cols ${payload.header.n_cols}`);
    }
    const ni = new Set(payload.axis_i.map((row) => row.matrix_index));
    const nj = new Set(payload.axis_j.map((row) => row.matrix_index));
    if (ni.size !== payload.axis_i.length) throw new Error("axis_i has duplicate matrix_index values");
    if (nj.size !== payload.axis_j.length) throw new Error("axis_j has duplicate matrix_index values");
    for (const [i, j] of payload.cells) {
      if (!ni.has(i)) throw new Error(`cell i_index ${i} out of range`);
      if (!nj.has(j)) throw new Error(`cell j_index ${j} out of range`);
    }
  }

  function materializeMappedChain(payload) {
    assertContract(payload);
    const sourceRows = payload.axis_i.filter((row) => row.pdb_pos != null && row.varna_index != null);
    const sourceCols = payload.axis_j.filter((row) => row.pdb_pos != null && row.varna_index != null);
    if (!sourceRows.length || !sourceCols.length) {
      throw new Error("EF payload has no matrix positions mapped to the selected chain");
    }

    const rowMap = new Map(sourceRows.map((row, index) => [row.matrix_index, index]));
    const colMap = new Map(sourceCols.map((row, index) => [row.matrix_index, index]));
    const rebaseAxis = (rows) => rows.map((row, matrixIndex) => ({
      ...row,
      source_matrix_index: row.matrix_index,
      matrix_index: matrixIndex,
    }));
    const cells = [];
    for (const [i, j, value] of payload.cells) {
      const mappedI = rowMap.get(i);
      const mappedJ = colMap.get(j);
      if (mappedI == null || mappedJ == null) continue;
      cells.push([mappedI, mappedJ, value]);
    }
    const retainedValues = cells.map((cell) => Number(cell[2])).filter(Number.isFinite);
    if (!retainedValues.length) throw new Error("EF mapped chain has no finite matrix values");

    return {
      ...payload,
      header: {
        ...payload.header,
        source_n_rows: payload.header.n_rows,
        source_n_cols: payload.header.n_cols,
        n_rows: sourceRows.length,
        n_cols: sourceCols.length,
        render_scope: "mapped_chain",
        value_min: Math.min(...retainedValues),
        value_max: Math.max(...retainedValues),
        color_scale: "matrix_extent",
      },
      axis_i: rebaseAxis(sourceRows),
      axis_j: rebaseAxis(sourceCols),
      cells,
    };
  }

  function normalizeBase(value) {
    return String(value || "").trim().toUpperCase().replaceAll("T", "U");
  }

  function resolvedSpan(coverage) {
    const label = String(coverage?.resolvedProfileRangeLabel || "").trim();
    const match = label.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) return null;
    return { start: Number(match[1]), end: Number(match[2]) };
  }

  function assertLinkedContract(payload, linkedView, case2d, context = {}) {
    assertContract(payload);
    const header = payload.header;
    const coverage = linkedView?.structureCoverage;
    const polymer = coverage?.polymerChain;
    const atomFilter = coverage?.atomSiteFilter;
    if (!coverage || !polymer || !atomFilter) {
      throw new Error("linked-view missing structureCoverage chain authority");
    }

    const expectedCase = context.caseId || coverage.caseId;
    const expectedChain = context.chainId || polymer.auth_asym_id;
    if (header.pdb_id !== expectedCase || coverage.caseId !== expectedCase) {
      throw new Error(`EF case mismatch: matrix=${header.pdb_id}, linked-view=${coverage.caseId}, requested=${expectedCase}`);
    }
    if (header.chain !== expectedChain || polymer.auth_asym_id !== expectedChain) {
      throw new Error(`EF auth chain mismatch: matrix=${header.chain}, linked-view=${polymer.auth_asym_id}, requested=${expectedChain}`);
    }
    if (header.label_asym_id !== atomFilter.label_asym_id || header.label_asym_id !== polymer.label_asym_id) {
      throw new Error(
        `EF label_asym_id mismatch: matrix=${header.label_asym_id}, linked-view=${atomFilter.label_asym_id}, polymer=${polymer.label_asym_id}`
      );
    }

    const strandId = case2d?.default_render_strand_id;
    const strand = case2d?.strands?.find((row) => row.strand_id === strandId);
    if (!strand || typeof strand.sequence !== "string") {
      throw new Error(`2D bundle missing default strand ${strandId || "(unset)"}`);
    }
    const linkedSequence = normalizeBase(polymer.sequence);
    const twoDSequence = normalizeBase(strand.sequence);
    if (linkedSequence.length !== twoDSequence.length) {
      throw new Error(`2D/3D sequence length mismatch: 2D=${twoDSequence.length}, 3D=${linkedSequence.length}`);
    }
    for (let pos = 0; pos < linkedSequence.length; pos += 1) {
      if (linkedSequence[pos] !== twoDSequence[pos]) {
        throw new Error(`2D/3D sequence mismatch at position ${pos + 1}: 2D=${twoDSequence[pos]}, 3D=${linkedSequence[pos]}`);
      }
    }

    const residueByPosition = new Map();
    for (const residue of linkedView?.residueIndex?.residues || []) {
      residueByPosition.set(residue.labelSeqId, normalizeBase(residue.parentBase || residue.compId));
    }
    const span = resolvedSpan(coverage.coverage);
    for (const axis of ["i", "j"]) {
      const seenPdb = new Set();
      const seenVarna = new Set();
      for (const row of payload[`axis_${axis}`]) {
        const mapped3d = row.pdb_pos != null;
        const mapped2d = row.varna_index != null;
        if (mapped3d !== mapped2d) {
          throw new Error(`axis_${axis}[${row.matrix_index}] has one-sided 2D/3D mapping`);
        }
        if (!mapped3d) continue;
        if (!Number.isInteger(row.pdb_pos) || !residueByPosition.has(row.pdb_pos)) {
          throw new Error(`axis_${axis}[${row.matrix_index}] pdb_pos ${row.pdb_pos} is outside linked chain`);
        }
        if (!Number.isInteger(row.varna_index) || row.varna_index < 0 || row.varna_index >= twoDSequence.length) {
          throw new Error(`axis_${axis}[${row.matrix_index}] varna_index ${row.varna_index} is outside 2D strand`);
        }
        if (seenPdb.has(row.pdb_pos) || seenVarna.has(row.varna_index)) {
          throw new Error(`axis_${axis} has duplicate linked residue mapping at matrix_index ${row.matrix_index}`);
        }
        seenPdb.add(row.pdb_pos);
        seenVarna.add(row.varna_index);

        const linkedBase = residueByPosition.get(row.pdb_pos) || linkedSequence[row.pdb_pos - 1];
        const twoDBase = twoDSequence[row.varna_index];
        if (linkedBase && twoDBase && linkedBase !== twoDBase) {
          throw new Error(`axis_${axis}[${row.matrix_index}] maps different bases: 2D=${twoDBase}, 3D=${linkedBase}`);
        }
        const declaredBase = normalizeBase(row.base);
        if (declaredBase && declaredBase !== linkedBase) {
          throw new Error(`axis_${axis}[${row.matrix_index}] matrix base=${declaredBase} != linked base=${linkedBase}`);
        }
        if (row.observed === true && span && (row.pdb_pos < span.start || row.pdb_pos > span.end)) {
          throw new Error(`axis_${axis}[${row.matrix_index}] observed pdb_pos ${row.pdb_pos} is outside resolved span ${span.start}-${span.end}`);
        }
      }
    }
  }

  function cellFromXY(x, y, width, height, header) {
    const cellW = width / header.n_cols;
    const cellH = height / header.n_rows;
    const j = Math.min(header.n_cols - 1, Math.max(0, Math.floor(x / cellW)));
    const i = Math.min(header.n_rows - 1, Math.max(0, Math.floor(y / cellH)));
    return { i, j };
  }

  function colorForValue(value, header) {
    const center = header.family === "F" ? 0 : (header.bg_mean ?? 0);
    const span = header.family === "F"
      ? Math.max(Math.abs(header.value_min ?? -1), Math.abs(header.value_max ?? 1))
      : value >= center
        ? Math.abs((header.value_max ?? center + 1) - center) || 1
        : Math.abs((header.value_min ?? center - 1) - center) || 1;
    const t = Math.max(-1, Math.min(1, (value - center) / span));
    const neutral = 235;
    if (t >= 0) {
      return { r: neutral, g: Math.round(neutral * (1 - t)), b: Math.round(neutral * (1 - t)) };
    }
    return { r: Math.round(neutral * (1 + t)), g: Math.round(neutral * (1 + t)), b: neutral };
  }

  function rgbStr(color) {
    return `rgb(${color.r},${color.g},${color.b})`;
  }

  function partnersFor(index, axis, indices) {
    if (axis === "i") {
      return (indices.rowIndex.get(index) || []).map((entry) => ({ partner: entry.j, value: entry.value, partnerAxis: "j" }));
    }
    return (indices.colIndex.get(index) || []).map((entry) => ({ partner: entry.i, value: entry.value, partnerAxis: "i" }));
  }

  function buildMolstarSelectPayload(index, axis, indices, header) {
    const out = [];
    for (const { partner, value, partnerAxis } of partnersFor(index, axis, indices)) {
      const row = indices.axisByIndex[partnerAxis].get(partner);
      if (!row || row.pdb_pos == null || row.observed === false) continue;
      out.push({
        struct_asym_id: header.label_asym_id,
        start_residue_number: row.pdb_pos,
        end_residue_number: row.pdb_pos,
        color: colorForValue(value, header),
      });
    }
    return out;
  }

  function buildVarnaColorMap(index, axis, indices, header) {
    const colors = new Map();
    for (const { partner, value, partnerAxis } of partnersFor(index, axis, indices)) {
      const row = indices.axisByIndex[partnerAxis].get(partner);
      if (!row || row.varna_index == null) continue;
      colors.set(row.varna_index, rgbStr(colorForValue(value, header)));
    }
    return colors;
  }

  function buildHoverTargets(i, j, indices, header) {
    const out = [];
    for (const row of [indices.axisByIndex.i.get(i), indices.axisByIndex.j.get(j)]) {
      if (row && row.pdb_pos != null && row.observed !== false) {
        out.push({
          struct_asym_id: header.label_asym_id,
          start_residue_number: row.pdb_pos,
          end_residue_number: row.pdb_pos,
        });
      }
    }
    return out;
  }

  function buildMolstarChainFocusPayload(payload) {
    const residues = payload.axis_i
      .filter((row) => Number.isInteger(row.pdb_pos) && row.observed !== false)
      .map((row) => row.pdb_pos);
    if (!residues.length) throw new Error("EF payload has no resolved target-chain residues");
    return {
      data: [{
        struct_asym_id: payload.header.label_asym_id,
        start_residue_number: Math.min(...residues),
        end_residue_number: Math.max(...residues),
        color: { r: 200, g: 200, b: 200 },
        focus: true,
      }],
      nonSelectedColor: { r: 255, g: 255, b: 255 },
    };
  }

  window.EfHeatmapCore = {
    buildIndices,
    assertContract,
    materializeMappedChain,
    assertLinkedContract,
    cellFromXY,
    colorForValue,
    buildMolstarSelectPayload,
    buildVarnaColorMap,
    buildHoverTargets,
    buildMolstarChainFocusPayload,
  };
})();
