import "./site-nav.js";
import { joinTechniqueByProfile, familyBadgeMarkup, buildTechniqueFilterModel, applyTechniqueFilter } from "./workbench-pure.mjs";
import { prepareEfWorkbenchShell, renderEfWorkbenchMetadata, renderEfInteraction } from "./ef-workbench-shell.mjs";

const config = window.__FAMILY_D_CHAIN_WORKBENCH_CONFIG__ || {};
const efManifestUrl = new URL('../../browser-manifest.json', window.location.href).href;
let detectedEfChain = null;
let manifestDetectionError = null;
try {
  const response = await fetch(efManifestUrl);
  if (!response.ok) throw new Error(`Case manifest load failed: HTTP ${response.status}`);
  const manifest = await response.json();
  const chainId = config.chainId || '';
  if (!chainId) throw new Error("Case manifest detection missing selected chain id");
  const chain = manifest?.chains?.[chainId];
  if (!chain) throw new Error(`Case manifest missing selected chain ${chainId}`);
  if (chain.efMatrixPath) detectedEfChain = { manifest, chain };
} catch (error) {
  manifestDetectionError = error instanceof Error ? error : new Error(String(error));
}

function removeRetiredWorkbenchPanels() {
  document.querySelector("#molstar-full-host")?.closest(".molstar-view")?.remove();
  document.querySelector("#molstarFullMeta")?.remove();
  document.querySelectorAll(".debug-panel").forEach((panel) => panel.remove());
  document.querySelector("#assetStatus")?.remove();
  document.querySelector("#profileMeta")?.remove();
  document.querySelectorAll(".technique-filter").forEach((filter) => filter.remove());
  document.querySelector(".workbench-shell > header")?.remove();
  document.querySelector(".track-panel .panel-head h2")?.replaceChildren("sequence mapping");
  document.querySelector("#trackStatus")?.remove();
  document.querySelector(".track-viewport-controls")?.remove();
}

if (!detectedEfChain && !manifestDetectionError) removeRetiredWorkbenchPanels();

function reportEmbeddedPageHeight() {
  if (window.parent === window) return;
  const root = document.querySelector(".workbench-shell");
  const visibleChildren = root
    ? [...root.children].filter((child) => getComputedStyle(child).display !== "none")
    : [];
  const lastChild = visibleChildren.at(-1);
  const rootStyle = root ? getComputedStyle(root) : null;
  const height = root && lastChild && rootStyle
    ? Math.ceil(lastChild.getBoundingClientRect().bottom + window.scrollY + (parseFloat(rootStyle.paddingBottom) || 0))
    : Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
  window.parent.postMessage({ type: "foldbridge-workbench-height", height }, window.location.origin);
}

if (window.parent !== window && typeof ResizeObserver !== "undefined") {
  const reportHeightSoon = () => requestAnimationFrame(reportEmbeddedPageHeight);
  new ResizeObserver(reportHeightSoon).observe(document.body);
  window.addEventListener("load", reportHeightSoon, { once: true });
  reportHeightSoon();
}

const caseUrl = config.caseUrl || "./case-2d-structure.json";
const profileIndexUrl = config.profileIndexUrl || "./profiles/profile-index.json";
const varnaTemplateUrl = config.varnaTemplateUrl || "./varna-template.svg";
const sourceStructureUrl = config.sourceStructureUrl || "../../structure.cif";
const linkedViewRoot = config.linkedViewRoot || "./linked-view";
const linkedViewBundleUrl = config.linkedViewBundleUrl || "";
const linkedViewUrls = {
  residueIndex: `${linkedViewRoot}/residue-index.json`,
  profileJoins: `${linkedViewRoot}/profile-joins.json`,
  structureContexts: `${linkedViewRoot}/structure-contexts.json`,
  structureCoverage: `${linkedViewRoot}/structure-coverage.json`,
  bridges: `${linkedViewRoot}/bridges.json`,
  interactions: `${linkedViewRoot}/interactions.json`,
  confidenceSummary: `${linkedViewRoot}/confidence-summary.json`,
  lssContext: `${linkedViewRoot}/lss-context.json`,
  rawAlignmentCoverage: `${linkedViewRoot}/raw-alignment-coverage.json`,
};
const state = {
  caseData: null,
  profileIndex: null,
  techniqueByProfile: new Map(),
  linkedView: null,
  residueByKey: new Map(),
  residueByStrandPosition: new Map(),
  legacyResidueKeyToKey: new Map(),
  joinsByProfileResidue: new Map(),
  lociByResidueKey: new Map(),
  pdbResidueByKey: new Map(),
  bridgeByResidueKey: new Map(),
  interactionsByResidueKey: new Map(),
  lssContextByProfileId: new Map(),
  rawAlignmentCoverageByProfileId: new Map(),
  confidenceSummary: null,
  lssContext: null,
  rawAlignmentCoverage: null,
  structureCoverage: null,
  structureCoverageUrl: linkedViewUrls.structureCoverage,
  varnaTemplate: null,
  profiles: [],
  shards: new Map(),
  lastRender: null,
  varnaZoom: 1,
  viewport: { start: 1, end: 113 },
  selectedResidueKey: null,
  hoveredResidueKey: null,
  molstarViewer: null,
  molstarCroppedUrl: null,
  molstarBridgeInstalled: false,
  requestedProfileId: "",
  rmdbHeatmapRequestId: 0,
  rmdbHeatmapMatrix: null,
  rmdbHeatmapFilename: "",
};

