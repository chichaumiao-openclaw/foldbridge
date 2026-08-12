# Family E/F 2D 热图组件 — 浏览器 Smoke 清单

**目的：** DOM 装配层无自动化测试栈（无 jsdom），本清单兜底验证浏览器侧集成。

## 前置准备

1. 确保有真实 E/F case 数据（含 `ef-matrix.json.gz`）
2. 本地启动 foldbridge 站点
3. 打开浏览器开发者工具（Console + Elements）

## Smoke 测试项

### 1. 基础渲染

- [ ] **E case 页加载**
  - 操作：访问一个 Family E case 页面
  - 预期：
    - 热图容器显示 SVG（非空白）
    - 稀疏格子有色彩（非全灰）
    - Console 无错误

- [ ] **F case 页加载（非方阵）**
  - 操作：访问一个 Family F case 页面（n_rows ≠ n_cols）
  - 预期：
    - 热图矩形不变形（分维 cellW/cellH）
    - viewBox 正确反映 n_cols × n_rows

### 2. Hover 交互（两碱基同时亮）

- [ ] **热图 hover**
  - 操作：鼠标悬停在热图任意有色格子
  - 预期：
    - VARNA 2D：对应的两个碱基圈同时高亮
    - molstar 3D：对应的两个残基 highlight
    - 移出格子后高亮消失

- [ ] **空白区 hover**
  - 操作：鼠标悬停在热图空白区域（无信号格）
  - 预期：
    - 不报错
    - tooltip 显示「无信号」或不显示

### 3. 选轴位 k（全链梯度重着色）

- [ ] **热图点击 → selectAxis('i', i)**
  - 操作：ef-case.js 已接线（`wireHeatmapClick`）——点击热图任意格
  - 预期：以点击落点反算的 i 轴位触发 selectAxis，整链按 `value[i][*]` 梯度重着色（molstar 整链 + VARNA 同步）

- [ ] **molstar 点选碱基**
  - 操作：在 molstar 3D 视图点选一个残基
  - 预期：
    - 热图：对应行/列高亮描框
    - VARNA：partner 碱基按 value[k][*] 梯度着色
    - molstar：全链按梯度重着色（选中行外的残基置灰）

- [ ] **VARNA 点选碱基**
  - 操作：在 VARNA 2D 视图点选一个碱基圈
  - 预期：同上（经 axisByPdbPos 反查 matrix_index）

### 4. 三视图联动防回环

- [ ] **origin 标签**
  - 操作：从 molstar 触发 selectAxis，观察是否重复触发 molstar 重绘
  - 预期：不回环（只触发一次）

### 5. Profile 切换

- [ ] **切换 profile**
  - 操作：切换到另一个 E/F profile
  - 预期：
    - `destroy()` 清理前一个热图
    - 新热图正常渲染
    - 无残留事件监听（用 Elements 面板检查）

### 6. 性能自验（恒 full-3d，无 MODE 开关）

> B1 已删除 `MODE`/highlight-only fallback：select 恒走 full-3d 整链重着色，无降级分支（呼应「无 fallback」诉求）。本节仅做性能观测，不再有"改 MODE"这一步。

- [ ] **200×200 矩阵切 k（真机测试）**
  - 操作：
    1. 找一个大矩阵 E case（9ZC6 203×203 或 9TMI 181×181）
    2. Console 运行：`console.time('select'); window.createEfHeatmap` 返回的 controller `.selectAxis('i', 50); console.timeEnd('select');`
    3. 观察 molstar 全链重着色是否交互感知内完成
  - 预期：
    - payload 构建 <16ms
    - molstar select 异步，总体流畅（full-3d 整链重着色）

### 7. 契约校验

- [ ] **越界 cell fail-loud**
  - 操作：Console 手动构造越界 payload：
    ```js
    const bad = {...window._efPayload, cells: [[0, 999, 1.0]]};
    window.createEfHeatmap({...window._efConfig, payload: bad});
    ```
  - 预期：抛错 "out of range"

- [ ] **无 molstar plugin fail-loud（验证「无 fallback」落地）**
  - 操作：Console 手动不传（或传 null）molstarPlugin 调用：
    ```js
    window.createEfHeatmap({ heatmapHost: document.getElementById('ef-heatmap-host'),
                             varnaHost: document.getElementById('varna-host'),
                             molstarPlugin: null,
                             payload: window._efPayload });
    ```
  - 预期：立即抛错，信息含 "requires a molstar plugin with .visual"（不静默降级为无 3D 空渲染）

- [ ] **结构加载失败 fail-loud（page 可见红字）**
  - 操作：临时把某 case 的 `structure.cif` 改名/挪走后刷新页面
  - 预期：热图容器显示红色 `ef-case load failed:` 报错（含 `[case <id>]` 上下文），而非静默空白 3D
  - 复原：改回文件名

---

## 执行记录

**测试日期：** ____________
**测试人：** ____________
**浏览器：** ____________ (Chrome/Firefox/Safari)

**渲染模式：** 恒 `full-3d`（B1 已删除 MODE/highlight-only fallback，无可选项）

**发现的问题：**
-

**结论：** PASS / FAIL (勾选一个)
