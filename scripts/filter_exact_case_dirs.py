#!/usr/bin/env python3
"""Filter exact-case directories by alignment quality thresholds.

This scans child directories under a given case root, reads each
``alignment_pair_summary.tsv`` file, and selects directories whose rows meet
thresholds for ``pident``, ``qcovs``, and ``subject_coverage``.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

PIDENT_FIELDS = ("pident", "identity_fraction")
QCOVS_FIELDS = ("qcovs", "rmdb_query_coverage")
SUBJECT_COVERAGE_FIELDS = ("subject_coverage", "pdb_subject_coverage")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Find case directories whose alignment_pair_summary.tsv rows meet "
            "pident/qcovs/subject_coverage thresholds."
        )
    )
    parser.add_argument(
        "case_root",
        type=Path,
        help="Root directory containing case folders such as 10ZT, 10FZ, etc.",
    )
    parser.add_argument(
        "--pident-min",
        type=float,
        default=80.0,
        help="Minimum pident threshold. Default: 80.",
    )
    parser.add_argument(
        "--qcovs-min",
        type=float,
        default=80.0,
        help="Minimum qcovs threshold. Default: 80.",
    )
    parser.add_argument(
        "--subject-coverage-min",
        type=float,
        default=80.0,
        help="Minimum subject_coverage threshold. Default: 80.",
    )
    parser.add_argument(
        "--mode",
        choices=("any", "all"),
        default="any",
        help=(
            "Directory passes if any row meets thresholds, or only if all rows "
            "meet thresholds. Default: any."
        ),
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Optional TSV output path for matched directories.",
    )
    return parser.parse_args()


def get_float_value(row: dict[str, str], field_names: tuple[str, ...]) -> float:
    for field_name in field_names:
        value = row.get(field_name)
        if value in (None, ""):
            continue
        parsed = float(value)
        # Older exports may store fractions in [0, 1] instead of percentages.
        if parsed <= 1.0:
            return parsed * 100.0
        return parsed
    raise KeyError("/".join(field_names))


def row_passes(
    row: dict[str, str],
    pident_min: float,
    qcovs_min: float,
    subject_coverage_min: float,
) -> bool:
    try:
        pident = get_float_value(row, PIDENT_FIELDS)
        qcovs = get_float_value(row, QCOVS_FIELDS)
        subject_coverage = get_float_value(row, SUBJECT_COVERAGE_FIELDS)
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Bad row values: {exc}") from exc

    return (
        pident >= pident_min
        and qcovs >= qcovs_min
        and subject_coverage >= subject_coverage_min
    )


def scan_case_dir(
    case_dir: Path,
    pident_min: float,
    qcovs_min: float,
    subject_coverage_min: float,
    mode: str,
) -> dict[str, object] | None:
    summary_path = case_dir / "alignment_pair_summary.tsv"
    if not summary_path.is_file():
        return None

    with summary_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        rows = list(reader)

    if not rows:
        return None

    pass_flags = [
        row_passes(row, pident_min, qcovs_min, subject_coverage_min) for row in rows
    ]
    if mode == "any":
        case_passes = any(pass_flags)
    else:
        case_passes = all(pass_flags)

    if not case_passes:
        return None

    best_row = max(
        rows,
        key=lambda row: (
            get_float_value(row, PIDENT_FIELDS),
            get_float_value(row, QCOVS_FIELDS),
            get_float_value(row, SUBJECT_COVERAGE_FIELDS),
        ),
    )

    return {
        "case_dir": case_dir.name,
        "row_count": len(rows),
        "pident": f"{get_float_value(best_row, PIDENT_FIELDS):.3f}",
        "qcovs": f"{get_float_value(best_row, QCOVS_FIELDS):.3f}",
        "subject_coverage": f"{get_float_value(best_row, SUBJECT_COVERAGE_FIELDS):.3f}",
        "pdb_reference_id": best_row.get("pdb_reference_id", ""),
        "sequence_member_key": best_row.get("sequence_member_key", ""),
    }


def write_output(output_path: Path, matches: list[dict[str, object]]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "case_dir",
        "row_count",
        "pident",
        "qcovs",
        "subject_coverage",
        "pdb_reference_id",
        "sequence_member_key",
    ]
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, delimiter="\t")
        writer.writeheader()
        writer.writerows(matches)


def main() -> int:
    args = parse_args()
    case_root = args.case_root.resolve()

    if not case_root.is_dir():
        print(f"Case root does not exist or is not a directory: {case_root}", file=sys.stderr)
        return 1

    matches: list[dict[str, object]] = []
    for child in sorted(case_root.iterdir()):
        if not child.is_dir():
            continue
        match = scan_case_dir(
            child,
            pident_min=args.pident_min,
            qcovs_min=args.qcovs_min,
            subject_coverage_min=args.subject_coverage_min,
            mode=args.mode,
        )
        if match is not None:
            matches.append(match)

    print(f"Scanned root: {case_root}")
    print(
        "Thresholds: "
        f"pident>={args.pident_min}, "
        f"qcovs>={args.qcovs_min}, "
        f"subject_coverage>={args.subject_coverage_min}, "
        f"mode={args.mode}"
    )
    print(f"Matched directories: {len(matches)}")
    for match in matches:
        print(
            "\t".join(
                [
                    str(match["case_dir"]),
                    str(match["pident"]),
                    str(match["qcovs"]),
                    str(match["subject_coverage"]),
                    str(match["row_count"]),
                ]
            )
        )

    if args.output:
        write_output(args.output, matches)
        print(f"Wrote TSV: {args.output.resolve()}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
