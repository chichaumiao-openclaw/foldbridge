# 论文数字重核：旧 ANNOJOIN atlas → entry 中心库口径对照

日期：2026-08-14
范围：论文 Method/Results 中"数据统计"段（Home/Entry/Search/Probing/Stats/Download）的全部数字
基准库：`/Volumes/tainyissd/foldbridge_1D_pool/entry_rollup/entry_atlas.duckdb`
（entry/chain/profile 三层，2026-08-14 重建，已含 pcat 兜底 map）

---

## 0. 结论先行

论文原段落里的数字**来自两个不同的源**，此前混为一谈导致核查全面对不上：

1. **旧 ANNOJOIN atlas 管线**（`~/docs/rmdb2pdb/.../annojoin_three_table_json_20260625/
   view_roots/combined/`，2026-06-25 构建）——产出前端下载资产（case index /
   membership / route index / facet / preset views / download manifest）。论文里所有
   **结构数**（3,401 / 4,070 / 498,275 / 192,298 / 18 / 6 / 10）都在这里，且**逐个精确命中**。
2. **entry 中心库**（`entry_atlas.duckdb`）——未来数据库中心。论文里所有**统计数**
   （RNA classes / families / technologies / solvent-access）应以它为准，此前用旧管线数
   全部偏小。

**决策（用户 2026-08-14）**：统计段换成 entry 中心口径；结构段暂维持旧管线交付数
（因为它们描述的是"下载 manifest 实际提供什么"，是真实交付物），待新管线在 entry 库上
产出对应资产后再统一换。

---

## 1. 口径定义（钉死，换库不再漂移）

| 指标 | 权威定义（SQL 口径） |
|---|---|
| **display cases** | `entry` 视图行数 = `count(*) FROM entry` = distinct pdb_id（一 PDB 一行，RMDB/RASP/GEO 已在库内合并卷到 pdb 粒度） |
| **RNA classes** | `count(DISTINCT partition) FROM chain`（12 类封闭集） |
| **RNA families** | entry.sci_name 跨行 split(';')→distinct（真实分子名，取代旧 molecule_name 坏值） |
| **probe technologies（干净 canonical）** | `count(DISTINCT technology) FROM profile WHERE coalesce(probing_category,'')<>'' AND is_background_channel=False`。即：能经 method_registry（+展示层兜底）映射到非空 probing_category 的真化学探针。**自动排除**背景（Nomod/None/nomod/none）、非探针 token（UV/UV302/ddGTP/Average*）、geo 粗批次标签（MaP/Various/DMS-MaP，仅在 geo_technique 不在 profile.technology） |
| **solvent-accessibility entries（单技术）** | entry 级 `technique 字段 LIKE '%;<tech>;%'`（Lead-seq / icLASER / RL-Seq），**非互斥**计数 |
| **solvent-accessibility entries（并集）** | distinct entry，被 Lead-seq∪icLASER∪RL-Seq 任一测过 |

**背景通道口径**：全程**不剔除**背景（论文原口径）。profile 20,440,377 行中 76,326 行是
`is_background_channel=True`，已包含在上述计数内。若将来出"结构性 profile"口径再单独减。

---

## 2. 统计段：新旧数字对照（换成 entry 口径）

| 论文原数字 | 含义 | 旧管线来源 | entry 库实测 | 采用 |
|---|---|---|---|---|
| 3,401 | display cases | ANNOJOIN combined（distinct case_id=3,610；行 4,070）| entry=**5,321** | **5,321** |
| 12 | RNA classes | — | distinct partition=**12** | **12**（不变 ✅）|
| 441 | entries with RNA classification | 旧管线有"未分类子集"概念 | entry 全 5,321 都有 partition | **删除该子集表述**（见 §4）|
| 339 | distinct RNA families | 旧 molecule_name | distinct sci_name=**385** | **385** |
| 24 | probe technologies | 旧管线 assay_family | 干净 canonical=**32 token / 31 化学** | **31**（见 §3）|
| 1,247 | solvent-access entries（总）| 旧管线 | Lead-seq∪icLASER∪RL-Seq distinct=**1,660** | **1,660** |
| 729 | Lead-seq entries | 旧管线 | entry 级=**809** | **809** |
| 518 | icLASER entries | 旧管线 | entry 级=**840** | **840** |
| 478 | RL-Seq entries | 旧管线 | entry 级=**671** | **671** |

**non-mutually-exclusive 硬规则（用户强制）**：809+840+671=2,320 > 并集 1,660 → 存在跨技术
重复计数，溶剂可及性那句**必须**显式声明"The technology-specific counts are
non-mutually exclusive"。

---

## 3. 干净 canonical 探针技术清单（entry 库重建后，32 token）

pcat 非空且非背景，按 probing_category 分组：

