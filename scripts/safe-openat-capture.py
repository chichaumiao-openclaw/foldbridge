#!/usr/bin/env python3
"""Dirfd-anchored, fail-closed filesystem capture primitives for Case staging."""

import base64
import hashlib
import json
import os
from pathlib import PurePosixPath
import stat
import sys


MAX_REQUEST_BYTES = 1024 * 1024
MAX_CAPTURE_BYTES = 64 * 1024 * 1024
MAX_CAPTURE_OUTPUT_BYTES = 96 * 1024 * 1024
MAX_STRUCTURED_OUTPUT_BYTES = 32 * 1024 * 1024
MAX_SAFE_INTEGER = 9_007_199_254_740_991
READ_CHUNK_BYTES = 1024 * 1024

DIRECTORY_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
FILE_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC


class SafeOpenatError(RuntimeError):
    pass


def _exact_keys(value, expected, label):
    if not isinstance(value, dict):
        raise SafeOpenatError(f"{label} must be an object")
    actual = set(value)
    expected = set(expected)
    if actual != expected:
        raise SafeOpenatError(
            f"{label} fields differ: missing={sorted(expected - actual)!r} extra={sorted(actual - expected)!r}"
        )


def _validate_segment(segment, label="segment"):
    if not isinstance(segment, str):
        raise SafeOpenatError(f"{label} must be a string")
    if not segment or segment in (".", "..") or "/" in segment or "\x00" in segment:
        raise SafeOpenatError(f"{label} is invalid")
    return segment


def _validate_root(root):
    if not isinstance(root, str) or not root.startswith("/") or "\x00" in root:
        raise SafeOpenatError("root must be a canonical absolute path")
    if os.path.normpath(root) != root or os.path.realpath(root) != root:
        raise SafeOpenatError("root must be a canonical absolute path without symlinks")
    components = [] if root == "/" else root[1:].split("/")
    for index, component in enumerate(components):
        _validate_segment(component, f"root segment[{index}]")
    return components


def _validate_max_bytes(max_bytes):
    if isinstance(max_bytes, bool) or not isinstance(max_bytes, int) or max_bytes <= 0:
        raise SafeOpenatError("maxBytes must be a positive integer")
    if max_bytes > MAX_SAFE_INTEGER:
        raise SafeOpenatError("maxBytes exceeds the safe integer limit")
    return max_bytes


def _identity(file_stat):
    return (file_stat.st_dev, file_stat.st_ino, stat.S_IFMT(file_stat.st_mode))


def _same_identity(left, right):
    return _identity(left) == _identity(right)


def _directory_metadata(file_stat):
    return (file_stat.st_mtime_ns, file_stat.st_ctime_ns)


def _open_directory_edge(
    parent_fd,
    segment,
    *,
    watch_parent,
    relative_segments,
    watch_child_metadata=False,
):
    parent_before = os.fstat(parent_fd)
    try:
        child_fd = os.open(segment, DIRECTORY_FLAGS, dir_fd=parent_fd)
    except OSError as error:
        raise SafeOpenatError(
            f"cannot open non-symlink directory edge {'/'.join(relative_segments + (segment,))}: {error}"
        ) from error
    try:
        child_stat = os.fstat(child_fd)
    except OSError as error:
        os.close(child_fd)
        raise SafeOpenatError(
            f"cannot inspect opened directory edge {'/'.join(relative_segments + (segment,))}: {error}"
        ) from error
    if not stat.S_ISDIR(child_stat.st_mode):
        os.close(child_fd)
        raise SafeOpenatError(f"directory edge is not a directory: {'/'.join(relative_segments + (segment,))}")
    return {
        "parent_fd": parent_fd,
        "child_fd": child_fd,
        "segment": segment,
        "child_stat": child_stat,
        "parent_metadata": _directory_metadata(parent_before) if watch_parent else None,
        "child_metadata": _directory_metadata(child_stat) if watch_child_metadata else None,
        "display": "/".join(relative_segments + (segment,)),
    }


