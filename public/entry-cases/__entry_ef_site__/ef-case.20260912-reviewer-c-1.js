// ef-case.js — 共享三视图 host（EF 2D 自包含 case 详情页）
// 职责：读 data-case/data-chain → 拼 bundle 路径 → 并行加载
//   browser-manifest.json + ef-matrix.json.gz(gzip) + varna-template.svg + structure.cif
//   → 装配三面板(#ef-heatmap-host / #varna-host / #molstar-host)
//   → init pdbe-molstar → 调 window.createEfHeatmap 令三视图联动。
// fail-loud 贯穿：任何加载/依赖缺失都显式在页面报错，绝不静默空渲染。
// 纯逻辑在 window.EfHeatmapCore / window.createEfHeatmap（本文件不重复实现）。
"use strict";
(function () {
  const HOST_IDS = {
    sequence: "ef-sequence-host",
    heatmap: "ef-heatmap-host",
    varna: "varna-host",
    molstar: "molstar-host",
  };
  const PDBE_CSS = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar.css";
  const PDBE_JS = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar-plugin.js";
  const MOLSTAR_READY_TIMEOUT_MS = 6000;
  const BOOTSTRAP_CONFIG_KEY = "__FOLDBRIDGE_EF_CASE_CONFIG__";

  // A manifest may be loaded by a standalone case-root page or by a V3 chain
  // page.  It is the single authority for the case root; document depth is not.
  function resolveManifestUrl(explicitManifestUrl, documentUrl) {
    return new URL(explicitManifestUrl || "browser-manifest.json", documentUrl).href;
  }

  function resolveCaseAssetUrl(manifestUrl, assetPath) {
    return new URL(assetPath, new URL("./", manifestUrl)).href;
  }

  function resolveStructurePath(manifest, chain, chainId) {
    if (chain?.structurePath) {
      return requirePath(chain.structurePath, `chains.${chainId}.structurePath`);
    }
    return requirePath(manifest.commonAssets?.structure, "commonAssets.structure");
  }

  // --- 加载器 ---------------------------------------------------------------
  async function fetchOk(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed ${res.status} ${res.statusText}: ${url}`);
    return res;
  }

  async function loadJson(url) {
    return (await fetchOk(url)).json();
  }

  async function loadTextMaybeGzip(url) {
    const response = await fetchOk(url);
    const parsedUrl = new URL(url, document.baseURI || window.location.href);
    if (!parsedUrl.pathname.endsWith(".gz")) return response.text();
    const gzipBuffer = await response.arrayBuffer();
    const rawBuffer = await decodeGzipArrayBuffer(gzipBuffer);
    return new TextDecoder().decode(rawBuffer);
  }

  async function decodeGzipArrayBuffer(buffer) {
    if (!("DecompressionStream" in window)) {
      throw new Error("gzip EF assets require browser DecompressionStream support");
    }
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).arrayBuffer();
  }

  async function loadGzipJson(url) {
    const gzipBuffer = await (await fetchOk(url)).arrayBuffer();
    const rawBuffer = await decodeGzipArrayBuffer(gzipBuffer);
    return JSON.parse(new TextDecoder().decode(rawBuffer));
  }

  async function loadJsonMaybeGzip(url) {
    const parsedUrl = new URL(url, document.baseURI || window.location.href);
    return parsedUrl.pathname.endsWith(".gz") ? loadGzipJson(parsedUrl.href) : loadJson(parsedUrl.href);
  }

  async function prepareStructureForMolstar(structureUrl) {
    const parsedUrl = new URL(structureUrl, document.baseURI || window.location.href);
    if (!parsedUrl.pathname.endsWith(".gz")) {
      return { url: parsedUrl.href, cleanup() {} };
    }

    // PDBe Molstar does not decode a raw application/gzip response before CIF
    // parsing. Expand the case's structure.cif.gz in-browser and give Molstar
    // a normal mmCIF Blob URL. The original case asset remains untouched.
    const gzipBuffer = await (await fetchOk(parsedUrl.href)).arrayBuffer();
    const rawBuffer = await decodeGzipArrayBuffer(gzipBuffer);
    const objectUrl = URL.createObjectURL(new Blob([rawBuffer], { type: "chemical/x-cif" }));
    return {
      url: objectUrl,
      cleanup() { URL.revokeObjectURL(objectUrl); },
    };
  }

  // --- pdbe-molstar CDN 幂等加载 --------------------------------------------
  async function loadPdbeMolstarAssets() {
    if (!document.getElementById("pdbe-molstar-css")) {
      const css = document.createElement("link");
      css.id = "pdbe-molstar-css";
      css.rel = "stylesheet";
      css.href = PDBE_CSS;
      document.head.appendChild(css);
    }
    if (!window.PDBeMolstarPlugin) {
      await new Promise((resolve, reject) => {
        const existing = document.getElementById("pdbe-molstar-script");
        if (existing) {
          existing.addEventListener("load", resolve);
          existing.addEventListener("error", reject);
          return;
        }
        const script = document.createElement("script");
        script.id = "pdbe-molstar-script";
        script.src = PDBE_JS;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`failed to load pdbe-molstar from ${PDBE_JS}`));
        document.head.appendChild(script);
      });
    }
    if (!window.PDBeMolstarPlugin) {
      throw new Error("PDBeMolstarPlugin unavailable after CDN load (full-3d 三视图联动无退路)");
    }
  }

  // --- molstar viewer init + ready 时序 -------------------------------------
  // PDBeMolstarPlugin 实例构造后 .visual 立即存在，但 model 异步 parse——在
  // loadComplete 之前 select/highlight 会静默落空。故等 loadComplete（带超时 reject
  // 兜底）再把 plugin 交给 createEfHeatmap，保证首帧 select 路径可用。
  async function initMolstarViewer(molstarHost, structureCifUrl) {
    await loadPdbeMolstarAssets();
    const viewer = new window.PDBeMolstarPlugin();
    if (!viewer.visual) {
      throw new Error("PDBeMolstarPlugin instance missing .visual (三视图联动无退路)");
    }
    const preparedStructure = await prepareStructureForMolstar(structureCifUrl);
    // NO-fallback：结构加载失败/超时必须 reject → 交回无 model 的空 plugin 是禁止的。
    // done 幂等锁保证只 settle 一次。三条退出路径：
    //   (1) loadComplete(ok=true) → resolve（真正就绪）
    //   (2) loadComplete(ok=false) → reject（明确加载失败，不等 timer 掩盖）
    //   (3) render() promise reject → reject（CIF 404 / parse 失败）
    //   (4) timer 到期未见 loadComplete → reject（无法确认 model ready，首帧 select 会落空）
    try {
      await new Promise((resolve, reject) => {
        let done = false;
        const settle = (fn, arg) => { if (!done) { done = true; fn(arg); } };
        if (viewer.events?.loadComplete?.subscribe) {
          viewer.events.loadComplete.subscribe((ok) => {
            if (ok) settle(resolve);
            else settle(reject, new Error(`molstar 结构加载失败（loadComplete=false）: ${structureCifUrl}`));
          });
        }
        const rendered = viewer.render(molstarHost, {
          customData: { url: preparedStructure.url, format: "cif" },
          expanded: false,
          hideControls: true,
          bgColor: { r: 255, g: 255, b: 255 },
        });
        if (rendered && typeof rendered.catch === "function") {
          rendered.catch((err) => settle(reject, new Error(`molstar render 失败: ${structureCifUrl}: ${err && err.message ? err.message : err}`)));
        }
        window.setTimeout(
          () => settle(reject, new Error(`molstar 结构加载超时（${MOLSTAR_READY_TIMEOUT_MS}ms 未见 loadComplete）: ${structureCifUrl}`)),
          MOLSTAR_READY_TIMEOUT_MS
        );
      });
      return viewer;
    } finally {
      preparedStructure.cleanup();
    }
  }

  // --- VARNA 注入 -----------------------------------------------------------
  // 组件 recolorVarna 假设 varnaHost 里已有 <svg>（按 matrix_index 索引
  // circle[stroke="none"][r="5.0"]），故必须先注入 template SVG 再调 createEfHeatmap。
  // VARNA template 无 viewBox（width/height=100%）→ 从内容 bbox 推导，否则 svg 不可见。
  function injectVarnaTemplate(varnaHost, templateText) {
    const doc = new DOMParser().parseFromString(templateText, "image/svg+xml");
    const svg = doc.documentElement;
    if (!svg || svg.nodeName === "parsererror" || svg.querySelector("parsererror")) {
      throw new Error("failed to parse varna-template.svg");
    }
    svg.setAttribute("data-view", "varna");
    svg.style.width = "100%";
    svg.style.height = "100%";
    if (!svg.getAttribute("viewBox")) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const num = (node, name) => {
        const v = parseFloat(node.getAttribute(name));
        return Number.isFinite(v) ? v : null;
      };
      svg.querySelectorAll("*").forEach((node) => {
        const xs = [];
        const ys = [];
        for (const name of ["x", "x1", "x2", "cx"]) { const v = num(node, name); if (v !== null) xs.push(v); }
        for (const name of ["y", "y1", "y2", "cy"]) { const v = num(node, name); if (v !== null) ys.push(v); }
        const x0 = num(node, "x"), y0 = num(node, "y"), w = num(node, "width"), h = num(node, "height");
        if (x0 !== null && w !== null) xs.push(x0 + w);
        if (y0 !== null && h !== null) ys.push(y0 + h);
        for (const v of xs) { if (v < minX) minX = v; if (v > maxX) maxX = v; }
        for (const v of ys) { if (v < minY) minY = v; if (v > maxY) maxY = v; }
      });
      if (Number.isFinite(minX) && Number.isFinite(minY) && maxX > minX && maxY > minY) {
        const pad = 10;
        svg.setAttribute("viewBox", `${minX - pad} ${minY - pad} ${(maxX - minX) + pad * 2} ${(maxY - minY) + pad * 2}`);
      } else {
        svg.setAttribute("viewBox", "0 0 1270 355");
      }
    }
    varnaHost.innerHTML = "";
    varnaHost.appendChild(document.importNode(svg, true));
  }

  // --- 路径解析（manifest 路径均相对 case 根 = index.html 同级） --------------
  function resolveChain(manifest, requestedChain) {
    const chains = manifest.chains || {};
    const chainId = requestedChain || manifest.defaultChainId;
    if (!chainId) throw new Error("no chain requested and manifest has no defaultChainId");
    const chain = chains[chainId];
    if (!chain) {
      throw new Error(`chain ${chainId} not in manifest (have: ${Object.keys(chains).join(", ")})`);
    }
    return { chainId, chain };
  }

  function requirePath(value, label) {
    if (!value) throw new Error(`browser-manifest.json missing ${label}`);
    return value;
  }

  // 根据 family(E|F) 选 manifest 里对应的 2D 产物字段。family 缺/不认时回退:
  // 有 efMatrixPath 选 E;只有 efMatrixPathF 选 F(纯 MAPseq 案,如 8UYP/8UYS)。
  function pickEfMatrixField(chain, family, resolvedChain) {
    if (family === "F") return "efMatrixPathF";
    if (family === "E") return "efMatrixPath";
    if (!chain.efMatrixPath && chain.efMatrixPathF) return "efMatrixPathF";
    return "efMatrixPath";
  }

  // --- 装配 + 联动接线 ------------------------------------------------------
  // 可选交互：给热图 overlay 加点击→反算 (i,j)→用 i 轴触发 selectAxis，令
  // select 路径（molstar 整链重着色 + VARNA 重着色）可交互 smoke。组件只自绑 hover。
  function wireHeatmapClick(heatmapHost, controller) {
    const core = window.EfHeatmapCore;
    const header = controller && controller.viewHeader;
    if (!header || !Number.isInteger(header.n_rows) || !Number.isInteger(header.n_cols)) {
      throw new Error("heatmap controller missing rendered viewHeader");
    }
    const svg = heatmapHost.querySelector("svg");
    if (!svg) {
      // 组件应已注入 svg；缺失只降级掉可选点击交互（hover 仍在），告警不致命。
      // eslint-disable-next-line no-console
      console.warn("[ef-case] heatmap svg 未找到，跳过点击→selectAxis 接线");
      return;
    }
    svg.addEventListener("click", (evt) => {
      const box = svg.getBoundingClientRect();
      const { i } = core.cellFromXY(
        evt.clientX - box.left,
        evt.clientY - box.top,
        box.width,
        box.height,
        header
      );
      controller.selectAxis("i", i);
    });
  }

  function requireOptionHost(hosts, name) {
    const host = hosts && hosts[name];
    if (!host) throw new Error(`efCaseBootstrap missing hosts.${name}`);
    return host;
  }

  async function assemble(options) {
    const caseId = options?.caseId;
    const chainId = options?.chainId;
    const explicitManifestUrl = options?.manifestUrl;
    if (!caseId) throw new Error("efCaseBootstrap missing caseId");
    if (!chainId) throw new Error("efCaseBootstrap missing chainId");
    if (!explicitManifestUrl) throw new Error("efCaseBootstrap missing manifestUrl");
    const hosts = options?.hosts;
    const sequence = requireOptionHost(hosts, "sequence");
    const heatmap = requireOptionHost(hosts, "heatmap");
    const varna = requireOptionHost(hosts, "varna");
    const molstar = requireOptionHost(hosts, "molstar");
    requireOptionHost(hosts, "error");
    // caseId 并入所有 fail-loud 错误信息做上下文，便于 C1 逐 case smoke 定位是哪个 case。
    const ctx = caseId ? ` [case ${caseId}]` : "";
    try {
      const documentUrl = document.baseURI || window.location.href;
      const manifestUrl = resolveManifestUrl(explicitManifestUrl, documentUrl);
      const manifest = await loadJson(manifestUrl);
      const { chainId: resolvedChain, chain } = resolveChain(manifest, chainId);
      const family = options?.family === "E" || options?.family === "F" ? options.family : null;
      const efMatrixField = pickEfMatrixField(chain, family, resolvedChain);
      const efMatrixPath = requirePath(chain[efMatrixField], `chains.${resolvedChain}.${efMatrixField}`);
      const varnaTemplatePath = requirePath(chain.varnaTemplatePath, `chains.${resolvedChain}.varnaTemplatePath`);
      const case2dPath = requirePath(chain.case2dPath, `chains.${resolvedChain}.case2dPath`);
      const linkedViewBundlePath = requirePath(chain.linkedViewBundlePath, `chains.${resolvedChain}.linkedViewBundlePath`);
      const structurePath = resolveStructurePath(manifest, chain, resolvedChain);
      const efMatrixUrl = resolveCaseAssetUrl(manifestUrl, efMatrixPath);
      const varnaTemplateUrl = resolveCaseAssetUrl(manifestUrl, varnaTemplatePath);
      const case2dUrl = resolveCaseAssetUrl(manifestUrl, case2dPath);
      const linkedViewBundleUrl = resolveCaseAssetUrl(manifestUrl, linkedViewBundlePath);
      const structureUrl = resolveCaseAssetUrl(manifestUrl, structurePath);

      // Load every linked-data contract before mounting VARNA, Mol*, or the matrix.
      const [payload, varnaText, case2d, linkedView] = await Promise.all([
        loadJsonMaybeGzip(efMatrixUrl),
        loadTextMaybeGzip(varnaTemplateUrl),
        loadJsonMaybeGzip(case2dUrl),
        loadJsonMaybeGzip(linkedViewBundleUrl),
      ]);
      window.EfHeatmapCore.assertLinkedContract(payload, linkedView, case2d, { caseId, chainId: resolvedChain });

      // Rendering begins only after the linked coordinate contract has passed.
      injectVarnaTemplate(varna, varnaText);
      const viewer = await initMolstarViewer(molstar, structureUrl);

      // 组件内部自驱动 molstar + VARNA；缺 molstarPlugin.visual 即 fail-loud throw。
      const controller = window.createEfHeatmap({
        sequenceHost: sequence,
        heatmapHost: heatmap,
        varnaHost: varna,
        molstarHost: molstar,
        molstarPlugin: viewer,
        payload,
        residues: linkedView.residueIndex.residues,
        onInteraction: options.onInteraction,
      });

      return { manifest, manifestUrl, resolvedChain, controller };
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      throw new Error(`${msg}${ctx}`);
    }
  }

  // --- 错误显示（fail-loud，页面可见；内部诊断交由调用方记录） ---------------
  function showError(host) {
    if (host) {
      const pre = document.createElement("pre");
      pre.className = "ef-workbench-error";
      pre.textContent = "Case data could not be loaded.";
      host.replaceChildren(pre);
    }
  }

  function requireHost(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`missing host element #${id}`);
    return el;
  }

  // --- 引导：读 data-case/data-chain（root 元素或 <body>） -------------------
  function readDataset() {
    const root = document.querySelector("[data-case]") || document.body;
    return {
      caseId: root ? root.getAttribute("data-case") : null,
      chainId: root ? root.getAttribute("data-chain") : null,
    };
  }

  function legacyOptions() {
    const dataset = readDataset();
    const explicitConfig = window[BOOTSTRAP_CONFIG_KEY] || {};
    const heatmap = requireHost(HOST_IDS.heatmap);
    let sequence = document.getElementById(HOST_IDS.sequence);
    if (!sequence) {
      sequence = document.createElement("div");
      sequence.id = HOST_IDS.sequence;
      sequence.className = "ef-sequence-host";
      heatmap.parentNode?.insertBefore(sequence, heatmap);
    }
    return {
      caseId: explicitConfig.caseId || dataset.caseId,
      chainId: explicitConfig.chainId || dataset.chainId,
      manifestUrl: resolveManifestUrl(explicitConfig.manifestUrl || null, document.baseURI || window.location.href),
      hosts: {
        sequence,
        heatmap,
        varna: requireHost(HOST_IDS.varna),
        molstar: requireHost(HOST_IDS.molstar),
        error: heatmap,
      },
    };
  }

  async function bootstrap(options = null) {
    const resolvedOptions = options || legacyOptions();
    try {
      if (!window.EfHeatmapCore || !window.createEfHeatmap) {
        throw new Error("EfHeatmapCore / createEfHeatmap not loaded (引 ef-heatmap-core.js + ef-heatmap.js 于本脚本前)");
      }
      return await assemble(resolvedOptions);
    } catch (error) {
      showError(resolvedOptions?.hosts?.error || null);
      throw error;
    }
  }

  // 供 B3 html / C1 smoke 手动调用或调试。
  window.efCaseBootstrap = bootstrap;
  window.EfCaseInternals = Object.freeze({
    resolveManifestUrl,
    resolveCaseAssetUrl,
    resolveStructurePath,
    wireHeatmapClick,
  });

  const bootstrapConfig = window[BOOTSTRAP_CONFIG_KEY] || {};
  if (!bootstrapConfig.deferBootstrap) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { bootstrap().catch(() => {}); });
    } else {
      bootstrap().catch(() => {});
    }
  }
})();
