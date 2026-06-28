#!/usr/bin/env python3
from __future__ import annotations

import math
from pathlib import Path

import networkx as nx
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
RDAT_DIR = ROOT / "src" / "assets" / "data" / "rmdb-puzzle"
OUTPUT_DIR = ROOT / "src" / "assets" / "predicted-structures"
# Keep this generator for local fallback models only. Atomic RNAComposer
# predictions are checked into src/assets/predicted-structures for records
# whose RDAT secondary structures can be submitted directly.
TARGET_IDS = [
    "RNAPZ14_HRF_0002",
    "SAMRSW_1M7_0001",
]

STRUCTURE_OVERRIDES = {
    "SAMRSW_1M7_0001": "..((((((((..(((((((.(.(((.....)))..))...))))(((.((((((.(.(((((.....)))))))))..))))))...))(..((((((...)..))))))..))))))))",
}


OPEN_TO_CLOSE = {"(": ")", "[": "]", "{": "}", "<": ">"}
CLOSE_TO_OPEN = {close: open_ for open_, close in OPEN_TO_CLOSE.items()}


def parse_rdat(record_id: str) -> tuple[str, str]:
    path = RDAT_DIR / f"{record_id}.rdat"
    sequence = ""
    structure = ""
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("SEQUENCE"):
            sequence = "".join(line.replace("SEQUENCE", "", 1).split()).upper().replace("T", "U")
        elif line.startswith("STRUCTURE"):
            structure = "".join(line.replace("STRUCTURE", "", 1).split())
    if not sequence or not structure or len(sequence) != len(structure):
        raise ValueError(f"Invalid RDAT record for {record_id}")
    structure = STRUCTURE_OVERRIDES.get(record_id, structure)
    return sequence, structure


def parse_pairs(structure: str) -> dict[int, int]:
    stacks: dict[str, list[int]] = {key: [] for key in OPEN_TO_CLOSE}
    pairs: dict[int, int] = {}
    for index, char in enumerate(structure):
        if char in OPEN_TO_CLOSE:
            stacks[char].append(index)
        elif char in CLOSE_TO_OPEN:
            opener = CLOSE_TO_OPEN[char]
            if not stacks[opener]:
                continue
            partner = stacks[opener].pop()
            pairs[index] = partner
            pairs[partner] = index
    return pairs


def find_stems(pairs: dict[int, int]) -> list[list[tuple[int, int]]]:
    seen: set[int] = set()
    stems: list[list[tuple[int, int]]] = []
    for left in sorted(index for index in pairs if index < pairs[index]):
        if left in seen:
            continue
        right = pairs[left]
        stem = [(left, right)]
        seen.add(left)
        seen.add(right)
        next_left = left + 1
        next_right = right - 1
        while pairs.get(next_left) == next_right:
            stem.append((next_left, next_right))
            seen.add(next_left)
            seen.add(next_right)
            next_left += 1
            next_right -= 1
        stems.append(stem)
    return stems


def normalize(vector: np.ndarray, fallback: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vector)
    if norm < 1e-8:
      return fallback.copy()
    return vector / norm


def build_initial_layout(length: int, pairs: dict[int, int]) -> dict[int, np.ndarray]:
    graph = nx.Graph()
    for index in range(length):
        graph.add_node(index)
        if index < length - 1:
            graph.add_edge(index, index + 1, weight=3.0)
    for left, right in pairs.items():
        if left < right:
            graph.add_edge(left, right, weight=5.0)
    raw_layout = nx.spring_layout(graph, dim=3, seed=42, iterations=500, weight="weight", scale=1.0)
    coordinates = {index: np.array(raw_layout[index], dtype=float) for index in range(length)}

    sequential_distances = [
        np.linalg.norm(coordinates[index + 1] - coordinates[index])
        for index in range(length - 1)
        if np.linalg.norm(coordinates[index + 1] - coordinates[index]) > 1e-6
    ]
    if sequential_distances:
        scale = 6.0 / float(np.mean(sequential_distances))
        coordinates = {index: coord * scale for index, coord in coordinates.items()}
    return coordinates


def apply_stem_geometry(
    coordinates: dict[int, np.ndarray], stems: list[list[tuple[int, int]]]
) -> tuple[dict[int, np.ndarray], set[int]]:
    anchored: set[int] = set()
    for stem in stems:
        pair_centers = []
        pair_vectors = []
        for left, right in stem:
            pair_centers.append((coordinates[left] + coordinates[right]) / 2.0)
            pair_vectors.append(coordinates[left] - coordinates[right])

        if len(pair_centers) > 1:
            axis = normalize(pair_centers[-1] - pair_centers[0], np.array([0.0, 1.0, 0.0]))
        else:
            axis = np.array([0.0, 1.0, 0.0])

        pair_vector = normalize(np.mean(pair_vectors, axis=0), np.array([1.0, 0.0, 0.0]))
        pair_vector -= np.dot(pair_vector, axis) * axis
        pair_vector = normalize(pair_vector, np.array([1.0, 0.0, 0.0]))
        orthogonal = normalize(np.cross(axis, pair_vector), np.array([0.0, 0.0, 1.0]))

        helical_spacing = 3.4
        radius = 4.2
        twist_step = 0.58
        stem_origin = np.mean(pair_centers, axis=0) - axis * (helical_spacing * (len(stem) - 1) / 2.0)

        for pair_index, (left, right) in enumerate(stem):
            angle = pair_index * twist_step
            radial = math.cos(angle) * pair_vector + math.sin(angle) * orthogonal
            center = stem_origin + axis * (pair_index * helical_spacing)
            coordinates[left] = center + radial * radius
            coordinates[right] = center - radial * radius
            anchored.add(left)
            anchored.add(right)
    return coordinates, anchored


