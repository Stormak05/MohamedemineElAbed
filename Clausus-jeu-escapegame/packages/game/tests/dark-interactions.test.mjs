import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the registration used by both crosshair picking and touch input.
const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
function setup() {
  const G = { torch: false, torchOn: false };
  const items = [];
  const hosp = {
    interactables: [],
    roomAt: (x) => x === 1 ? 'Laverie' : 'Archives',
  };
  const ctx = vm.createContext({ G, hosp, centerOf: (obj) => obj.position,
    focus: { add: (obj, label, act) => items.push({ obj, label, act }) } });
  vm.runInContext(source.slice(source.indexOf('function canSeeInteractable'), source.indexOf('let focused =')), ctx);
  let actions = 0;
  function add(x, door = false) {
    const obj = { position: { x, y: 0, z: 0 } };
    if (door) hosp.interactables.push({ obj, door });
    Object.assign(ctx, { obj, label: () => 'Utiliser', act: () => actions++ });
    vm.runInContext('addInteractable(obj, label, act)', ctx);
    return items.at(-1);
  }
  return { G, add, actions: () => actions };
}

test('dark objects have no prompt and cannot be used until the torch is on', () => {
  const h = setup(), item = h.add(1);
  for (const [torch, torchOn] of [[false, false], [false, true], [true, false]]) {
    Object.assign(h.G, { torch, torchOn });
    assert.equal(item.label(), null);
    item.act();
    assert.equal(h.actions(), 0);
  }
  h.G.torchOn = true;
  assert.equal(item.label(), 'Utiliser');
  item.act();
  assert.equal(h.actions(), 1);
  // A previously focused item must stop working immediately when switched off.
  h.G.torchOn = false;
  item.act();
  assert.equal(h.actions(), 1);
});

test('lit rooms and the exit door remain usable without a torch', () => {
  const h = setup();
  for (const item of [h.add(0), h.add(1, true)]) {
    assert.equal(item.label(), 'Utiliser');
    item.act();
  }
  assert.equal(h.actions(), 2);
});
