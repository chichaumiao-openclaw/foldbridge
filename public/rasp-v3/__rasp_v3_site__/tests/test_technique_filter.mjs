import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTechniqueFilterModel, applyTechniqueFilter } from "../workbench-pure.mjs";

const rows = [
  { technology: "DMS-seq", family: "A", profileKey: "pk1", trackProfileId: "tpA1", chain: "A" },
  { technology: "CMCT", family: "A", profileKey: "pk2", trackProfileId: "tpA2", chain: "A" },
  { technology: "SHAPE-MaP", family: "B", profileKey: "pk3", trackProfileId: "tpB1", chain: "A" },
  { technology: "Lead-seq", family: "D", profileKey: "pk4", trackProfileId: "tpD1", chain: "B" },
];

test("buildTechniqueFilterModel groups by family and honors chainId filter", () => {
  const model = buildTechniqueFilterModel(rows, "A");
  // chain-A only: families A and B, not D (chain B)
  assert.deepEqual(model.families, ["A", "B"]);
  assert.deepEqual(model.techniquesByFamily.get("A").sort(), ["CMCT", "DMS-seq"]);
  assert.deepEqual(model.techniquesByFamily.get("B"), ["SHAPE-MaP"]);
  assert.equal(model.techniquesByFamily.has("D"), false);
  assert.deepEqual(model.profileMeta.get("tpA1"), { family: "A", technology: "DMS-seq" });
  assert.deepEqual(model.profileMeta.get("tpB1"), { family: "B", technology: "SHAPE-MaP" });
  assert.equal(model.profileMeta.has("tpD1"), false);
});

test("applyTechniqueFilter empty selection returns ALL profileIds", () => {
  const model = buildTechniqueFilterModel(rows, "A");
  const hit = applyTechniqueFilter(model, { families: new Set(), techniques: new Set() });
  assert.deepEqual([...hit].sort(), ["tpA1", "tpA2", "tpB1"]);
});

test("applyTechniqueFilter with a family selected returns that family's profileIds", () => {
  const model = buildTechniqueFilterModel(rows, "A");
  const hit = applyTechniqueFilter(model, { families: new Set(["A"]), techniques: new Set() });
  assert.deepEqual([...hit].sort(), ["tpA1", "tpA2"]);
});

test("applyTechniqueFilter OR union of family A + technique SHAPE-MaP (family B)", () => {
  const model = buildTechniqueFilterModel(rows, "A");
  const hit = applyTechniqueFilter(model, {
    families: new Set(["A"]),
    techniques: new Set(["SHAPE-MaP"]),
  });
  assert.deepEqual([...hit].sort(), ["tpA1", "tpA2", "tpB1"]);
});
