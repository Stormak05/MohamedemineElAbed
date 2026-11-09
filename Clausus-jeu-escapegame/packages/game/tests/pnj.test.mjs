import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const names = ['doctor', 'doctor_female', 'nurse', 'orderly_male', 'security_guard', 'patient_male', 'patient_female'];
const bones = ['hips', 'torso', 'head', 'arm_l', 'arm_r', 'forearm_l', 'forearm_r', 'leg_l', 'leg_r', 'shin_l', 'shin_r', 'foot_l', 'foot_r'];
for (const name of names) test(`${name}: runtime asset matches source and supports body.js`, () => {
  const data = readFileSync(new URL(`../assets/${name}.glb`, import.meta.url));
  assert.deepEqual(data, readFileSync(new URL(`../../../modeles/personnages/${name}.glb`, import.meta.url)));
  assert.equal(data.readUInt32LE(0), 0x46546c67);
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  for (const bone of bones) assert.ok(gltf.nodes.some(n => n.name === bone), bone);
  assert.ok(gltf.meshes.length > 0);
  assert.ok(gltf.images.length > 0);
  if (name === 'security_guard') {
    const source = JSON.parse(readFileSync(new URL(`../../../modeles/personnages/${name}.bbmodel`, import.meta.url),'utf8'));
    const view = gltf.bufferViews[gltf.images[0].bufferView];
    const start = 28 + data.readUInt32LE(12) + (view.byteOffset ?? 0);
    const image = data.subarray(start,start+view.byteLength);
    const atlas=Buffer.from(source.textures[0].source.split(',')[1],'base64');
    assert.deepEqual(image.subarray(0,atlas.length),atlas, 'runtime uses the painted source atlas (GLB pads to four bytes)');
    assert.equal(image.readUInt32BE(16),512);
    assert.equal(image.readUInt32BE(20),512);
    assert.equal(gltf.samplers[0].magFilter,9728);
  }
});
