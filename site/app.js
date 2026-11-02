(function () {
  'use strict';

  var root = document.documentElement;
  var toggle = document.querySelector('.theme-toggle');
  var label = document.querySelector('.theme-label');
  var themeColor = document.querySelector('meta[name="theme-color"]');

  function updateThemeControls() {
    var isDark = root.dataset.theme === 'dark';
    toggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    label.textContent = isDark ? 'Light' : 'Dark';
    toggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    themeColor.content = isDark ? '#141615' : '#ffffff';
  }

  toggle.hidden = false;
  updateThemeControls();
  toggle.addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem('adblocked-ai-theme', root.dataset.theme);
    } catch (_) {
      // The control still works for this page when storage is blocked.
    }
    updateThemeControls();
  });

  // Keep open tabs consistent when a choice is changed in another tab.
  window.addEventListener('storage', function (event) {
    if (event.key !== 'adblocked-ai-theme' && event.key !== null) return;
    root.dataset.theme = event.newValue === 'dark' ? 'dark' : 'light';
    updateThemeControls();
  });

  function verifiedStoreUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      var url = new URL(value.trim());
      if (url.protocol !== 'https:' || url.hostname !== 'chromewebstore.google.com' ||
          url.port || url.username || url.password ||
          !/^\/detail\/[a-z0-9_-]+\/[a-p]{32}\/?$/i.test(url.pathname) ||
          /[A-Z]/.test(url.pathname.split('/').filter(Boolean).pop())) return null;
      return url.href;
    } catch (_) {
      return null;
    }
  }

  var storeUrl = verifiedStoreUrl((window.ADBLOCKED_CONFIG || {}).chromeWebStoreUrl);
  document.querySelectorAll('[data-install]').forEach(function (link) {
    if (storeUrl) {
      link.href = storeUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.removeAttribute('aria-disabled');
      link.removeAttribute('tabindex');
      link.title = 'Open the Chrome Web Store in a new tab';
    } else {
      link.addEventListener('click', function (event) { event.preventDefault(); });
      link.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
      });
    }
  });
  if (storeUrl) {
    document.querySelectorAll('[data-install-note]').forEach(function (note) {
      note.textContent = 'Opens the Chrome Web Store in a new tab.';
    });
  }
}());
