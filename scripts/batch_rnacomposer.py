#!/usr/bin/python3
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import sys
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from http.cookiejar import CookieJar
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TARGETS_PATH = ROOT / "scripts" / "targets.json"
OUTPUT_DIR = ROOT / "src" / "assets" / "predicted-structures"
MANIFEST_PATH = OUTPUT_DIR / "rnacomposer-manifest.json"
BASE_URL = "https://rnacomposer.cs.put.poznan.pl"

# Minimal RNAComposer compatibility fixes for a few RMDB secondary structures.
# We only relax pairs that RNAComposer rejects outright or balance unmatched
# terminal parentheses while keeping the overall fold topology as close as
# possible to the curated source structure.
RNA_COMPOSER_STRUCTURE_OVERRIDES = {
    "RMDB_ADDSC_1M7_0007": "....((((((((...((((((.........))))))........((((((.......))))))..)))))))).",
    "RMDB_16SFWJ_1M7_0001": "(((..((...(((((((.(.((..((.((((((....)))))).))...)).).....(((....))).....((((((.((....)))))))).)))))))..)).)))",
    "RMDB_RNAPZ14_HRF_0002": "(((((.(((((....))))).(....).((((((..........))))))....)))))..",
    "RMDB_RNAPZ14_HRF_0003": "(((((((((((....)))))).(...).((((((..........))))))....)))))..",
    "RMDB_RNAPZ14_1M7_0005": "....((((((.....))))))...((((((((.(((((....))))).(....).((((((..........))))))....))))))))..((((((.....)))))).......................",
    "RMDB_RNAPZ14_1M7_0007": "....((((((.....)))))).....((((((((((((....)))))).(...).((((((..........))))))....))))))....((((((.....)))))).......................",
}

TASK_ID_RE = re.compile(r'name="taskId"\s+id="taskId"\s+value="([^"]+)"')
RESULT_HREF_RE = re.compile(r'href="(/Home/GetResult\?[^"]+)"')
TASK_DESCRIPTION_RE = re.compile(r"[^A-Za-z0-9_.-]+")
VALIDATION_ERROR_RE = re.compile(r"<td>([^<]+)</td>")


@dataclass
class TargetGroup:
    representative_id: str
    filename_stub: str
    sequence: str
    structure: str
    members: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Submit RNAComposer interactive jobs in sequence and save .rnacomposer.pdb outputs."
    )
    parser.add_argument(
        "--ids",
        nargs="*",
        default=[],
        help="Optional RMDB IDs to process. If omitted, all groups from targets.json are considered.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Stop after this many RNAComposer submissions. Default: no limit.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-submit even if .rnacomposer.pdb already exists for all members in a group.",
    )
    parser.add_argument(
        "--poll-seconds",
        type=float,
        default=2.0,
        help="Polling interval while waiting for a job to finish.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=900.0,
        help="Per-job timeout while polling RNAComposer.",
    )
    parser.add_argument(
        "--pause-seconds",
        type=float,
        default=1.5,
        help="Pause between submissions so we do not hammer the server.",
    )
    return parser.parse_args()


def sanitize_task_description(value: str) -> str:
    return TASK_DESCRIPTION_RE.sub("_", value).strip("_.-") or "rnacomposer_job"


def build_task_description(record_id: str) -> str:
    cleaned = sanitize_task_description(record_id.replace("RMDB_", "", 1))
    if len(cleaned) <= 15:
        return cleaned
    digest = hashlib.sha1(cleaned.encode("utf-8")).hexdigest()[:6]
    prefix = cleaned[:8].rstrip("_.-") or "rna"
    return f"{prefix}_{digest}"[:15]


def load_groups(selected_ids: set[str]) -> list[TargetGroup]:
    targets = json.loads(TARGETS_PATH.read_text(encoding="utf-8"))
    grouped: dict[tuple[str, str], list[dict[str, str]]] = {}
    for target in targets:
        key = (target["sequence"], target["structure"])
        grouped.setdefault(key, []).append(target)

    groups: list[TargetGroup] = []
    for entries in grouped.values():
        members = [entry["id"] for entry in entries]
        if selected_ids and not selected_ids.intersection(members):
            continue
        representative = entries[0]
        groups.append(
            TargetGroup(
                representative_id=representative["id"],
                filename_stub=representative["id"].replace("RMDB_", "", 1),
                sequence=representative["sequence"].upper().replace("T", "U"),
                structure=representative["structure"].strip(),
                members=members,
            )
        )

    groups.sort(key=lambda item: item.representative_id)
    return groups


def rnacomposer_output_path(record_id: str) -> Path:
    return OUTPUT_DIR / f"{record_id.replace('RMDB_', '', 1)}.rnacomposer.pdb"


def group_is_complete(group: TargetGroup) -> bool:
    return all(rnacomposer_output_path(record_id).exists() for record_id in group.members)


def build_content(group: TargetGroup) -> str:
    description = build_task_description(group.representative_id)
    structure = RNA_COMPOSER_STRUCTURE_OVERRIDES.get(group.representative_id, group.structure)
    return f"#{description}\n>{description}\n{group.sequence}\n{structure}"


def decode_response(payload: bytes) -> str:
    return payload.decode("utf-8", errors="replace")


def make_opener() -> urllib.request.OpenerDirector:
    jar = CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def http_get(opener: urllib.request.OpenerDirector, url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "FoldBridge RNAComposer batch client"})
    with opener.open(request, timeout=60) as response:
        return decode_response(response.read())


