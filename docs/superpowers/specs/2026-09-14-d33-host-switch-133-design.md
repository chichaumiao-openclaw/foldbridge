# D3.3 全量计算切换到 133 设计

## 目标

在 `10.40.0.132` 暂时不可访问时，把 D3.3 DSSR 全量候选计算切换到
`10.40.0.133`，不重新传输已验收的 14 GB 输入，也不触碰 132 遗留的候选、锁或状态。

## 已确认边界

- 输入继续使用 `/data/sunhao/foldbridge-d33-full-20260913/input/cases`，密封清单为
  `/data/sunhao/foldbridge-d33-full-20260913/manifests/source-input-20260914.json`，SHA-256
  `6db80118d7db98ed0b9e83cf75bf3e79c3ad6a4c3b4a7503927a838c1e62f706`。启动前从
  133 输入重新生成清单并要求字节与 SHA-256 完全相同。
- DSSR 使用 `/data/hsBack/mytoo/DSSR-v1.9.10-linux.zip` 中的 Linux x86-64 二进制；
  实测版本必须为 `v1.9.10-2020apr23`。
- 二进制 SHA-256 固定为
  `c7261c0ab099e1f70c508c51363c7aa6915e216a78bb6d65ccda533092d6c39a`；压缩包
  SHA-256 固定为
  `3f9b8615caacd6372f3a900e77f2985b9190bc8e69f5dbc29d5b2be15908348b`。
- 在 133 以本地基础镜像构建独立 Podman 镜像；候选 provenance 记录新镜像名称、不可变
  image ID、DSSR 版本和原命令。不得伪装成 132 的旧 Docker image ID。
- 构建回执保存为 `ops/dssr-v1.9.10-podman/build-receipt-133.json`，记录 133、Podman、
  archive/binary/Containerfile/base image/final image 的哈希、DSSR 版本和命令；候选证据文档
  引用该回执及其 SHA-256。
- 新建独立的 sample、full candidate、work 和 lock 路径。132 的
  `full-candidate-current` 保留为中断证据，不 resume、不解锁、不覆盖。

## 数据流与验收

1. 在 133 构建并核对固定 Podman 镜像、image ID、DSSR 版本与二进制哈希。
2. 批处理 CLI 通过显式 `--container-runtime podman` 选择运行时；只允许 `docker` 或
   `podman`，不得自动 fallback。
3. 为快速切换先使用 1DDY 与 9A0D 双门槛；要求 1DDY/A `computed`、9A0D 的两个 Chain
   均为 `not_computable`、0 `failed`，并通过独立 verify。原 6 Case / 9 Chain 样本保留为
   132 的既有回归证据。
4. 对样本 sidecar 做语义对照；宿主机和容器实现细节可改变 provenance 字段，但残基
   pucker/stacking 数据不得漂移。
5. 样本通过后启动 133 全量新候选。全量失败必须保留在状态与 ledger 中，不能加入
   allowlist 或被静默跳过。

## 失败处理

- 镜像、二进制、版本、manifest 或样本任一不一致即停止，不启动全量。
- 133 全量使用新锁；已有 132 锁不参与 133 的进程存活判定。
- 先前发现的 6 个失败 Case 预计可能复现；主机切换不视为修复，后续按失败证据逐项处理。
