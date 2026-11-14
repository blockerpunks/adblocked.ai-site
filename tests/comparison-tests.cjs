const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../site/comparison.js'), 'utf8');

// Small event/DOM contract fixture: test user-observable states and drag lifecycle,
// while native range keyboard behavior is checked separately in a real browser.
class Element {
  constructor() {
    this.listeners = new Map();
    this.attributes = new Map();
    this.properties = new Map();
    this.classes = new Set();
    this.captured = new Set();
    this.captureCalls = [];
    this.releaseCalls = [];
    this.focusCalls = [];
    this.style = { setProperty: (name, value) => this.properties.set(name, value) };
    this.classList = { add: name => this.classes.add(name) };
    this.hidden = true;
    this.value = '50';
    this.dataset = {};
    this.bounds = { left: 100, width: 400 };
  }
  addEventListener(name, handler) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(handler);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  getBoundingClientRect() { return { ...this.bounds }; }
  setPointerCapture(id) { this.captureCalls.push(id); this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.releaseCalls.push(id); this.captured.delete(id); }
  focus(options) { this.focusCalls.push(options); }
  fire(name, values = {}) {
    const event = {
      isPrimary: true, button: 0, pointerId: 7, pointerType: 'mouse', clientX: 300,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...values,
    };
    for (const handler of this.listeners.get(name) || []) handler(event);
    return event;
  }
}

function fixture(initial = '50') {
  const stage = new Element();
  const range = new Element();
  const handle = new Element();
  const controls = new Element();
  const before = new Element();
  const after = new Element();
  range.value = initial;
  before.dataset.comparisonView = 'before';
  after.dataset.comparisonView = 'after';
  const nodes = {
    '.comparison-stage': stage, '.comparison-range': range,
    '.comparison-handle': handle, '.comparison-controls': controls,
  };
  const comparison = {
    querySelector(selector) { assert.ok(selector in nodes); return nodes[selector]; },
    querySelectorAll(selector) { assert.equal(selector, '[data-comparison-view]'); return [before, after]; },
  };
  return { comparison, stage, range, handle, controls, before, after };
}

function initialize(fixtures) {
  const context = vm.createContext({
    document: {
      querySelectorAll(selector) {
        assert.equal(selector, '[data-comparison]');
        return fixtures.map(item => item.comparison);
      },
    },
  });
  vm.runInContext(source, context, { filename: 'comparison.js' });
}

function load(initial) {
  const page = fixture(initial);
  initialize([page]);
  return page;
}

