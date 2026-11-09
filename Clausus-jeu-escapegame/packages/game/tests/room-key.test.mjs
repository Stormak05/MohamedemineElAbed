import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/three.core.js';
import { ease } from '../motion.js';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
function setup() {
  const items = [];
  const G = { unlocked: false, doorOpen: false, mode: 'free' };
  const world = { doorPivot: new THREE.Group(), lockLed: { material: { color: new THREE.Color() } } };
  let enteredCode = '0000';
  const ctx = vm.createContext({
    THREE, ease, G, world, RX: 2, DOOR: { z: 2 }, TABLE: { h: 0.74 }, scene: new THREE.Scene(), STORY: { padlock: '0427' },
    makeRoomBox: () => ({ group: new THREE.Group(), lid: new THREE.Group(), key: new THREE.Group() }),
    addInteractable: (obj, label, act) => items.push({ obj, label, act }),
    codePanel: async ({ check }) => check(enteredCode),
    audio: { doorUnlock() {}, locked() {}, doorCreak() {}, pickup() {}, knock() {} },
    centerOf: (obj) => obj.position.clone(), yawOf() {}, handOn() {},
    hands: { right: { to: async () => {} } }, reach: async () => {}, restRight: async () => {},
    toast() {}, thought() {}, done: () => { G.mode = 'free'; },
    animate: async (_, fn) => fn(1), tween: async (_, fn) => fn(1),
  });
  vm.runInContext(source.slice(source.indexOf('function unlockRoom('), source.indexOf('// A swing door')), ctx);
  vm.runInContext(source.slice(source.indexOf('  // ----- Énigme 1: a forgotten'), source.indexOf('  // ----- Énigme 2, archives:')), ctx);
  return { G, world, items, ctx, code: (c) => { enteredCode = c; }, door: () => vm.runInContext('useDoor()', ctx) };
}

test('the room door stays locked until the box is solved and its key is taken', async () => {
  const h = setup(), [box, key] = h.items;
  await h.door();
  assert.equal(h.G.doorOpen, false);
  assert.equal(key.label(), null);
  await box.act(); // Wrong code.
  assert.ok(box.label());
  assert.equal(key.label(), null);
  h.code('0427');
  await box.act();
  assert.equal(box.label(), null);
  assert.equal(key.label(), 'Prendre la clé de la chambre');
  await h.door(); // Opening the box alone must not unlock the door.
  assert.equal(h.G.unlocked, false);
  await key.act();
  assert.equal(key.obj.visible, false);
  assert.equal(key.label(), null);
  assert.equal(h.G.unlocked, false);
  await h.door();
  assert.equal(h.G.unlocked, true);
  assert.equal(h.G.doorOpen, true);
  assert.equal(h.G.mode, 'free');
  assert.equal(h.world.doorPivot.rotation.y, 1.45);
});

test('developer unlock also opens the service box and removes the key', () => {
  const h = setup();
  vm.runInContext('unlockRoom(false)', h.ctx);
  assert.equal(h.G.unlocked, true);
  assert.equal(h.items[0].label(), null);
  assert.equal(h.items[1].label(), null);
  assert.equal(h.items[1].obj.visible, false);
});

test('restore preserves intermediate box/key states and older unlocked saves', () => {
  const h = setup();
  const start = source.indexOf('    roomBox.keyTaken = G.unlocked || d.roomKey');
  const end = source.indexOf('    // Older saves', start);
  const restore = source.slice(start, end);
  for (const [d, unlocked, open, taken] of [
    [{}, false, false, false],
    [{ roomBoxOpen: true }, false, true, false],
    [{ roomKey: true }, false, true, true],
    [{}, true, true, true],
  ]) {
    h.G.unlocked = unlocked;
    h.ctx.d = d;
    vm.runInContext(restore, h.ctx);
    assert.equal(vm.runInContext('roomBox.open', h.ctx), open);
    assert.equal(vm.runInContext('roomBox.keyTaken', h.ctx), taken);
    assert.equal(h.items[1].obj.visible, !taken);
  }
});

test('pose search skips pathfinding for wrist targets outside arm reach', () => {
  let paths = 0;
  const ctx = vm.createContext({
    THREE, EYE: 1.6, player: { y: 0 }, camera: { position: new THREE.Vector3(0, 1.6, -1) },
    flatDist: (a, b) => Math.hypot(a.x - b.x, a.z - b.z),
    inSight: () => true, leanFor: () => 0.1, reachView: () => new THREE.Quaternion(),
    canReach: () => false, free: () => true, detour: () => { paths++; return []; },
    at: new THREE.Vector3(0, 0.9, 0),
  });
  vm.runInContext(source.slice(source.indexOf('function reachPose('), source.indexOf('// Take a pose to use something')), ctx);
  const pose = vm.runInContext('reachPose([{hand: {}, wrist: () => at}], {at})', ctx);
  assert.equal(pose, null);
  assert.equal(paths, 0);
});
