import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
function game() {
  const G = { mode: 'free' };
  const context = vm.createContext({
    G, keys: { clear() {} }, assets: { medical_bed: { getObjectByName: () => ({ getWorldPosition() {} }) } },
    THREE: { Vector3: class { clone() { return this; } add() { return this; } } },
    player: { pos: { set() {} } }, cam: { off: { pos: {} } }, lookQuat() {},
    wait: async () => {}, eyelids: async () => {}, thought() {},
    camera: { position: { clone: () => ({ sub: () => ({ y: 1, clone() { return this; }, lerp() { return this; }, setY() { return this; } }) }) } },
    START: {}, ease: {}, camTo: async () => {}, between: () => 0,
    // Stop after the opening shots, once wakeUp hands off to the sitting-up sequence.
    audio: { noise() { throw new Error('sitting up'); } },
  });
  const start = source.indexOf('{\n  let mode = G.mode;');
  vm.runInContext(source.slice(start, source.indexOf('\nfunction newRunId', start)), context);
  vm.runInContext(source.slice(source.indexOf('function lieInBed('), source.indexOf('// Through the gate:')), context);
  vm.runInContext(source.slice(source.indexOf('const done = () =>'), source.indexOf('\n', source.indexOf('const done = () =>'))), context);
  return { G, context };
}

test('waking up can return control while a real collapse remains irreversible', async () => {
  const { G, context } = game();
  await assert.rejects(vm.runInContext('wakeUp()', context), /sitting up/);
  assert.equal(G.mode, 'busy');
  vm.runInContext('done()', context);
  assert.equal(G.mode, 'free', 'walking and looking require free mode');
  vm.runInContext('lieInBed(); done()', context);
  assert.equal(G.mode, 'fallen');
  G.mode = 'free';
  assert.equal(G.mode, 'fallen');
  G.mode = 'end';
  assert.equal(G.mode, 'end');
});