const el = {
  status: document.querySelector("#assetStatus"),
  select: document.querySelector("#profileSelect"),
  stats: document.querySelector("#stats"),
  track: document.querySelector("#track-viewport"),
  trackStatus: document.querySelector("#trackStatus"),
  viewportStatus: document.querySelector("#viewportStatus"),
  zoomIn: document.querySelector("#zoom-in"),
  zoomOut: document.querySelector("#zoom-out"),
  panLeft: document.querySelector("#pan-left"),
  panRight: document.querySelector("#pan-right"),
  resetView: document.querySelector("#reset-view"),
  viewportSlider: document.querySelector("#viewport-slider"),
  varnaViewer: document.querySelector("#varnaViewer"),
  varnaViewport: document.querySelector("#varnaViewport"),
  varnaZoomIn: document.querySelector("#varna-zoom-in"),
  varnaZoomOut: document.querySelector("#varna-zoom-out"),
  varnaZoomReset: document.querySelector("#varna-zoom-reset"),
  varnaZoomStatus: document.querySelector("#varna-zoom-status"),
  caption: document.querySelector("#viewCaption"),
  inspector: document.querySelector("#linked-inspector"),
  inspectorStatus: document.querySelector("#inspectorStatus"),
  molstarHost: document.querySelector("#molstar-host"),
  molstarStatus: document.querySelector("#molstar-status"),
  molstarSelectionStatus: document.querySelector("#molstar-selection-status"),
  molstarMeta: document.querySelector("#molstarMeta"),
  tip: document.querySelector("#tip"),
  rmdbHeatmapPanel: null,
  rmdbHeatmapStatus: null,
  rmdbHeatmapMeta: null,
  rmdbHeatmapScroll: null,
  rmdbHeatmapStage: null,
  rmdbHeatmapCanvas: null,
  rmdbHeatmapTip: null,
  rmdbHeatmapRangeSelect: null,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeDownloadStem(value, fallback = "foldbridge") {
  return String(value || fallback).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || fallback;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

function csvField(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function selectedProfileCsv() {
  const profile = state.lastRender?.profile;
  const normalized = state.lastRender?.normalized;
  const strand = activeStrand();
  if (!profile || !normalized || !strand) return null;
  const columns = [
    "position", "profile_base", "raw_value", "normalized_value", "reactivity_color",
    "structure_state", "residue_key", "pdb_base", "sequence_match",
    "coordinate_status", "pdb_label_asym_id", "pdb_label_seq_id", "pdb_auth_asym_id", "pdb_auth_seq_id",
  ];
  const rows = [columns.join(",")];
  for (let position = 1; position <= strand.sequence.length; position += 1) {
    const residue = residueForPosition(position, strand);
    const row = normalized.byPosition.get(position) || {};
    const pdb = state.pdbResidueByKey.get(residue.residueKey) || {};
    rows.push([
      position,
      residue.parentBase || strand.sequence[position - 1] || "",
      Number.isFinite(row.raw) ? row.raw : "",
      Number.isFinite(row.norm) ? row.norm : "",
      row.color || "",
      secondaryStructureStateForPosition(position, strand),
      residue.residueKey,
      residue.compId || "",
      alignmentStateForResidue(residue.residueKey),
      pdb.coordinateStatus || "unavailable",
      pdb.labelAsymId || "",
      pdb.labelSeqId || "",
      pdb.authAsymId || "",
      pdb.authSeqId || "",
    ].map(csvField).join(","));
  }
  return rows.join("\n");
}

function selectedProfileColorMap() {
  const profile = state.lastRender?.profile;
  const normalized = state.lastRender?.normalized;
  const strand = activeStrand();
  if (!profile || !normalized || !strand) return null;
  return {
    downloadType: "foldbridge-profile-color-map",
    generatedAt: new Date().toISOString(),
    caseId: state.caseData?.case_id || config.caseId || "",
    chain: activeChainKey(),
    profileId: profile.profile_id || "",
    positions: Array.from({ length: strand.sequence.length }, (_, index) => {
      const position = index + 1;
      const residue = residueForPosition(position, strand);
      const row = normalized.byPosition.get(position) || {};
      const pdb = state.pdbResidueByKey.get(residue.residueKey) || {};
      return {
        position,
        base: residue.parentBase || strand.sequence[index] || "",
        rawValue: Number.isFinite(row.raw) ? row.raw : null,
        normalizedValue: Number.isFinite(row.norm) ? row.norm : null,
        color: row.color || "#ffffff",
        residueKey: residue.residueKey,
        coordinateStatus: pdb.coordinateStatus || "unavailable",
      };
    }),
  };
}

function downloadSelectedProfile() {
  const profile = state.lastRender?.profile;
  const csv = selectedProfileCsv();
  if (!profile || !csv) return;
  const stem = safeDownloadStem(profile.profile_id, "profile");
  downloadText(`${stem}.csv`, csv, "text/csv;charset=utf-8");
}

async function downloadSelected3d() {
  const profile = state.lastRender?.profile;
  if (!profile) return;
  try {
    const sourceCif = await loadStructureSourceForMolstar();
    if (!state.molstarCroppedUrl) {
      await prepareClientAlignmentCroppedCif(sourceCif);
    }
    const response = await fetch(state.molstarCroppedUrl);
    if (!response.ok) throw new Error(`target structure unavailable (${response.status})`);
    const cifBlob = await response.blob();
    const stem = safeDownloadStem(profile.profile_id, "profile");
    downloadBlob(cifBlob, `${stem}-target-chain.cif`);
    const sourceBuffer = await fetchArrayBufferOrThrow(sourceCif.sourceUrl);
    const sourceDecoded = String(sourceCif.sourceUrl).endsWith(".gz")
      ? await decodeGzipArrayBuffer(sourceBuffer)
      : sourceBuffer;
    downloadBlob(new Blob([sourceDecoded], { type: "chemical/x-mmcif" }), `${stem}-full-structure.cif`);
    const colorMap = selectedProfileColorMap();
    if (colorMap) downloadText(`${stem}-reactivity-colors.json`, JSON.stringify(colorMap, null, 2), "application/json;charset=utf-8");
  } catch (error) {
    if (el.molstarStatus) el.molstarStatus.textContent = `3D download unavailable: ${error.message || error}`;
  }
}

function resolveAssetUrl(href, baseUrl = window.location.href) {
  return new URL(href, new URL(baseUrl, window.location.href)).href;
}

// Case pages no longer bundle a verbatim RCSB mmCIF mirror (structure.cif.gz);
// that pushed the static artifact past the 1 GB GitHub Pages cap. When the
// linked-view coverage points at the removed local mirror, resolve the source
// structure to RCSB's gzipped-text download instead, keyed by the PDB id
// (coverage.caseId). The ".gz" suffix is preserved so the existing
// fetch -> DecompressionStream -> text-crop -> reactivity-coloring pipeline is
// byte-for-byte unchanged. Already-absolute hrefs (e.g. the 5gag smoke demo)
// pass through untouched.
function resolveStructureSourceHref(href, caseId) {
  const original = String(href || "");
  if (/^https?:\/\//i.test(original)) return original;
  if (!/structure\.cif(\.gz)?$/i.test(original)) return original;
  const pdbId = String(caseId || "").trim().toUpperCase();
  if (!pdbId) return original;
  const gz = /\.gz$/i.test(original) ? ".gz" : "";
  return `https://files.rcsb.org/download/${pdbId}.cif${gz}`;
}

function percentile(values, q) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const idx = (clean.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, clean.length - 1);
  const t = idx - lo;
  return clean[lo] * (1 - t) + clean[hi] * t;
}

function colorForNorm(norm) {
  if (!Number.isFinite(norm) || norm <= 0) return "#ffffff";
  const t = Math.max(0, Math.min(1, norm));
  const start = [255, 242, 0];
  const end = [215, 25, 28];
  const rgb = start.map((channel, idx) => Math.round(channel + (end[idx] - channel) * t));
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function colorForBase(base) {
  return {
    A: "#4c78a8",
    C: "#f58518",
    G: "#54a24b",
    U: "#b279a2",
    T: "#b279a2",
  }[String(base || "N").toUpperCase()] || "#d8dee4";
}

function rmdbRdatFilename(profile) {
  const profileId = String(profile?.profile_id || "");
  const match = profileId.match(/([^/\\]+\.rdat)(?:#\d+)?$/i);
  const filename = match?.[1]?.trim() || "";
  return /^(?!\.\.?(?:\.rdat)?$)[^/\\]+\.rdat$/i.test(filename) ? filename : "";
}

function rmdbRdatUrl(filename) {
  // The static build copies src/ beside public/, so this remains valid both
  // from the source tree and from dist/public/rmdb-v3/.../chains/<chain>/.
  return resolveAssetUrl(`../../../../../../src/assets/data/rmdb-puzzle/${encodeURIComponent(filename)}`);
}

function rmdbRdatUrls(filename) {
  const urls = [];
  if (window.location.origin && window.location.origin !== "null") {
    urls.push(`${window.location.origin}/api/rmdb/rdat/${encodeURIComponent(filename)}`);
  }
  urls.push(rmdbRdatUrl(filename));
  return [...new Set(urls)];
}

async function fetchRmdbRdatText(filename) {
  let lastError = null;
  for (const url of rmdbRdatUrls(filename)) {
    try {
      return await fetchTextMaybeGzip(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`RDAT unavailable: ${filename}`);
}

function parseRmdbRdat(text) {
  const lines = String(text || "").split(/\r?\n/);
  let sequence = "";
  let offset = 0;
  let seqpos = [];
  const annotations = new Map();
  const reactivityRows = [];
  const errorRows = new Map();

  for (const line of lines) {
    if (/^SEQUENCE(?:\s+|\s*:)/i.test(line)) {
      sequence = line.replace(/^SEQUENCE\s*:?\s*/i, "").replace(/\s+/g, "").trim();
      continue;
    }
    const offsetMatch = line.match(/^OFFSET\s+(\d+)/i);
    if (offsetMatch) {
      offset = Number(offsetMatch[1]);
      continue;
    }
    if (/^SEQPOS(?:\s+|\s*:)/i.test(line)) {
      const body = line.replace(/^SEQPOS\s*:?\s*/i, "").trim();
      seqpos = body.split(/\s+/).map((token) => {
        const match = token.match(/-?\d+$/);
        return match ? Number(match[0]) : null;
      }).filter((value) => Number.isFinite(value));
      continue;
    }
    const annotationMatch = line.match(/^ANNOTATION_DATA\s*:\s*(\d+)\s*(.*)$/i);
    if (annotationMatch) {
      const rowNumber = Number(annotationMatch[1]);
      const raw = annotationMatch[2].trim();
      const mutation = raw.match(/(?:^|\s)mutation:([^\s]+)/i)?.[1];
      const chemical = raw.match(/(?:^|\s)chemical:([^\s]+)/i)?.[1];
      const recordId = raw.match(/(?:^|\s)Eterna:id:([^\s]+)/i)?.[1]
        || raw.match(/(?:^|\s)ID:([^\s]+)/i)?.[1];
      const designName = raw.match(/(?:^|\s)Eterna:design_name:([^\t]+)/i)?.[1]?.trim();
      const experimentName = raw.match(/(?:^|\s)name:([^\s]+)/i)?.[1];
      const sequenceLabel = raw.match(/(?:^|\s)sequence:([^\s]+)/i)?.[1] || "";
      annotations.set(rowNumber, {
        label: mutation || chemical || recordId || designName || experimentName || raw || `row ${rowNumber}`,
        raw,
        warning: /warning:/i.test(raw),
        sequence: sequenceLabel,
      });
      continue;
    }
    const errorMatch = line.match(/^REACTIVITY_ERROR\s*:\s*(\d+)\s*(.*)$/i);
    if (errorMatch) {
      const rowNumber = Number(errorMatch[1]);
      errorRows.set(rowNumber, errorMatch[2].trim().split(/\s+/).map((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }));
      continue;
    }
    const reactivityMatch = line.match(/^REACTIVITY\s*:\s*(\d+)\s*(.*)$/i);
    if (reactivityMatch) {
      const rowNumber = Number(reactivityMatch[1]);
      const values = reactivityMatch[2].trim().split(/\s+/).map((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      });
      reactivityRows.push({ rowNumber, values });
    }
  }

  reactivityRows.sort((a, b) => a.rowNumber - b.rowNumber);
  const columns = seqpos.length
    ? seqpos
    : Array.from({ length: Math.max(0, ...reactivityRows.map((row) => row.values.length)) }, (_, idx) => idx + 1);
  const rows = reactivityRows.map((row, idx) => {
    const annotation = annotations.get(row.rowNumber) || annotations.get(idx + 1) || {};
    return {
      rowNumber: row.rowNumber,
      label: annotation.label || `row ${row.rowNumber}`,
      rawAnnotation: annotation.raw || "",
      warning: Boolean(annotation.warning),
      sequence: annotation.sequence || "",
      error: errorRows.get(row.rowNumber) || errorRows.get(idx + 1) || [],
      values: row.values,
    };
  });
  const positiveValues = rows.flatMap((row) => row.values).filter((value) => Number.isFinite(value) && value > 0);
  const cleanSequence = sequence.replace(/\s+/g, "");
  const colLabelDetails = columns.map((position) => {
    const raw = String(position);
    const sequenceIndex = position - offset - 1;
    const base = cleanSequence[sequenceIndex] || "";
    return {
      raw,
      base: /^[AUGCT]$/i.test(base) ? (base.toUpperCase() === "T" ? "U" : base.toUpperCase()) : "",
      position: raw,
      display: base ? `${base.toUpperCase() === "T" ? "U" : base.toUpperCase()}${raw}` : raw,
    };
  });
  return {
    sequence,
    offset,
    columns,
    colLabelDetails,
    rows,
    positiveCap: percentile(positiveValues, 0.95),
  };
}

function ensureRmdbHeatmapPanel() {
  if (el.rmdbHeatmapPanel) return true;
  const trackPanel = el.track?.closest(".track-panel");
  if (!trackPanel) return false;
  const panel = document.createElement("section");
  panel.className = "panel rmdb-heatmap-panel";
  panel.id = "rmdb-heatmap-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="panel-head">
      <h2>RMDB raw reactivity heatmap</h2>
      <span id="rmdbHeatmapStatus">not loaded</span>
    </div>
    <div class="rmdb-heatmap-controls" id="rmdbHeatmapControls" hidden>
      <label for="rmdbHeatmapRangeSelect">Rows</label>
      <select id="rmdbHeatmapRangeSelect" aria-label="Select experiment row range"></select>
    </div>
    <div class="rmdb-heatmap-meta" id="rmdbHeatmapMeta"></div>
    <div class="rmdb-heatmap-scroll" id="rmdbHeatmapScroll">
      <div class="rmdb-heatmap-stage" id="rmdbHeatmapStage">
        <canvas id="rmdbHeatmapCanvas" role="img" aria-label="RMDB raw reactivity heatmap"></canvas>
        <div class="rmdb-heatmap-tip" id="rmdbHeatmapTip" hidden></div>
      </div>
    </div>`;
  trackPanel.insertAdjacentElement("afterend", panel);
  el.rmdbHeatmapPanel = panel;
  el.rmdbHeatmapStatus = panel.querySelector("#rmdbHeatmapStatus");
  el.rmdbHeatmapMeta = panel.querySelector("#rmdbHeatmapMeta");
  el.rmdbHeatmapScroll = panel.querySelector("#rmdbHeatmapScroll");
  el.rmdbHeatmapStage = panel.querySelector("#rmdbHeatmapStage");
  el.rmdbHeatmapCanvas = panel.querySelector("#rmdbHeatmapCanvas");
  el.rmdbHeatmapTip = panel.querySelector("#rmdbHeatmapTip");
  el.rmdbHeatmapRangeSelect = panel.querySelector("#rmdbHeatmapRangeSelect");
  el.rmdbHeatmapRangeSelect.addEventListener("change", () => {
    renderSelectedRmdbHeatmapRange();
  });
  return true;
}

function formatRmdbHeatmapLabel(label) {
  if (!label) return "";
  const match = String(label).match(/^([AUGC])(\d+)([AUGC])$/i);
  return match ? `${match[1].toUpperCase()}${match[2]}${match[3].toUpperCase()}` : String(label);
}

function rmdbHeatmapCellBase(row, columnIndex, columnCount, fallback = "") {
  const rowSequence = String(row?.sequence || "").replace(/\s+/g, "");
  const candidate = rowSequence.length === columnCount ? rowSequence[columnIndex] : fallback;
  const base = candidate || fallback;
  if (!/^[AUGCT]$/i.test(base)) return "";
  return base.toUpperCase() === "T" ? "U" : base.toUpperCase();
}

function renderRmdbHeatmapCanvas(matrix, sourceRows = matrix.rows) {
  const canvas = el.rmdbHeatmapCanvas;
  const stage = el.rmdbHeatmapStage;
  if (!canvas || !stage) return { rawRows: sourceRows.length, displayRows: 0, downsampled: false };
  const labelGap = 10;
  const leftLabelBand = 28;
  const rightLabelBand = 108;
  const topLabelBand = 58;
  const bottomLabelBand = 28;
  const rawRows = sourceRows.length;
  const cols = matrix.columns.length;
  const hostWidth = Math.floor(el.rmdbHeatmapScroll?.getBoundingClientRect().width || el.rmdbHeatmapScroll?.clientWidth || 0);
  const availableWidth = Math.max(620, hostWidth - 12);
  const cellSize = Math.min(16, Math.max(8, Math.floor((availableWidth - leftLabelBand - rightLabelBand) / Math.max(cols, 1))));
  // Keep every RDAT experiment row in the matrix. The scroll container below
  // provides vertical navigation when the full matrix is taller than the card.
  const displayRows = sourceRows.map((row, index) => ({
    ...row,
    rawStart: Number.isFinite(row.rowNumber) ? row.rowNumber : index + 1,
    rawEnd: Number.isFinite(row.rowNumber) ? row.rowNumber : index + 1,
  }));
  const rows = displayRows.length;
  const width = leftLabelBand + cols * cellSize + rightLabelBand;
  const height = topLabelBand + rows * cellSize + bottomLabelBand;
  const requestedDpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  // A tall RDAT file can exceed the browser's maximum backing-store
  // dimension at devicePixelRatio 2. Lower only the internal bitmap scale;
  // the CSS size remains unchanged, so every row is still displayed.
  const maxCanvasDimension = 32000;
  const dpr = Math.min(requestedDpr, maxCanvasDimension / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const flatValues = displayRows.flatMap((row) => row.values).filter((value) => Number.isFinite(value));
  // Avoid Math.max(...flatValues): large RDAT files can contain thousands of
  // rows and expanding the full matrix into call arguments overflows the JS
  // call stack before the canvas is even painted.
  const maxValue = flatValues.reduce((max, value) => Math.max(max, value), 1);
  const font = `${Math.max(10, cellSize - 2)}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  const monoFont = `${Math.max(10, cellSize - 2)}px Menlo, Consolas, monospace`;
  const baseColors = { A: "#ff8c42", U: "#4b9cff", G: "#ff5a36", C: "#4dbb63" };
  const reactivityColorStops = [
    [0.000, [255, 255, 255]],
    [0.018, [255, 255, 255]],
    [0.040, [255, 242, 0]],
    [0.140, [255, 191, 0]],
    [0.380, [240, 126, 44]],
    [0.700, [219, 53, 37]],
    [1.000, [198, 0, 0]],
  ];
  const reactivityColor = (normalized) => {
    const value = Math.max(0, Math.min(1, normalized));
    const upperIndex = reactivityColorStops.findIndex(([position]) => value <= position);
    const upper = reactivityColorStops[upperIndex < 0 ? reactivityColorStops.length - 1 : upperIndex];
    const lower = reactivityColorStops[Math.max(0, upperIndex - 1)];
    const span = upper[0] - lower[0];
    const fraction = span ? (value - lower[0]) / span : 0;
    const rgb = lower[1].map((channel, index) => Math.round(channel + (upper[1][index] - channel) * fraction));
    return `rgb(${rgb.join(", ")})`;
  };

  function paint(activeCell = null) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const row = displayRows[rowIndex];
      const y = topLabelBand + rowIndex * cellSize;
      ctx.fillStyle = "#69d9ca";
      ctx.font = `italic ${Math.max(10, cellSize - 1)}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(row.rawStart ?? rowIndex + 1), leftLabelBand - labelGap, y + cellSize / 2);

      ctx.fillStyle = row.warning ? "#9a5b16" : "#101010";
      ctx.font = font;
      ctx.textAlign = "left";
      ctx.fillText(formatRmdbHeatmapLabel(row.label), leftLabelBand + cols * cellSize + labelGap, y + cellSize / 2);

      for (let columnIndex = 0; columnIndex < cols; columnIndex += 1) {
        const x = leftLabelBand + columnIndex * cellSize;
        const value = row.values[columnIndex];
        const normalized = Number.isFinite(value) ? Math.max(0, Math.min(1, value / maxValue)) : 0;
        ctx.fillStyle = Number.isFinite(value) ? reactivityColor(normalized) : "#f2f2f2";
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeStyle = "#202020";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cellSize, cellSize);
      }
    }

    for (let columnIndex = 0; columnIndex < cols; columnIndex += 1) {
      const x = leftLabelBand + columnIndex * cellSize + cellSize / 2;
      const label = matrix.colLabelDetails?.[columnIndex] || {
        base: "",
        position: matrix.columns[columnIndex],
        display: matrix.columns[columnIndex],
      };
      const base = rmdbHeatmapCellBase(displayRows[0], columnIndex, cols, label.base || "");
      const position = label.position || matrix.columns[columnIndex];

      ctx.save();
      ctx.translate(x, topLabelBand - labelGap);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.font = monoFont;
      ctx.fillStyle = baseColors[base] || "#101010";
      ctx.fillText(base, 0, 0);
      ctx.restore();

      ctx.save();
      ctx.translate(x, topLabelBand - labelGap - 16);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.font = font;
      ctx.fillStyle = "#101010";
      ctx.fillText(String(position), 0, 0);
      ctx.restore();

      ctx.save();
      ctx.translate(x, height - bottomLabelBand + labelGap);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.font = `italic ${Math.max(9, cellSize - 3)}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = "#7fe5d9";
      ctx.fillText(String(columnIndex + 1), 0, 0);
      ctx.restore();
    }

    if (activeCell) {
      const { row, col } = activeCell;
      const x = leftLabelBand + col * cellSize;
      const y = topLabelBand + row * cellSize;
      ctx.strokeStyle = "#b892ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
      ctx.strokeStyle = "rgba(184, 146, 255, 0.65)";
      ctx.beginPath();
      ctx.moveTo(leftLabelBand, y + cellSize / 2);
      ctx.lineTo(leftLabelBand + cols * cellSize, y + cellSize / 2);
      ctx.moveTo(x + cellSize / 2, topLabelBand);
      ctx.lineTo(x + cellSize / 2, topLabelBand + rows * cellSize);
      ctx.stroke();
    }
  }

  paint();
  canvas.onmousemove = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const col = Math.floor((x - leftLabelBand) / cellSize);
    const rowIndex = Math.floor((y - topLabelBand) / cellSize);
    if (col < 0 || col >= cols || rowIndex < 0 || rowIndex >= rows) {
      el.rmdbHeatmapTip.hidden = true;
      paint();
      return;
    }

    const row = displayRows[rowIndex];
    const label = matrix.colLabelDetails?.[col] || {};
    const value = row.values[col];
    const error = row.error?.[col];
    const base = rmdbHeatmapCellBase(row, col, cols, label.base || "");
    const rowLabel = formatRmdbHeatmapLabel(row.label);
    const rowTitle = row.rawEnd > row.rawStart
      ? `${row.rawStart}–${row.rawEnd} (binned)`
      : `${row.rawStart}: ${rowLabel}`;
    el.rmdbHeatmapTip.innerHTML = `
      <div><span>ROW</span><strong>${escapeHtml(rowTitle)}</strong></div>
      <div><span>COLUMN</span><strong>${col + 1}: ${escapeHtml(label.display || matrix.columns[col])}</strong></div>
      <div><span>SEQUENCE</span><strong>${escapeHtml(base || "—")}</strong></div>
      <div><span>REACTIVITY</span><strong>${Number.isFinite(value) ? value.toFixed(3) : "—"}</strong></div>
      <div><span>ERROR</span><strong>${Number.isFinite(error) ? error.toFixed(3) : "—"}</strong></div>
    `;
    el.rmdbHeatmapTip.hidden = false;
    const tooltipWidth = 210;
    const tooltipHeight = 150;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const left = Math.min(event.clientX + 22, viewportWidth - tooltipWidth - 16);
    const top = Math.min(event.clientY + 22, viewportHeight - tooltipHeight - 16);
    el.rmdbHeatmapTip.style.left = `${Math.max(12, left)}px`;
    el.rmdbHeatmapTip.style.top = `${Math.max(12, top)}px`;
    paint({ row: rowIndex, col });
  };
  canvas.onmouseleave = () => {
    el.rmdbHeatmapTip.hidden = true;
    paint();
  };
  return { rawRows, displayRows: rows, downsampled: rawRows > rows };
}

function populateRmdbHeatmapRangeSelect(matrix) {
  const select = el.rmdbHeatmapRangeSelect;
  const controls = select?.closest(".rmdb-heatmap-controls");
  if (!select || !controls) return;
  select.replaceChildren();
  const fragment = document.createDocumentFragment();
  const pageSize = 100;
  for (let start = 0; start < matrix.rows.length; start += pageSize) {
    const end = Math.min(start + pageSize, matrix.rows.length);
    const option = document.createElement("option");
    option.value = String(start);
    option.textContent = `Rows ${start + 1}–${end}`;
    fragment.append(option);
  }
  select.append(fragment);
  select.value = "0";
  controls.hidden = matrix.rows.length <= pageSize;
}

function renderSelectedRmdbHeatmapRange() {
  const matrix = state.rmdbHeatmapMatrix;
  const filename = state.rmdbHeatmapFilename;
  const select = el.rmdbHeatmapRangeSelect;
  if (!matrix || !filename || !select) return;
  const start = Math.max(0, Number(select.value) || 0);
  const end = Math.min(start + 100, matrix.rows.length);
  const view = renderRmdbHeatmapCanvas(matrix, matrix.rows.slice(start, end));
  el.rmdbHeatmapStatus.textContent = `rows ${start + 1}–${end} of ${matrix.rows.length} × ${matrix.columns.length} positions`;
  el.rmdbHeatmapMeta.innerHTML = `<span>raw RDAT experiments · white–yellow–red reactivity</span><span>· ${escapeHtml(filename)} · rows ${start + 1}–${end} shown · hover a cell for row, column, sequence, reactivity and error</span>`;
  return view;
}

async function renderRmdbHeatmap(profile) {
  if (!ensureRmdbHeatmapPanel()) return;
  const requestId = ++state.rmdbHeatmapRequestId;
  const filename = rmdbRdatFilename(profile);
  if (!filename) {
    el.rmdbHeatmapPanel.hidden = true;
    return;
  }
  el.rmdbHeatmapPanel.hidden = false;
  el.rmdbHeatmapStatus.textContent = `loading ${filename}`;
  el.rmdbHeatmapMeta.textContent = "Loading raw ANNOTATION_DATA × SEQPOS reactivity matrix…";
  try {
    const text = await fetchRmdbRdatText(filename);
    if (requestId !== state.rmdbHeatmapRequestId) return;
    const matrix = parseRmdbRdat(text);
    if (!matrix.rows.length || !matrix.columns.length) throw new Error("RDAT has no reactivity matrix");
    state.rmdbHeatmapMatrix = matrix;
    state.rmdbHeatmapFilename = filename;
    populateRmdbHeatmapRangeSelect(matrix);
    renderSelectedRmdbHeatmapRange();
  } catch (error) {
    if (requestId !== state.rmdbHeatmapRequestId) return;
    state.rmdbHeatmapMatrix = null;
    state.rmdbHeatmapFilename = "";
    const controls = el.rmdbHeatmapRangeSelect?.closest(".rmdb-heatmap-controls");
    if (controls) controls.hidden = true;
    el.rmdbHeatmapStatus.textContent = "RDAT unavailable";
    el.rmdbHeatmapMeta.textContent = `Could not load ${filename}: ${error.message || error}`;
  }
}

const coordinateResolvedStyle = { fill: "#e3f1fb", stroke: "#3f7da8" };
const coordinateSequenceOnlyStyle = { fill: "#d8dde3", stroke: "#8d97a3" };
const RESIDUE_STATE_COLORS = Object.freeze({
  loop: { fill: "#dcfce7", stroke: "#2f855a", molstarRgb: { r: 47, g: 133, b: 90 } },
  stem: { fill: "#dbeafe", stroke: "#1d4ed8", molstarRgb: { r: 29, g: 78, b: 216 } },
  selected: { fill: "#fee2e2", stroke: "#9b1c1c", molstarRgb: { r: 155, g: 28, b: 28 } },
  unaligned: { fill: "#e5e7eb", stroke: "#6b7280", molstarRgb: { r: 107, g: 114, b: 128 } },
});
const MOLSTAR_CONTEXT_COLOR = Object.freeze({ r: 229, g: 231, b: 235 });
// 1D track rail geometry. The rail SVG keeps a fixed pixel width; instead of
// squeezing the whole sequence into it we render a fixed-density window and let
// the control bar slide along the sequence. ~10px per residue keeps base letters
// legible (about 99 residues on the default rail).
const TRACK_RAIL_USABLE_WIDTH = 990;
const TRACK_TARGET_CELL_WIDTH = 10;
const TRACK_DEFAULT_SPAN = Math.round(TRACK_RAIL_USABLE_WIDTH / TRACK_TARGET_CELL_WIDTH);


function coordinateDisplayStatus(pdbResidue) {
  return pdbResidue?.coordinateStatus === "resolved"
    ? "resolved atom_site coordinate"
    : "sequence only; no resolved atom_site coordinate";
}

function residueForPosition(position, strand = activeStrand()) {
  const strandId = strand?.strand_id || "strand_1";
  const residue = state.residueByStrandPosition.get(`${strandId}:${position}`);
  if (!residue) {
    throw new Error(`linked-view residue-index missing ${strandId}:${position}`);
  }
  return residue;
}

function profileBaseForPosition(position, strand = activeStrand()) {
  return residueForPosition(position, strand).parentBase;
}

function materializedSequenceAlignment() {
  const alignment = state.structureCoverage?.sequenceAlignment;
  if (!alignment) {
    throw new Error("linked-view structure-coverage missing sequenceAlignment");
  }
  return alignment;
}

function alignmentStateForResidue() {
  const alignment = materializedSequenceAlignment();
  return alignment.mismatchedResidues === 0 && alignment.matchedResidues === alignment.profileResidues
    ? "match"
    : "materialized_alignment";
}

function sequenceAgreementLabel(summary = materializedSequenceAlignment()) {
  return `${summary.matchedResidues}/${summary.profileResidues} profile-PDB polymer residues match`;
}

function sequenceAgreementStatusLabel(summary = materializedSequenceAlignment()) {
  return `profile-PDB polymer sequence match ${summary.matchedResidues}/${summary.profileResidues}`;
}

function atomSiteCoverageLabel(coverage = state.structureCoverage?.coverage || {}) {
  return coverage.profileResidues
    ? `${coverage.resolvedResidues}/${coverage.profileResidues} atom_site coordinate residues observed (${coverage.resolvedProfileRangeLabel || "no resolved range"}; not a sequence-alignment count)`
    : "atom_site coordinate coverage unavailable";
}

function atomSiteCoverageStatusLabel(coverage = state.structureCoverage?.coverage || {}) {
  return coverage.profileResidues
    ? `atom_site coordinates observed ${coverage.resolvedResidues}/${coverage.profileResidues} (${coverage.resolvedProfileRangeLabel || "no resolved range"}; not a sequence-alignment count)`
    : "atom_site coordinate coverage unavailable";
}

function conciseMolstarMeta({ chainKey = "", rangeLabel = "", summary = {}, coverage = {} } = {}) {
  const chain = String(chainKey || "").split("|").at(-1) || "—";
  const profileCount = Number(summary.profileResidues || coverage.profileResidues) || 0;
  const sequenceMatch = profileCount ? `${summary.matchedResidues || 0}/${profileCount}` : "n/a";
  const coordinates = coverage.profileResidues
    ? `${coverage.resolvedResidues}/${coverage.profileResidues}`
    : "n/a";
  const range = rangeLabel || (profileCount ? `1–${profileCount}` : "target");
  return `Chain ${chain} · structure positions ${range} · profile–PDB sequence match ${sequenceMatch} · coordinates available ${coordinates} · colors show current profile reactivity.`;
}

function sequenceOnlyCoordinateNote() {
  return "1-31 and 75-113 are sequence-only/no atom_site coordinates, not alignment failure";
}

function hexToRgb(hex) {
  const value = String(hex || "#ffffff").replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

async function decodeGzipArrayBuffer(buffer) {
  if (!("DecompressionStream" in window)) {
    throw new Error("gzip profile shard requires browser DecompressionStream support");
  }
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).arrayBuffer();
}

async function fetchArrayBufferOrThrow(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch asset ${url}: ${response.status}`);
  }
  return await response.arrayBuffer();
}

async function fetchJsonMaybeGzip(url) {
  const buffer = await fetchArrayBufferOrThrow(url);
  const decoded = String(url).endsWith(".gz") ? await decodeGzipArrayBuffer(buffer) : buffer;
  return JSON.parse(new TextDecoder("utf-8").decode(decoded));
}

async function fetchTextMaybeGzip(url) {
  const buffer = await fetchArrayBufferOrThrow(url);
  const decoded = String(url).endsWith(".gz") ? await decodeGzipArrayBuffer(buffer) : buffer;
  return new TextDecoder("utf-8").decode(decoded);
}

async function loadShard(shardId) {
  if (state.shards.has(shardId)) return state.shards.get(shardId);
  const shardInfo = state.profileIndex.shards[shardId];
  const meta = await fetchJsonMaybeGzip(shardInfo.meta_path);
  const gzipBuffer = await fetchArrayBufferOrThrow(shardInfo.gzip_path);
  const valueBuffer = await decodeGzipArrayBuffer(gzipBuffer);
  const values = new Float32Array(valueBuffer);
  const shard = { meta, values, decodeMode: "gzip", gzipBytes: gzipBuffer.byteLength, rawBytes: valueBuffer.byteLength };
  state.shards.set(shardId, shard);
  return shard;
}

function profileValues(profile, shard) {
  const start = profile.row_index * shard.meta.strand_length;
  const end = start + shard.meta.strand_length;
  return shard.values.subarray(start, end);
}

function normalizeProfile(profile, values) {
  const mapped = Array.from(values).filter((value) => Number.isFinite(value));
  const positives = mapped.filter((value) => value > 0);
  const cap = percentile(positives, 0.95);
  const byPosition = new Map();
  let whiteCount = 0;
  let cappedCount = 0;
  for (let idx = 0; idx < values.length; idx += 1) {
    const raw = values[idx];
    const norm = raw > 0 && cap > 0 ? Math.min(raw / cap, 1) : 0;
    if (norm <= 0) whiteCount += 1;
    if (norm >= 1) cappedCount += 1;
    byPosition.set(idx + 1, {
      raw,
      norm,
      color: colorForNorm(norm),
    });
  }
  return {
    cap,
    byPosition,
    mappedCount: mapped.length,
    whiteCount,
    cappedCount,
    positiveCount: positives.length,
    unmappedCount: profile.unmapped_to_strand_count,
  };
}

function parsePairs(dotbracket) {
  const stack = [];
  const pairs = [];
  for (let i = 0; i < dotbracket.length; i += 1) {
    const char = dotbracket[i];
    if (char === "(") stack.push(i + 1);
    if (char === ")" && stack.length) pairs.push([stack.pop(), i + 1]);
  }
  return pairs;
}

function strandPairs(strand) {
  return strand.pairs?.length ? strand.pairs.map((pair) => [pair.i, pair.j]) : parsePairs(strand.dotbracket);
}

function activeStrand() {
  const profile = state.lastRender?.profile || state.profiles[Number(el.select.value) || 0] || {};
  const strandId = profile.render_strand_id || state.caseData?.default_render_strand_id;
  return state.caseData?.strands.find((item) => item.strand_id === strandId) || state.caseData?.strands[0];
}

function activeProfileId() {
  return state.lastRender?.profile?.profile_id || state.profiles[Number(el.select.value) || 0]?.profile_id || "";
}

function activeChainKey() {
  return state.structureCoverage?.activeChainKey
    || state.caseData?.activeChainKey
    || state.residueByKey.values().next().value?.chainKey
    || "";
}

function buildResidueIndexes(residueIndex) {
  state.residueByKey = new Map();
  state.residueByStrandPosition = new Map();
  state.legacyResidueKeyToKey = new Map();
  for (const residue of residueIndex?.residues || []) {
    state.residueByKey.set(residue.residueKey, residue);
    const strandId = residue.aliases?.renderStrand?.[0] || residue.chainKey?.split("|").at(-1);
    if (strandId && residue.labelSeqId) {
      state.residueByStrandPosition.set(`${strandId}:${residue.labelSeqId}`, residue);
    }
    for (const legacyKey of residue.aliases?.legacyResidueKey || []) {
      state.legacyResidueKeyToKey.set(legacyKey, residue.residueKey);
    }
  }
}

function buildJoinIndexes(profileJoins) {
  state.joinsByProfileResidue = new Map();
  if (profileJoins) {
    for (const record of profileJoins.records || []) {
      state.joinsByProfileResidue.set(`${record.profileId}|${record.residueKey}`, record);
    }
    return;
  }
  for (const profile of state.profileIndex?.profiles || []) {
    for (const residue of state.residueByKey.values()) {
      if (residue.chainKey !== activeChainKey()) continue;
      const join = {
        profileId: profile.profile_id,
        residueKey: residue.residueKey,
        joinKey: `${profile.profile_id}|${residue.residueKey}`,
        sourceRecordKey: `${profile.profile_id}|${residue.labelSeqId}`,
        status: "browser_materialized",
      };
      state.joinsByProfileResidue.set(`${join.profileId}|${join.residueKey}`, join);
    }
  }
}

function buildStructureContextIndexes(structureContexts) {
  state.lociByResidueKey = new Map();
  state.pdbResidueByKey = new Map();
  const chain = state.structureCoverage?.polymerChain || {};
  for (const locus of structureContexts?.loci || []) {
    const residue = state.residueByKey.get(locus.residueKey);
    if (!residue) {
      throw new Error(`structure-contexts references unknown residue ${locus.residueKey}`);
    }
    const locator = locus.locator || {};
    state.lociByResidueKey.set(locus.residueKey, locus);
    state.pdbResidueByKey.set(locus.residueKey, {
      residueKey: locus.residueKey,
      profilePosition: residue.labelSeqId,
      pdbStrandId: chain.pdbStrandId,
      labelAsymId: locator.label_asym_id,
      authAsymId: locator.auth_asym_id,
      labelSeqId: locator.label_seq_id,
      authSeqId: locator.auth_seq_id,
      coordinateStatus: locus.coordinateStatus,
    });
  }
}

function buildStructureCoverageIndexes(structureCoverage) {
  if (!structureCoverage?.sequenceAlignment || !structureCoverage?.coverage || !structureCoverage?.polymerChain) {
    throw new Error("linked-view structure-coverage asset is incomplete");
  }
  state.structureCoverage = structureCoverage;
  state.structureCoverageUrl = linkedViewBundleUrl || linkedViewUrls.structureCoverage;
}

function buildConfidenceIndexes(confidenceSummary) {
  state.confidenceSummary = confidenceSummary || null;
}

function buildLssContextIndexes(lssContext) {
  state.lssContext = lssContext || null;
  state.lssContextByProfileId = new Map();
  for (const record of lssContext?.records || []) {
    state.lssContextByProfileId.set(record.profileId, record);
  }
}

function buildRawAlignmentCoverageIndexes(rawAlignmentCoverage) {
  state.rawAlignmentCoverage = rawAlignmentCoverage || null;
  state.rawAlignmentCoverageByProfileId = new Map();
  for (const record of rawAlignmentCoverage?.records || []) {
    const existing = state.rawAlignmentCoverageByProfileId.get(record.profileId) || [];
    existing.push(record);
    state.rawAlignmentCoverageByProfileId.set(record.profileId, existing);
  }
}

function buildBridgeIndexes(bridges) {
  state.bridgeByResidueKey = new Map();
  for (const bridge of bridges?.bridges || []) {
    for (const residueKey of bridge.residueKeys || []) {
      const existing = state.bridgeByResidueKey.get(residueKey) || [];
      existing.push(bridge);
      state.bridgeByResidueKey.set(residueKey, existing);
    }
  }
}

function buildInteractionIndexes(interactions) {
  state.interactionsByResidueKey = new Map();
  for (const edge of interactions?.edges || []) {
    for (const residueKey of [edge.residueA, edge.residueB]) {
      const existing = state.interactionsByResidueKey.get(residueKey) || [];
      existing.push(edge);
      state.interactionsByResidueKey.set(residueKey, existing);
    }
  }
}

function installLinkedViewIndexes(linkedView) {
  buildResidueIndexes(linkedView.residueIndex);
  buildJoinIndexes(linkedView.profileJoins);
  buildStructureCoverageIndexes(linkedView.structureCoverage);
  buildStructureContextIndexes(linkedView.structureContexts);
  buildBridgeIndexes(linkedView.bridges);
  buildInteractionIndexes(linkedView.interactions);
  buildConfidenceIndexes(linkedView.confidenceSummary);
  buildLssContextIndexes(linkedView.lssContext);
  buildRawAlignmentCoverageIndexes(linkedView.rawAlignmentCoverage);
}

function residueKeyForPosition(position, strand = activeStrand()) {
  return residueForPosition(position, strand).residueKey;
}

function positionFromResidueKey(residueKey) {
  const residue = state.residueByKey.get(residueKey);
  if (residue?.labelSeqId) return residue.labelSeqId;
  const position = Number(String(residueKey || "").split("|").at(-1));
  return Number.isFinite(position) ? position : null;
}

function familyTargetsBase(family, base) {
  const normalizedFamily = String(family || "").toUpperCase();
  if (normalizedFamily === "A") {
    const normalizedBase = String(base || "N").toUpperCase();
    return normalizedBase === "A" || normalizedBase === "C" ? "applicable" : "not_applicable";
  }
  return "applicable";
}

function pairPartnersForPosition(position, strand = activeStrand()) {
  return strandPairs(strand || {}).flatMap(([a, b]) => {
    if (a === position) return [b];
    if (b === position) return [a];
    return [];
  });
}

function secondaryStructureStateForPosition(position, strand = activeStrand()) {
  if (!position || !strand) return "unaligned";
  return pairPartnersForPosition(position, strand).length ? "stem" : "loop";
}

function visualStateForResidue(residueKey, selectedKey = state.selectedResidueKey) {
  if (residueKey && residueKey === selectedKey) return "selected";
  const residue = residueKey ? state.residueByKey.get(residueKey) : null;
  if (!residue || residue.chainKey !== activeChainKey()) return "unaligned";
  return secondaryStructureStateForPosition(residue.labelSeqId);
}

function colorForResidueVisualState(residueKey, selectedKey = state.selectedResidueKey) {
  return RESIDUE_STATE_COLORS[visualStateForResidue(residueKey, selectedKey)] || RESIDUE_STATE_COLORS.unaligned;
}

function lssContextForProfile(profileId = activeProfileId()) {
  return state.lssContextByProfileId.get(profileId) || null;
}

function rawAlignmentCoverageForProfile(profile) {
  if (!profile?.profile_id) return null;
  const records = state.rawAlignmentCoverageByProfileId.get(profile.profile_id) || [];
  return records.find((record) => (
    record.profileId === profile.profile_id
    && (!record.pairId || record.pairId === profile.pair_id)
    && (!record.pairSegmentId || record.pairSegmentId === profile.pair_segment_id)
  )) || records.find((record) => (
    record.profileId === profile.profile_id
    && (!record.pairId || record.pairId === profile.pair_id)
  )) || null;
}

function lssContextLabel(profileId = activeProfileId()) {
  const record = lssContextForProfile(profileId);
  if (!record) return "LSS context: not materialized";
  return `${record.lssStatus} (${record.pairedEvaluable} paired / ${record.unpairedEvaluable} unpaired evaluable; ${record.contextEngine})`;
}

function profileResidueRows(normalized, strand = activeStrand()) {
  if (!normalized || !strand) return [];
  return Array.from({ length: strand.sequence.length }, (_, idx) => {
    const position = idx + 1;
    const residue = residueForPosition(position, strand);
    const row = normalized.byPosition.get(position) || {};
    return {
      position,
      base: residue.parentBase || strand.sequence[idx],
      raw_value: row.raw,
      mapped_to_strand: Number.isFinite(row.raw),
    };
  });
}

function computeDmsLoopRecall(profile, normalized, strand = activeStrand()) {
  const pairedPositions = new Set(strandPairs(strand || {}).flatMap(([i, j]) => [i, j]));
  const denominatorRows = profileResidueRows(normalized, strand).filter((residue) => (
    residue.mapped_to_strand === true
    && /^[AC]$/.test(residue.base)
    && Number(residue.raw_value) > 0
  ));
  const loopRows = denominatorRows.filter((residue) => !pairedPositions.has(residue.position));
  const stemRows = denominatorRows.filter((residue) => pairedPositions.has(residue.position));
  const denominator = denominatorRows.length;
  const numerator = loopRows.length;
  return {
    profileId: profile?.profile_id || "",
    numerator,
    denominator,
    percentage: denominator ? (numerator / denominator) * 100 : null,
    stemSignalPositions: stemRows.map((residue) => residue.position),
  };
}

function formatDmsLoopRecall(recall) {
  if (!recall?.denominator) return "not materialized";
  return `${recall.numerator}/${recall.denominator} (${recall.percentage.toFixed(2)}%)`;
}

function getResidueDetails(residueKey) {
  const position = positionFromResidueKey(residueKey);
  const strand = activeStrand();
  const normalized = state.lastRender?.normalized;
  const profile = state.lastRender?.profile;
  if (!position || !strand || !normalized || !profile) return null;
  const residue = state.residueByKey.get(residueKey);
  if (!residue) throw new Error(`residue-index missing ${residueKey}`);
  const join = state.joinsByProfileResidue.get(`${profile.profile_id}|${residueKey}`);
  const locus = state.lociByResidueKey.get(residueKey);
  const pdbResidue = state.pdbResidueByKey.get(residueKey);
  if (!join) throw new Error(`profile-joins missing ${profile.profile_id} ${residueKey}`);
  if (!locus) throw new Error(`structure-contexts missing ${residueKey}`);
  if (!pdbResidue) throw new Error(`structure projection missing ${residueKey}`);
  const bridges = state.bridgeByResidueKey.get(residueKey) || [];
  const interactions = state.interactionsByResidueKey.get(residueKey) || [];
  const profileBase = residue.parentBase;
  const pdbBase = residue.compId;
  const base = residue.compId || residue.parentBase;
  const value = normalized.byPosition.get(position) || {};
  const raw = Number.isFinite(value.raw) ? Number(value.raw) : null;
  const locator = locus?.locator || {};
  const bridgeLabels = bridges.map((bridge) => bridge.bridgeKey).join(", ");
  const interactionLabels = interactions.map((edge) => edge.interactionKey).join(", ");
  const coverage = state.structureCoverage?.coverage || {};
  const sequenceSummary = materializedSequenceAlignment();
  const confidence = state.confidenceSummary || {};
  const coordinateObserved = pdbResidue?.coordinateStatus === "resolved";
  const structureState = visualStateForResidue(residueKey);
  const pdbLabel = `PDB strand ${pdbResidue.pdbStrandId} residue ${pdbResidue.labelSeqId} (label_asym_id=${pdbResidue.labelAsymId} auth_asym_id=${pdbResidue.authAsymId})`;
  const coordinateStatus = coordinateDisplayStatus(pdbResidue);
  const coverageLabel = `${atomSiteCoverageLabel(coverage)}; ${sequenceOnlyCoordinateNote()}`;
  const lssContext = lssContextForProfile(profile.profile_id);
  const fecLssStatus = [confidence.fec, confidence.lss]
    .filter(Boolean)
    .map((item) => `${item.displayLabel}: ${item.status}`)
    .join("; ") || "not_materialized_in_smoke";
  const joinKey = join.sourceRecordKey || join.joinKey;
  if (!joinKey) throw new Error(`profile-joins missing join key for ${profile.profile_id} ${residueKey}`);
  return {
    residueKey,
    position,
    base,
    profileBase,
    pdbBase,
    sequenceMatch: alignmentStateForResidue(residueKey),
    sequenceAgreement: sequenceAgreementLabel(sequenceSummary),
    structureState,
    raw,
    norm: Number.isFinite(value.norm) ? value.norm : 0,
    color: value.color || "#ffffff",
    joinStatus: join.status,
    joinKey,
    assayState: familyTargetsBase(lssContext?.family || "", profileBase),
    pdbResidue: pdbLabel,
    coordinateStatus,
    coordinateMeaning: coordinateObserved ? "resolved_atom_site_coordinate" : "sequence_only_no_atom_site_coordinate",
    coordinateCoverage: coverageLabel,
    structureLocus: `${state.caseData?.case_id || config.caseId || "case"} auth_asym_id=${locator.auth_asym_id || ""} auth_seq_id=${locator.auth_seq_id || ""} label_asym_id=${locator.label_asym_id || ""} label_seq_id=${locator.label_seq_id || ""}`,
    observed: coordinateObserved,
    bridgeMembership: bridgeLabels || "not_in_bridge",
    interactionEndpoint: interactionLabels || "no_interaction_endpoint",
    lssContext: lssContext ? lssContextLabel(profile.profile_id) : "LSS context: not materialized",
    fecLssConfidence: fecLssStatus,
    annoconfidence: confidence.annoconfidence
      ? `${confidence.annoconfidence.displayLabel}: ${confidence.annoconfidence.status}`
      : "ANNOCONFIDENCE: not_materialized_in_smoke",
    profileJoinConfidence: confidence.profileJoinConfidence?.explanation || "profile join confidence unavailable",
  };
}

function showTip(event, text) {
  el.tip.textContent = text;
  el.tip.style.left = `${event.clientX + 12}px`;
  el.tip.style.top = `${event.clientY + 12}px`;
  el.tip.style.display = "block";
}

function hideTip() {
  el.tip.style.display = "none";
  applyLinkedHover(null);
}

function setDomState(className, residueKey) {
  document.querySelectorAll(".residue-mark").forEach((node) => {
    node.classList.toggle(className, residueKey !== null && node.getAttribute("data-residue-key") === residueKey);
  });
}

function applyLinkedHover(residueKey, origin = "preview") {
  state.hoveredResidueKey = residueKey;
  setDomState("hovered", residueKey);
  if (origin === "3d") {
    renderInspector(residueKey || state.selectedResidueKey);
  } else {
    // 1D/2D hover -> light up the matching residue in the 3D viewer with Mol*'s
    // native hover highlight. 3D-originated hovers are already highlighted by
    // Mol* itself, so skip them to avoid a feedback loop.
    applyMolstarHoverHighlight(residueKey);
  }
}

// Trigger Mol*'s native hover-style highlight on the target-chain crop. The
// effective target is the hovered residue when present, otherwise the selected
// residue, so the border persists on the selection after the mouse leaves.
// Hover never moves the camera (focus stays a click affordance).
function applyMolstarHoverHighlight(_residueKey) {
  const viewer = state.molstarViewer;
  // viewer.visual.highlight/clearHighlight deref this.plugin asynchronously; skip
  // until the underlying plugin is initialized to avoid unhandled rejections.
  if (!viewer?.plugin || !viewer?.visual) return;
  const targetKey = state.hoveredResidueKey || state.selectedResidueKey;
  if (!targetKey) {
    if (typeof viewer.visual.clearHighlight === "function") {
      const r = viewer.visual.clearHighlight();
      if (r && typeof r.catch === "function") r.catch(() => {});
    }
    return;
  }
  if (typeof viewer.visual.highlight !== "function" || !state.lastRender) return;
  const item = buildMolstarTargetDisplayPayload(activeProfileId(), state.selectedResidueKey)
    .find((entry) => entry.residue_key === targetKey);
  if (!item) {
    if (typeof viewer.visual.clearHighlight === "function") {
      const r = viewer.visual.clearHighlight();
      if (r && typeof r.catch === "function") r.catch(() => {});
    }
    return;
  }
  const highlightResult = viewer.visual.highlight({
    data: [{
      struct_asym_id: item.struct_asym_id,
      start_residue_number: item.start_residue_number,
      end_residue_number: item.end_residue_number,
    }],
  });
  if (highlightResult && typeof highlightResult.catch === "function") highlightResult.catch(() => {});
}

function applyMolstarHover(residueKey, event = null) {
  applyLinkedHover(residueKey, "3d");
  if (event && residueKey) {
    const details = getResidueDetails(residueKey);
    showTip(event, `3D ${details?.position || ""} ${details?.base || ""}`);
  }
}

function renderInspector(residueKey = state.selectedResidueKey) {
  const details = residueKey ? getResidueDetails(residueKey) : null;
  if (!details) {
    el.inspectorStatus.textContent = "no residue selected";
    el.inspector.innerHTML = `<div class="sub">Select a residue from 1D, 2D, or 3D.</div>`;
    return;
  }
  el.inspectorStatus.textContent = `${details.position} ${details.base}`;
  const rawValue = details.raw === null ? "missing" : details.raw.toFixed(6);
  el.inspector.innerHTML = `<dl class="inspector-grid">
    <div><dt>Residue</dt><dd>${escapeHtml(details.residueKey)}</dd></div>
    <div><dt>Profile base</dt><dd>${escapeHtml(details.profileBase)}</dd></div>
    <div><dt>PDB polymer base</dt><dd>${escapeHtml(details.pdbBase)} (${escapeHtml(details.sequenceMatch)})</dd></div>
    <div><dt>Sequence agreement</dt><dd>${escapeHtml(details.sequenceAgreement)}</dd></div>
    <div><dt>Structure state</dt><dd>${escapeHtml(details.structureState)}</dd></div>
    <div><dt>Raw value</dt><dd>${escapeHtml(rawValue)}</dd></div>
    <div><dt>Normalized value</dt><dd>${escapeHtml(details.norm.toFixed(6))}</dd></div>
    <div><dt>Join status</dt><dd>${escapeHtml(details.joinStatus)}</dd></div>
    <div><dt>Join key</dt><dd>${escapeHtml(details.joinKey)}</dd></div>
    <div><dt>PDB polymer residue</dt><dd>${escapeHtml(details.pdbResidue)}</dd></div>
    <div><dt>3D coordinate status</dt><dd>${escapeHtml(details.coordinateStatus)}</dd></div>
    <div><dt>3D coverage</dt><dd>${escapeHtml(details.coordinateCoverage)}</dd></div>
    <div><dt>Structure locus</dt><dd>${escapeHtml(details.structureLocus)}</dd></div>
    <div><dt>Assay state</dt><dd>${escapeHtml(details.assayState)}</dd></div>
    <div><dt>Bridge membership</dt><dd>${escapeHtml(details.bridgeMembership)}</dd></div>
    <div><dt>Interaction endpoint</dt><dd>${escapeHtml(details.interactionEndpoint)}</dd></div>
    <div><dt>Observed mask</dt><dd>${escapeHtml(details.coordinateStatus)}</dd></div>
    <div><dt>LSS context</dt><dd>${escapeHtml(details.lssContext)}</dd></div>
    <div><dt>FEC/LSS confidence</dt><dd>${escapeHtml(details.fecLssConfidence)}</dd></div>
    <div><dt>ANNOCONFIDENCE</dt><dd>${escapeHtml(details.annoconfidence)}</dd></div>
  </dl>`;
}

function activeResidues() {
  const chainKey = activeChainKey();
  return [...state.residueByKey.values()]
    .filter((residue) => residue.chainKey === chainKey)
    .sort((a, b) => (a.labelSeqId || 0) - (b.labelSeqId || 0));
}

function alignmentCropRange(coverage = state.structureCoverage) {
  const chain = coverage?.polymerChain || {};
  const alignment = coverage?.sequenceAlignment || {};
  const start = Number(chain.profileStart || 1);
  const end = Number(chain.profileEnd || alignment.profileResidues || activeStrand()?.sequence?.length || start);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error("linked-view structure-coverage has no usable alignment crop range");
  }
  return { start, end, label: `${start}-${end}` };
}

async function loadStructureSourceForMolstar() {
  const coverage = state.structureCoverage;
  if (!coverage?.sourceStructure?.href || !coverage?.atomSiteFilter || !coverage?.coverage) {
    throw new Error("linked-view structure-coverage missing Mol* source metadata");
  }
  const range = alignmentCropRange(coverage);
  const structureCoverageUrl = state.structureCoverageUrl || linkedViewUrls.structureCoverage;
  const sourceHref = resolveStructureSourceHref(coverage.sourceStructure.href, coverage.caseId);
  const resolvedSourceUrl = resolveAssetUrl(sourceHref, structureCoverageUrl);
  return {
    chainKey: coverage.activeChainKey,
    mode: "source-structure",
    sourceUrl: resolvedSourceUrl,
    url: resolvedSourceUrl,
    authAsymId: coverage.atomSiteFilter.auth_asym_id,
    labelAsymId: coverage.atomSiteFilter.label_asym_id,
    atomSiteFilter: coverage.atomSiteFilter,
    alignmentRange: range,
    keptRows: coverage.coverage.resolvedResidues,
  };
}

function splitCifTokens(line) {
  const tokens = [];
  let current = "";
  let quote = "";
  for (let idx = 0; idx < line.length; idx += 1) {
    const char = line[idx];
    if (quote) {
      if (char === quote && (idx === line.length - 1 || /\s/.test(line[idx + 1]))) {
        quote = "";
      } else {
        current += char;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

function atomSiteColumnIndex(headers, name) {
  return headers.findIndex((header) => header === `_atom_site.${name}`);
}

function cifToken(tokens, idx) {
  return idx >= 0 ? String(tokens[idx] || "") : "";
}

function cifNumber(value) {
  const number = Number(String(value || "").replace(/^\?$/, "").replace(/^\.$/, ""));
  return Number.isFinite(number) ? number : null;
}

function atomSiteRowMatchesAlignmentCrop(tokens, columns, atomSiteFilter, range) {
  const labelAsym = cifToken(tokens, columns.labelAsym);
  const authAsym = cifToken(tokens, columns.authAsym);
  const labelSeq = cifNumber(cifToken(tokens, columns.labelSeq));
  const authSeq = cifNumber(cifToken(tokens, columns.authSeq));
  const position = labelSeq ?? authSeq;
  const labelMatches = columns.labelAsym < 0 || labelAsym === String(atomSiteFilter.label_asym_id);
  const authMatches = columns.authAsym < 0 || authAsym === String(atomSiteFilter.auth_asym_id);
  const chainMatches = labelMatches && authMatches;
  return chainMatches
    && Number.isFinite(position)
    && position >= range.start
    && position <= range.end;
}

function filterMmcifAtomSiteLoop(cifText, { atomSiteFilter, range }) {
  const lines = String(cifText || "").split(/\r?\n/);
  const out = [];
  let keptAtomRows = 0;
  let droppedAtomRows = 0;
  let atomSiteLoopSeen = false;

  for (let idx = 0; idx < lines.length;) {
    if (lines[idx].trim() !== "loop_") {
      out.push(lines[idx]);
      idx += 1;
      continue;
    }

    let headerEnd = idx + 1;
    while (headerEnd < lines.length && lines[headerEnd].trim().startsWith("_")) {
      headerEnd += 1;
    }
    const headerLines = lines.slice(idx + 1, headerEnd);
    const headers = headerLines.map((line) => line.trim().split(/\s+/)[0]);
    if (!headers.some((header) => header.startsWith("_atom_site."))) {
      out.push(lines[idx]);
      idx += 1;
      continue;
    }

    atomSiteLoopSeen = true;
    out.push(lines[idx], ...headerLines);
    const columns = {
      labelAsym: atomSiteColumnIndex(headers, "label_asym_id"),
      authAsym: atomSiteColumnIndex(headers, "auth_asym_id"),
      labelSeq: atomSiteColumnIndex(headers, "label_seq_id"),
      authSeq: atomSiteColumnIndex(headers, "auth_seq_id"),
      model: atomSiteColumnIndex(headers, "pdbx_PDB_model_num"),
    };

    // Multi-model ensembles (e.g. NMR PDBs) repeat every residue once per model.
    // Keep only the first model so per-residue label_seq_id addressing stays unique;
    // otherwise the cropped CIF carries N overlapping copies per residue and the
    // Mol* per-residue reactivity coloring cannot resolve a single target. This is a
    // no-op for single-model structures (every row already shares one model number).
    let selectedModel = null;
    let rowIdx = headerEnd;
    while (rowIdx < lines.length) {
      const trimmed = lines[rowIdx].trim();
      if (trimmed === "#") {
        out.push(lines[rowIdx]);
        rowIdx += 1;
        break;
      }
      if (trimmed === "loop_" || trimmed.startsWith("_") || trimmed.startsWith("data_") || trimmed.startsWith("save_")) {
        break;
      }
      if (!trimmed) {
        out.push(lines[rowIdx]);
        rowIdx += 1;
        continue;
      }

      const tokens = splitCifTokens(lines[rowIdx]);
      if (tokens.length >= headers.length && atomSiteRowMatchesAlignmentCrop(tokens, columns, atomSiteFilter, range)) {
        const modelNum = columns.model >= 0 ? cifToken(tokens, columns.model) : "";
        if (columns.model >= 0 && selectedModel === null) {
          selectedModel = modelNum;
        }
        if (columns.model < 0 || modelNum === selectedModel) {
          out.push(lines[rowIdx]);
          keptAtomRows += 1;
        } else {
          droppedAtomRows += 1;
        }
      } else {
        droppedAtomRows += 1;
      }
      rowIdx += 1;
    }
    idx = rowIdx;
  }

  return {
    text: out.join("\n"),
    keptAtomRows,
    droppedAtomRows,
    atomSiteLoopSeen,
  };
}

async function prepareClientAlignmentCroppedCif(sourceCif) {
  const sourceBuffer = await fetchArrayBufferOrThrow(sourceCif.sourceUrl);
  const decoded = String(sourceCif.sourceUrl).endsWith(".gz")
    ? await decodeGzipArrayBuffer(sourceBuffer)
    : sourceBuffer;
  const sourceText = new TextDecoder("utf-8").decode(decoded);
  const filtered = filterMmcifAtomSiteLoop(sourceText, {
    atomSiteFilter: sourceCif.atomSiteFilter,
    range: sourceCif.alignmentRange,
  });
  if (!filtered.atomSiteLoopSeen || filtered.keptAtomRows === 0) {
    throw new Error("client alignment crop produced no target-chain atom_site rows");
  }
  if (state.molstarCroppedUrl) URL.revokeObjectURL(state.molstarCroppedUrl);
  const blob = new Blob([filtered.text], { type: "chemical/x-mmcif" });
  const url = URL.createObjectURL(blob);
  state.molstarCroppedUrl = url;
  return {
    ...sourceCif,
    mode: "client-alignment-crop",
    url,
    croppedAtomSiteRows: filtered.keptAtomRows,
    droppedAtomSiteRows: filtered.droppedAtomRows,
    croppedBytes: filtered.text.length,
  };
}

function colorForMolstarReactivity(row, residueKey, selectedKey = state.selectedResidueKey) {
  if (residueKey && residueKey === selectedKey) return RESIDUE_STATE_COLORS.selected.molstarRgb;
  return hexToRgb(row?.color || "#ffffff");
}

function buildMolstarTargetDisplayPayload(profileId = activeProfileId(), selectedKey = state.selectedResidueKey) {
  const normalized = state.lastRender?.normalized;
  const residues = activeResidues();
  if (!residues.length || !normalized) return [];
  return residues.flatMap((residue) => {
    const position = residue.labelSeqId;
    const residueKey = residue.residueKey;
    const locus = state.lociByResidueKey.get(residueKey);
    const locator = locus?.locator || {};
    if (!position || locus?.coordinateStatus !== "resolved") return [];
    const row = normalized.byPosition.get(position);
    // pdbe-molstar matches start/end_residue_number numerically; the JSON locator
    // carries label_seq_id/auth_seq_id as strings, so coerce to a Number here.
    // A string ("5") never matches the model's numeric residue id, which left the
    // whole chain falling through to nonSelectedColor (no reactivity coloring) and
    // made viewer.visual.focus() target a non-existent residue ("zoom to nothing").
    const residueNumber = Number(
      locator.label_seq_id ?? locator.auth_seq_id ?? residue.labelSeqId ?? position,
    );
    return [{
      struct_asym_id: locator.label_asym_id || locator.auth_asym_id || residue.labelAsymId,
      start_residue_number: residueNumber,
      end_residue_number: residueNumber,
      color: colorForMolstarReactivity(row, residueKey, selectedKey),
      profile_id: profileId,
      residue_key: residueKey,
      chain_key: residue.chainKey,
      dms_fill: row?.color || "#ffffff",
      colorSource: residueKey === selectedKey ? "SELECTED" : "REACTIVITY_FILL",
      visual_state: visualStateForResidue(residueKey, selectedKey),
    }];
  });
}

function updateMolstarTargetDisplayDataset(payload, selectedKey = state.selectedResidueKey) {
  if (!el.molstarHost) return;
  const residue52 = payload.find((item) => item.residue_key === selectedKey) || payload[0] || null;
  el.molstarHost.dataset.targetDisplayMode = "alignment_cropped_target_chain";
  el.molstarHost.dataset.targetDisplayResidues = String(payload.length);
  el.molstarHost.dataset.targetDisplayColorSource = "REACTIVITY_FILL";
  el.molstarHost.dataset.targetDisplayContext = "alignment-cropped target chain";
  el.molstarHost.dataset.targetDisplaySelected = selectedKey || "";
  el.molstarHost.dataset.targetDisplayPreview52 = JSON.stringify(residue52 ? {
    residueKey: residue52.residue_key,
    structAsymId: residue52.struct_asym_id,
    startResidueNumber: residue52.start_residue_number,
    dmsFill: residue52.dms_fill,
    color: residue52.color,
    colorSource: residue52.colorSource,
  } : null);
}

function applyMolstarTargetDisplay(residueKey = state.selectedResidueKey, attempt = 0) {
  if (el.molstarSelectionStatus) {
    el.molstarSelectionStatus.textContent = residueKey ? `selection: ${residueKey}` : "selection: none";
  }
  const payload = buildMolstarTargetDisplayPayload(activeProfileId(), residueKey);
  updateMolstarTargetDisplayDataset(payload, residueKey);
  const viewer = state.molstarViewer;
  // pdbe-molstar exposes viewer.visual.* on the prototype before the underlying
  // Mol* plugin finishes initializing. Calling them while viewer.plugin is still
  // undefined throws asynchronously ("can't access property 'commands'/'managers',
  // this.plugin is undefined") and escapes this try/catch as an unhandled rejection.
  // Wait for viewer.plugin to exist before issuing any visual command.
  if (!viewer?.plugin || !viewer?.visual?.select || !state.lastRender) {
    if (attempt < 8) {
      window.setTimeout(() => applyMolstarTargetDisplay(residueKey, attempt + 1), 250);
    }
    return;
  }
  try {
    const selectResult = viewer.visual.select({
      data: payload,
      // alignment-cropped target chain: dim non-selected target atoms without labeling them unaligned.
      nonSelectedColor: MOLSTAR_CONTEXT_COLOR,
    });
    // visual.select is async; swallow a late rejection (e.g. plugin torn down
    // mid-call) so it never surfaces as an uncaught promise rejection.
    if (selectResult && typeof selectResult.catch === "function") selectResult.catch(() => {});
    focusMolstarOnSelection(viewer, payload, residueKey);
  } catch (_error) {
    if (attempt < 8) {
      window.setTimeout(() => applyMolstarTargetDisplay(residueKey, attempt + 1), 250);
    } else {
      el.molstarStatus.textContent = "Mol* instance loaded; target display payload rejected.";
    }
  }
}

// Re-aim the camera at the active residue so a 1D/2D selection does not leave the
// viewer parked on a previously clicked 3D residue. Clearing the selection resets
// the camera to the full cropped chain.
function focusMolstarOnSelection(viewer, payload, residueKey) {
  // Guard against the same uninitialized-plugin race as applyMolstarTargetDisplay:
  // viewer.visual.reset/focus dereference this.plugin asynchronously.
  if (!viewer?.plugin) return;
  if (!residueKey) {
    if (typeof viewer.visual?.reset === "function") {
      const resetResult = viewer.visual.reset({ camera: true });
      if (resetResult && typeof resetResult.catch === "function") resetResult.catch(() => {});
    }
    return;
  }
  if (typeof viewer.visual?.focus !== "function") return;
  const selectedItem = payload.find((item) => item.residue_key === residueKey);
  if (!selectedItem) return;
  const focusResult = viewer.visual.focus([{
    struct_asym_id: selectedItem.struct_asym_id,
    start_residue_number: selectedItem.start_residue_number,
    end_residue_number: selectedItem.end_residue_number,
  }]);
  if (focusResult && typeof focusResult.catch === "function") focusResult.catch(() => {});
}

function buildMolstarSelectionPayload(profileId = activeProfileId(), selectedKey = state.selectedResidueKey) {
  return buildMolstarTargetDisplayPayload(profileId, selectedKey);
}

function applyMolstarSelection(residueKey = state.selectedResidueKey) {
  applyMolstarTargetDisplay(residueKey);
}

function applyLinkedSelection(residueKey = state.selectedResidueKey, origin = "preview") {
  state.selectedResidueKey = residueKey;
  setDomState("selected", residueKey);
  renderInspector(residueKey);
  if (el.molstarSelectionStatus) {
    el.molstarSelectionStatus.textContent = residueKey ? `selection: ${residueKey}` : "selection: none";
  }
  if (origin !== "3d") applyMolstarSelection(residueKey);
  // Keep the native Mol* highlight on the freshly selected residue so the border
  // stays after the mouse leaves the 1D/2D mark.
  applyMolstarHoverHighlight(residueKey);
}

function selectResidue(residueKey, origin = "preview") {
  // Toggle: clicking the already-selected residue clears the selection.
  const nextKey = residueKey && residueKey === state.selectedResidueKey ? null : residueKey;
  applyLinkedSelection(nextKey, origin);
}

function trackHoverText(trackKind, details) {
  if (!details) return trackKind;
  const labels = {
    profile_sequence: `Profile/RMDB seq ${details.position}: ${details.profileBase}`,
    pdb_polymer_alignment: `PDB polymer alignment ${details.position}: profile ${details.profileBase} -> PDB ${details.pdbBase} (${details.sequenceMatch})`,
    structure_state: `Structure state ${details.position}: ${details.structureState}`,
    pdb_residue: `3D coords ${details.position}: ${details.coordinateStatus}`,
    dms_targetability: `targetability ${details.position}: ${details.assayState}`,
    profile_value: `reactivity ${details.position}: raw=${details.raw === null ? "missing" : details.raw.toFixed(6)} norm=${details.norm.toFixed(3)}`,
    bridge_membership: `DBN bridge ${details.position}: ${details.bridgeMembership}`,
    observed_mask: `3D coordinates ${details.position}: ${details.coordinateStatus}`,
    fec_lss_confidence: `FEC/LSS ${details.position}: ${details.fecLssConfidence}`,
    interaction_endpoint_occupancy: `Interactions ${details.position}: ${details.interactionEndpoint}`,
  };
  return labels[trackKind] || `${trackKind} ${details.position} ${details.base}`;
}

function handleTrackHoverEvent(event, residueKey, trackKind) {
  const details = getResidueDetails(residueKey);
  applyLinkedHover(residueKey, "1d");
  showTip(event, trackHoverText(trackKind, details));
}

function handleBridgeTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:bridge_membership");
}

function handleObservedTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:observed_mask");
}

function handleProfileSequenceTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:profile_sequence");
}

function handlePdbAlignmentTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:pdb_polymer_alignment");
}

function handleStructureStateTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:structure_state");
}

function handlePdbResidueTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:pdb_residue");
}

function handleInteractionTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:interaction_endpoint_occupancy");
}

function handleConfidenceTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:fec_lss_confidence");
}

function handleTargetabilityTrackEvent(event, residueKey) {
  event.preventDefault();
  selectResidue(residueKey, "1d:dms_targetability");
}

function clampViewport(start, end, length) {
  const minSpan = 12;
  let span = Math.max(minSpan, Math.round(end - start + 1));
  span = Math.min(length, span);
  let nextStart = Math.max(1, Math.min(length - span + 1, Math.round(start)));
  return { start: nextStart, end: nextStart + span - 1 };
}

// Find the window (TRACK_DEFAULT_SPAN wide) whose summed reactivity (norm) is
// the densest, so the first screen of a large sequence lands on the most
// information-rich stretch. Falls back to position 1 when there is no signal.
function densestReactivityWindow(length, normalized) {
  const span = Math.min(length, TRACK_DEFAULT_SPAN);
  if (span >= length || !normalized?.byPosition) {
    return { start: 1, end: length };
  }
  const weights = new Array(length + 1).fill(0);
  for (let pos = 1; pos <= length; pos += 1) {
    const row = normalized.byPosition.get(pos);
    const norm = row?.norm;
    weights[pos] = Number.isFinite(norm) && norm > 0 ? norm : 0;
  }
  let windowSum = 0;
  for (let pos = 1; pos <= span; pos += 1) windowSum += weights[pos];
  let bestSum = windowSum;
  let bestStart = 1;
  for (let start = 2; start + span - 1 <= length; start += 1) {
    windowSum += weights[start + span - 1] - weights[start - 1];
    if (windowSum > bestSum) {
      bestSum = windowSum;
      bestStart = start;
    }
  }
  return { start: bestStart, end: bestStart + span - 1 };
}

// Default first-screen viewport for a freshly rendered profile: the densest
// reactivity window at the fixed display density.
function defaultViewport(length, normalized) {
  if (length <= TRACK_DEFAULT_SPAN) return { start: 1, end: length };
  return densestReactivityWindow(length, normalized);
}

function setViewport(start, end) {
  const strand = activeStrand();
  if (!strand) return;
  state.viewport = clampViewport(start, end, strand.sequence.length);
  renderTrackRail();
}

// Reflect the current window onto the control-bar slider. The slider scrolls the
// window start across the sequence; its range collapses (disabled) when the whole
// sequence already fits.
function syncViewportSlider(start, end, length) {
  if (!el.viewportSlider) return;
  const span = end - start + 1;
  const maxStart = Math.max(1, length - span + 1);
  el.viewportSlider.min = "1";
  el.viewportSlider.max = String(maxStart);
  el.viewportSlider.value = String(Math.min(start, maxStart));
  el.viewportSlider.disabled = maxStart <= 1;
}

function zoomTrack(direction) {
  const { start, end } = state.viewport;
  const span = end - start + 1;
  const center = (start + end) / 2;
  const factor = direction > 0 ? 0.68 : 1.45;
  const nextSpan = Math.max(12, Math.round(span * factor));
  setViewport(Math.round(center - nextSpan / 2), Math.round(center + nextSpan / 2));
}

function panTrack(direction) {
  const { start, end } = state.viewport;
  const span = end - start + 1;
  const shift = Math.max(1, Math.round(span * 0.32)) * direction;
  setViewport(start + shift, end + shift);
}

function createSvgNode(svg, name, attrs = {}) {
  const node = document.createElementNS(svg.namespaceURI, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function wireTrackMark(mark, residueKey, trackKind, clickHandler) {
  mark.setAttribute("class", `${mark.getAttribute("class") || ""} residue-mark`.trim());
  mark.setAttribute("data-residue-key", residueKey);
  mark.setAttribute("data-track-kind", trackKind);
  mark.addEventListener("mousemove", (event) => handleTrackHoverEvent(event, residueKey, trackKind));
  mark.addEventListener("mouseleave", hideTip);
  mark.addEventListener("click", (event) => clickHandler(event, residueKey));
}

function renderTrackRail() {
  const strand = activeStrand();
  const normalized = state.lastRender?.normalized;
  if (!strand || !normalized) return;
  state.viewport = { start: 1, end: strand.sequence.length };
  const { start, end } = state.viewport;
  const positions = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  const height = 182;
  const left = 210;
  const right = 18;
  const width = Math.max(1120, left + right + positions.length * 24);
  const usable = width - left - right;
  const xFor = (position) => left + ((position - start + 0.5) / positions.length) * usable;
  const cellW = Math.max(4, usable / positions.length - 1);
  const rows = [
    ["Profile pos", 24],
    ["Profile/RMDB seq", 52],
    ["PDB polymer alignment", 84],
    ["Structure state", 116],
    ["reactivity", 148],
  ];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "1D residue track rail");
  svg.appendChild(createSvgNode(svg, "rect", { x: 0, y: 0, width, height, fill: "#ffffff" }));
  for (const [label, y] of rows) {
    const text = createSvgNode(svg, "text", { x: 2, y: y + 6, "font-size": "1.08rem", "font-weight": 400, fill: "#000000" });
    text.textContent = label;
    svg.appendChild(text);
    svg.appendChild(createSvgNode(svg, "line", { x1: left, x2: width - right, y1: y, y2: y, stroke: "#e3e7ec", "stroke-width": 1 }));
  }
  for (const position of positions) {
    const x = xFor(position);
    const residueKey = residueKeyForPosition(position, strand);
    const residue = state.residueByKey.get(residueKey);
    if (!residue) throw new Error(`residue-index missing ${residueKey}`);
    const profileBase = residue.parentBase;
    const pdbBase = residue.compId;
    const alignmentState = alignmentStateForResidue(residueKey);
    const row = normalized.byPosition.get(position) || {};
    const color = row.color || "#ffffff";
    if (position === 1 || position % 10 === 0 || position === strand.sequence.length) {
      svg.appendChild(createSvgNode(svg, "line", { x1: x, x2: x, y1: 15, y2: 30, stroke: "#7c8792", "stroke-width": 0.8 }));
      const tick = createSvgNode(svg, "text", { x, y: 14, "font-size": "1.08rem", "font-weight": 400, "text-anchor": "middle", fill: "#000000" });
      tick.textContent = String(position);
      svg.appendChild(tick);
    }
    const profileSeq = createSvgNode(svg, "rect", { x: x - cellW / 2, y: 40, width: cellW, height: 24, fill: colorForBase(profileBase), stroke: "#aeb7c1", "stroke-width": 0.5, rx: 1, "data-profile-base": profileBase });
    wireTrackMark(profileSeq, residueKey, "profile_sequence", handleProfileSequenceTrackEvent);
    svg.appendChild(profileSeq);
    const profileText = createSvgNode(svg, "text", { x, y: 56, "font-size": 10, "text-anchor": "middle", fill: "#ffffff", "pointer-events": "none" });
    profileText.textContent = profileBase;
    svg.appendChild(profileText);

    const alignmentFill = { match: "#dceccf", mismatch: "#f8d7da", materialized_alignment: "#eceff3" }[alignmentState];
    const alignmentStroke = { match: "#5d8a45", mismatch: "#b00020", materialized_alignment: "#9aa4ad" }[alignmentState];
    const pdbAlignment = createSvgNode(svg, "rect", {
      x: x - cellW / 2,
      y: 76,
      width: cellW,
      height: 16,
      fill: alignmentFill,
      stroke: alignmentStroke,
      "stroke-width": alignmentState === "match" ? 0.5 : 1.4,
      rx: 1,
      "data-profile-base": profileBase,
      "data-pdb-base": pdbBase,
      "data-alignment-state": alignmentState,
      "data-alignment-source": "structure-coverage.sequenceAlignment",
    });
    wireTrackMark(pdbAlignment, residueKey, "pdb_polymer_alignment", handlePdbAlignmentTrackEvent);
    svg.appendChild(pdbAlignment);
    const pdbAlignmentText = createSvgNode(svg, "text", { x, y: 92, "font-size": 10, "text-anchor": "middle", fill: alignmentState === "mismatch" ? "#7a0013" : "#243018", "pointer-events": "none", "data-alignment-text-for": residueKey, "data-pdb-base": pdbBase });
    pdbAlignmentText.textContent = pdbBase;
    svg.appendChild(pdbAlignmentText);

    const stateColor = colorForResidueVisualState(residueKey);
    const structureState = visualStateForResidue(residueKey);
    const structureStateCell = createSvgNode(svg, "rect", {
      x: x - cellW / 2,
      y: 104,
      width: cellW,
      height: 24,
      fill: stateColor.fill,
      stroke: stateColor.stroke,
      "stroke-width": 0.9,
      rx: 1,
      "data-structure-state": structureState,
    });
    structureStateCell.setAttribute("data-state-color-source", "RESIDUE_STATE_COLORS");
    wireTrackMark(structureStateCell, residueKey, "structure_state", handleStructureStateTrackEvent);
    svg.appendChild(structureStateCell);
    if (position === 1 || position % 10 === 0 || position === strand.sequence.length) {
      const stateTick = createSvgNode(svg, "text", { x, y: 120, "font-size": 8.5, "text-anchor": "middle", fill: stateColor.stroke, "pointer-events": "none" });
      stateTick.textContent = structureState === "stem" ? "S" : structureState === "loop" ? "L" : structureState.slice(0, 1).toUpperCase();
      svg.appendChild(stateTick);
    }

    const profileRect = createSvgNode(svg, "rect", { x: x - cellW / 2, y: 136, width: cellW, height: 24, fill: color, stroke: "#aeb7c1", "stroke-width": 0.5, rx: 1 });
    wireTrackMark(profileRect, residueKey, "profile_value", (event, key) => selectResidue(key, "1d:profile_value"));
    svg.appendChild(profileRect);
    if (row.norm > 0) {
      const barH = Math.max(1, Math.round(row.norm * 21));
      svg.appendChild(createSvgNode(svg, "rect", { x: x - 2, y: 159 - barH, width: 4, height: barH, fill: "#17212b", opacity: 0.35 }));
    }
  }
  el.track.replaceChildren(svg);
  if (el.viewportStatus) el.viewportStatus.textContent = `${start}-${end} / ${strand.sequence.length}`;
  syncViewportSlider(start, end, strand.sequence.length);
  recolorVarnaViewportLink();
  applyLinkedHover(state.hoveredResidueKey);
  applyLinkedSelection(state.selectedResidueKey);
}

function toVarnaRgb(color) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return "rgb(100%, 100%, 100%)";
  const hex = match[1];
  const channels = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${channels.map((value) => Math.round((value / 255) * 100)).join("%, ")}%)`;
}

function recolorVarnaSvg(template, strand, normalized, profile) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(template, "image/svg+xml");
  const svg = doc.documentElement;
  svg.setAttribute("data-view", "varna");
  svg.setAttribute("data-layout-source", "VARNA");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "VARNA secondary structure");
  if (!svg.getAttribute("viewBox")) {
    // VARNA templates ship width/height="100%" but no viewBox, so the old
    // hardcoded "0 0 1270 355" fallback clipped large molecules (real content
    // can extend to ~2390x2557) and forced a wrong 3.58 aspect. Derive the
    // viewBox from the actual content bounding box instead, padding by 10px;
    // fall back to the legacy box only when no numeric coordinates are found.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const num = (node, name) => {
      const v = parseFloat(node.getAttribute(name));
      return Number.isFinite(v) ? v : null;
    };
    svg.querySelectorAll("*").forEach((node) => {
      const xs = [];
      const ys = [];
      for (const name of ["x", "x1", "x2", "cx"]) {
        const v = num(node, name);
        if (v !== null) xs.push(v);
      }
      for (const name of ["y", "y1", "y2", "cy"]) {
        const v = num(node, name);
        if (v !== null) ys.push(v);
      }
      const x0 = num(node, "x");
      const y0 = num(node, "y");
      const w = num(node, "width");
      const h = num(node, "height");
      if (x0 !== null && w !== null) xs.push(x0 + w);
      if (y0 !== null && h !== null) ys.push(y0 + h);
      for (const v of xs) { if (v < minX) minX = v; if (v > maxX) maxX = v; }
      for (const v of ys) { if (v < minY) minY = v; if (v > maxY) maxY = v; }
    });
    if (Number.isFinite(minX) && Number.isFinite(minY) && maxX > minX && maxY > minY) {
      const pad = 10;
      svg.setAttribute("viewBox", `${minX - pad} ${minY - pad} ${(maxX - minX) + pad * 2} ${(maxY - minY) + pad * 2}`);
    } else {
      svg.setAttribute("viewBox", "0 0 1270 355");
    }
  }
  const fillCircles = [...svg.querySelectorAll('circle[stroke="none"][r="5.0"]')];
  const baseTexts = [...svg.querySelectorAll('text[font-family="Verdana"][font-size="7.5"]')];
  if (fillCircles.length !== strand.sequence.length) {
    throw new Error(`VARNA base circle count ${fillCircles.length} does not match strand length ${strand.sequence.length}`);
  }
  for (let idx = 0; idx < fillCircles.length; idx += 1) {
    const pos = idx + 1;
    const residueKey = residueKeyForPosition(pos);
    const colorRow = normalized.byPosition.get(pos);
    const color = colorRow?.color ?? "#ffffff";
    const norm = colorRow?.norm ?? 0;
    const stateColor = colorForResidueVisualState(residueKey);
    const structureState = visualStateForResidue(residueKey);
    fillCircles[idx].setAttribute("fill", toVarnaRgb(color));
    fillCircles[idx].setAttribute("stroke", toVarnaRgb(stateColor.stroke));
    fillCircles[idx].setAttribute("stroke-width", "1.4");
    fillCircles[idx].setAttribute("class", "residue-mark");
    fillCircles[idx].setAttribute("data-position", String(pos));
    fillCircles[idx].setAttribute("data-residue-key", residueKey);
    fillCircles[idx].setAttribute("data-structure-state", structureState);
    fillCircles[idx].setAttribute("data-state-color-source", "RESIDUE_STATE_COLORS");
    fillCircles[idx].setAttribute("data-reactivity-fill", color);
    fillCircles[idx].setAttribute("data-reactivity-norm", Number.isFinite(norm) ? norm.toFixed(6) : "0");
    const title = doc.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${pos} ${strand.sequence[idx]} raw=${colorRow?.raw ?? ""} norm=${norm}`;
    fillCircles[idx].prepend(title);
    if (baseTexts[idx]) {
      baseTexts[idx].setAttribute("fill", norm >= 0.72 ? "rgb(100%, 100%, 100%)" : "rgb(0%, 0%, 0%)");
    }
  }
  installVarnaHitLayer(doc, svg, fillCircles, strand);
  return new XMLSerializer().serializeToString(svg);
}

function installVarnaHitLayer(doc, svg, fillCircles, strand) {
  const group = doc.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("data-layer", "varna-hit-layer");
  group.setAttribute("class", "varna-hit-layer");
  for (let idx = 0; idx < fillCircles.length; idx += 1) {
    const pos = idx + 1;
    const source = fillCircles[idx];
    const hit = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
    hit.setAttribute("class", "residue-mark varna-hit");
    hit.setAttribute("data-layer", "varna-hit-layer");
    hit.setAttribute("data-position", String(pos));
    hit.setAttribute("data-residue-key", residueKeyForPosition(pos, strand));
    hit.setAttribute("cx", source.getAttribute("cx"));
    hit.setAttribute("cy", source.getAttribute("cy"));
    hit.setAttribute("r", "8");
    hit.setAttribute("fill", "transparent");
    hit.setAttribute("stroke", "transparent");
    group.appendChild(hit);
  }
  svg.appendChild(group);
}

function wireVarnaEvents() {
  el.varnaViewport.querySelectorAll('circle[data-layer="varna-hit-layer"][data-position]').forEach((circle) => {
    const position = Number(circle.getAttribute("data-position"));
    const residueKey = circle.getAttribute("data-residue-key") || residueKeyForPosition(position);
    circle.addEventListener("mousemove", (event) => {
      const details = getResidueDetails(residueKey);
      applyLinkedHover(residueKey, "2d");
      showTip(event, `2D ${details?.position || ""} ${details?.base || ""}`);
    });
    circle.addEventListener("click", () => selectResidue(residueKey, "2d"));
    circle.addEventListener("mouseleave", hideTip);
  });
}

// Link the 2D VARNA layout to the 1D viewport: residues inside the current 1D
// window stay at full opacity; residues outside are dimmed so the 2D first screen
// emphasizes the same stretch the reader sees in the 1D rail. When the whole
// sequence fits the window, nothing is dimmed.
function recolorVarnaViewportLink() {
  const svg = el.varnaViewport?.querySelector("svg");
  if (!svg) return;
  const strand = activeStrand();
  if (!strand) return;
  const { start, end } = state.viewport;
  const full = start <= 1 && end >= strand.sequence.length;
  svg.querySelectorAll("[data-position]").forEach((node) => {
    const pos = Number(node.getAttribute("data-position"));
    if (!Number.isFinite(pos)) return;
    const inside = full || (pos >= start && pos <= end);
    if (node.classList.contains("varna-hit")) return;
    node.style.opacity = inside ? "" : "0.18";
  });
}

function fitVarnaSvg() {
  const svg = el.varnaViewport.querySelector("svg");
  if (!svg) return null;
  const viewBox = svg.getAttribute("viewBox") || "0 0 1270 355";
  const [, , width, height] = viewBox.split(/\s+/).map(Number);
  const aspect = width > 0 && height > 0 ? width / height : 1270 / 355;
  el.varnaViewport.style.setProperty("--varna-aspect", String(aspect));
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  applyVarnaZoom();
  return { width, height, aspect };
}

const VARNA_ZOOM_MIN = 1;
const VARNA_ZOOM_MAX = 6;
const VARNA_ZOOM_STEP = 1.4;

// Scale the inner VARNA SVG. The viewport stays a fixed box with overflow auto so
// zoom lets the reader inspect dense regions and pan via scroll.
function applyVarnaZoom() {
  const svg = el.varnaViewport?.querySelector("svg");
  const zoom = state.varnaZoom;
  if (svg) {
    svg.style.width = `${zoom * 100}%`;
    svg.style.height = `${zoom * 100}%`;
  }
  if (el.varnaZoomStatus) {
    el.varnaZoomStatus.textContent = `${Math.round(zoom * 100)}%`;
  }
  if (el.varnaZoomOut) el.varnaZoomOut.disabled = zoom <= VARNA_ZOOM_MIN + 1e-6;
  if (el.varnaZoomIn) el.varnaZoomIn.disabled = zoom >= VARNA_ZOOM_MAX - 1e-6;
}

function setVarnaZoom(next) {
  state.varnaZoom = Math.min(VARNA_ZOOM_MAX, Math.max(VARNA_ZOOM_MIN, next));
  applyVarnaZoom();
}

function zoomVarna(direction) {
  setVarnaZoom(direction > 0 ? state.varnaZoom * VARNA_ZOOM_STEP : state.varnaZoom / VARNA_ZOOM_STEP);
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><b>${value}</b></div>`;
}

async function loadPdbeMolstarAssets() {
  if (!document.getElementById("pdbe-molstar-css")) {
    const css = document.createElement("link");
    css.id = "pdbe-molstar-css";
    css.rel = "stylesheet";
    css.href = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar.css";
    document.head.appendChild(css);
  }
  if (!window.PDBeMolstarPlugin) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar-plugin.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}

function molstarValue(payload, names) {
  for (const name of names) {
    const value = payload?.[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function looksLikeMolstarResiduePayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  return molstarValue(payload, [
    "residueNumber",
    "residue_number",
    "seq_id",
    "seqId",
    "auth_seq_id",
    "authSeqId",
    "label_seq_id",
    "labelSeqId",
    "start_residue_number",
  ]) !== null;
}

function extractMolstarEventData(event) {
  const queue = [event?.eventData, event?.detail, event];
  const seen = new Set();
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);
    if (looksLikeMolstarResiduePayload(item)) return item;
    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }
    queue.push(item.eventData, item.data, item.payload, item.loci, item.current, item.object);
  }
  return {};
}

function molstarEventMatchesActiveChain(payload = {}) {
  const atomSiteFilter = state.structureCoverage?.atomSiteFilter || {};
  const authChainIds = [
    molstarValue(payload, ["auth_asym_id", "authAsymId"]),
    molstarValue(payload, ["auth_chain_id", "authChainId"]),
    molstarValue(payload, ["chain_id", "chainId"]),
  ].filter(Boolean).map(String);
  const labelChainIds = [
    molstarValue(payload, ["label_asym_id", "labelAsymId"]),
    molstarValue(payload, ["label_chain_id", "labelChainId"]),
    molstarValue(payload, ["struct_asym_id", "structAsymId"]),
    molstarValue(payload, ["chain_id", "chainId"]),
    molstarValue(payload, ["entity_id", "entityId"]),
  ].filter(Boolean).map(String);
  return authChainIds.includes(String(atomSiteFilter.auth_asym_id))
    || labelChainIds.includes(String(atomSiteFilter.label_asym_id));
}

function residueKeyFromMolstarEventData(payload = {}) {
  if (!molstarEventMatchesActiveChain(payload)) return null;
  const rawPosition = molstarValue(payload, [
    "label_seq_id",
    "labelSeqId",
    "residueNumber",
    "residue_number",
    "seq_id",
    "seqId",
    "auth_seq_id",
    "authSeqId",
    "start_residue_number",
  ]);
  const position = Number(rawPosition);
  if (!Number.isFinite(position) || position < 1) return null;
  return residueKeyForPosition(position);
}

function handleMolstarResidueEvent(event, mode = "selection", origin = "3d") {
  const residueKey = residueKeyFromMolstarEventData(extractMolstarEventData(event));
  if (!residueKey) return;
  if (mode === "hover") {
    applyMolstarHover(residueKey, event);
  } else {
    selectResidue(residueKey, origin);
  }
}

function installMolstarEventBridge(viewer, host) {
  if (!host || state.molstarBridgeInstalled) return;
  state.molstarBridgeInstalled = true;
  host.addEventListener("PDB.molstar.click", (event) => handleMolstarResidueEvent(event, "selection", "3d"));
  host.addEventListener("PDB.molstar.mouseover", (event) => handleMolstarResidueEvent(event, "hover", "3d"));
  host.addEventListener("PDB.molstar.mouseout", () => applyMolstarHover(null));
  host.dataset.eventBridge = viewer.events ? "viewer.events" : "pdbe-custom-events";
}

function setMolstarStructureDataset(host, structure, sourceKind) {
  if (!host) return;
  host.dataset.structureSource = structure.mode;
  host.dataset.structureSourceKind = sourceKind;
  host.dataset.structureSourceUrl = structure.sourceUrl;
  host.dataset.structureAuthAsymId = structure.authAsymId;
  host.dataset.structureLabelAsymId = structure.labelAsymId;
  host.dataset.structureAtomRows = String(structure.keptRows);
  host.dataset.alignmentCropRange = structure.alignmentRange?.label || "";
  host.dataset.alignmentCropSource = "structure-coverage.sequenceAlignment";
  if (sourceKind === "cropped") {
    host.dataset.croppedAtomSiteRows = String(structure.croppedAtomSiteRows);
    host.dataset.droppedAtomSiteRows = String(structure.droppedAtomSiteRows);
    host.dataset.croppedBytes = String(structure.croppedBytes);
  }
}

async function initMolstarViewer() {
  if (state.molstarViewer || !el.molstarHost) return;
  el.molstarStatus.textContent = `loading Mol* from ${sourceStructureUrl}`;
  el.molstarMeta.textContent = "Loading target chain structure…";
  try {
    const sourceCif = await loadStructureSourceForMolstar();
    const croppedCif = await prepareClientAlignmentCroppedCif(sourceCif);
    setMolstarStructureDataset(el.molstarHost, croppedCif, "cropped");
    installMolstarEventBridge({ events: null }, el.molstarHost);
    const coverage = state.structureCoverage?.coverage;
    const sequenceSummary = materializedSequenceAlignment();
    el.molstarMeta.textContent = conciseMolstarMeta({
      chainKey: croppedCif.chainKey,
      rangeLabel: croppedCif.alignmentRange.label,
      summary: sequenceSummary,
      coverage,
    });
    await loadPdbeMolstarAssets();
    const croppedViewer = new window.PDBeMolstarPlugin();
    state.molstarViewer = croppedViewer;
    croppedViewer.render(el.molstarHost, {
      customData: { url: croppedCif.url, format: "cif" },
      expanded: false,
      hideControls: true,
      bgColor: { r: 255, g: 255, b: 255 },
    });
    el.molstarStatus.textContent = `Mol* instance loaded: target crop ${croppedCif.chainKey}.`;
    // Mol* parses the cropped cif + builds representations asynchronously; on large
    // structures (or slow RCSB fetches) this finishes well after a fixed delay, so the
    // old 700ms timer fired select() before the model existed and the reactivity
    // coloring silently failed (left the default Mol* cartoon color). Color on
    // loadComplete instead; keep a generous timer only as a fallback.
    let targetDisplayApplied = false;
    const applyTargetDisplayOnce = () => {
      if (targetDisplayApplied) return;
      targetDisplayApplied = true;
      applyMolstarTargetDisplay(state.selectedResidueKey);
    };
    if (croppedViewer.events?.loadComplete?.subscribe) {
      croppedViewer.events.loadComplete.subscribe((ok) => {
        if (ok) applyTargetDisplayOnce();
      });
    }
    window.setTimeout(applyTargetDisplayOnce, 4000);
  } catch (error) {
    el.molstarStatus.textContent = "Mol* runtime unavailable; structure views were not rendered.";
    el.molstarHost.innerHTML = `<pre>${escapeHtml(sourceStructureUrl)}\n${escapeHtml(error.message || error)}</pre>`;
  }
}

async function renderProfile(index) {
  const started = performance.now();
  const profile = state.profiles[index];
  if (!profile) return;
  const shard = await loadShard(profile.shard_id);
  const values = profileValues(profile, shard);
  const strandId = profile.render_strand_id || state.caseData.default_render_strand_id;
  const strand = state.caseData.strands.find((item) => item.strand_id === strandId);
  const normalized = normalizeProfile(profile, values);
  const dmsLoopRecall = computeDmsLoopRecall(profile, normalized, strand);
  const lssContext = lssContextForProfile(profile.profile_id);
  const varnaSvg = recolorVarnaSvg(state.varnaTemplate, strand, normalized, profile);
  el.varnaViewport.innerHTML = varnaSvg;
  state.varnaZoom = 1;
  const varnaFit = fitVarnaSvg();
  wireVarnaEvents();
  const elapsed = performance.now() - started;
  state.lastRender = { profile, normalized, shard, elapsed, dmsLoopRecall };
  state.requestedProfileId = profile.profile_id || "";
  el.select.value = String(index);
  state.viewport = { start: 1, end: strand.sequence.length };
  el.molstarHost.setAttribute("data-structure-chain-key", activeChainKey());
  const coverage = state.structureCoverage?.coverage;
  const sequenceSummary = materializedSequenceAlignment();
  const sequenceLength = activeStrand()?.sequence?.length;
  el.molstarMeta.textContent = conciseMolstarMeta({
    chainKey: activeChainKey(),
    rangeLabel: sequenceLength ? `1–${sequenceLength}` : "",
    summary: sequenceSummary,
    coverage,
  });
  el.stats.innerHTML = [
    metric("profiles loaded", state.profiles.length),
    metric("atom_site obs", coverage?.profileResidues ? `${coverage.resolvedResidues}/${coverage.profileResidues}` : "n/a"),
    metric("mapped bases", normalized.mappedCount),
    metric("white bases", normalized.whiteCount),
    metric("positive bases", normalized.positiveCount),
    metric("Normal value", normalized.cap.toFixed(4)),
  ].join("");
  updateView();
  renderTrackRail();
  void renderRmdbHeatmap(profile);
  renderInspector(state.selectedResidueKey);
  applyMolstarTargetDisplay(state.selectedResidueKey);
}

function profileIndexForId(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) return -1;
  return state.profiles.findIndex((profile) => profile.profile_id === normalized);
}

const PROFILE_FAMILY_ORDER = ["A", "B", "C", "D", "E", "F"];

// Build the profile <select> markup grouped by Family. Profiles with a non-empty
// lssContext family are grouped first, sorted by PROFILE_FAMILY_ORDER; profiles
// without a family follow under an "Unassigned family" group so every loaded
// profile stays selectable. Each <option> keeps its original state.profiles index
// so the underlying profile_id<->row mapping stays intact. If no profile carries a
// family, fall back to a flat list of all profiles.
function buildProfileSelectMarkup(profiles) {
  const list = Array.isArray(profiles) ? profiles : [];
  const withFamily = [];
  const withoutFamily = [];
  list.forEach((profile, idx) => {
    const family = lssContextForProfile(profile.profile_id)?.family;
    if (family) withFamily.push({ profile, idx, family: String(family).toUpperCase() });
    else withoutFamily.push({ profile, idx });
  });
  const optionFor = (entry) => {
    const tech = state.techniqueByProfile?.get(entry.profile.profile_id) || {};
    const techName = tech.technology || "—";
    const fam = tech.family || entry.family || "";
    const famSuffix = fam ? ` · Family ${fam}` : "";
    return `<option value="${entry.idx}">${escapeHtml(`${entry.profile.pair_id} | ${techName}${famSuffix}`)}</option>`;
  };
  // No family signal anywhere: keep the original flat list of every profile.
  if (!withFamily.length) {
    return list.map((profile, idx) => optionFor({ profile, idx })).join("");
  }
  const families = Array.from(new Set(withFamily.map((entry) => entry.family)));
  families.sort((a, b) => {
    const ai = PROFILE_FAMILY_ORDER.indexOf(a);
    const bi = PROFILE_FAMILY_ORDER.indexOf(b);
    const ar = ai === -1 ? PROFILE_FAMILY_ORDER.length : ai;
    const br = bi === -1 ? PROFILE_FAMILY_ORDER.length : bi;
    if (ar !== br) return ar - br;
    return a.localeCompare(b);
  });
  const familyGroups = families
    .map((family) => {
      const options = withFamily
        .filter((entry) => entry.family === family)
        .map(optionFor)
        .join("");
      return `<optgroup label="${escapeHtml(`Family ${family}`)}">${options}</optgroup>`;
    })
    .join("");
  // Family-less profiles still belong in the dropdown: hiding them dropped the
  // option count well below the loaded profile count (e.g. 2L1V loads 52 but
  // only 2 carry a family). Surface them under a catch-all group so every
  // profile stays selectable while the family grouping above is preserved.
  const otherGroup = withoutFamily.length
    ? `<optgroup label="Unassigned family">${withoutFamily.map(optionFor).join("")}</optgroup>`
    : "";
  return `${familyGroups}${otherGroup}`;
}

// Resolve the family letter for a profile: prefer the joined technique family
// (case confidence-evidence), fall back to the lssContext family. Returns "".
function familyForProfile(profileId) {
  const joined = state.techniqueByProfile?.get(profileId)?.family;
  if (joined) return String(joined).toUpperCase();
  const ctx = lssContextForProfile(profileId)?.family;
  return ctx ? String(ctx).toUpperCase() : "";
}

// Technique display name for a profile; "—" when unknown.
function techniqueForProfile(profileId) {
  return state.techniqueByProfile?.get(profileId)?.technology || "—";
}

// Human label for a profile option (used as the truncated trigger/list text).
function profileOptionLabel(profile) {
  const tech = techniqueForProfile(profile.profile_id);
  const fam = familyForProfile(profile.profile_id);
  const famSuffix = fam ? ` · Family ${fam}` : "";
  return `${profile.pair_id} | ${tech}${famSuffix}`;
}

// Module-level refresh hook so renderProfile/change can re-sync the trigger label
// with the native <select>'s current value. No-op until the dropdown is mounted.
let refreshProfileDropdownTrigger = () => {};

// Module-level hook so the technique chip filter can gray/hide non-hit profiles
// in the self-built dropdown. No-op until the dropdown is mounted.
let applyProfileDropdownFilter = () => {};

// Build a self-contained colored family-badge dropdown as a sibling of the native
// <select>, which stays in the DOM (hidden) as the source of truth + fallback.
// DOM-only + defensive: returns early if the select is missing or no profiles.
function mountProfileDropdown() {
  const select = el.select;
  if (!select || !Array.isArray(state.profiles) || !state.profiles.length) return;
  // Avoid double-mount if init runs more than once.
  if (select.parentElement?.querySelector(".profile-dropdown")) return;

  const root = document.createElement("div");
  root.className = "profile-dropdown";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "profile-dropdown-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const list = document.createElement("ul");
  list.className = "profile-dropdown-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  root.append(trigger, list);

  const currentIndex = () => {
    const idx = Number(select.value);
    return Number.isInteger(idx) && idx >= 0 ? idx : 0;
  };
  // Populate the floating listbox once; each <li> mirrors a native option index.
  state.profiles.forEach((profile, idx) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.dataset.index = String(idx);
    li.tabIndex = -1;
    const fam = familyForProfile(profile.profile_id);
    const label = profileOptionLabel(profile);
    li.title = label;
    li.innerHTML = `${familyBadgeMarkup(fam)}<span class="profile-dropdown-text">${escapeHtml(label)}</span>`;
    list.appendChild(li);
  });

  const items = () => Array.from(list.querySelectorAll("li[role='option']"));
  const visibleItems = () => items().filter((li) => !li.classList.contains("filtered-out"));

  const refreshTrigger = () => {
    const idx = currentIndex();
    const profile = state.profiles[idx];
    if (!profile) return;
    const fam = familyForProfile(profile.profile_id);
    const label = profileOptionLabel(profile);
    trigger.title = label;
    trigger.innerHTML = `${familyBadgeMarkup(fam)}<span class="profile-dropdown-text">${escapeHtml(label)}</span>`;
    items().forEach((li) => {
      const selected = Number(li.dataset.index) === idx;
      li.setAttribute("aria-selected", selected ? "true" : "false");
      li.classList.toggle("active", selected);
    });
  };

  const closeList = (focusTrigger = false) => {
    list.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (focusTrigger) trigger.focus();
  };
  const openList = () => {
    list.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    const active = visibleItems().find((li) => Number(li.dataset.index) === currentIndex());
    (active || visibleItems()[0])?.focus();
  };
  const selectIndex = (idx) => {
    select.value = String(idx);
    // change listener runs synchronously and refreshes the trigger for us.
    select.dispatchEvent(new Event("change"));
    closeList(true);
  };
  trigger.addEventListener("click", () => {
    if (list.hidden) openList();
    else closeList();
  });
  list.addEventListener("click", (event) => {
    const li = event.target.closest("li[role='option']");
    if (!li) return;
    selectIndex(Number(li.dataset.index));
  });
  list.addEventListener("keydown", (event) => {
    const all = visibleItems();
    const focused = document.activeElement?.closest?.("li[role='option']");
    const pos = focused ? all.indexOf(focused) : -1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      (all[pos + 1] || all[0])?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      (all[pos - 1] || all[all.length - 1])?.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (focused) selectIndex(Number(focused.dataset.index));
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeList(true);
    }
  });
  document.addEventListener("click", (event) => {
    if (!root.contains(event.target)) closeList();
  });

  // Mount as sibling, then hide the native select (kept as source-of-truth +
  // fallback). Hide only AFTER the dropdown is in the DOM.
  // Gray/hide <li> items whose profile is NOT in the given hit set of
  // profileIds. Empty/null hitIds = show all (no active filter). Defensive:
  // never throws if state.profiles is missing.
  const applyFilter = (hitIds) => {
    const filtering = !!(hitIds && hitIds.size);
    items().forEach((li) => {
      const idx = Number(li.dataset.index);
      const pid = state.profiles?.[idx]?.profile_id;
      const hidden = filtering && pid != null && !hitIds.has(String(pid));
      li.classList.toggle("filtered-out", hidden);
      if (hidden) li.setAttribute("aria-hidden", "true");
      else li.removeAttribute("aria-hidden");
    });
  };

  select.insertAdjacentElement("afterend", root);
  select.hidden = true;
  refreshTrigger();
  refreshProfileDropdownTrigger = refreshTrigger;
  applyProfileDropdownFilter = applyFilter;
}

