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
    heatmap: "ef-heatmap-host",
    varna: "varna-host",
    molstar: "molstar-host",
  };
  const PDBE_CSS = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar.css";
  const PDBE_JS = "https://cdn.jsdelivr.net/npm/pdbe-molstar@3.3.0/build/pdbe-molstar-plugin.js";
  const MOLSTAR_READY_TIMEOUT_MS = 6000;

  // --- 加载器 ---------------------------------------------------------------
  async function fetchOk(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed ${res.status} ${res.statusText}: ${url}`);
    return res;
  }

  async function loadJson(url) {
    return (await fetchOk(url)).json();
  }

  async function loadText(url) {
    return (await fetchOk(url)).text();
  }

  async function decodeGzipArrayBuffer(buffer) {
    if (!("DecompressionStream" in window)) {
      throw new Error("gzip ef-matrix requires browser DecompressionStream support");
    }
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).arrayBuffer();
  }

  async function loadGzipJson(url) {
    const gzipBuffer = await (await fetchOk(url)).arrayBuffer();
    const rawBuffer = await decodeGzipArrayBuffer(gzipBuffer);
    return JSON.parse(new TextDecoder().decode(rawBuffer));
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
    // NO-fallback：结构加载失败/超时必须 reject → 交回无 model 的空 plugin 是禁止的。
    // done 幂等锁保证只 settle 一次。三条退出路径：
    //   (1) loadComplete(ok=true) → resolve（真正就绪）
    //   (2) loadComplete(ok=false) → reject（明确加载失败，不等 timer 掩盖）
    //   (3) render() promise reject → reject（CIF 404 / parse 失败）
    //   (4) timer 到期未见 loadComplete → reject（无法确认 model ready，首帧 select 会落空）
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
        customData: { url: structureCifUrl, format: "cif" },
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

  // --- 装配 + 联动接线 ------------------------------------------------------
  // 可选交互：给热图 overlay 加点击→反算 (i,j)→用 i 轴触发 selectAxis，令
  // select 路径（molstar 整链重着色 + VARNA 重着色）可交互 smoke。组件只自绑 hover。
  function wireHeatmapClick(heatmapHost, controller, header) {
    const core = window.EfHeatmapCore;
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

  async function assemble(hosts, caseId, chainId) {
    const { heatmap, varna, molstar } = hosts;
    // caseId 并入所有 fail-loud 错误信息做上下文，便于 C1 逐 case smoke 定位是哪个 case。
    const ctx = caseId ? ` [case ${caseId}]` : "";
    try {
      const manifest = await loadJson("browser-manifest.json");
      const { chainId: resolvedChain, chain } = resolveChain(manifest, chainId);
      const efMatrixPath = requirePath(chain.efMatrixPath, `chains.${resolvedChain}.efMatrixPath`);
      const varnaTemplatePath = requirePath(chain.varnaTemplatePath, `chains.${resolvedChain}.varnaTemplatePath`);
      const structurePath = requirePath(manifest.commonAssets?.structure, "commonAssets.structure");

      // 并行加载：payload(gzip) + varna template text + molstar init(自 fetch cif)。
      const [payload, varnaText, viewer] = await Promise.all([
        loadGzipJson(efMatrixPath),
        loadText(varnaTemplatePath),
        initMolstarViewer(molstar, structurePath),
      ]);

      // 先注入 VARNA <svg>，组件 recolorVarna 才能 querySelector 到圈。
      injectVarnaTemplate(varna, varnaText);

      // 组件内部自驱动 molstar + VARNA；缺 molstarPlugin.visual 即 fail-loud throw。
      const controller = window.createEfHeatmap({
        heatmapHost: heatmap,
        varnaHost: varna,
        molstarPlugin: viewer,
        payload,
      });

      wireHeatmapClick(heatmap, controller, payload.header);
      return { manifest, resolvedChain, controller };
    } catch (error) {
      const msg = error && error.message ? error.message : String(error);
      throw new Error(`${msg}${ctx}`);
    }
  }

  // --- 错误显示（fail-loud，页面可见） --------------------------------------
  function showError(host, error) {
    const msg = error && error.message ? error.message : String(error);
    if (host) {
      host.innerHTML = `<pre style="color:#b00020;white-space:pre-wrap;padding:8px;">ef-case load failed:\n${msg}</pre>`;
    }
    // eslint-disable-next-line no-console
    console.error("[ef-case]", error);
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

  async function bootstrap() {
    let hosts = null;
    try {
      hosts = {
        heatmap: requireHost(HOST_IDS.heatmap),
        varna: requireHost(HOST_IDS.varna),
        molstar: requireHost(HOST_IDS.molstar),
      };
      if (!window.EfHeatmapCore || !window.createEfHeatmap) {
        throw new Error("EfHeatmapCore / createEfHeatmap not loaded (引 ef-heatmap-core.js + ef-heatmap.js 于本脚本前)");
      }
      const { caseId, chainId } = readDataset();
      await assemble(hosts, caseId, chainId);
    } catch (error) {
      showError(hosts && hosts.heatmap ? hosts.heatmap : document.body, error);
      throw error;
    }
  }

  // 供 B3 html / C1 smoke 手动调用或调试。
  window.efCaseBootstrap = bootstrap;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { bootstrap().catch(() => {}); });
  } else {
    bootstrap().catch(() => {});
  }
})();
