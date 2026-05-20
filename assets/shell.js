document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const storageKey = 'rna-web-family-mode';
  const toggle = document.querySelector('[data-mode-toggle]');
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navLinks = document.querySelector('[data-page-links]');

  const setMode = (mode) => {
    root.dataset.mode = mode;
    if (toggle) {
      toggle.textContent = mode === 'dark' ? 'Light mode' : 'Dark mode';
    }
  };

  const savedMode = localStorage.getItem(storageKey);
  setMode(savedMode === 'dark' ? 'dark' : 'light');

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
