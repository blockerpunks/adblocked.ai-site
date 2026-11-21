// Paste each verified extension listing URL between its quotes when it exists.
// An empty or unsupported URL leaves only that browser's install links disabled.
// Chrome: https://chromewebstore.google.com/detail/<extension-id> or /detail/<listing-name>/<extension-id>
// The Chrome extension ID must be the real 32-character ID (lowercase a–p).
// Firefox: https://addons.mozilla.org/en-US/firefox/addon/<listing-slug>/
// Firefox URLs without the locale segment are also accepted.
// URL validation checks format only; it does not verify a listing's ownership or existence.
window.ADBLOCKED_CONFIG = Object.freeze({
  chromeWebStoreUrl: 'https://chromewebstore.google.com/detail/ikolncpmbfbkfmbmkfmcmkddnmnaplhc?utm_source=item-share-cb',
  firefoxAddonsUrl: 'https://addons.mozilla.org/firefox/addon/adblocked-ai/'
});