def http_post(opener: urllib.request.OpenerDirector, url: str, data: dict[str, str]) -> str:
    encoded = urllib.parse.urlencode(data).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=encoded,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "FoldBridge RNAComposer batch client",
        },
    )
    with opener.open(request, timeout=60) as response:
        return decode_response(response.read())


def submit_job(opener: urllib.request.OpenerDirector, group: TargetGroup) -> str:
    http_get(opener, f"{BASE_URL}/")
    response_html = http_post(
        opener,
        f"{BASE_URL}/",
        {
            "content": build_content(group),
            "send": "Compose",
        },
    )
    match = TASK_ID_RE.search(response_html)
    if not match:
        if "Errors:" in response_html:
            message_matches = VALIDATION_ERROR_RE.findall(response_html)
            messages = [
                html.unescape(text).strip()
                for text in message_matches
                if text.strip() and text.strip() != "Message"
            ]
            if messages:
                raise RuntimeError(
                    f"RNAComposer validation failed for {group.representative_id}: {'; '.join(messages[:3])}"
                )
        raise RuntimeError(f"Could not find RNAComposer task ID for {group.representative_id}")
    return html.unescape(match.group(1))


def wait_for_completion(
    opener: urllib.request.OpenerDirector,
    task_id: str,
    poll_seconds: float,
    timeout_seconds: float,
) -> str:
    deadline = time.monotonic() + timeout_seconds
    last_progress_html = ""
    while time.monotonic() < deadline:
        last_progress_html = http_post(opener, f"{BASE_URL}/task/progress", {"taskID": task_id})
        if 'id="processingFinished"' in last_progress_html and 'value="true"' in last_progress_html:
            return last_progress_html
        if "Task failed." in last_progress_html:
            raise RuntimeError(f"RNAComposer task {task_id} failed")
        time.sleep(poll_seconds)
    raise TimeoutError(f"Timed out while waiting for RNAComposer task {task_id}")


def fetch_result_href(opener: urllib.request.OpenerDirector, task_id: str) -> str:
    result_html = http_post(opener, f"{BASE_URL}/task/result", {"taskID": task_id})
    match = RESULT_HREF_RE.search(result_html)
    if not match:
        raise RuntimeError(f"Could not find result download link for task {task_id}")
    return html.unescape(match.group(1))


def download_result(opener: urllib.request.OpenerDirector, href: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    url = urllib.parse.urljoin(BASE_URL, href)
    request = urllib.request.Request(url, headers={"User-Agent": "FoldBridge RNAComposer batch client"})
    with opener.open(request, timeout=120) as response, destination.open("wb") as handle:
        shutil.copyfileobj(response, handle)


def save_group_outputs(group: TargetGroup, representative_file: Path) -> None:
    for record_id in group.members:
        output_path = rnacomposer_output_path(record_id)
        if output_path == representative_file:
            continue
        shutil.copyfile(representative_file, output_path)


def load_manifest() -> list[dict[str, object]]:
    if not MANIFEST_PATH.exists():
        return []
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


def write_manifest(entries: list[dict[str, object]]) -> None:
    MANIFEST_PATH.write_text(json.dumps(entries, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    selected_ids = set(args.ids)
    groups = load_groups(selected_ids)
    if not groups:
        print("No RNAComposer target groups matched the requested IDs.", file=sys.stderr)
        return 1

    manifest_entries = load_manifest()
    manifest_by_rep = {entry.get("representativeId"): entry for entry in manifest_entries}

    processed_count = 0
    skipped_count = 0
    error_count = 0

    for group in groups:
        if args.limit and processed_count >= args.limit:
            break

        if len(group.sequence) != len(group.structure):
            print(f"[skip] {group.representative_id}: sequence/structure length mismatch")
            skipped_count += 1
            continue

        if len(group.sequence) > 500:
            print(f"[skip] {group.representative_id}: RNAComposer interactive mode limit is 500 nt")
            skipped_count += 1
            continue

        if not args.force and group_is_complete(group):
            print(f"[skip] {group.representative_id}: all member .rnacomposer.pdb files already exist")
            skipped_count += 1
            continue

        opener = make_opener()
        print(f"[submit] {group.representative_id} ({len(group.sequence)} nt) -> members: {', '.join(group.members)}")
        try:
            task_id = submit_job(opener, group)
            wait_for_completion(opener, task_id, args.poll_seconds, args.timeout_seconds)
            result_href = fetch_result_href(opener, task_id)
            representative_output = rnacomposer_output_path(group.representative_id)
            download_result(opener, result_href, representative_output)
            save_group_outputs(group, representative_output)

            manifest_by_rep[group.representative_id] = {
                "representativeId": group.representative_id,
                "members": group.members,
                "sequenceLength": len(group.sequence),
                "taskId": task_id,
                "resultHref": result_href,
                "savedFiles": [str(rnacomposer_output_path(record_id).relative_to(ROOT)) for record_id in group.members],
                "completedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            write_manifest(sorted(manifest_by_rep.values(), key=lambda item: str(item.get("representativeId", ""))))
            print(f"[done] {group.representative_id}: saved {len(group.members)} RNAComposer PDB file(s)")
            processed_count += 1
            time.sleep(args.pause_seconds)
        except Exception as exc:
            error_count += 1
            print(f"[error] {group.representative_id}: {exc}", file=sys.stderr)

    entries = sorted(manifest_by_rep.values(), key=lambda item: str(item.get("representativeId", "")))
    write_manifest(entries)

    print(
        f"RNAComposer batch finished: processed={processed_count}, skipped={skipped_count}, errors={error_count}, manifest={MANIFEST_PATH.relative_to(ROOT)}"
    )
    return 0 if error_count == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
