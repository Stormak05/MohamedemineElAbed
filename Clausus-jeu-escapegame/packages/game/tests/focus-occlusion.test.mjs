import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.core.js';

const focusSource = readFileSync(new URL('../focus.js', import.meta.url), 'utf8');
const createFocus = new Function('THREE', focusSource.slice(focusSource.indexOf('const L_SOLID'), focusSource.indexOf('// Outline around'))
  .replaceAll('export ', '') + '\nreturn createFocus;')(THREE);
const storySource = readFileSync(new URL('../histoire.js', import.meta.url), 'utf8');
const makeRoomBox = new Function('THREE', 'mat', 'plane', 'label',
  storySource.slice(storySource.indexOf('export function makeCoffret'), storySource.indexOf('// Medicine dispenser'))
    .replaceAll('export ', '') + '\nreturn makeRoomBox;')(
  THREE, (options) => new THREE.MeshBasicMaterial(options),
  (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h)), () => null,
);

function setup(open) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
  const focus = createFocus(camera), box = makeRoomBox();
  scene.add(box.group, camera);
  if (open) box.lid.rotation.x = 1.7;
  focus.add(box.group, () => open ? null : 'Ouvrir la boîte', () => {});
  focus.add(box.key, () => open ? 'Prendre la clé' : null, () => {}, 2, { pad: 0.03, min: 0.08 });
  function pick(x, y, z) {
    camera.position.set(x, y, z);
    camera.lookAt(0, 0.02, -0.03);
    scene.updateMatrixWorld(true);
    return focus.pick(new THREE.Vector2());
  }
  return { pick };
}

test('the open service box lid blocks picking the key from behind', () => {
  assert.equal(setup(true).pick(0, 0.86, 0.8)?.text, undefined);
});

test('the key remains selectable through the open top from the front', () => {
  assert.equal(setup(true).pick(0, 0.86, -0.45)?.text, 'Prendre la clé');
});

test('the closed service box remains selectable instead of its hidden key', () => {
  assert.equal(setup(false).pick(0, 0.86, 0.8)?.text, 'Ouvrir la boîte');
});

test('an inactive enlarged hit box does not hide a visible object beside it', () => {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
  const focus = createFocus(camera);
  const inactive = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
  inactive.position.set(0.2, 0, -0.5);
  const target = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
  target.position.z = -1;
  scene.add(camera, inactive, target);
  focus.add(inactive, () => null, () => {}, 2, { pad: 0.25 });
  focus.add(target, () => 'Objet visible', () => {});
  scene.updateMatrixWorld(true);
  assert.equal(focus.pick(new THREE.Vector2())?.obj, target);
});
