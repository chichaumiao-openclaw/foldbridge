(function () {
  "use strict";
  if (document.querySelector(".fb-detail-nav")) {
    return;
  }

  // Self-locate this script's URL without relying solely on document.currentScript
  // (it is null inside a dynamically injected external script — the case-page path).
  function resolveScriptSrc() {
    var current = document.currentScript;
    if (current && current.getAttribute("data-fb-script-src")) {
      return current.getAttribute("data-fb-script-src");
    }
    if (current && current.src) {
      return current.src;
    }
    var scripts = document.querySelectorAll("script[src]");
    for (var i = scripts.length - 1; i >= 0; i -= 1) {
      var src = scripts[i].getAttribute("src") || "";
      if (/site-nav\.js(\?|$)/.test(src)) {
        return scripts[i].src;
      }
    }
    return "";
  }

  var scriptSrc = resolveScriptSrc();
  // Bundle script lives at <root>/public/<universe>/__<bundle>__/site-nav.js
  // so three "../" hops reach the deploy root (where the portal index.html lives).
  var portalRoot;
  try {
    portalRoot = new URL("../../../", scriptSrc).href;
  } catch (err) {
    portalRoot = "/";
  }

  var NAV_ITEMS = [
    { route: "home", label: "Home" },
    { route: "entry", label: "Entry" },
    { route: "probing", label: "Probing" },
    { route: "search", label: "Search" },
    { route: "help", label: "Help" }
  ];

  function link(route, label) {
    var a = document.createElement("a");
    a.className = "fb-detail-nav-link";
    a.href = portalRoot + "#" + route;
    a.textContent = label;
    return a;
  }

  var header = document.createElement("header");
  header.className = "fb-detail-nav";

  var brand = document.createElement("a");
  brand.className = "fb-detail-nav-brand";
  brand.href = portalRoot + "#home";
  var mark = document.createElement("span");
  mark.className = "fb-detail-nav-mark";
  mark.textContent = "FB";
  var word = document.createElement("span");
  word.className = "fb-detail-nav-word";
  word.textContent = "FoldBridge";
  brand.appendChild(mark);
  brand.appendChild(word);

  var nav = document.createElement("nav");
  nav.className = "fb-detail-nav-links";
  nav.setAttribute("aria-label", "Primary navigation");
  NAV_ITEMS.forEach(function (item) {
    nav.appendChild(link(item.route, item.label));
  });

  header.appendChild(brand);
  header.appendChild(nav);

  if (document.body) {
    document.body.insertBefore(header, document.body.firstChild);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      if (!document.querySelector(".fb-detail-nav")) {
        document.body.insertBefore(header, document.body.firstChild);
      }
    });
  }
})();
