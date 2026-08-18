# ANNOJOIN 2D 浏览器计算阶段记录（2026-06-18）

## 结论

当前 5GAG smoke 采用以下边界：

- RNApdbee / DBN / 2D layout：预计算，作为静态结构资产发布。
- profile raw values：不再以内联 verbose JSON 交付，改为 `profile_index + compressed Float32 shard` 静态资产。
- P95 cap / yellow-to-red color map / 2D recolor / 1D plot / table filter：在用户浏览器中计算。

这个边界同时满足两个目标：上游保留可复现的 DBN/layout 预计算结果，下游把随 profile 切换频繁发生的归一化、染色和过滤计算转移到浏览器，避免为每条 profile 预绘制一套 SVG/PNG。

## 当前资产

目录：

`task_packages/confidence_v3_restart_20260613/remote_root/ANNOJOIN/2d_browser_smoke_5gag_20260618/`

关键文件：

- `index.html`：浏览器 smoke 入口，加载结构 JSON、profile index 和 gzip Float32 shard。
- `assets/case_2d_structure_5gag.json`：预计算 2D 结构/layout 资产。
- `assets/profile_index_5gag_reference_mapped.json`：profile 元数据索引，记录 profile 到 shard 行的映射。
- `assets/profile_shard_000000_meta.json`：shard 元信息。
- `assets/profile_shard_000000_f32.bin.gz`：压缩后的 Float32 raw value shard。
- `assets/profile_shard_000000_f32.bin`：未压缩 Float32 shard，用于兼容 fallback 和验证。
- `assets/varna_5gag_strand_1_template.svg`：VARNA 生成的 5GAG strand_1 SVG 布局模板；浏览器只改 base 颜色，不生成二级结构布局。
- `assets/profile_reactivity_5gag_reference_mapped.json`：旧 verbose JSON，对照保留，不作为新浏览器路径的主资产。
- `http_static_load_benchmark.json`：本地静态 HTTP fetch 检查结果。
- `playwright_browser_smoke_benchmark.json`：Docker `mcp/playwright` 真实 Chromium smoke 结果。
- `playwright_5173_tabbed_smoke_benchmark.json`：FoldBridge `5173` 预览路径上的双 tab Chromium smoke 结果。
- `annojoin_5gag_playwright_smoke.png`：真实 Chromium full-page screenshot。

## 染色规则

当前 smoke 使用 profile 内正值分布计算 P95 cap：

- `missing / unmapped / NaN / value <= 0` -> white
- `value > 0` -> `norm = min(value / p95_positive_cap, 1.0)`
- `norm` 映射 yellow -> red

P95 在浏览器端按当前选中 profile 的正值分布实时计算。这样不同 profile 的动态范围不会互相污染，也避免把上色结果固化成不可复用图片。

## 5GAG smoke 实测

当前测试对象：

- `case_id`: `5GAG`
- 渲染链：`strand_1`
- 渲染长度：113
- profile 数：27

结构 JSON 中仍包含多链：

- `strand_1`: length 113, pair_count 13
- `strand_2`: length 3, pair_count 0
- `strand_A`: length 2903, pair_count 804
- `strand_B`: length 120, pair_count 36

本 smoke 只把 27 条 mapped profile 渲染到 `strand_1`。生产路径必须显式维护 `profile -> strand_id -> aligned coordinate`，不能把未映射或其它链 profile fallback 到错误链上。

## 体积结果

来自 `asset_size_report.json`：

- verbose profile JSON：754,658 bytes
- compact profile index + shard meta + gzip shard：19,949 bytes
- verbose / compact：37.829x
- Float32 shard raw：12,204 bytes
- Float32 shard gzip：7,428 bytes
- raw / gzip：1.643x

结论：profile raw values 的压缩分片收益明确。当前结构/layout JSON 仍为 59,239 bytes，后续也可以进入同样的静态压缩交付路径。

## 解码与计算结果

来自 `typed_array_shard_benchmark.json`：

- profile_count：27
- strand_length：113
- gzip_bytes：7,428
- decode_and_check_ms：1.75
- first_profile_cap：9.54800009727478
- first_profile_white_count：57
- first_profile_capped_count：3

来自 `browser_compute_benchmark.json` 的 Node 端模拟浏览器计算：

- shard_decode_ms：0.455
- total_ms：5.499
- mean_ms_per_profile：0.204
- generated_svg_bytes：384,507
- first_profile mappedCount：113
- first_profile positiveCount：56
- first_profile whiteCount：57
- first_profile unmappedCount：3
- first_profile cappedCount：3

