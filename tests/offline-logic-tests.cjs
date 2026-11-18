const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const base = path.resolve(__dirname, '../site');
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
const scripts = ['theme-init.js', 'app.js'].map(name => [name, fs.readFileSync(path.join(base, name), 'utf8')]);
const key = 'adblocked-ai-theme';
// Deliberately synthetic: syntax testing only, never navigated or presented as a listing.
const syntheticStoreUrl = 'https://chromewebstore.google.com/detail/test-only/abcdefghijklmnopabcdefghijklmnop';
const syntheticFirefoxUrl = 'https://addons.mozilla.org/en-US/firefox/addon/synthetic-test-only/';

class MockElement {
  constructor(attrs = {}) {
    this.attrs = { ...attrs };
    this.listeners = {};
    this.dataset = {};
    this.textContent = '';
    this.hidden = Object.hasOwn(attrs, 'hidden');
  }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  fire(type, extra = {}) {
    const event = { type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
    for (const handler of this.listeners[type] || []) handler(event);
    return event;
  }
}
for (const name of ['href', 'target', 'rel', 'title']) {
  Object.defineProperty(MockElement.prototype, name, {
    get() { return this.attrs[name] ?? ''; },
    set(value) { this.attrs[name] = String(value); },
  });
}
function parseAttrs(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].slice(1).map(m => [m[1], m[2] ?? '']));
}
function loadPage({ saved, store = new Map(), config, getThrows = false, setThrows = false } = {}) {
  if (saved !== undefined) store.set(key, saved);
  const root = new MockElement();
  const toggle = new MockElement(parseAttrs(html.match(/<button\b[^>]*class="theme-toggle"[^>]*>/)[0]));
  const label = new MockElement();
  const color = new MockElement();
  const links = [...html.matchAll(/<a\b[^>]*\bdata-install\b[^>]*>/g)].map(m => new MockElement(parseAttrs(m[0])));
  const notes = [...html.matchAll(/<[^>]+\bdata-install-note\b[^>]*>([^<]*)</g)].map(m => Object.assign(new MockElement(parseAttrs(m[0].slice(0, m[0].indexOf('>') + 1))), { textContent: m[1] }));
  const window = new MockElement();
  if (config !== undefined) window.ADBLOCKED_CONFIG = config;
  const context = vm.createContext({
    URL,
    window,
    document: {
      documentElement: root,
      querySelector(selector) {
        const values = { '.theme-toggle': toggle, '.theme-label': label, 'meta[name="theme-color"]': color };
        assert.ok(Object.hasOwn(values, selector), `Unexpected selector ${selector}`);
        return values[selector];
      },
      querySelectorAll(selector) {
        if (selector === '[data-install]') return links;
        if (selector === '[data-install-note]') return notes;
        throw Error(`Unexpected selector ${selector}`);
      },
    },
    localStorage: {
      getItem(name) { if (getThrows) throw Error('storage unavailable'); return store.get(name) ?? null; },
      setItem(name, value) { if (setThrows) throw Error('storage unavailable'); store.set(name, value); },
    },
  });
  for (const [filename, source] of scripts) vm.runInContext(source, context, { filename });
  return { root, toggle, label, color, links, notes, window, store };
}
function assertTheme(page, theme) {
  const dark = theme === 'dark';
  assert.equal(page.root.dataset.theme, theme);
  assert.equal(page.label.textContent, dark ? 'Light' : 'Dark');
  assert.equal(page.toggle.getAttribute('aria-label'), dark ? 'Switch to light mode' : 'Switch to dark mode');
  assert.equal(page.toggle.title, page.toggle.getAttribute('aria-label'));
  assert.equal(page.color.content, dark ? '#0f1e22' : '#ffffff');
  assert.equal(page.toggle.hidden, false);
}
function assertBrowser(page, browser, url = null) {
  const links = page.links.filter(link => link.getAttribute('data-install') === browser);
  const notes = page.notes.filter(note => note.getAttribute('data-install-note') === browser);
  assert.equal(links.length, 3, `Three ${browser} links`);
  assert.equal(notes.length, 3, `Three ${browser} notes`);
  const storeName = browser === 'chrome' ? 'the Chrome Web Store' : 'Firefox Add-ons';
  for (const link of links) {
    if (url) {
      assert.equal(link.href, url);
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
      assert.equal(link.getAttribute('aria-disabled'), null);
      assert.equal(link.getAttribute('tabindex'), null);
      assert.equal(link.title, `Open ${storeName} in a new tab`);
      assert.equal(link.fire('click').defaultPrevented, false);
      assert.equal(link.fire('keydown', { key: 'Enter' }).defaultPrevented, false);
    } else {
      assert.equal(link.getAttribute('aria-disabled'), 'true');
      assert.equal(link.href, '');
      assert.equal(link.getAttribute('tabindex'), '0');
      assert.equal(link.fire('click').defaultPrevented, true);
      assert.equal(link.fire('keydown', { key: 'Enter' }).defaultPrevented, true);
      assert.equal(link.fire('keydown', { key: ' ' }).defaultPrevented, true);
      assert.equal(link.fire('keydown', { key: 'Tab' }).defaultPrevented, false);
    }
  }
  for (const note of notes) {
    assert.equal(note.textContent, url ? `Opens ${storeName} in a new tab.` : `${browser === 'chrome' ? 'Chrome' : 'Firefox'} link coming soon.`);
  }
}
function assertDisabled(page) {
  assert.equal(page.links.length, 6);
  assert.equal(page.notes.length, 6);
  assertBrowser(page, 'chrome');
  assertBrowser(page, 'firefox');
}
let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (err) { console.error(`FAIL ${name}: ${err.stack}`); process.exitCode = 1; }
}

