const SVG_NS = "http://www.w3.org/2000/svg";

export const RESIDUE_RAIL_GEOMETRY = Object.freeze({
  left: 210,
  right: 18,
  pitch: 24,
  minimumWidth: 1120,
});

function svgNode(doc, name, attrs = {}) {
  const node = doc.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

export function createResidueRail(doc, {
  positions,
  rows,
  height,
  ariaLabel = "1D residue track rail",
  positionLabel = (value) => String(value),
}) {
  const items = Array.from(positions || []);
  if (!doc || !items.length) throw new Error("createResidueRail requires a document and positions");
  const { left, right, pitch, minimumWidth } = RESIDUE_RAIL_GEOMETRY;
  const width = Math.max(minimumWidth, left + right + items.length * pitch);
  const usable = width - left - right;
  const hitWidth = Math.max(pitch, usable / items.length);
  const cellWidth = Math.max(4, hitWidth - 1);
  const xForIndex = (index) => left + ((index + 0.5) / items.length) * usable;
  const svg = svgNode(doc, "svg", {
    class: "residue-rail",
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "group",
    "aria-label": ariaLabel,
  });
  svg.appendChild(svgNode(doc, "rect", {
    class: "residue-rail-background", x: 0, y: 0, width, height, fill: "#ffffff",
  }));
  for (const [label, y] of rows) {
    const text = svgNode(doc, "text", {
      class: "residue-rail-label", x: 2, y: y + 6,
      "font-size": "1.08rem", "font-weight": 400, fill: "#000000",
    });
    text.textContent = label;
    svg.appendChild(text);
    svg.appendChild(svgNode(doc, "line", {
      class: "residue-rail-rule", x1: left, x2: width - right, y1: y, y2: y,
      stroke: "#e3e7ec", "stroke-width": 1,
    }));
  }
  items.forEach((item, index) => {
    const ordinal = index + 1;
    if (ordinal !== 1 && ordinal % 10 !== 0 && ordinal !== items.length) return;
    const x = xForIndex(index);
    svg.appendChild(svgNode(doc, "line", {
      class: "residue-rail-tick-line", x1: x, x2: x, y1: 15, y2: 30,
      stroke: "#7c8792", "stroke-width": 0.8,
    }));
    const tick = svgNode(doc, "text", {
      class: "residue-rail-tick", x, y: 14, "font-size": "1.08rem",
      "font-weight": 400, "text-anchor": "middle", fill: "#000000",
    });
    tick.textContent = positionLabel(item, index);
    svg.appendChild(tick);
  });
  return {
    svg,
    width,
    usable,
    hitWidth,
    cellWidth,
    xForIndex,
    xFor: (item) => xForIndex(items.indexOf(item)),
  };
}
