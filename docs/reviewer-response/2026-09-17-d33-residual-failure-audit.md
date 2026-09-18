# 2026-09-17 D3.3 全量候选残留失败审计

## 状态与结论边界

2026-09-18 交接更正：本文后续将 `parentBase` 与结构 canonical 不同称作“上游身份矛盾/错误”的表述尚无充分依据。`parentBase` 可能来自 Profile，须先追溯字段语义。当前 N/residueBase 比较也是待复核候选，不是已确定契约。最新执行入口见 [D3.3 交接](2026-09-18-d33-handoff.md)。

### 后续审查更正与当前修复方向

本节优先于下文的历史统计描述。此前“241 个失败全部查清并修复”不成立：五类是首个
失败签名的分类，不代表每个 Case 只有一个问题，也不代表全部真实样本已经验收。
`7NAT` 的 component 候选修复后，失败位置从 1516 变为 516，说明同一 Case 仍有其他
冲突。不得将单元测试通过解释为真实 Case 通过。

| 类别 | 修复方向 | 当前代码与验收状态 |
| --- | --- | --- |
| component 身份 | 分离 Profile base、结构序列 base、实际 chemical component；先核对同一结构残基的化学身份与明确父组分证据 | `buildLinkedChain` 的 DSSR canonical-code 交叉验证仍为候选；7NAT 尚未通过，不宣称覆盖 151 Case |
| coverage | 追踪 linked-view 生成源及结构编号关系；只有可证明的一一映射才能修复 locator 和 coordinateStatus | 恢复 `matchedAtomIdentities` 与额外 polymer 坐标检查；取消检查的旧候选已撤回；8RCS/71 上游修复未完成 |
| DSSR 长 component | 核实 v1.9.10 的截断行为、版本范围和同一 author locus 的冲突；保留完整 mmCIF component | `buildDssrIndex` 三字符匹配为待验收候选，不凭前缀测试通过宣称真实结构成功 |
| 微异质身份 | 将歧义判定放在实际消费身份的步骤，保留目标 label 和 DSSR author identity 唯一性 | 已确认四个样本是非目标蛋白 VAL/SER altloc；延迟检查仍需真实 Case 和目标歧义负例验收 |
| malformed CIF | 保留损坏 category、输入哈希和失败证据，独立核验原始输入；任何修复输入必须重新密封 manifest | 已取消静默丢弃 anisotrop loop；`PREPARE_MALFORMED_ATOM_SITE` 保持 `status=failed`，不得算作结构性 not_computable |

本轮已完成的代码纠正：

- `scripts/local-geometry-sidecar-lib.mjs`：恢复同作者链 polymer coverage 检查，所有不完整
  loop 均拒绝，错误消息保留首 tag。
- `scripts/local-geometry-batch-lib.mjs`：移除 malformed 的 intrinsic-unavailable 放行；
  即使旧 receipt 被写为 not_computable，resume 仍重新拒绝该损坏输入，且不调用 DSSR。
- `test/local-geometry-sidecar-builder.test.js` 与 `test/local-geometry-batch.test.js`：三个
  更正测试均观察到 RED，修复后 D3.3 四文件定向套件为 85/85 通过。这是本地测试结果，
  不代表 241 个真实 Case 验收。

随后补充目标 polymer 微异质与重复 DSSR author identity 的拒绝测试，最终定向套件
87/87 通过，`git diff --check` 通过。纠正脚本已通过 scp 同步到 132，双端 SHA-256 相同：

- sidecar library：`0c538fe2018d8f09731b7d74fb194d82271ce8067951bdca8013b0fb27244e77`
- batch library：`eaade1a133ced54c7de1cac32c14fce134dee6ff0d627c2d0dcfd7bcc883ac57`

同步前确认无本任务活跃批次。本轮没有发布生产页面，也没有启动新的全量重跑。