def _verify_directory_edge(edge):
    child_now = os.fstat(edge["child_fd"])
    if not _same_identity(child_now, edge["child_stat"]) or not stat.S_ISDIR(child_now.st_mode):
        raise SafeOpenatError(f"opened directory edge drifted: {edge['display']}")
    if edge["child_metadata"] is not None and _directory_metadata(child_now) != edge["child_metadata"]:
        raise SafeOpenatError(f"opened directory root ABA drift detected: {edge['display']}")
    try:
        named_now = os.stat(edge["segment"], dir_fd=edge["parent_fd"], follow_symlinks=False)
    except OSError as error:
        raise SafeOpenatError(f"directory edge disappeared: {edge['display']}: {error}") from error
    if not _same_identity(named_now, edge["child_stat"]) or not stat.S_ISDIR(named_now.st_mode):
        raise SafeOpenatError(f"directory edge drifted or became a symlink: {edge['display']}")
    if edge["parent_metadata"] is not None:
        parent_now = os.fstat(edge["parent_fd"])
        if _directory_metadata(parent_now) != edge["parent_metadata"]:
            raise SafeOpenatError(f"directory edge ABA drift detected: {edge['display']}")


def _verify_edges(edges):
    for edge in edges:
        _verify_directory_edge(edge)


def _verify_and_close_directory_edge(edge):
    try:
        _verify_directory_edge(edge)
    finally:
        os.close(edge["child_fd"])


def _open_canonical_root(root):
    components = _validate_root(root)
    fds = [os.open("/", DIRECTORY_FLAGS)]
    edges = []
    relative = ()
    try:
        for index, component in enumerate(components):
            edge = _open_directory_edge(
                fds[-1],
                component,
                watch_parent=False,
                relative_segments=relative,
                watch_child_metadata=index == len(components) - 1,
            )
            edges.append(edge)
            fds.append(edge["child_fd"])
            relative += (component,)
        return fds, edges
    except Exception:
        for fd in reversed(fds):
            os.close(fd)
        raise


def _file_record(root, segments, file_stat, digest):
    absolute = str(PurePosixPath(root, *segments))
    return {
        "path": absolute,
        "size": file_stat.st_size,
        "mtimeNs": str(file_stat.st_mtime_ns),
        "inode": str(file_stat.st_ino),
        "device": str(file_stat.st_dev),
        "sha256": digest,
    }


