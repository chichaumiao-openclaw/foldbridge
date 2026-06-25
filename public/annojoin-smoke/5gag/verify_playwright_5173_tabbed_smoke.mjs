import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const proc = spawn("docker", ["run", "-i", "--rm", "mcp/playwright:latest"], {
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const responses = new Map();
const stderr = [];

proc.stdout.setEncoding("utf8");
proc.stdout.on("data", (chunk) => {
  buffer += chunk;
  let idx = buffer.indexOf("\n");
  while (idx >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    idx = buffer.indexOf("\n");
    if (!line.startsWith("{")) continue;
    const message = JSON.parse(line);
    if (message.id !== undefined) responses.set(message.id, message);
  }
});
proc.stderr.setEncoding("utf8");
proc.stderr.on("data", (chunk) => stderr.push(chunk));

function send(message) {
  proc.stdin.write(`${JSON.stringify(message)}\n`);
}

async function waitFor(id, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (responses.has(id)) return responses.get(id);
    await delay(50);
  }
  throw new Error(`timeout waiting for MCP response ${id}; stderr=${stderr.join("")}`);
}

function textContent(response) {
  return response.result?.content?.map((item) => item.text || "").join("\n") || "";
}

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "codex-tabbed-preview", version: "0.1.0" },
  },
});
await waitFor(1);
send({ jsonrpc: "2.0", method: "notifications/initialized" });

