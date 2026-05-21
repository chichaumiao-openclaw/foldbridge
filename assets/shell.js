document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const storageKey = 'rna-web-family-mode';
  const toggle = document.querySelector('[data-mode-toggle]');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navLinks = document.querySelector('[data-page-links]');
  const main = document.querySelector('.rna-main');
  const body = document.body;
  const legacyScopeSelector = '.legacy-page-shell, .legacy-entry-shell, .legacy-entry-card';
  const scopedStylesheetCache = new Map();
  const legacyOnloadQueue = [];
  const localAssetPrefixes = ['/css/', '/js/', '/images/', '/downloads/', '/pdb/'];
  const sharedLegacyAssetHosts = new Set(['www.ribocentre.org']);
  const legacyDomainValues = (body && body.dataset.legacyDomains ? body.dataset.legacyDomains : '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const legacyDomainSet = new Set(legacyDomainValues);

  if (body && body.dataset.siteDomain) {
    legacyDomainSet.add(body.dataset.siteDomain.trim().toLowerCase());
  }

  const setMode = (mode) => {
    root.dataset.mode = mode;
    if (toggle) {
      toggle.textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
    }
  };

  const savedMode = localStorage.getItem(storageKey);
  setMode(savedMode === 'dark' ? 'dark' : 'light');

  const getLegacyScope = (node) => {
    if (!node) return null;
    return node.closest(legacyScopeSelector);
  };

  const splitSelectorList = (selectorText) => {
    const selectors = [];
    let current = '';
    let parenDepth = 0;
    let bracketDepth = 0;
    let quote = '';

    for (let index = 0; index < selectorText.length; index += 1) {
      const character = selectorText[index];
      const previous = selectorText[index - 1];

      if (quote) {
        current += character;
        if (character === quote && previous !== '\\') {
          quote = '';
        }
        continue;
      }

      if (character === '"' || character === '\'') {
        quote = character;
        current += character;
        continue;
      }

      if (character === '(') {
        parenDepth += 1;
        current += character;
        continue;
      }

      if (character === ')') {
        parenDepth = Math.max(parenDepth - 1, 0);
        current += character;
        continue;
      }

      if (character === '[') {
        bracketDepth += 1;
        current += character;
        continue;
      }

      if (character === ']') {
        bracketDepth = Math.max(bracketDepth - 1, 0);
        current += character;
        continue;
      }

      if (character === ',' && parenDepth === 0 && bracketDepth === 0) {
        if (current.trim()) {
          selectors.push(current.trim());
        }
        current = '';
        continue;
      }

      current += character;
    }

    if (current.trim()) {
      selectors.push(current.trim());
    }

    return selectors;
  };

  const prefixSelector = (selector, scopeSelector) => {
    const trimmed = selector.trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith(scopeSelector)) return trimmed;

    const rootSelectorPattern = /^(?:html|body|:root)\b/i;
    const rootWithClassPattern = /^(?:html|body|:root)((?:[#.:][\w-]+|\[[^\]]+\])*)(.*)$/i;

    if (rootSelectorPattern.test(trimmed)) {
      return trimmed.replace(rootWithClassPattern, (_, suffix = '', remainder = '') => {
        return `${scopeSelector}${suffix}${remainder}`;
      });
    }

    if (/^[>+~]/.test(trimmed)) {
      return `${scopeSelector} ${trimmed}`;
    }

    return `${scopeSelector} ${trimmed}`;
  };

  const prefixSelectorText = (selectorText, scopeSelector) => {
    return splitSelectorList(selectorText)
      .map((selector) => prefixSelector(selector, scopeSelector))
      .join(', ');
  };

  const parseCssRules = (cssText) => {
    const sandbox = document.implementation.createHTMLDocument('legacy-css-sandbox');
    const style = sandbox.createElement('style');
    style.textContent = cssText;
    sandbox.head.appendChild(style);
    return Array.from(style.sheet ? style.sheet.cssRules : []);
  };

  const serializeRule = (rule, scopeSelector) => {
    const type = rule.type;
    const cssRule = window.CSSRule || {};

    if (type === cssRule.STYLE_RULE) {
      return `${prefixSelectorText(rule.selectorText, scopeSelector)} { ${rule.style.cssText} }`;
    }

    if (type === cssRule.MEDIA_RULE) {
      return `@media ${rule.conditionText} { ${Array.from(rule.cssRules).map((item) => serializeRule(item, scopeSelector)).join('\n')} }`;
    }

    if (type === cssRule.SUPPORTS_RULE) {
      return `@supports ${rule.conditionText} { ${Array.from(rule.cssRules).map((item) => serializeRule(item, scopeSelector)).join('\n')} }`;
    }

    if (type === cssRule.DOCUMENT_RULE) {
      return `@document ${rule.conditionText} { ${Array.from(rule.cssRules).map((item) => serializeRule(item, scopeSelector)).join('\n')} }`;
    }

    if (type === cssRule.LAYER_BLOCK_RULE) {
      const layerName = rule.name ? ` ${rule.name}` : '';
      return `@layer${layerName} { ${Array.from(rule.cssRules).map((item) => serializeRule(item, scopeSelector)).join('\n')} }`;
    }

    return rule.cssText;
  };

  const scopeLegacyStyleText = (cssText, scopeSelector = '.legacy-page-shell') => {
    try {
      return parseCssRules(cssText)
        .map((rule) => serializeRule(rule, scopeSelector))
        .join('\n');
    } catch (error) {
      return cssText
        .replace(/(^|[\n\r]\s*):root\b/gm, `${'$1'}${scopeSelector}`)
        .replace(/(^|[,{]\s*)body(?=[\s.#:[{,])/gm, `${'$1'}${scopeSelector}`)
        .replace(/(^|[,{]\s*)html(?=[\s.#:[{,])/gm, `${'$1'}${scopeSelector}`);
    }
  };

  const rewriteCssUrls = (cssText, stylesheetUrl) => {
    return cssText.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, rawUrl) => {
      const trimmedUrl = rawUrl.trim();
      if (!trimmedUrl || /^(?:data:|https?:|blob:|#|\/)/i.test(trimmedUrl)) {
        return match;
      }

      try {
        const absoluteUrl = new URL(trimmedUrl, stylesheetUrl).href;
        return `url(${quote}${absoluteUrl}${quote})`;
      } catch (error) {
        return match;
      }
    });
  };

  const fetchScopedStylesheet = async (absoluteUrl, scopeSelector) => {
    const cacheKey = `${absoluteUrl}::${scopeSelector}`;
    if (!scopedStylesheetCache.has(cacheKey)) {
      scopedStylesheetCache.set(cacheKey, fetch(absoluteUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load ${absoluteUrl}`);
          }
          return response.text();
        })
        .then((cssText) => scopeLegacyStyleText(rewriteCssUrls(cssText, absoluteUrl), scopeSelector)));
    }

    return scopedStylesheetCache.get(cacheKey);
  };

  const isLocalAssetPath = (pathname) => {
    return localAssetPrefixes.some((prefix) => pathname.startsWith(prefix));
  };

  const normalizeLegacyUrl = (rawValue) => {
    if (!rawValue) return rawValue;
    const trimmed = rawValue.trim();

    if (!trimmed || /^(?:#|mailto:|tel:|data:|blob:|javascript:)/i.test(trimmed)) {
      return rawValue;
    }

    let absoluteUrl;
    try {
      absoluteUrl = new URL(trimmed, window.location.href);
    } catch (error) {
      return rawValue;
    }

    if (!/^https?:$/i.test(absoluteUrl.protocol)) {
      return rawValue;
    }

    const hostname = absoluteUrl.hostname.toLowerCase();
    const isLegacySiteHost = legacyDomainSet.has(hostname);
    const isLocalDevHost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isSharedAssetHost = sharedLegacyAssetHosts.has(hostname) && isLocalAssetPath(absoluteUrl.pathname);

    if (!isLegacySiteHost && !isLocalDevHost && !isSharedAssetHost) {
      return rawValue;
    }

    return `${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}` || '/';
  };

  const rewriteLegacyContentUrls = () => {
    if (!main) return;

    main.querySelectorAll('[href], [src]').forEach((node) => {
      ['href', 'src'].forEach((attributeName) => {
        if (!node.hasAttribute(attributeName)) return;
        const currentValue = node.getAttribute(attributeName);
        const normalizedValue = normalizeLegacyUrl(currentValue);
        if (normalizedValue && normalizedValue !== currentValue) {
          node.setAttribute(attributeName, normalizedValue);
        }
      });
    });
  };

  const injectScopedStylesheet = async (link, scopeTarget) => {
    const href = link.getAttribute('href');
    if (!href || !scopeTarget) return;

    let absoluteUrl;
    try {
      absoluteUrl = new URL(href, window.location.href);
    } catch (error) {
      return;
    }

    const targetScopeClass = scopeTarget.classList.contains('legacy-entry-card')
      ? '.legacy-entry-card'
      : scopeTarget.classList.contains('legacy-entry-shell')
        ? '.legacy-entry-shell'
        : '.legacy-page-shell';

    link.remove();

    try {
      const scopedCssText = await fetchScopedStylesheet(absoluteUrl.href, targetScopeClass);
      const style = document.createElement('style');
      style.dataset.legacyScopedLink = absoluteUrl.href;
      style.textContent = scopedCssText;
      document.head.appendChild(style);
    } catch (error) {
      if (absoluteUrl.origin === window.location.origin) {
        return;
      }

      const hasMatch = Array.from(document.head.querySelectorAll('link[rel="stylesheet"][href]'))
        .some((headLink) => headLink.href === absoluteUrl.href || headLink.getAttribute('href') === href);

      if (hasMatch) {
        return;
      }

      const clone = document.createElement('link');
      Array.from(link.attributes).forEach((attr) => {
        clone.setAttribute(attr.name, attr.value);
      });
      document.head.appendChild(clone);
    }
  };

  const promoteLegacyStyles = () => {
    if (!main) return;

    main.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
      if (link.dataset.legacyManaged === 'true') return;
      link.dataset.legacyManaged = 'true';
      injectScopedStylesheet(link, getLegacyScope(link));
    });
  };

  const scopeLegacyStyles = () => {
    if (!main) return;

    main.querySelectorAll('style').forEach((style) => {
      if (style.dataset.legacyScoped === 'true') return;
      const scopeTarget = getLegacyScope(style);
      const scopeSelector = scopeTarget && scopeTarget.classList.contains('legacy-entry-card')
        ? '.legacy-entry-card'
        : scopeTarget && scopeTarget.classList.contains('legacy-entry-shell')
          ? '.legacy-entry-shell'
          : '.legacy-page-shell';
      style.textContent = scopeLegacyStyleText(style.textContent || '', scopeSelector);
      style.dataset.legacyScoped = 'true';
    });
  };

  const syncLegacyAttributes = () => {
    if (!main) return;

    main.querySelectorAll('html, body').forEach((node) => {
      const target = getLegacyScope(node);
      if (!target) return;

      Array.from(node.attributes).forEach((attribute) => {
        if (attribute.name === 'class') {
          attribute.value.split(/\s+/).filter(Boolean).forEach((className) => {
            target.classList.add(className);
          });
          return;
        }

        if (attribute.name === 'onload') {
          const expression = attribute.value.trim();
          if (expression && !legacyOnloadQueue.includes(expression)) {
            legacyOnloadQueue.push(expression);
          }
          return;
        }

        if (!attribute.name.startsWith('data-') && attribute.name !== 'lang' && attribute.name !== 'dir') return;
        if (!target.hasAttribute(attribute.name)) {
          target.setAttribute(attribute.name, attribute.value);
        }
      });
    });
  };

  const replayLegacyOnloadHandlers = () => {
    if (!legacyOnloadQueue.length) return;

    const runHandlers = () => {
      legacyOnloadQueue.forEach((expression) => {
        try {
          const handler = new Function(expression);
          handler.call(window);
        } catch (error) {
          // Ignore legacy onload errors so the rest of the page can render.
        }
      });
    };

    if (document.readyState === 'complete') {
      window.setTimeout(runHandlers, 0);
      return;
    }

    window.addEventListener('load', runHandlers, { once: true });
  };

  const unwrapLegacyDocumentTags = () => {
    if (!main) return;

    rewriteLegacyContentUrls();
    promoteLegacyStyles();
    scopeLegacyStyles();
    syncLegacyAttributes();

    main.querySelectorAll('html, head, body').forEach((node) => {
      const parent = node.parentNode;
      if (!parent) return;

      while (node.firstChild) {
        parent.insertBefore(node.firstChild, node);
      }

      parent.removeChild(node);
    });
  };

  unwrapLegacyDocumentTags();
  replayLegacyOnloadHandlers();

  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = root.dataset.mode === 'dark' ? 'light' : 'dark';
      localStorage.setItem(storageKey, next);
      setMode(next);
    });
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', navLinks.classList.contains('is-open') ? 'true' : 'false');
    });
  }

  document.querySelectorAll('.rna-page-dropdown').forEach((dropdown) => {
    document.addEventListener('click', (event) => {
      if (!dropdown.contains(event.target)) {
        dropdown.removeAttribute('open');
      }
    });
  });
});
