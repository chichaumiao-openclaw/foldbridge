# D3.3 局部几何 Inspector 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在普通 Case Workbench 的 Inspector 中，以最小界面改动展示 DSSR sugar-pucker 与 base-stacking 局部证据，并明确区分可用、未物化、不可计算和非法数据；现有 RNApdbee/RNAView 配对保持不变。

**架构：** 离线脚本把固定版本 DSSR JSON、mmCIF 身份和既有 linked-view residue index 汇合成每链 `local-geometry.json.gz`。浏览器并行加载 sidecar，经严格纯函数校验后，在既有 residue selection 上渲染最多 11 nt 的局部轨道和三组详情；配对继续读取既有 RNApdbee/RNAView 结果，DSSR 只补局部几何，两条注释不合并为共识。不在浏览器内计算几何，不改变 E/F 页面、现有 2D 资产或 Mol* 着色。当前 2D 资产没有 RNAView 工具版本字段，因此界面不推断版本号。

**技术栈：** Node.js ESM、浏览器原生 JavaScript/CSS、`node:test`、gzip JSON、DSSR v1.9.10。

---

## 任务 1：锁定 sidecar 与 Inspector 的纯函数契约

**文件：**
- 新建：`test/case-local-geometry.test.js`
- 修改：`public/entry-cases/__entry_v3_site__/workbench-pure.mjs`

- [x] 写失败测试，覆盖严格 schema、Case/Chain/残基全集对账、有限数值、pucker/stacking 独立状态、重复 partner 拒绝。
- [x] 写失败测试，覆盖以选中 residue 为中心的最多 11 nt 窗口、链端截断和窗口内/外 partner 分类。
- [x] 运行 `node --test test/case-local-geometry.test.js`，确认因缺少实现而失败。
- [x] 实现 `validateLocalGeometrySidecar()` 与 `buildLocalGeometryWindow()` 的最小代码。
- [x] 重跑目标测试，确认通过。

## 任务 2：实现可复现的 DSSR sidecar 构建器

**文件：**
- 新建：`test/local-geometry-sidecar-builder.test.js`
- 新建：`scripts/local-geometry-sidecar-lib.mjs`
- 新建：`scripts/build-local-geometry-sidecar.mjs`

- [x] 写失败测试，覆盖 `nts` pucker、`nonPairs[].stacking` pair、DSSR 原始 stack class、拓扑字段、跨链 partner、稳定排序。
- [x] 写失败测试，覆盖首个 atom-site model、altloc 保留、label/auth/ins-code/component 唯一映射，以及歧义时整链失败。
- [x] 写失败测试，覆盖“完整 mmCIF → 保留所有链但只保留首个 atom-site model、原样保留该 model 全部 altloc → DSSR 输入 mmCIF”和“该输入 + DSSR JSON → sidecar”的受控两阶段 CLI；记录并核对 DSSR 实际输入 SHA-256，跨链 nucleotide 不得在第一阶段被裁掉。
- [x] 写失败测试，覆盖相同输入生成字节稳定的 gzip JSON 和完整 provenance。
- [x] 运行构建器目标测试，确认失败原因符合预期。
- [x] 实现纯构建库与 CLI；无猜测映射、无缺值回退、无隐式零值。
- [x] 重跑构建器目标测试，确认通过。

## 任务 3：把 A+B Inspector 接入普通 Case

**文件：**
- 修改：`test/case-workbench-ui.test.js`
- 修改：`test/entry-case-embed.test.js`
- 修改：`public/entry-cases/__entry_v3_site__/workbench.js`
- 修改：`public/entry-cases/__entry_v3_site__/workbench.css`

- [x] 写失败测试，要求 sidecar 与既有资源并行加载，并严格区分 404 与非法 sidecar。
- [x] 写失败测试，要求标题合并 residue/coordinate/mismatch，详情只保留 `Reactivity`、`Local geometry`、`Interactions`，技术字段进入 `Annotation details`。
- [x] 写失败测试，要求 Inspector 固定标明 `Pairing: RNAView (via RNApdbee)` 与 `Local geometry: DSSR`，不得推断 RNAView 工具版本，且不存在注释工具切换器。
- [x] 写失败测试，要求局部轨道复用 `applyLinkedSelection()`，仅同链 residue 可点击；跨链 partner 只读。
- [x] 运行 UI 目标测试，确认红灯。
- [x] 接入 sidecar 状态、严格校验、局部轨道和事件委托；保证 sidecar 失败不阻断普通 Case。
- [x] 添加紧凑、响应式、键盘可访问的 Inspector 样式。
- [x] 运行源码级 UI 断言；此时只要求源文件满足契约，运行时指纹模块导入测试留到任务 4 闭包更新后通过。

## 任务 4：更新共享资产指纹闭包

**文件：**
- 修改：`scripts/version-ef-entry-assets.mjs`
- 修改：`tests/ef-asset-version.test.mjs`
- 生成：`public/entry-cases/__entry_v3_site__/*.<新版本>.*`
- 生成：`public/entry-cases/__entry_ef_site__/*.<新版本>.*`

