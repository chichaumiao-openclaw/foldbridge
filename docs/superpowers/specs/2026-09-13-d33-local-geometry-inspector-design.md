# D3.3 局部几何 Inspector 设计

## 目标

在 FoldBridge Case Workbench 的既有 1D、2D、3D 残基联动中，为评审意见 D3.3 增加可核查的 sugar-pucker 与 base-stacking 注释，同时删除 Inspector 默认视图中重复、内部化或难以解释的字段。功能不得暗示静态几何与实验反应性之间存在确定因果关系。

## 范围

首版只修改普通 Case 的共享 Workbench 与新增的每链只读 sidecar：

- 复用现有 `renderInspector()`、残基选择和 hover 联动。
- 现有 2D 配对继续使用已经物化的 RNApdbee/RNAView 结果；当前 Case 资产未记录 RNAView 可执行程序版本，因此不重算、不替换现有 2D 资产，也不在页面上推断版本。
- Inspector 固定标明 `Pairing: RNAView (via RNApdbee)` 与 `Local geometry: DSSR`，不增加注释工具切换器。
- Inspector 顶部增加以选中残基为中心的前后各 5 nt 局部几何轨道。
- 为选中残基显示 pucker 类别、phase、amplitude，以及 DSSR 识别的 stacking partner。
- sidecar 保存全链计算结果；页面不在浏览器内计算几何。
- 不增加全链独立面板，不修改 Mol* 着色，不加入筛选或统计评分。
- 不显示 Family、Tier、confidence/LSS 或其他内部字段。
- E/F matrix 页面保持现状；它与 D3.3 stacking 不是同一科学对象。

## 科学语义

配对与局部几何是两条独立的注释来源：现有 2D 配对以 RNApdbee 导出的 RNAView 结果为准；固定版本 DSSR 只补充 pucker 与 stacking，不能改写 RNAView 配对，也不在页面中生成二者的共识结果。RNApdbee 平台版本与其调用的 RNAView 工具版本不是同一概念；当前 Case 配对资产未携带后者的版本 provenance，因此页面只标 `RNAView`。

几何注释来自固定版本 DSSR 的离线结果。首版把 DSSR `puckering`、`phase_angle` 和 `amplitude` 原样物化；stacking 边只来自使用 `--non-pair` 得到的 DSSR `nonPairs[].stacking`，不得把可能包含多个核苷酸的 `stacks` 集合展开成任意 pair。每条边保留 DSSR 的 `pm/mp/mm/pp` 类型原文，例如 `pm(>>,forward)`；链与序号得到的 `three_prime_adjacent`、`five_prime_adjacent`、`non_adjacent_intrachain` 或 `interchain` 只是另一个拓扑字段，不得冒充 stacking 面类型，也不得伪造 DSSR 未提供的 FR3D `s35/s53/s33/s55`。

每个 sidecar 必须记录 schema、DSSR 版本、容器镜像名和镜像 ID、DSSR 命令、源结构 SHA-256、受控 DSSR 输入 SHA-256、Case/Chain 身份、model 规则和 altloc 规则。`structureSha256` 标识完整源结构文件，`dssrInputSha256` 标识按 model/altloc 规则生成并实际交给 DSSR 的受控输入；二者是独立 provenance，允许不同，均使用 64 位小写十六进制。model 固定为 `_atom_site` 中首个出现的 model，与 Workbench alignment crop 一致；该 model 的 altloc 行原样保留并交给固定版本 DSSR 处理，sidecar 明示 `preserve_input_altlocs_dssr_managed`，不把 DSSR 内部选择伪装成 FoldBridge 自有规则。

身份歧义、重复映射、Case/Chain 不一致或 sidecar 与 linked-view residue 集不能完整对账时，整链构建失败。身份对账成功但 residue 缺少坐标、DSSR nucleotide 或完整 pucker/stacking 输出时，才物化 residue 级 `not_computable`，不能留空、填零或回退为猜测值。

## Sidecar 契约

路径：`chains/<CHAIN>/linked-view/local-geometry.json.gz`。

顶层字段：

- `schemaVersion`: 固定为 `foldbridge-local-geometry.v1`。
- `caseId`、`chainId`。
- `source`: `tool`、`toolVersion`、`containerImage`、`containerImageId`、`command`、`structureSha256`、`dssrInputSha256`、`modelId`、`modelPolicy`、`altlocPolicy`。其中 `structureSha256` 是完整源结构摘要，`dssrInputSha256` 是 DSSR 实际受控输入摘要；两者必须分别记录，不要求相等。
- `residues`: 按 `position`、`residueKey` 稳定排序的全链记录。

残基记录：

