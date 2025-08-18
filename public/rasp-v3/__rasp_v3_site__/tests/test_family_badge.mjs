import { test } from "node:test";
import assert from "node:assert/strict";
import { familyBadgeMarkup } from "../workbench-pure.mjs";

test("known family -> colored badge span with family class", () => {
  const html = familyBadgeMarkup("A");
  assert.match(html, /family-badge/);
  assert.match(html, /data-family="A"/);
  assert.match(html, />A</);
});
test("empty/unknown family -> neutral unassigned badge", () => {
  const html = familyBadgeMarkup("");
  assert.match(html, /family-badge/);
  assert.match(html, /data-family=""/);
});
test("lowercases input normalized to uppercase", () => {
  assert.match(familyBadgeMarkup("b"), /data-family="B"/);
});
