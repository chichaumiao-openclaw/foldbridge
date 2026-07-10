# CI 自动部署 release-public → public 设计（办法 A）

**日期：** 2026-07-10
**状态：** 设计待审查
**关联：** Phase A 部署计划 `docs/superpowers/plans/2026-07-10-deploy-release-public-to-public.md`（本设计复用其任务 2 的 orphan-free 重建配方）；设计 `docs/superpowers/specs/2026-07-10-deploy-release-public-to-public-design.md`。

## 背景与动机

线上站点 `foldbridge.ribocentre.org` 走 GitHub Pages classic「从分支根托管」，服务分支 = `public`。当前部署是**纯手动**：在 worktree 里手工跑 Phase A 任务 2 的整树替换 + 构建 + push。手动流程的痛点（Phase A 设计已记录）：产物入 git、功能开发漏到部署分支、大 push 分块漏文件。

**Phase C 原方案** = 让 CI 从 `public` 用 Actions 原生出站，但前置依赖「仓库 admin 把 Pages 源 classic→Actions」。**用户拿不到该 admin 权限**，Phase C 原路径被阻塞。

**办法 A（本设计）** 绕开 Pages 源切换：保持 classic「从分支托管」不变，改为让 **CI 在每次 push `release-public` 时自动重建并 push 到 `public`**。Pages 见到 `public` 更新即自动重新部署（classic 模式固有行为，无需改任何 Pages 设置）。所需权限仅 = 仓库 Actions 的 `GITHUB_TOKEN` 写权限（`permissions: contents: write`），远弱于 admin Pages 源切换。

## 目标

- 消除手动 shuttle：push `release-public` → 线上自动更新。
- 复用已验证的 orphan-free 重建配方（Phase A 任务 2），不引入新的部署语义。
- 保持零回归门（`node --test` + `verify:mvp`）在部署前把关。
- 提供无新权限的本地退路（办法 B），以防 CI 无写权限。

## 非目标

- 不切换 GitHub Pages 源（classic→Actions）——那是被阻塞的 Phase C 原路径。
- 不改 `public` 的托管方式或 CNAME。
- 不动现有 `pages.yml`（它触发于 `main`，与本部署路径正交，保留不管）。
- 不做 `.env` 治理（Phase A 遗留观察，范围外）。

## 触发策略（用户已定）

**每次 push `release-public` 自动触发** + `workflow_dispatch` 手动逃生口。

**已知权衡（用户知情选择）：** `release-public` 会收到频繁的 WIP / subagent-dev 提交；每次 push 自动部署意味着**每个半成品提交都会立即上线**。用户明确接受此风险。未来若要安全阀，最干净的是把触发改成 `on: push: tags: ["deploy-*"]`（只在打部署 tag 时出站）——属未来变更，本设计不含。

## 架构：两个产物

### 产物 1：`scripts/deploy-to-public.sh`（承重逻辑）

把 Phase A 任务 2 的步骤固化成脚本，CI 与本地共用。**门禁内置在脚本里**（而非拆成 CI 独立 step），这样本地退路运行也享有同样的 test/verify 保护。核心序列（`set -euo pipefail`）：

```
git fetch origin
git checkout release-public
SHA=$(git rev-parse release-public)          # 唯一可复现锚点
rm -rf dist                                  # 清未跟踪 dist，否则 checkout public 会因同名冲突中止
git checkout public 2>/dev/null || git checkout -b public origin/public
git rm -rf .                                 # 清空 public 树（含旧 dist/pagefind）
git checkout release-public -- .             # 取整棵 reconciled 树
npm ci
npm run build:site                           # 重新生成 fresh dist/pagefind
node --test                                  # 门：现 363 pass / 0 fail
npm run verify:mvp                           # CI sanity gate
git add -f dist/pagefind                     # pagefind 被 gitignore，须 -f
git commit -m "deploy(public): rebuild from release-public ${SHA}"
git push origin public
test "$(git rev-parse origin/public)" = "$(git rev-parse HEAD)"   # push 后 sha 校验
```

