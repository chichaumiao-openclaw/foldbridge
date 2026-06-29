# ANNOJOIN Atlas 总表按 chain 生物学身份聚合 — 设计

- 状态：草案（待 spec 审查）
- 日期：2026-06-29
- 仓库：`~/docs/foldbridge`（vanilla-JS 静态站）
- 关联前序设计：`2026-06-26-annojoin-atlas-master-table-search-design.md`、`2026-06-29-annojoin-atlas-index-slim-fast-rebuild-design.md`

## 1. 背景与问题

ANNOJOIN Atlas 总表当前以 **case（PDB）级** 的两层 free-text 分类驱动分组：

```
parentClassLabel → childClassLabel → PDB
```

这两个标签来自上游 `parent_class_label` / `child_class_label`，是 case 级的自由文本生物学分类。它们语义不明确、拼写不统一、含占位垃圾（`RASP public current` / `raw-hit case` / `pending ...`），因此每次有新数据或发现误标，都要人工重新归类——**反复重来的根因**。

与此同时，仓库已经构建了一条**更干净的 chain 级身份轴**：`scripts/lib/annojoin-atlas-chain-identity.mjs` 的 `buildChainIdentityIndex` 从全库 RNA 链声明身份表派生每条链的 `parent_rna_class`（受控词表）和折叠后的规范展示名。但这条轴**只喂详情页**（`build-annojoin-atlas.mjs:530` 注入 per-case 详情资产），从未进入 index 层的 `displayCases`，因此**没有驱动总表分组**。

### 1.1 数据质量实测（27,803 条 RNA 链行）

源表 `/Volumes/tianyi/tmp/PDB/04_pdb_metadata/pdb_rna_entity_chain_declared_identity.tsv`：

| 列 | 质量 | 是否适合做聚合轴 |
|---|---|---|
| `parent_rna_class` | 干净受控词表（tRNA / rRNA / ribozyme / other_RNA / viral_genomic_RNA / designed_RNA …） | ✅ 顶层分组首选 |
| `parent_rna_name` | 混杂：约 41%（11,407 行）是 >60 字符的原始结构标题或管道拼接（`RNA \| Virus-like particle of... \| unidentified`） | ❌ 直接做名字会重蹈覆辙，需折叠 |
| `declared_identity_phrase` | 常为原始全大写结构标题或泛词（`TRNA`） | 仅作 name 折叠的原始输入之一 |
| `entity_description` | 常空或过泛（`RNA`/`TRNA`），仅 22,365/27,803 有值 | ❌ 不是 class，不适合做分类轴 |

**结论**：聚合应按 chain 的**class**（`parent_rna_class`，干净），name 必须经全库最高频拼写折叠（复用已有 `buildCanonicalByFoldKey`），绝不直接用 raw `parent_rna_name`。

## 2. 目标与非目标

### 目标
- 总表分组从 case-level free-text 标签切换到 **chain-level 生物学身份**（class → 规范 name → PDB 三层树）。
- 一个 PDB 按其所含每个 distinct `(class, canonicalName)` 出现在对应分支（多 chain 多身份 → 多 placement）。
- 彻底移除导致反复重来的 case-level 分类标签及其占位清洗逻辑。
- 计数语义清晰：distinct PDB 数与 placement 数都可见，不混淆。

### 非目标（YAGNI）
- 不改详情页的 chain 身份渲染（`annojoinCaseView.js` 已正确展示 per-chain 身份）。
- 不动 chain 身份的 verified/URS 治理逻辑（`biological_layer:final_identity`）。
- 不改造搜索/facet 机制本身（沿用现有 `buildAtlasSearchState`）。
- 不引入任何 UI 框架/打包器（保持无框架 vanilla 静态站）。

## 3. 架构总览

```
build-annojoin-atlas.mjs
  │  chainIdentityIndex = buildChainIdentityIndex({declaredIdentityRows, governedRows})
  │  （现状：仅注入 per-case 详情资产 L530）
  ▼
buildAtlasIndexAsset({ ..., chainIdentityIndex })   ← 新增入参
  │  对每个 displayCase 按 chainIndex 展开 (class, canonicalName) placement
  │  buildChainHierarchy(displayCases, chainIndex) → chainHierarchy
  ▼
index.json { chainHierarchy, totalCaseCount, totalPlacementCount, displayCases, ... }
  ▼
浏览器 annojoinAtlasData.js: buildCaseHierarchy 改读 build 时算好的 chainHierarchy
  ▼
annojoinAtlasView.js: 三层折叠 UI（class → name → PDB）
```

