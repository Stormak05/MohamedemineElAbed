import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.core.js';
import * as plan from '../hopital/plan.js';

const base = new URL('../', import.meta.url);
const source = (file) => readFileSync(new URL(file, base), 'utf8');

// Accessor bounds plus every node transform give the actual exported model's bounds.
function radiatorModel(file) {
  const data = readFileSync(new URL('assets/' + file + '.glb', base));
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)));
  function node(i) {
    const n = gltf.nodes[i], group = new THREE.Group();
    if (n.matrix) group.applyMatrix4(new THREE.Matrix4().fromArray(n.matrix));
    else {
      if (n.translation) group.position.fromArray(n.translation);
      if (n.rotation) group.quaternion.fromArray(n.rotation);
      if (n.scale) group.scale.fromArray(n.scale);
    }
    for (const p of gltf.meshes?.[n.mesh]?.primitives ?? []) {
      const a = gltf.accessors[p.attributes.POSITION];
      const lo = new THREE.Vector3().fromArray(a.min), hi = new THREE.Vector3().fromArray(a.max);
      const size = hi.clone().sub(lo), center = lo.clone().add(hi).multiplyScalar(0.5);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z));
      mesh.position.copy(center); group.add(mesh);
    }
    for (const child of n.children ?? []) group.add(node(child));
    return group;
  }
  const root = new THREE.Group();
  for (const i of gltf.scenes[gltf.scene ?? 0].nodes) root.add(node(i));
  return root;
}

test('every hospital and bedroom radiator faces the room and clears all walls', async () => {
  // Run production placement calculations, stopping before model loading and merging.
  let src = source('hopital/mobilier.js').replace(/^import .*;$/gm, '').replaceAll('export ', '');
  src = src.slice(0, src.indexOf('  const files = [...new Set(placements.map'));
  const placements = await new Function('THREE', ...Object.keys(plan),
    src + '\n return placements; } return loadFurniture(null, {});')(THREE, ...Object.values(plan));
  const radiators = placements.filter((p) => p.file === 'props/radiator');
  const put = source('props.js').match(/put\('radiator', ([^\n]+)\),/);
  const [x, y, z, yaw] = new Function('RZ_BACK', 'WALL', 'return [' + put[1] + ']')(3, { back: Math.PI });
  radiators.push({ file: 'props/radiator', f: 1, x, y, z, yaw });
  assert.equal(radiators.length, 24);
  const walls = [0, 1].flatMap((f) => [...plan.WALLS[f], ...plan.WALLS.shared.map(
    ([a, b, c, d]) => f === 1 ? [a - plan.F1.x, b - plan.F1.y, c - plan.F1.x, d - plan.F1.y] : [a, b, c, d],
  )].map(([a, b, c, d]) => {
    const [x0, z0] = plan.toF0(f, a, b), [x1, z1] = plan.toF0(f, c, d);
    return new THREE.Box3(
      new THREE.Vector3(plan.wx(Math.min(x0, x1)) - plan.T / 2, f * plan.FH, plan.wz(Math.min(z0, z1)) - plan.T / 2),
      new THREE.Vector3(plan.wx(Math.max(x0, x1)) + plan.T / 2, f * plan.FH + plan.CEIL, plan.wz(Math.max(z0, z1)) + plan.T / 2),
    );
  }));
  // Room 104's window module replaces the plan's north wall and faces into z > -3.
  walls.push(new THREE.Box3(new THREE.Vector3(-2, plan.FH, -3.1), new THREE.Vector3(2, plan.FH + 2.7, -3)));
  for (const p of radiators) {
    const model = radiatorModel(p.file), local = new THREE.Box3().setFromObject(model);
    model.position.set(p.x, p.f * plan.FH + p.y, p.z); model.rotation.y = p.yaw;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const label = p.file + ' floor ' + p.f + ' at ' + [p.x, p.z];
    for (const wall of walls) {
      const overlap = box.clone().intersect(wall);
      if (!overlap.isEmpty()) {
        const size = overlap.getSize(new THREE.Vector3());
        assert.ok(Math.min(size.x, size.y, size.z) < 0.001, label + ' intersects wall');
      }
    }
    const back = model.localToWorld(new THREE.Vector3(0, (local.min.y + local.max.y) / 2, local.max.z));
    const ray = new THREE.Ray(back, new THREE.Vector3(0, 0, 1).applyQuaternion(model.quaternion));
    const supported = walls.some((wall) => {
      const hit = ray.intersectBox(wall, new THREE.Vector3());
      return hit && hit.distanceTo(back) <= 0.1;
    });
    assert.ok(supported, label + ' has no wall behind its back');
  }
});
