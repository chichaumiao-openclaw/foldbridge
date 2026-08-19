import { test } from "node:test";
import assert from "node:assert/strict";
import { joinTechniqueByProfile } from "../workbench-pure.mjs";

const rows = [
  { technology: "DMS-seq", family: "A", profileKey: "pk1", trackProfileId: "tp1", chain: "A" },
  { technology: "SHAPE-MaP", family: "B", profileKey: "pk2", trackProfileId: "tp2", chain: "A" },
  { technology: "Lead-seq", family: "D", profileKey: "pk3", trackProfileId: "tp3", chain: "B" },
];

test("filters to chain and maps profileId -> technology/family", () => {
  const map = joinTechniqueByProfile(rows, "A");
  assert.deepEqual(map.get("tp1"), { technology: "DMS-seq", family: "A" });
  assert.deepEqual(map.get("tp2"), { technology: "SHAPE-MaP", family: "B" });
  assert.equal(map.has("tp3"), false);
});
test("falls back to profileKey when trackProfileId absent", () => {
  const map = joinTechniqueByProfile([{ technology: "DMS", family: "A", profileKey: "pk9", chain: "A" }], "A");
  assert.deepEqual(map.get("pk9"), { technology: "DMS", family: "A" });
});
test("empty/absent rows -> empty map", () => {
  assert.equal(joinTechniqueByProfile([], "A").size, 0);
  assert.equal(joinTechniqueByProfile(null, "A").size, 0);
});