// Two-level technique chip filter above the profile control. First level = one
// colored family chip per family; toggling a family chip both toggles the family
// into the selection AND expands/collapses that family's technique chips (second
// level). Cross-level OR union: a profile is a hit if its family is selected OR
// its technology is selected. Empty selection = show all. DOM-only + defensive.
function mountTechniqueFilter() {
  const select = el.select;
  if (!select || !Array.isArray(state.evidenceRows) || !state.evidenceRows.length) return;
  // Avoid double-mount if init runs more than once.
  if (select.closest(".controls")?.querySelector(".technique-filter")) return;

  const model = buildTechniqueFilterModel(state.evidenceRows, config.chainId);
  if (!model.families.length) return;

  const selection = { families: new Set(), techniques: new Set() };

  const container = document.createElement("div");
  container.className = "technique-filter";
  const famRow = document.createElement("div");
  famRow.className = "technique-chip-row";
  const subLevel = document.createElement("div");
  subLevel.className = "technique-chip-sublevel";
  container.append(famRow, subLevel);

  const refilter = () => {
    applyProfileDropdownFilter(applyTechniqueFilter(model, selection));
  };

  model.families.forEach((fam) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "technique-chip";
    chip.dataset.family = fam;
    chip.setAttribute("aria-pressed", "false");
    chip.innerHTML = familyBadgeMarkup(fam);
    chip.addEventListener("click", () => {
      const on = !selection.families.has(fam);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) {
        selection.families.add(fam);
        appendTechniqueChips(fam);
      } else {
        selection.families.delete(fam);
        removeTechniqueChips(fam);
      }
      refilter();
    });
    famRow.appendChild(chip);
  });

  function appendTechniqueChips(fam) {
    const techs = model.techniquesByFamily.get(fam) || [];
    const group = document.createElement("div");
    group.className = "technique-chip-group";
    group.dataset.family = fam;
    techs.forEach((tech) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "technique-chip technique-chip-sub";
      chip.dataset.technique = tech;
      chip.dataset.family = fam;
      chip.setAttribute("aria-pressed", "false");
      chip.textContent = tech;
      chip.addEventListener("click", () => {
        const on = !selection.techniques.has(tech);
        chip.setAttribute("aria-pressed", on ? "true" : "false");
        if (on) selection.techniques.add(tech);
        else selection.techniques.delete(tech);
        refilter();
      });
      group.appendChild(chip);
    });
    subLevel.appendChild(group);
  }

  function removeTechniqueChips(fam) {
    const group = subLevel.querySelector(`.technique-chip-group[data-family="${fam}"]`);
    if (group) {
      group.querySelectorAll(".technique-chip-sub").forEach((chip) => {
        selection.techniques.delete(chip.dataset.technique);
      });
      group.remove();
    }
  }

  // Insert directly above the profile control (the <label> wrapping the select),
  // falling back to before the dropdown/select itself if no wrapping label.
  const anchor = select.closest("label") || select.parentElement || select;
  anchor.insertAdjacentElement("beforebegin", container);
}

