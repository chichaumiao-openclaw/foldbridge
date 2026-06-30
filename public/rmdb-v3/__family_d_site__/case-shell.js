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