**顺序铁律（继承 Phase A）：** 构建必须在整树替换**之后**。若先构建再切分支/清树，`dist/pagefind` 会被 `git checkout public` + `git rm -rf .` 连环清掉。脚本严格按上序，不可重排。

**空提交处理：** 若 `release-public` 相对当前 `public` 内容无实质变化（重建后树相同），`git commit` 会因无暂存变化失败并被 `set -e` 中止。脚本对此做判定：commit 前检查 `git status --porcelain`，无变化则跳过 commit/push 并正常退出（避免 CI 因「nothing to commit」误红）。

**幂等 / 可重跑：** 脚本每次从 `git fetch` + 整树替换重建，不依赖上次残留状态；中途失败重跑安全（未 push 前 `git reset --hard origin/public` 零风险）。

### 产物 2：`.github/workflows/deploy-to-public.yml`（薄包装）

```yaml
name: Deploy release-public to public
on:
  push:
    branches: ["release-public"]
  workflow_dispatch:
permissions:
  contents: write
concurrency:
  group: deploy-public
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0            # 需要两个分支 + 全历史
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Configure git identity
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
      - name: Rebuild and deploy
        run: bash scripts/deploy-to-public.sh
```

## 关键设计决策

1. **循环安全：** workflow 触发于 `release-public`，push 到 `public`。`public` 的 push 不触发本 workflow（触发白名单只有 `release-public`）→ 无无限循环。
2. **门禁在脚本内：** test/verify 写进 `deploy-to-public.sh`，本地退路与 CI 走同一保护，不在 YAML 里重复。
3. **两文件都提交在 `release-public`：** 脚本在 `git rm -rf . && git checkout release-public -- .` 后仍在树里（因它属 release-public 树），能自我存活。workflow 文件也随整树带到 `public`，在 `public` 上无害（`public` 的 push 不触发它）。
4. **`GITHUB_TOKEN` 写权限 caveat：** `permissions: contents: write` 请求写权限，但若仓库 org / Settings→Actions→Workflow permissions 被强制只读，push step 会失败。**首次 CI 运行即验证**。若失败 → 本地跑 `bash scripts/deploy-to-public.sh`（办法 B），零代码改动。
5. **首次 push 巨大：** ~11.4 万 case 页文件 + pagefind + structure.cif.gz 二进制。GitHub Actions 能处理大 push，但首跑慢。
6. **fetch-depth: 0：** 默认浅克隆拿不到 `public` 分支和历史；整树替换需要两分支都在本地，故全历史检出。

## 办法 B 退路（无新权限）

`scripts/deploy-to-public.sh` 本身就是退路：CI 若因写权限失败，在本地 worktree `~/docs/foldbridge-release` 直接 `bash scripts/deploy-to-public.sh` 即完成同样部署，用本地 git 凭证 push，不需要任何新权限。脚本是 CI 与本地的单一真相源，两条路径产物字节一致。

## 风险与回退

- **半成品上线**（每次 push 触发）：用户知情接受；未来可切 tag 触发。
- **CI 无写权限**：首跑暴露 → 立即回落办法 B，无返工。
- **部署出错**：`public` 历史线性保留，`git revert <deploy-sha>` + `git push origin public` 前向回退，不需 force push。
- **构建/测试失败**：门禁在整树替换之后、commit 之前跑；失败即 `set -e` 中止，不会 push 坏树。未 push 前本地状态可 `git reset --hard origin/public` 复原。

## 验证方式

- 脚本逻辑：本地 `bash scripts/deploy-to-public.sh` 干跑一遍（首次即真部署，等价 Phase A 手动流程；用户确认后执行）。
- workflow：合并到 `release-public` 后首次 push 触发，观察 Actions run 是否绿；push step 成败即判定写权限是否可用。
- 部署后：`curl -sI https://foldbridge.ribocentre.org/` 期望 `HTTP/2 200` + 浏览器抽查首页/搜索/case 页。
