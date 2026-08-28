#!/usr/bin/env python3
"""Read selected Case profile technique metadata from an Entry Atlas DuckDB."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

import duckdb


SELECTION_KEYS = {"pdbId", "authChain"}
OUTPUT_KEYS = (
    "ordinal",
    "pdbId",
    "authChain",
    "chainKey",
    "profileId",
    "techFilter",
    "isBackgroundChannel",
)


def _validate_selections(selections: Any) -> list[tuple[int, str, str]]:
    if type(selections) is not list:
        raise ValueError("selection payload must be an array")

    validated: list[tuple[int, str, str]] = []
    seen: set[tuple[str, str]] = set()
    for ordinal, selection in enumerate(selections):
        if type(selection) is not dict:
            raise ValueError(f"selection[{ordinal}] must be an object")
        if set(selection) != SELECTION_KEYS:
            raise ValueError(
                f"selection[{ordinal}] must have exactly pdbId and authChain"
            )

        pdb_id = selection["pdbId"]
        auth_chain = selection["authChain"]
        for key, value in (("pdbId", pdb_id), ("authChain", auth_chain)):
            if type(value) is not str:
                raise ValueError(f"selection[{ordinal}].{key} must be a string")
            if not value or value.strip() != value:
                raise ValueError(
                    f"selection[{ordinal}].{key} must be non-empty and unpadded"
                )

        identity = (pdb_id, auth_chain)
        if identity in seen:
            raise ValueError(
                "duplicate selection identity: "
                f"pdbId={pdb_id!r}, authChain={auth_chain!r}"
            )
        seen.add(identity)
        validated.append((ordinal, pdb_id, auth_chain))

    return validated


def extract_rows(db_path: str | Path, selections: Any) -> list[dict[str, Any]]:
    """Return profile rows for exact selected PDB/auth-chain identities."""
    selected_rows = _validate_selections(selections)
    con = duckdb.connect(str(db_path), read_only=True)
    try:
        con.execute(
            """
            CREATE TEMP TABLE selected_chains (
                ordinal BIGINT NOT NULL,
                pdb_id VARCHAR NOT NULL,
                auth_chain VARCHAR NOT NULL
            )
            """
        )
        if selected_rows:
            con.executemany(
                "INSERT INTO selected_chains VALUES (?, ?, ?)", selected_rows
            )

        chain_counts = con.execute(
            """
            SELECT s.ordinal,
                   s.pdb_id,
                   s.auth_chain,
                   COUNT(c.pdb_id) AS chain_count
            FROM selected_chains s
            LEFT JOIN chain c
              ON c.pdb_id = s.pdb_id AND c.auth = s.auth_chain
            GROUP BY s.ordinal, s.pdb_id, s.auth_chain
            ORDER BY s.ordinal
            """
        ).fetchall()
        for ordinal, pdb_id, auth_chain, chain_count in chain_counts:
            if chain_count == 0:
                raise ValueError(
                    f"selection[{ordinal}] chain is missing: "
                    f"pdbId={pdb_id!r}, authChain={auth_chain!r}"
                )
            if chain_count != 1:
                raise ValueError(
                    f"selection[{ordinal}] chain is duplicated in database: "
                    f"pdbId={pdb_id!r}, authChain={auth_chain!r}, "
                    f"count={chain_count}"
                )

        result_rows = con.execute(
            """
            SELECT s.ordinal,
                   p.pdb_id,
                   c.auth,
                   p.chain_key,
                   p.profile_key,
                   p.tech_filter,
                   p.is_background_channel
            FROM selected_chains s
            JOIN chain c ON c.pdb_id = s.pdb_id AND c.auth = s.auth_chain
            JOIN profile p ON p.pdb_id = c.pdb_id AND p.chain_key = c.chain_key
            ORDER BY s.ordinal, p.profile_key
            """
        ).fetchall()
    finally:
        con.close()

    return [dict(zip(OUTPUT_KEYS, row)) for row in result_rows]


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"duplicate JSON object key: {key!r}")
        result[key] = value
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Extract exact Case profile technique metadata as NDJSON."
    )
    parser.add_argument("--db", required=True)
    parser.add_argument("--selection-json", required=True)
    args = parser.parse_args(argv)

    try:
        with Path(args.selection_json).open(encoding="utf-8") as handle:
            selections = json.load(handle, object_pairs_hook=_unique_object)
        rows = extract_rows(args.db, selections)
        output = "".join(
            json.dumps(
                row,
                ensure_ascii=False,
                allow_nan=False,
                separators=(",", ":"),
            )
            + "\n"
            for row in rows
        )
    except (OSError, ValueError, json.JSONDecodeError, duckdb.Error) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    sys.stdout.write(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
