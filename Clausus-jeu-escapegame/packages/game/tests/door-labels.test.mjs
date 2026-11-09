import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.core.js';

const dressing = readFileSync(new URL('../hopital/habillage.js', import.meta.url), 'utf8');
const placement = dressing.slice(dressing.indexOf('        const clone = source.getObjectByName'), dressing.indexOf('        clone.visible = i === 0;'));
const place = new Function('source', 'door', 'leaf', 'THREE', placement + '\nreturn clone;');

function fireDoor(state) {
  const data = readFileSync(new URL(`../assets/decor/door_fire_${state}.glb`, import.meta.url));
  const jsonSize = data.readUInt32LE(12);
  const doc = JSON.parse(data.subarray(20, 20 + jsonSize));
  const bin = data.subarray(28 + jsonSize);
  const primitive = doc.meshes.find((m) => m.name === 'leaf_body').primitives[0];
  const geometry = new THREE.BufferGeometry();
  for (const [name, attr, size] of [['position', 'POSITION', 3], ['normal', 'NORMAL', 3], ['uv', 'TEXCOORD_0', 2]]) {
    const accessor = doc.accessors[primitive.attributes[attr]], view = doc.bufferViews[accessor.bufferView];
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const values = Array.from({ length: accessor.count * size }, (_, j) => bin.readFloatLE(offset + j * 4));
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, size));
  }
  const source = new THREE.Group(), leaf = new THREE.Group(); leaf.name = 'door_leaf';
  const body = new THREE.Mesh(geometry); body.name = 'leaf_body';
  leaf.add(body); source.add(leaf);
  return source;
}

for (const state of [1, 2, 3, 4]) test(`fire door state ${state}: both labels read left to right for either hinge and swing side`, () => {
  const source = fireDoor(state), original = source.getObjectByName('leaf_body').geometry;
  const originalUV = original.attributes.uv.array.slice();
  for (const dir of [-1, 1]) for (const into of [-1, 1]) {
    const clone = place(source, { d: { look: 'fire' }, into }, { dir }, THREE);
    clone.updateMatrixWorld(true);
    const body = clone.getObjectByName('leaf_body');
    const { position, normal, uv } = body.geometry.attributes;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(body.matrixWorld);
    for (const side of [-1, 1]) {
      const indices = Array.from({ length: uv.count }, (_, j) => j).filter((j) => normal.getZ(j) * side > 0.9);
      const left = indices.reduce((a, b) => uv.getX(a) < uv.getX(b) ? a : b);
      const right = indices.reduce((a, b) => uv.getX(a) > uv.getX(b) ? a : b);
      const a = new THREE.Vector3().fromBufferAttribute(position, left).applyMatrix4(body.matrixWorld);
      const b = new THREE.Vector3().fromBufferAttribute(position, right).applyMatrix4(body.matrixWorld);
      const n = new THREE.Vector3().fromBufferAttribute(normal, left).applyNormalMatrix(normalMatrix);
      assert.ok((b.x - a.x) * n.z > 0, `mirrored text: dir=${dir}, into=${into}, side=${side}`);
    }
    for (let j = 0; j < uv.count; j++) assert.equal(uv.getY(j), original.attributes.uv.getY(j), 'vertical mapping changed');
    assert.deepEqual(original.attributes.uv.array, originalUV, 'shared source UVs changed');
    assert.deepEqual(body.geometry.attributes.position.array, original.attributes.position.array, 'door geometry moved');
  }
});