- [x] 写失败断言，把版本从现有 D3.4 候选固定提升为联合版本 `20260913-reviewer-d33-d34-1`。
- [x] 运行版本测试，确认旧版本断言失败。
- [x] 更新版本常量并运行 `node scripts/version-ef-entry-assets.mjs` 生成完整闭包。
- [x] 直接 import `workbench-pure.20260913-reviewer-d33-d34-1.mjs`，确认新 geometry 导出真实存在。
- [x] 重跑版本、Case UI 和 E/F 回归测试；只有此时才把任务 3 的运行时 UI 契约标为通过。

## 任务 5：真实 1DDY/A 试跑与本地验收

**文件：**
- 生成到临时目录：`/private/tmp/foldbridge-d33-1ddy-a/`
- 视结果更新：`docs/reviewer-response/2026-09-12-d-class-scope-assessment.md`

- [x] 在 `/private/tmp/foldbridge-d33-1ddy-a/` 建 staging：复制普通 Case A 的只读生产页面/数据，覆盖为候选共享资产，并只在 staging 写入候选 sidecar；不写生产目录。
- [x] 通过受控第一阶段生成“首 model、保留所有链和全部 altloc”的 DSSR 输入，记录 SHA-256；在固定镜像运行 DSSR 后，由第二阶段验证该 SHA-256 并生成 1DDY/A sidecar。
- [x] 校验 sidecar schema、residue 全集、pucker 状态、stacking partner、来源 SHA-256 和稳定重建哈希。
- [x] 在 staging 启动本地静态服务，并准备互不覆盖的可用、404 未物化、非法 schema、residue 级 `not_computable`、`stacking.status=computed` 且 `partners=[]` 五个测试入口。
- [ ] 用浏览器逐项验证五种状态、同链窗口外 partner 跳转、跨链 partner 只读，以及既有 1D/2D/3D selection 仍联动；当前只完成真实 1DDY/A 可用状态。
- [x] 运行完整定向回归：`node --test test/case-workbench-pure.test.js test/case-local-geometry.test.js test/local-geometry-sidecar-builder.test.js test/case-workbench-ui.test.js test/entry-case-embed.test.js tests/ef-asset-version.test.mjs tests/ef-chain-view.test.mjs tests/ef-workbench-integration.test.mjs`，129/129 通过。
- [ ] 记录实际通过数、真实样本统计和仍未授权的生产发布边界。

## 任务 6：实现可恢复的全站批处理器

**文件：**
- 新建：`test/local-geometry-batch.test.js`
- 新建：`scripts/local-geometry-batch-lib.mjs`
- 新建：`scripts/build-local-geometry-batch.mjs`

- [x] 写失败测试：只从 `cases/<PDB>/structure.cif.gz` 和 `chains/<CHAIN>/linked-view/linked-view.json.gz` 建立大小写敏感、稳定排序的 PDB×Chain 清单；拒绝重复 Case/Chain、符号链接和输出逃逸。
- [x] 写失败测试：每个 PDB 只调用一次 DSSR，并将同一 DSSR JSON 严格构建为其全部 Chain sidecar；一个 Chain 的身份失败不能被记为成功。
- [x] 写失败测试：固定并核对容器镜像 ID、DSSR v1.9.10 与命令；只允许显式 allowlist 中的结构级不可计算项，其余失败使批次非零退出。
- [x] 写失败测试：每个 Case 写入带输入摘要和输出摘要的 receipt；`--resume` 仅在 receipt、输入摘要、参数和全部输出字节都一致时跳过，任何漂移都重新计算或失败。
- [x] 写失败测试：启动时即由当前大小写敏感清单原子写出每 PDB 状态；每次尝试持久化 `pending/running/computed/not_computable/failed`、失败阶段、稳定错误码、输入摘要和尝试次数。非零退出或中断后，状态文件仍覆盖完整初始清单，不能只在成功结束时才生成 ledger。
- [x] 实现批处理库和 CLI，支持有界并发、每 Case 临时目录、原子输出、逐 PDB 状态与确定性汇总 ledger；候选输出只包含 `local-geometry.json.gz`、receipts、状态和 ledger，不写生产树。
- [x] 运行 `node --test test/local-geometry-batch.test.js test/local-geometry-sidecar-builder.test.js`，确认 34/34 通过。

## 任务 7：在 10.40.0.132 完成全量候选

**远端隔离根：** `/data/sunhao/foldbridge-d33-full-20260913/`