- **dms-based-probing**(8)：DMS, DMS-MaPseq, DMS-seq, DIM-2P-seq, Mod-seq, Structure-Seq, Structure-seq2, tNet-MaPseq
- **shape-based-probing**(12)：1M7, 2A3, SHAPE, SHAPE-MaP, NMIA, ChemModSeq, Cotranscriptional_SHAPE-seq, Nuc-SHAPE-Structure-Seq, icSHAPE, icSHAPE-MaP, smartSHAPE
- **enzymatic-probing**(3)：PARS, PARTE, tNet-RNase-seq
- **carbodiimide**(2)：CMC, CMCT
- **guanine-specific-probing**(2)：Keth-seq, **Glyoxal**（展示层兜底新增）
- **cleavage-footprinting**(3)：HRF, Lead-seq, RL-Seq, **Terbium** + **hydroxyl_radical**（后二兜底新增）
- **rna-protein-interaction**(1)：icLASER

**token 计 32，化学去重计 31**：`hydroxyl_radical` 与 `HRF` 化学同一（都是羟自由基骨架切割，
cleavage-footprinting），论文按独立探针写用 **31**；若按数据库出现的技术 token 写用 32，需注明
hydroxyl_radical 是 HRF 的 rdat modifier 别名。**建议论文用 31**（化学独立探针）。

覆盖 entry：**5,316** / 5,321（5 条 entry 无任何干净探针，仅背景/geo/空身份）。

---

## 4. "441 classified entries" 为何删除

旧 ANNOJOIN 管线里 441 = "带 structural classification 注解的子集"，是那套管线的注解覆盖率。
entry 中心库里 partition 分类是 chain 层生物注解卷上来的，**5,321 条 entry 全部有 partition**，
不存在"未分类子集"。故该子集表述在新口径下失效，改为直接陈述全库：
"5,321 entries across 12 RNA classes and 385 distinct RNA families"。

---

## 4.5 Fig 2B：12 类 RNA 分类的三种统计粒度（钉死口径）

12 类分类固定，但可按 chain / entry / profile 三种单位计数。实测（重建后 live 库）：

| RNA type | chains | entries(distinct pdb) | distinct profiles | profile rows |
|---|---:|---:|---:|---:|
| rRNA | 8,794 | 2,939 | 85,266 | 17,996,729 |
| tRNA | 3,763 | 1,899 | 13,009 | 324,263 |
| other_RNA | 1,629 | 1,180 | 86,109 | 698,854 |
| mRNA | 1,544 | 1,252 | 9,781 | 27,721 |
| ribozyme | 493 | 364 | 22,135 | 647,835 |
| riboswitch | 492 | 346 | 44,519 | 432,009 |
| snRNA | 489 | 233 | 6,199 | 110,345 |
| viral | 304 | 159 | 27,549 | 113,464 |
| aptamer | 128 | 75 | 671 | 1,706 |
| synthetic_RNA | 92 | 69 | 5,569 | 12,334 |
| SRP_RNA | 75 | 57 | 6,712 | 64,648 |
| designed_RNA | 34 | 23 | 8,650 | 10,469 |
| **列和** | **17,837** | **8,596** | **316,169** | **20,440,377** |

**三种口径的互斥性（决定图注措辞）**：

- **chains（列和 17,837 = 全库 chain 数）**：唯一**加和 = 全库真值**的口径。一条 chain
  只属一个 partition（互斥），无需额外声明。**推荐 Fig 2B 用这个**——y 轴 "number of
  RNA chains"，列和干净等于全库 17,837。
- **entries（列和 8,596 > 全库 5,321）**：**非互斥**。一个 PDB 常含多类型链（rRNA+tRNA
  复合物），在多类各计一次。用这口径**必须声明 non-mutually exclusive**。
- **distinct profiles（列和 316,169 > 全库 256,929）**：**非互斥**。一条 profile 可挂到
  跨类的链（profile_key 跨链复用），多类各计一次。用这口径也**必须声明 non-mutually
  exclusive**，且要解释列和 316,169 > 全库 256,929 distinct profiles。

**Fig 2B 旧图注问题（须改）**：旧图注 y 轴写 "number of probing profiles"，但旧柱子和
= 19,944，既非 profiles(256,929) 也非当前 chains(17,837)。19,944 是**比当前 live 库更早
的一版**（8 个备份全查，chain 行只有 17,837 或 14,916，无 19,944）。**须用当前 chain
分布重画**，并把 y 轴口径改成 "number of RNA chains"（或若坚持 profiles 用 316,169
并声明 non-mutually exclusive）。

---

## 5. 结构段：暂维持旧管线交付数（逐个已精确核实）

这些是旧 ANNOJOIN atlas 的真实交付物行数，**逐个命中论文数字**（核查于
`annojoin_three_table_json_20260625/view_roots/combined/`）：

