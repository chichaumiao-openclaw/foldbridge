#!/usr/bin/env python3
"""从 entry_atlas.duckdb 生成 annojoin-atlas.v2 schema 的 index.json。

entry 页（annojoinAtlasPage）读 annojoin-atlas/index.json 渲染：6 列表格
(Molecule/PDB/Chains/Probing profiles/Probing category/Confidence) +
按 RNA type(partitions) 折叠 + 筛选 + 下载。本脚本把 entry_atlas 的
entry/chain 两表映射成 displayCases，保留原 index.json 的 facets/presets/
downloads/source 骨架（这些是页面 UI 元数据，不随数据变）。

用法:
    python scripts/build-entry-atlas-index.py \
        --db /Volumes/tainyissd/foldbridge_1D_pool/entry_rollup/entry_atlas.duckdb \
        --skeleton src/assets/generated/annojoin-atlas/index.json \
        --out src/assets/generated/annojoin-atlas/index.json
"""
import argparse
import datetime
import json
import re

import duckdb


def split_multi(value):
    """分号/逗号分隔的多值串 → 去空去重列表（保序）。"""
    if not value:
        return []
    parts = re.split(r"[;,]", str(value))
    seen = []
    for p in parts:
        s = p.strip()
        if s and s not in seen:
            seen.append(s)
    return seen


def parse_chain_tokens(chains_str):
    """'A[1],B[2],C[3]' → ['A','B','C']（取 auth 前缀，去 [] 内序号）。"""
    out = []
    for tok in re.split(r"[;,]", str(chains_str or "")):
        tok = tok.strip()
        if not tok:
            continue
        label = re.sub(r"\[.*?\]", "", tok).strip()
        if label and label not in out:
            out.append(label)
    return out


def build_display_cases(con):
    # 一行一条 chain（pdb×chain 口径）——直接读 chain 表 17837 行，不再按 entry 合并。
    rows = con.execute(
        """
        SELECT pdb_id, chain_key, auth, partition, sci_name, n_profiles,
               entry_confidence_class, source_lanes,
               rmdb_technique, rasp_technique, probing_category
        FROM chain
        ORDER BY pdb_id, auth, chain_key
        """
    ).fetchall()

    cases = []
    placement_count = 0
    for r in rows:
        (pdb_id, chain_key, auth, partition, sci_name, n_profiles,
         conf_class, source_lanes, rmdb_tech, rasp_tech, probing_cat) = r
        pdb_id = str(pdb_id or "").strip()
        if not pdb_id:
            continue

        auth = str(auth or "").strip()
        chain_key = str(chain_key or "").strip()
        chains = [auth] if auth else []
        partition = str(partition or "").strip()      # RNA type：折叠父级（单值）
        probing = split_multi(probing_cat)            # Probing category 列
        lanes = split_multi(source_lanes)
        techniques = split_multi(rmdb_tech) + [t for t in split_multi(rasp_tech)
                                               if t not in split_multi(rmdb_tech)]

        molecule = str(sci_name or "").strip() or pdb_id
        parent = partition or "Unclassified RNA"
        # 折叠层级：partition(RNA type) 作 parent，sci_name 作 child
        placements = [{"classLabel": parent, "nameLabel": molecule}]
        placement_count += len(placements)

        # 唯一 key 到 chain：一个 PDB 多条 chain 各占一行。
        uid_chain = auth or chain_key or pdb_id
        atlas_key = f"ENTRY:{pdb_id}:{uid_chain}"

        cases.append({
            "assetFamily": "ENTRY_ATLAS",
            "sourceLine": "entry_atlas",
            "caseUid": f"ENTRY|{pdb_id}|{uid_chain}",
            "atlasCaseKey": atlas_key,
            "caseId": pdb_id,
            "pdbId": pdb_id,
            "chains": chains,
            "biologicalMoleculeName": molecule,
            "pdbMoleculeName": molecule,
            "moleculeDisplayName": molecule,
            "confidenceDisplayLabel": str(conf_class or "").strip(),
            "confidenceSource": "entry_atlas_entry_confidence_class",
            "sourceDatabases": [l.upper() for l in lanes],
            "assayFamilies": probing,
            "rnaFamily": partition,
            "motif": "",
            "structureClass": partition,
            "profileCount": int(n_profiles or 0),
            "chainPlacements": placements,
            "techniqueFamilies": probing,
            "techniqueNames": techniques,
            "measurementFamilies": probing,
            "sourceCaseCount": 1,
            "searchText": " ".join(filter(None, [
                pdb_id, molecule, partition, " ".join(probing),
                str(conf_class or "")])).lower(),
        })
    return cases, placement_count


def build_index(db_path, skeleton_path, out_path):
    with open(skeleton_path, encoding="utf-8") as fh:
        skeleton = json.load(fh)

    con = duckdb.connect(db_path, read_only=True)
    cases, placement_count = build_display_cases(con)
    con.close()

    skeleton["displayCases"] = cases
    skeleton["totalCaseCount"] = len(cases)
    skeleton["totalSourceCaseCount"] = len(cases)
    skeleton["totalPlacementCount"] = placement_count
    skeleton["version"] = "ENTRY_ATLAS_" + datetime.date.today().strftime("%Y%m%d")
    skeleton["generatedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    src = skeleton.get("source")
    if isinstance(src, dict):
        src["entryRoot"] = db_path
        src["viewId"] = "entry_atlas"

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(skeleton, fh, ensure_ascii=False, separators=(",", ":"))
    return len(cases), placement_count


def main():
    ap = argparse.ArgumentParser(description="Build entry-atlas index.json from entry_atlas.duckdb.")
    ap.add_argument("--db", required=True)
    ap.add_argument("--skeleton", required=True, help="现有 index.json，取其 facets/presets/downloads 骨架")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    n, p = build_index(args.db, args.skeleton, args.out)
    print(f"cases\t{n}")
    print(f"placements\t{p}")


if __name__ == "__main__":
    main()