这些数字说明当前 5GAG 规模下，把 P95、染色和 SVG recolor 放到浏览器端没有明显计算压力。后续需要用更长链和更多 profile 的 case 做压力测试，尤其关注首屏 index 加载、按需 shard 加载、profile 切换延迟和内存峰值。

## 静态加载检查

使用 `python3 -m http.server 8765 --bind 127.0.0.1` 服务当前 smoke 目录，并用 `curl` 检查关键资产：

- `index.html`: HTTP 200, 14,241 bytes, 0.102709 s
- `assets/profile_index_5gag_reference_mapped.json`: HTTP 200, 12,174 bytes, 0.002643 s
- `assets/profile_shard_000000_meta.json`: HTTP 200, 347 bytes, 0.001737 s
- `assets/profile_shard_000000_f32.bin.gz`: HTTP 200, 7,428 bytes, 0.002794 s

注意：这一步验证的是静态 HTTP fetch 路径和资产大小，不等同于真实浏览器渲染耗时。真实浏览器渲染结果见下一节。

## Playwright MCP 真实浏览器 smoke

使用 Docker 镜像 `mcp/playwright:latest` 启动 MCP Playwright server，容器内 Chromium 访问：

`http://host.docker.internal:8765/index.html`

页面关键结果：

- title：`5GAG Browser 2D Smoke`
- profile options：27
- status：`loaded profile index for 27 profiles in 11.3 ms`
- `DecompressionStream`：available
- shard decode mode：`gzip`
- shard gzip bytes：7,428
- shard raw bytes：12,204
- SVG present：true
- SVG size：1576 x 420
- circle count：113
- white count：57
- colored count：56
- yellow present：true
- red present：true
- P95 cap：9.54800009727478
- first profile render ms：13.8

页面内 `Benchmark all profiles` 结果：

- benchmark_profiles：27
- total_ms：6.2
- mean_ms_per_profile：0.23
- generated_svg_bytes：639,063

网络请求只包含新 compact 路径：

- `index.html`
- `assets/case_2d_structure_5gag.json`
- `assets/profile_index_5gag_reference_mapped.json`
- `assets/profile_shard_000000_meta.json`
- `assets/profile_shard_000000_f32.bin.gz`

没有加载旧 `assets/profile_reactivity_5gag_reference_mapped.json`。Console 只有 `favicon.ico` 404，与数据路径无关。

## FoldBridge 5173 双视图预览

当前 smoke 包已挂载到 FoldBridge dev server：

`http://127.0.0.1:5173/annojoin-smoke/5gag/index.html`

页面展示口径已调整为两个 tab：

- `VARNA stem-loop`：默认视图，使用 VARNA 预计算 SVG 布局；浏览器只基于当前 profile 的 P95 结果重写 VARNA base circle 的 fill。
- `Linear / debug`：调试视图，保留原来的线性序列 + base-pair arc，便于检查 position、mapping、missing 和颜色分配。

主操作区去掉 `Render` 按钮；选择 profile 后自动刷新。性能测试按钮从主操作区移入 `Debug and performance details`，文案改为 `Run profile benchmark`。

Docker `mcp/playwright:latest` 真实 Chromium 对 5173 路径的检查结果：

- 默认 active tab：`VARNA stem-loop`
- `VARNA stem-loop` 可见，`Linear / debug` 默认隐藏
- profile options：27
- shard decode mode：`gzip`
- Render button：not present
- debug benchmark label：`Run profile benchmark`
- VARNA base color counts：57 white, 56 colored
- 切换 `Linear / debug` 后 linear SVG present
- profile 下拉切到第二条后自动刷新到 `5GAG:sequence_000011`

重要修正：这里不能使用自绘 stem-loop 近似布局替代 VARNA。浏览器端只负责解码 profile shard、计算 P95、把颜色写回 VARNA SVG 的 base fill；layout 必须来自 VARNA 预计算资产。

## VARNA fit gate

进入全量 2D 资产制备前，先用 5GAG 预览页建立显示 gate：

- VARNA SVG 必须在 `fit-to-container` viewport 内完整显示，不允许主页面横向 overflow。
- VARNA layout 不因 profile 切换而变化；profile 切换只改 base fill。
- 长 `pair_id` / `profile_id` 不写入主图，不挤压主图；页面外部元信息栏负责显示并用 ellipsis 截断。
- `Linear / debug` 只作为调试视图，不影响 VARNA 主视图。
- desktop 和 mobile viewport 都必须通过 Playwright 检查。

