import json
from pathlib import Path

ROOT = Path("/Users/hulinyan/Desktop/FoldBridge/rna-mapping")
targets_path = ROOT / "scripts" / "targets.json"

with open(targets_path, "r", encoding="utf-8") as f:
    targets = json.load(f)

# Group by (sequence, structure)
groups = {}
for t in targets:
    key = (t["sequence"], t["structure"])
    if key not in groups:
        groups[key] = []
    groups[key].append(t)

print(f"Total groups: {len(groups)}")
unique_targets = []
for idx, (key, list_targets) in enumerate(groups.items(), 1):
    print(f"\nGroup {idx} (size {len(list_targets)}):")
    for t in list_targets:
        print(f"  - {t['id']}")
    # Choose the first one as representative
    rep = list_targets[0]
    unique_targets.append({
        "representative": rep,
        "all_members": list_targets
    })

# Save unique ones for RNAComposer submission
with open(ROOT / "scripts" / "unique_targets.json", "w", encoding="utf-8") as f:
    json.dump(unique_targets, f, indent=2)
