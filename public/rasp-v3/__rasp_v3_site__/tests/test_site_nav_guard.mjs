import test from "node:test";
import assert from "node:assert/strict";

import { shouldRenderSiteNav } from "../site-nav.js";

test("shouldRenderSiteNav returns true when window is top-level", () => {
  const win = {};
  win.self = win;
  win.top = win;
  assert.equal(shouldRenderSiteNav(win), true);
});

test("shouldRenderSiteNav returns false when window is framed", () => {
  const win = { self: {}, top: {} };
  assert.equal(shouldRenderSiteNav(win), false);
});

test("shouldRenderSiteNav returns false when top access throws", () => {
  const self = {};
  const win = {
    self,
    get top() {
      throw new Error("cross-origin frame");
    },
  };
  assert.equal(shouldRenderSiteNav(win), false);
});
