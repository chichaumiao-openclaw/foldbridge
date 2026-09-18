# E1.3 / E1.4 网站一致性修复

## 状态与边界

实现分支：`codex/e-consistency`；起点：`eb9c01ffb070665d314a030448aad23dcdea9bc4`。2026-09-14 已上线 `57242e6d780e789b3eb6e9a426671b193cb229e2`，Pages built、公网内容与浏览器验证均通过。
不包含 E0.1 维护政策，不修改 D3.6，也不修改稿件。后续按用户指定补充了 E0.1 数据提交联系入口，见下文。

## E0.1 数据提交联系入口

Help 新增独立的 Data submission 区块，说明用户可邮件联系苗智超研究员沟通数据提交；显示邮箱 `miao_zhichao@gzlab.ac.cn`，链接为对应 `mailto:`。保留原通用联系邮箱，不自动发送邮件。

此项只补充数据提交沟通渠道，不表示已建立自动提交系统，也不承诺维护周期或审核时限。E0.1 中维护与更新计划仍需另行说明。邮箱已在公网 Help 验证。

新增回归测试验证提交区块、邮箱链接、联系人及原通用邮箱；连同原相关测试共 44 项通过。

## 已实现

- E1.4：正式名称为 Ribocentre-FoldBridge，简称为 FoldBridge。浏览器标题和共享页头显示正式名称；首页和 Help 首次介绍定义简称；导航、按钮继续使用简称。
- E1.3：在 Probing 的人工说明、卡片摘要、正文、PPT 标题与图注中渲染科学术语斜体。有限词表包括 in vivo、in vitro、in situ、in silico、ex vivo、de novo、E. coli、Escherichia coli、Arabidopsis thaliana、Saccharomyces cerevisiae。
- 渲染前转义文本；代码片段、标识符、DOI、链接和原始文章 JSON 保持不变。图片内嵌文字不在本次范围内。
- E1.3 原意见针对 manuscript；网站修复不能替代稿件全文格式核查。

## 验证

2026-09-13：新增测试先失败，再完成修复。以下相关测试共 43 项通过，`git diff --check` 通过；未运行全仓测试或生产构建。

```sh
node --test test/site-consistency.test.js test/probing-overview.test.js test/home-stats.test.js test/responsive-layout-contract.test.js
git diff --check
```

独立审查发现图注标题与 PPT 小标题遗漏，已补齐，并加入 5 篇现有文章的渲染测试。
本地浏览器在端口 53438 验证：Help 标题为 Ribocentre-FoldBridge，共享页头有正式名称，Help 正文定义简称；DMS-seq 页面的小标题包含 `<em>in vivo</em>`。

## 2026-09-14 发布验收

用户授权后按维护手册发布；没有重建 Case 数据、更新 D3.6 bundle 或启用历史工作流。

- Git：`ghhttps/main` 与本地提交 `57242e6d780e789b3eb6e9a426671b193cb229e2` 一致。
- 主站：`index.html`、`src/portalChrome.js`、`src/siteChrome.js`、`src/probingArticleView.js`、`src/scientificProse.js`、`src/assets/data/help-content.json` 共 6 个公网文件 SHA-256 与提交内容全部一致。
- 浏览器：Help 标题、邮箱文字及 `mailto:miao_zhichao@gzlab.ac.cn` 链接正确；DMS-seq 有 `<em>in vivo</em>`，该文章控制台未见 error；主站 8SQ9/P iframe 显示 Case ready、2 个 Profile、35 个映射位点及 2D/3D 视图。
- Tunnel：仅原子替换 `src/portalChrome.js`，公开 SHA-256 为 `e35a8b51f2be742caa8568518fe09a68d5dea2269d56cf3d7cd6b1480af73de3`；GET 200，OPTIONS 204，允许主站 Origin；独立 Case 页头显示正式名称。
- 回滚记录：候选目录 `e-header.0i7vzQ`，回滚目录 `e-header.Ud95Ph`（运维目录分别为 Server/staging 与 Server/rollback/foldbridge）。旧文件 SHA-256 为 `1bb9bb8f9fe2941e14ebb2e89cf9466bf47de9190ac1422d3bb1ccf81554d12d`。
- 发布前测试：完整测试 362 项，356 通过、6 失败。封存验证断言为 `Source manifest database.device does not match current input`；其余 5 项为外接 staging 目录 mkdtemp EPERM。相关测试 44/44 通过。不声称全仓测试通过。
- Pages：自动构建记录仍指向旧提交，因此仅请求一次原生构建；运行 ID `34800257016`，最终 completed/success。Pages API 对应目标 SHA，状态 built，更新时间 `2026-09-14T02:51:51Z`。构建 4m22s、部署 2m41s。

本节为部署后补记，保存在本地证据文档，尚未单独推送，避免为状态文档再次触发整站部署。