- `residueKey`、`position`、`base`、`locator`；locator 包含 model、label/auth chain、label/auth sequence、insertion code 和 component identity。
- `pucker`: `status=computed` 时包含 `class`、`phaseDeg`、`amplitudeDeg`；否则包含 `status=not_computable` 和 `reason`。
- `stacking`: 对象。`status=computed` 时包含 `partners`；无法判断时包含 `status=not_computable` 和 `reason`。空 `partners` 明确表示 DSSR 成功分析但没有报告 stacking partner。
- 每个 partner 包含 `partnerResidueKey`（跨链时为 `null`）、完整 `partnerLocator`、`partnerPosition`（跨链时为 `null`）、`partnerBase`、ASCII `topology`、原始 `dssrStackClass`、`overlapArea`、`ringOverlapArea` 和 `sourcePairIndex`。数值必须有限，同一 residue 下 partner identity 与 DSSR 类型的组合必须唯一。

构建器以生产 `linked-view.json.gz` 的 residue index 与 structure-context locator 为页面身份来源。`modelId` 的权威来源是 prepare 阶段元数据及与其摘要一致的受控 DSSR 输入；structure-context locator 可以不提供 model，若显式提供则只作一致性交叉校验，必须等于受控 model。sidecar locator 始终写入该受控 `modelId`。

`componentId` 的权威来源是显式非空的 `residueIndex.compId`；structure-context locator 可以不提供 component，若显式提供则只作一致性交叉校验，必须等于 `residueIndex.compId`。构建器必须继续把该 component 与唯一 `_atom_site` residue 的 component 严格对账，禁止从 `parentBase` 推测 component。

构建器同时解析选定 model 的 mmCIF `_atom_site`，用 model、auth chain/sequence、insertion code 和 component identity 对应 DSSR nucleotide，再通过 label chain/sequence 一对一连接 linked-view。任何身份层无法形成唯一对应时整链失败，而不是任选命中项。输出 residue 集必须与当前链 residue index 完整一致。

## Inspector 信息结构

默认视图由三部分组成：

1. 标题：单一 Residue 身份和 coordinate 状态；Profile/PDB 碱基不一致时才显示警告。
2. Local context：最多 11 nt 的连续序列窗口；链端直接截断，不保留空槽。每格显示 residue、pucker 简写和可访问标签；除链端外选中 residue 居中。窗口内 stacking 以可见 partner 标记表示；窗口外同链 partner 以可点击跳转项显示；跨链 partner 只读显示 chain/locator，不扩展跨链导航。点击当前链任一 residue 继续使用既有 1D/2D/3D selection。
3. 详情：`Reactivity`、`Local geometry`、`Interactions` 三组；技术 provenance、完整 PDB locator、model/altloc 说明及异常原因放进折叠的 `Annotation details`。

现有字段合并规则：

- `Profile base`、`PDB polymer base`、`Sequence agreement` 合并到标题；正常一致时不重复显示。
- `3D coordinate status` 与 `Observed mask` 合并为一个 coordinate 状态；`Structure state` 中的 selected 状态删除，stem/loop 若保留则进入 `Interactions`。
- `PDB polymer residue`、`Structure locus`、`3D coverage` 移入折叠详情。
- `Bridge membership`、`Interaction endpoint` 的内部 key 不再作为默认科学结果展示；可读的 pairing/stacking 关系取代它们。
- `Raw value`、`Normalized value` 保留；`Assay state` 仅以可读的 target-base 语义呈现。

## 加载与错误处理

Workbench 并行请求 sidecar。404 表示该链尚未物化，Inspector 明示 `Geometry annotations unavailable for this chain`，其余 Case 功能继续工作。文件存在但 schema、身份或字段非法时，显示 `Geometry annotations invalid` 并保留错误原因；不得静默当作 404。

残基级状态独立：sidecar 可用但某个 residue 不可计算时，pucker 与 stacking 分别显示自己的 `not_computable` 原因。`stacking.status=computed` 且 `partners=[]` 表示已计算但没有 partner；不得与不可计算混同。缺失值不使用零、空字符串或邻近 residue 代替。

## 发布边界

共享源文件属于 `entry-cases/__entry_v3_site__/`，发布前必须通过 `scripts/version-ef-entry-assets.mjs` 更新完整指纹闭包。每链 sidecar 属于 Case/Tunnel 数据，不属于 Pages。上线验收包括本机 GET、公共 GET、OPTIONS、普通 Case 浏览器加载、sidecar 缺失/非法状态，以及从局部轨道选择 residue 后的 1D/2D/3D 联动。

## 验收标准

- 选择任一有注释 residue，可同时看到精确 pucker 数值与所有 DSSR stacking partners。
- Inspector 明示配对来自 RNAView（经 RNApdbee）、局部几何来自 DSSR，且页面不存在注释工具选择器；不把 RNApdbee 平台版本写成 RNAView 工具版本。
- 现有 2D 配对资产及其渲染结果不因 DSSR sidecar 而改变。
- 局部轨道固定显示最多 11 nt；链端正确截断；窗口外 partner 可跳转。
- 无注释、不可计算、身份冲突三类状态可区分。
- 默认 Inspector 不再呈现重复字段或内部 interaction/bridge key。
- sidecar 构建输出在相同输入下字节稳定，且记录完整 provenance。
- E/F matrix、Profile/Technique、1D/2D/3D 和 Reference 既有行为无回归。
