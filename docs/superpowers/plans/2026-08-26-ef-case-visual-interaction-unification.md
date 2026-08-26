# EF Case 视觉与交互彻底统一实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** Family E 只展示有效左下三角，并让 EF 1D、heatmap、VARNA、Mol* 使用与普通 Case 一致的 residue 状态和双向交互。

**架构：** `ef-heatmap-core.js` 派生 presentation-valid-cell 集；`ef-case.js` 把已验证的 linked-view residue identity 交给 renderer；共享 residue-linkage API 同时服务普通 Case 与 EF 的 key-set DOM 状态及 VARNA hit layer。`ef-heatmap.js` 保留 EF 强度切片，Family E 使用 row+column 并集，Family F 保留明确的矩形轴上下文。

**技术栈：** 原生 JavaScript、SVG、Node `node:test`、PDBe Mol* 事件。

---

## 文件职责

- 修改 `public/entry-cases/__entry_ef_site__/ef-heatmap-core.js`：Family-aware cell 可见性纯函数。
- 修改 `public/entry-cases/__entry_ef_site__/ef-case.js`：向 renderer 传递 linked-view residues。
- 修改 `public/entry-cases/__entry_ef_site__/ef-heatmap.js`：E 三角命中、共享 1D 状态、VARNA hit layer、四视图 hover/click。
- 修改 `public/entry-cases/__entry_v3_site__/workbench.js`：公开并调用普通/EF 共用的 residue-linkage API。
- 修改 `public/entry-cases/__entry_v3_site__/workbench.css`：删除 EF 专用 hover/selected，复用普通 `.residue-mark` 状态。
- 修改 `tests/ef-chain-view.test.mjs`：行为级 E/F、1D、VARNA、Mol* 回归。
- 修改 `tests/ef-workbench-integration.test.mjs`：禁止重新引入 EF 专用状态类。

### 任务 1：钉死 E/F 矩阵显示契约

- [ ] **步骤 1：写失败测试**

在 `tests/ef-chain-view.test.mjs` 增加：

```js
assert.equal(core.isDisplayCell(0, 1, 0, { family: "E", value_kind: "cohcoa_contact" }), false);
assert.equal(core.isDisplayCell(1, 0, -6, { family: "E", value_kind: "cohcoa_contact" }), true);
assert.equal(core.isDisplayCell(0, 3, 4, { family: "F", value_kind: "m2_coupling_z" }), true);
```

并断言 E renderer 仅生成左下 cell，右上/缺失 cell mousemove/click 不产生 hover/selection；F renderer 仍生成全部 8 个 cell。

- [ ] **步骤 2：验证 RED**

运行：`node --test tests/ef-chain-view.test.mjs`

预期：因 `isDisplayCell` 不存在以及 E 上三角仍被渲染而失败。

- [ ] **步骤 3：最少实现**

在 core 新增：

```js
function isDisplayCell(i, j, value, header) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return false;
  const isEContact = String(header?.family || "").toUpperCase() === "E"
    || header?.value_kind === "cohcoa_contact";
  return !isEContact || i > j;
}
```

core 增加 `presentationPayload(payload)`，复制 header/axis并只保留 `isDisplayCell` 为真的 cells，再从有效 finite values 重算 presentation header 的 `value_min/value_max`。renderer 只对这份 payload 建 index；绘制、hitgrid、slice、VARNA、Mol* 和 interaction event 全部读同一 index。无效 cell 清除 hover并拒绝 click。有效 E cell click 同时显示 row、column、cell selection。原始 payload/header 保持不变；测试钉死无效上三角极值不会压缩有效下三角颜色尺度。

- [ ] **步骤 4：验证 GREEN**

运行：`node --test tests/ef-chain-view.test.mjs`

### 任务 2：统一 residue identity、1D 与 VARNA 状态

- [ ] **步骤 1：写失败测试**

先为普通 Case 补 RED 回归：单 residue hover/select/clear 仍同步所有同 key marks，VARNA hit layer 数量/identity 不变，selection 不覆盖 fill。再给 EF renderer 传入 linked residues，断言：

```js
assert.ok(baseMarks.every(mark => mark.getAttribute("data-residue-key")));
assert.equal(varnaHits.length, 2);
assert.equal(sourceCircle.getAttribute("data-residue-key"), "9WNR|chain|a|1");
assert.equal(sourceCircle.classList.contains("selected"), true);
assert.equal(sourceCircle.getAttribute("fill"), originalOrIntensityFill);
```

