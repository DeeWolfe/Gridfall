// Minimal DOM stub for the harnesses that exercise the renderer.
//
// The logic harnesses do NOT import this — the rules layer touches no DOM at
// all, which is the property worth protecting. If a logic test ever starts
// needing this file, something has leaked out of src/render/.
//
// The one piece of real work here is scan(): the renderer injects markup as
// innerHTML and then wires click handlers by querying it back, so the stub has
// to parse that markup or half the wiring never runs under test.

const elements = new Map();

/** Handlers registered through the global addEventListener, by event name. */
const handlers = {};

function makeElement(id) {
  const e = {
    id,
    _cls: new Set(),
    _html: '',
    _text: '',
    value: '',
    dataset: {},
    children: [],
    disabled: false,
    offsetWidth: 1,
    onclick: null,
    onchange: null,
    style: {setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; }},
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    get className() { return [...this._cls].join(' '); },
    set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); },
    appendChild(c) { this.children.push(c); },
    querySelector(sel) { return scan(this._html, sel)[0] || null; },
    querySelectorAll(sel) { return scan(this._html, sel); },
    getBoundingClientRect: () => ({width: 900, height: 500}),
    getContext: () => ({
      setTransform() {}, save() {}, restore() {},
      createLinearGradient: () => ({addColorStop() {}}),
      createRadialGradient: () => ({addColorStop() {}}),
      fillRect() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
      quadraticCurveTo() {}, closePath() {}, fill() {}, stroke() {}, arc() {},
      set fillStyle(_v) {}, set strokeStyle(_v) {}, set lineWidth(_v) {},
      set globalAlpha(_v) {}, set lineCap(_v) {},
    }),
    addEventListener() {},
    focus() {},
    select() {},
  };
  e.classList = {
    add: c => e._cls.add(c),
    remove: c => e._cls.delete(c),
    toggle: (c, v) => {
      if (v === undefined) { e._cls.has(c) ? e._cls.delete(c) : e._cls.add(c); }
      else { v ? e._cls.add(c) : e._cls.delete(c); }
    },
    contains: c => e._cls.has(c),
  };
  return e;
}

const camel = s => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());

/**
 * Parse injected markup for the selectors the renderer actually uses:
 * `[data-thing]` and `#some-id`. Returns one stub element per match.
 */
function scan(html, selector) {
  html = html || '';
  const out = [];
  const attrName = (selector.match(/\[data-([\w-]+)/) || [])[1];
  const idName = (selector.match(/#([\w-]+)/) || [])[1];

  if (attrName) {
    const re = new RegExp('data-' + attrName + '="([^"]*)"', 'g');
    let m;
    while ((m = re.exec(html))) {
      const el = makeElement('dyn');
      el.dataset[camel(attrName)] = m[1];
      // Card tiles carry data-mode alongside data-focus; keep them together.
      const near = html.slice(Math.max(0, m.index - 160), m.index + 160);
      const mode = /data-mode="([^"]*)"/.exec(near);
      if (mode) el.dataset.mode = mode[1];
      out.push(el);
    }
  } else if (idName && new RegExp('id="' + idName + '"').test(html)) {
    out.push(makeElement(idName));
  }
  return out;
}

// Results are cached per (selector, container contents) so repeated queries
// return the SAME stub objects. Tests rely on that: the pack flow marks
// buttons 'taken'/'returned' through one query and reads them back in another.
const queryCache = new Map();

function queryAll(selector) {
  const scoped = (selector.match(/^#([\w-]+)/) || [])[1];
  const sources = scoped ? [scoped] : [...elements.keys()];
  const key = selector + ' ' + sources.map(id => {
    const el = elements.get(id);
    return id + ':' + (el ? el._html.length + ':' + el._html.slice(0, 48) : '-');
  }).join('|');
  if (queryCache.has(key)) return queryCache.get(key);

  // A scoped selector names the container by id; scan inside that container
  // for the rest of the selector.
  const inner = scoped ? selector.replace(/^#[\w-]+\s*/, '') : selector;
  const out = [];
  for (const id of sources) {
    const el = elements.get(id);
    if (el) out.push(...scan(el._html, inner || selector));
  }
  queryCache.set(key, out);
  return out;
}

/** The stub element registered under `id`, created on first ask. */
export function get(id) {
  if (!elements.has(id)) elements.set(id, makeElement(id));
  return elements.get(id);
}

// Deferred timers, so a test can decide when an animation callback fires.
let timers = [];
/** Fire a window-level handler the renderer registered (resize, keydown, ...). */
export function dispatch(type, event) {
  if (handlers[type]) handlers[type](event || {});
}

/** Run every callback setTimeout has queued since the last flush. */
export function flushTimers() {
  const pending = timers;
  timers = [];
  pending.forEach(fn => fn());
}

/** Assign a global even where the runtime already defines it read-only. */
function define(name, value) {
  Object.defineProperty(globalThis, name, {value, writable: true, configurable: true});
}

/** Install the globals the renderer expects. Call before importing src/render. */
export function installDom() {
  globalThis.document = {
    documentElement: makeElement('html'),
    body: makeElement('body'),
    getElementById: get,
    querySelectorAll: queryAll,
    createElement: () => makeElement('n'),
    addEventListener() {},
  };
  globalThis.localStorage = {
    _d: {},
    getItem(k) { return this._d[k] ?? null; },
    setItem(k, v) { this._d[k] = v; },
    removeItem(k) { delete this._d[k]; },
  };
  // Node already defines navigator and performance as getter-only globals.
  if (!globalThis.navigator) define('navigator', {});
  if (!globalThis.performance) define('performance', {now: () => 0});
  globalThis.devicePixelRatio = 1;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.addEventListener = (type, fn) => { handlers[type] = fn; };
  globalThis.setInterval = () => 0;
  globalThis.setTimeout = fn => { timers.push(fn); return 0; };
}