const code = `async (page) => {
  const sourceCifRequests = [];
  const sampleSourceCif = [
    'data_5GAG',
    '#',
    'loop_',
    '_atom_site.group_PDB',
    '_atom_site.id',
    '_atom_site.type_symbol',
    '_atom_site.label_atom_id',
    '_atom_site.label_comp_id',
    '_atom_site.label_asym_id',
    '_atom_site.label_seq_id',
    '_atom_site.Cartn_x',
    '_atom_site.Cartn_y',
    '_atom_site.Cartn_z',
    '_atom_site.auth_seq_id',
    '_atom_site.auth_comp_id',
    '_atom_site.auth_asym_id',
    '_atom_site.pdbx_PDB_model_num',
    'ATOM 1 P P G A 52 1.0 2.0 3.0 52 G 1 1',
    'ATOM 2 C C1 G A 52 1.4 2.5 3.6 52 G 1 1',
    'ATOM 3 P P A B 52 10.0 20.0 30.0 52 A 2 1',
    'ATOM 4 P P G A 140 11.0 21.0 31.0 140 G 1 1',
    '#',
  ].join('\\n');
  await page.route('https://files.rcsb.org/download/5GAG.cif', async (route) => {
    sourceCifRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'chemical/x-mmcif',
      body: sampleSourceCif,
    });
  });

  async function inspectViewport(label, width, height) {
    await page.setViewportSize({ width, height });
    await page.goto('http://host.docker.internal:5173/annojoin-smoke/5gag/index.html');
    await page.waitForSelector('#track-viewport svg [data-track-kind="bridge_membership"]');
    return await page.evaluate((label) => {
      const html = document.documentElement;
      const viewport = document.querySelector('#varnaViewport');
      const svg = document.querySelector('#varnaViewer svg');
      const profileId = document.querySelector('#profileId');
      const viewportBox = viewport.getBoundingClientRect();
      const svgBox = svg.getBoundingClientRect();
      const profileBox = profileId.getBoundingClientRect();
      return {
        label,
        innerWidth: window.innerWidth,
        documentScrollWidth: html.scrollWidth,
        varnaViewportWidth: Math.round(viewportBox.width),
        varnaSvgWidth: Math.round(svgBox.width),
        varnaSvgHeight: Math.round(svgBox.height),
        varnaHorizontalOverflow: svgBox.right - viewportBox.right,
        profileClientWidth: Math.round(profileBox.width),
        profileScrollWidth: profileId.scrollWidth,
        profileOverflowsBox: profileId.scrollWidth > profileId.clientWidth,
        bodyHorizontalOverflow: html.scrollWidth - window.innerWidth
      };
    }, label);
  }

  const desktopFit = await inspectViewport('desktop', 1280, 800);
  const mobileFit = await inspectViewport('mobile', 390, 844);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://host.docker.internal:5173/annojoin-smoke/5gag/index.html');
  await page.waitForSelector('#track-viewport svg [data-track-kind="bridge_membership"]');
  await page.waitForFunction(() => (
    document.querySelector('#molstar-host')?.dataset.structureSource === 'client-alignment-crop'
    && document.querySelector('#molstar-full-host')?.dataset.structureSource === 'source-structure'
  ));
  const before = await page.evaluate(() => {
    const log = JSON.parse(document.querySelector('#log').textContent || '{}');
    const host = document.querySelector('#molstar-host');
    const fullHost = document.querySelector('#molstar-full-host');
    const fills = [...document.querySelectorAll('#varnaViewer svg circle[data-position]:not([data-layer="varna-hit-layer"])')].map((circle) => circle.getAttribute('fill'));
    const trackKinds = [...new Set([...document.querySelectorAll('#track-viewport [data-track-kind]')].map((node) => node.getAttribute('data-track-kind')))].sort();
    const pdb52 = document.querySelector('#track-viewport [data-track-kind="pdb_residue"][data-residue-key$="|52"]');
    const pdb1 = document.querySelector('#track-viewport [data-track-kind="pdb_residue"][data-residue-key$="|1"]');
    const profileSeq52 = document.querySelector('#track-viewport [data-track-kind="profile_sequence"][data-residue-key$="|52"]');
    const pdbAlignment52 = document.querySelector('#track-viewport [data-track-kind="pdb_polymer_alignment"][data-residue-key$="|52"]');
    const pdbAlignment52Text = document.querySelector('#track-viewport [data-alignment-text-for$="|52"]');
    const structureState52 = document.querySelector('#track-viewport [data-track-kind="structure_state"][data-residue-key$="|52"]');
    const target52 = document.querySelector('#track-viewport [data-track-kind="dms_targetability"][data-residue-key$="|52"]');
    const target1 = document.querySelector('#track-viewport [data-track-kind="dms_targetability"][data-residue-key$="|1"]');
    const varna52 = document.querySelector('#varnaViewer svg circle[data-position="52"]:not([data-layer="varna-hit-layer"])');
    return {
      workbench: !!document.querySelector('.workbench-shell'),
      active: document.querySelector('.tab.active')?.textContent.trim(),
      varnaHidden: document.querySelector('#varnaViewer').hidden,
      linearHidden: document.querySelector('#linearViewer').hidden,
      trackRailPresent: !!document.querySelector('#track-viewport svg'),
      trackKinds,
      trackStatusText: document.querySelector('#trackStatus')?.textContent || '',
      statsText: document.querySelector('#stats')?.textContent || '',
      molstarHostPresent: !!document.querySelector('#molstar-host'),
      molstarFullHostPresent: !!document.querySelector('#molstar-full-host'),
      molstarStructureSource: host?.dataset.structureSource || '',
      molstarStructureSourceKind: host?.dataset.structureSourceKind || '',
      molstarStructureSourceUrl: host?.dataset.structureSourceUrl || '',
      molstarStructureAuthAsymId: host?.dataset.structureAuthAsymId || '',
      molstarStructureLabelAsymId: host?.dataset.structureLabelAsymId || '',
      molstarStructureAtomRows: host?.dataset.structureAtomRows || '',
      molstarAlignmentCropRange: host?.dataset.alignmentCropRange || '',
      molstarAlignmentCropSource: host?.dataset.alignmentCropSource || '',
      molstarCroppedAtomSiteRows: host?.dataset.croppedAtomSiteRows || '',
      molstarDroppedAtomSiteRows: host?.dataset.droppedAtomSiteRows || '',
      molstarTargetDisplayMode: host?.dataset.targetDisplayMode || '',
      molstarTargetDisplayResidues: host?.dataset.targetDisplayResidues || '',
      molstarTargetDisplayColorSource: host?.dataset.targetDisplayColorSource || '',
      molstarTargetDisplayContext: host?.dataset.targetDisplayContext || '',
      molstarTargetDisplayPreview52: host?.dataset.targetDisplayPreview52 || '',
      molstarFullStructureSource: fullHost?.dataset.structureSource || '',
      molstarFullStructureSourceKind: fullHost?.dataset.structureSourceKind || '',
      molstarFullStructureSourceUrl: fullHost?.dataset.structureSourceUrl || '',
      molstarMetaText: document.querySelector('#molstarMeta')?.textContent || '',
      molstarFullMetaText: document.querySelector('#molstarFullMeta')?.textContent || '',
      profile52Base: profileSeq52?.getAttribute('data-profile-base') || '',
      pdb52Base: pdbAlignment52?.getAttribute('data-pdb-base') || '',
      pdb52AlignmentText: pdbAlignment52Text?.textContent || '',
      pdb52AlignmentState: pdbAlignment52?.getAttribute('data-alignment-state') || '',
      structure52State: structureState52?.getAttribute('data-structure-state') || '',
      structure52ColorSource: structureState52?.getAttribute('data-state-color-source') || '',
      varna52ReactivityFill: varna52?.getAttribute('data-reactivity-fill') || '',
      varna52StructureState: varna52?.getAttribute('data-structure-state') || '',
      varna52ColorSource: varna52?.getAttribute('data-state-color-source') || '',
      target52State: target52?.getAttribute('data-assay-state') || '',
      target1State: target1?.getAttribute('data-assay-state') || '',
      pdb52Status: pdb52?.getAttribute('data-coordinate-status') || '',
      pdb1Status: pdb1?.getAttribute('data-coordinate-status') || '',
      pdb52Meaning: pdb52?.getAttribute('data-coordinate-meaning') || '',
      pdb1Meaning: pdb1?.getAttribute('data-coordinate-meaning') || '',
      pdb52Fill: pdb52?.getAttribute('fill') || '',
      pdb1Fill: pdb1?.getAttribute('fill') || '',
      pdb52Stroke: pdb52?.getAttribute('stroke') || '',
      pdb1Stroke: pdb1?.getAttribute('stroke') || '',
      inspectorPresent: !!document.querySelector('#linked-inspector'),
      profileOptions: document.querySelectorAll('#profileSelect option').length,
      shardDecodeMode: log.shard_decode_mode,
      renderButtonPresent: !!document.querySelector('#renderButton'),
      benchmarkText: document.querySelector('#benchmarkButton')?.textContent.trim(),
      varnaView: document.querySelector('#varnaViewer svg')?.getAttribute('data-view'),
      whiteCount: fills.filter((fill) => fill === 'rgb(100%, 100%, 100%)').length,
      coloredCount: fills.filter((fill) => fill && fill !== 'rgb(100%, 100%, 100%)').length
    };
  });
  const linked = await page.evaluate(() => {
    const bridge = document.querySelector('#track-viewport [data-track-kind="bridge_membership"]');
    const bridge52 = document.querySelector('#track-viewport [data-track-kind="bridge_membership"][data-residue-key$="|52"]');
    const observed = document.querySelector('#track-viewport [data-track-kind="observed_mask"]');
    const interaction = document.querySelector('#track-viewport [data-track-kind="interaction_endpoint_occupancy"]');
    const profileSeq52 = document.querySelector('#track-viewport [data-track-kind="profile_sequence"][data-residue-key$="|52"]');
    const pdbAlignment52 = document.querySelector('#track-viewport [data-track-kind="pdb_polymer_alignment"][data-residue-key$="|52"]');
    const varna52 = document.querySelector('#varnaViewport [data-layer="varna-hit-layer"][data-position="52"]');
    if (!bridge || !bridge52 || !observed || !interaction || !profileSeq52 || !pdbAlignment52 || !varna52) return { missingTrackMarks: true };

    observed.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 120, clientY: 120 }));
    const hoverResidue = observed.getAttribute('data-residue-key');
    const hoveredCount = document.querySelectorAll('.residue-mark.hovered').length;
    pdbAlignment52.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 420, clientY: 88 }));
    const pdbAlignmentHoverTip = document.querySelector('#tip')?.textContent || '';

    profileSeq52.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 420, clientY: 56 }));
    const afterProfileSeqClick = {
      origin: JSON.parse(document.querySelector('#log').textContent || '{}').origin || '',
      selectionStatus: document.querySelector('#molstar-selection-status')?.textContent || '',
      targetDisplayPreview52: document.querySelector('#molstar-host')?.dataset.targetDisplayPreview52 || '',
    };

    pdbAlignment52.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 420, clientY: 88 }));
    const afterPdbAlignmentClick = {
      origin: JSON.parse(document.querySelector('#log').textContent || '{}').origin || '',
      inspectorText: document.querySelector('#linked-inspector')?.textContent || '',
      selectionStatus: document.querySelector('#molstar-selection-status')?.textContent || '',
    };

    bridge.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 120, clientY: 120 }));
    const bridgeResidue = bridge.getAttribute('data-residue-key');
    const afterBridgeClick = {
      inspectorText: document.querySelector('#linked-inspector')?.textContent || '',
      inspectorStatus: document.querySelector('#inspectorStatus')?.textContent || '',
      selectionStatus: document.querySelector('#molstar-selection-status')?.textContent || '',
      selectedCount: document.querySelectorAll('.residue-mark.selected').length,
    };

    bridge52.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 420, clientY: 120 }));
    const afterBridge52Click = {
      inspectorText: document.querySelector('#linked-inspector')?.textContent || '',
      inspectorStatus: document.querySelector('#inspectorStatus')?.textContent || '',
      selectionStatus: document.querySelector('#molstar-selection-status')?.textContent || '',
    };

    varna52.scrollIntoView({ block: 'center', inline: 'center' });
    const varnaBox = varna52.getBoundingClientRect();
    const top2d = document.elementFromPoint(varnaBox.left + varnaBox.width / 2, varnaBox.top + varnaBox.height / 2);
    top2d?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: varnaBox.left + varnaBox.width / 2,
      clientY: varnaBox.top + varnaBox.height / 2,
    }));
    const after2dTopClick = {
      topLayer: top2d?.getAttribute?.('data-layer') || '',
      topResidue: top2d?.getAttribute?.('data-residue-key') || '',
      inspectorText: document.querySelector('#linked-inspector')?.textContent || '',
      inspectorStatus: document.querySelector('#inspectorStatus')?.textContent || '',
      selectionStatus: document.querySelector('#molstar-selection-status')?.textContent || '',
      targetDisplayPreview52: document.querySelector('#molstar-host')?.dataset.targetDisplayPreview52 || '',
      selectedCount: document.querySelectorAll('.residue-mark.selected').length,
    };

    const beforeZoom = document.querySelector('#viewportStatus')?.textContent || '';
    document.querySelector('#zoom-in').click();
    const afterZoom = document.querySelector('#viewportStatus')?.textContent || '';
    document.querySelector('#pan-right').click();
    const afterPan = document.querySelector('#viewportStatus')?.textContent || '';

    const host = document.querySelector('#molstar-host');
    const hoverEvent = new CustomEvent('PDB.molstar.mouseover', {
      bubbles: true,
      detail: { eventData: { label_seq_id: 52, label_asym_id: 'A', auth_seq_id: 52, auth_asym_id: '1' } },
    });
    host.dispatchEvent(hoverEvent);
    const after3dHover = {
      tipText: document.querySelector('#tip')?.textContent || '',
      inspectorStatus: document.querySelector('#inspectorStatus')?.textContent || '',
      hoveredCount: document.querySelectorAll('.residue-mark.hovered').length,
    };
    host.dispatchEvent(new Event('PDB.molstar.mouseout', { bubbles: true }));
    const after3dMouseout = {
      inspectorStatus: document.querySelector('#inspectorStatus')?.textContent || '',
      hoveredCount: document.querySelectorAll('.residue-mark.hovered').length,
    };

    const event = new CustomEvent('PDB.molstar.click', {
      bubbles: true,
      detail: { eventData: { label_seq_id: 52, label_asym_id: 'A', auth_seq_id: 52, auth_asym_id: '1' } },
    });
    host.dispatchEvent(event);
    const after3dClick = {
      inspectorText: document.querySelector('#linked-inspector')?.textContent || '',
      inspectorStatus: document.querySelector('#inspectorStatus')?.textContent || '',
      selectionStatus: document.querySelector('#molstar-selection-status')?.textContent || '',
      bridgeState: host.getAttribute('data-event-bridge'),
      chainKey: host.getAttribute('data-structure-chain-key'),
    };

    return {
      hoverResidue,
      hoveredCount,
      pdbAlignmentHoverTip,
      afterProfileSeqClick,
      afterPdbAlignmentClick,
      bridgeResidue,
      afterBridgeClick,
      afterBridge52Click,
      after2dTopClick,
      beforeZoom,
      afterZoom,
      afterPan,
      after3dHover,
      after3dMouseout,
      after3dClick,
    };
  });
  const molstarContainment = await page.evaluate(() => {
    const host = document.querySelector('#molstar-host');
    const track = document.querySelector('#track-viewport');
    const fake = document.createElement('div');
    fake.className = 'msp-plugin msp-layout-standard';
    fake.id = 'molstar-containment-probe';
    fake.style.position = 'absolute';
    fake.style.inset = '0';
    fake.style.background = 'rgba(255, 0, 0, 0.01)';
    fake.style.pointerEvents = 'auto';
    host.appendChild(fake);
    const hostBox = host.getBoundingClientRect();
    const fakeBox = fake.getBoundingClientRect();
    const trackBox = track.getBoundingClientRect();
    const elementAtTrack = document.elementFromPoint(trackBox.left + trackBox.width / 2, trackBox.top + 20);
    const result = {
      hostTop: Math.round(hostBox.top),
      fakeTop: Math.round(fakeBox.top),
      hostLeft: Math.round(hostBox.left),
      fakeLeft: Math.round(fakeBox.left),
      hostHeight: Math.round(hostBox.height),
      fakeHeight: Math.round(fakeBox.height),
      elementAtTrackId: elementAtTrack?.id || '',
      elementAtTrackClass: elementAtTrack?.className ? String(elementAtTrack.className) : '',
    };
    fake.remove();
    return result;
  });
  await page.click('[data-view="linear-debug"]');
  const afterTab = await page.evaluate(() => ({
    active: document.querySelector('.tab.active')?.textContent.trim(),
    varnaHidden: document.querySelector('#varnaViewer').hidden,
    linearHidden: document.querySelector('#linearViewer').hidden,
    linearSvgPresent: !!document.querySelector('#linearViewer svg')
  }));
  await page.selectOption('#profileSelect', '1');
  const afterProfile = await page.evaluate(() => JSON.parse(document.querySelector('#log').textContent || '{}').pair_id);
  return { before, linked, molstarContainment, afterTab, afterProfile, sourceCifRequestCount: sourceCifRequests.length, fit: [desktopFit, mobileFit] };
}`;

