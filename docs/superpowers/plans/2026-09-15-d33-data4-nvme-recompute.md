# D3.3 Data4 NVMe 全量重算实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 132 `/data4` 复用 133 已验证结果，并以 16 个独立进程完成 D3.3 全量候选和验证。

**架构：** 先冻结 133 并复制密封输入与成功缓存到 NVMe；修复已知映射失败后，将未完成 Case 确定性分成 16 片，以 176 个 DSSR worker 运行。专用 merge/validate 将分片收口为一个完整、统一 provenance 的候选。

**技术栈：** Node.js ESM、Docker、DSSR v1.9.10、JSON/gzip、SSH/SCP、ext4 NVMe。

---

## 文件结构

- 修改：`scripts/local-geometry-sidecar-lib.mjs`，修复经真实失败样本证明的映射语义。
- 修改：`scripts/local-geometry-batch-lib.mjs`，提供确定性分片合并和完整 payload 校验能力。
- 修改：`scripts/build-local-geometry-batch.mjs`，暴露 merge/validate/resume-check 子命令。
- 修改：`tests/local-geometry-sidecar.test.mjs`，覆盖失败签名的最小回归。
- 修改：`tests/local-geometry-batch.test.mjs`，覆盖分区、合并和禁止隐式补算。
- 创建：`/data4/sunhao/foldbridge-d33-full-20260915/`，132 NVMe 运行根目录。

### 任务 1：冻结 133 并建立 NVMe staging

- [ ] 记录 133 状态计数、进程树、锁 owner 和成功 receipt 清单。
- [ ] SIGTERM 停止 PID 3978477，并确认 Node/Podman/DSSR 全部退出。
- [ ] 通过 manifest 将完整输入复制到 `/data4`，重新生成清单并验证 SHA-256 完全一致。
- [ ] 导入 133 中验证通过的 computed receipt/sidecar；不复制 failed/running/pending 状态。
- [ ] 验证 Docker image ID、DSSR 版本、二进制哈希和固定命令。

### 任务 2：修复已知 BUILD_FAILED

2026-09-17 更正：五类候选方案及代码状态以残留失败审计的“后续审查更正与当前修复方向”
为准。已恢复 coverage gate、撤回 malformed 放行和 anisotrop 静默丢弃；本地定向测试
85/85 通过，真实 Case gate 尚未通过。先完成 component 实例审计、linked-view 上游编号
修复、DSSR 截断冲突负例及微异质目标负例，再启动定向重跑。全量状态计数需额外按 Case ID
去重和哈希验收，不以目录计数相加代替。

- [x] 按错误签名汇总第一轮修复重跑后的 241 个失败并选择每类真实代表 Case；冻结证据见
  `docs/reviewer-response/2026-09-17-d33-residual-failure-audit.md`。
- [x] 对 DSSR 零核苷酸样本核对 mmCIF 原子组成；仅将 P-only 或缺少必要糖环/碱基原子的
  合法输出分类为 `not_computable`，不得按 Case ID 静态放行。
- [x] 完成 P-only、缺失 insertion code 和同作者链非 polymer partner 三类修复，定向测试
  79/79 通过；第一轮重跑产生 5,043 computed、37 not_computable、241 failed。
- [ ] 为第一类根因添加最小失败测试并运行，确认 RED。
- [ ] 实施单一最小修复并运行测试，确认 GREEN。
- [ ] 逐类重复，禁止把异常加入 allowlist。
- [ ] 对 241 个残留失败 Case 运行门槛，要求 0 unexpected failures。
- [ ] 提交代码与测试。

### 任务 3：实现分区与合并验证

- [ ] 为分片完整性、互斥性、provenance 不一致、receipt/hash 不一致添加失败测试。
- [ ] 运行测试确认 RED。
- [ ] 实现 merge/validate/resume-check 最小逻辑。
- [ ] 运行定向测试和 D3.3 全套测试确认 GREEN。
- [ ] 提交代码与测试。

### 任务 4：运行 132 全量分片

- [ ] 生成 16 个互不重叠 shard root、manifest、expected-unavailable 和 partition receipt。
- [ ] 运行代表样本与失败签名门槛。
- [ ] 启动 `16 × 11` worker，并记录每片 PID、日志和起始时间。
- [ ] 监控 computed/failed/running/pending、CPU、iowait、Docker 进程和预计完成时间。
- [ ] 每片结束后独立 verify；任何 unexpected failure 均保留证据并定向处理。

### 任务 5：合并与上线前验收

- [ ] 合并成功缓存和 16 个分片，生成完整 final ledger。
- [ ] 运行 full verify、payload schema/身份/provenance 校验和全部 gzip 测试。
- [ ] 运行 fail-closed resume-check，确认零 DSSR 新调用。
- [ ] 核对 5,321 Case、14,952 Chain、0 unexpected failed 和完整 inventory。
- [ ] 使用代表 Case 验证 Inspector 的 pucker、stacking、无 partner、不可计算和跨链状态。
- [ ] 更新 reviewer-response 证据；生产发布另按维护手册执行。
