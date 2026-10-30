const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('qqmail-local-themes.user.js', 'utf8');

function load(initial = 'bambooforest', options = {}) {
  const names = new Set(['page-theme-default', 'account-private-token']);
  const callbacks = new Map(), saved = { selectedTheme: initial }, logs = [];
  const observers = [], timers = new Map(), events = {};
  let reloads = 0, now = 0, nextTimer = 0;
  const classList = {
    contains: k => names.has(k),
    add: (...ks) => ks.forEach(k => names.add(k)),
    remove: (...ks) => ks.forEach(k => names.delete(k)),
    toggle: (k, v) => v ? names.add(k) : names.delete(k),
    [Symbol.iterator]: function* () { yield* names; }
  };
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; this.active = true; }
    disconnect() { this.active = false; }
  }
  const document = {
    body: { classList }, documentElement: {}, readyState: 'complete',
    addEventListener() {},
    querySelectorAll() {
      if (options.styleThrows) throw Error('private-session-url');
      return options.noLayers ? [] : [{}];
    }
  };
  const context = {
    document, window: { addEventListener: (name, cb) => events[name] = cb },
    location: { href: 'https://example.test/?sid=secret', reload() { reloads++; } },
    MutationObserver: Observer, queueMicrotask, Date: { now: () => now },
    setTimeout: cb => { timers.set(++nextTimer, cb); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    getComputedStyle: () => ({ backgroundImage: options.noBackground ? 'none' : 'url(private-url)' }),
    console: Object.fromEntries(['info', 'warn', 'error'].map(level =>
      [level, (...args) => logs.push({ level, args })])),
    GM_getValue: (k, d) => {
      if (options.readFails) throw Error('private-session-url');
      return saved[k] ?? d;
    },
    GM_setValue: (k, v) => {
      if (options.writeFails) throw Error('private-session-url');
      saved[k] = v;
    },
    GM_registerMenuCommand: (_label, cb, opts) => {
      if (options.menuThrows) throw Error('private-session-url');
      callbacks.set(opts.id, cb); return opts.id;
    },
    GM_unregisterMenuCommand: id => callbacks.delete(id)
  };
  if (options.noMenu) delete context.GM_registerMenuCommand;
  vm.runInNewContext(source, context);
  return {
    names, callbacks, saved, logs, events, document, timers,
    get reloads() { return reloads; },
    choose: key => callbacks.get('qqmail-theme-' + key)(),
    logged: event => logs.filter(entry => entry.args[1] === event),
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(cb => cb()); },
    async overwrite() {
      names.delete('page-theme-bambooforest'); names.add('page-theme-default');
      observers.find(o => o.target === document.body && o.active).callback();
      await Promise.resolve();
    },
    advance: ms => now += ms
  };
}

test('default theme applied; unrelated classes preserved', () => {
  const s = load();
  assert(s.names.has('page-theme-bambooforest'));
  assert(s.names.has('account-private-token'));
  assert.equal(s.logged('startup').length, 1);
});
test('switch all themes and persist without duplicate menus', () => {
  const s = load(); s.choose('orientalgreen');
  assert(s.names.has('page-color-theme'));
  assert.equal(s.saved.selectedTheme, 'orientalgreen');
  s.choose('blossomrain');
  assert(!s.names.has('page-color-theme'));
  assert(!s.names.has('page-theme-orientalgreen'));
  assert(s.names.has('page-theme-blossomrain'));
  assert.equal(s.callbacks.size, 5);
  assert(load(s.saved.selectedTheme).names.has('page-theme-blossomrain'));
});
test('turn off reloads native page; off startup does not apply a theme', () => {
  const s = load(); s.choose('off');
  assert.equal(s.reloads, 1); assert.equal(s.saved.selectedTheme, 'off');
  assert.equal(s.timers.size, 0);
  const off = load('off'); off.flush();
  assert(off.names.has('page-theme-default'));
  assert.equal(off.logged('theme-applied').length, 0);
  assert.equal(off.logged('theme-check-inconclusive').length, 0);
  off.choose('bambooforest'); assert(off.names.has('page-theme-bambooforest'));
});
test('invalid preference and storage failures are reported without logging raw values or errors', () => {
  const invalid = load('private-invalid-value');
  assert(invalid.names.has('page-theme-bambooforest'));
  assert.equal(invalid.logged('invalid-preference').length, 1);
  assert(!JSON.stringify(invalid.logs).includes('private-invalid-value'));
  const s = load(undefined, { readFails: true, writeFails: true });
  s.choose('orientalgreen');
  assert(s.names.has('page-theme-orientalgreen'));
  assert.equal(s.logged('storage-read-failed').length, 1);
  assert.equal(s.logged('storage-write-failed').length, 1);
  assert.equal(JSON.parse(s.logged('theme-selected')[0].args[2]).persisted, false);
  assert(!JSON.stringify(s.logs).includes('private-session-url'));
});
test('automatic and manual diagnostics contain structural state only', () => {
  const s = load(); s.flush(); s.choose('diagnostic');
  const entries = s.logged('diagnostic'); assert.equal(entries.length, 2);
  const data = JSON.parse(entries[1].args[2]);
  assert.equal(data.reason, 'manual'); assert.equal(data.classMatches, true);
  assert.equal(data.layerCount, 1); assert.equal(data.layersWithBackground, 1);
  assert.equal(data.menuCount, 5);
  assert(!JSON.stringify(s.logs).includes('private'));
  assert(!JSON.stringify(s.logs).includes('sid='));
});
test('missing layers, backgrounds or mismatched classes produce a diagnostic warning', () => {
  for (const options of [{ noLayers: true }, { noBackground: true }, {}]) {
    const s = load(undefined, options);
    if (!Object.keys(options).length) s.names.add('page-theme-conflict');
    s.flush(); assert.equal(s.logged('theme-check-inconclusive').length, 1);
  }
});
test('diagnostic or menu failures do not prevent theme application', () => {
  for (const options of [{ styleThrows: true }, { noMenu: true }, { menuThrows: true }]) {
    const s = load(undefined, options); s.flush();
    assert(s.names.has('page-theme-bambooforest'));
    assert(s.logs.some(entry => /failed|unavailable/.test(entry.args[1])));
    assert(!JSON.stringify(s.logs).includes('private-session-url'));
  }
});
test('repeated page overrides are repaired with rate-limited logs and retained counters', async () => {
  const s = load();
  for (let i = 0; i < 20; i++) await s.overwrite();
  assert(s.names.has('page-theme-bambooforest'));
  assert.equal(s.logged('theme-repaired').length, 1);
  s.choose('diagnostic');
  let data = JSON.parse(s.logged('diagnostic').at(-1).args[2]);
  assert.equal(data.repairs, 20); assert.equal(data.suppressedRepairs, 19);
  s.advance(10000); await s.overwrite();
  assert.equal(s.logged('theme-repaired').length, 2);
});
test('pending diagnostics are coalesced and cancelled when leaving the page', () => {
  const s = load(); s.choose('orientalgreen'); s.choose('blossomrain');
  assert.equal(s.timers.size, 1);
  s.events.pagehide(); assert.equal(s.timers.size, 0);
  s.events.pageshow(); s.flush();
  assert.equal(JSON.parse(s.logged('diagnostic')[0].args[2]).selected, 'blossomrain');
});
