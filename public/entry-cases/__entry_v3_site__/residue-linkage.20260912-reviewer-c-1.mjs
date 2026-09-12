const SVG_NS = "http://www.w3.org/2000/svg";

export function residueKeySet(keys) {
  if (keys == null) return new Set();
  if (typeof keys === "string") return new Set(keys ? [keys] : []);
  return new Set(Array.from(keys).filter(Boolean).map(String));
}

export function setResidueMarkState(root, className, keys) {
  if (!root || typeof root.querySelectorAll !== "function") {
    throw new Error("setResidueMarkState requires a DOM root");
  }
  const active = residueKeySet(keys);
  root.querySelectorAll(".residue-mark").forEach((node) => {
    const enabled = active.has(String(node.getAttribute("data-residue-key") || ""));
    if (enabled) node.classList.add(className);
    else node.classList.remove(className);
  });
  return active;
}

export function installVarnaHitLayer(doc, svg, fillCircles, residueKeys) {
  if (!doc || !svg) throw new Error("installVarnaHitLayer requires a document and SVG");
  const circles = Array.from(fillCircles || []);
  const keys = Array.from(residueKeys || []);
  if (circles.length !== keys.length) {
    throw new Error(`VARNA circle/key count mismatch: circles=${circles.length}, keys=${keys.length}`);
  }
  const group = doc.createElementNS(SVG_NS, "g");
  group.setAttribute("data-layer", "varna-hit-layer");
  group.setAttribute("class", "varna-hit-layer");
  const hits = [];
  circles.forEach((source, index) => {
    const residueKey = String(keys[index] || "");
    if (!residueKey) throw new Error(`VARNA residue ${index} is missing a canonical residue key`);
    source.classList.add("residue-mark");
    source.setAttribute("data-residue-key", residueKey);
    const hit = doc.createElementNS(SVG_NS, "circle");
    hit.setAttribute("class", "residue-mark varna-hit");
    hit.setAttribute("data-layer", "varna-hit-layer");
    hit.setAttribute("data-residue-key", residueKey);
    hit.setAttribute("data-position", String(index + 1));
    hit.setAttribute("cx", source.getAttribute("cx") || "0");
    hit.setAttribute("cy", source.getAttribute("cy") || "0");
    hit.setAttribute("r", "8");
    hit.setAttribute("fill", "transparent");
    hit.setAttribute("stroke", "transparent");
    group.appendChild(hit);
    hits.push(hit);
  });
  svg.appendChild(group);
  return hits;
}

export function wireResidueMark(mark, { onHover, onLeave, onSelect, keyboard = true } = {}) {
  if (!mark) throw new Error("wireResidueMark requires a mark");
  const cleanup = [];
  const wire = (name, handler) => {
    if (typeof handler !== "function") return;
    mark.addEventListener(name, handler);
    cleanup.push(() => mark.removeEventListener(name, handler));
  };
  wire("mousemove", onHover);
  wire("mouseleave", onLeave);
  wire("click", onSelect);
  if (keyboard && typeof onSelect === "function") {
    mark.setAttribute("role", "button");
    mark.setAttribute("tabindex", "0");
    const onKeydown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onSelect(event);
    };
    wire("keydown", onKeydown);
  }
  return () => cleanup.forEach((fn) => fn());
}
