# Home Scroll Story 资产

主页招牌滚动叙事的策展数据 + 预渲染快照。生成产物入 git。

## 反应性色标（单一权威）
低 0 = 冷绿 #174B3A → 中 0.5 = 金 #E6C260 → 高 1 = 暖橙 #E8743E。
1D 实时着色（src/siteChrome.js:reactivityColor）、2D VARNA、3D molstar **必须**用这同一组三档锚点。
归一化：norm = max(0, min(1, reactivityValue / norm_ceiling))，norm_ceiling 见 story.json（本案例 P95，负值钳到 0、离群高值钳到 1）。

## 重生成步骤（手动一次性策展）
1. story.json：从 annojoin-atlas/cases/RMDB2PDB%3A<PDB>.json 的 visualPreview.reactivity1d.points 提取（sequence=rmdbBase / reactivity=reactivityValue 原值 / positions=rmdbPosition），norm_ceiling=reactivity 的 P95（截断不低于 1.0）。
2. <pdb>-2d.svg：VARNA jar（位于姊妹仓库 ~/docs/rmdb2pdb/tools/varna/VARNAv3-93.jar）离线加载 dbn（/Volumes/tianyi/.../dbn/<pdb_lower>.dbn）+ 上述色标着色 → 导出 SVG；同时把逐碱基 paired_state 回填 story.json。
3. <pdb>-3d.png：molstar 离线加载 CONFIDENCE/.../<pdb_lower>.cif + 上述色标着色 → 截图 PNG。
