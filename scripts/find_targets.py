import csv
from pathlib import Path
import json

ROOT = Path("/Users/hulinyan/Desktop/FoldBridge/rna-mapping")
RDAT_DIR = ROOT / "src" / "assets" / "data" / "rmdb-puzzle"
SUPPLEMENT_PATH = RDAT_DIR / "structure_page_supplement.tsv"

targets = []

# Helper to check if a structure has base pairs
def has_base_pairs(structure):
    return any(c in structure for c in "()[]{}<>")

# 1. Parse supplement TSV
if SUPPLEMENT_PATH.exists():
    with open(SUPPLEMENT_PATH, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            source_file = row.get("source_file", "")
            seq = row.get("source_sequence", "").strip()
            struct = row.get("source_structure", "").strip()
            if source_file and seq and struct and has_base_pairs(struct):
                record_id = source_file.replace(".rdat", "")
                targets.append({
                    "id": f"RMDB_{record_id}",
                    "filename": f"{record_id}.pdb",
                    "sequence": seq.upper().replace("T", "U"),
                    "structure": struct
                })

# 2. Parse local RDATs
def parse_rdat(path):
    sequence = ""
    structure = ""
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.strip()
            if line.startswith("SEQUENCE"):
                sequence = "".join(line.replace("SEQUENCE", "", 1).split()).upper().replace("T", "U")
            elif line.startswith("STRUCTURE"):
                structure = "".join(line.replace("STRUCTURE", "", 1).split())
    return sequence, structure

for rdat_path in RDAT_DIR.glob("*.rdat"):
    record_id = rdat_path.stem
    foldbridge_id = f"RMDB_{record_id}"
    
    # Skip if already in targets
    if any(t["id"] == foldbridge_id for t in targets):
        continue
        
    try:
        seq, struct = parse_rdat(rdat_path)
        if seq and struct and has_base_pairs(struct):
            targets.append({
                "id": foldbridge_id,
                "filename": f"{record_id}.pdb",
                "sequence": seq,
                "structure": struct
            })
    except Exception:
        pass

# Save to json file
output_path = ROOT / "scripts" / "targets.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(targets, f, indent=2)

print(f"Found {len(targets)} targets. Saved to {output_path}")
for t in targets:
    print(f"- {t['id']}: {t['sequence'][:20]}... {t['structure'][:20]}...")
