import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');

for (const owned of [true, false]) {
  test(`dream ending wakes up with empty hands and no torch light (owned: ${owned})`, async () => {
    const G = { mode: 'free', torch: owned, torchOn: owned, time: 10 };
    const torch = { visible: owned, userData: { lens: { material: { color: { setScalar() {} } } } } };
    const torchLight = { intensity: owned ? 22 : 0 };
    let rested = false, woke = false, result;
    const context = vm.createContext({
      G, torch, torchLight, torchShown: owned, ending: false,
      cfg: { dTorchPow: 1 }, loss: () => 0,
      hands: {
        restBoth: () => { rested = true; },
        left: { to() { assert.fail('the torch must not be raised in bed'); } },
      },
      walkOutside: async () => {
        assert.equal(G.torchOn, owned, 'keep the torch state during the exit cinematic');
      },
      finale: { release() {} }, keys: new Set(), audio: { collapse() {}, thump() {} },
      wait: async () => {}, thought() {}, heard() {}, LEA: { goodnight: [] },
      world: { doorPivot: { rotation: {} }, lockLed: { material: { color: { setRGB() {} } } } },
      roomBox: null,
      lieInBed: () => { G.mode = 'fallen'; },
      eyelids: async () => {
        vm.runInContext('updateTorch(G.time)', context);
        assert.equal(G.torchOn, false);
        assert.equal(torch.visible, false);
        assert.equal(torchLight.intensity, 0);
        assert.equal(rested, true);
        woke = true;
      },
      endGame: (kind) => { result = kind; },
    });
    vm.runInContext(source.slice(source.indexOf('let takingTorch = false;'), source.indexOf('// ---------- Documents')), context);
    vm.runInContext(source.slice(source.indexOf('async function dreamEnding()'), source.indexOf('// ---------- Main loop')), context);
    await vm.runInContext('dreamEnding()', context);
    assert.equal(woke, true);
    assert.equal(result, 'dream');
    assert.equal(G.torch, owned, 'the ending only puts the torch away');
  });
}
