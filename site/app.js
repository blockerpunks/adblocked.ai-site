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
    themeColor.content = isDark ? '#0f1e22' : '#ffffff';
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

  // This checks the URL format, not whether the listing exists or is ours.
  // Only configure listing addresses that have been verified separately.
  function configuredStoreUrl(browser, value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      var url = new URL(value.trim());
      if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
      if (browser === 'chrome') {
        if (url.hostname !== 'chromewebstore.google.com' ||
            !/^\/detail\/[a-z0-9_-]+\/[a-p]{32}\/?$/i.test(url.pathname) ||
            /[A-Z]/.test(url.pathname.split('/').filter(Boolean).pop())) return null;
      } else if (browser === 'firefox') {
        if (url.hostname !== 'addons.mozilla.org' ||
            !/^\/(?:[a-z]{2,3}(?:-[a-z0-9]{2,8})*\/)?firefox\/addon\/[a-z0-9_-]+\/?$/i.test(url.pathname)) return null;
      } else {
        return null;
      }
      return url.href;
    } catch (_) {
      return null;
    }
  }

  var config = window.ADBLOCKED_CONFIG || {};
  var stores = {
    chrome: {
      url: configuredStoreUrl('chrome', config.chromeWebStoreUrl),
      title: 'Open the Chrome Web Store in a new tab',
      note: 'Opens the Chrome Web Store in a new tab.'
    },
    firefox: {
      url: configuredStoreUrl('firefox', config.firefoxAddonsUrl),
      title: 'Open Firefox Add-ons in a new tab',
      note: 'Opens Firefox Add-ons in a new tab.'
    }
  };
  document.querySelectorAll('[data-install]').forEach(function (link) {
    var store = stores[link.getAttribute('data-install')];
    if (store && store.url) {
      link.href = store.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.removeAttribute('aria-disabled');
      link.removeAttribute('tabindex');
      link.title = store.title;
    } else {
      link.addEventListener('click', function (event) { event.preventDefault(); });
      link.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
      });
    }
  });
  document.querySelectorAll('[data-install-note]').forEach(function (note) {
    var store = stores[note.getAttribute('data-install-note')];
    if (store && store.url) note.textContent = store.note;
  });
}());
