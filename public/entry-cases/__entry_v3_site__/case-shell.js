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

const ENTRY_CASE_HEIGHT_MESSAGE = "foldbridge-case-height";
const WORKBENCH_PROGRESS_MESSAGE = "foldbridge-workbench-progress";

function measureEmbeddedCaseHeight(shell, scrollY = 0, marginBottom = 0) {
  if (!shell || typeof shell.getBoundingClientRect !== "function") return null;
  const bottom = Number(shell.getBoundingClientRect().bottom);
  const scrollOffset = Number(scrollY);
  const bottomMargin = Number(marginBottom);
  if (![bottom, scrollOffset, bottomMargin].every(Number.isFinite)) return null;
  return Math.ceil(Math.max(0, bottom + scrollOffset + bottomMargin));
}

function postEmbeddedCaseHeight(parentWindow, height) {
  const nextHeight = Number(height);
  if (!parentWindow || typeof parentWindow.postMessage !== "function") return false;
  if (!Number.isFinite(nextHeight) || nextHeight <= 0) return false;
  // The containing site can run on production, preview, or localhost origins.
  // The payload is only a numeric layout hint; the parent validates origin and source.
  parentWindow.postMessage({ type: ENTRY_CASE_HEIGHT_MESSAGE, height: nextHeight }, "*");
  return true;
}

function initialChainId(bootstrap, search = "") {
  const requested = new URLSearchParams(search).get("chain");
  if (requested && Object.prototype.hasOwnProperty.call(bootstrap?.chainPageById || {}, requested)) {
    return requested;
  }
  return bootstrap?.defaultChainId || "";
}

function mergeDeferredEvidence(bootstrap, payload) {
  if (!bootstrap || typeof bootstrap !== "object") throw new TypeError("Case bootstrap must be an object");
  if (!payload || !Array.isArray(payload.rows)) throw new TypeError("Deferred case evidence must contain rows");
  const evidenceChainMap = {};
  for (const row of payload.rows) {
    const evidenceId = String(row?.evidenceId || "");
    const chain = String(row?.chain || "");
    if (!evidenceId || !chain) throw new TypeError("Deferred case evidence rows require evidenceId and chain");
    evidenceChainMap[evidenceId] = chain;
  }
  bootstrap.evidenceRows = payload.rows;
  bootstrap.evidenceChainMap = evidenceChainMap;
  return bootstrap;
}

