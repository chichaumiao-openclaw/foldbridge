# D3.3 Data4 NVMe 全量重算设计

## 目标

在 `10.40.0.132` 的本地 NVMe `/data4` 上完成 D3.3 全站局部几何候选，复用 133 已经
验证的 computed receipt/sidecar，避免重算已完成 Case，并绕开 133 当前单进程和共享存储
瓶颈。计算阶段以一小时内完成为目标，但不得为赶时间降低身份、provenance 或完整性门槛。
最终候选必须覆盖密封 manifest 中的 5,321 个 Case、14,952 个 Chain，并通过统一
provenance、完整 inventory 和独立全量 verify。

## 当前边界

- 132 的旧候选 `full-candidate-current` 仅保留为中断证据，不恢复、不解锁、不合并。
- 133 的 `full-candidate-133-v1910` 当前停在 752 computed、339 failed、32 running、
  4,198 pending；最近十分钟无状态更新且无活跃 DSSR 子进程。它只保留为诊断证据，
  其中通过 receipt 与输出哈希验证的 computed 结果可以作为缓存导入 132；failed、running
  和 pending 状态不得导入。
- 生产输入仍由 `source-input-20260914.json` 定义：5,321 Case、14,952 Chain，manifest
  SHA-256 为 `6db80118d7db98ed0b9e83cf75bf3e79c3ad6a4c3b4a7503927a838c1e62f706`。
- 132 `/data4` 是本地 ext4 NVMe，可用空间约 1.3 TB；主机有 192 个 CPU 和约 1.9 TiB
  可用内存。

## 运行架构

1. 在 `/data4/sunhao/foldbridge-d33-full-20260915/` 建立全新根目录，不覆盖任何 `/data`
   候选。
2. 从共享 `/data` 按密封 manifest 将 20,273 个输入文件复制到 `/data4`，随后重新生成
   manifest，并要求路径、大小、SHA-256 和总计完全一致。
3. 将 133 的固定镜像归档通过 `scp` 拉到 `/data4` 并加载到 132 Docker。启动前重新验证
   image ID 必须为 `sha256:259aba597ceac6d3072cc08585fa5284db8d4712cb768a02b7ef3471b8aa0853`、
   DSSR `v1.9.10-2020apr23`、二进制 SHA-256
   `c7261c0ab099e1f70c508c51363c7aa6915e216a78bb6d65ccda533092d6c39a` 和固定命令。
4. 在 `/data4` 初始化完整候选状态，将 133 中通过 `verifiedReceipt()` 同等规则验证的
   computed receipt/sidecar 导入；导入过程不得复制 133 的 ledger、failed receipt 或
   running/pending 状态。
5. 将尚未完成的 Case 确定性拆为 16 个互不重叠分片。每片使用独立 input root、manifest、
   expected-unavailable、candidate、work root 和锁；每片 11 并发，总 DSSR 上限为 176，
   其余 16 核留给 Node、gzip、Docker 与哈希校验。
   多进程同时并行 DSSR 与 sidecar 构建，避免单个 Node 事件循环阻塞全部 worker。
6. 先运行覆盖普通链、修饰核苷、大型复合物和 9A0D 不可计算语义的小型门槛。门槛通过
   后，再对 133 的全部失败签名选择真实代表 Case 做回归门槛；这些门槛通过后才启动
   16 个正式分片。
7. 每个 shard input root 只包含本片 Case；从该 root 独立生成 shard manifest，并按 Case
   过滤 expected-unavailable。partition receipt 必须证明 Case/Chain 并集等于完整 manifest、
   分片两两不相交，且每个输入描述符与密封 full manifest 一致。
8. 每片完成后独立 verify。使用专用 merge 子命令验证完整分区、统一 provenance、receipt
   和输出哈希，将已复用结果与各片结果合并，并从完整 manifest 和合并状态确定性生成
   final ledger；分片 ledger 不参与合并。
9. merge 后先做完整 verify，再运行 fail-closed 的 resume-check；任何无效 receipt 都直接
   失败，禁止静默调用 DSSR 补算。
10. 对 final candidate 运行全量 sidecar 解压/schema/Case/Chain/provenance 校验、gzip 测试、
    inventory 恒等式和代表 Case 浏览器验收。

## Provenance 规则

- 八个分片必须使用同一个 Docker image ID、DSSR 版本、二进制哈希和命令。
- sidecar 继续记录完整源结构 SHA-256、受控 DSSR 输入 SHA-256、model/altloc 规则和工具
  provenance。
- 只复用与 132 已加载 image ID 完全相同的 133 receipt/sidecar；不同容器 image ID 不得
  混入同一个最终候选。
- RNAView 配对数据保持不变；DSSR 只提供 pucker 和 stacking，不生成跨工具共识。

## 失败与停止规则

- 停止 133 前先记录最新状态计数、进程树、ledger/状态目录摘要和锁 owner；发送 SIGTERM
  并确认 Node、Podman、DSSR 子进程全部退出。允许正常退出自动释放锁；不得人工 unlock、
  删除候选或重启该批次。
- 输入 manifest、镜像、版本或门槛任一不一致即停止，不启动正式分片。
- 现有 BUILD_FAILED 不能加入 allowlist。先按失败类型修复映射语义并通过回归测试，再重新
  运行受影响分片。
- 分片失败保留 receipt、状态和日志；禁止用空值、零值或邻近残基替代缺失几何。
- 只有预先定义且经验证的结构不可计算情况可以是 `not_computable`；最终 unexpected
  `failedCases` 必须为 0。

## 上线门槛

- full manifest、final ledger、receipt、sidecar 和输入 inventory 逐项闭合。
- 所有 sidecar 通过 schema、身份、SHA-256 和 gzip 验证；完整 `--resume true` 为零次
  DSSR 新调用。
- Inspector 对 computed、not_computable、无 stacking partner、跨链 partner 和未物化
  状态的展示通过真实 Case 验收。
- 候选通过后才按网站维护手册进入同卷 staging、回滚清单、原子替换和 Tunnel 公网验证；
  本规格不授权提前写入生产目录。