def capture_anchored(root, segments, *, max_bytes, include_bytes, hook=None):
    root_components = _validate_root(root)
    if not isinstance(segments, list) or not segments:
        raise SafeOpenatError("segments must be a non-empty array")
    segments = [_validate_segment(value, f"segments[{index}]") for index, value in enumerate(segments)]
    if not isinstance(include_bytes, bool):
        raise SafeOpenatError("includeBytes must be boolean")
    if max_bytes is not None:
        max_bytes = _validate_max_bytes(max_bytes)
    elif include_bytes:
        raise SafeOpenatError("base64 capture requires a finite maxBytes")
    if include_bytes and max_bytes > MAX_CAPTURE_BYTES:
        raise SafeOpenatError(f"base64 capture maxBytes exceeds helper limit {MAX_CAPTURE_BYTES}")
    if hook is not None and not callable(hook):
        raise SafeOpenatError("hook must be callable or None")

    fds, root_edges = _open_canonical_root(root)
    request_edges = []
    file_fd = None
    try:
        relative = ()
        for segment in segments[:-1]:
            edge = _open_directory_edge(
                fds[-1],
                segment,
                watch_parent=True,
                relative_segments=relative,
                watch_child_metadata=True,
            )
            request_edges.append(edge)
            fds.append(edge["child_fd"])
            relative += (segment,)
            if hook is not None:
                hook("after_directory_open", relative)

        if hook is not None:
            hook("before_file_open", tuple(segments))
        final_parent_fd = fds[-1]
        final_parent_metadata = _directory_metadata(os.fstat(final_parent_fd))
        final_segment = segments[-1]
        try:
            file_fd = os.open(final_segment, FILE_FLAGS, dir_fd=final_parent_fd)
        except OSError as error:
            raise SafeOpenatError(f"cannot open non-symlink file {'/'.join(segments)}: {error}") from error
        before = os.fstat(file_fd)
        if not stat.S_ISREG(before.st_mode):
            raise SafeOpenatError(f"final entry is not a regular file: {'/'.join(segments)}")
        if max_bytes is not None and before.st_size > max_bytes:
            raise SafeOpenatError(
                f"file exceeds {max_bytes} bytes after reading 0 bytes: {'/'.join(segments)}"
            )
        if hook is not None:
            hook("after_file_open", tuple(segments))

        digest = hashlib.sha256()
        chunks = [] if include_bytes else None
        bytes_read = 0
        while bytes_read < before.st_size:
            _verify_edges(request_edges)
            current = os.fstat(file_fd)
            if max_bytes is not None and current.st_size > max_bytes:
                raise SafeOpenatError(
                    f"file exceeds {max_bytes} bytes after reading {bytes_read} bytes: {'/'.join(segments)}"
                )
            read_size = min(READ_CHUNK_BYTES, current.st_size - bytes_read)
            if max_bytes is not None:
                read_size = min(read_size, max_bytes - bytes_read)
            if read_size <= 0:
                raise SafeOpenatError(f"bounded read cannot progress: {'/'.join(segments)}")
            chunk = os.read(file_fd, read_size)
            if not chunk:
                break
            bytes_read += len(chunk)
            if max_bytes is not None and bytes_read > max_bytes:
                raise SafeOpenatError(
                    f"file exceeds {max_bytes} bytes after reading {bytes_read} bytes: {'/'.join(segments)}"
                )
            digest.update(chunk)
            if chunks is not None:
                chunks.append(chunk)
            if hook is not None:
                hook("after_read", tuple(segments))

        after = os.fstat(file_fd)
        if max_bytes is not None and after.st_size > max_bytes:
            raise SafeOpenatError(
                f"file exceeds {max_bytes} bytes after reading {bytes_read} bytes: {'/'.join(segments)}"
            )
        if (
            not _same_identity(before, after)
            or before.st_size != after.st_size
            or before.st_mtime_ns != after.st_mtime_ns
            or before.st_ctime_ns != after.st_ctime_ns
            or bytes_read != after.st_size
        ):
            raise SafeOpenatError(f"opened file changed while being captured: {'/'.join(segments)}")
        try:
            named_after = os.stat(final_segment, dir_fd=final_parent_fd, follow_symlinks=False)
        except OSError as error:
            raise SafeOpenatError(f"final file edge disappeared: {'/'.join(segments)}: {error}") from error
        if not _same_identity(named_after, after) or not stat.S_ISREG(named_after.st_mode):
            raise SafeOpenatError(f"final file edge drifted or became a symlink: {'/'.join(segments)}")
        if _directory_metadata(os.fstat(final_parent_fd)) != final_parent_metadata:
            raise SafeOpenatError(f"final file edge ABA drift detected: {'/'.join(segments)}")
        _verify_edges(request_edges)
        _verify_edges(root_edges)

        result = {"record": _file_record(root, segments, after, digest.hexdigest())}
        if chunks is not None:
            result["bytesBase64"] = base64.b64encode(b"".join(chunks)).decode("ascii")
        return result
    finally:
        if file_fd is not None:
            os.close(file_fd)
        for fd in reversed(fds):
            os.close(fd)


def utf8_byte_sorted(values):
    if not isinstance(values, list):
        raise SafeOpenatError("UTF-8 sort input must be an array")
    encoded = []
    for index, value in enumerate(values):
        _validate_segment(value, f"UTF-8 sort value[{index}]")
        try:
            encoded.append((value.encode("utf-8", "strict"), value))
        except UnicodeEncodeError as error:
            raise SafeOpenatError(f"UTF-8 sort value[{index}] is not valid UTF-8") from error
    return [value for _, value in sorted(encoded)]


