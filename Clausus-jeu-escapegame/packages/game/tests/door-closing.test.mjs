import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/three.core.js';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const useSwingDoor = source.slice(source.indexOf('async function useSwingDoor('), source.indexOf('// Keep the right hand on a moving door'));

function closing({ orientation = 'h', start = [0, -0.1], feet = null, free = () => true, waitForStep = false } = {}) {
  const frame = new THREE.Group(), pivot = new THREE.Group();
  pivot.position.set(-0.6, 0, -0.06);
  frame.add(pivot);
  if (orientation === 'v') frame.rotation.y = -Math.PI / 2;
  frame.updateMatrixWorld(true);
  const point = ([x, z]) => new THREE.Vector3(x, 1.6, z).applyMatrix4(frame.matrixWorld);
  const camera = { position: point(start), quaternion: new THREE.Quaternion() };
  const cam = { feet: feet ? point(feet) : null };
  const col = orientation === 'h'
    ? { x0: -0.6, x1: 0.6, z0: -0.1, z1: 0.1 }
    : { x0: -0.1, x1: 0.1, z0: -0.6, z1: 0.6 };
  const door = { d: { half: 0.6 }, target: 1, frame, col, center: new THREE.Vector3(0, 1.2, 0),
    leaves: [{ pivot, dir: 1, openAngle: -1.45 }] };
  const events = [];
  let finishStep, reachOptions, startStep;
  const stepping = new Promise((resolve) => { startStep = resolve; });
  const context = vm.createContext({ THREE, camera, cam, R: 0.22, EYE: 1.6, ARM_OK: 0.6,
    player: { y: 0 }, G: {}, ITEM_OF: {}, free,
    hands: { right: { shoulder: new THREE.Vector3(), to: async () => {} } },
    handQuat: () => new THREE.Quaternion(), wristFor: (_hand, at) => at, yawOf: () => 0,
    reachFor: async (_targets, opts) => { reachOptions = opts; },
    segmentFree: (a, b) => {
      for (let i = 1; i <= 100; i++) {
        if (!free(a.x + (b.x - a.x) * i / 100, a.z + (b.z - a.z) * i / 100)) return false;
      }
      return true;
    }, inSight: () => true, lookQuat: () => new THREE.Quaternion(),
    camTo: async (pos) => {
      events.push('step');
      startStep();
      if (waitForStep) await new Promise((resolve) => { finishStep = resolve; });
      camera.position.copy(pos);
    },
    followDoor: async () => { events.push('follow'); }, restRight: async () => {}, done: () => { events.push('done'); },
    it: { door, act: () => { events.push('close'); door.target = 0; } },
  });
  vm.runInContext(useSwingDoor, context);
  return { camera, cam, col, events, point, door,
    run: () => vm.runInContext('useSwingDoor(it)', context),
    stepping, finish: () => finishStep(), opts: () => reachOptions };
}

for (const orientation of ['h', 'v']) {
  test(`closing a ${orientation} door leaves eyes and feet outside the shut doorway`, async () => {
    const h = closing({ orientation });
    await h.run();
    const { x, z } = h.camera.position, c = h.col;
    assert.ok(x <= c.x0 - 0.22 || x >= c.x1 + 0.22 || z <= c.z0 - 0.22 || z >= c.z1 + 0.22);
    assert.equal(h.cam.feet, null);
    assert.deepEqual(h.events, ['step', 'close', 'follow', 'done']);
    assert.equal(h.opts().ok(h.point([0, -0.1])), false, 'reaching must reject the future closed collider');
  });
}

test('the door waits for the retreat to finish before closing', async () => {
  const h = closing({ waitForStep: true });
  const work = h.run();
  await h.stepping;
  assert.deepEqual(h.events, ['step']);
  assert.equal(h.door.target, 1);
  h.finish();
  await work;
  assert.deepEqual(h.events, ['step', 'close', 'follow', 'done']);
});

test('unsafe feet are moved even when the eyes already clear the door', async () => {
  const h = closing({ start: [0, -0.45], feet: [0, -0.1] });
  await h.run();
  assert.equal(h.cam.feet, null);
  assert.equal(h.events[0], 'step');
});

test('a door stays open when walls leave no safe retreat', async () => {
  const h = closing({ free: () => false });
  await h.run();
  assert.equal(h.door.target, 1);
  assert.deepEqual(h.events, ['done']);
});

test('a safe position closes in place without a retreat', async () => {
  const h = closing({ start: [0, -0.45] });
  await h.run();
  assert.deepEqual(h.events, ['close', 'follow', 'done']);
});
