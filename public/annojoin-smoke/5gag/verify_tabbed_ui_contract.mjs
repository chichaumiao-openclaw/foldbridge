import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "workbench.css"), "utf8");
const js = fs.readFileSync(path.join(root, "workbench.js"), "utf8");
const page = `${html}\n${css}\n${js}`;

const required = [
  ["external workbench stylesheet", /href="\.\/workbench\.css"/],
  ["external workbench script", /src="\.\/workbench\.js"/],
  ["default VARNA tab", /class="tab[^"]* active"[^>]*data-view="varna"/],
  ["linear debug tab", /data-view="linear-debug"[^>]*>\s*Linear \/ debug\s*</],
  ["VARNA viewer", /id="varnaViewer"/],
  ["VARNA template loading", /varnaTemplateUrl/],
  ["VARNA recolor function", /recolorVarnaSvg/],
  ["linear viewer", /id="linearViewer"/],
  ["auto profile refresh", /el\.select\.addEventListener\("change", \(\) => void renderProfile/],
  ["debug benchmark control", /<details class="debug-panel"/],
];

const forbidden = [
  ["main render button", /id="renderButton"|>\s*Render\s*</],
  ["main benchmark button", />\s*Benchmark all profiles\s*</],
  ["self-made stem-loop coordinate function", /function stemLoopCoordinates/],
];

const failures = [];
for (const [label, pattern] of required) {
  if (!pattern.test(page)) failures.push(`missing ${label}`);
}
for (const [label, pattern] of forbidden) {
  if (pattern.test(page)) failures.push(`unexpected ${label}`);
}

if (failures.length) {
  throw new Error(`tabbed UI contract failed:\n- ${failures.join("\n- ")}`);
}

console.log(JSON.stringify({ ok: true, checks: required.length + forbidden.length }, null, 2));