// Choose the default profile by reactivity signal richness rather than the raw
// first profile: some cases (e.g. 1GTN) list a sparse profile first, so the 3D
// view opens almost entirely white. Pure helper takes per-profile positive-value
// counts and returns the richest index; ties resolve to the lowest index so the
// pick stays stable, and an empty/absent set falls back to 0.
function pickRichestProfileIndex(positiveCounts) {
  if (!Array.isArray(positiveCounts) || !positiveCounts.length) return 0;
  let best = 0;
  let bestCount = -1;
  for (let idx = 0; idx < positiveCounts.length; idx += 1) {
    const count = Number(positiveCounts[idx]) || 0;
    if (count > bestCount) {
      bestCount = count;
      best = idx;
    }
  }
  return best;
}

async function richestProfileIndex() {
  const profiles = state.profiles || [];
  if (profiles.length <= 1) return 0;
  // Narrow the candidate set to profiles that carry an lssContext family (the
  // ones visible in the grouped dropdown). Map the richest pick back to its
  // original state.profiles index. If no profile has a family, fall back to the
  // full-list logic so init never stalls on an empty candidate set.
  const familyCandidates = [];
  profiles.forEach((profile, idx) => {
    if (lssContextForProfile(profile.profile_id)?.family) familyCandidates.push({ profile, idx });
  });
  const candidates = familyCandidates.length
    ? familyCandidates
    : profiles.map((profile, idx) => ({ profile, idx }));
  if (candidates.length === 1) return candidates[0].idx;
  const positiveCounts = [];
  for (const { profile } of candidates) {
    let positives = 0;
    try {
      const shard = await loadShard(profile.shard_id);
      const values = profileValues(profile, shard);
      for (let idx = 0; idx < values.length; idx += 1) {
        const value = values[idx];
        if (Number.isFinite(value) && value > 0) positives += 1;
      }
    } catch (_error) {
      positives = 0; // unreadable shard contributes no signal; never blocks init
    }
    positiveCounts.push(positives);
  }
  return candidates[pickRichestProfileIndex(positiveCounts)].idx;
}

