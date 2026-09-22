#!/usr/bin/env python3
"""Build compact browser-side 2D rendering smoke assets for 5GAG."""

from __future__ import annotations

import csv
import gzip
import json
import shutil
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REMOTE_ROOT = ROOT.parents[1]
DBN_PATH = REMOTE_ROOT / "ANNOJOIN/2d_smoke_5gag_20260618/dbn/5gag.dbn"
SUMMARY_TSV = (
    REMOTE_ROOT
    / "10_structure_context/alpha_full_20260615"
    / "join_schema_v2_from_codex_20260615_profile_specific_allowlist_5gag_9bz1"
    / "fec_v0_4_pair_structure_context_summary.tsv"
)
JOIN_TSV = (
    REMOTE_ROOT
    / "10_structure_context/alpha_full_20260615"
    / "join_schema_v2_from_codex_20260615_profile_specific_allowlist_5gag_9bz1"
    / "fec_v0_4_residue_reactivity_structure_join.tsv"
)
VARNA_TEMPLATE_SVG = (
    REMOTE_ROOT
    / "ANNOJOIN/2d_smoke_5gag_20260618/render"
    / "5gag_sequence_000008_strand_1_reactivity_varna_p95_norm.svg"
)
OUT_ASSETS = ROOT / "assets"
SHARD_ID = "shard_000000"
LINKED_VIEW_ASSETS = [
    "residue-index.json",
    "profile-joins.json",
    "structure-contexts.json",
    "structure-coverage.json",
    "bridges.json",
    "interactions.json",
    "confidence-summary.json",
    "lss-context.json",
    "raw-alignment-coverage.json",
]


def parse_dbn(path: Path) -> dict[str, dict[str, object]]:
    records: dict[str, dict[str, object]] = {}
    lines = [line.rstrip("\n") for line in path.read_text().splitlines() if line.strip()]
    for i in range(0, len(lines), 3):
        header, sequence, structure = lines[i : i + 3]
        strand_id = header[1:]
        records[strand_id] = {
            "strand_id": strand_id,
            "sequence": sequence,
            "dotbracket": structure,
            "length": len(sequence),
        }
    return records


def parse_pairs(dotbracket: str) -> list[dict[str, int]]:
    stack: list[int] = []
    pairs: list[dict[str, int]] = []
    for idx, char in enumerate(dotbracket, start=1):
        if char == "(":
            stack.append(idx)
        elif char == ")" and stack:
            pairs.append({"i": stack.pop(), "j": idx})
    return pairs


