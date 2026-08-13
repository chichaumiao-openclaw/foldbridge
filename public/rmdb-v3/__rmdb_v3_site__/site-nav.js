import { renderBundleHeader, renderGlobalNav } from '../../../src/portalChrome.js';
import { renderPrimaryNav } from '../../../src/siteChrome.js';

export function shouldRenderSiteNav(win) {
  try {
    return win.self === win.top;
  } catch (_e) {
    return false;
  }
}

export function resolveSiteNavScriptSrc(doc, moduleUrl) {
  if (moduleUrl) {
    return moduleUrl;
  }
  var current = doc && doc.currentScript;
  if (current && current.getAttribute("data-fb-script-src")) {
    return current.getAttribute("data-fb-script-src");
  }
  if (current && current.src) {
    return current.src;
  }
  var scripts = doc && doc.querySelectorAll ? doc.querySelectorAll("script[src]") : [];
  for (var i = scripts.length - 1; i >= 0; i -= 1) {
    var src = scripts[i].getAttribute("src") || "";
    if (/site-nav\.js(\?|$)/.test(src)) {
      return scripts[i].src;
    }
  }
  return "";
}

export function resolvePortalRoot(scriptSrc) {
  try {
    return new URL("../../../", scriptSrc).href;
  } catch (err) {
    return "/";
  }
}

(function () {
  "use strict";
  if (typeof window === "undefined") return;
  if (!shouldRenderSiteNav(window)) return;
  if (document.querySelector(".fb-detail-nav")) {
    return;
  }

  // Bundle script lives at <root>/public/<universe>/__<bundle>__/site-nav.js
  // so three "../" hops reach the deploy root (where the portal index.html lives).
  var scriptSrc = resolveSiteNavScriptSrc(document, import.meta.url);
  var portalRoot = resolvePortalRoot(scriptSrc);

  var initialMode = "light";
  try {
    initialMode = window.localStorage.getItem("foldbridge-mode") === "dark" ? "dark" : "light";
  } catch (_e) {
    // Private browsing or a blocked storage backend should not prevent the nav
    // from rendering.
  }

  var wrapper = document.createElement("div");
  wrapper.className = "fb-detail-nav";
  wrapper.innerHTML = renderGlobalNav({ assetBase: portalRoot + 'src/assets/header/' })
    + renderBundleHeader({ mode: initialMode, navHtml: renderPrimaryNav('annojoin-case') });

  if (document.body) {
    document.body.insertBefore(wrapper, document.body.firstChild);
    bindHeaderControls();
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      if (!document.querySelector(".fb-detail-nav")) {
        document.body.insertBefore(wrapper, document.body.firstChild);
        bindHeaderControls();
      }
    });
  }

  function bindHeaderControls() {
    var form = wrapper.querySelector("#global-search-form");
    var input = wrapper.querySelector("#global-search-input");
    var modeToggle = wrapper.querySelector("#mode-toggle");

    function setMode(nextMode) {
      var safeMode = nextMode === "dark" ? "dark" : "light";
      document.body.setAttribute("data-mode", safeMode);
      try {
        window.localStorage.setItem("foldbridge-mode", safeMode);
      } catch (_e) {
        // Keep the control usable when localStorage is unavailable.
      }
      if (modeToggle) {
        modeToggle.textContent = safeMode === "dark" ? "Switch to light mode" : "Switch to dark mode";
        modeToggle.setAttribute("aria-pressed", safeMode === "dark" ? "true" : "false");
      }
    }

    setMode(initialMode);
    modeToggle && modeToggle.addEventListener("click", function () {
      setMode(document.body.getAttribute("data-mode") === "dark" ? "light" : "dark");
    });
    form && form.addEventListener("submit", function (event) {
      event.preventDefault();
      var query = input ? input.value.trim() : "";
      window.location.href = portalRoot + (query ? "#search?q=" + encodeURIComponent(query) : "#search");
    });
    wrapper.querySelectorAll("[data-route]").forEach(function (button) {
      button.addEventListener("click", function () {
        window.location.href = portalRoot + "#" + button.getAttribute("data-route");
      });
    });
  }
})();
