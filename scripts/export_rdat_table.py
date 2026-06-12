#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
from pathlib import Path


def parse_rdat(path: Path) -> dict[str, str]:
    record = {
        "FoldBridge ID": f"RMDB_{path.stem}",
        "Name": "",
        "Sequence": "",
        "Length": "",
        "File Code": "",
        "Experiment Type": "",
        "Modifier": "",
    }

    parts = path.stem.split("_")
    if len(parts) >= 2:
        record["File Code"] = parts[1]

    with path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line:
                continue

            if line.startswith("NAME\t"):
                record["Name"] = line.split("\t", 1)[1].strip()
                continue

            if line.startswith("SEQUENCE\t"):
                sequence = line.split("\t", 1)[1].strip()
                record["Sequence"] = sequence
                record["Length"] = f"{len(sequence)}nt"
                continue

            if line.startswith("ANNOTATION\t"):
                fields = [field.strip() for field in line.split("\t")[1:] if field.strip()]
                for field in fields:
                    if field.startswith("experimentType:") and not record["Experiment Type"]:
                        record["Experiment Type"] = field.split(":", 1)[1].strip()
                    if field.startswith("modifier:") and not record["Modifier"]:
                        record["Modifier"] = field.split(":", 1)[1].strip()
                continue

            if line.startswith("ANNOTATION_DATA:") and not record["Modifier"]:
                fields = [field.strip() for field in line.split("\t")[1:] if field.strip()]
                for field in fields:
                    if field.startswith("modifier:"):
                        record["Modifier"] = field.split(":", 1)[1].strip()
                        break

    if record["Sequence"] and record["Length"]:
        record["Sequence"] = f'{record["Sequence"]} ({record["Length"]})'

    return record


def export_table(input_dir: Path, output_csv: Path) -> int:
    rows = [parse_rdat(path) for path in sorted(input_dir.glob("*.rdat"))]

    fieldnames = [
        "FoldBridge ID",
        "Name",
        "Sequence",
        "Length",
        "File Code",
        "Experiment Type",
        "Modifier",
    ]

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Export summary fields from RDAT files to CSV.")
    parser.add_argument("input_dir", type=Path, help="Directory containing .rdat files")
    parser.add_argument("output_csv", type=Path, help="Path to write CSV output")
    args = parser.parse_args()

    count = export_table(args.input_dir, args.output_csv)
    print(f"Exported {count} RDAT records to {args.output_csv}")


if __name__ == "__main__":
    main()