def choose_profiles(limit: int = 38) -> list[dict[str, str]]:
    profiles: list[dict[str, str]] = []
    with SUMMARY_TSV.open(newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            if row["pdb_id"] != "5GAG":
                continue
            if row["claim_ceiling_source"] != "A_REFERENCE":
                continue
            if row["numeric_axis_tier"] != "N2_NUMERIC_PROJECTABLE":
                continue
            profiles.append(
                {
                    "pair_id": row["pair_id"],
                    "profile_id": row["profile_id"],
                    "n_residue_evidence": row["n_residue_evidence"],
                    "n_joined_context": row["n_joined_context"],
                    "claim_ceiling_source": row["claim_ceiling_source"],
                    "numeric_axis_tier": row["numeric_axis_tier"],
                }
            )
            if len(profiles) >= limit:
                break
    return profiles


def build_profile_payload(profile_rows: list[dict[str, str]], strand_len: int) -> list[dict[str, object]]:
    residues: list[dict[str, object]] = []
    for row in profile_rows:
        label_seq_id = row["label_seq_id"]
        value_raw = row["reactivity_value"]
        value = None if value_raw == "" else float(value_raw)
        mapped_to_strand = False
        position = None
        if label_seq_id:
            pos = int(label_seq_id)
            if 1 <= pos <= strand_len:
                mapped_to_strand = True
                position = pos
        residues.append(
            {
                "position": position,
                "raw_value": value,
                "base": row["parent_base"] or row["comp_id"],
                "residue_key": row["residue_key"],
                "mapped_to_strand": mapped_to_strand,
                "mapping_status": "mapped_to_strand_1" if mapped_to_strand else "unmapped_to_strand_1",
            }
        )
    return residues


def main() -> None:
    OUT_ASSETS.mkdir(parents=True, exist_ok=True)
    strands = parse_dbn(DBN_PATH)
    for strand in strands.values():
        strand["pairs"] = parse_pairs(str(strand["dotbracket"]))

    profiles = choose_profiles()
    wanted = {profile["pair_id"]: profile for profile in profiles}
    grouped_rows = {pair_id: [] for pair_id in wanted}
    with JOIN_TSV.open(newline="") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            if row["pair_id"] in grouped_rows:
                grouped_rows[row["pair_id"]].append(row)

    profile_payloads = []
    profile_index = []
    strand_len = int(strands["strand_1"]["length"])
    for profile in profiles:
        rows = grouped_rows[profile["pair_id"]]
        residues = build_profile_payload(rows, strand_len)
        payload = (
            {
                **profile,
                "case_id": "5GAG",
                "render_strand_id": "strand_1",
                "residues": residues,
                "row_count": len(residues),
                "mapped_to_strand_count": sum(1 for row in residues if row["mapped_to_strand"]),
                "unmapped_to_strand_count": sum(1 for row in residues if not row["mapped_to_strand"]),
            }
        )
        if payload["mapped_to_strand_count"] > 0:
            profile_index.append(
                {
                    "pair_id": payload["pair_id"],
                    "profile_id": payload["profile_id"],
                    "render_strand_id": payload["render_strand_id"],
                    "row_index": len(profile_payloads),
                    "shard_id": SHARD_ID,
                    "length": strand_len,
                    "row_count": payload["row_count"],
                    "mapped_to_strand_count": payload["mapped_to_strand_count"],
                    "unmapped_to_strand_count": payload["unmapped_to_strand_count"],
                    "claim_ceiling_source": payload["claim_ceiling_source"],
                    "numeric_axis_tier": payload["numeric_axis_tier"],
                }
            )
            profile_payloads.append(payload)

    case_payload = {
        "case_id": "5GAG",
        "dbn_source": str(DBN_PATH.relative_to(REMOTE_ROOT)),
        "default_render_strand_id": "strand_1",
        "strands": list(strands.values()),
        "normalization_policy": {
            "id": "browser_profile_positive_p95_cap_v1",
            "missing_unmapped_nan_le_zero": "white",
            "positive_value": "norm=min(value/p95_positive,1); yellow_to_red",
        },
    }
    profile_payload = {
        "case_id": "5GAG",
        "profile_count": len(profile_payloads),
        "profiles": profile_payloads,
    }
    flat_values = []
    for profile in profile_payloads:
        by_position = {
            int(row["position"]): row["raw_value"]
            for row in profile["residues"]
            if row["mapped_to_strand"] and row["position"] is not None
        }
        for position in range(1, strand_len + 1):
            value = by_position.get(position)
            flat_values.append(float("nan") if value is None else float(value))

    raw_bytes = struct.pack(f"<{len(flat_values)}f", *flat_values)
    gzip_bytes = gzip.compress(raw_bytes, compresslevel=9, mtime=0)
    raw_path = OUT_ASSETS / f"profile_{SHARD_ID}_f32.bin"
    gzip_path = OUT_ASSETS / f"profile_{SHARD_ID}_f32.bin.gz"
    raw_path.write_bytes(raw_bytes)
    gzip_path.write_bytes(gzip_bytes)
    shutil.copyfile(VARNA_TEMPLATE_SVG, OUT_ASSETS / "varna_5gag_strand_1_template.svg")

    shard_meta = {
        "case_id": "5GAG",
        "shard_id": SHARD_ID,
        "format": "float32_le_row_major",
        "profile_count": len(profile_payloads),
        "strand_length": strand_len,
        "missing_value": "NaN",
        "raw_path": raw_path.name,
        "gzip_path": gzip_path.name,
        "raw_bytes": len(raw_bytes),
        "gzip_bytes": len(gzip_bytes),
        "compression_ratio_raw_over_gzip": round(len(raw_bytes) / len(gzip_bytes), 3) if gzip_bytes else 0,
    }
    profile_index_payload = {
        "case_id": "5GAG",
        "profile_count": len(profile_index),
        "render_strand_id": "strand_1",
        "shards": {
            SHARD_ID: {
                "meta_path": f"assets/profile_{SHARD_ID}_meta.json",
                "gzip_path": f"assets/{gzip_path.name}",
                "raw_path": f"assets/{raw_path.name}",
            }
        },
        "profiles": profile_index,
    }
    (OUT_ASSETS / "case_2d_structure_5gag.json").write_text(json.dumps(case_payload, indent=2, sort_keys=True) + "\n")
    (OUT_ASSETS / "profile_reactivity_5gag_reference_mapped.json").write_text(json.dumps(profile_payload, indent=2, sort_keys=True) + "\n")
    (OUT_ASSETS / "profile_index_5gag_reference_mapped.json").write_text(json.dumps(profile_index_payload, indent=2, sort_keys=True) + "\n")
    (OUT_ASSETS / f"profile_{SHARD_ID}_meta.json").write_text(json.dumps(shard_meta, indent=2, sort_keys=True) + "\n")
    verbose_size = (OUT_ASSETS / "profile_reactivity_5gag_reference_mapped.json").stat().st_size
    linked_view_sizes = {
        name: (OUT_ASSETS / "linked-view" / name).stat().st_size
        for name in LINKED_VIEW_ASSETS
    }
    compact_size = (
        (OUT_ASSETS / "profile_index_5gag_reference_mapped.json").stat().st_size
        + (OUT_ASSETS / f"profile_{SHARD_ID}_meta.json").stat().st_size
        + gzip_path.stat().st_size
    )
    size_report = {
        "case_id": "5GAG",
        "verbose_profile_json_bytes": verbose_size,
        "compact_profile_index_meta_gzip_bytes": compact_size,
        "typed_array_raw_bytes": len(raw_bytes),
        "typed_array_gzip_bytes": len(gzip_bytes),
        "linked_view_asset_count": len(LINKED_VIEW_ASSETS),
        "linked_view_total_bytes": sum(linked_view_sizes.values()),
        "linked_view_asset_bytes": linked_view_sizes,
        "verbose_over_compact_ratio": round(verbose_size / compact_size, 3) if compact_size else 0,
        "raw_over_gzip_ratio": shard_meta["compression_ratio_raw_over_gzip"],
    }
    (ROOT / "asset_size_report.json").write_text(json.dumps(size_report, indent=2, sort_keys=True) + "\n")
    manifest = {
        "case_id": "5GAG",
        "assets": {
            "case_2d_structure": "assets/case_2d_structure_5gag.json",
            "profile_index": "assets/profile_index_5gag_reference_mapped.json",
            "profile_shard_meta": f"assets/profile_{SHARD_ID}_meta.json",
            "profile_shard_gzip": f"assets/{gzip_path.name}",
            "varna_template_svg": "assets/varna_5gag_strand_1_template.svg",
            "legacy_verbose_profiles": "assets/profile_reactivity_5gag_reference_mapped.json",
            "browser_entry": "index.html",
            **{
                f"linked_view_{name.replace('-', '_').replace('.', '_').replace('_json', '')}": f"assets/linked-view/{name}"
                for name in LINKED_VIEW_ASSETS
            },
        },
        "profile_count": len(profile_payloads),
        "render_strand_id": "strand_1",
        "render_strand_length": strand_len,
        "note": "Browser smoke: DBN/profile index plus compressed Float32 shard; P95 normalization, coloring, SVG layout, and profile switching run in browser JavaScript.",
    }
    (ROOT / "browser_smoke_manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