当前实现：

- `#varnaViewer` 内部使用 `#varnaViewport` 作为固定 fit 容器。
- VARNA SVG 设置 `viewBox` 和 `preserveAspectRatio="xMidYMid meet"`。
- `.varna-frame svg` 取消 `min-width: 980px`，宽高由 fit viewport 控制。
- stats、tabs、legend 和 profile 元信息改为响应式布局，避免窄屏撑宽。

Docker `mcp/playwright:latest` 对 5173 预览路径的 gate 结果：

- desktop `1280x800`: documentScrollWidth 1280, bodyHorizontalOverflow 0, VARNA viewport 1240 px, VARNA SVG 1238 px。
- mobile `390x844`: documentScrollWidth 390, bodyHorizontalOverflow 0, VARNA viewport 350 px, VARNA SVG 348 px。
- mobile profile id 使用截断盒：clientWidth 303, scrollWidth 307。

结论：5GAG 的 VARNA 主视图 fit gate 已通过，可以开始全量 2D 静态资产制备；全量制备仍按“VARNA layout 模板 + compressed profile shards + browser recolor”边界推进，不生成每条 profile 的预渲染 SVG/PNG。

## Full 2D asset build start

已启动全量 2D 资产制备入口：

`task_packages/confidence_v3_restart_20260613/remote_root/ANNOJOIN/2d_asset_build_20260618/`

已生成：

- `prepare_2d_asset_inventory.py`
- `annojoin_2d_asset_inventory.tsv`
- `annojoin_2d_asset_inventory.json`
- `ANNOJOIN_FULL_2D_ASSET_BUILD_START_20260618.md`

第一版 inventory 结果：

- case_count：2
- profile_count：3,138
- browser_candidate_profile_count：181
- ready_case_count：1
- needs_rnapdbee_dbn_count：1
- needs_varna_template_count：0

当前队列：

- `5GAG`：`ready_for_profile_shards`，已有 DBN 和 VARNA 模板，27 条 browser-candidate profile。
- `9BZ1`：`run_rnapdbee_dbn`，154 条 browser-candidate profile，但还没有 DBN/VARNA 模板；本地 CIF 输入位于 `10_structure_context/alpha_full_20260615/mmcif_inputs_from_132/9bz1.cif`。

## 浏览器加载策略

当前 smoke 的浏览器路径：

1. 先加载 `case_2d_structure_5gag.json` 和 `profile_index_5gag_reference_mapped.json`。
2. 根据 index 找到 shard。
3. 优先 fetch `profile_shard_000000_f32.bin.gz`。
4. 浏览器支持 `DecompressionStream("gzip")` 时直接解压。
5. 不支持时 fallback 到未压缩 `.bin`。
6. 用 `Float32Array` 按 `row_index * strand_length` slice 当前 profile。
7. 在浏览器端计算 P95、颜色、SVG recolor，并复用同一 typed array 支持后续 1D plot 和 per-base table。

生产发布时建议预生成 `.br` 和 `.gz`，由静态服务器/CDN 做 content negotiation；如果目标部署环境无法正确配置压缩头，则继续保留显式 `.gz` URL 和浏览器端解压路径。

## 后续生产化要求

- 分片粒度：按 case / strand / profile block 分片，避免单个大 profile 资产阻塞首屏。
- 懒加载：case 列表和详情页只加载 index；用户选择 profile、打开 2D/1D/table 面板时再加载 shard。
- 多 profile：index 必须记录 `profile_id`、`pair_id`、`source_id`、`strand_id`、`row_index`、`length`、`shard_id`、value dtype、missing 语义。
- 多链：结构资产和 profile 资产必须用 `strand_id` 显式 join；无匹配链、长度不一致或全部 unmapped 时应显示空态/告警，不应渲染到默认链。
- 复用计算：同一 decoded typed array 应同时服务 2D recolor、1D reactivity plot、per-base table、hover tooltip 和当前视图导出。
- 缓存：按 shard URL + content hash 缓存 decoded ArrayBuffer；切 profile 时只做 slice 和 P95/color recompute。
- 兼容性：浏览器 gzip decode 依赖 `DecompressionStream`；需要保留 raw shard fallback 或构建期提供可由服务器自动解压的静态压缩资产。
