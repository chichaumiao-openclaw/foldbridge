// ef-heatmap.js — DOM 装配层（全局脚本，挂 window.createEfHeatmap）
// 纯逻辑取自 ef-heatmap-core（见前置说明）；本层只做 SVG 装配 + 事件 + 三视图联动。
"use strict";
(function () {
  const NEUTRAL_GRAY = { r: 200, g: 200, b: 200 };

  window.createEfHeatmap = function ({ heatmapHost, varnaHost, molstarPlugin, payload }) {
    // fail-loud：三视图完整联动无退路（spec §8，NO fallback）。
    // 未传入可用的 molstar plugin 即在装配阶段抛错，绝不静默降级为 highlight-only 或跳过 3D。
    if (!molstarPlugin || !molstarPlugin.visual) {
      throw new Error("createEfHeatmap requires a molstar plugin with .visual (full-3d 三视图联动无退路)");
    }
    const core = window.EfHeatmapCore;
    core.assertContract(payload);
    const idx = core.buildIndices(payload);
    const H = payload.header;
    const state = { hoveredCell: null, selected: null };

    // --- SVG 稀疏渲染（只画非空格 + 轴 + 单 overlay 命中层） ---
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${H.n_cols} ${H.n_rows}`);
    svg.style.width = "100%";
    svg.style.height = "100%";

    const gCells = document.createElementNS(NS, "g");
    for (const [i, j, value] of payload.cells) {
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", j);
      rect.setAttribute("y", i);
      rect.setAttribute("width", 1);
      rect.setAttribute("height", 1);
      const c = core.colorForValue(value, H);
      rect.setAttribute("fill", `rgb(${c.r},${c.g},${c.b})`);
      gCells.appendChild(rect);
    }
    svg.appendChild(gCells);

    // overlay 命中层
    const overlay = document.createElementNS(NS, "rect");
    overlay.setAttribute("x", 0);
    overlay.setAttribute("y", 0);
    overlay.setAttribute("width", H.n_cols);
    overlay.setAttribute("height", H.n_rows);
    overlay.setAttribute("fill", "transparent");
    svg.appendChild(overlay);

    heatmapHost.innerHTML = "";
    heatmapHost.appendChild(svg);

    // --- overlay hover：反算 (i,j) -> 两碱基同时亮 ---
    function onMove(evt) {
      const box = svg.getBoundingClientRect();
      const { i, j } = core.cellFromXY(
        evt.clientX - box.left,
        evt.clientY - box.top,
        box.width,
        box.height,
        H
      );
      state.hoveredCell = { i_index: i, j_index: j };
      const targets = core.buildHoverTargets(i, j, idx, H);
      if (targets.length) {
        molstarPlugin.visual.highlight({ data: targets });
      }
    }

    function onLeave() {
      molstarPlugin.visual.clearHighlight();
      state.hoveredCell = null;
    }

    overlay.addEventListener("mousemove", onMove);
    overlay.addEventListener("mouseleave", onLeave);

    // --- 选轴位 k -> 全链按 value[k][*] 重着色（三视图同步） ---
    function selectAxis(axis, index) {
      state.selected = { axis, index };
      const selPayload = core.buildMolstarSelectPayload(index, axis, idx, H);

      // 恒 full-3d：整链按 value[k][*] 梯度重着色，无 highlight-only 降级。
      molstarPlugin.visual.select({
        data: selPayload,
        nonSelectedColor: NEUTRAL_GRAY
      });

      const varnaColors = core.buildVarnaColorMap(index, axis, idx, H);
      recolorVarna(varnaColors);
    }

    function recolorVarna(colorMap) {
      // colorMap 键 = varna_index（VARNA 圈 0-based 序 = query_pos − 1），由 buildVarnaColorMap 派生。
      // fail-loud（spec §8，NO silent fallback）：缺 SVG / 零圈 = 模板损坏，抛错不静默返回。
      // 圈选择器 [stroke=none][r=5.0] 实测精确匹配 query 长度个核苷酸圈（参考 workbench.js recolorVarnaSvg）。
      if (!varnaHost) {
        throw new Error("recolorVarna: no varnaHost");
      }
      const svgEl = varnaHost.querySelector('svg');
      if (!svgEl) {
        throw new Error("recolorVarna: varnaHost has no SVG (VARNA template not loaded)");
      }
      const circles = svgEl.querySelectorAll('circle[stroke="none"][r="5.0"]');
      if (circles.length === 0) {
        throw new Error("recolorVarna: no VARNA nucleotide circles found (selector [stroke=none][r=5.0])");
      }

      colorMap.forEach((rgb, varnaIdx) => {
        const c = circles[varnaIdx];
        if (!c) {
          throw new Error(`recolorVarna: varna_index ${varnaIdx} out of circle range (${circles.length} circles)`);
        }
        c.setAttribute('fill', rgb);
      });
    }

    // 轴刻度点击触发 selectAxis（DOM 绑定）; molstar/VARNA 点选碱基经 axisByPdbPos 反查 index 后 selectAxis
    return {
      destroy() {
        overlay.removeEventListener("mousemove", onMove);
        overlay.removeEventListener("mouseleave", onLeave);
        heatmapHost.innerHTML = "";
      },
      selectAxis, // 暴露供外部调用
    };
  };
})();
