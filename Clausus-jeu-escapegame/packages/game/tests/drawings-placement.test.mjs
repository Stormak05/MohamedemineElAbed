import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.core.js';
import * as plan from '../hopital/plan.js';

const base = new URL('../', import.meta.url);
const source = (file) => readFileSync(new URL(file, base), 'utf8');

test('all drawings outside room 104 use the five neutral sets', async () => {
  let src = source('hopital/mobilier.js').replace(/^import .*;$/gm, '').replaceAll('export ', '');
  src = src.slice(0, src.indexOf('  const files = [...new Set(placements.map'));
  const placements = await new Function('THREE', ...Object.keys(plan),
    src + '\n return placements; } return loadFurniture(null, {});')(THREE, ...Object.values(plan));
  assert.equal(placements.filter((p) => /\/kid_drawings(?:_4)?$/.test(p.file)).length, 0);
  const drawings = placements.filter((p) => p.file.includes('/ward_drawings_'));
  assert.equal(drawings.length, 15); // Twelve patient rooms and three corridor displays.
  const files = [...new Set(drawings.map((p) => p.file))];
  assert.equal(files.length, 5);
  const textures = new Set();
  for (const file of files) {
    const data = readFileSync(new URL(`assets/${file}.glb`, base));
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)));
    assert.equal(gltf.images.length, 1);
    assert.equal(gltf.samplers[0].magFilter, 9728);
    assert.equal(gltf.samplers[0].minFilter, 9728);
    const bb = JSON.parse(source(`blockbench/${file}.bbmodel`));
    assert.equal(bb.elements.filter((e) => e.name.startsWith('drawing_')).length, 3);
    assert.ok(!textures.has(bb.textures[0].source), `${file} repeats another set's atlas`);
    textures.add(bb.textures[0].source);
    assert.ok(bb.elements.flatMap((e) => Object.values(e.vertices)).every((v) => v[2] >= 0));
  }
  assert.match(source('props.js'), /states\(\[\['kid_drawings',.*\['kid_drawings_4'/);
});
