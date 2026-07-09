import test from "node:test";
import assert from "node:assert/strict";

import { resolvePortalRoot, resolveSiteNavScriptSrc, shouldRenderSiteNav } from "../site-nav.js";

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

test("resolveSiteNavScriptSrc prefers module URL", () => {
  const doc = {
    currentScript: null,
    querySelectorAll() {
      throw new Error("DOM fallback should not be used");
    },
  };
  assert.equal(
    resolveSiteNavScriptSrc(doc, "https://example.test/public/rasp-v3/__rasp_v3_site__/site-nav.js"),
    "https://example.test/public/rasp-v3/__rasp_v3_site__/site-nav.js",
  );
});

test("resolvePortalRoot resolves from site nav script URL", () => {
  assert.equal(
    resolvePortalRoot("https://example.test/foldbridge/public/rasp-v3/__rasp_v3_site__/site-nav.js"),
    "https://example.test/foldbridge/",
  );
});