function position(page, value, accessible) {
  assert.equal(page.range.value, String(value));
  assert.equal(page.stage.properties.get('--position'), `${value}%`);
  if (accessible !== undefined) assert.equal(page.range.getAttribute('aria-valuetext'), accessible);
}

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}: ${error.stack}`); process.exitCode = 1; }
}

test('initial state exposes controls and describes an even comparison', () => {
  const page = load();
  position(page, 50, '50% before, 50% after');
  assert.equal(page.range.hidden, false);
  assert.equal(page.handle.hidden, false);
  assert.equal(page.controls.hidden, false);
  assert.ok(page.stage.classes.has('comparison-ready'));
  assert.equal(page.stage.captureCalls.length, 0);
  assert.equal(page.range.focusCalls.length, 0);
});

test('native range input updates visible and accessible values at tenth precision', () => {
  const page = load();
  page.range.value = '33.34';
  page.range.fire('input');
  position(page, 33.3, '33.3% before, 66.7% after');
});

test('native range change updates visible and accessible values', () => {
  const page = load();
  page.range.value = '72.6';
  page.range.fire('change');
  position(page, 72.6, '72.6% before, 27.4% after');
});

test('range values outside either edge clamp to complete views', () => {
  const page = load();
  page.range.value = '-18'; page.range.fire('input');
  position(page, 0, 'After: sponsored content removed');
  page.range.value = '135'; page.range.fire('change');
  position(page, 100, 'Before: sponsored content visible');
});

test('nonfinite range values safely reset to the midpoint', () => {
  const page = load();
  for (const value of ['NaN', 'Infinity', '-Infinity', 'invalid']) {
    page.range.value = value;
    page.range.fire('input');
    position(page, 50, '50% before, 50% after');
  }
});

test('before and after buttons expose complete views and matching accessible text', () => {
  const page = load();
  page.before.fire('click');
  position(page, 100, 'Before: sponsored content visible');
  page.after.fire('click');
  position(page, 0, 'After: sponsored content removed');
});

test('primary mouse press uses local coordinates, captures pointer and focuses without scroll', () => {
  const page = load();
  const event = page.stage.fire('pointerdown', { clientX: 200 });
  position(page, 25, '25% before, 75% after');
  assert.deepEqual(page.stage.captureCalls, [7]);
  assert.ok(page.stage.captured.has(7));
  assert.equal(page.range.focusCalls.length, 1);
  assert.equal(page.range.focusCalls[0].preventScroll, true);
  assert.equal(event.defaultPrevented, true);
});

test('touch interaction updates and captures without suppressing native scroll defaults', () => {
  const page = load();
  const event = page.stage.fire('pointerdown', { pointerType: 'touch', clientX: 400 });
  position(page, 75);
  assert.ok(page.stage.captured.has(7));
  assert.equal(event.defaultPrevented, false);
});

test('active pointer movement follows coordinates and clamps outside the image', () => {
  const page = load();
  page.stage.fire('pointerdown');
  page.stage.fire('pointermove', { clientX: 420 }); position(page, 80);
  page.stage.fire('pointermove', { clientX: -500 }); position(page, 0);
  page.stage.fire('pointermove', { clientX: 900 }); position(page, 100);
});

test('nonprimary and nonleft presses cannot start or alter an interaction', () => {
  const page = load();
  const secondary = page.stage.fire('pointerdown', { isPrimary: false, clientX: 100 });
  const right = page.stage.fire('pointerdown', { button: 2, clientX: 500 });
  const middle = page.stage.fire('pointerdown', { button: 1, clientX: 400 });
  page.stage.fire('pointermove', { clientX: 500 });
  position(page, 50);
  assert.equal(page.stage.captureCalls.length, 0);
  assert.equal(page.range.focusCalls.length, 0);
  assert.equal(secondary.defaultPrevented || right.defaultPrevented || middle.defaultPrevented, false);
});

test('unrelated pointer events cannot move or terminate an active drag', () => {
  const page = load();
  page.stage.fire('pointerdown', { clientX: 200 });
  page.stage.fire('pointermove', { pointerId: 12, clientX: 500 });
  page.stage.fire('pointerup', { pointerId: 12 });
  page.stage.fire('pointercancel', { pointerId: 12 });
  position(page, 25);
  assert.ok(page.stage.captured.has(7));
  page.stage.fire('pointermove', { clientX: 400 }); position(page, 75);
});

test('pointer release relinquishes capture and prevents subsequent movement', () => {
  const page = load();
  page.stage.fire('pointerdown', { clientX: 200 });
  page.stage.fire('pointerup');
  assert.deepEqual(page.stage.releaseCalls, [7]);
  assert.equal(page.stage.captured.size, 0);
  page.stage.fire('pointermove', { clientX: 500 }); position(page, 25);
});

test('pointer cancellation relinquishes capture and prevents subsequent movement', () => {
  const page = load();
  page.stage.fire('pointerdown', { clientX: 400 });
  page.stage.fire('pointercancel');
  assert.deepEqual(page.stage.releaseCalls, [7]);
  assert.equal(page.stage.captured.size, 0);
  page.stage.fire('pointermove', { clientX: 100 }); position(page, 75);
});

test('lost capture ends dragging and permits a new interaction', () => {
  const page = load();
  page.stage.fire('pointerdown', { clientX: 200 });
  page.stage.captured.delete(7); // Browser has already removed capture before this event.
  page.stage.fire('lostpointercapture');
  page.stage.fire('pointermove', { clientX: 500 }); position(page, 25);
  page.stage.fire('pointerdown', { pointerId: 9, clientX: 400 }); position(page, 75);
  assert.ok(page.stage.captured.has(9));
});

test('cleanup tolerates capture already removed by the browser', () => {
  const page = load();
  page.stage.fire('pointerdown', { clientX: 200 });
  page.stage.captured.delete(7);
  page.stage.fire('pointerup');
  assert.deepEqual(page.stage.releaseCalls, []);
  page.stage.fire('pointermove', { clientX: 500 }); position(page, 25);
});

test('zero width images do not divide by zero or corrupt existing position', () => {
  const page = load();
  page.stage.bounds.width = 0;
  page.stage.fire('pointerdown', { clientX: 500 }); position(page, 50);
  page.stage.fire('pointermove', { clientX: 1000 }); position(page, 50);
  page.stage.bounds.width = 400;
  page.stage.fire('pointermove', { clientX: 400 }); position(page, 75);
});

test('separate comparisons keep independent positions and drag states', () => {
  const first = fixture();
  const second = fixture();
  initialize([first, second]);
  first.before.fire('click'); position(first, 100); position(second, 50);
  second.stage.fire('pointerdown', { clientX: 200 });
  second.stage.fire('pointermove', { clientX: 400 });
  position(first, 100); position(second, 75);
});

test('pages without comparisons initialize safely', () => initialize([]));

console.log(`\n${passed} comparison test cases passed${process.exitCode ? '; failures occurred' : '; no failures'}.`);
