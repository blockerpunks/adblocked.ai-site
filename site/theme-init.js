// Apply the saved manual choice before rendering. First visits always use light.
(function () {
  'use strict';
  var theme = 'light';
  try {
    if (localStorage.getItem('adblocked-ai-theme') === 'dark') theme = 'dark';
  } catch (_) {
    // Storage may be unavailable in private or local-file browsing.
  }
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#141615' : '#ffffff';
}());