send({
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "browser_run_code_unsafe",
    arguments: { code },
  },
});
const response = await waitFor(2);
send({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: { name: "browser_close", arguments: {} },
});
await waitFor(3).catch(() => null);
proc.stdin.end();

const text = textContent(response);
const match = text.match(/### Result\n([\s\S]*?)\n### Ran Playwright code/);
if (!match) {
  proc.kill("SIGTERM");
  throw new Error(`unable to parse Playwright result:\n${text}`);
}
const result = JSON.parse(match[1]);
const failures = [];
if (!result.before.workbench) failures.push("workbench shell missing");
if (result.before.active !== "VARNA stem-loop") failures.push("default tab is not VARNA stem-loop");
if (result.before.varnaHidden !== false) failures.push("VARNA viewer is hidden by default");
if (result.before.linearHidden !== true) failures.push("Linear viewer is visible by default");
if (!result.before.trackRailPresent) failures.push("1D track rail missing");
for (const kind of ["bridge_membership", "dms_targetability", "fec_lss_confidence", "interaction_endpoint_occupancy", "observed_mask", "pdb_polymer_alignment", "pdb_residue", "profile_sequence", "profile_value", "structure_state"]) {
  if (!result.before.trackKinds?.includes(kind)) failures.push(`1D track kind missing: ${kind}`);
}
if (!result.before.molstarHostPresent) failures.push("Molstar host missing");
if (!result.before.molstarFullHostPresent) failures.push("Full-CIF Molstar reference host missing");
if (result.before.molstarStructureSource !== "client-alignment-crop") failures.push("Molstar target source is not client-alignment-crop");
if (result.before.molstarStructureSourceKind !== "cropped") failures.push("Molstar target source kind is not cropped");
if (result.before.molstarStructureSourceUrl !== "https://files.rcsb.org/download/5GAG.cif") failures.push("Molstar source URL is not the remote RCSB CIF");
if (result.before.molstarStructureAuthAsymId !== "1") failures.push("Molstar projection auth_asym_id is not 1");
if (result.before.molstarStructureLabelAsymId !== "A") failures.push("Molstar projection label_asym_id is not A");
if (result.before.molstarStructureAtomRows !== "43") failures.push("Molstar projection did not expose 43 resolved residues");
if (result.before.molstarAlignmentCropRange !== "1-113") failures.push("Molstar target crop range is not alignment-derived 1-113");
if (result.before.molstarAlignmentCropSource !== "structure-coverage.sequenceAlignment") failures.push("Molstar target crop source is not structure-coverage.sequenceAlignment");
if (result.before.molstarCroppedAtomSiteRows !== "2") failures.push("Molstar target crop did not keep only the two target-chain sample atom_site rows");
if (result.before.molstarDroppedAtomSiteRows !== "2") failures.push("Molstar target crop did not drop B-chain and out-of-alignment sample atom_site rows");
if (result.before.molstarFullStructureSource !== "source-structure") failures.push("Full-CIF reference source is not source-structure");
if (result.before.molstarFullStructureSourceKind !== "full") failures.push("Full-CIF reference source kind is not full");
if (result.before.molstarFullStructureSourceUrl !== "https://files.rcsb.org/download/5GAG.cif") failures.push("Full-CIF reference URL is not the remote RCSB CIF");
if (result.before.molstarTargetDisplayMode !== "alignment_cropped_target_chain") failures.push("Molstar target-chain display mode missing");
if (result.before.molstarTargetDisplayResidues !== "43") failures.push("Molstar target-chain display did not color 43 resolved residues by default");
if (result.before.molstarTargetDisplayColorSource !== "DMS_REACTIVITY_FILL") failures.push("Molstar target-chain display is not using DMS reactivity fill colors");
if (result.before.molstarTargetDisplayContext !== "alignment-cropped target chain") failures.push("Molstar target display is not labeled as alignment-cropped target chain");
if (!/"residueKey":"5GAG\\|chain\\|strand_1\\|52"/.test(result.before.molstarTargetDisplayPreview52 || "")) failures.push("Molstar default display preview does not include residue 52");
if (!/"structAsymId":"A"/.test(result.before.molstarTargetDisplayPreview52 || "")) failures.push("Molstar residue 52 selector does not use label_asym_id A");
if (!/"colorSource":"DMS_REACTIVITY_FILL"/.test(result.before.molstarTargetDisplayPreview52 || "")) failures.push("Molstar residue 52 preview is not DMS-colored by default");
if (!/client-alignment-crop/.test(result.before.molstarMetaText || "")) failures.push("Molstar meta does not expose client-alignment-crop mode");
if (!/target chain alignment crop from 1-113/.test(result.before.molstarMetaText || "")) failures.push("Molstar meta does not expose alignment crop range");
if (!/full CIF reference/.test(result.before.molstarFullMetaText || "")) failures.push("Full-CIF reference meta missing");
if (!/profile-PDB polymer sequence match 113\/113/.test(result.before.trackStatusText || "")) failures.push("track status does not expose full 113/113 sequence match");
if (!/atom_site coordinates observed 43\/113/.test(result.before.trackStatusText || "")) failures.push("track status does not label 43/113 as atom_site coordinate coverage");
if (!/not a sequence-alignment count/.test(result.before.trackStatusText || "")) failures.push("track status does not disambiguate coordinate coverage from sequence alignment");
if (!/LSS_UNDERPOWERED/.test(result.before.trackStatusText || "")) failures.push("track status does not expose profile-id LSS context");
if (!/DMS loop recall\s*30\/34 \(88\.24%\)/.test(result.before.statsText || "")) failures.push("stats do not expose DMS loop recall 30/34");
if (!/LSS status\s*LSS_UNDERPOWERED/.test(result.before.statsText || "")) failures.push("stats do not expose LSS_UNDERPOWERED");
if (!/LSS evaluable\s*18 paired \/ 4 unpaired/.test(result.before.statsText || "")) failures.push("stats do not expose LSS paired/unpaired counts");
if (!/RMDB query coverage\s*not materialized/.test(result.before.statsText || "")) failures.push("RMDB query coverage should be not materialized");
if (!/PDB reference sequence coverage\s*not materialized/.test(result.before.statsText || "")) failures.push("PDB reference sequence coverage should be not materialized");
if (!/profile-PDB polymer sequence match 113\/113/.test(result.before.molstarMetaText || "")) failures.push("Molstar meta does not expose 113/113 sequence match");
if (!/atom_site coordinates observed 43\/113/.test(result.before.molstarMetaText || "")) failures.push("Molstar meta does not label 43/113 as atom_site coordinate coverage");
if (!/sequence-only\/no atom_site/.test(result.before.molstarMetaText || "")) failures.push("Molstar meta does not expose sequence-only coordinate intervals");
if (result.before.profile52Base !== "C") failures.push("1D profile sequence track does not show residue 52 C");
if (result.before.pdb52Base !== "C") failures.push("1D PDB polymer alignment track does not retain residue 52 PDB base C");
if (result.before.pdb52AlignmentText !== "C") failures.push("1D PDB polymer alignment track does not render residue 52 PDB base C");
if (result.before.pdb52AlignmentState !== "match") failures.push("1D PDB polymer alignment track does not record profile/PDB match for residue 52");
if (result.before.structure52State !== "stem") failures.push("1D structure state track does not mark residue 52 stem");
if (result.before.structure52ColorSource !== "RESIDUE_STATE_COLORS") failures.push("1D structure state track does not reference shared state colors");
if (!result.before.varna52ReactivityFill) failures.push("2D VARNA circle does not preserve DMS reactivity fill");
if (result.before.varna52StructureState !== "stem") failures.push("2D VARNA circle does not expose shared structure state");
if (result.before.varna52ColorSource !== "RESIDUE_STATE_COLORS") failures.push("2D VARNA circle does not reference shared state colors");
if (result.before.target52State !== "applicable") failures.push("1D DMS targetability track does not mark residue 52 applicable");
if (result.before.target1State !== "not_applicable") failures.push("1D DMS targetability track does not mark residue 1 not_applicable");
if (result.before.pdb52Status !== "resolved") failures.push("1D 3D-coordinate track does not mark residue 52 resolved");
if (result.before.pdb1Status !== "unresolved") failures.push("1D 3D-coordinate track does not mark residue 1 unresolved");
if (result.before.pdb52Meaning !== "resolved_atom_site_coordinate") failures.push("resolved coordinate track is missing resolved meaning");
if (result.before.pdb1Meaning !== "sequence_only_no_atom_site_coordinate") failures.push("unresolved coordinate track is missing sequence-only meaning");
if (result.before.pdb52Fill !== "#e3f1fb" || result.before.pdb52Stroke !== "#3f7da8") failures.push("resolved coordinate track style changed unexpectedly");
if (result.before.pdb1Fill !== "#d8dde3" || result.before.pdb1Stroke !== "#8d97a3") failures.push("unresolved coordinate track is not rendered gray");
if (!result.before.inspectorPresent) failures.push("linked inspector missing");
if (result.before.profileOptions !== 27) failures.push("profile option count mismatch");
if (result.before.shardDecodeMode !== "gzip") failures.push("browser did not use gzip shard decode");
if (result.before.renderButtonPresent) failures.push("Render button still present");
if (result.before.benchmarkText !== "Run profile benchmark") failures.push("debug benchmark label mismatch");
if (result.before.varnaView !== "varna") failures.push("main SVG is not tagged as VARNA");
if (result.before.whiteCount !== 57 || result.before.coloredCount !== 56) failures.push("VARNA color counts mismatch");
if (result.linked?.missingTrackMarks) failures.push("linked 1D track marks missing");
if (!result.linked?.hoverResidue || result.linked.hoveredCount < 2) failures.push("1D hover did not propagate to linked residue marks");
if (!/PDB polymer alignment 52: profile C -> PDB C \(match\)/.test(result.linked?.pdbAlignmentHoverTip || "")) failures.push("PDB polymer alignment hover does not expose alignment semantics");
if (result.linked?.afterProfileSeqClick?.origin !== "1d:profile_sequence") failures.push("profile sequence click did not preserve its 1D origin");
if (!/"colorSource":"SELECTED"/.test(result.linked?.afterProfileSeqClick?.targetDisplayPreview52 || "")) failures.push("1D click did not update Molstar residue 52 payload to selected color");
if (!/"color":\{"r":155,"g":28,"b":28\}/.test(result.linked?.afterProfileSeqClick?.targetDisplayPreview52 || "")) failures.push("1D click did not set Molstar residue 52 selected RGB");
if (result.linked?.afterPdbAlignmentClick?.origin !== "1d:pdb_polymer_alignment") failures.push("PDB polymer alignment click did not preserve its 1D origin");
if (!/PDB polymer baseC \(match\)/.test(result.linked?.afterPdbAlignmentClick?.inspectorText || "")) failures.push("PDB alignment click did not populate PDB polymer base in inspector");
if (!/Raw value/.test(result.linked?.afterBridgeClick?.inspectorText || "")) failures.push("inspector missing Raw value after 1D bridge click");
if (!/Join status/.test(result.linked?.afterBridgeClick?.inspectorText || "")) failures.push("inspector missing Join status after 1D bridge click");
if (!/Structure locus/.test(result.linked?.afterBridgeClick?.inspectorText || "")) failures.push("inspector missing Structure locus after 1D bridge click");
if (!/Assay state/.test(result.linked?.afterBridgeClick?.inspectorText || "")) failures.push("inspector missing Assay state after 1D bridge click");
if (!/PDB polymer residue/.test(result.linked?.afterBridgeClick?.inspectorText || "")) failures.push("inspector missing PDB polymer residue after 1D bridge click");
if (!/FEC\/LSS confidence/.test(result.linked?.afterBridgeClick?.inspectorText || "")) failures.push("inspector missing FEC/LSS confidence after 1D bridge click");
if (!result.linked?.afterBridgeClick?.selectionStatus?.includes(result.linked.bridgeResidue)) failures.push("1D click did not update selection status");
if ((result.linked?.afterBridgeClick?.selectedCount || 0) < 2) failures.push("1D click did not propagate selected state");
if (!/5GAG\|bridge\|dbn-stem-1/.test(result.linked?.afterBridge52Click?.inspectorText || "")) failures.push("Bridge track did not report bridgeKey semantics for residue 52");
if (/paired:57/.test(result.linked?.afterBridge52Click?.inspectorText || "")) failures.push("Bridge track still reports pair partner as bridge semantics");
if (!/PDB strand 1 residue 52/.test(result.linked?.afterBridge52Click?.inspectorText || "")) failures.push("inspector does not show PDB polymer residue 52");
if (!/113\/113 profile-PDB polymer residues match/.test(result.linked?.afterBridge52Click?.inspectorText || "")) failures.push("inspector does not show full sequence agreement");
if (!/43\/113 atom_site coordinate residues observed/.test(result.linked?.afterBridge52Click?.inspectorText || "")) failures.push("inspector does not label 43/113 as coordinate coverage");
if (!/not a sequence-alignment count/.test(result.linked?.afterBridge52Click?.inspectorText || "")) failures.push("inspector does not disambiguate coordinate coverage from sequence alignment");
if (!/FEC: not_materialized_in_smoke/.test(result.linked?.afterBridge52Click?.inspectorText || "")) failures.push("inspector does not show FEC not materialized status");
if (!/ANNOCONFIDENCE: not_materialized_in_smoke/.test(result.linked?.afterBridge52Click?.inspectorText || "")) failures.push("inspector does not show ANNOCONFIDENCE not materialized status");
if (result.linked?.after2dTopClick?.topLayer !== "varna-hit-layer") failures.push("2D topmost clickable node is not the normalized VARNA hit layer");
if (!/52 C/.test(result.linked?.after2dTopClick?.inspectorStatus || "")) failures.push("2D topmost click did not select residue 52");
if (!/5GAG\|chain\|strand_1\|52/.test(result.linked?.after2dTopClick?.selectionStatus || "")) failures.push("2D topmost click did not propagate selection status");
if (!/"colorSource":"SELECTED"/.test(result.linked?.after2dTopClick?.targetDisplayPreview52 || "")) failures.push("2D click did not update Molstar residue 52 payload to selected color");
if (!/"color":\{"r":155,"g":28,"b":28\}/.test(result.linked?.after2dTopClick?.targetDisplayPreview52 || "")) failures.push("2D click did not set Molstar residue 52 selected RGB");
if (result.linked?.beforeZoom === result.linked?.afterZoom) failures.push("zoom control did not change viewport");
if (result.linked?.afterZoom === result.linked?.afterPan) failures.push("pan control did not change viewport");
if (!/3D 52 C/.test(result.linked?.after3dHover?.tipText || "")) failures.push("3D hover did not expose Molstar hover tooltip semantics");
if (!/52 C/.test(result.linked?.after3dHover?.inspectorStatus || "")) failures.push("3D hover did not update inspector residue");
if ((result.linked?.after3dHover?.hoveredCount || 0) < 2) failures.push("3D hover did not propagate hovered state");
if (!/52 C/.test(result.linked?.after3dMouseout?.inspectorStatus || "")) failures.push("3D mouseout cleared selected inspector state");
if ((result.linked?.after3dMouseout?.hoveredCount || 0) !== 0) failures.push("3D mouseout did not clear hovered state");
if (!/52 /.test(result.linked?.after3dClick?.inspectorStatus || "")) failures.push("3D custom click did not update inspector residue");
if (!/5GAG\\|chain\\|strand_1\\|52/.test(result.linked?.after3dClick?.selectionStatus || "")) failures.push("3D custom click did not update selection status");
if (!result.linked?.after3dClick?.bridgeState) failures.push("Molstar event bridge not installed on host");
if (result.linked?.after3dClick?.chainKey !== "5GAG|chain|strand_1") failures.push("Molstar host is not scoped to active profile chain");
if (Math.abs((result.molstarContainment?.fakeTop ?? 0) - (result.molstarContainment?.hostTop ?? 9999)) > 2) failures.push("Molstar absolute child is not vertically contained by host");
if (Math.abs((result.molstarContainment?.fakeLeft ?? 0) - (result.molstarContainment?.hostLeft ?? 9999)) > 2) failures.push("Molstar absolute child is not horizontally contained by host");
if (Math.abs((result.molstarContainment?.fakeHeight ?? 0) - (result.molstarContainment?.hostHeight ?? 9999)) > 2) failures.push("Molstar absolute child height does not match host");
if (result.molstarContainment?.elementAtTrackId === "molstar-containment-probe") failures.push("Molstar containment probe covers 1D track");
if (result.afterTab.active !== "Linear / debug") failures.push("Linear / debug tab did not activate");
if (result.afterTab.varnaHidden !== true || result.afterTab.linearHidden !== false) failures.push("tab visibility did not switch");
if (!result.afterTab.linearSvgPresent) failures.push("Linear SVG missing after tab switch");
if (result.afterProfile === "5GAG:sequence_000008") failures.push("profile selection did not auto-refresh");
for (const fit of result.fit || []) {
  if (fit.bodyHorizontalOverflow > 1) failures.push(`${fit.label} body has horizontal overflow ${fit.bodyHorizontalOverflow}`);
  if (fit.varnaHorizontalOverflow > 1) failures.push(`${fit.label} VARNA SVG overflows viewport by ${fit.varnaHorizontalOverflow}`);
  if (fit.varnaSvgWidth > fit.varnaViewportWidth + 1) failures.push(`${fit.label} VARNA SVG wider than fit viewport`);
  if (fit.profileScrollWidth < fit.profileClientWidth) failures.push(`${fit.label} profile box geometry is invalid`);
}

if (failures.length) {
  throw new Error(`Playwright tabbed smoke failed:\n- ${failures.join("\n- ")}`);
}

console.log(JSON.stringify(result, null, 2));
