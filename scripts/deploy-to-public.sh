#!/usr/bin/env bash
#
# deploy-to-public.sh — 从 release-public orphan-free 重建整树并部署到线上服务分支 public。
#
# CI（.github/workflows/deploy-to-public.yml）与本地退路（办法 B）共用此单一真相源。
# 门禁内置在脚本内，两条路径享有同样的 test/verify 保护。
# 设计文档：docs/superpowers/specs/2026-07-10-ci-auto-deploy-to-public-design.md
#
# 顺序铁律：构建必须在整树替换之后（否则 fresh dist/pagefind 会被 checkout/rm 连环清掉）。
#
set -euo pipefail

# ── 前置安全门（CI 里恒真；本地退路的救命护栏）──────────────
# clean-tree 前置：git rm -rf . 是破坏性操作，脏工作树会丢未提交改动。
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: worktree not clean; commit/stash before deploying" >&2
  exit 1
fi

git fetch origin
git checkout release-public
git pull --ff-only origin release-public     # 本地对齐 origin，杜绝 stale 部署（CI 里已是 pushed ref）
SHA=$(git rev-parse release-public)          # 唯一可复现锚点

# ── orphan-free 整树重建（顺序不可重排）──────────────────────
rm -rf dist                                  # 清未跟踪 dist，否则 checkout public 会因同名冲突中止
git checkout public 2>/dev/null || git checkout -b public origin/public
git reset --hard origin/public               # 本地 public 对齐 origin（防落后于并发部署）
git rm -rf .                                 # 清空 public 树（含旧 dist/pagefind）
git checkout release-public -- .             # 取整棵 reconciled 树

# ── 构建（必须在整树替换之后）+ 门禁 ─────────────────────────
npm ci
npm run build:site                           # 重新生成 fresh dist/pagefind
node --test                                  # 门：现 363 pass / 0 fail（依赖 c3dfbc78a5 删除 3 个 5GAG 测试）
npm run verify:mvp                           # CI sanity gate

# ── 部署产物完整性 assert（构建后、提交前，测的就是将要发布的树）──
test -s dist/pagefind/pagefind.js            # pagefind 索引存在且非空
test -f CNAME                                # 自定义域名文件在树里（丢失=线上域名断）
grep -qx "foldbridge.ribocentre.org" CNAME   # CNAME 值正确
test -f .nojekyll                            # 关闭 Jekyll 处理

# ── 强制加 pagefind + 空提交判定 ─────────────────────────────
git add -f dist/pagefind                     # pagefind 被 gitignore，须 -f
if git diff --cached --quiet; then
  echo "No changes vs current public; skipping commit/push." >&2
  exit 0                                      # 无实质变化：正常退出，不误红 CI
fi

git commit -m "deploy(public): rebuild from release-public ${SHA}"
git push origin public
test "$(git rev-parse origin/public)" = "$(git rev-parse HEAD)"   # push 后 sha 校验