**单元边界**：
- `buildChainHierarchy(displayCases, chainIndex)` — 纯函数，无 I/O。输入 displayCases 数组 + chain index（`Map<pdbUpper, ChainIdentity[]>`），输出三层树。可独立单测。
- 数据流接线（build 脚本传参）与树构建逻辑（corpus 纯函数）分离。
- 浏览器侧只渲染，不重算分组（与"浏览器只渲染 displayCases"既有原则一致）。

## 4. 数据流改造（build 脚本 + index builder）

### 4.1 build-annojoin-atlas.mjs
`buildAtlasIndexAsset(...)` 调用处新增 `chainIdentityIndex` 入参（该 Map 已在 L355 构建，目前只用于 per-case 注入）。不改它的构建方式。

### 4.2 corpus.mjs `buildAtlasIndexAsset`
- 函数签名新增 `chainIdentityIndex = new Map()`。
- 在 `buildDisplayCases(normalizedCases)` 之后，调用 `buildChainHierarchy(displayCases, chainIdentityIndex)`。
- 返回对象：
  - `chainHierarchy`（取代旧 `caseHierarchy`）
  - `totalCaseCount` = distinct PDB 数（= `displayCases.length`，不变）
  - 新增 `totalPlacementCount` = 树内所有叶（placement）之和

### 4.3 canonical name 复用
顶层 class 直接用 `parent_rna_class`（chain index 已带 `rnaClass` 字段）。中层 name 用 chain index 的 `displayName` 字段——它已在 `annojoin-atlas-chain-identity.mjs` 经 `buildCanonicalByFoldKey` 折叠（`declared_identity_phrase || parent_rna_name` 取全库最高频拼写）。**不在本设计里重新折叠**，直接消费 index 已算好的 `displayName`，保证总表与详情页的 name 一致。

## 5. 树结构与计数语义

### 5.1 三层树
```
parent_rna_class          顶层（干净受控词表）
  └─ canonicalChainName   中层（chain index displayName，已折叠）
       └─ PDB             叶（可点进详情页）
```

### 5.2 placement 展开规则（2+3 组合）
对每个 displayCase（distinct PDB）：
1. 从 `chainIndex.get(pdbUpper)` 取所有 RNA chain。
2. 按 `(rnaClass, displayName)` 去重 → 得到该 PDB 的 distinct 身份对集合。
3. 每个去重对生成一条 placement，挂到 `class → name` 分支下的叶。

多 chain 多身份的 PDB 自然出现在多个分支（如核糖体装配体同时在 `rRNA → 16S ribosomal RNA` 和 `tRNA → tRNA-Lys` 下各出现一次）。

### 5.3 计数语义（避免误读）
- `totalCaseCount` = **distinct PDB 数**（唯一 PDB，不变，= displayCases.length）。
- `totalPlacementCount` = 树内所有叶之和（含跨分支重复的同一 PDB）。
- 每个 class / name 节点的 `caseCount` = 该节点子树下的 **distinct PDB 数**（不是 placement 数）——防止同一 PDB 在同一分支内因多条同身份链被重复计数。
- 总表表头同时显示两数，文案如：`1,240 PDBs · 1,890 entries`。

### 5.4 节点排序
- class 顶层：按 label `localeCompare` 升序（沿用 `buildCaseHierarchy` 的确定性排序）。
- name 中层：同 class 内按 label `localeCompare` 升序。
- PDB 叶：按 PDB id 升序。

## 6. 边界 case 处理（绝不丢 PDB）

- **chain index 查不到任何 RNA chain**（RASP-only / 上游 chain 表缺该 PDB）：落到单一兜底分支 `class = "Unclassified RNA"`，name 用 displayCase 现有 `moleculeDisplayName` 回退（再空则用 `pdbId`）。该 PDB 仍出现在总表，单条 placement。
- **有 chain 但 `parent_rna_class` 为空**：class 兜底 `"Unclassified RNA"`，name 仍走 chain index `displayName`。
- **有 chain 但 `displayName` 为空**（已被 chain index 兜底为 ref，理论上不为空）：name 回退 `moleculeDisplayName || pdbId`。
- 兜底分支 `"Unclassified RNA"` 参与正常排序（localeCompare），不特殊置顶/置底。

## 7. 浏览器渲染层