test('first visit initializes light and correct controls', () => assertTheme(loadPage(), 'light'));
test('saved dark initializes dark before app logic', () => assertTheme(loadPage({ saved: 'dark' }), 'dark'));
test('saved light initializes light', () => assertTheme(loadPage({ saved: 'light' }), 'light'));
for (const saved of ['system', 'Dark', 'invalid', '', 'null']) {
  test(`invalid saved theme ${JSON.stringify(saved)} falls back to light`, () => assertTheme(loadPage({ saved }), 'light'));
}
test('blocked storage reads and writes still allow both toggles', () => {
  const page = loadPage({ getThrows: true, setThrows: true });
  assertTheme(page, 'light');
  page.toggle.fire('click'); assertTheme(page, 'dark');
  page.toggle.fire('click'); assertTheme(page, 'light');
});
test('manual dark and light choices persist across reloads', () => {
  const store = new Map();
  const first = loadPage({ store });
  first.toggle.fire('click'); assert.equal(store.get(key), 'dark');
  const second = loadPage({ store }); assertTheme(second, 'dark');
  second.toggle.fire('click'); assert.equal(store.get(key), 'light');
  assertTheme(loadPage({ store }), 'light');
});
test('cross-tab changes update theme and controls; unrelated keys ignored', () => {
  const page = loadPage();
  page.window.fire('storage', { key, newValue: 'dark' }); assertTheme(page, 'dark');
  page.window.fire('storage', { key: 'other-preference', newValue: 'light' }); assertTheme(page, 'dark');
  page.window.fire('storage', { key, newValue: 'light' }); assertTheme(page, 'light');
  page.window.fire('storage', { key, newValue: 'dark' });
  page.window.fire('storage', { key, newValue: 'invalid' }); assertTheme(page, 'light');
  page.window.fire('storage', { key, newValue: 'dark' });
  page.window.fire('storage', { key: null, newValue: null }); assertTheme(page, 'light');
});
test('missing configuration keeps all six CTAs disabled', () => assertDisabled(loadPage()));
test('delivered configuration enables only the live Firefox listing', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(base, 'config.js'), 'utf8'), context);
  const firefoxUrl = 'https://addons.mozilla.org/firefox/addon/adblocked-ai/';
  assert.equal(context.window.ADBLOCKED_CONFIG.chromeWebStoreUrl, '');
  assert.equal(context.window.ADBLOCKED_CONFIG.firefoxAddonsUrl, firefoxUrl);
  const page = loadPage({ config: context.window.ADBLOCKED_CONFIG });
  assertBrowser(page, 'chrome');
  assertBrowser(page, 'firefox', firefoxUrl);
});
const invalidConfigs = [
  ['empty string', ''], ['whitespace', '   '], ['missing value', undefined], ['null value', null], ['non-string', 42],
  ['malformed', 'not a URL'], ['relative path', '/detail/test-only/abcdefghijklmnopabcdefghijklmnop'],
  ['wrong host', syntheticStoreUrl.replace('chromewebstore.google.com', 'example.com')],
  ['host suffix', syntheticStoreUrl.replace('chromewebstore.google.com', 'chromewebstore.google.com.example.com')],
  ['javascript scheme', 'javascript:alert(1)'], ['http scheme', syntheticStoreUrl.replace('https:', 'http:')],
  ['username present', syntheticStoreUrl.replace('https://', 'https://example@')],
  ['password present', syntheticStoreUrl.replace('https://', 'https://example:password@')],
  ['nonstandard port', syntheticStoreUrl.replace('.com/', '.com:8443/')],
  ['short extension ID', syntheticStoreUrl.slice(0, -1)],
  ['long extension ID', syntheticStoreUrl + 'a'],
  ['wrong ID alphabet', syntheticStoreUrl.slice(0, -1) + 'z'],
  ['uppercase ID', syntheticStoreUrl.slice(0, -1) + 'A'],
  ['missing slug', syntheticStoreUrl.replace('/test-only', '')],
  ['extra path segment', syntheticStoreUrl + '/extra'],
];
for (const [name, value] of invalidConfigs) test(`Chrome ${name} URL stays disabled while Firefox stays available`, () => {
  const page = loadPage({ config: { chromeWebStoreUrl: value, firefoxAddonsUrl: syntheticFirefoxUrl } });
  assertBrowser(page, 'chrome');
  assertBrowser(page, 'firefox', syntheticFirefoxUrl);
});
const invalidFirefoxConfigs = [
  ['empty string', ''], ['whitespace', '   '], ['missing value', undefined], ['null value', null], ['non-string', 42],
  ['malformed', 'not a URL'], ['relative path', '/en-US/firefox/addon/synthetic-test-only/'],
  ['wrong host', syntheticFirefoxUrl.replace('addons.mozilla.org', 'example.com')],
  ['host suffix', syntheticFirefoxUrl.replace('addons.mozilla.org', 'addons.mozilla.org.example.com')],
  ['javascript scheme', 'javascript:alert(1)'], ['http scheme', syntheticFirefoxUrl.replace('https:', 'http:')],
  ['username present', syntheticFirefoxUrl.replace('https://', 'https://example@')],
  ['password present', syntheticFirefoxUrl.replace('https://', 'https://example:password@')],
  ['nonstandard port', syntheticFirefoxUrl.replace('.org/', '.org:8443/')],
  ['missing listing slug', 'https://addons.mozilla.org/en-US/firefox/addon/'],
  ['listing search', 'https://addons.mozilla.org/en-US/firefox/search/?q=example'],
  ['extra path segment', syntheticFirefoxUrl + 'reviews/'],
  ['wrong product', syntheticFirefoxUrl.replace('/firefox/', '/thunderbird/')],
  ['malformed locale', syntheticFirefoxUrl.replace('/en-US/', '/english-US/')],
  ['encoded slash in slug', syntheticFirefoxUrl.replace('synthetic-test-only', 'synthetic%2Ftest')],
];
for (const [name, value] of invalidFirefoxConfigs) test(`Firefox ${name} URL stays disabled while Chrome stays available`, () => {
  const page = loadPage({ config: { chromeWebStoreUrl: syntheticStoreUrl, firefoxAddonsUrl: value } });
  assertBrowser(page, 'chrome', syntheticStoreUrl);
  assertBrowser(page, 'firefox');
});
test('Chrome-only configuration enables only Chrome and updates only Chrome notes', () => {
  const page = loadPage({ config: { chromeWebStoreUrl: syntheticStoreUrl } });
  assertBrowser(page, 'chrome', syntheticStoreUrl);
  assertBrowser(page, 'firefox');
});
test('Firefox-only configuration enables only Firefox and updates only Firefox notes', () => {
  const page = loadPage({ config: { firefoxAddonsUrl: syntheticFirefoxUrl } });
  assertBrowser(page, 'chrome');
  assertBrowser(page, 'firefox', syntheticFirefoxUrl);
});
test('both configured browser URLs enable six links with their own destinations', () => {
  const page = loadPage({ config: { chromeWebStoreUrl: syntheticStoreUrl, firefoxAddonsUrl: syntheticFirefoxUrl } });
  assert.equal(page.links.length, 6);
  assertBrowser(page, 'chrome', syntheticStoreUrl);
  assertBrowser(page, 'firefox', syntheticFirefoxUrl);
});
test('exchanged browser destinations remain disabled', () => {
  assertDisabled(loadPage({ config: { chromeWebStoreUrl: syntheticFirefoxUrl, firefoxAddonsUrl: syntheticStoreUrl } }));
});
for (const locale of ['', 'de/', 'pt-BR/', 'zh-CN/', 'sr-Latn/']) {
  test(`Firefox direct listing with ${locale || 'no locale'} is accepted`, () => {
    const url = syntheticFirefoxUrl.replace('en-US/', locale);
    assertBrowser(loadPage({ config: { firefoxAddonsUrl: url } }), 'firefox', url);
  });
}
test('surrounding whitespace is removed from both configured URLs', () => {
  const page = loadPage({ config: { chromeWebStoreUrl: ` ${syntheticStoreUrl} `, firefoxAddonsUrl: `\n${syntheticFirefoxUrl}\n` } });
  assertBrowser(page, 'chrome', syntheticStoreUrl);
  assertBrowser(page, 'firefox', syntheticFirefoxUrl);
});
test('optional trailing slash and normal listing query/hash keep the correct browser destination', () => {
  const chrome = syntheticStoreUrl + '/?hl=en#details';
  const firefox = syntheticFirefoxUrl.slice(0, -1) + '?utm_source=site#details';
  const page = loadPage({ config: { chromeWebStoreUrl: chrome, firefoxAddonsUrl: firefox } });
  assertBrowser(page, 'chrome', chrome);
  assertBrowser(page, 'firefox', firefox);
});
console.log(`\n${passed} test cases passed${process.exitCode ? '; failures occurred' : '; no failures'}.`);
