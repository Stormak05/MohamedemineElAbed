import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const touch = readFileSync(new URL('../touch.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');

function fullscreenContext(keyboard) {
  const listeners = new Map();
  const document = { addEventListener: (event, fn) => listeners.set(event, fn) };
  const ctx = vm.createContext({ document, window: { top: { navigator: { keyboard } } } });
  vm.runInContext(touch.slice(touch.indexOf('function lockEscape()'), touch.indexOf('// Must run synchronously')), ctx);
  return { document, change: () => listeners.get('fullscreenchange')() };
}

test('fullscreen reserves Escape through the top frame and releases it on exit', () => {
  const calls = [];
  const { document, change } = fullscreenContext({
    lock: (keys) => { calls.push(Array.from(keys)); return Promise.resolve(); },
    unlock: () => calls.push('unlock'),
  });
  document.fullscreenElement = {};
  change();
  assert.deepEqual(calls, [['Escape']]);
  document.fullscreenElement = null;
  change();
  assert.deepEqual(calls, [['Escape'], 'unlock']);
});

test('missing or denied Keyboard Lock does not interrupt fullscreen', async () => {
  for (const keyboard of [undefined, { lock: () => Promise.reject(new Error('denied')) }]) {
    const { document, change } = fullscreenContext(keyboard);
    document.fullscreenElement = {};
    assert.doesNotThrow(change);
    await new Promise((resolve) => setImmediate(resolve));
    document.fullscreenElement = null;
    assert.doesNotThrow(change);
  }
});

test('short Escape releases the pointer for pause, without exiting fullscreen or repeating', () => {
  let keydown, released = 0;
  const canvas = {};
  const ctx = vm.createContext({
    addEventListener: (_event, fn) => { keydown = fn; },
    G: { mode: 'free', started: true }, menus: { isOpen: () => false }, choiceKey: null,
    canvas, document: { pointerLockElement: canvas, exitPointerLock: () => released++ },
  });
  const start = main.indexOf("addEventListener('keydown', (e) => {", main.indexOf('// ---------- Input'));
  vm.runInContext(main.slice(start, main.indexOf("addEventListener('keyup'", start)), ctx);
  keydown({ code: 'Escape', repeat: false });
  assert.equal(released, 1);
  keydown({ code: 'Escape', repeat: true });
  assert.equal(released, 1);
});