def _named_stat(parent_fd, segment, display, *, missing_ok=False):
    try:
        return os.stat(segment, dir_fd=parent_fd, follow_symlinks=False)
    except FileNotFoundError:
        if missing_ok:
            return None
        raise SafeOpenatError(f"required entry is missing: {display}")
    except OSError as error:
        raise SafeOpenatError(f"cannot stat entry {display}: {error}") from error


def _open_expected_directory(parent_fd, segment, relative, *, missing_ok, hook):
    display = "/".join(relative + (segment,))
    named = _named_stat(parent_fd, segment, display, missing_ok=missing_ok)
    if named is None:
        return None
    if not stat.S_ISDIR(named.st_mode):
        raise SafeOpenatError(f"expected non-symlink directory: {display}")
    edge = _open_directory_edge(
        parent_fd,
        segment,
        watch_parent=True,
        relative_segments=relative,
        watch_child_metadata=True,
    )
    if hook is not None:
        try:
            hook("after_directory_open", relative + (segment,))
        except Exception:
            os.close(edge["child_fd"])
            raise
    return edge


def _enumerate_case_paths(root, hook=None):
    fds, root_edges = _open_canonical_root(root)
    root_fd = fds[-1]
    selections = []
    try:
        for pdb_id in utf8_byte_sorted(os.listdir(root_fd)):
            pdb_stat = _named_stat(root_fd, pdb_id, pdb_id)
            if not stat.S_ISDIR(pdb_stat.st_mode):
                if stat.S_ISLNK(pdb_stat.st_mode):
                    raise SafeOpenatError(f"symlink is not allowed in Case inventory: {pdb_id}")
                continue
            pdb_edge = _open_expected_directory(root_fd, pdb_id, (), missing_ok=False, hook=hook)
            try:
                pdb_fd = pdb_edge["child_fd"]
                chains_edge = _open_expected_directory(
                    pdb_fd, "chains", (pdb_id,), missing_ok=True, hook=hook
                )
                if chains_edge is None:
                    continue
                try:
                    chains_fd = chains_edge["child_fd"]
                    for auth_chain in utf8_byte_sorted(os.listdir(chains_fd)):
                        auth_stat = _named_stat(
                            chains_fd, auth_chain, f"{pdb_id}/chains/{auth_chain}"
                        )
                        if not stat.S_ISDIR(auth_stat.st_mode):
                            if stat.S_ISLNK(auth_stat.st_mode):
                                raise SafeOpenatError(
                                    f"symlink is not allowed in Case inventory: {pdb_id}/chains/{auth_chain}"
                                )
                            continue
                        auth_edge = _open_expected_directory(
                            chains_fd,
                            auth_chain,
                            (pdb_id, "chains"),
                            missing_ok=False,
                            hook=hook,
                        )
                        try:
                            auth_fd = auth_edge["child_fd"]
                            profiles_edge = _open_expected_directory(
                                auth_fd,
                                "profiles",
                                (pdb_id, "chains", auth_chain),
                                missing_ok=True,
                                hook=hook,
                            )
                            if profiles_edge is None:
                                continue
                            try:
                                profiles_fd = profiles_edge["child_fd"]
                                index_stat = _named_stat(
                                    profiles_fd,
                                    "profile-index.json.gz",
                                    f"{pdb_id}/chains/{auth_chain}/profiles/profile-index.json.gz",
                                    missing_ok=True,
                                )
                                if index_stat is None:
                                    continue
                                if not stat.S_ISREG(index_stat.st_mode):
                                    raise SafeOpenatError(
                                        f"profile-index must be a non-symlink regular file: {pdb_id}/{auth_chain}"
                                    )
                                selections.append({"pdbId": pdb_id, "authChain": auth_chain})
                            finally:
                                _verify_and_close_directory_edge(profiles_edge)
                        finally:
                            _verify_and_close_directory_edge(auth_edge)
                finally:
                    _verify_and_close_directory_edge(chains_edge)
            finally:
                _verify_and_close_directory_edge(pdb_edge)
        _verify_edges(root_edges)
        return selections
    finally:
        for fd in reversed(fds):
            os.close(fd)


