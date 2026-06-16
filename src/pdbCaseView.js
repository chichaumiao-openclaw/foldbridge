function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const rounded = Math.round(Number(value) * 1000) / 1000;
  return `${rounded}%`;
}

function renderMetric(label, value, note = '') {
  return `<article class="pdb-case-metric">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
    ${note ? `<small>${escapeHtml(note)}</small>` : ''}
  </article>`;
}

function renderTrackPreview(points = []) {
  if (!points.length) {
    return `<div class="pdb-case-track-empty">No browser-sized track preview is available for this case yet.</div>`;
  }

  const bars = points
    .map((point) => {
      const raw = point.reactivity;
      if (raw == null || !Number.isFinite(Number(raw))) {
        return `<span class="pdb-case-track-bar pdb-case-track-bar--na" style="height:6%" title="pdb_pos ${escapeHtml(point.pdbPos)}: no value"></span>`;
      }
      const height = Math.max(6, Math.round(Math.min(Math.max(Number(raw), 0), 1) * 100));
      return `<span class="pdb-case-track-bar" style="height:${height}%" title="pdb_pos ${escapeHtml(point.pdbPos)}: ${escapeHtml(raw)}"></span>`;
    })
    .join('');

  return `<div class="pdb-case-track" aria-label="Downsampled sequence-axis reactivity preview">${bars}</div>`;
}

const CONFIDENCE_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

function renderConfidenceBadge(confidenceClass) {
  const cls = CONFIDENCE_LABELS[confidenceClass] ? confidenceClass : 'low';
  return `<span class="pdb-case-badge pdb-case-badge--${cls}">${escapeHtml(CONFIDENCE_LABELS[cls])}</span>`;
}

function formatScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(3);
}

export function renderPdbCaseIndexPage(rows = []) {
  const counts = { all: rows.length, high: 0, medium: 0, low: 0 };
  rows.forEach((row) => { if (counts[row.confidenceClass] != null) counts[row.confidenceClass] += 1; });

  const filterButtons = ['all', 'high', 'medium', 'low']
    .map((key) => {
      const label = key === 'all' ? 'All' : CONFIDENCE_LABELS[key];
      return `<button type="button" class="pdb-case-filter-btn${key === 'all' ? ' is-active' : ''}" data-confidence-filter="${key}">${escapeHtml(label)} <span class="pdb-case-filter-count">${counts[key]}</span></button>`;
    })
    .join('');

  const body = rows
    .map(
      (row) => `<tr data-confidence-class="${escapeHtml(row.confidenceClass)}">
        <td><a class="sequence-link" href="${escapeHtml(row.detailHref)}">${escapeHtml(row.pdbId)}</a></td>
        <td>${escapeHtml(row.title)}</td>
        <td>${renderConfidenceBadge(row.confidenceClass)}</td>
        <td>${escapeHtml(formatScore(row.confidenceScore))}</td>
        <td>${escapeHtml(row.profileCount)}</td>
        <td>${escapeHtml(row.residueCount)}</td>
      </tr>`
    )
    .join('');

  return `<main class="page-pdb-case page-download-sequences">
    <section class="card bundle-wide-card pdb-case-hero">
      <p class="technology-kicker">PDB case index</p>
      <h1>PDB case index</h1>
      <p class="pdb-case-lede">One PDB case can contain multiple PDB references, RMDB unique sequences, and probing profiles. This page keeps that case grain visible instead of flattening each PDB into a single molecule.</p>
      <p class="pdb-case-lede">Cases are filtered from the RMDB→PDB master table to high, medium, and low displayable confidence. Each case page lazy-loads its own lightweight assets.</p>
      <div class="pdb-case-status-grid">
        ${renderMetric('Cases in current site build', rows.length)}
        ${renderMetric('Page grain', 'PDB case')}
        ${renderMetric('Confidence tiers', 'high / medium / low')}
      </div>
    </section>

    <section class="card bundle-wide-card pdb-case-table-card">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">lightweight index</p>
          <h2>Case summaries</h2>
        </div>
        <p>Open a case page to inspect projection quality, profile-level summaries, sequence-axis previews, and base-level alignment.</p>
      </div>
      <div class="pdb-case-filter-bar" role="group" aria-label="Filter cases by confidence class">
        ${filterButtons}
      </div>
      <div class="download-table-wrap">
        <table class="structure-table download-table">
          <thead>
            <tr>
              <th>PDB</th>
              <th>Case title</th>
              <th>Confidence</th>
              <th>Score</th>
              <th>Profiles</th>
              <th>Residues</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  </main>`;
}