### 7.1 数据层 `annojoinAtlasData.js`
- `buildCaseHierarchy`（L194）改为**直接读 index 发出的 `chainHierarchy`**，不再在浏览器侧从 `parentClassLabel/childClassLabel` 现算。
- `normalizeCase` 不再需要 `parentClassLabel/childClassLabel` 派生（见 §8 移除）。
- 验证必须走真实 `buildAtlasSearchState`（铁律：验前端行为不能只读 raw index，要过真实 data 层）。

### 7.2 视图层 `annojoinAtlasView.js`
- 两层折叠组件扩成三层：class 行 → name 行 → PDB 行。
- 复用现有 `annojoin-group-row-inner` flex 容器 + `+/-` 按钮 + 计数徽章样式（`styles.css:343-433`），第三层缩进沿用同一缩进 token。
- 同一 PDB 在多分支重复出现是预期；每条 placement 是独立可点行，路由 `detailRouteId` 仍指向同一 PDB 详情页。
- 折叠状态键需含层级路径（`class-id / class-id::name-id`），避免不同分支同名节点状态串台。

## 8. 移除（YAGNI 决断）

chain class 上线后，以下 case-level 分类逻辑成为死代码，**全部移除**：

| 文件 | 移除项 |
|---|---|
| `annojoin-atlas-corpus.mjs` | `PLACEHOLDER_CLASS_LABEL_PATTERNS`、`PLACEHOLDER_CLASS_SOURCES`、`isPlaceholderClassLabel`、`cleanClassLabel`、`classCanonicalMap` 的构建与 parentClassLabel/childClassLabel 覆写、`normalizeCase` 里 `parentClassLabel/childClassLabel/parentClassSource/childClassSource` 派生 |
| `annojoinAtlasData.js` | `parentBucketLabel`、`childBucketLabel`、`normalizeCase` 里 `parentClassLabel/childClassLabel` 读取 |

**保留**：
- `moleculeDisplayName` / `moleculeCanonicalMap` / `moleculeBaseName` — 仍作兜底 name（§6）。
- raw provenance 字段不在范围内（本就只动 display-only 派生标签）。

index 字段 `caseHierarchy` → 重命名 `chainHierarchy`，`ANNOJOIN_ATLAS_SCHEMA_VERSION` bump。

## 9. 测试与验证

### 9.1 单元测试（`buildChainHierarchy` 纯函数）
- 多 chain 多身份 PDB 展开到多个 `class → name` 分支。
- 同 PDB 在同一分支内多条同身份链 → 节点 `caseCount` 仍计 1（distinct PDB）。
- chain index 查无该 PDB → 落 `Unclassified RNA` 兜底，PDB 不丢。
- `parent_rna_class` 空但有 chain → class 兜底 `Unclassified RNA`。
- `totalPlacementCount` = 叶总和；`totalCaseCount` = distinct PDB 数。
- 排序确定性（class/name localeCompare、PDB 升序）。

### 9.2 data 层测试（真实路径）
- 经 `buildAtlasSearchState` 加载真实 slim index，断言 `chainHierarchy` 三层结构 + 折叠状态键不串台。测试落 `test/annojoin-atlas.test.js`（import `buildAtlasSearchState`），不是 `test/data.test.js`。

### 9.3 真实 full build 验证
- `FOLDBRIDGE_ANNOJOIN_ROOT=.../view_roots/combined` + 校准/identity/ANNO 根（默认 tianyi 路径），跑 `npm run build:annojoin-atlas`。
- 核 manifest：`totalCaseCount`（distinct PDB）vs 新增 `totalPlacementCount`。
- grep index.json + per-case sidecar：无残留旧 `parent_class_label/child_class_label` 分组痕迹。
- 抽样若干多 chain PDB（如 4V99 rRNA+tRNA、6YFT），确认在多分支正确出现。
- `npm test` 全绿，零回归。
- dist 同步：`rsync -a --delete src/assets/generated/annojoin-atlas/ → dist/.../`（生成产物 gitignore，本地重建）。

## 10. 风险与缓解
- **placement 膨胀**：超多链装配体（4V99 有 120 链）展开 placement 可能放大行数。缓解：按 `(class, name)` 去重后，同一装配体的同身份链折叠为单条，实际 placement 远小于链数；§5.3 计数双显防误读。
- **schemaVersion 不兼容旧 dist 缓存**：bump version + full build 重写全部资产，浏览器硬刷新（Cmd+Shift+R）。
- **chain index 覆盖不全**：RASP-only PDB 走 `Unclassified RNA` 兜底，不丢数据；与既有 RASP 上游缺口一致，非本设计引入。