def inventory_anchored(root, *, profile_index_max_bytes, hook=None):
    profile_index_max_bytes = _validate_max_bytes(profile_index_max_bytes)
    if profile_index_max_bytes > MAX_CAPTURE_BYTES:
        raise SafeOpenatError(f"profile-index max exceeds {MAX_CAPTURE_BYTES} bytes")
    selections = _enumerate_case_paths(root, hook=hook)
    output = []
    for ordinal, selection in enumerate(selections):
        segments = [
            selection["pdbId"],
            "chains",
            selection["authChain"],
            "profiles",
            "profile-index.json.gz",
        ]
        captured = capture_anchored(
            root,
            segments,
            max_bytes=profile_index_max_bytes,
            include_bytes=False,
            hook=hook,
        )
        output.append({"ordinal": ordinal, **selection, "segments": segments, "record": captured["record"]})
    final_selections = _enumerate_case_paths(root)
    if selections != final_selections:
        raise SafeOpenatError("Case inventory changed during anchored capture")
    return output


def _validate_caps(max_bytes_by_relative_path, default_max_bytes):
    if default_max_bytes is not None:
        default_max_bytes = _validate_max_bytes(default_max_bytes)
    if not isinstance(max_bytes_by_relative_path, dict):
        raise SafeOpenatError("maxBytesByRelativePath must be an object")
    caps = {}
    for relative, value in max_bytes_by_relative_path.items():
        if not isinstance(relative, str) or not relative:
            raise SafeOpenatError("relative cap path must be a non-empty string")
        parts = relative.split("/")
        for index, part in enumerate(parts):
            _validate_segment(part, f"relative cap path segment[{index}]")
        caps[relative] = _validate_max_bytes(value)
    return caps, default_max_bytes


def tree_snapshot_anchored(
    root,
    *,
    max_bytes_by_relative_path,
    default_max_bytes,
    hook=None,
):
    caps, default_max_bytes = _validate_caps(max_bytes_by_relative_path, default_max_bytes)
    fds, root_edges = _open_canonical_root(root)
    directories = []
    files = []

    def visit(directory_fd, relative):
        directory_stat = os.fstat(directory_fd)
        directories.append({"path": "/".join(relative), "mtimeNs": str(directory_stat.st_mtime_ns)})
        for name in utf8_byte_sorted(os.listdir(directory_fd)):
            child_relative = relative + (name,)
            display = "/".join(child_relative)
            named = _named_stat(directory_fd, name, display)
            if stat.S_ISLNK(named.st_mode):
                raise SafeOpenatError(f"symlink is not allowed in tree: {display}")
            if stat.S_ISDIR(named.st_mode):
                edge = _open_expected_directory(
                    directory_fd, name, relative, missing_ok=False, hook=hook
                )
                try:
                    visit(edge["child_fd"], child_relative)
                finally:
                    _verify_and_close_directory_edge(edge)
            elif stat.S_ISREG(named.st_mode):
                captured = capture_anchored(
                    root,
                    list(child_relative),
                    max_bytes=caps.get(display, default_max_bytes),
                    include_bytes=False,
                    hook=hook,
                )
                files.append({"path": display, "record": captured["record"]})
            else:
                raise SafeOpenatError(f"non-regular tree entry is not allowed: {display}")

    try:
        visit(fds[-1], ())
        _verify_edges(root_edges)
        return {"directories": directories, "files": files}
    finally:
        for fd in reversed(fds):
            os.close(fd)


def sha256_manifest_anchored(
    root,
    *,
    max_bytes_by_relative_path,
    default_max_bytes,
    exclude=("reports/sha256.txt",),
    hook=None,
):
    if not isinstance(exclude, (list, tuple)) or not all(isinstance(value, str) for value in exclude):
        raise SafeOpenatError("exclude must be an array of strings")
    tree = tree_snapshot_anchored(
        root,
        max_bytes_by_relative_path=max_bytes_by_relative_path,
        default_max_bytes=default_max_bytes,
        hook=hook,
    )
    excluded = set(exclude)
    rows = []
    for item in tree["files"]:
        relative = item["path"]
        if relative in excluded:
            continue
        if "\n" in relative or "\r" in relative:
            raise SafeOpenatError(f"unsafe path in SHA-256 manifest: {relative!r}")
        rows.append(f"{item['record']['sha256']}  {relative}")
    return "".join(f"{row}\n" for row in rows)