def fill_unpaired_regions(coordinates: dict[int, np.ndarray], anchored: set[int]) -> dict[int, np.ndarray]:
    length = len(coordinates)
    index = 0
    while index < length:
        if index in anchored:
            index += 1
            continue
        start = index
        while index < length and index not in anchored:
            index += 1
        end = index - 1
        left_anchor = start - 1 if start > 0 and (start - 1) in anchored else None
        right_anchor = end + 1 if end + 1 < length and (end + 1) in anchored else None
        run_length = end - start + 1

        if left_anchor is not None and right_anchor is not None:
            left_position = coordinates[left_anchor]
            right_position = coordinates[right_anchor]
            direction = normalize(right_position - left_position, np.array([1.0, 0.0, 0.0]))
            bulge = normalize(np.cross(direction, np.array([0.0, 0.0, 1.0])), np.array([0.0, 1.0, 0.0]))
            span = np.linalg.norm(right_position - left_position)
            amplitude = min(8.0, max(3.0, span / 4.0))
            for offset, residue_index in enumerate(range(start, end + 1), start=1):
                t = offset / (run_length + 1)
                base_position = left_position * (1.0 - t) + right_position * t
                coordinates[residue_index] = base_position + bulge * math.sin(math.pi * t) * amplitude
        else:
            anchor_index = left_anchor if left_anchor is not None else right_anchor
            anchor_position = coordinates[anchor_index] if anchor_index is not None else np.zeros(3)
            direction = np.array([0.0, 1.0, 0.0]) if left_anchor is None else np.array([0.0, -1.0, 0.0])
            sweep = np.array([1.0, 0.0, 0.0]) if left_anchor is None else np.array([-1.0, 0.0, 0.0])
            for offset, residue_index in enumerate(range(start, end + 1), start=1):
                curve = math.sin(offset / (run_length + 1) * math.pi) * 3.0
                coordinates[residue_index] = anchor_position + direction * (offset * 5.2) + sweep * curve
    return coordinates


def atom_positions(coordinates: dict[int, np.ndarray], residue_index: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    current = coordinates[residue_index]
    prev_position = coordinates[residue_index - 1] if residue_index > 0 else current - np.array([4.0, 0.0, 0.0])
    next_position = (
        coordinates[residue_index + 1]
        if residue_index < len(coordinates) - 1
        else current + np.array([4.0, 0.0, 0.0])
    )
    tangent = normalize(next_position - prev_position, np.array([1.0, 0.0, 0.0]))
    normal = normalize(np.cross(tangent, np.array([0.0, 0.0, 1.0])), np.array([0.0, 1.0, 0.0]))
    binormal = normalize(np.cross(tangent, normal), np.array([0.0, 0.0, 1.0]))
    p_atom = current
    c4_atom = current + tangent * 1.6 + binormal * 0.6
    base_atom = current + normal * 2.4
    return p_atom, c4_atom, base_atom


def write_pdb(record_id: str, sequence: str, coordinates: dict[int, np.ndarray]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"{record_id}.pdb"
    lines = [f"HEADER    COARSE SECONDARY-STRUCTURE-CONSTRAINED MODEL {record_id}"]
    serial = 1
    for residue_index, base in enumerate(sequence, start=1):
        residue_name = base if base in {"A", "C", "G", "U"} else "A"
        p_atom, c4_atom, base_atom = atom_positions(coordinates, residue_index - 1)
        base_atom_name = "N9" if residue_name in {"A", "G"} else "N1"
        for atom_name, atom_coord, element in (
            ("P", p_atom, "P"),
            ("C4'", c4_atom, "C"),
            (base_atom_name, base_atom, "N"),
        ):
            lines.append(
                f"ATOM  {serial:5d} {atom_name:<4} {residue_name:>3} A{residue_index:4d}    "
                f"{atom_coord[0]:8.3f}{atom_coord[1]:8.3f}{atom_coord[2]:8.3f}"
                f"  1.00  1.00          {element:>2}"
            )
            serial += 1
    lines.append("END")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def generate_model(record_id: str) -> Path:
    sequence, structure = parse_rdat(record_id)
    pairs = parse_pairs(structure)
    stems = find_stems(pairs)
    coordinates = build_initial_layout(len(sequence), pairs)
    coordinates, anchored = apply_stem_geometry(coordinates, stems)
    coordinates = fill_unpaired_regions(coordinates, anchored)
    return write_pdb(record_id, sequence, coordinates)


def main() -> None:
    for record_id in TARGET_IDS:
        output_path = generate_model(record_id)
        print(f"Generated {output_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
