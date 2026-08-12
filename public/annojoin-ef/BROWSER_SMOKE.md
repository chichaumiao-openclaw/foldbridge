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

- [ ] **热图点击行/列表头（未实现，跳过）**
  - 待 ef-case.js 接线轴刻度点击事件

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

### 6. 性能自验（决定 MODE 默认值）

- [ ] **200×200 矩阵切 k（真机测试）**
  - 操作：
    1. 找一个大矩阵 E/F case（~200×200）
    2. Console 运行：`console.time('select'); window._efHeatmap.selectAxis('i', 50); console.timeEnd('select');`
    3. 观察 molstar 重着色是否交互感知内完成（<100ms 可感知）
  - 预期：
    - payload 构建 <16ms
    - molstar select 异步，总体流畅
  - **若卡顿（>200ms）**：
    - 改 `ef-heatmap.js` 顶部 `MODE = "highlight-only"`
    - 重测：3D 只 highlight 不全链重着色

### 7. 契约校验

- [ ] **越界 cell fail-loud**
  - 操作：Console 手动构造越界 payload：
    ```js
    const bad = {...window._efPayload, cells: [[0, 999, 1.0]]};
    window.createEfHeatmap({...window._efConfig, payload: bad});
    ```
  - 预期：抛错 "out of range"

---

## 执行记录

**测试日期：** ____________
**测试人：** ____________
**浏览器：** ____________ (Chrome/Firefox/Safari)

**MODE 最终值：** `full-3d` / `highlight-only` (勾选一个)
**理由：** ____________________________________________

**发现的问题：**
-

**结论：** PASS / FAIL (勾选一个)
