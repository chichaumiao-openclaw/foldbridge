# 2026-09-14 D3.3 局部几何生产发布证据

## 状态与结论边界

本轮生产发布尚未开始。本文记录已经闭合的样本与候选界面证据；全量计算在第一轮修复
重跑后仍有 241 个 unexpected failed，详见
[2026-09-17 D3.3 残留失败审计](2026-09-17-d33-residual-failure-audit.md)。只有全量候选通过且
GitHub Pages 与 Case/Tunnel 两条生产链均通过后，才会把结论更新为「已上线」。DSSR
输出是局部几何注释，不代表 RNAView 与 DSSR 的跨算法共识。

## 科学与界面范围

- 现有 2D 配对继续使用 `RNAView (via RNApdbee)`，不推断 RNAView 的工具版本。
- Inspector 新增 DSSR sugar-pucker 与 base-stacking 局部证据，不增加注释工具切换器。
- 不同来源在 Inspector 固定标为 `Pairing: RNAView (via RNApdbee)` 与
  `Local geometry: DSSR`。
- 同链局部窗口最多显示 11 个核苷酸；窗口外同链 stacking partner 可以跳转，跨链
  partner 只读。

## 全量输入边界

- source manifest：5,321 个 Case、14,952 个 Chain。
- 输入文件：5,321 个 `structure.cif.gz` 与 14,952 个 `linked-view.json.gz`，共
  20,273 个文件、14,138,773,275 bytes。
- source manifest SHA-256：
  `6db80118d7db98ed0b9e83cf75bf3e79c3ad6a4c3b4a7503927a838c1e62f706`。
- 输入从该 manifest 建立同卷硬链接 staging，再按互不重叠的 Case 目录执行 4 路并行
  `scp`；不递归复制 `profiles` 或其他 Case 资源。

## 代表样本与批处理约束

- 132 中断前固定镜像：`rnark-structure-tools:phase6b-rnaview2-dssr`。
- 镜像 ID：
  `sha256:f5ee5eb16e5638cbd81c16dc6e224feac392754349c8a3956a2941b9a351feaf`。
- DSSR：`v1.9.10-2020apr23`。
- 命令：
  `/usr/local/bin/x3dna-dssr --json --more --non-pair -i=/work/input.cif -o=/work/output.json`。
- 132 暂时不可访问后，全量候选切换到 133 的 Podman 镜像
  `localhost/foldbridge-dssr:v1.9.10-c7261c0a`，image ID
  `sha256:259aba597ceac6d3072cc08585fa5284db8d4712cb768a02b7ef3471b8aa0853`。镜像内
  DSSR 版本仍为 `v1.9.10-2020apr23`；二进制 SHA-256 为
  `c7261c0ab099e1f70c508c51363c7aa6915e216a78bb6d65ccda533092d6c39a`。完整构建回执见
  `ops/dssr-v1.9.10-podman/build-receipt-133.json`，该回执 SHA-256 为
  `b0a7c966fbf9ba39a862eff2e1fc41be82bb73a5d1ef1ef4e12aa189e0458d03`。
- 133 快速门槛为 2 Case / 6 Chain：1DDY 的 4 个网站 Chain 均 computed；9A0D 的
  2 个 Chain 均按 `PREPARE_NO_ATOM_SITE` not_computable；0 failed，独立 verify=true。
- 133 全量独立候选已于 `2026-09-14T09:15:01Z` 以 32 并发后台启动，PID `3978477`；
  输出为 `full-candidate-133-v1910`，不复用或改写 132 中断候选。
- 6 个 Case / 9 个 Chain 的样本批次：5 个 Case / 7 个 Chain 为 `computed`；9A0D
  的 2 个 Chain 因 `PREPARE_NO_ATOM_SITE` 显式记为 `not_computable`；0 个失败。
- 样本独立 `verify` 通过；覆盖修饰核苷身份、DSSR 斜杠编号、跨链核苷配体与
  `--resume`。

## 生产写入前浏览器验收

候选页面只读复用当前生产 Case 数据，并覆盖联合共享资产
`20260913-reviewer-d33-d34-d36-1` 与候选 sidecar；没有写入生产目录。

| 状态或行为 | 真实浏览器结果 |
| --- | --- |
| 可计算 | 8SQ9/P 的 G4 显示 C3'-endo、phase `11.093°`、amplitude `38.002°`，并显示 U5 stacking partner |
| 未物化 | sidecar 返回 HTTP 404，Inspector 显示 `Geometry annotations unavailable for this chain` |
| 非法数据 | 非法 `schemaVersion` 被明确拒绝并显示错误，不回退为可用数据 |
| 残基不可计算 | pucker 与 stacking 分别显示 `not_computable` 及原因 |
| 已计算但无 partner | stacking 显示 `No DSSR stacking partners.`，不误写为不可计算 |
| 跨链只读 | 8SQ9/P 的 A9 显示 `G at T:130 (cross-chain; read only)`，不生成跳转按钮 |
| 窗口外同链跳转 | 10FZ/A 从 A7 的 `A298 outside window` 跳转到 A298，反向入口为 A7 |
| 既有联动 | 1D 选择同步更新 Inspector 与 3D selection；2D 键盘选择 U20 后三者均更新为位置 20 |

上述候选页面的浏览器 warning/error 日志为空。9A0D 使用旧的
`__entry_1d3d_site__` 页面；它没有被本轮普通 Case Inspector 伪装成可计算，批处理 ledger
仍以 `PREPARE_NO_ATOM_SITE` 保存其明确不可计算状态。

## 待闭合的生产证据

- 远端完整输入清单与 source manifest 的逐路径、大小和 SHA-256 对账。
- 全量 ledger、0 失败恒等式与 `--resume` 零次 DSSR 新调用。
- 同卷候选、回滚清单及生产 sidecar / 共享资产逐文件哈希。
- Git commit、远端 `main`、Pages build 和公网资产字节闭合。
- Tunnel 本机 / 公网 GET、OPTIONS 与上线后真实浏览器复验。
