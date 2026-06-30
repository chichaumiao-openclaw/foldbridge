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

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // GZNL global nav bar — mirrors src/main.js nav(); external portals open in new tab,
  // SVG icons resolve from the deploy root (portalRoot + src/assets/header/*).
  var BLACK_NAV = [
    { label: "Home", icon: "home.svg", href: "http://www.gznl.org/" },
    { label: "Database", icon: "database.svg", href: "https://www.gznl.org/database/" },
    { label: "Research", icon: "research.svg", href: "https://www.gznl.org/research/" },
    { label: "About us", icon: "aboutus.svg", href: "https://www.gznl.org/aboutus/" },
    { label: "GZNL-RDC", icon: "gznl2.svg", href: "https://gzlab.ac.cn/", cls: "gznl-rdc-link" }
  ];

  // RNA database bundle switches — mirrors src/main.js homeBundleSites (FoldBridge = current, no href).
  var BUNDLE_SITES = [
    { name: "Ribocentre", tone: "blue", topLabel: "Ribozyme database", href: "https://www.ribocentre.org/" },
    { name: "Switch", tone: "green", topLabel: "Riboswitch database", href: "https://riboswitch.ribocentre.org/" },
    { name: "Aptamer", tone: "violet", topLabel: "Aptamer database", href: "https://aptamer.ribocentre.org/" },
    { name: "GlycoRNA", tone: "blue", topLabel: "GlycoRNA database", href: "http://www.glycornadb.com" },
    { name: "FoldBridge", tone: "gold", topLabel: "Probing-to-structure bridge", href: null }
  ];

  // Primary route nav — same five launch routes as the portal home header.
  var NAV_ITEMS = [
    { route: "home", label: "Home" },
    { route: "entry", label: "Entry" },
    { route: "probing", label: "Probing" },
    { route: "search", label: "Search" },
    { route: "help", label: "Help" }
  ];

  var blackNavLinks = BLACK_NAV.map(function (item) {
    var cls = item.cls ? ' class="' + item.cls + '"' : "";
    return '<a' + cls + ' href="' + esc(item.href) + '" target="_blank" rel="noopener noreferrer">' +
      '<img src="' + esc(portalRoot + "src/assets/header/" + item.icon) + '" alt=""/>' + esc(item.label) + "</a>";
  }).join("\n      ");

  var switchPills = BUNDLE_SITES.map(function (site) {
    var activeClass = site.href ? "" : "active";
    var inner = "<strong>" + esc(site.name) + "</strong><span>" + esc(site.topLabel) + "</span>";
    if (site.href) {
      return '<a class="bundle-switch-pill tone-' + site.tone + ' ' + activeClass + '" href="' + esc(site.href) +
        '" target="_blank" rel="noopener noreferrer">' + inner + "</a>";
    }
    return '<span class="bundle-switch-pill tone-' + site.tone + ' ' + activeClass + '" aria-current="page">' + inner + "</span>";
  }).join("\n            ");

  var routeLinks = NAV_ITEMS.map(function (item) {
    return '<a class="nav-btn" href="' + esc(portalRoot + "#" + item.route) + '">' + esc(item.label) + "</a>";
  }).join("\n          ");

  var wrapper = document.createElement("div");
  wrapper.className = "fb-detail-nav";
  wrapper.innerHTML =
    '<div class="black-nav" aria-label="GZNL global navigation">\n      ' + blackNavLinks + "\n    </div>" +
    '<header class="bundle-home-header">' +
      '<div class="bundle-home-header-inner">' +
        '<div class="bundle-home-brand-column">' +
          '<a class="bundle-home-brand" href="' + esc(portalRoot + "#home") + '">' +
            '<div class="bundle-home-mark">FB</div>' +
            '<div class="bundle-home-brand-copy">' +
              '<p class="bundle-home-bundle-label">FoldBridge axis</p>' +
              "<h1>FoldBridge</h1>" +
              "<span>FoldBridge is a curated database that links RNA chemical probing data with experimentally resolved tertiary structures.</span>" +
            "</div>" +
          "</a>" +
        "</div>" +
        '<div class="bundle-home-nav-column">' +
          '<div class="bundle-home-topline">' +
            '<div class="bundle-home-bundle-block">' +
              '<p class="bundle-home-switch-label">RNA database bundle</p>' +
              '<div class="bundle-home-switches">\n            ' + switchPills + "\n          </div>" +
            "</div>" +
            '<div class="bundle-home-meta">' +
              '<span class="bundle-home-domain">foldbridge.gznl.org</span>' +
            "</div>" +
          "</div>" +
          '<nav class="bundle-home-route-nav" aria-label="Primary navigation">\n          ' + routeLinks + "\n        </nav>" +
        "</div>" +
      "</div>" +
    "</header>";

  if (document.body) {
    document.body.insertBefore(wrapper, document.body.firstChild);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      if (!document.querySelector(".fb-detail-nav")) {
        document.body.insertBefore(wrapper, document.body.firstChild);
      }
    });
  }
})();