矩阵 pair hover/click 要让两个 residue key 同时 `.hovered/.selected`；VARNA hit mousemove/click 要反向更新 heatmap、1D 和 Mol*。源码测试断言不存在 `is-ef-hovered/is-ef-selected`。

- [ ] **步骤 2：验证 RED**

运行：`node --test tests/ef-chain-view.test.mjs tests/ef-workbench-integration.test.mjs`

- [ ] **步骤 3：最少实现**

`ef-case.js` 调用 renderer 时传入通过 linked contract 的原始身份：

```js
residues: linkedView.residueIndex.residues,
```

在 `workbench.js` 建立 `window.FoldBridgeResidueLinkage` 公共 API，并让普通 Case 原有 `setDomState` 与 `installVarnaHitLayer` 也调用它：

```js
const FoldBridgeResidueLinkage = {
  keySet(keys) { return new Set((keys || []).filter(Boolean)); },
  setState(root, className, keys) {
    const active = this.keySet(keys);
    root.querySelectorAll(".residue-mark").forEach((node) => {
      node.classList.toggle(className, active.has(node.getAttribute("data-residue-key")));
    });
  },
  installVarnaHitLayer(doc, svg, fillCircles, residueKeys) { /* shared fill/hit markup */ },
};
```

renderer 建立 linkedView `labelSeqId -> residueKey` 严格映射；缺失、重复或 axis 不一致直接 throw。1D interactive target 和可见 rect 都携带原始 key，并调用公共 API 的 key-set state；mousemove/leave/click/keyboard 进入同一 select/hover 函数。

VARNA 原始 fill circle 携带 `.residue-mark` 和 key，另建与普通 Case 等价的透明 `.varna-hit` circle；每个 hit circle直接绑定 hover/click，不再做 SVG 最近圆点扫描。selection 仅加描边状态，保留 intensity fill。

删除 CSS 中 `.is-ef-hovered/.is-ef-selected`，EF 1D hover/selected 由普通 `.residue-mark.hovered/.selected` 控制；只保留 focus-visible 的键盘状态规则。

- [ ] **步骤 4：验证 GREEN**

运行：`node --test tests/ef-chain-view.test.mjs tests/ef-workbench-integration.test.mjs`

### 任务 3：补齐 E union slice、3D hover 与 pair selection

- [ ] **步骤 1：写失败测试**

断言 `PDB.molstar.mouseover` 用真实 label sequence id 给 1D/VARNA/heatmap 加 `.hovered`，`mouseout` 清除；matrix cell click 保留两个 selected residue key，同时只把 `observed !== false` 的端点送入 3D。

- [ ] **步骤 2：验证 RED**

运行：`node --test tests/ef-chain-view.test.mjs`

- [ ] **步骤 3：最少实现**

presentation index 增加 Family E residue slice：按 residue 的两个轴 index 合并有效 row 和 column entries，以 partner residue key 去重；Family F 继续按事件的 i/j 轴取 slice，1D/VARNA/3D 使用 `sequenceAxis`。增加 `hoverPdbPosition`、`clearLinkedHover` 与 Mol* mouseover/mouseout 监听。pair selection 把两个端点加入 selected key set，只把 `observed === true` 的端点送入 3D；axis 缺失 observed 在 contract 阶段 throw。mouseleave 仅清 hover，重复点击当前单/双 key set 清 locked selection。

收紧 `pdbPositionFromMolstarEvent`：只接受 `label_seq_id/labelSeqId`；事件只有 `auth_seq_id` 时不得直接当 label 编号。若未来需要 auth→label，必须由 linked-view locator 显式 map。测试 fixture 使用不同 auth/label 编号验证仅 label 生效。

- [ ] **步骤 4：验证 GREEN**

运行：`node --test tests/ef-chain-view.test.mjs`

### 任务 4：完整验证与本地浏览器验收

- [ ] 运行 `node --check` 检查三个修改的 JS 文件。
- [ ] 运行 `node --test tests/ef-chain-view.test.mjs tests/ef-workbench-integration.test.mjs`。
- [ ] 运行完整 `npm test`。
- [ ] 运行 `git diff --check` 并审查 intended diff。
- [ ] 本地启动精确 `/Volumes/tianyi/Server/public` 或 staging 静态源，验证 `9WNR/a`：E 右上不可交互；1D/VARNA 样式一致；四视图 hover/click 双向。
- [ ] 验证 `8QO5/A`：F `124 × 160` 完整矩形仍可交互。
- [ ] 提交代码；不推送、不更新 Tunnel 源，直到用户明确授权发布。
