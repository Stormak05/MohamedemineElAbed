import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.core.js';
import * as plan from '../hopital/plan.js';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

async function frameParts() {
  const data = readFileSync(new URL('../assets/props/lift_frame.glb', import.meta.url));
  const doc = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)));
  const bin = data.subarray(28 + data.readUInt32LE(12));
  const root = new THREE.Group();
  for (const node of doc.nodes.filter((n) => n.mesh !== undefined)) {
    const primitive = doc.meshes[node.mesh].primitives[0];
    const accessor = doc.accessors[primitive.attributes.POSITION], view = doc.bufferViews[accessor.bufferView];
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const positions = Array.from({ length: accessor.count * 3 }, (_, i) => bin.readFloatLE(offset + i * 4));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mesh = new THREE.Mesh(geometry); mesh.name = node.name;
    if (node.matrix) mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));
    root.add(mesh);
  }
  const src = source('objets.js').replace(/^import .*;$/gm, '').replaceAll('export ', '');
  // Keep the individual geometries so the real asset preparation can be checked before merging.
  const prepare = new Function('THREE', 'loadModel', 'mergeGeometries', src + '\nreturn modelAsset;')(
    THREE, async () => root, (parts) => parts,
  );
  const asset = await prepare(null, 'props/lift_frame');
  return asset.geometry.map((g) => { g.computeBoundingBox(); return g.boundingBox; });
}

test('lift frame jambs stop below the head without overlapping its front faces', async () => {
  const [north, south, head] = await frameParts();
  for (const jamb of [north, south]) {
    assert.ok(Math.abs(jamb.max.y - plan.DOOR_H) < 1e-6);
    assert.ok(Math.abs(jamb.max.y - head.min.y) < 1e-6);
    assert.equal(jamb.min.y, 0);
    const overlap = jamb.clone().intersect(head).getSize(new THREE.Vector3());
    assert.ok(overlap.y < 1e-6, 'jamb and head share an overlapping face');
  }
});

test('both lift landings keep the wall shell away from the frame reveals', async () => {
  const src = source('hopital/batiment.js');
  const geometry = src.slice(src.indexOf('  const doors = DOORS.map'), src.indexOf('  // Roof over'));
  const boxes = new Function(...Object.keys(plan), `
    const colliders = [], surfaces = [], boxes = [];
    const SHELL_INSET = 0.03, REVEAL_INSET = 0.02, STOREY_JOIN = FH - 0.04;
    const addBox = (kind, x0, y0, z0, x1, y1, z1) => boxes.push({ x0, y0, z0, x1, y1, z1 });
    const solid = () => {};
    ${geometry}
    return boxes;
  `)(...Object.values(plan));
  const parts = await frameParts();
  for (const door of plan.DOORS.filter((d) => d.kind === 'lift')) {
    const [px, pz] = plan.toF0(door.f, door.x, door.y);
    const x = plan.wx(px), z = plan.wz(pz), y = door.f * plan.FH;
    const shell = boxes.filter((b) => b.x0 < x && b.x1 > x && b.y1 > y && b.y0 < y + plan.FH);
    for (const part of parts) {
      const frame = part.clone().translate(new THREE.Vector3(x, y, z));
      // Probe just inside the opening: the shell must not share these inner faces.
      const reveal = frame.clone();
      if (part.min.y > 2) {
        reveal.min.y = y + plan.DOOR_H - 0.001; reveal.max.y = y + plan.DOOR_H + 0.001;
        reveal.min.z = z - door.w * plan.S / 2; reveal.max.z = z + door.w * plan.S / 2;
      }
      else if (part.max.z < 0) { reveal.min.z = z - door.w * plan.S / 2 - 0.001; reveal.max.z = reveal.min.z + 0.002; }
      else { reveal.min.z = z + door.w * plan.S / 2 - 0.001; reveal.max.z = reveal.min.z + 0.002; }
      for (const b of shell) {
        const wall = new THREE.Box3(new THREE.Vector3(b.x0, b.y0, b.z0), new THREE.Vector3(b.x1, b.y1, b.z1));
        assert.ok(!reveal.intersectsBox(wall), `floor ${door.f}: wall touches frame reveal`);
      }
    }
  }
});
