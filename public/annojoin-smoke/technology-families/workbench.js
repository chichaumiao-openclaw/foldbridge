const DATA_URL = "assets/technology-family-index.json";

const AXIS_LABELS = Object.freeze({
  rmdb_profile_query_to_pdb_subject: "RMDB profile query -&gt; PDB subject",
  rasp_feature_query_to_pdb_subject: "RASP feature query -&gt; PDB subject",
  sequence_alignment_and_atom_site_coordinates_only: "Sequence alignment plus atom_site coordinates only"
});

const STATUS_CLASSES = Object.freeze({
  smoke_ready: "status-ready",
  current_atlas_case: "status-current",
  smoke_candidate: "status-candidate",
  not_materialized_in_current_atlas: "status-missing"
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function familyHref(family) {
  return family.pageHref || `family-${String(family.id).toLowerCase()}.html`;
}

function renderPills(items) {
  return (items || [])
    .map((item) => `<span class="pill">${escapeHtml(item)}</span>`)
    .join("");
}

function renderRegistrySummary(asset) {
  const target = document.getElementById("registry-summary");
  if (!target) return;

  const counts = asset.registrySummary?.familyCounts || {};
  target.innerHTML = [
    ["Technologies", asset.registrySummary?.technologyCount ?? "n/a"],
    ["Families", Object.keys(counts).length || "n/a"],
    ["Unknown family", asset.registrySummary?.unknownFamilyCount ?? "n/a"],
    ["Structure coverage", AXIS_LABELS[asset.axisPolicy?.structureCoverageAxis] || "not materialized"]
  ].map(([label, value]) => (
    `<article class="metric"><span class="muted">${escapeHtml(label)}</span><span class="value">${value}</span></article>`
  )).join("");
}

function renderFamilyList(asset) {
  const target = document.getElementById("family-list");
  if (!target) return;

  target.innerHTML = asset.families.map((family) => {
    const technologies = family.technologies || [];
    const counts = `${technologies.length} technologies`;
    const examples = technologies.slice(0, 5);
    return `
      <a class="family-card" href="${escapeHtml(familyHref(family))}">
        <p class="eyebrow">Family ${escapeHtml(family.id)}</p>
        <h2>${escapeHtml(family.shortLabel)}</h2>
        <p class="muted">${escapeHtml(family.description)}</p>
        <div class="pill-row">${renderPills(examples)}</div>
        <div class="meta">
          <p><strong>${escapeHtml(counts)}</strong></p>
          <p class="muted">Visual channel: ${escapeHtml(family.visualChannel)}</p>
        </div>
      </a>
    `;
  }).join("");
}

function statusClass(status) {
  return STATUS_CLASSES[status] || "status-missing";
}

function renderCase(caseItem) {
  const href = caseItem.href
    ? `<a href="${escapeHtml(caseItem.href)}">${escapeHtml(caseItem.caseKey)}</a>`
    : escapeHtml(caseItem.caseKey);
  const axis = AXIS_LABELS[caseItem.coverageAxis] || escapeHtml(caseItem.coverageAxis || "not materialized");
  return `
    <article class="case-item">
      <strong>${href}</strong>
      <dl class="key-values">
        <dt>Source</dt><dd>${escapeHtml(caseItem.sourceFamily)}</dd>
        <dt>Technology</dt><dd>${escapeHtml(caseItem.technology)}</dd>
        <dt>Coverage axis</dt><dd>${axis}</dd>
        <dt>Status</dt><dd><span class="status ${statusClass(caseItem.status)}">${escapeHtml(caseItem.status)}</span></dd>
      </dl>
    </article>
  `;
}

function renderFamilyPage(asset, familyId) {
  const target = document.getElementById("family-detail");
  if (!target) return;

  const family = asset.families.find((item) => item.id === familyId);
  if (!family) {
    target.innerHTML = `<div class="notice">Unknown technology family: ${escapeHtml(familyId)}</div>`;
    return;
  }

  const axisNote = "RMDB profile query -&gt; PDB subject is not interchangeable with RASP feature query -&gt; PDB subject.";
  const channelNote = family.visualChannel === "residue_reactivity"
    ? "This family can use per-residue reactivity as its primary signal layer."
    : `This family is not residue reactivity; render it as ${escapeHtml(family.visualChannel)}.`;

  target.innerHTML = `
    <div class="detail-grid">
      <div>
        <p class="eyebrow">Family ${escapeHtml(family.id)}</p>
        <h1>${escapeHtml(family.title)}</h1>
        <p class="lead">${escapeHtml(family.description)}</p>
        <div class="pill-row">${renderPills(family.technologies || [])}</div>
        <section class="panel">
          <h2>Semantic contract</h2>
          <dl class="key-values">
            <dt>Signal direction</dt><dd>${escapeHtml(family.signalDirection)}</dd>
            <dt>Reference</dt><dd>${escapeHtml(family.referenceQuantity)}</dd>
            <dt>Recall metric</dt><dd>${escapeHtml(family.recallMetric)}</dd>
            <dt>Conflict metric</dt><dd>${escapeHtml(family.conflictMetric)}</dd>
            <dt>Visual channel</dt><dd>${escapeHtml(family.visualChannel)}</dd>
          </dl>
        </section>
        <section class="panel">
          <h2>Representative cases</h2>
          <div class="case-list">${family.representativeCases.map(renderCase).join("")}</div>
        </section>
      </div>
      <aside>
        <div class="axis-note">
          <strong>Coverage axis</strong>
          <p>${axisNote}</p>
        </div>
        <section class="panel">
          <h2>Display rule</h2>
          <p>${channelNote}</p>
          <p class="muted">${escapeHtml(family.displayPolicy?.coverageWarning || "")}</p>
        </section>
      </aside>
    </div>
  `;
}

async function loadAsset() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to load ${DATA_URL}: ${response.status}`);
  }
  return response.json();
}

async function main() {
  const asset = await loadAsset();
  const familyId = document.body.dataset.familyId;
  renderRegistrySummary(asset);

  if (familyId && familyId !== "all") {
    renderFamilyPage(asset, familyId);
  } else {
    renderFamilyList(asset);
  }
}

main().catch((error) => {
  const target = document.getElementById("family-list") || document.getElementById("family-detail") || document.body;
  target.innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
});