function renderAlignmentSection(detail, alignmentPage) {
  if (detail.alignmentPageCount === 0) {
    return `<section class="card bundle-wide-card pdb-case-alignment-section">
      <div class="technology-section-heading">
        <div><p class="technology-kicker">base-level alignment</p><h2>Gapped alignment columns</h2></div>
        <p>No alignment columns are available for this case.</p>
      </div>
    </section>`;
  }
  if (!alignmentPage) {
    return `<section class="card bundle-wide-card pdb-case-alignment-section" data-alignment-page="1">
      <div class="technology-section-heading">
        <div><p class="technology-kicker">base-level alignment</p><h2>Gapped alignment columns</h2></div>
        <p>Loading alignment page…</p>
      </div>
      <div class="pdb-case-track-empty">Loading…</div>
    </section>`;
  }
  const rows = (alignmentPage.rows || [])
    .map((r) => `<tr>
      <td>${escapeHtml(r.alignment_column)}</td>
      <td>${escapeHtml(r.rmdb_query_pos)}</td>
      <td>${escapeHtml(r.pdb_pos)}</td>
      <td>${escapeHtml(r.rmdb_base)}</td>
      <td>${escapeHtml(r.pdb_base)}</td>
      <td>${escapeHtml(r.match_state)}</td>
    </tr>`)
    .join('');
  const page = alignmentPage.page || 1;
  const total = detail.alignmentPageCount;
  const prevDisabled = page <= 1 ? 'disabled' : '';
  const nextDisabled = page >= total ? 'disabled' : '';
  return `<section class="card bundle-wide-card pdb-case-alignment-section" data-alignment-page="${escapeHtml(page)}">
    <div class="technology-section-heading">
      <div><p class="technology-kicker">base-level alignment</p><h2>Gapped alignment columns</h2></div>
      <p>Each row is one gapped alignment column between the RMDB query and the PDB reference sequence. Loaded 25 rows per page.</p>
    </div>
    <div class="download-table-wrap">
      <table class="structure-table download-table">
        <caption>Base-level gapped alignment columns for ${escapeHtml(detail.pdbId)}, page ${escapeHtml(page)} of ${escapeHtml(total)}.</caption>
        <thead>
          <tr>
            <th>Alignment column</th>
            <th>RMDB query pos</th>
            <th>PDB pos</th>
            <th>RMDB base</th>
            <th>PDB base</th>
            <th>Match state</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="pdb-case-pager">
      <button type="button" class="pdb-case-pager-btn" data-alignment-nav="prev" ${prevDisabled}>Previous</button>
      <span class="pdb-case-pager-status">Page ${escapeHtml(page)} / ${escapeHtml(total)}</span>
      <button type="button" class="pdb-case-pager-btn" data-alignment-nav="next" ${nextDisabled}>Next</button>
    </div>
  </section>`;
}

function renderProfilesSection(profiles) {
  if (!profiles) {
    return `<section class="card bundle-wide-card pdb-case-profile-section">
      <div class="technology-section-heading">
        <div><p class="technology-kicker">profile-level detail</p><h2>Probing profiles</h2></div>
        <p>Loading profiles…</p>
      </div>
    </section>`;
  }
  const rows = profiles
    .map((p) => `<tr>
      <td>${escapeHtml(p.rdatFile)}</td>
      <td>${escapeHtml(p.rmdbUniqueId)}</td>
      <td>${escapeHtml(p.sequenceLength)}</td>
      <td>${escapeHtml(formatPct(Number.isFinite(Number(p.identityFraction)) ? Number(p.identityFraction) * 100 : null))}</td>
      <td><code class="pdb-case-profile-key">${escapeHtml(p.profileKey)}</code></td>
    </tr>`)
    .join('');
  return `<section class="card bundle-wide-card pdb-case-profile-section">
    <div class="technology-section-heading">
      <div><p class="technology-kicker">profile-level detail</p><h2>Probing profiles &amp; provenance</h2></div>
      <p>Profiles stay separate; this page does not hide multiple RMDB probing sources behind one aggregate value. The probe type is carried by the RDAT file name.</p>
    </div>
    <div class="download-table-wrap">
      <table class="structure-table download-table">
        <caption>RMDB probing profiles joined to provenance for this case.</caption>
        <thead>
          <tr>
            <th>RDAT file</th>
            <th>rmdb_unique_id</th>
            <th>Seq length</th>
            <th>Identity</th>
            <th>profile_key</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </section>`;
}

