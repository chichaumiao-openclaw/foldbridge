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
  │  对每个 displayCase 派生 chainPlacements = 去重后的 [(class, name)]
  │  buildChainHierarchy(displayCases) → sourceChainHierarchy（全量静态树）
  ▼
index.json { displayCases[].chainPlacements, sourceChainHierarchy,
             totalCaseCount, totalPlacementCount, ... }
  ▼
浏览器 annojoinAtlasData.js: buildChainHierarchy(filteredCases) 在过滤后重算
  （沿用现状 buildCaseHierarchy(cases) 的过滤响应语义，cases 已过滤）
  ▼
annojoinAtlasView.js: 三层折叠 UI（class → name → PDB）
```

**单元边界**：
- `buildChainHierarchy(displayCases)` — 纯函数，无 I/O。输入带 `chainPlacements` 字段的 displayCases 数组，输出三层树。build 时（全量）与浏览器侧（过滤后）共用同一函数。可独立单测。
- placement 派生（需 chain index）发生在 build 的 `buildAtlasIndexAsset` 里，结果写进 displayCase；树构建只读 `chainPlacements`，不再依赖 chain index。
- 浏览器侧用过滤后的 cases 重算树（与既有"分组树随搜索/facet 收窄"行为一致），不重算 placement（直接读 build 时算好的）。

## 4. 数据流改造（build 脚本 + index builder）

### 4.1 build-annojoin-atlas.mjs
`buildAtlasIndexAsset(...)` 调用处新增 `chainIdentityIndex` 入参（该 Map 已在 L355 构建，目前只用于 per-case 注入）。不改它的构建方式。

### 4.2 corpus.mjs `buildAtlasIndexAsset`
- 函数签名新增 `chainIdentityIndex = new Map()`。
- 给每个 displayCase 派生 **`chainPlacements`** 字段：`[{ classLabel, nameLabel }]`，由该 PDB 在 chain index 里所有 RNA chain 按 `(rnaClass, displayName)` 去重而来（见 §5.2）。chain 查无 → 单条兜底 placement（见 §6）。该字段随 displayCase 进 index，供浏览器在**过滤后**重算分组树（见 §7.1）。
- 在 `buildDisplayCases(normalizedCases)` 之后，调用 `buildChainHierarchy(displayCases)`（消费各 displayCase 的 `chainPlacements`）得到**全量静态树**，作为 `sourceChainHierarchy` 发到 index（仅作未过滤态/计数参考）。
- 返回对象：
  - `sourceChainHierarchy`（全量静态树，取代旧 `caseHierarchy`）
  - `totalCaseCount` = distinct PDB 数（= `displayCases.length`，不变）
  - 新增 `totalPlacementCount` = 全量树内所有叶（placement）之和
- **`chainPlacements` 必须在 `slimAtlasIndexForWrite` 中保留**（浏览器重算树依赖它），不可像 `profilePreview` 那样被瘦身丢弃。

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
对每个 displayCase（distinct PDB），在 **build 时**：
1. 从 `chainIndex.get(pdbUpper)` 取所有 RNA chain。
2. 按 `(rnaClass, displayName)` 去重 → 得到该 PDB 的 distinct 身份对集合。
3. 去重对集合写进 displayCase 的 `chainPlacements` 字段。

**树构建**（`buildChainHierarchy`，build 与浏览器共用）遍历各 displayCase 的 `chainPlacements`，每个 `(class, name)` 对把该 PDB 挂到对应 `class → name` 分支的叶。多 chain 多身份的 PDB 自然出现在多个分支（如核糖体装配体同时在 `rRNA → 16S ribosomal RNA` 和 `tRNA → tRNA-Lys` 下各出现一次）。

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

build 时派生 `chainPlacements` 的兜底（保证每个 displayCase 至少一条 placement）：

- **chain index 查不到任何 RNA chain**（RASP-only / 上游 chain 表缺该 PDB）：写单条 placement `{ classLabel: "Unclassified RNA", nameLabel: moleculeDisplayName || pdbId }`。该 PDB 仍出现在总表。
- **有 chain 但 `parent_rna_class` 为空**：该 chain 的 placement `classLabel = "Unclassified RNA"`，nameLabel 仍走 chain index `displayName`。
- **有 chain 但 `displayName` 为空**（chain index 理论上已兜底为 ref，不应为空）：nameLabel 回退 `moleculeDisplayName || pdbId`。
- 兜底分支 `"Unclassified RNA"` 参与正常排序（localeCompare），不特殊置顶/置底。

## 7. 浏览器渲染层

### 7.1 数据层 `annojoinAtlasData.js`
- `buildCaseHierarchy`（L194）替换为 `buildChainHierarchy(cases)`，调用点在 `buildAtlasSearchState` L579，**入参仍是过滤后的 `cases`**（保持现状的过滤响应语义：搜索/facet 收窄时分组树与节点 caseCount 实时随可见行变化）。
- 浏览器侧 `buildChainHierarchy` 读各 case 的 `chainPlacements`（build 时算好），按 §5 展开树；不重算 placement，也不需要 chain index。
- index 顶层 `sourceChainHierarchy`（全量静态树）映射到 `sourceCaseHierarchy` 现位（L580），作未过滤态参考。
- `normalizeCase` 需保留透传 `chainPlacements` 字段（与 `moleculeDisplayName` 同类显式保留，铁律：漏带字段是隐形杀手）。
- `parentBucketLabel`/`childBucketLabel`（L175/L181）移除（见 §8）。
- 验证必须走真实 `buildAtlasSearchState`（铁律：验前端行为不能只读 raw index，要过真实 data 层）。

### 7.2 视图层 `annojoinAtlasView.js`
- 两层折叠组件扩成三层：class 行 → name 行 → PDB 行。
- 复用现有 `annojoin-group-row-inner` flex 容器 + `+/-` 按钮 + 计数徽章样式（`styles.css:343-433`），第三层缩进沿用同一缩进 token。
- 同一 PDB 在多分支重复出现是预期；每条 placement 是独立可点行，路由 `detailRouteId` 仍指向同一 PDB 详情页。
- 折叠状态键需含层级路径。现有两层已用 `bucketId(parentLabel + childLabel)` 把父标签并入子 id 防串台；**第三层（PDB 叶）为新增**，键策略 `classId :: nameId :: pdbId`，避免不同分支同名节点状态串台。

## 8. 移除（YAGNI 决断）

chain class 上线后，以下 case-level 分类逻辑成为死代码，**全部移除**：

| 文件 | 移除项 |
|---|---|
| `annojoin-atlas-corpus.mjs` | `PLACEHOLDER_CLASS_LABEL_PATTERNS`、`PLACEHOLDER_CLASS_SOURCES`、`isPlaceholderClassLabel`、`cleanClassLabel`、`classCanonicalMap` 的构建与 parentClassLabel/childClassLabel 覆写、`normalizeCase` 里 `parentClassLabel/childClassLabel/parentClassSource/childClassSource` 派生 |
| `annojoinAtlasData.js` | `parentBucketLabel`、`childBucketLabel`、`normalizeCase` 里 `parentClassLabel/childClassLabel` 读取 |

**保留**：
- `moleculeDisplayName` / `moleculeCanonicalMap` / `moleculeBaseName` — 仍作兜底 name（§6）。
- raw provenance 字段不在范围内（本就只动 display-only 派生标签）。

index 字段 `caseHierarchy` → 重命名 `sourceChainHierarchy`（全量静态树）；浏览器 data 层 `caseHierarchy` 输出键改为过滤后重算的 chain 树（沿用 L579 调用位）。`ANNOJOIN_ATLAS_SCHEMA_VERSION` bump。

## 9. 测试与验证

### 9.1 单元测试（`buildChainHierarchy` 纯函数 + placement 派生）
- placement 派生（在 corpus 测试，`test/annojoin-atlas-corpus.test.js`）：多 chain 多身份 PDB → 去重后多个 `(class, name)`；chain 查无 → 单条 `Unclassified RNA` 兜底；class 空 → 兜底 class。
- `buildChainHierarchy`：多身份 PDB 展开到多个 `class → name` 分支；同 PDB 同分支多条同身份 placement → 节点 `caseCount` 仍计 1（distinct PDB）；`totalPlacementCount` = 叶总和；`totalCaseCount` = distinct PDB 数；排序确定性（class/name localeCompare、PDB 升序）。

### 9.2 data 层测试（真实路径，过滤响应）
- 经 `buildAtlasSearchState`（`test/annojoin-atlas.test.js`，import 真实 data 层）：断言无过滤时 chain 树三层结构；**加 query/facet 过滤后树随之收窄、节点 caseCount 反映可见行**（锁定过滤响应语义）；折叠状态键三层不串台。表模型层断言可落 `test/annojoin-atlas-table-model.test.js`。

### 9.3 真实 full build 验证
- `FOLDBRIDGE_ANNOJOIN_ROOT=.../view_roots/combined` + 校准/identity/ANNO 根（默认 tianyi 路径），跑 `npm run build:annojoin-atlas`。
- 核 manifest：`totalCaseCount`（distinct PDB）vs 新增 `totalPlacementCount`。
- grep index.json：`displayCases[].chainPlacements` 存在且非空；无残留旧 `parentClassLabel/childClassLabel` 分组字段与 `caseHierarchy` 旧键。
- 抽样若干多 chain PDB（如 4V99 rRNA+tRNA、6YFT），确认在多分支正确出现。
- `npm test` 全绿，零回归。
- dist 同步：`rsync -a --delete src/assets/generated/annojoin-atlas/ → dist/.../`（生成产物 gitignore，本地重建）。

## 10. 风险与缓解
- **placement 膨胀**：超多链装配体（4V99 有 120 链）展开 placement 可能放大行数。缓解：按 `(class, name)` 去重后，同一装配体的同身份链折叠为单条，实际 placement 远小于链数；§5.3 计数双显防误读。
- **schemaVersion 不兼容旧 dist 缓存**：bump version + full build 重写全部资产，浏览器硬刷新（Cmd+Shift+R）。
- **chain index 覆盖不全**：RASP-only PDB 走 `Unclassified RNA` 兜底，不丢数据；与既有 RASP 上游缺口一致，非本设计引入。
