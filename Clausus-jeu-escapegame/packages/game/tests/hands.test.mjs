import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/three.core.js';
import { ease, arc, vary, noise, drift } from '../motion.js';

const source = readFileSync(new URL('../hands.js', import.meta.url), 'utf8');
const context = vm.createContext({ THREE, ease, arc, vary, noise, drift, performance });
vm.runInContext(source.slice(source.indexOf('const UPPER'), source.indexOf('export class Hands'))
  .replaceAll('export ', '') + '\nglobalThis.Arm = Arm;', context);

function arm(side) {
  const model = new THREE.Group();
  for (const name of ['upper_arm', 'forearm', 'hand', ...['index', 'middle', 'ring', 'pinky', 'thumb'].flatMap(f => [1, 2, 3].map(i => `${f}_${i}`))]) {
    const node = new THREE.Group(); node.name = name; model.add(node);
  }
  const camera = new THREE.PerspectiveCamera(); camera.position.y = 1.6;
  return new context.Arm(new THREE.Scene(), camera, model, side);
}

for (const side of [-1, 1]) {
  test(`palm rotation cannot reverse the elbow frame (side ${side})`, () => {
    const a = arm(side);
    const pos = new THREE.Vector3(side * 0.15, 1.25, -0.3);
    let upper, fore;
    for (let i = 0; i <= 180; i++) {
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6, -0.25, Math.PI * i / 180));
      a.snap(() => ({ pos, quat })); a.update(1 / 60, 0);
      if (!upper) { upper = a.upper.quaternion.clone(); fore = a.fore.quaternion.clone(); }
      assert.ok(upper.angleTo(a.upper.quaternion) < 1e-6);
      assert.ok(fore.angleTo(a.fore.quaternion) < 1e-6);
      // The composed wrist still reaches the exact requested orientation.
      const actual = a.upper.quaternion.clone().multiply(a.fore.quaternion).multiply(a.hand.quaternion);
      assert.ok(actual.angleTo(quat) < 1e-6);
    }
  });

  test(`low reach and pillow lift keep a continuous elbow hinge (side ${side})`, () => {
    const a = arm(side);
    let prevUpper, prevFore;
    for (let i = 0; i <= 200; i++) {
      const pos = new THREE.Vector3(side * 0.1, 1.0 + i * 0.0004, -0.3);
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9, 0, 0));
      a.snap(() => ({ pos, quat })); a.update(1 / 60, 0);
      if (prevUpper) {
        assert.ok(prevUpper.angleTo(a.upper.quaternion) < 0.02);
        assert.ok(prevFore.angleTo(a.fore.quaternion) < 0.02);
      }
      // No sideways or axial elbow rotation: just flexion about local X.
      assert.ok(Math.abs(a.fore.quaternion.y) < 1e-6);
      assert.ok(Math.abs(a.fore.quaternion.z) < 1e-6);
      prevUpper = a.upper.quaternion.clone(); prevFore = a.fore.quaternion.clone();
    }
  });
}