function initialProfileIdFromLocation() {
  const params = new URLSearchParams(window.location.search || "");
  return String(params.get("profileId") || "").trim();
}

async function renderProfileById(profileId) {
  const normalized = String(profileId || "").trim();
  if (!normalized) return;
  if (!state.profiles.length) {
    state.requestedProfileId = normalized;
    return;
  }
  const index = profileIndexForId(normalized);
  if (index < 0) return;
  await renderProfile(index);
}

function installExternalProfileBridge() {
  if (window.__annojoinExternalProfileBridgeInstalled) return;
  window.__annojoinExternalProfileBridgeInstalled = true;
  window.addEventListener("message", (event) => {
    const payload = event?.data;
    if (!payload) return;
    if (payload.type === "annojoin:download-profile") {
      downloadSelectedProfile();
      return;
    }
    if (payload.type === "annojoin:download-3d") {
      void downloadSelected3d();
      return;
    }
    if (payload.type !== "annojoin:set-profile") return;
    void renderProfileById(payload.profileId);
  });
}

function updateView() {
  document.querySelector(".swatch-empty + span")?.replaceChildren("No data (missing, unmapped, or non-positive)");
  document.querySelector(".swatch-gradient + span")?.replaceChildren("Reactivity: low → high");
  el.caption.textContent = "Colors show the selected profile's reactivity.";
}

