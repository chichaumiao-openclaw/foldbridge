if (typeof document !== "undefined") {
  // Inject the shared site nav header. Runs before the bootstrap parse below so the nav
  // appears even if the case bootstrap is missing. case-shell.js is a static parse-time
  // classic script, so document.currentScript is valid here.
  (function () {
    try {
      var self = document.currentScript;
      var selfSrc = self && self.src ? self.src : "";
      var navSrc = new URL("site-nav.js", selfSrc).href;
      if (!document.querySelector('script[data-fb-script-src="' + navSrc + '"]')) {
        var s = document.createElement("script");
        s.src = navSrc;
        s.setAttribute("data-fb-script-src", navSrc);
        (document.head || document.body || document.documentElement).appendChild(s);
      }
    } catch (err) {
      /* nav is non-critical; never block the case shell */
    }
  })();

  const bootstrapNode = document.getElementById("family-case-bootstrap");
  if (!bootstrapNode?.textContent) {
    throw new Error("family case bootstrap missing");
  }
  const bootstrap = JSON.parse(bootstrapNode.textContent);
  const state = {
    activeChainId: bootstrap.defaultChainId,
    selectedEvidenceId: bootstrap.defaultEvidenceId || "",
  };

  const chainButtons = [...document.querySelectorAll("[data-chain-id]")];
  const frame = document.getElementById("chainFrame");
  const chainStatus = document.getElementById("chainStatus");

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
    chainStatus.textContent = `chain ${state.activeChainId}`;
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

  function renderEnrichment(bootstrap) {
    const rows = bootstrap.evidenceRows;
    if (!rows || rows.length === 0) return;

    const best = pickBestEvidence(rows, bootstrap.defaultEvidenceId);
    const famCounts = familyCounts(rows);

    // Hero tier badge inserted after the subtitle <p>.
    const hero = document.querySelector(".hero");
    if (hero && best) {
      const bd = tierDisplay(best.lssTierCalibrated);
      const badge = el("span", `fb-tier-badge tone-${bd.tone}`, `${best.family} · ${bd.label}`);
      const subtitle = hero.querySelector("p");
      if (subtitle) subtitle.insertAdjacentElement("afterend", badge);
      else hero.appendChild(badge);
    }

    // In-place .meta replacement with derived chips.
    const metaNode = document.querySelector(".hero .meta");
    if (metaNode) {
      metaNode.replaceChildren();
      metaNode.appendChild(el("span", "chip", `chains ${distinctChains(rows)}`));
      metaNode.appendChild(el("span", "chip", `profiles ${rows.length}`));
      const fams = Object.keys(famCounts).sort().join("·");
      metaNode.appendChild(el("span", "chip", `families ${fams}`));
    }

    // ENRICHMENT_SCOREBOARD
    const scoreboard = el("section", "fb-scoreboard");
    scoreboard.appendChild(el("h2", null, "Confidence scoreboard"));

    const famRow = el("div", "fb-fam-row");
    for (const f of Object.keys(famCounts).sort()) {
      famRow.appendChild(el("span", "fb-fam", `${f} · ${familyLabel(f)} ×${famCounts[f]}`));
    }
    scoreboard.appendChild(famRow);

    const tCounts = tierCounts(rows);
    const tierRow = el("div", "fb-tier-row");
    const tierTokens = Object.keys(tCounts).sort((a, b) => {
      const ia = TIER_ORDER.indexOf(a);
      const ib = TIER_ORDER.indexOf(b);
      const ra = ia === -1 ? TIER_ORDER.length : ia;
      const rb = ib === -1 ? TIER_ORDER.length : ib;
      if (ra !== rb) return ra - rb;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    for (const token of tierTokens) {
      const td = tierDisplay(token);
      tierRow.appendChild(el("span", `fb-tpill tone-${td.tone}`, `${td.label} ${tCounts[token]}`));
    }
    scoreboard.appendChild(tierRow);

    if (best) {
      const bd = tierDisplay(best.lssTierCalibrated);
      const bestBox = el("div", "fb-best");
      const metricLabel = best.directionalMetricLabel || "metric";
      bestBox.appendChild(el("div", null,
        `${best.technology} — ${metricLabel} ${fmtMetric(best.aucDirectional)} · p ${fmtP(best.aucEmpiricalPValue)} · n ${fmtCount(best.nEvaluable)} · ${bd.label}`));
      if (bd.meaning) bestBox.appendChild(el("div", null, bd.meaning));
      scoreboard.appendChild(bestBox);
    }

    // ENRICHMENT_TABLE
    const details = el("details", "fb-evtable");
    details.appendChild(el("summary", null, `Show all ${rows.length} evidence rows`));
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
      const tierTd = el("td");
      const rd = tierDisplay(row.lssTierCalibrated);
      tierTd.appendChild(el("span", `fb-tpill tone-${rd.tone}`, rd.label));
      tr.appendChild(tierTd);
      tr.appendChild(el("td", null, fmtMetric(row.aucDirectional)));
      tr.appendChild(el("td", null, fmtP(row.aucEmpiricalPValue)));
      tr.appendChild(el("td", null, fmtCount(row.nEvaluable)));
      tr.appendChild(el("td", null, row.profileKey || row.trackProfileId || ""));
      tr.addEventListener("click", () => loadEvidence(row.evidenceId));
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    details.appendChild(table);

    // Mount before the .layout section.
    const wrapper = el("div", "fb-enrichment");
    wrapper.appendChild(scoreboard);
    wrapper.appendChild(details);
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    familyCounts, tierCounts, distinctChains, familyLabel, tierDisplay,
    fmtMetric, fmtP, fmtFraction, fmtCount, pickBestEvidence,
  };
}
