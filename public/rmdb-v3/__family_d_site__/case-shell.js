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

  function syncUi() {
    for (const button of chainButtons) {
      button.classList.toggle("is-active", button.dataset.chainId === state.activeChainId);
    }
    updateFrame();
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
    fmtMetric, fmtP, fmtFraction, pickBestEvidence,
  };
}
