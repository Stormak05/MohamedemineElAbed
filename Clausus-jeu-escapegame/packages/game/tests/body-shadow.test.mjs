import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/three.core.js';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const declaration = source.match(/const shadowOnly = .*?;/)[0];
const material = vm.runInNewContext(`${declaration}\nshadowOnly`, { THREE });
const bytes = readFileSync(new URL('../assets/player_body.glb', import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binStart = 28 + jsonLength;
function accessor(index) {
  const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView];
  const count = a.count * (a.type === 'VEC3' ? 3 : 1);
  const Type = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType];
  const start = binStart + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  return new Type(bytes.buffer.slice(bytes.byteOffset + start, bytes.byteOffset + start + count * Type.BYTES_PER_ELEMENT));
}

for (const side of ['r', 'l']) test(`foot ${side} blocks light above the floor, including its interior silhouette`, () => {
  assert.equal(material.colorWrite, false);
  assert.equal(material.depthWrite, false);
  const node = gltf.nodes.find(n => n.name === `foot_volume_${side}`);
  const primitive = gltf.meshes[node.mesh].primitives[0];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(accessor(primitive.attributes.POSITION), 3));
  geometry.setIndex(new THREE.BufferAttribute(accessor(primitive.indices), 1));
  geometry.computeBoundingBox();
  // Plant the actual sole on y=0, as the animated foot meets the floor.
  geometry.translate(0, -geometry.boundingBox.min.y, 0);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new THREE.Vector3());
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: material.shadowSide }));
  const ray = new THREE.Raycaster(new THREE.Vector3(center.x, 1, center.z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(mesh)[0];
  assert.ok(hit && hit.point.y > 0.02, 'shadow must start at the top of the foot, before the light reaches the floor');
  // Reproduce the old shadow pass: only the exit face/sole is recorded.
  mesh.material.side = THREE.BackSide;
  const old = ray.intersectObject(mesh)[0];
  assert.ok(!old || old.point.y < 0.001, 'back-face-only rendering loses the contact shadow');
  geometry.dispose(); mesh.material.dispose();
});
