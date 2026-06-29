import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "workbench.css"), "utf8");
const js = fs.readFileSync(path.join(root, "workbench.js"), "utf8");
const page = `${html}\n${css}\n${js}`;

const required = [
  ["VARNA fit viewport", /class="varna-viewport"/],
  ["VARNA fit helper", /function fitVarnaSvg/],
  ["profile meta outside SVG", /id="profileMeta"/],
  ["profile text truncation", /text-overflow:\s*ellipsis/],
  ["VARNA SVG min-width disabled", /\.varna-frame svg[\s\S]*min-width:\s*0/],
  ["layout mode marker", /data-layout-source", "VARNA"/],
];

const forbidden = [
  ["profile id inside VARNA SVG aria label", /VARNA secondary structure for \$\{profile\.pair_id\}/],
  ["VARNA min width 980", /\.varna-frame svg\s*\{[^}]*min-width:\s*980px/],
];

const failures = [];
for (const [label, pattern] of required) {
  if (!pattern.test(page)) failures.push(`missing ${label}`);
}
for (const [label, pattern] of forbidden) {
  if (pattern.test(page)) failures.push(`unexpected ${label}`);
}

if (failures.length) {
  throw new Error(`VARNA fit gate contract failed:\n- ${failures.join("\n- ")}`);
}

console.log(JSON.stringify({ ok: true, checks: required.length + forbidden.length }, null, 2));
