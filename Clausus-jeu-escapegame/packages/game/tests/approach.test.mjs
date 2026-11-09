import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/three.core.js';

// Exercise the actual movement helpers without starting the renderer or DOM.
const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
function helpers(free, start = new THREE.Vector3(0, 1.6, 0)) {
  const camera = { position: start }, cam = {};
  const hosp = { clearance: (a, b) => {
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      if (!free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return t;
    }
    return 1;
  } };
  const context = vm.createContext({ THREE, free, camera, cam, hosp,
    camTo: () => Promise.resolve() });
  vm.runInContext(source.slice(source.indexOf('const flatDist ='), source.indexOf('// Eye height to use')), context);
  return { context, camera, cam, run: (code) => vm.runInContext(code, context) };
}

test('an unreachable destination is distinct from a clear straight path', () => {
  const h = helpers((x) => x < 0.8 || x > 1.2);
  assert.equal(h.run('detour({ x: 2, z: 0 })'), null);
  assert.equal(h.run('detour({ x: 0.5, z: 0 }).length'), 0);
});

test('a photo across a wall cannot select a standing spot in the other room', () => {
  const h = helpers((x) => x < 0.8 || x > 1.2);
  assert.equal(h.run('standSpot(new THREE.Vector3(1.8, 1.6, 0), { face: { x: 1, z: 0 }, dist: 0.5, maxDist: 0.6 })'), null);
  const spot = h.run('standSpot(new THREE.Vector3(1.8, 1.6, 0), { dist: 0.5, maxDist: 1.3 })');
  assert.equal(spot, null); // Even a reachable spot must see the target without a wall in between.
});

test('a nearby wall is checked within the first 30 cm', () => {
  const h = helpers((x) => x < 0.08 || x > 0.2);
  assert.equal(h.run('detour({ x: 0.5, z: 0 })'), null);
});

test('a furniture detour follows only the checked segments without spline overshoot', () => {
  const free = (x, z) => !(x > 0.7 && x < 1.3 && z > -0.4 && z < 0.4);
  const h = helpers(free);
  const via = h.run('detour({ x: 2, z: 0 })');
  assert.ok(via?.length);
  h.context.via = via;
  h.run('camPath(via, new THREE.Vector3(2, 1.6, 0), null, 1)');
  for (let i = 0; i <= 1000; i++) {
    const p = h.cam.curve.getPointAt(i / 1000);
    assert.ok(free(p.x, p.z), `collision at ${p.x}, ${p.z}`);
    assert.ok(Number.isFinite(p.y));
  }
});

for (const eye of [1.6, 0.95]) test(`approach keeps a finite duration through flat waypoints at eye height ${eye}`, async () => {
  const camera = { position: new THREE.Vector3(0, 1.6, 0), quaternion: new THREE.Quaternion() };
  const calls = [];
  const context = vm.createContext({ THREE, camera, player: { y: 0 }, EYE: 1.6,
    lookQuat: () => new THREE.Quaternion(),
    camTo: async (pos, quat, dur) => { calls.push({ pos, dur }); }, cam: {} });
  vm.runInContext(source.slice(source.indexOf('const flatDist ='), source.indexOf('// Where the wrist goes')), context);
  vm.runInContext(`standSpot = () => new THREE.Vector3(2, 0, 0);
    detour = () => [{ x: 1, z: 0.8 }];`, context);
  await vm.runInContext(`approach(new THREE.Vector3(2, 0.8, 0), { eye: ${eye} })`, context);
  assert.equal(calls.length, 1);
  assert.ok(Number.isFinite(calls[0].dur) && calls[0].dur > 0);
  for (let i = 0; i <= 20; i++) {
    const p = context.cam.curve.getPointAt(i / 20);
    assert.ok([p.x, p.y, p.z].every(Number.isFinite));
  }
});

test('goTo rotates in place when the destination is unreachable', async () => {
  const h = helpers((x) => x < 0.8 || x > 1.2);
  h.context.camTo = (pos) => { assert.equal(pos, h.camera.position); return Promise.resolve(); };
  await h.run('goTo(new THREE.Vector3(2, 1.6, 0), null)');
  assert.equal(h.cam.curve, undefined);
});

test('a visible reachable target still gets a standing spot', () => {
  const h = helpers(() => true);
  const spot = h.run('standSpot(new THREE.Vector3(0, 1, -0.6))');
  assert.ok(spot && Number.isFinite(spot.x) && Number.isFinite(spot.z));
});


test('getting up from a computer finds a free destination outside the chair', async () => {
  const free = (x, z) => !(Math.abs(x) < 0.4 && Math.abs(z) < 0.4);
  const h = helpers(free, new THREE.Vector3(0, 1.2, 0));
  // Furniture does not occlude the seated player's view of the screen.
  h.context.hosp.clearance = () => 1;
  const options = '{ face: { x: 0, z: 1 }, dist: 1 }';
  assert.equal(h.run(`standSpot(new THREE.Vector3(0, 1.2, -0.65), ${options})`), null);
  const stand = h.run('standSpot(new THREE.Vector3(0, 1.2, -0.65), { face: { x: 0, z: 1 }, dist: 1, route: false })');
  assert.ok(stand && free(stand.x, stand.z));
  Object.assign(h.context, {
    G: { mode: 'computer' },
    pcAt: { screen: { getWorldPosition: (v) => v.set(0, 1.2, -0.65) }, os: { setActive() {} }, floorY: 0 },
    screenNormal: () => new THREE.Vector3(0, 0, 1),
    hands: { restBoth() {} }, cfg: { fov: 68 }, EYE: 1.6,
    $: () => ({ classList: { add() {} } }),
    camTo: async (pos) => h.camera.position.copy(pos),
    releaseCam() {}, lookQuat: () => new THREE.Quaternion(), isTouch: () => true,
  });
  h.run(source.slice(source.indexOf('async function leaveComputer'), source.indexOf('// Map the OS canvas')));
  await h.run('leaveComputer(false)');
  assert.equal(h.context.G.mode, 'free');
  assert.ok(free(h.camera.position.x, h.camera.position.z), 'control returns outside the chair collider');
});
