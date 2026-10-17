/**
 * Loads the app's browser scripts into the Node test process the same way a page
 * loads classic <script> tags: top-level declarations become shared globals.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');

class MemoryStorage {
  constructor() { this._data = new Map(); }
  getItem(key) { return this._data.has(key) ? this._data.get(key) : null; }
  setItem(key, value) { this._data.set(key, String(value)); }
  removeItem(key) { this._data.delete(key); }
  clear() { this._data.clear(); }
}

function setupBrowserGlobals() {
  const events = new EventTarget();
  const define = (name, value) => Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  define('window', globalThis);
  define('localStorage', new MemoryStorage());
  // 'file:' disables the disk sync and native sound/notification bridges (no server in tests)
  define('location', { protocol: 'file:' });
  define('addEventListener', events.addEventListener.bind(events));
  define('removeEventListener', events.removeEventListener.bind(events));
  define('dispatchEvent', events.dispatchEvent.bind(events));
}

/** Runs scripts from js/ in order, e.g. load('storage.js', 'timer.js'). */
function load(...files) {
  setupBrowserGlobals();
  for (const file of files) {
    const filename = path.join(ROOT, 'js', file);
    vm.runInThisContext(fs.readFileSync(filename, 'utf8'), { filename });
  }
}

/** Reads a top-level binding declared by a loaded script (const/class are not window props). */
function global(name) {
  return vm.runInThisContext(name);
}

module.exports = { load, global };