当前不启动新一轮全量重跑。先核实样本、完善其余候选修复，再生成受影响 Case 清单。
此前算式 765 + 169 + 4109 = 5043 是各目录状态/receipt 计数相加；当时未完成可复现的
跨目录 Case ID 互斥、并集及所有输出哈希审计，因此只能称“报告的 computed 数”，
不能称“已经全量验证的成功数”。

本记录冻结 D3.3 全量 DSSR 局部几何候选在第一轮修复重跑结束后的真实状态。它是修复
输入和后续 rebuttal 证据，不代表候选已经通过全量验收，也不代表网站已经上线。

## 2026-09-18 修复批次

本地候选新增了结构序列证据校验：对具有完整 `_struct_asym`、`_entity_poly`、
`_entity_poly_seq` 和 `_atom_site.label_entity_id` 的 mmCIF，modified component 只能在
同一 entity、同一 polymer position 的 monomer 记录明确支持时映射到 linked canonical
component；DSSR canonical code 与该证据冲突时直接失败。没有完整结构序列证据时，仍要求
DSSR 对同一 atom identity 给出一致 canonical code，不能静默放宽。

新增实体映射冲突、monomer 冲突和 DSSR 矛盾反例；D3.3 四文件定向套件当前为 88/88
通过，`git diff --check` 通过。另新增隔离真实样本门禁脚本
`scripts/d33-repair-sample-gate.mjs`，保留每个 Case 的 DSSR input/output/error 证据，
不覆盖旧候选目录。真实样本门禁结果见下节；生产状态不变。

### 代表样本门禁结果（2026-09-18）

132 恢复后，最新脚本上传到 `/data4/sunhao/foldbridge-d33-fix-20260917-canonical/`，
并对 `7NAT`、`8OIN`、`8YUO` 做了隔离门禁。DSSR 输出已保留，后续重放逐字节复用了
相同 input/output，没有重复计算。`PSU -> P` 的 DSSR 非 canonical 代码已被正确识别为
modified residue 标记；`linked compId=N` 仅在结构序列证据与 `parentBase` 一致时接受。

修复后三个样本仍被严格拒绝，但失败位置发生了变化：

| Case | 当前失败位置 | 证据结论 |
| --- | --- | --- |
| 7NAT | A/1518 | linked `compId=N,parentBase=C`；原始 mmCIF `_entity_poly_seq` 为 `MA6`、canonical `A`，上游身份矛盾 |
| 8OIN | AA/426 | linked component 与结构位置的 canonical/modified 证据不一致，待单独核对 |
| 8YUO | V/16 | linked component 与结构位置的 canonical/modified 证据不一致，待单独核对 |

这说明 component 修复已穿过 7NAT 的 A/516、A/527 等先前阻塞点，但不能把样本整体算作成功；
当前正确行为是保留 `BUILD_FAILED` 和证据，继续修复 linked-view 上游身份或建立明确的人工复核清单。
生产页面仍未发布。

截至 `2026-09-17T01:48:18Z`，132 上已无本批次 Node 或 DSSR 进程。5,321 个 Case 的
历史计数算式为（互斥性和输出完整性待统一审计）：

```text
765 seed computed receipts
+ 169 formal-shard computed receipts not present in wave2
+ 4,109 wave2 computed
+ 37 reported not_computable
+ 241 unexpected failed
= 5,321 total Case
```

因此历史汇总的 computed 为 5,043 Case（94.8%），not_computable 为 37 Case，仍需
修复的 unexpected failed 为 241 Case。尚未执行统一 merge、full verify、全量 sidecar
schema/identity/provenance 验收或生产发布。

## 统计口径纠正

`wave2-96x2` 的 96 个 manifest 只包含 4,387 Case；正式 `partition-receipt.json` 记录的
未复用集合为 4,556 Case。二者相差的 169 Case 位于 16 个正式 shard 中，且每个都有
computed receipt。此前没有完成 ID 集合逐项对账；合并时必须证明其与 seed、wave2
集合互斥，不能只依据数量相等认定无遗漏或无重复。