function referenceJournalLine(citation) {
  const pages = citation.pageFirst && citation.pageLast
    ? `${citation.pageFirst}–${citation.pageLast}`
    : citation.pageFirst || citation.pageLast || "";
  const issue = [citation.journal, citation.volume].filter(Boolean).join(" ");
  const publication = [issue, pages].filter(Boolean).join(", ");
  return citation.year && publication ? `${publication} (${citation.year})` : publication || citation.year || "";
}

function externalReferenceLink(href, label) {
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function mountPrimaryReference(citation = null) {
  const pdbId = String(config.caseId || "").trim().toUpperCase();
  if (!pdbId || document.querySelector(".pdb-primary-reference")) return;
  const panel = document.createElement("section");
  panel.className = "panel pdb-primary-reference";
  const rcsbHref = `https://www.rcsb.org/structure/${encodeURIComponent(pdbId)}`;

  let body;
  if (citation?.title) {
    const doi = String(citation.doi || "").trim();
    const pubmedId = String(citation.pubmedId || "").trim();
    const titleHref = doi
      ? `https://doi.org/${encodeURIComponent(doi).replace(/%2F/g, "/")}`
      : pubmedId
        ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pubmedId)}/`
        : rcsbHref;
    const links = [
      pubmedId ? externalReferenceLink(`https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pubmedId)}/`, `PubMed ${pubmedId}`) : "",
      doi ? externalReferenceLink(`https://doi.org/${encodeURIComponent(doi).replace(/%2F/g, "/")}`, `DOI ${doi}`) : "",
      externalReferenceLink(rcsbHref, `View ${pdbId} in PDB`),
    ].filter(Boolean).join("");
    body = `<article class="pdb-primary-reference-citation">
      <h3><a href="${escapeHtml(titleHref)}" target="_blank" rel="noreferrer">${escapeHtml(citation.title)}</a></h3>
      ${Array.isArray(citation.authors) && citation.authors.length ? `<p>${escapeHtml(citation.authors.join("; "))}</p>` : ""}
      ${referenceJournalLine(citation) ? `<p>${escapeHtml(referenceJournalLine(citation))}</p>` : ""}
      <div class="pdb-primary-reference-links">${links}</div>
    </article>`;
  } else {
    body = `<p class="pdb-primary-reference-unavailable">The PDB primary literature record is unavailable for this entry. ${externalReferenceLink(rcsbHref, `View ${pdbId} in PDB`)}</p>`;
  }

  panel.innerHTML = `<div class="panel-head">
    <h2>Reference</h2>
    <span>PDB ${escapeHtml(pdbId)}</span>
  </div>${body}`;
  document.querySelector(".inspector-panel")?.insertAdjacentElement("afterend", panel);
  reportEmbeddedPageHeight();
}

