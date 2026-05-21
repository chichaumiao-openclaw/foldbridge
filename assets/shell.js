document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const storageKey = 'rna-web-family-mode';
  const toggle = document.querySelector('[data-mode-toggle]');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navLinks = document.querySelector('[data-page-links]');
  const main = document.querySelector('.rna-main');

  const setMode = (mode) => {
    root.dataset.mode = mode;
    if (toggle) {
      toggle.textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
    }
  };

  const savedMode = localStorage.getItem(storageKey);
  setMode(savedMode === 'dark' ? 'dark' : 'light');

  const promoteLegacyStyles = () => {
    if (!main) return;

    main.querySelectorAll('link[rel="stylesheet"][href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;

      const hasMatch = Array.from(document.head.querySelectorAll('link[rel="stylesheet"][href]'))
        .some((headLink) => headLink.href === link.href || headLink.getAttribute('href') === href);

      if (hasMatch) return;

      const clone = document.createElement('link');
      Array.from(link.attributes).forEach((attr) => {
        clone.setAttribute(attr.name, attr.value);
      });
      document.head.appendChild(clone);
    });
  };

  const scopeLegacyStyleText = (cssText) => {
    return cssText
      .replace(/(^|[\n\r]\s*):root\b/gm, '$1.legacy-page-shell')
      .replace(/(^|[,{]\s*)body(?=[\s.#:[{,])/gm, '$1.legacy-page-shell')
      .replace(/(^|[,{]\s*)html(?=[\s.#:[{,])/gm, '$1.legacy-page-shell');
  };

  const scopeLegacyStyles = () => {
    if (!main) return;

    main.querySelectorAll('style').forEach((style) => {
      if (style.dataset.legacyScoped === 'true') return;
      style.textContent = scopeLegacyStyleText(style.textContent || '');
      style.dataset.legacyScoped = 'true';
    });
  };

  const syncLegacyDataAttributes = () => {
    if (!main) return;

    const targets = main.querySelectorAll('.legacy-page-shell, .legacy-entry-shell, .legacy-entry-card');
    if (!targets.length) return;

    Array.from(document.body.attributes).forEach((attribute) => {
      if (!attribute.name.startsWith('data-')) return;
      targets.forEach((target) => {
        target.setAttribute(attribute.name, attribute.value);
      });
    });
  };

  const unwrapLegacyDocumentTags = () => {
    if (!main) return;

    promoteLegacyStyles();
    scopeLegacyStyles();
    syncLegacyDataAttributes();

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
