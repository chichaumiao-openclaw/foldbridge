# EF Case 视觉与交互彻底统一设计

## 目标

修复 EF Case 当前仍存在的三处分叉实现，使它满足既有 Case Workbench 与 `family-ef-supplement-handoff-20260825.md` 的统一要求：

1. Family E 热图不再把未承载数据的右上三角表达为真实零信号；Family F 仍显示完整矩形。
2. 1D mapped chain sequence 沿用普通 Case 的轨道视觉、残基身份和 hover/selected 状态，只增加动态 EF intensity 行。
3. VARNA 使用普通 Case 的 residue hit layer、状态类和双向联动，不再保留 EF 专用 hover/selected 表现。

## 方案比较

### A. 继续修补 EF 专用组件

改动最小，但会继续复制字体、间距、状态样式和事件代码；普通 Case 变化后 EF 仍会漂移。不采用。

### B. 只统一 CSS

能暂时让截图接近，但不能修复 `data-residue-key`、双端点 pair selection、VARNA 反向 hover 和共享 tooltip。不采用。

### C. 复用共享视觉与状态契约（采用）

保留 EF 矩阵/强度的特有数据逻辑，复用普通 Case 的轨道几何、CSS 状态类、VARNA hit layer 和 residue identity。改动边界明确，也能由交互测试验证。

## 行为设计

### Heatmap

- Family E / `cohcoa_contact`：仅渲染并命中 `i > j` 的有效左下三角；`i <= j` 和 `diag_mask_min_sep` 遮罩区没有 cell tooltip、hover 或 click。
- Family F / `m2_coupling_z`：保留完整 `n_rows × n_cols` 矩形和双轴行为。
- 点击有效 cell 形成 pair selection，同时锁定 i、j 两端；1D、VARNA 和 Mol* 分别高亮可映射/可观察端点。
- 单 residue 来源（1D、VARNA、3D）仍显示对应矩阵行/列强度切片。

### 1D mapped chain sequence

- 使用普通 `renderTrackRail` 的 210px label gutter、24px residue pitch、碱基颜色、字体、刻度、规则线和 `residue-mark` 状态。
- 内容保留 `PDB pos`、`Mapped chain seq`，新增动态 `EF intensity`；不虚构普通 profile/reactivity 数据行。
- 每个可交互 mark 使用共享 `data-residue-key`，mousemove/click/leave/keyboard 都进入同一 linked hover/selection 管线。

### VARNA

- 使用独立透明 hit layer 扩大命中区，不再对整个 SVG 做最近圆点扫描。
- hover 和 selected 只使用共享 `.hovered`、`.selected` 描边；不得覆盖强度填充色。
- VARNA hover/click 必须反向更新 1D、heatmap 和 3D；矩阵 pair hover/click 必须同时标记两个端点。

## 测试与验收

先写失败测试，再实现：

1. E 上三角不渲染、不可命中，F 矩形不受影响。
2. E cell click 保留两个端点，而不是只锁一行。
3. EF 1D marks 使用 `data-residue-key` 和共享状态类。
4. VARNA 不再使用 `.is-ef-hovered/.is-ef-selected`，selection 不覆盖 fill；hover/click 双向联动。
5. 运行 EF 单测、完整 `npm test`、JS 语法检查和 `git diff --check`。
6. 在本地 Case Shell 对 `9WNR/a` 做鼠标 hover/click 回归，并用一个 Family F case 验证完整矩形。

本任务不修改 EF 科学数据、坐标物料化或 Tunnel 公网源；部署需在本地验收后单独执行。
