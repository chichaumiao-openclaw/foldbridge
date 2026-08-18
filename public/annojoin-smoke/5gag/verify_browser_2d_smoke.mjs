import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { performance } from "node:perf_hooks";

const root = path.dirname(new URL(import.meta.url).pathname);
const assets = path.join(root, "assets");
const caseData = JSON.parse(fs.readFileSync(path.join(root, "assets/case_2d_structure_5gag.json"), "utf8"));
const profileIndex = JSON.parse(fs.readFileSync(path.join(assets, "profile_index_5gag_reference_mapped.json"), "utf8"));
const shardMeta = JSON.parse(fs.readFileSync(path.join(assets, "profile_shard_000000_meta.json"), "utf8"));
const shardGzip = fs.readFileSync(path.join(assets, shardMeta.gzip_path));
const decodeStarted = performance.now();
const shardRaw = zlib.gunzipSync(shardGzip);
const decodeMs = performance.now() - decodeStarted;
const shardValues = new Float32Array(shardRaw.buffer, shardRaw.byteOffset, shardRaw.byteLength / Float32Array.BYTES_PER_ELEMENT);

function percentile(values, q) {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!clean.length) return 0;
  const idx = (clean.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, clean.length - 1);
  const t = idx - lo;
  return clean[lo] * (1 - t) + clean[hi] * t;
}

function colorForNorm(norm) {
  if (!Number.isFinite(norm) || norm <= 0) return "#ffffff";
  const t = Math.max(0, Math.min(1, norm));
  const start = [255, 242, 0];
  const end = [215, 25, 28];
  const rgb = start.map((channel, idx) => Math.round(channel + (end[idx] - channel) * t));
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function profileValues(profile) {
  const start = profile.row_index * shardMeta.strand_length;
  return shardValues.subarray(start, start + shardMeta.strand_length);
}

function normalizeProfile(profile, values) {
  const mapped = Array.from(values).filter((value) => Number.isFinite(value));
  const positives = mapped.filter((value) => value > 0);
  const cap = percentile(positives, 0.95);
  const byPosition = new Map();
  let whiteCount = 0;
  let cappedCount = 0;
  for (let idx = 0; idx < values.length; idx += 1) {
    const raw = values[idx];
    const norm = raw > 0 && cap > 0 ? Math.min(raw / cap, 1) : 0;
    if (norm <= 0) whiteCount += 1;
    if (norm >= 1) cappedCount += 1;
    byPosition.set(idx + 1, {
      raw,
      norm,
      color: colorForNorm(norm),
    });
  }
  return {
    cap,
    byPosition,
    mappedCount: mapped.length,
    whiteCount,
    cappedCount,
    positiveCount: positives.length,
    unmappedCount: profile.unmapped_to_strand_count,
  };
}

function drawSvg(strand, normalized, profile) {
  const sequence = strand.sequence;
  const pairs = strand.pairs.map((pair) => [pair.i, pair.j]);
  const n = sequence.length;
  const spacing = 13;
  const left = 60;
  const baseline = 268;
  const radius = 5;
  const width = left * 2 + spacing * (n - 1);
  const height = 420;
  const parts = [
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="20" y="26">5GAG ${profile.pair_id} ${profile.profile_id}</text>`,
  ];
  for (const [i, j] of pairs) {
    const x1 = left + (i - 1) * spacing;
    const x2 = left + (j - 1) * spacing;
    const mid = (x1 + x2) / 2;
    const arcHeight = Math.min(180, Math.max(18, Math.abs(x2 - x1) * 0.36));
    parts.push(`<path d="M${x1},${baseline} Q${mid},${baseline - arcHeight} ${x2},${baseline}" fill="none" stroke="#8a8f98" stroke-width="1" opacity="0.65"/>`);
  }
  parts.push(`<line x1="${left}" y1="${baseline}" x2="${left + (n - 1) * spacing}" y2="${baseline}" stroke="#c8ccd2"/>`);
  for (let pos = 1; pos <= n; pos += 1) {
    const x = left + (pos - 1) * spacing;
    const base = sequence[pos - 1];
    const colorRow = normalized.byPosition.get(pos);
    const fill = colorRow?.color ?? "#ffffff";
    parts.push(`<circle cx="${x}" cy="${baseline}" r="${radius}" fill="${fill}" stroke="#30343b" stroke-width="0.6"><title>${pos} ${base}</title></circle>`);
  }
  parts.push(`</svg>`);
  return parts.join("");
}

const strand = caseData.strands.find((item) => item.strand_id === caseData.default_render_strand_id);
if (!strand) throw new Error("default render strand missing");
const started = performance.now();
let svgBytes = 0;
let firstProfile = null;
for (const profile of profileIndex.profiles) {
  const values = profileValues(profile);
  const normalized = normalizeProfile(profile, values);
  if (!firstProfile) {
    firstProfile = {
      pair_id: profile.pair_id,
      cap: normalized.cap,
      mappedCount: normalized.mappedCount,
      whiteCount: normalized.whiteCount,
      positiveCount: normalized.positiveCount,
      cappedCount: normalized.cappedCount,
      unmappedCount: normalized.unmappedCount,
    };
  }
  const svg = drawSvg(strand, normalized, profile);
  svgBytes += svg.length;
}
const elapsed = performance.now() - started;
const result = {
  case_id: caseData.case_id,
  strands: caseData.strands.map((strand) => ({ strand_id: strand.strand_id, length: strand.length, pair_count: strand.pairs.length })),
  profile_count: profileIndex.profiles.length,
  shard_raw_bytes: shardRaw.byteLength,
  shard_gzip_bytes: shardGzip.byteLength,
  shard_decode_ms: Number(decodeMs.toFixed(3)),
  first_profile: firstProfile,
  total_ms: Number(elapsed.toFixed(3)),
  mean_ms_per_profile: Number((elapsed / profileIndex.profiles.length).toFixed(3)),
  generated_svg_bytes: svgBytes,
};
fs.writeFileSync(path.join(root, "browser_compute_benchmark.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
