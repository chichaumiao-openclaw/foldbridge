// --- Pure enrichment helpers (DOM-free; safe to load under node for testing) ---

const FAMILY_LABELS = {
  A: "WC-face base-specific",
  B: "SHAPE flexibility",
  C: "enzymatic",
  D: "SASA solvent access",
  E: "contact-map",
  F: "pair-set",
};

const TIER_DISPLAY = {
  LSS_STRONG_CALIBRATED: { label: "STRONG", tone: "strong",
    meaning: "Directional signal clears the bar and passes all secondary gates (self-containment, conflict, size) under permutation." },
  LSS_MODERATE_CANDIDATE: { label: "MODERATE", tone: "moderate",
    meaning: "Directional signal is supported but calibration is pending, so it is held below STRONG." },
  LSS_WEAK: { label: "WEAK", tone: "weak",
    meaning: "Directional signal clears the bar but a secondary gate (self-containment / conflict / size) does not — directional but not yet self-contained." },
  LSS_NOT_SUPPORTED: { label: "NOT SUPPORTED", tone: "not-supported",
    meaning: "Signal does not clear the bar / is not better than chance under permutation." },
  LSS_DISCORDANT: { label: "DISCORDANT", tone: "discordant",
    meaning: "Signal runs counter to the structure (negative / conflicting), not merely absent." },
  LSS_UNDERPOWERED: { label: "UNDERPOWERED", tone: "underpowered",
    meaning: "Too few evaluable residues (or too few paired/unpaired) to judge." },
};

const TIER_ORDER = [
  "LSS_STRONG_CALIBRATED",
  "LSS_MODERATE_CANDIDATE",
  "LSS_WEAK",
  "LSS_DISCORDANT",
  "LSS_NOT_SUPPORTED",
  "LSS_UNDERPOWERED",
];

function familyCounts(rows) {
  const out = {};
  for (const r of rows) { const f = r.family || ""; out[f] = (out[f] || 0) + 1; }
  return out;
}

function tierCounts(rows) {
  const out = {};
  for (const r of rows) {
    const t = r.lssTierCalibrated || "";
    out[t] = (out[t] || 0) + 1;
  }
  return out;
}

function distinctChains(rows) {
  return new Set(rows.map((r) => r.chain).filter(Boolean)).size;
}

function familyLabel(family) {
  return FAMILY_LABELS[family] || String(family);
}

function tierDisplay(token) {
  if (TIER_DISPLAY[token]) return TIER_DISPLAY[token];
  const bare = String(token || "").replace(/^LSS_/, "").replace(/_/g, " ");
  return { label: bare, tone: "not-supported", meaning: "" };
}

function fmtMetric(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(2);
}

function fmtP(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(3);
}

function fmtFraction(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return Number(value).toFixed(2);
}

function fmtCount(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return String(value);
}

function pickBestEvidence(rows, defaultEvidenceId) {
  if (!rows || rows.length === 0) return null;
  const byId = rows.find((r) => r.evidenceId === defaultEvidenceId);
  if (byId) return byId;
  const flagged = rows.find((r) => r.selectedByDefault === true);
  if (flagged) return flagged;
  return rows[0];
}