function matchesCaseDownloadMessage(payload, caseId, chainId) {
  return String(payload?.caseId || "") === String(caseId || "")
    && String(payload?.chainId || "") === String(chainId || "");
}

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
  if (window.parent !== window) {
    document.documentElement.classList.add("is-embedded");
  }

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
  bootstrap.evidenceRows = Array.isArray(bootstrap.evidenceRows) ? bootstrap.evidenceRows : [];
  bootstrap.evidenceChainMap = bootstrap.evidenceChainMap && typeof bootstrap.evidenceChainMap === "object"
    ? bootstrap.evidenceChainMap
    : {};
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
    activeChainId: initialChainId(bootstrap, window.location.search),
    selectedEvidenceId: bootstrap.defaultEvidenceId || "",
  };

  const chainButtons = [...document.querySelectorAll("[data-chain-id]")];
  const frame = document.getElementById("chainFrame");
  const chainStatus = document.querySelector("#chainStatus");
  let embeddedCaseHeightRequest = null;
  let caseProgressValue = 15;
  let caseProgressTimer = null;

  const caseProgress = document.createElement("div");
  caseProgress.className = "fb-case-progress";
  caseProgress.setAttribute("aria-live", "polite");
  caseProgress.innerHTML = `
    <div class="fb-case-progress-copy">
      <span data-case-progress-label>Opening Case page…</span>
      <span data-case-progress-percent aria-hidden="true">15%</span>
    </div>
    <div class="fb-case-progress-track" role="progressbar" aria-label="Case loading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="15">
      <span data-case-progress-fill></span>
    </div>
    <button type="button" class="fb-case-progress-retry" hidden>Retry</button>`;
  frame?.parentElement?.insertBefore(caseProgress, frame);

  const progressLabel = caseProgress.querySelector("[data-case-progress-label]");
  const progressPercent = caseProgress.querySelector("[data-case-progress-percent]");
  const progressTrack = caseProgress.querySelector("[role=progressbar]");
  const progressFill = caseProgress.querySelector("[data-case-progress-fill]");
  const progressRetry = caseProgress.querySelector(".fb-case-progress-retry");

  function armCaseProgressTimer() {
    clearTimeout(caseProgressTimer);
    caseProgressTimer = window.setTimeout(() => {
      caseProgress.dataset.state = "slow";
      progressLabel.textContent = "This Case is taking longer than expected.";
      progressRetry.hidden = false;
    }, 45_000);
  }

  function setCaseProgress({ progress, label, state = "loading" }) {
    const next = Number(progress);
    if (Number.isFinite(next) && next < caseProgressValue && state === "loading") return;
    if (Number.isFinite(next) && next >= caseProgressValue) caseProgressValue = Math.min(100, next);
    if (label) progressLabel.textContent = label;
    progressPercent.textContent = `${caseProgressValue}%`;
    progressTrack.setAttribute("aria-valuenow", String(caseProgressValue));
    progressFill.style.transform = `scaleX(${caseProgressValue / 100})`;
    caseProgress.dataset.state = state;
    progressRetry.hidden = state !== "error" && state !== "slow";
    if (state === "ready" || caseProgressValue >= 100) {
      clearTimeout(caseProgressTimer);
      caseProgress.classList.add("is-complete");
    } else {
      armCaseProgressTimer();
    }
  }

  progressRetry?.addEventListener("click", () => {
    caseProgressValue = 15;
    caseProgress.classList.remove("is-complete");
    setCaseProgress({ progress: 15, label: "Retrying Case data…" });
    if (frame) frame.src = frame.src;
  });
  setCaseProgress({ progress: 15, label: "Opening Case page…" });

  function reportEmbeddedCaseHeight() {
    if (window.parent === window) return;
    const shell = document.querySelector(".shell");
    const marginBottom = shell ? parseFloat(getComputedStyle(shell).marginBottom) || 0 : 0;
    const height = measureEmbeddedCaseHeight(shell, window.scrollY, marginBottom);
    postEmbeddedCaseHeight(window.parent, height);
  }

  function reportEmbeddedCaseHeightSoon() {
    if (embeddedCaseHeightRequest !== null) cancelAnimationFrame(embeddedCaseHeightRequest);
    embeddedCaseHeightRequest = requestAnimationFrame(() => {
      embeddedCaseHeightRequest = null;
      reportEmbeddedCaseHeight();
    });
  }

  if (window.parent !== window) {
    const shell = document.querySelector(".shell");
    if (shell && typeof ResizeObserver !== "undefined") {
      new ResizeObserver(reportEmbeddedCaseHeightSoon).observe(shell);
    }
    window.addEventListener("load", reportEmbeddedCaseHeightSoon, { once: true });
    reportEmbeddedCaseHeightSoon();
  }

  let alignmentDownloadLink = null;
  let profileDownloadMenu = null;
  let profileDownloadList = null;

  function mountDownloadActions() {
    if (!hero || hero.querySelector(".fb-download-actions")) return;
    const actions = document.createElement("div");
    actions.className = "fb-download-actions";
    alignmentDownloadLink = document.createElement("a");
    alignmentDownloadLink.className = "fb-download-button";
    alignmentDownloadLink.textContent = "Download alignment mmCIF";
    alignmentDownloadLink.title = "Download the alignment-cropped mmCIF for this chain";
    alignmentDownloadLink.setAttribute("aria-disabled", "true");
    actions.appendChild(alignmentDownloadLink);

    profileDownloadMenu = document.createElement("details");
    profileDownloadMenu.className = "fb-profile-download-menu";
    const profileSummary = document.createElement("summary");
    profileSummary.className = "fb-download-button";
    profileSummary.textContent = "Download profiles";
    profileSummary.title = "Download the compressed profile index, values, and metadata";
    profileSummary.setAttribute("aria-disabled", "true");
    profileSummary.addEventListener("click", (event) => {
      if (profileSummary.getAttribute("aria-disabled") === "true") event.preventDefault();
    });
    profileDownloadList = document.createElement("div");
    profileDownloadList.className = "fb-profile-download-list";
    profileDownloadList.textContent = "Preparing profile links…";
    profileDownloadMenu.append(profileSummary, profileDownloadList);
    actions.appendChild(profileDownloadMenu);
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

  function resetCaseDownloadActions() {
    alignmentDownloadLink?.removeAttribute("href");
    alignmentDownloadLink?.removeAttribute("download");
    alignmentDownloadLink?.setAttribute("aria-disabled", "true");
    const summary = profileDownloadMenu?.querySelector("summary");
    summary?.setAttribute("aria-disabled", "true");
    if (profileDownloadMenu) profileDownloadMenu.open = false;
    if (profileDownloadList) profileDownloadList.textContent = "Preparing profile links…";
  }

  function applyCaseDownloadMessage(payload) {
    if (!matchesCaseDownloadMessage(payload, bootstrap.caseId, state.activeChainId)) return;
    if (payload?.kind === "alignment-mmcif" && payload.href && alignmentDownloadLink) {
      alignmentDownloadLink.href = payload.href;
      alignmentDownloadLink.download = payload.filename || "foldbridge-alignment.cif";
      alignmentDownloadLink.removeAttribute("aria-disabled");
      return;
    }
    if (payload?.kind !== "profiles" || !Array.isArray(payload.items) || !profileDownloadList) return;
    profileDownloadList.replaceChildren();
    payload.items.forEach((item) => {
      if (!item?.href) return;
      const link = document.createElement("a");
      link.className = "fb-profile-download-link";
      link.href = item.href;
      link.download = item.filename || "";
      link.textContent = item.label || item.filename || "Profile file";
      profileDownloadList.appendChild(link);
    });
    profileDownloadMenu?.querySelector("summary")?.removeAttribute("aria-disabled");
  }

  function setWorkbenchFrameHeight(height) {
    const nextHeight = Number(height);
    if (!frame || !Number.isFinite(nextHeight) || nextHeight <= 0) return;
    frame.style.height = `${Math.ceil(nextHeight)}px`;
    reportEmbeddedCaseHeightSoon();
  }

  if (typeof window !== "undefined") {
    window.addEventListener("message", (event) => {
      if (event.source !== frame?.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "foldbridge-case-download-ready") {
        applyCaseDownloadMessage(event.data);
        return;
      }
      if (event.data?.type === "foldbridge-workbench-height") {
        setWorkbenchFrameHeight(event.data.height);
      } else if (event.data?.type === WORKBENCH_PROGRESS_MESSAGE) {
        setCaseProgress(event.data);
      }
    });
  }

  frame?.addEventListener("load", () => {
    setCaseProgress({ progress: 30, label: "Loading Case data…" });
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
    resetCaseDownloadActions();
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

  let deferredEvidenceStarted = false;
  async function loadDeferredEvidence() {
    if (!bootstrap.evidenceUrl || bootstrap.evidenceRows.length || deferredEvidenceStarted) return;
    deferredEvidenceStarted = true;
    const evidenceUrl = new URL(bootstrap.evidenceUrl, window.location.href);
    const response = await fetch(evidenceUrl);
    if (!response.ok) throw new Error(`Deferred case evidence HTTP ${response.status}`);
    mergeDeferredEvidence(bootstrap, await response.json());

    const selected = evidenceById(state.selectedEvidenceId);
    const selectedChainId = selected ? bootstrap.evidenceChainMap[selected.evidenceId] : "";
    if (selectedChainId !== state.activeChainId) {
      const fallback = defaultEvidenceForChain(state.activeChainId);
      state.selectedEvidenceId = fallback?.evidenceId || "";
    }
    renderEnrichment(bootstrap);
    refreshEvidenceHighlight(state.selectedEvidenceId);
    reportEmbeddedCaseHeightSoon();
  }

  function loadDeferredEvidenceWhenReady() {
    const status = frame?.contentDocument?.querySelector("#assetStatus");
    if (!status) throw new Error("Active chain asset status is unavailable");
    let observer = null;
    const startWhenLinked = () => {
      if (status.textContent?.trim() === "EF assets linked") {
        observer?.disconnect();
        loadDeferredEvidence().catch((error) => console.error("Deferred case evidence failed", error));
        return true;
      }
      return false;
    };
    if (startWhenLinked()) return;
    observer = new MutationObserver(startWhenLinked);
    observer.observe(status, { childList: true, characterData: true, subtree: true });
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
    if (chainStatus) chainStatus.textContent = state.activeChainId;
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
  if (bootstrap.evidenceUrl && frame) {
    frame.addEventListener("load", () => {
      loadDeferredEvidenceWhenReady();
    }, { once: true });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    familyCounts, tierCounts, distinctChains, familyLabel, tierDisplay,
    fmtMetric, fmtP, fmtFraction, fmtCount, pickBestEvidence,
    measureEmbeddedCaseHeight, postEmbeddedCaseHeight,
    initialChainId,
    mergeDeferredEvidence,
    matchesCaseDownloadMessage,
  };
}
