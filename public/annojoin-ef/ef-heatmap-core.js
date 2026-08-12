// ef-heatmap-core.js — 纯逻辑全局暴露（从 src/efHeatmap.js 同步）
// 本文件是 src/efHeatmap.js 的浏览器全局脚本版本（IIFE 包装）。
// 两份逻辑由 test/efHeatmap.test.js 单测锚定，防止漂移。
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
    for (const axis of ['i', 'j']) {
      for (const row of payload[`axis_${axis}`]) {
        axisByIndex[axis].set(row.matrix_index, row);
        if (row.pdb_pos != null) axisByPdbPos[axis].set(row.pdb_pos, row.matrix_index);
      }
    }
    return { cellMap, rowIndex, colIndex, axisByIndex, axisByPdbPos };
  }

  function assertContract(payload) {
    const ni = new Set(payload.axis_i.map((r) => r.matrix_index));
    const nj = new Set(payload.axis_j.map((r) => r.matrix_index));
    for (const [i, j] of payload.cells) {
      if (!ni.has(i)) throw new Error(`cell i_index ${i} out of range`);
      if (!nj.has(j)) throw new Error(`cell j_index ${j} out of range`);
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
    const center = header.family === 'F' ? 0 : (header.bg_mean ?? 0);
    const span = header.family === 'F'
      ? Math.max(Math.abs(header.value_min ?? -1), Math.abs(header.value_max ?? 1))
      : Math.max(Math.abs((header.value_min ?? -1) - center),
                 Math.abs((header.value_max ?? 1) - center)) || 1;
    const t = Math.max(-1, Math.min(1, (value - center) / span));
    const NEUTRAL = 235;
    if (t >= 0) {
      return { r: NEUTRAL, g: Math.round(NEUTRAL * (1 - t)), b: Math.round(NEUTRAL * (1 - t)) };
    }
    return { r: Math.round(NEUTRAL * (1 + t)), g: Math.round(NEUTRAL * (1 + t)), b: NEUTRAL };
  }

  function rgbStr(c) { return `rgb(${c.r},${c.g},${c.b})`; }

  function partnersFor(k, axis, idx) {
    if (axis === 'i') return (idx.rowIndex.get(k) || []).map((e) => ({ partner: e.j, value: e.value, partnerAxis: 'j' }));
    return (idx.colIndex.get(k) || []).map((e) => ({ partner: e.i, value: e.value, partnerAxis: 'i' }));
  }

  function buildMolstarSelectPayload(k, axis, idx, header) {
    const out = [];
    for (const { partner, value, partnerAxis } of partnersFor(k, axis, idx)) {
      const row = idx.axisByIndex[partnerAxis].get(partner);
      if (!row || row.pdb_pos == null || row.observed === false) continue;
      const c = colorForValue(value, header);
      out.push({
        struct_asym_id: header.label_asym_id,
        start_residue_number: row.pdb_pos,
        end_residue_number: row.pdb_pos,
        color: c,
      });
    }
    return out;
  }

  function buildVarnaColorMap(k, axis, idx, header) {
    // 键 = partner 行的 varna_index（VARNA 圈 0-based 序），非 matrix_index（稠密矩阵轴序）。
    const m = new Map();
    for (const { partner, value, partnerAxis } of partnersFor(k, axis, idx)) {
      const row = idx.axisByIndex[partnerAxis].get(partner);
      if (!row || row.varna_index == null) continue;   // 缺行 / 出 span → 跳过（不臆造圈）
      m.set(row.varna_index, rgbStr(colorForValue(value, header)));
    }
    return m;
  }

  function buildHoverTargets(i, j, idx, header) {
    const out = [];
    const ri = idx.axisByIndex.i.get(i);
    const rj = idx.axisByIndex.j.get(j);
    for (const row of [ri, rj]) {
      if (row && row.pdb_pos != null && row.observed !== false) {
        out.push({ struct_asym_id: header.label_asym_id, start_residue_number: row.pdb_pos, end_residue_number: row.pdb_pos });
      }
    }
    return out;
  }

  window.EfHeatmapCore = {
    buildIndices,
    assertContract,
    cellFromXY,
    colorForValue,
    buildMolstarSelectPayload,
    buildVarnaColorMap,
    buildHoverTargets,
  };
})();
