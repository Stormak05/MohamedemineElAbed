import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.core.js';

const source = readFileSync(new URL('../surveillance.js', import.meta.url), 'utf8')
  .replace("'three'", JSON.stringify(new URL('../vendor/three/three.core.js', import.meta.url).href));
const { attachCameraEye, trackCamera } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('selected cameras become eyes at low sanity and recover without threshold flicker', () => {
  const parent = new THREE.Group(), head = new THREE.Group(), shell = new THREE.Group();
  parent.add(head); head.add(shell);
  attachCameraEye(head, new THREE.Group());
  const eye = head.userData.eye.model, position = new THREE.Vector3(0, 0, -2);
  for (const [loss, active] of [[0, false], [0.69, false], [0.7, true], [0.65, true], [0.59, false]]) {
    trackCamera(head, position, 1 / 60, loss);
    assert.equal(eye.visible, active);
    assert.equal(shell.visible, !active);
  }
  const ordinary = new THREE.Group(); parent.add(ordinary);
  trackCamera(ordinary, position, 1 / 60, 1);
  assert.equal(ordinary.userData.eye, undefined);
});

test('corner mount stays fixed while the eye tracks and the original support returns on recovery', () => {
  const root = new THREE.Group(), head = new THREE.Group(), bracket = new THREE.Group();
  root.add(head, bracket);
  root.rotation.y = Math.PI / 4;
  attachCameraEye(head, new THREE.Group(), new THREE.Group());
  const mount = head.userData.eye.mount;
  const before = mount.quaternion.clone();
  trackCamera(head, new THREE.Vector3(4, -2, -3), 1, 0.8);
  assert.equal(mount.parent, root);
  assert.equal(mount.visible, true);
  assert.equal(bracket.visible, false);
  assert.ok(mount.quaternion.angleTo(before) < 1e-7);
  assert.ok(head.rotation.y !== 0);
  trackCamera(head, new THREE.Vector3(4, -2, -3), 1, 0.4);
  assert.equal(mount.visible, false);
  assert.equal(bracket.visible, true);
});

test('all five cameras aim at the player through translated and rotated parents', () => {
  for (let i = 0; i < 5; i++) {
    const building = new THREE.Group(), parent = new THREE.Group(), head = new THREE.Group();
    building.position.y = -3;
    parent.position.set(i * 4, i % 2 * 3 + 2.7, -i);
    parent.rotation.y = i * Math.PI / 2;
    head.position.set(0, -0.2, -0.275);
    building.add(parent); parent.add(head);
    for (const player of [new THREE.Vector3(2, 1.6, 3), new THREE.Vector3(-4, -1.9, -2)]) {
      for (let frame = 0; frame < 300; frame++) trackCamera(head, player, 1 / 30);
      head.updateWorldMatrix(true, false);
      const direction = new THREE.Vector3(0, 0, -1).transformDirection(head.matrixWorld);
      const expected = player.clone().sub(head.getWorldPosition(new THREE.Vector3())).normalize();
      assert.ok(direction.dot(expected) > 0.99999);
    }
  }
});

test('tracking is stable across frame rates and stays still while paused', () => {
  const make = () => { const parent = new THREE.Group(), head = new THREE.Group(); parent.add(head); return head; };
  const a = make(), b = make(), player = new THREE.Vector3(3, -1, 2);
  for (let i = 0; i < 30; i++) trackCamera(a, player, 1 / 30);
  for (let i = 0; i < 120; i++) trackCamera(b, player, 1 / 120);
  assert.ok(a.quaternion.angleTo(b.quaternion) < 1e-7);
  const before = a.quaternion.clone();
  trackCamera(a, new THREE.Vector3(-3, 2, 1), 0);
  assert.ok(a.quaternion.angleTo(before) < 1e-7);
});
