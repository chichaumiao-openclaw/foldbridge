function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatPct(value) {
  return `${Number(value).toFixed(Number.isInteger(value) ? 0 : 1)}%`;
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
      const height = Math.max(6, Math.round(Math.min(Math.max(Number(point.value) || 0, 0), 1) * 100));
      return `<span class="pdb-case-track-bar" style="height:${height}%" title="pdb_pos ${escapeHtml(point.pdbPos)}: ${escapeHtml(point.value)}"></span>`;
    })
    .join('');

  return `<div class="pdb-case-track" aria-label="Downsampled sequence-axis reactivity preview">${bars}</div>`;
}

export function renderPdbCaseIndexPage(rows = []) {
  const body = rows
    .map(
      (row) => `<tr>
        <td><a class="sequence-link" href="${escapeHtml(row.detailHref)}">${escapeHtml(row.pdbId)}</a></td>
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(row.pdbReferenceCount)}</td>
        <td>${escapeHtml(row.rmdbUniqueSequenceCount)}</td>
        <td>${escapeHtml(row.profileCount)}</td>
        <td>${escapeHtml(row.projectionStatus)}</td>
        <td>${escapeHtml(row.baseMismatchRows)}</td>
      </tr>`
    )
    .join('');

  return `<main class="page-pdb-case page-download-sequences">
    <section class="card bundle-wide-card pdb-case-hero">
      <p class="technology-kicker">PDB case index</p>
      <h1>PDB case index</h1>
      <p class="pdb-case-lede">One PDB case can contain multiple PDB references, RMDB unique sequences, and probing profiles. This page keeps that case grain visible instead of flattening each PDB into a single molecule.</p>
      <p class="pdb-case-lede">Current build uses a small local demo case index; the full support-root importer is intentionally not wired into the browser path.</p>
      <div class="pdb-case-status-grid">
        ${renderMetric('Cases in current site build', rows.length)}
        ${renderMetric('Page grain', 'PDB case')}
        ${renderMetric('Track loading', 'summary only', 'full per-base tracks stay out of the browser')}
      </div>
    </section>

    <section class="card bundle-wide-card pdb-case-table-card">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">lightweight index</p>
          <h2>Case summaries</h2>
        </div>
        <p>Open a case page to inspect projection quality, profile-level summaries, and sequence-axis previews.</p>
      </div>
      <div class="download-table-wrap">
        <table class="structure-table download-table">
          <thead>
            <tr>
              <th>PDB</th>
              <th>Case title</th>
              <th>PDB refs</th>
              <th>RMDB sequences</th>
              <th>Profiles</th>
              <th>Projection</th>
              <th>Mismatch rows</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  </main>`;
}

export function renderPdbCasePage(detail, params = {}) {
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

  const selectedProfileId = params.bundleProfileId || detail.profileSummaries?.[0]?.bundleProfileId || '';
  const profileRows = (detail.profileSummaries || [])
    .map((profile) => {
      const selected = profile.bundleProfileId === selectedProfileId;
      return `<tr class="${selected ? 'selected-profile' : ''}">
        <td>${escapeHtml(profile.bundleProfileId)}</td>
        <td>${escapeHtml(profile.rmdbUniqueId)}</td>
        <td>${escapeHtml(profile.bundleSequenceId)}</td>
        <td>${escapeHtml(profile.modifier)}</td>
        <td>${escapeHtml(profile.rowCount)}</td>
        <td>${escapeHtml(profile.baseMismatchRows)}</td>
      </tr>`;
    })
    .join('');

  return `<main class="page-pdb-case">
    <section class="card bundle-wide-card pdb-case-hero">
      <a class="technology-back-link" href="#pdb-case">Back to PDB case index</a>
      <p class="technology-kicker">PDB case page</p>
      <div class="pdb-case-title-row">
        <div>
          <h1>${escapeHtml(detail.pdbId)} ${escapeHtml(detail.title)}</h1>
          <p class="pdb-case-lede">${escapeHtml(detail.description)}</p>
          <p class="pdb-case-lede">This is a lightweight site preview, not the full 722-case support-root import.</p>
        </div>
        <a class="sequence-detail-reference-link" href="https://www.rcsb.org/structure/${encodeURIComponent(detail.pdbId)}" target="_blank" rel="noopener noreferrer">Open RCSB</a>
      </div>
      <div class="pdb-case-status-grid">
        ${renderMetric('PDB references', detail.pdbReferenceCount)}
        ${renderMetric('RMDB unique sequences', detail.rmdbUniqueSequenceCount)}
        ${renderMetric('Profiles', detail.profileCount)}
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

    <section class="card bundle-wide-card pdb-case-profile-section">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">profile-level detail</p>
          <h2>Probing profiles</h2>
        </div>
        <p>Profiles stay separate; this page does not hide multiple RMDB sources behind one aggregate value.</p>
      </div>
      <div class="download-table-wrap">
        <table class="structure-table download-table">
          <thead>
            <tr>
              <th>bundle_profile_id</th>
              <th>rmdb_unique_id</th>
              <th>bundle_sequence_id</th>
              <th>Modifier</th>
              <th>Rows</th>
              <th>Mismatch rows</th>
            </tr>
          </thead>
          <tbody>${profileRows}</tbody>
        </table>
      </div>
    </section>

    <section class="card bundle-wide-card pdb-case-track-section">
      <div class="technology-section-heading">
        <div>
          <p class="technology-kicker">sequence-axis preview</p>
          <h2>Downsampled reactivity track</h2>
        </div>
        <p>The full per-base TSV is a build input. The browser receives only bounded summaries or future windowed slices.</p>
      </div>
      ${renderTrackPreview(detail.reactivityTrackPreview)}
    </section>
  </main>`;
}
