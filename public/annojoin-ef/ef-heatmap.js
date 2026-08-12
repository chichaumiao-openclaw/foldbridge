// ef-heatmap.js — DOM 装配层（全局脚本，挂 window.createEfHeatmap）
// 纯逻辑取自 ef-heatmap-core（见前置说明）；本层只做 SVG 装配 + 事件 + 三视图联动。
"use strict";
(function () {
  const MODE = "full-3d"; // 退路开关：'full-3d' | 'highlight-only'（spec §8，纯渲染层）
  const NEUTRAL_GRAY = { r: 200, g: 200, b: 200 };

  window.createEfHeatmap = function ({ heatmapHost, varnaHost, molstarPlugin, payload }) {
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
      if (targets.length && molstarPlugin && molstarPlugin.visual) {
        molstarPlugin.visual.highlight({ data: targets });
      }
    }

    function onLeave() {
      if (molstarPlugin && molstarPlugin.visual) {
        molstarPlugin.visual.clearHighlight();
      }
      state.hoveredCell = null;
    }

    overlay.addEventListener("mousemove", onMove);
    overlay.addEventListener("mouseleave", onLeave);

    // --- 选轴位 k -> 全链按 value[k][*] 重着色（三视图同步） ---
    function selectAxis(axis, index) {
      state.selected = { axis, index };
      const selPayload = core.buildMolstarSelectPayload(index, axis, idx, H);

      if (MODE === "full-3d" && molstarPlugin && molstarPlugin.visual) {
        molstarPlugin.visual.select({
          data: selPayload,
          nonSelectedColor: NEUTRAL_GRAY
        });
      } else if (molstarPlugin && molstarPlugin.visual) {
        molstarPlugin.visual.highlight({ data: selPayload });
      }

      const varnaColors = core.buildVarnaColorMap(index, axis, idx, H);
      recolorVarna(varnaColors);
    }

    function recolorVarna(colorMap) {
      // DOMParser 解析 varnaHost 现有 SVG，按 partner matrix_index -> pdb_pos -> VARNA 圈 idx
      // setAttribute("fill", rgb)。防回环：不回触发同视图重绘（origin 标签）。
      // 具体圈定位借鉴 workbench.js:1481 recolorVarnaSvg。
      if (!varnaHost || !varnaHost.querySelector('svg')) return;

      const svgEl = varnaHost.querySelector('svg');
      const circles = svgEl.querySelectorAll('circle[stroke="none"][r="5.0"]');

      // 简化实现：按 matrix_index 直接索引圈（假设圈序与 matrix_index 对应）
      colorMap.forEach((rgb, matrixIdx) => {
        if (circles[matrixIdx]) {
          circles[matrixIdx].setAttribute('fill', rgb);
        }
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