async function loadPrimaryReference() {
  const pdbId = String(config.caseId || "").trim().toUpperCase();
  if (!pdbId) return;
  try {
    const indexUrl = new URL("../../../src/assets/generated/pdb-primary-citations/index.json", import.meta.url);
    const response = await fetch(indexUrl);
    const index = response?.ok ? await response.json() : null;
    mountPrimaryReference(index?.citations?.[pdbId] || null);
  } catch (_error) {
    mountPrimaryReference(null);
  }
}

function loadEfScript(scriptUrl) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl.href;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${scriptUrl.href}`));
    document.body.appendChild(script);
  });
}

function showEfModeError(error) {
  const msg = error && error.message ? error.message : String(error);
  const host = document.querySelector('#assetStatus') || document.querySelector('#ef-matrix-status') || document.querySelector('#ef-heatmap-host');
  if (!host) throw new Error(`EF Workbench has no permanent error host: ${msg}`);
  const pre = document.createElement('pre');
  pre.className = 'ef-workbench-error';
  pre.textContent = `EF case load failed:\n${msg}`;
  host.replaceChildren(pre);
  console.error('[workbench:ef]', error);
}

async function initEfMode(chainId, manifestUrl) {
  const caseId = config.caseId || '';
  const hosts = prepareEfWorkbenchShell(document, { caseId, chainId });
  window.__FOLDBRIDGE_EF_CASE_CONFIG__ = {
    caseId,
    chainId,
    manifestUrl,
    deferBootstrap: true,
  };

  // Locate shared assets from workbench.js itself. This is independent of the
  // current chain page depth and works for both 7SYS/z and 9WNR/a.
  const scripts = [
    new URL('../__entry_ef_site__/ef-heatmap-core.js', import.meta.url),
    new URL('../__entry_ef_site__/ef-heatmap.js', import.meta.url),
    new URL('../__entry_ef_site__/ef-case.js', import.meta.url),
  ];

  // Keep the working 1D DOM intact until every EF dependency is available.
  for (const scriptUrl of scripts) {
    await loadEfScript(scriptUrl);
  }
  if (typeof window.efCaseBootstrap !== 'function') {
    throw new Error('ef-case.js loaded without window.efCaseBootstrap');
  }
  let lockedEvent = null;
  const onInteraction = (event) => {
    if (event?.kind === 'select') lockedEvent = event;
    renderEfInteraction(document, event, lockedEvent);
  };
  const result = await window.efCaseBootstrap({
    caseId,
    chainId,
    manifestUrl,
    hosts,
    onInteraction,
  });
  renderEfWorkbenchMetadata(document, result);
  reportEmbeddedPageHeight();
  return result;
}

async function init() {
  if (manifestDetectionError) throw manifestDetectionError;
  if (detectedEfChain) {
    try {
      await initEfMode(config.chainId || '', efManifestUrl);
      return; // Skip normal workbench initialization
    } catch (error) {
      showEfModeError(error);
      throw error;
    }
  }

  const started = performance.now();
  const linkedViewPromise = linkedViewBundleUrl
    ? fetchJsonMaybeGzip(linkedViewBundleUrl).then((bundle) => ({
        residueIndex: bundle.residueIndex,
        profileJoins: bundle.profileJoins || null,
        structureContexts: bundle.structureContexts,
        structureCoverage: bundle.structureCoverage,
        bridges: bundle.bridges,
        interactions: bundle.interactions,
        confidenceSummary: bundle.confidenceSummary,
        lssContext: bundle.lssContext,
        rawAlignmentCoverage: bundle.rawAlignmentCoverage,
      }))
    : Promise.all([
        fetchJsonMaybeGzip(linkedViewUrls.residueIndex),
        fetchJsonMaybeGzip(linkedViewUrls.profileJoins),
        fetchJsonMaybeGzip(linkedViewUrls.structureContexts),
        fetchJsonMaybeGzip(linkedViewUrls.structureCoverage),
        fetchJsonMaybeGzip(linkedViewUrls.bridges),
        fetchJsonMaybeGzip(linkedViewUrls.interactions),
        fetchJsonMaybeGzip(linkedViewUrls.confidenceSummary),
        fetchJsonMaybeGzip(linkedViewUrls.lssContext),
        fetchJsonMaybeGzip(linkedViewUrls.rawAlignmentCoverage),
      ]).then(([
        residueIndex,
        profileJoins,
        structureContexts,
        structureCoverage,
        bridges,
        interactions,
        confidenceSummary,
        lssContext,
        rawAlignmentCoverage,
      ]) => ({
        residueIndex,
        profileJoins,
        structureContexts,
        structureCoverage,
        bridges,
        interactions,
        confidenceSummary,
        lssContext,
        rawAlignmentCoverage,
      }));
  const [
    caseData,
    profileIndex,
    varnaTemplate,
    linkedView,
    confidenceEvidence,
  ] = await Promise.all([
    fetchJsonMaybeGzip(caseUrl),
    fetchJsonMaybeGzip(profileIndexUrl),
    fetchTextMaybeGzip(varnaTemplateUrl),
    linkedViewPromise,
    fetchJsonMaybeGzip("../../confidence-evidence.json").catch(() => null),
  ]);
  const {
    residueIndex,
    profileJoins,
    structureContexts,
    structureCoverage,
    bridges,
    interactions,
    confidenceSummary,
    lssContext,
    rawAlignmentCoverage,
  } = linkedView;
  state.caseData = caseData;
  state.profileIndex = profileIndex;
  state.linkedView = { residueIndex, profileJoins, structureContexts, structureCoverage, bridges, interactions, confidenceSummary, lssContext, rawAlignmentCoverage };
  installLinkedViewIndexes(state.linkedView);
  state.varnaTemplate = varnaTemplate;
  state.profiles = profileIndex.profiles;
  const evidenceRows = confidenceEvidence?.rows || [];
  state.techniqueByProfile = joinTechniqueByProfile(evidenceRows, config.chainId);
  state.evidenceRows = evidenceRows;
  const strand = activeStrand() || caseData.strands[0];
  state.viewport = { start: 1, end: strand.sequence.length };
  el.select.innerHTML = buildProfileSelectMarkup(state.profiles);
  mountProfileDropdown();
  if (el.status) {
    el.status.textContent = `loaded profile index for ${state.profiles.length} profiles in ${(performance.now() - started).toFixed(1)} ms`;
  }
  const requestedProfileId = state.requestedProfileId || initialProfileIdFromLocation();
  const requestedIndex = profileIndexForId(requestedProfileId);
  const initialIndex = requestedIndex >= 0 ? requestedIndex : await richestProfileIndex();
  await renderProfile(initialIndex);
  // renderProfile sets el.select.value without dispatching change, so re-sync the
  // custom dropdown trigger to the initially rendered profile. No-op if unmounted.
  refreshProfileDropdownTrigger();
  initMolstarViewer();
}

el.select.addEventListener("change", () => {
  refreshProfileDropdownTrigger();
  void renderProfile(Number(el.select.value));
});
el.zoomIn?.addEventListener("click", () => zoomTrack(1));
el.zoomOut?.addEventListener("click", () => zoomTrack(-1));
el.panLeft?.addEventListener("click", () => panTrack(-1));
el.panRight?.addEventListener("click", () => panTrack(1));
if (el.viewportSlider) {
  el.viewportSlider.addEventListener("input", () => {
    const span = state.viewport.end - state.viewport.start + 1;
    const nextStart = Number(el.viewportSlider.value);
    if (!Number.isFinite(nextStart)) return;
    setViewport(nextStart, nextStart + span - 1);
  });
}
el.resetView?.addEventListener("click", () => {
  const strand = activeStrand();
  if (!strand) return;
  const view = defaultViewport(strand.sequence.length, state.lastRender?.normalized);
  setViewport(view.start, view.end);
});
if (el.varnaZoomIn) el.varnaZoomIn.addEventListener("click", () => zoomVarna(1));
if (el.varnaZoomOut) el.varnaZoomOut.addEventListener("click", () => zoomVarna(-1));
if (el.varnaZoomReset) el.varnaZoomReset.addEventListener("click", () => setVarnaZoom(1));

installExternalProfileBridge();
void loadPrimaryReference();

init().catch((error) => {
  if (manifestDetectionError) showEfModeError(error);
  if (!detectedEfChain && !manifestDetectionError && el.status) el.status.textContent = "asset load failed";
});