export function renderPdbCasePage(detail, params = {}, assets = {}) {
  if (!detail) {
    return `<main class="page-pdb-case">
      <section class="card bundle-wide-card pdb-case-hero">
        <p class="technology-kicker">PDB case page</p>
        <h1>PDB case not found</h1>
        <p class="pdb-case-lede">No lightweight case summary is available for ${escapeHtml(params.pdbId || 'this PDB ID')} in the current site build.</p>
        <a class="sequence-link" href="#pdb-case">Back to PDB case index</a>
      </section>
    </main>`;
  }

  const { profiles, alignmentPage, reactivitySummary } = assets;
  const reactivityEntries = detail.reactivity || [];

  return `<main class="page-pdb-case">
    <section class="card bundle-wide-card pdb-case-hero">
      <a class="technology-back-link" href="#pdb-case">Back to PDB case index</a>
      <p class="technology-kicker">PDB case page</p>
      <div class="pdb-case-title-row">
        <div>
          <h1>${escapeHtml(detail.pdbId)} ${escapeHtml(detail.title)} ${renderConfidenceBadge(detail.confidenceClass)}</h1>
          ${detail.subtitle ? `<p class="pdb-case-lede">${escapeHtml(detail.subtitle)}</p>` : ''}
          <p class="pdb-case-lede">Lazy-loaded from the generated RMDB→PDB case assets. Confidence score ${escapeHtml(formatScore(detail.confidenceScore))}.</p>
        </div>
        <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/${encodeURIComponent(detail.pdbId)}" target="_blank" rel="noopener noreferrer">Open RCSB</a>
      </div>
      <div class="pdb-case-status-grid">
        ${renderMetric('PDB references', detail.pdbReferenceIdCount)}
        ${renderMetric('RMDB unique sequences', detail.rmdbUniqueSequenceCount)}
        ${renderMetric('Profiles', detail.rmdbProfileCount)}
        ${renderMetric('Projection status', detail.projectionStatus)}
      </div>
    </section>

    <section class="card bundle-wide-card pdb-case-warning">
      <div>
        <p class="technology-kicker">projection semantics</p>
        <h2>Sequence-axis evidence, not observed residue coloring</h2>
      </div>
      <ul>
        <li>projection_status=pass only means the projection workflow completed.</li>
        <li>pdb_pos is a PDB reference sequence position, not an observed residue coordinate.</li>
        <li>Mismatch rows, identity, query coverage, and subject coverage remain visible quality fields.</li>
        <li>3D residue coloring is disabled until a residue selector map is generated for this case.</li>
      </ul>
    </section>

    <section class="card bundle-wide-card pdb-case-quality">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">quality fields</p>
          <h2>Projection quality</h2>
        </div>
        <p>These fields avoid presenting a passing projection as clean structural evidence.</p>
      </div>
      <div class="pdb-case-status-grid">
        ${renderMetric('Base mismatch rows', detail.baseMismatchRows)}
        ${renderMetric('Identity', formatPct(detail.identityPct))}
        ${renderMetric('Query coverage', formatPct(detail.queryCoveragePct))}
        ${renderMetric('Subject coverage', formatPct(detail.subjectCoveragePct))}
        ${renderMetric('Axis', 'PDB reference sequence')}
        ${renderMetric('Residue map', detail.residueMappingStatus)}
      </div>
    </section>

    ${renderProfilesSection(profiles)}

    <section class="card bundle-wide-card pdb-case-track-section">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">sequence-axis preview</p>
          <h2>Downsampled reactivity track</h2>
        </div>
        <p>The full per-base TSV is a build input. The browser receives only a bounded, downsampled summary per probing profile.</p>
      </div>
      ${reactivityEntries.length > 1 ? `<p class="pdb-case-track-note">${escapeHtml(reactivityEntries.length)} probing profiles available; showing ${escapeHtml(reactivitySummary?.profileKey || reactivityEntries[0].profileKey)}.</p>` : ''}
      ${renderTrackPreview(reactivitySummary?.trackPreview)}
    </section>

    ${renderAlignmentSection(detail, alignmentPage)}
  </main>`;
}