| 论文数字 | 源文件 | 核实 |
|---|---|---|
| 4,070-row case-search index | anno_case_search_index.tsv | ✅ 4,070 |
| 498,275-row profile-membership | anno_case_profile_membership.tsv | ✅ 498,275 |
| 192,298 residue-track route | anno_residue_track_route_index.tsv | ✅ 192,298 |
| 192,298 2D-context route | anno_2d_pair_context_route_index.tsv | ✅ 192,298 |
| 192,298 3D-colouring route | anno_3d_residue_coloring_route_index.tsv | ✅ 192,298 |
| 18 searchable facets | anno_facet_catalog.tsv | ✅ 18 |
| six predefined views | atlas_preset_view_definitions.tsv | ✅ 6 |
| ten download tables | atlas_download_manifest.tsv | ✅ 10 |
| 3,401 display cases | 旧 case index distinct case_id=3,610 / 行 4,070 | ⚠️ 近似（旧口径）|

entry 库能直接对应的结构数（供未来新管线对齐）：
- display cases = entry 行 **5,321**
- profile-membership ≈ profile 行 **20,440,377**（distinct profile_key=**256,929**）
- chains = chain 行 **17,837**
- facets / views / route index / download manifest = **entry 库暂无这些资产表 → 待新管线产出**

**新管线待办**：在 entry 库上产出前端资产（case index / membership / route index / facet /
preset views / download manifest），产出后本表结构数统一换 entry 口径。属创造性工程，
另起头脑风暴+计划。

---

## 6. 重写后的论文文字（统计段，可直接用）

> The Probing page groups the technology library into measurement families and provides a
> technology comparison table and a glossary. The Stats page reports **5,321 entries across
> 12 RNA classes and 385 distinct RNA families**, with **31 canonical probing technologies**
> represented. The same page records **1,660 entries** measured with
> solvent-accessibility-based technologies, including **809 Lead-seq, 840 icLASER and
> 671 RL-Seq** entries. **The technology-specific counts are non-mutually exclusive: an entry
> probed by more than one technology is counted under each, so the per-technology counts do
> not sum to the 1,660 distinct entries.**

**Atlas / Download 段（Fig 2C 表级组织，全 entry 真值）**：

> The underlying Atlas build contains **5,321 display cases**, **18 searchable facets** and
> **six predefined views**, including a strict reference view, a structure-context-supported
> view, an exploratory view and a conflict-candidate review view. The download manifest
> provides **ten** tab-delimited tables, including a **5,321-row case-search index** and, at
> case–profile grain (5,321 cases × 256,929 profiles), an **18,751,213-row profile-membership
> table** together with residue-track, 2D-context and 3D-colouring route indices of the same
> size. Figure 2C illustrates the table-level organization, in which molecule identity, PDB
> identifier, chain, probing-profile availability, technique and confidence are presented
> together.

**决策更正（用户 2026-08-14，覆盖 §0/§5 的"结构段暂维持旧管线数"）**：论文进度**先于**部署
进度，正文应直接用 entry 库真值，不留旧管线膨胀数。旧 `4,070 / 498,275 / 192,298` 是旧
ANNOJOIN 3,610-case 子集在 `case×pair×profile` 粒度下的行数，与全语料 5,321 case 不自洽
（case 数 5,321 却只有 4,070 行检索索引，审稿人一眼可见矛盾），一律替换：

| 旧管线数 | 旧粒度（表头证据） | entry 真值 | 换算 |
|---|---|---|---|
| 4,070 case-search index | `case_id`（旧 3,610 case→4,070 行）| **5,321** | 一 display case 一行 |
| 498,275 profile-membership | `case × pair_id × profile_id` | **18,751,213** | distinct (pdb_id, profile_key) = 5,321 × 256,929 摊平 |
| 192,298 route index ×3 | `case × pair_id × profile_id` | **18,751,213**（同上）| 三个 route index 同粒度同行数 |
| 18 / 6 / 10 | schema 静态定义行（与语料规模无关）| **18 / 6 / 10** | 不变 |

**18,751,213 只声明一次**：membership 表与三个 route index 共享同一行数（正文用 "of the
same size" 引用，粒度 5,321×256,929 只写一遍）。旧表 `pair_id` 维度在 entry 合并后并入
chain，故 entry 口径退化为 `case×profile`，distinct (pdb_id, profile_key)=18,751,213。

---

## 7. 重建记录（本次）

- builder：`foldbridge.map.main/scripts/pipeline/case_merge/build_entry_atlas_db.py`
  （本日新增展示层 raw-token→pcat 兜底 map，TDD 37 tests）。
- 命令：`--out-db <tmp> --bio-tsv chain_atlas_20260812.tsv --lane rmdb:... --lane rasp:...`
  （external 无 case_lss_confidence，geo 走 bio-tsv external_* 列，非 lane）。
- 原子替换：tmp 同盘 → `mv -f` 覆盖 live。备份 `entry_atlas.duckdb.pre_pcatfallback_20260814`。
- 重建后计数不变（profile 20,440,377 / chain 17,837 / entry 5,321），仅 pcat 补齐
  hydroxyl_radical/Glyoxal/Terbium → 干净技术 29→32 token。
