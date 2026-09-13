# Reviewer 回复证据索引

本目录集中保存评审意见对应的修复证据、复现协议和实现范围评估，供后续撰写 rebuttal
时引用。索引只陈述已经验证的状态；“已评估”不等于“已实现”，“候选通过”也不等于
“已上线”。

## C 类修复

| 评审项 | 当前结论 | 证据与复现入口 |
| --- | --- | --- |
| C1.5 主站与 Case 响应式布局 | GitHub Pages 与 Case/Tunnel 均已上线并复验 | [主站 C1.5 / C1.6 证据](2026-09-12-c1.5-c1.6-spa-evidence.md)、[Case C 类证据与复现协议](2026-09-12-c-case-evidence.md) |
| C1.6 旧式 Extended PDB ID 搜索 | 已上线；`pdb_00001ddy` 与 `1DDY` 在公网返回同一组 4 条链结果 | [主站 C1.5 / C1.6 证据](2026-09-12-c1.5-c1.6-spa-evidence.md) |
| C1.7 VARNA 缩放与双轴滚动 | Case/Tunnel 已上线；140% 双轴滚动与 1:1 复位已复验 | [Case C 类证据与复现协议](2026-09-12-c-case-evidence.md) |
| C1.8 Technique 筛选反馈 | Case/Tunnel 已上线；提示筛选结果，不自动切换 Profile 或重绘其他视图 | [Case C 类证据与复现协议](2026-09-12-c-case-evidence.md) |
| C1.9 废弃 RDAT / RMDB raw heatmap | Case/Tunnel 已上线；不公开 RDAT，也不请求退役资源 | [Case C 类证据与复现协议](2026-09-12-c-case-evidence.md) |
| C3.2 反应性三状态 | Case/Tunnel 已上线；missing、finite `<= 0`、positive 在 1D/2D/3D 使用同一分类 | [Case C 类证据与复现协议](2026-09-12-c-case-evidence.md) |

主站与 Case 使用两条独立发布链：主站由 `ghhttps/main` 的 GitHub Pages 提供，Case 由
私有 Case document root 经本机静态服务和 Tunnel 提供。因此上表分别记录上线状态，不能用
其中一条链的成功代替另一条链的验收；本机绝对路径不进入对外 reviewer 索引。

本批次两条生产链的提交、运行、哈希、回滚点和已知限制统一记录在
[2026-09-13 C 类生产发布记录](2026-09-13-c-production-release.md)。

## D 类范围评估

[D 类功能实现范围评估](2026-09-12-d-class-scope-assessment.md)覆盖 D3.3、D3.4、D3.6。
当前状态是**评估与依赖盘点已完成，D 类功能尚未实现或上线**：

- D3.4 E/F exact JSON.gz + long CSV 为下一批首选，预计 S；
- D3.6 同一 PDB×chain 的 2–4 Profile 描述性比较为第二顺位，预计 M；
- D3.3 先做离线几何 sidecar pilot，并在开始前通过工具许可和科学验证 gate；
- 显著性检验暂不承诺，需先补齐 condition、replicate、sample size 和 per-position error。

## Rebuttal 引用边界

- 可以写：C 类候选与线上发布均有自动测试、静态闭包、真实浏览器和可回滚发布证据。
- 可以写：D 类已完成数据、依赖、风险、工作量和推荐顺序评估。
- 不应写：D3.3、D3.4 或 D3.6 已实现、已发布，或已有数据足以支持显著性检验。
- 引用 C 类结论时，应同时给出评审项、证据文档、验证日期和对应线上 URL，不只引用提交号。
