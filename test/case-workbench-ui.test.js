import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const base = new URL('../public/entry-cases/__entry_v3_site__/', import.meta.url);
const workbench = readFileSync(new URL('workbench.js', base), 'utf8');
const css = readFileSync(new URL('workbench.css', base), 'utf8');
const workbenchUrl = new URL('workbench.js', base);
const runtimePurePath = workbench.match(/from\s+["'](\.\/workbench-pure\.[^"']+\.mjs)["']/)?.[1];
assert.ok(runtimePurePath, 'workbench.js must import one fingerprinted workbench-pure runtime module');
const runtimePure = await import(new URL(runtimePurePath, workbenchUrl));

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `missing source boundary: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.ok(to > from, `missing source boundary: ${end}`);
  return source.slice(from, to);
}

const filterMount = between(workbench, 'function mountTechniqueFilter()', '\n// Choose the default profile');
const refilter = between(filterMount, 'const refilter = () => {', '\n  };\n\n  options.categories');
const profileRender = between(workbench, 'async function renderProfile(index)', '\nfunction profileIndexForId');
const init = between(workbench, 'async function init()', '\nel.select.addEventListener("change"');
const profileChange = between(workbench, 'el.select.addEventListener("change"', '\nel.zoomIn?.addEventListener');
const legendUpdate = between(workbench, 'function updateView()', '\nfunction referenceJournalLine');
const reactivityFill = between(workbench, 'function reactivitySvgFill(', '\nfunction wireTrackMark');
const trackRender = between(workbench, 'function renderTrackRail()', '\nfunction toVarnaRgb');
const varnaRender = between(workbench, 'function recolorVarnaSvg(', '\nfunction installVarnaHitLayer');
const molstarRender = between(workbench, 'function colorForMolstarReactivity(', '\nfunction updateMolstarTargetDisplayDataset');

function runtimeRows(normalized) {
  if (Array.isArray(normalized.rows)) return normalized.rows;
  if (normalized.byPosition instanceof Map) return [...normalized.byPosition.values()];
  assert.fail('runtime normalization must expose rows or a byPosition Map');
}

function runtimeRgb(color) {
  assert.match(color, /^#[\da-f]{6}$/i);
  return [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
}

test(`fingerprinted ${runtimePurePath} implements the full pure behavior contract`, () => {
  assert.equal(typeof runtimePure.normalizeReactivityProfile, 'function');
  assert.equal(typeof runtimePure.publicTechniqueFilterStatus, 'function');
  assert.deepEqual(runtimePure.REACTIVITY_STATES, {
    MISSING: 'missing', NONPOSITIVE: 'nonpositive', POSITIVE: 'positive',
  });
  const normalized = runtimePure.normalizeReactivityProfile(
    [NaN, Infinity, -Infinity, -1, 0, 0.01, 0.5, 1, 1],
  );
  const rows = runtimeRows(normalized);
  assert.deepEqual(rows.map((row) => row.state), [
    'missing', 'missing', 'missing', 'nonpositive', 'nonpositive',
    'positive', 'positive', 'positive', 'positive',
  ]);
  assert.equal(Number.isNaN(rows[0].raw), true);
  assert.deepEqual(
    [normalized.missingCount, normalized.nonpositiveCount, normalized.positiveCount],
    [3, 2, 4],
  );
  assert.equal(normalized.mappedCount, 6);
  assert.equal(normalized.cap, 1);
  assert.deepEqual(rows.slice(5, 8).map((row) => row.color.toLowerCase()),
    ['#fff000', '#eb860e', '#d7191c']);
  const missingRgb = runtimeRgb(rows[0].color);
  assert.ok(Math.max(...missingRgb) - Math.min(...missingRgb) <= 16);
  const nonpositiveRgb = runtimeRgb(rows[3].color);
  assert.ok(nonpositiveRgb[2] > nonpositiveRgb[0] && nonpositiveRgb.every((channel) => channel >= 150));
  assert.notEqual(rows[0].color, rows[3].color);
  for (const row of rows) runtimeRgb(row.color);
  const capped = runtimePure.normalizeReactivityProfile([NaN, -1, 0, 1, 2, 3, 4, 100]);
  assert.ok(Math.abs(capped.cap - 80.8) < 1e-9);
  assert.equal(capped.cappedCount, 1);
  assert.equal(runtimeRows(capped).at(-1).norm, 1);
  const status = runtimePure.publicTechniqueFilterStatus;
  assert.equal(status({ active: true, hitCount: 1, totalCount: 17, metadataAvailable: true }),
    '匹配 1 个 Profile；请在 Profile 下拉列表中选择');
  assert.equal(status({ active: true, hitCount: 12, totalCount: 17, metadataAvailable: true }),
    '匹配 12 个 Profile；请在 Profile 下拉列表中选择');
  assert.equal(status({ active: true, hitCount: 0, totalCount: 17, metadataAvailable: true }), '无匹配 Profile');
  assert.equal(status({ active: false, hitCount: 0, totalCount: 17, metadataAvailable: true }),
    '显示全部 17 个 Profile');
  assert.equal(status({ active: true, hitCount: 0, totalCount: 17, metadataAvailable: false }),
    'Technique metadata unavailable');
  assert.equal(status({ active: false, hitCount: 0, totalCount: 17, metadataAvailable: false }),
    'Technique metadata unavailable');
});

test('Technique feedback is announced and refilter only changes option visibility and status', () => {
  assert.match(filterMount, /status\.setAttribute\(["']aria-live["'],\s*["']polite["']\)/);
  assert.match(filterMount, /status\.setAttribute\(["']aria-atomic["'],\s*["']true["']\)/);
  assert.match(refilter, /applyPublicTechniqueFilter\(state\.publicTechniqueModel,\s*selection\)/);
  assert.match(refilter, /applyProfileDropdownFilter\(/);
  assert.match(refilter, /publicTechniqueFilterStatus\(/);
  assert.match(refilter, /status\.textContent\s*=/);
  assert.doesNotMatch(refilter, /dispatchEvent|renderProfile\s*\(|location\.(?:reload|assign|replace)|window\.location\s*=/);
  assert.doesNotMatch(refilter, /(?:el\.)?select\.value\s*=/, 'filtering cannot auto-select a Profile');
});

test('only a loaded VARNA SVG gets a keyboard-focusable, named scroll viewport', () => {
  const fit = between(workbench, 'function fitVarnaSvg()', '\nconst VARNA_ZOOM_MIN');
  const svgGuard = fit.indexOf('if (!svg) return null');
  const focus = fit.search(/(?:el\.varnaViewport\.tabIndex\s*=\s*0|el\.varnaViewport\.setAttribute\(["']tabindex["'],\s*["']?0["']?\))/);
  const region = fit.search(/el\.varnaViewport\.setAttribute\(["']role["'],\s*["']region["']\)/);
  const name = fit.search(/el\.varnaViewport\.setAttribute\(["']aria-label["'],/);
  assert.ok(svgGuard >= 0, 'missing SVG must not get a false scroll state');
  assert.ok(focus > svgGuard, 'loaded scroll viewport must be keyboard-focusable');
  assert.ok(region > svgGuard, 'loaded named scroll viewport must expose region semantics');
  assert.ok(name > svgGuard, 'loaded scroll viewport must have an accessible name');
});

test('Case entrypoints cannot reach the retired RMDB raw heatmap or RDAT fetch path', () => {
  for (const [label, source] of [
    ['init', init],
    ['renderProfile', profileRender],
    ['Profile change', profileChange],
    ['Technique refilter', refilter],
  ]) {
    assert.doesNotMatch(source, /\brenderRmdbHeatmap\s*\(|\bfetchRmdbRdatText\s*\(|PDB130_DMS_0000\.rdat|\/api\/rmdb\/rdat\//,
      `${label} must not request or display retired raw RDAT`);
  }
  assert.match(init, /await renderProfile\(initialIndex\)/);
  assert.match(profileChange, /renderProfile\(Number\(el\.select\.value\)\)/);
  assert.doesNotMatch(profileRender, /\brmdbRdatUrls\s*\(|\brmdbRdatUrl\s*\(/);
});

function assertThreeStateRenderWiring() {
  assert.match(workbench.slice(0, workbench.indexOf('const EF_ASSET_VERSION')), /normalizeReactivityProfile/,
    'runtime imports the tested pure normalizer');
  assert.match(profileRender, /const normalized\s*=\s*normalizeReactivityProfile\(values\)/);
  assert.match(profileRender, /recolorVarnaSvg\([^;]*normalized[^;]*\)/s, '2D consumes the normalized result');
  const saveAt = profileRender.indexOf('state.lastRender =');
  const trackAt = profileRender.indexOf('renderTrackRail()');
  const molstarAt = profileRender.indexOf('applyMolstarTargetDisplay(');
  assert.ok(saveAt >= 0 && saveAt < trackAt && saveAt < molstarAt,
    '1D and 3D run after normalized rows are stored in lastRender');
  assert.match(trackRender, /state\.lastRender\?\.normalized/);
  assert.match(trackRender, /normalized\.byPosition\.get\(position\)/);
  assert.match(trackRender, /(?:row(?:\?\.|\.)state|reactivity\w*Fill\([^)]*row)/i,
    '1D consumes the row state for three-state fill/texture');
  assert.match(trackRender, /installReactivityMissingPattern\([^;]*\.track\)/s);
  assert.match(varnaRender, /normalized\.byPosition\.get\(pos\)/);
  assert.match(varnaRender, /(?:colorRow(?:\?\.|\.)state|reactivity\w*Fill\([^)]*colorRow)/i,
    '2D consumes the row state for three-state fill/texture');
  assert.match(varnaRender, /installReactivityMissingPattern\([^;]*\.varna\)/s);
  assert.match(reactivityFill, /REACTIVITY_STATES\.MISSING/);
  assert.match(reactivityFill, /url\(#\$\{missingPatternId\}\)/);
  assert.match(reactivityFill, /row\?\.color/,
    'finite nonpositive and positive states retain their solid helper colors');
  assert.match(molstarRender, /state\.lastRender\?\.normalized/);
  assert.match(molstarRender, /normalized\.byPosition\.get\(position\)/);
  assert.match(molstarRender, /row\?\.color|row\.color/, '3D consumes the pure helper solid hex color');
  assert.doesNotMatch(molstarRender, /url\(#|pattern/i, '3D cannot consume SVG pattern paint');
}

test('ordinary Case wires and labels missing, measured <=0, and positive/P95 in 1D/2D/3D', () => {
  assertThreeStateRenderWiring();
  assert.doesNotMatch(legendUpdate, /missing, unmapped, or non-positive/i,
    'missing and finite nonpositive measurements cannot share one legend item');
  assert.match(legendUpdate, /missing|unmapped/i);
  assert.match(legendUpdate, /measured.{0,24}(?:≤|<=)\s*0/i);
  assert.match(legendUpdate, /positive.{0,40}P95/i);
  assert.ok([...legendUpdate.matchAll(/replaceChildren\(/g)].length >= 3,
    'legend needs three separate user-visible labels');
  assert.ok(new Set([...css.matchAll(/\.swatch-[\w-]+\s*\{/g)].map((match) => match[0])).size >= 3,
    'legend needs three distinct swatch styles');
  assert.match(profileRender, /missingCount/);
  assert.match(profileRender, /nonpositiveCount/);
  assert.match(profileRender, /positiveCount/);
  assert.doesNotMatch(profileRender, /white bases|whiteCount/);
  for (const selector of ['.residue-mark.hovered', '.residue-mark.selected']) {
    const rule = css.match(new RegExp(`${selector.replaceAll('.', '\\.')}\\s*\\{([^}]*)\\}`))?.[1] || '';
    assert.ok(rule, `${selector} styling must exist`);
    assert.doesNotMatch(rule, /(?:^|;)\s*fill\s*:/,
      `${selector} must preserve the three-state fill while changing stroke`);
  }
});

test('ordinary three-state styling retains the explicit E/F cascade and script boundary', () => {
  const ordinaryViewportAt = css.indexOf('.varna-viewport {');
  const efViewportAt = css.indexOf('.workbench-shell.is-ef-mode .varna-viewport {');
  assert.ok(ordinaryViewportAt >= 0 && efViewportAt > ordinaryViewportAt,
    'the more-specific E/F viewport override must follow the ordinary scroll viewport');
  const efViewportRule = css.slice(efViewportAt, css.indexOf('}', efViewportAt) + 1);
  assert.match(efViewportRule, /(?:block-size|height):\s*404px/,
    'E/F keeps its established fixed 404px viewport instead of inheriting ordinary clamp sizing');
  assert.match(efViewportRule, /overflow:\s*visible/,
    'E/F explicitly keeps its established non-scrolling viewport instead of inheriting overflow:auto');
  assert.doesNotMatch(efViewportRule, /overflow(?:-x|-y)?:\s*(?:auto|scroll)/);
  const dynamicEfPaths = [...workbench.matchAll(/new URL\(['"](\.\.\/__entry_ef_site__\/[^'"]+\.js)['"],\s*import\.meta\.url\)/g)]
    .map((match) => match[1]);
  assert.equal(dynamicEfPaths.length, 3, 'inspect exactly the three E/F scripts loaded at runtime');
  assert.deepEqual(dynamicEfPaths.map((path) => path.split('/').at(-1).split('.')[0]),
    ['ef-heatmap-core', 'ef-heatmap', 'ef-case']);
  const efShellPath = workbench.match(/from\s+["'](\.\/ef-workbench-shell[^"']+\.mjs)["']/)?.[1];
  assert.ok(efShellPath, 'inspect the E/F shell module actually imported by workbench.js');
  for (const path of [new URL(efShellPath, workbenchUrl), ...dynamicEfPaths.map((item) => new URL(item, workbenchUrl))]) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /normalizeReactivityProfile|REACTIVITY_STATES|missingCount|nonpositiveCount/,
      `${path.pathname} must not use ordinary Profile color semantics`);
  }
});

test('ordinary Case starts one optional strict local-geometry load beside its required assets', () => {
  const imports = workbench.slice(0, workbench.indexOf('const EF_ASSET_VERSION'));
  const stateBody = between(workbench, 'const state = {', '\n};\n\nconst el = {');
  const initBody = between(workbench, 'async function init()', '\nel.select.addEventListener("change"');

  assert.match(imports, /\bLOCAL_GEOMETRY_SCHEMA\b/);
  assert.match(imports, /\bvalidateLocalGeometrySidecar\b/);
  assert.match(imports, /\bbuildLocalGeometryWindow\b/);
  assert.match(workbench, /const localGeometryUrl\s*=\s*config\.localGeometryUrl\s*\|\|\s*`\$\{linkedViewRoot\}\/local-geometry\.json\.gz`/);
  assert.match(stateBody, /localGeometryStatus:\s*["']loading["']/);
  assert.match(stateBody, /localGeometryModel:\s*null/);
  assert.match(stateBody, /localGeometryError:\s*null/);

  const optionalAt = initBody.indexOf('const localGeometryPromise =');
  const waitAt = initBody.indexOf('await Promise.all([');
  assert.ok(optionalAt >= 0 && optionalAt < waitAt,
    'the optional sidecar request must start before the required-asset join');
  assert.match(initBody, /loadOptionalLocalGeometry\(localGeometryUrl,/);
  assert.match(initBody, /caseId:\s*String\(config\.caseId\s*\|\|\s*caseData\.case_id/);
  assert.match(initBody, /chainId:\s*String\(/);
  assert.doesNotMatch(initBody, /residueKeys\s*:/);
  assert.match(initBody, /const lociByResidueKey\s*=\s*new Map\(\)/);
  assert.match(initBody, /linkedView\.structureContexts\.loci/);
  assert.match(initBody, /residues:\s*linkedView\.residueIndex\.residues\.map\(\(residue\)\s*=>/);
  assert.match(initBody, /position:\s*residue\.labelSeqId/);
  assert.match(initBody, /base:\s*residue\.parentBase\s*\?\?\s*residue\.base/,
    'validation context must preserve parent-base identity for modified nucleotides');
  assert.match(initBody, /labelAsymId:\s*locator\.label_asym_id/);
  assert.match(initBody, /authAsymId:\s*locator\.auth_asym_id/);
  assert.match(initBody, /labelSeqId:\s*locator\.label_seq_id/);
  assert.match(initBody, /authSeqId:\s*locator\.auth_seq_id/);
  assert.match(initBody, /insertionCode:\s*locator\.pdbx_PDB_ins_code\s*\?\?\s*["']{2}/);
  assert.match(initBody, /componentId:\s*residue\.compId/);
  assert.match(initBody, /localGeometryResult[\s\S]*?=\s*await Promise\.all\(\[/);
  assert.match(initBody, /state\.localGeometryStatus\s*=\s*localGeometryResult\.status/);
  assert.match(initBody, /state\.localGeometryModel\s*=\s*localGeometryResult\.model/);
  assert.match(initBody, /state\.localGeometryError\s*=\s*localGeometryResult\.error/);
});

test('optional local-geometry loader distinguishes absence from invalid data and validates payload identity', async () => {
  const start = workbench.indexOf('async function loadOptionalLocalGeometry(');
  const end = workbench.indexOf('\nconst cachedShardLoad =', start);
  assert.ok(start >= 0 && end > start, 'missing optional local-geometry loader');
  const loaderSource = workbench.slice(start, end);

  function createLoader(fetchImpl, validateImpl) {
    const context = {
      module: { exports: {} },
      fetch: fetchImpl,
      decodeGzipArrayBuffer: async (buffer) => buffer,
      validateLocalGeometrySidecar: validateImpl,
      TextDecoder,
    };
    vm.runInNewContext(`${loaderSource}\nmodule.exports.loadOptionalLocalGeometry = loadOptionalLocalGeometry;`, context);
    return context.module.exports.loadOptionalLocalGeometry;
  }

  function response(status, payload = null) {
    const bytes = new TextEncoder().encode(payload === null ? '' : JSON.stringify(payload));
    return {
      status,
      ok: status >= 200 && status < 300,
      async arrayBuffer() { return bytes.buffer; },
    };
  }

  for (const status of [404, 410]) {
    const load = createLoader(async () => response(status), () => {
      throw new Error('absence must not reach the validator');
    });
    const result = await load('/linked-view/local-geometry.json.gz', Promise.resolve({}));
    assert.equal(result.status, 'unavailable');
    assert.equal(result.model, null);
    assert.equal(result.error, null);
  }

  for (const [label, fetchImpl] of [
    ['HTTP failure', async () => response(500)],
    ['fetch failure', async () => { throw new Error('network interrupted'); }],
    ['invalid JSON', async () => ({ ...response(200), async arrayBuffer() {
      return new TextEncoder().encode('{broken').buffer;
    } })],
  ]) {
    const result = await createLoader(fetchImpl, () => ({ forged: true }))(
      '/linked-view/local-geometry.json.gz',
      Promise.resolve({}),
    );
    assert.equal(result.status, 'invalid', label);
    assert.equal(result.model, null, label);
    assert.match(result.error, /HTTP 500|network interrupted|JSON|Unexpected|property name/i, label);
  }

  const payload = { schemaVersion: 'foldbridge-local-geometry.v1' };
  const strictContext = {
    caseId: 'case-1ABC',
    chainId: 'A',
    residues: [{
      residueKey: 'case-1ABC|A|1',
      position: 1,
      base: 'G',
      locator: {
        labelAsymId: 'A',
        authAsymId: 'A',
        labelSeqId: 1,
        authSeqId: 1,
        insertionCode: '',
        componentId: 'G',
      },
    }],
  };
  const validatedModel = { schemaVersion: 'foldbridge-local-geometry.v1', byResidueKey: new Map() };
  let validatorCall = null;
  const load = createLoader(async () => response(200, payload), (receivedPayload, receivedContext) => {
    validatorCall = { receivedPayload, receivedContext };
    return validatedModel;
  });
  const available = await load('/linked-view/local-geometry.json.gz', Promise.resolve(strictContext));
  assert.equal(available.status, 'available');
  assert.equal(available.model, validatedModel);
  assert.equal(available.error, null);
  assert.equal(JSON.stringify(validatorCall.receivedPayload), JSON.stringify(payload));
  assert.deepEqual(validatorCall.receivedContext, strictContext);

  const rejected = await createLoader(async () => response(200, payload), () => {
    throw new Error('chainId must exactly match context');
  })('/linked-view/local-geometry.json.gz', Promise.resolve(strictContext));
  assert.equal(rejected.status, 'invalid');
  assert.match(rejected.error, /chainId must exactly match context/);
});

test('Residue Inspector uses the compact A+B structure and keeps internal keys out of its default view', () => {
  const details = between(workbench, 'function getResidueDetails(', '\nfunction showTip(');
  const inspector = between(workbench, 'function renderInspector(', '\nfunction activeResidues(');

  assert.match(details, /localGeometryModel\?\.byResidueKey\.get\(residueKey\)/);
  assert.match(details, /baseMismatch/);
  assert.match(inspector, /inspector-residue-heading/);
  assert.match(inspector, /coordinate-status/);
  assert.match(inspector, /class="annotation-source-summary"[^>]*aria-label="Annotation sources"/);
  assert.match(inspector, /<strong>Pairing:<\/strong>\s*RNAView\s*<span[^>]*>\(via RNApdbee\)<\/span>/);
  assert.doesNotMatch(inspector, /<strong>Pairing:<\/strong>\s*RNAView\s+2\.0/,
    'the materialized Case 2D asset does not certify an RNAView executable version');
  assert.match(inspector, /<strong>Local geometry:<\/strong>\s*DSSR/);
  assert.doesNotMatch(inspector, /MC[- ]Annotate|analysisTool|annotation-method-select/,
    'the minimal A+B design must not add an annotation-engine switch');
  assert.match(inspector, /Profile base[\s\S]*differs from PDB polymer base/);
  assert.match(inspector, /<h3>Local context<\/h3>/);
  assert.match(inspector, /buildLocalGeometryWindow\(state\.localGeometryModel,\s*details\.residueKey\)/);
  for (const heading of ['Reactivity', 'Local geometry', 'Interactions']) {
    assert.match(inspector, new RegExp(`<h3>${heading}</h3>`));
  }
  assert.match(inspector, /Raw/);
  assert.match(inspector, /Normalized/);
  assert.match(inspector, /assay target/i);
  assert.match(inspector, /not[_ -]computable/i);
  assert.match(inspector, /No DSSR stacking partners/);
  assert.match(inspector, /Geometry annotations unavailable for this chain/);
  assert.match(inspector, /Geometry annotations invalid/);
  assert.match(inspector, /<details[^>]*class="annotation-details"/);
  assert.match(inspector, /<summary>Annotation details<\/summary>/);
  for (const provenance of [
    'toolVersion', 'containerImageId', 'modelPolicy', 'altlocPolicy',
    'structureSha256', 'dssrInputSha256', 'coordinateCoverage', 'structureLocus',
  ]) {
    assert.match(inspector, new RegExp(`details\\.${provenance}|source\\.${provenance}`), provenance);
  }
  for (const retiredLabel of [
    'Bridge membership', 'Interaction endpoint', 'Observed mask', 'Join status',
    'Join key', 'LSS context', 'FEC/LSS', 'ANNOCONFIDENCE', 'Profile join confidence',
  ]) {
    assert.doesNotMatch(inspector, new RegExp(`<dt>${retiredLabel}`, 'i'), retiredLabel);
  }
  assert.doesNotMatch(details, /bridgeKey|interactionKey|joinKey|sourceRecordKey|annoconfidence|profileJoinConfidence/i);
});

test('Inspector secondary-structure copy is independent from transient selected visual state', () => {
  const details = between(workbench, 'function getResidueDetails(', '\nfunction showTip(');
  assert.match(details, /const structureState\s*=\s*secondaryStructureStateForPosition\(position,\s*strand\)/);
  assert.doesNotMatch(details, /const structureState\s*=\s*visualStateForResidue\(/);
});

test('Annotation details include the exact DSSR command provenance', () => {
  const inspector = between(workbench, 'function renderInspector(', '\nfunction activeResidues(');
  assert.match(inspector, /<dt>DSSR command<\/dt><dd>\$\{escapeHtml\(source\.command\)\}<\/dd>/);
});

test('Annotation details prefer the complete validated sidecar locator and label linked-only fallback as limited', () => {
  const details = between(workbench, 'function getResidueDetails(', '\nfunction showTip(');
  const inspector = between(workbench, 'function renderInspector(', '\nfunction activeResidues(');

  assert.match(details, /localGeometryLocator:\s*localGeometry\?\.locator\s*\|\|\s*null/);
  assert.match(inspector, /details\.localGeometryLocator/);
  for (const field of [
    'modelId', 'labelAsymId', 'authAsymId', 'labelSeqId',
    'authSeqId', 'insertionCode', 'componentId',
  ]) {
    assert.match(inspector, new RegExp(`localGeometryLocator\\.${field}`), field);
  }
  assert.match(inspector, /Validated sidecar locator/);
  assert.match(inspector, /Legacy\/limited linked locator/);
  assert.match(inspector, /full model and component identity unavailable/i);
});

test('Local context navigation uses native buttons, exposes selection states, and keeps cross-chain partners read-only', () => {
  const inspector = between(workbench, 'function renderInspector(', '\nfunction activeResidues(');
  const listeners = workbench.slice(workbench.indexOf('el.select.addEventListener("change"'));

  assert.match(inspector, /<button[^>]*class="local-context-residue/);
  assert.match(inspector, /data-residue-key=/);
  assert.match(inspector, /aria-current=/);
  assert.match(inspector, /stacking partner/i);
  assert.match(inspector, /sameChainOutsideWindowPartners/);
  assert.match(inspector, /class="local-geometry-jump"/);
  assert.match(inspector, /crossChainPartners[\s\S]*?<span[^>]*class="cross-chain-partner"/);
  assert.doesNotMatch(
    inspector.match(/const crossChainPartnerMarkup[\s\S]*?;\n/)?.[0] || '',
    /button|data-residue-key/,
  );

  assert.match(listeners, /el\.inspector\?\.addEventListener\(["']click["']/);
  assert.match(listeners, /event\.target\?\.closest\?\.\(["']button\[data-residue-key\]["']\)/);
  assert.match(listeners, /state\.residueByKey\.get\(residueKey\)/);
  assert.match(listeners, /residue\.chainKey\s*!==\s*activeChainKey\(\)/);
  assert.match(listeners, /applyLinkedSelection\(residueKey,\s*["']inspector["']\)/);
  assert.doesNotMatch(listeners, /el\.inspector[\s\S]*?selectResidue\(residueKey/);
  assert.doesNotMatch(listeners, /el\.inspector\?\.addEventListener\(["']key(?:down|up|press)["']/);
});

test('Local geometry Inspector CSS is compact, scrollable, responsive, and scoped away from E/F mode', () => {
  assert.match(css, /\.workbench-shell:not\(\.is-ef-mode\) \.annotation-source-summary\s*\{/);
  assert.match(css, /\.workbench-shell:not\(\.is-ef-mode\) \.local-context-rail\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.workbench-shell:not\(\.is-ef-mode\) \.local-context-residue\.is-selected/);
  assert.match(css, /\.workbench-shell:not\(\.is-ef-mode\) \.local-context-residue\.is-stacking-partner/);
  assert.match(css, /\.workbench-shell:not\(\.is-ef-mode\) \.is-not-computable/);
  assert.match(css, /\.workbench-shell:not\(\.is-ef-mode\) \.geometry-status\.is-invalid/);
  assert.match(css, /\.local-context-residue:focus-visible/);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*?\.inspector-groups/);
  assert.ok(css.indexOf('.workbench-shell:not(.is-ef-mode) .local-context-rail')
    < css.indexOf('.workbench-shell.is-ef-mode .controls[hidden]'),
  'ordinary Inspector additions must precede and preserve the existing E/F cascade');
});