def _parse_request(raw):
    if len(raw) > MAX_REQUEST_BYTES:
        raise SafeOpenatError("request exceeds input limit")
    if not raw.endswith(b"\n") or b"\n" in raw[:-1]:
        raise SafeOpenatError("request must be exactly one JSON line ending with newline")
    try:
        def reject_duplicate_keys(pairs):
            parsed = {}
            for key, value in pairs:
                if key in parsed:
                    raise SafeOpenatError(f"request JSON contains duplicate key {key!r}")
                parsed[key] = value
            return parsed

        def reject_non_json_constant(value):
            raise SafeOpenatError(f"request JSON contains invalid constant {value}")

        request = json.loads(
            raw[:-1].decode("utf-8"),
            object_pairs_hook=reject_duplicate_keys,
            parse_constant=reject_non_json_constant,
        )
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SafeOpenatError(f"request is invalid JSON: {error}") from error
    return request


def _dispatch(request):
    if not isinstance(request, dict) or not isinstance(request.get("operation"), str):
        raise SafeOpenatError("request must be an object with a string operation")
    operation = request["operation"]
    if operation == "capture":
        _exact_keys(request, ["operation", "root", "segments", "maxBytes", "includeBytes"], "request")
        captured = capture_anchored(
            request["root"],
            request["segments"],
            max_bytes=request["maxBytes"],
            include_bytes=request["includeBytes"],
        )
        return {"operation": operation, **captured}
    if operation == "inventory":
        _exact_keys(request, ["operation", "root", "profileIndexMaxBytes"], "request")
        return {
            "operation": operation,
            "items": inventory_anchored(
                request["root"],
                profile_index_max_bytes=request["profileIndexMaxBytes"],
            ),
        }
    if operation == "tree":
        _exact_keys(
            request,
            ["operation", "root", "maxBytesByRelativePath", "defaultMaxBytes"],
            "request",
        )
        return {
            "operation": operation,
            **tree_snapshot_anchored(
                request["root"],
                max_bytes_by_relative_path=request["maxBytesByRelativePath"],
                default_max_bytes=request["defaultMaxBytes"],
            ),
        }
    if operation == "sha256":
        _exact_keys(
            request,
            ["operation", "root", "maxBytesByRelativePath", "defaultMaxBytes", "exclude"],
            "request",
        )
        return {
            "operation": operation,
            "manifest": sha256_manifest_anchored(
                request["root"],
                max_bytes_by_relative_path=request["maxBytesByRelativePath"],
                default_max_bytes=request["defaultMaxBytes"],
                exclude=request["exclude"],
            ),
        }
    raise SafeOpenatError("request operation is invalid")


def encode_response(response, *, max_output_bytes=None):
    if not isinstance(response, dict) or response.get("operation") not in (
        "capture", "inventory", "tree", "sha256"
    ):
        raise SafeOpenatError("response operation is invalid")
    if max_output_bytes is None:
        max_output_bytes = (
            MAX_CAPTURE_OUTPUT_BYTES
            if response["operation"] == "capture"
            else MAX_STRUCTURED_OUTPUT_BYTES
        )
    max_output_bytes = _validate_max_bytes(max_output_bytes)
    output = (
        json.dumps(
            response,
            ensure_ascii=False,
            allow_nan=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")
    if len(output) > max_output_bytes:
        raise SafeOpenatError(f"response exceeds output limit {max_output_bytes} bytes")
    return output


def main():
    try:
        raw = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
        response = _dispatch(_parse_request(raw))
        output = encode_response(response)
    except Exception as error:
        sys.stderr.write(f"error: {error}\n")
        return 1
    sys.stdout.buffer.write(output)
    sys.stdout.buffer.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