// DOM bootstrap (browser only). Pure helpers above are referenced here.
if (typeof document !== "undefined") {
  // Add the portal header to top-level entry detail pages. The shared module
  // deliberately skips framed chain workbenches, so nested pages stay chrome-free.
  (function () {
    try {
      var self = document.currentScript;
      var selfSrc = self && self.src ? self.src : "";
      import(new URL("site-nav.js", selfSrc).href).catch(function () {});
    } catch (err) {
      /* navigation is non-critical; never block the case shell */
    }
  })();

  const bootstrapNode = document.getElementById("family-case-bootstrap");
  if (!bootstrapNode?.textContent) {
    throw new Error("family case bootstrap missing");
  }
  const bootstrap = JSON.parse(bootstrapNode.textContent);
  const hero = document.querySelector(".hero");
  const caseId = String(bootstrap.caseId || "").trim();
  if (hero && caseId && !hero.querySelector(".fb-entry-return-link")) {
    const link = document.createElement("a");
    link.className = "fb-entry-return-link";
    const marker = window.location.pathname.search(/\/(?:rmdb|rasp)-v3\/cases\//i);
    const siteRoot = marker >= 0 ? window.location.pathname.slice(0, marker + 1) : "/";
    link.href = `${siteRoot}#entry?pdbId=${encodeURIComponent(caseId)}`;
    link.textContent = "Back to Entry table";
    link.setAttribute("aria-label", `Return to the Entry table filtered to ${caseId}`);
    link.addEventListener("click", (event) => {
      const referrer = document.referrer || "";
      let cameFromEntry = false;
      try {
        const referrerUrl = new URL(referrer, window.location.href);
        cameFromEntry = referrerUrl.origin === window.location.origin;
      } catch (_error) {
        cameFromEntry = false;
      }
      if (cameFromEntry && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    });
    hero.insertBefore(link, hero.firstChild);
  }
  const state = {
    activeChainId: bootstrap.defaultChainId,
    selectedEvidenceId: bootstrap.defaultEvidenceId || "",
  };

  const chainButtons = [...document.querySelectorAll("[data-chain-id]")];
  const frame = document.getElementById("chainFrame");

  function downloadTextFile(filename, text, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function htmlEscape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function mountDownloadActions() {
    if (!hero || hero.querySelector(".fb-download-actions")) return;
    const actions = document.createElement("div");
    actions.className = "fb-download-actions";
    const button = (label, title) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "fb-download-button";
      item.textContent = label;
      item.title = title;
      actions.appendChild(item);
      return item;
    };
    const entryButton = button("Download entry", "Download an HTML summary and JSON data for this entry");
    const profileButton = button("Download profile", "Download the currently selected profile as CSV");
    const structureButton = button("Download 3D structure", "Download the target-chain mmCIF and reactivity color map");
    entryButton.addEventListener("click", () => {
      const payload = {
        downloadType: "foldbridge-entry",
        generatedAt: new Date().toISOString(),
        caseId: bootstrap.caseId || "",
        caseKey: bootstrap.caseKey || "",
        defaultChainId: bootstrap.defaultChainId || "",
        evidenceChainMap: bootstrap.evidenceChainMap || {},
        evidenceRows: bootstrap.evidenceRows || [],
        sourcePage: window.location.href,
      };
      downloadTextFile(
        `foldbridge-entry-${String(bootstrap.caseId || "case").replace(/[^A-Za-z0-9._-]+/g, "_")}.json`,
        JSON.stringify(payload, null, 2),
        "application/json;charset=utf-8"
      );
      const tableRows = (bootstrap.evidenceRows || []).map((row) => `<tr>
        <td>${htmlEscape(row.family)}</td>
        <td>${htmlEscape(row.technology)}</td>
        <td>${htmlEscape(tierDisplay(row.lssTierCalibrated).label)}</td>
        <td>${htmlEscape(row.profileKey || row.trackProfileId || "")}</td>
      </tr>`).join("");
      const pageHtml = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${htmlEscape(bootstrap.caseKey || bootstrap.caseId || "FoldBridge entry")}</title><style>body{font:16px Arial,sans-serif;max-width:1100px;margin:40px auto;color:#111}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd}</style><h1>${htmlEscape(document.querySelector(".hero h1")?.textContent || bootstrap.caseId || "FoldBridge entry")}</h1><p>${htmlEscape(bootstrap.caseKey || "")}</p><h2>Evidence</h2><table><thead><tr><th>Family</th><th>Technology</th><th>Tier</th><th>Profile</th></tr></thead><tbody>${tableRows}</tbody></table><p>Interactive profile and 3D files are available from the detail page downloads.</p></html>`;
      downloadTextFile(
        `foldbridge-entry-${String(bootstrap.caseId || "case").replace(/[^A-Za-z0-9._-]+/g, "_")}.html`,
        pageHtml,
        "text/html;charset=utf-8"
      );
    });
    profileButton.addEventListener("click", () => {
      frame?.contentWindow?.postMessage({ type: "annojoin:download-profile" }, window.location.origin);
    });
    structureButton.addEventListener("click", () => {
      frame?.contentWindow?.postMessage({ type: "annojoin:download-3d" }, window.location.origin);
    });
    const heading = hero.querySelector("h1");
    if (heading) {
      const titleRow = document.createElement("div");
      titleRow.className = "fb-hero-title-row";
      heading.parentNode.insertBefore(titleRow, heading);
      titleRow.append(heading, actions);
    } else {
      hero.insertBefore(actions, hero.firstChild);
    }
  }
  mountDownloadActions();

  function setWorkbenchFrameHeight(height) {
    const nextHeight = Number(height);
    if (!frame || !Number.isFinite(nextHeight) || nextHeight <= 0) return;
    frame.style.height = `${Math.ceil(nextHeight)}px`;
  }

  if (typeof window !== "undefined") {
    window.addEventListener("message", (event) => {
      if (event.source !== frame?.contentWindow) return;
      if (event.data?.type !== "foldbridge-workbench-height") return;
      setWorkbenchFrameHeight(event.data.height);
    });
  }

  frame?.addEventListener("load", () => {
    try {
      setWorkbenchFrameHeight(frame.contentDocument?.documentElement?.scrollHeight);
    } catch (error) {
      /* The child also reports its height after asynchronous content renders. */
    }
  });

  function evidenceById(evidenceId) {
    return bootstrap.evidenceRows.find((row) => row.evidenceId === evidenceId) || null;
  }

  function defaultEvidenceForChain(chainId) {
    return bootstrap.evidenceRows.find((row) => bootstrap.evidenceChainMap[row.evidenceId] === chainId) || null;
  }

  function updateFrame() {
    const selected = evidenceById(state.selectedEvidenceId);
    const selectedChainId = selected ? bootstrap.evidenceChainMap[selected.evidenceId] : "";
    const activeEvidence = selected && selectedChainId === state.activeChainId
      ? selected
      : defaultEvidenceForChain(state.activeChainId);
    const profileId = activeEvidence?.trackProfileId || activeEvidence?.profileKey || "";
    const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : "";
    const chainPage = bootstrap.chainPageById[state.activeChainId] || "";
    frame.src = `${chainPage}${query}`;
  }

  function loadEvidence(evidenceId) {
    state.selectedEvidenceId = evidenceId;
    const chainId = bootstrap.evidenceChainMap[evidenceId];
    if (chainId && chainId !== state.activeChainId) {
      state.activeChainId = chainId;
    }
    syncUi();
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  // GUARD_PLACEHOLDER_2
  function renderEnrichment(bootstrap) {
    const rows = bootstrap.evidenceRows;
    if (!rows || rows.length === 0) return;

    document.querySelector(".hero .meta")?.remove();

    // Evidence stays visible; scroll the table after ten rows instead of hiding it.
    const evidenceTable = el("section", "fb-evtable");
    const scroll = el("div", "fb-evidence-scroll");
    scroll.setAttribute("aria-label", "Evidence rows");
    const table = el("table");
    const thead = el("thead");
    const headRow = el("tr");
    for (const h of ["Family", "Technology", "Tier", "Metric", "p", "n", "Profile"]) {
      headRow.appendChild(el("th", null, h));
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const row of rows) {
      const tr = el("tr");
      tr.dataset.evidenceId = row.evidenceId;
      tr.appendChild(el("td", null, row.family));
      tr.appendChild(el("td", null, row.technology));
      const rd = tierDisplay(row.lssTierCalibrated);
      tr.appendChild(el("td", null, rd.label));
      tr.appendChild(el("td", null, fmtMetric(row.aucDirectional)));
      tr.appendChild(el("td", null, fmtP(row.aucEmpiricalPValue)));
      tr.appendChild(el("td", null, fmtCount(row.nEvaluable)));
      tr.appendChild(el("td", null, row.profileKey || row.trackProfileId || ""));
      tr.addEventListener("click", () => loadEvidence(row.evidenceId));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    scroll.appendChild(table);
    evidenceTable.appendChild(scroll);

    // Mount before the .layout section.
    const wrapper = el("div", "fb-enrichment");
    wrapper.appendChild(evidenceTable);
    const layout = document.querySelector(".layout");
    if (layout && layout.parentNode) layout.parentNode.insertBefore(wrapper, layout);
  }

  function refreshEvidenceHighlight(selectedId) {
    const trs = document.querySelectorAll(".fb-evtable tr[data-evidence-id]");
    for (const tr of trs) {
      tr.classList.toggle("is-active", tr.dataset.evidenceId === selectedId);
    }
  }

  function syncUi() {
    for (const button of chainButtons) {
      button.classList.toggle("is-active", button.dataset.chainId === state.activeChainId);
    }
    updateFrame();
    if (typeof refreshEvidenceHighlight === "function") {
      refreshEvidenceHighlight(state.selectedEvidenceId);
    }
  }

  for (const button of chainButtons) {
    button.addEventListener("click", () => {
      state.activeChainId = button.dataset.chainId || bootstrap.defaultChainId;
      const nextEvidence = defaultEvidenceForChain(state.activeChainId);
      state.selectedEvidenceId = nextEvidence?.evidenceId || "";
      syncUi();
    });
  }

  if (!state.selectedEvidenceId) {
    const fallback = defaultEvidenceForChain(state.activeChainId);
    if (fallback) state.selectedEvidenceId = fallback.evidenceId;
  } else {
    const selected = evidenceById(state.selectedEvidenceId);
    const selectedChainId = selected ? bootstrap.evidenceChainMap[selected.evidenceId] : "";
    if (selectedChainId !== state.activeChainId) {
      const fallback = defaultEvidenceForChain(state.activeChainId);
      state.selectedEvidenceId = fallback?.evidenceId || state.selectedEvidenceId;
    }
  }
  renderEnrichment(bootstrap);
  syncUi();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    familyCounts, tierCounts, distinctChains, familyLabel, tierDisplay,
    fmtMetric, fmtP, fmtFraction, fmtCount, pickBestEvidence,
  };
}
