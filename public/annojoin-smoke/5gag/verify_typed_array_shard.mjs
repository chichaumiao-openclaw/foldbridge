import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { performance } from "node:perf_hooks";

const root = path.dirname(new URL(import.meta.url).pathname);
const assets = path.join(root, "assets");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(assets, name), "utf8"));
}

function percentile(values, q) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const idx = (clean.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, clean.length - 1);
  const t = idx - lo;
  return clean[lo] * (1 - t) + clean[hi] * t;
}

const started = performance.now();
const index = readJson("profile_index_5gag_reference_mapped.json");
const shardMeta = readJson("profile_shard_000000_meta.json");
const compressed = fs.readFileSync(path.join(assets, shardMeta.gzip_path));
const decoded = zlib.gunzipSync(compressed);
const values = new Float32Array(decoded.buffer, decoded.byteOffset, decoded.byteLength / Float32Array.BYTES_PER_ELEMENT);

if (index.profile_count !== 27) {
  throw new Error(`profile_count mismatch: ${index.profile_count}`);
}
if (shardMeta.profile_count !== index.profile_count) {
  throw new Error("shard/index profile_count mismatch");
}
if (shardMeta.strand_length !== 113) {
  throw new Error(`strand_length mismatch: ${shardMeta.strand_length}`);
}
if (values.length !== shardMeta.profile_count * shardMeta.strand_length) {
  throw new Error(`values length mismatch: ${values.length}`);
}

const first = values.slice(0, shardMeta.strand_length);
const positives = Array.from(first).filter((value) => Number.isFinite(value) && value > 0);
const cap = percentile(positives, 0.95);
const whiteCount = Array.from(first).filter((value) => !Number.isFinite(value) || value <= 0).length;
const cappedCount = Array.from(first).filter((value) => Number.isFinite(value) && value > 0 && Math.min(value / cap, 1) >= 1).length;

if (Math.abs(cap - 9.548000000000002) > 0.0005) {
  throw new Error(`first profile P95 cap mismatch: ${cap}`);
}
if (whiteCount !== 57) {
  throw new Error(`first profile white count mismatch: ${whiteCount}`);
}
if (cappedCount !== 3) {
  throw new Error(`first profile capped count mismatch: ${cappedCount}`);
}

const elapsed = performance.now() - started;
const result = {
  profile_count: index.profile_count,
  strand_length: shardMeta.strand_length,
  raw_bytes: decoded.byteLength,
  gzip_bytes: compressed.byteLength,
  compression_ratio: Number((decoded.byteLength / compressed.byteLength).toFixed(3)),
  first_profile_cap: cap,
  first_profile_white_count: whiteCount,
  first_profile_capped_count: cappedCount,
  decode_and_check_ms: Number(elapsed.toFixed(3)),
};
fs.writeFileSync(path.join(root, "typed_array_shard_benchmark.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