- [x] 在远端隔离根创建独立 Node 22 运行时；不修改系统 Node，不覆盖现有环境。
- [x] 先从当前生产树生成大小写敏感、稳定排序的 source manifest，分母由该清单现场推导，不使用手册历史数量；清单记录每个 PDB 的 structure 与每个 PDB×Chain 的 linked-view 路径、大小和 SHA-256。
- [ ] 使用同一 source manifest 驱动 rsync，把清单中的 `structure.cif.gz` 和 `linked-view.json.gz` 只读复制到远端 input；以路径、数量、大小和 SHA-256 逐项验收。
- [x] 先运行代表样本（普通、多链、大结构、modified residue、缺 `_atom_site` 的 9A0D），确认输出、allowlist 和 resume 行为。样本清单为 6 Case/9 Chain：5 Case/7 Chain computed，9A0D 的 2 Chain 仅以 `PREPARE_NO_ATOM_SITE` 显式不可计算，0 failed；独立 verify 返回 true。样本同时验证 7UPH 的 U/PSU 等修饰身份、DSSR 斜杠编号和 8SQ9/P 的跨链核苷配体堆叠。
- [ ] 以镜像 `rnark-structure-tools:phase6b-rnaview2-dssr`、镜像 ID `sha256:f5ee5eb16e5638cbd81c16dc6e224feac392754349c8a3956a2941b9a351feaf`、DSSR v1.9.10 执行全量；每个 PDB 只运行一次 DSSR。
- [ ] 验收 ledger 恒等式：当前 source manifest 的全部声明 Chain = computed sidecar + 显式不可计算 Chain + 失败 Chain；失败 Chain 必须为 0，9A0D 只能按本次审计事实进入显式不可计算。
- [ ] 重跑 `--resume`，确认 0 次 DSSR 新调用且输出 SHA-256 清单不变。

## 任务 8：形成同卷候选并发布 Git/Pages

**本机候选根：** `/Volumes/tianyi/Server/candidate/foldbridge-d33-<UTC>/`

- [ ] 将远端 sidecar、receipts、ledger 同步到同卷候选根，验证文件数量、gzip、schema、PDB×Chain 身份和远端/本机 SHA-256 清单完全一致。
- [ ] 提交 D3.3 UI、构建器、批处理器、计划和测试；排除 `scripts/__pycache__/` 与任何 staging/生产数据。
- [ ] 刷新 `ghhttps/main`，以 fast-forward 方式集成；复跑列明的定向回归、批处理测试、`npm test`、versioner `--check` 与 `git diff --check`，记录本次实际测试数量而非沿用历史数字。
- [ ] `git push ghhttps HEAD:main`；核对远端 SHA、Pages source/latest build、公共 SPA 响应和真实浏览器。

## 任务 9：原子发布 Case/Tunnel 并形成 reviewer 证据

- [ ] 在任何生产写入前完成任务 5 的五种候选浏览器状态验收，包括同链窗口外跳转、跨链只读和既有 1D/2D/3D 联动；不以源码测试代替该硬门槛。
- [ ] 在候选根准备 12 个共享无版本资产及其 `20260913-reviewer-d33-d34-1` 指纹副本；在候选树运行 versioner `--check`，不直接对生产树运行写模式。
- [ ] 发布前重新生成当前生产 source manifest，并与任务 7 receipts 中的 structure/linked-view 路径、大小和 SHA-256 逐项比较；任何新增、删除、大小写或字节漂移都终止发布并重建受影响候选。
- [ ] 获取独占发布锁；预检 docroot、候选根、每个目标及父目录均为预期的真实目录/普通文件且无符号链接或路径逃逸。锁持有期间禁止其他任务修改生产 `entry-cases` 树。
- [ ] 记录生产目标路径、大小和 SHA-256；创建 `/Volumes/tianyi/Server/rollback/foldbridge/<UTC>/`，备份所有将替换的共享资产和任何已有 sidecar，并为原先不存在的 sidecar、指纹资产记录精确新增清单。
- [ ] 使用显式 `--files-from` 清单把全量 sidecar 逐文件临时写入并原子重命名到准确的 PDB×Chain 路径；复制后逐文件核对候选/生产 SHA-256，禁止 `--delete`。
- [ ] 发布并核对全部新指纹资产；只有 sidecar、指纹资产、数量和哈希全部闭合后，才按清单逐文件原子替换无版本共享入口以激活功能。
- [ ] 若任一步失败，在保持发布锁的情况下只恢复精确备份、删除精确新增清单中的文件并复核恢复 SHA；禁止宽泛递归删除。成功验收或回滚闭合后才释放锁。
- [ ] 验证本机 GET、公共 GET、OPTIONS；浏览器至少覆盖普通可计算 Chain、9A0D 不可用 Chain、多链大小写、E/F 页面，以及 Profile、Technique、1D/2D/3D、Reference 无回归。
- [ ] 更新 `docs/reviewer-response/README.md` 和 D3.3 上线证据文档，记录实际分母、不可计算原因、镜像/命令/SHA、Git SHA、Pages build、Tunnel GET/OPTIONS 与浏览器验收；不得把工具输出写成跨算法共识。

## 边界

- 任务 1–5 只形成本地候选和真实样本证据；任务 6–9 已由用户明确授权推进全站物化、Git/Pages 和 Case/Tunnel 上线，但仍须逐级通过维护手册门槛后才能宣称上线。
- 不扩展为全链独立图、不改 E/F、不增加 Mol* 几何着色、不在浏览器端运行 DSSR。
- 不重算或替换现有 RNApdbee/RNAView 配对；DSSR 不得改写 2D 配对，不增加 RNAView/DSSR/MC-Annotate 选择器。
- 当前工作树中已有 D3.4 候选必须保留，D3.3 只在其上形成联合资产版本。