因此，单独读取 wave2 的 status 文件不能回答全量进度；后续 merge 必须以密封的 5,321
Case source manifest、765 个已验证 seed receipt、169 个正式 shard receipt 和 wave2 的
4,387 个终态共同做按 Case ID 的互斥并集验证。

## 241 个失败的完整分类

下列计数来自 `attempts=2 && status=failed` 的全部终态，五类合计正好 241，没有归入
`other` 的未分类签名。签名齐全不等于每个 Case 的根因均已验证。

| 数量 | 失败签名 | 已核实证据 | 当前科学边界 |
| ---: | --- | --- | --- |
| 151 | `linked component identity does not match atom-site` | 7NAT/A/1516：linked `compId=G`，mmCIF `2MG`；8OIN/AA/844：linked `compId=U`，mmCIF `B8T` | canonical/modified component 对账规则不足；必须由结构字典或受验证的父组分关系判定，不能仅因 atom component 非 canonical 而放行 |
| 63 | `linked-view and atom-site target-chain residue coverage mismatch` | 8RCS/71：linked-view 将 1-19 标为 `sequence_only`，mmCIF 同一作者链有 1906-1924 的完整坐标 | linked-view 的链或编号映射与 mmCIF 冲突；不能把几何强行附到 1-19，也不能忽略额外坐标 |
| 20 | `DSSR nucleotide ... has 0 atom-site identities` | 代表标识包括 `X.A1L34`、`1w.A1B76` | DSSR author locator 未能唯一回映到 `_atom_site`；需核对 component、author numbering、insertion code 和 altloc，禁止邻近残基 fallback |
| 4 | `ambiguous _atom_site label residue identity` | 4V88：`model=1, label_asym_id=ZA, label_seq_id=3` 对应多个完整 residue identity | label 三元组本身不唯一；只有引入可验证的作者身份或 altloc 规则后才能计算，不能任选一个 |
| 3 | `mmCIF loop value count ... does not form complete rows` | 4WFB、9P9I、7QVP | 当前严格 parser 认为输入 loop 不完整；需与标准 mmCIF parser 及原始 gzip 完整性交叉验证，确认是 parser 缺陷还是文件损坏 |

## 已排除的错误做法

- 不按 PDB/Case ID 建 allowlist。
- 不把 malformed、ambiguous 或 identity mismatch 统一标成 `not_computable`。
- 不用 parentBase、邻近残基、第一条 atom row 或 DSSR 猜测替代缺失身份。
- 不因 DSSR 已产生 JSON 就跳过 linked-view/mmCIF 身份和覆盖对账。
- 不再用 `96 x 2` 理论并发估计完成时间；132 同期 load average 曾达到 739，实际吞吐必须
  由终态增量计算。

## 修复与验收顺序

1. 为每一类真实签名建立最小回归测试并观察 RED。
2. component mismatch 只接受由 mmCIF chemical-component 父组分证实的等价关系。
3. coverage mismatch 先判断是否存在可证明的整链编号变换；不能证明则保留明确失败。
4. DSSR locator 仅用完整 author identity、component 和 insertion code 做唯一映射。
5. ambiguous label identity 在补充身份字段后仍不唯一时保留失败。
6. malformed mmCIF 使用独立标准 parser 交叉验证；确属损坏才定义可审计状态。
7. 只重跑受影响的 241 Case；随后 merge 5,321 Case 并执行 full verify 与零调用
   resume-check。

## 上线门槛

只有以下条件全部满足，D3.3 才能从“修复中”改为“候选通过”：

- 5,321 Case、14,952 Chain 与密封 manifest 完全闭合；
- 0 unexpected failed；
- computed、not_computable、malformed、ambiguous 等状态不混用；
- 所有 sidecar gzip、schema、Case/Chain identity、input hash 和 DSSR provenance 验证通过；
- fail-closed resume-check 产生 0 次新 DSSR 调用；
- 真实 Case Inspector 验证 pucker、stacking、无 partner、跨链 partner 和不可计算状态。
