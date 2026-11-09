import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.core.js';
import * as planData from '../hopital/plan.js';
import { ROOMS, FH, SECURITY_DESKS, SECURITY_MONITORS, SECURITY_DESK_GAP, SECURITY_DESK_H } from '../hopital/plan.js';

// Reconstruct the exported terminal's bounds and hierarchy: its CRT stand starts at 15 cm.
function boundsModel(file) {
  const data = readFileSync(new URL(`../assets/${file}.glb`, import.meta.url));
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)));
  function modelNode(i) {
    const n = gltf.nodes[i];
    const primitives = gltf.meshes?.[n.mesh]?.primitives ?? [];
    const parts = primitives.map((p) => {
      const a = gltf.accessors[p.attributes.POSITION];
      const lo = new THREE.Vector3().fromArray(a.min), hi = new THREE.Vector3().fromArray(a.max);
      const size = hi.clone().sub(lo), center = lo.clone().add(hi).multiplyScalar(0.5);
      return new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z).translate(...center), new THREE.MeshBasicMaterial());
    });
    const node = parts.length === 1 ? parts[0] : new THREE.Group();
    if (parts.length > 1) node.add(...parts);
    node.name = n.name ?? '';
    if (n.matrix) node.applyMatrix4(new THREE.Matrix4().fromArray(n.matrix));
    else {
      if (n.translation) node.position.fromArray(n.translation);
      if (n.rotation) node.quaternion.fromArray(n.rotation);
      if (n.scale) node.scale.fromArray(n.scale);
    }
    for (const child of n.children ?? []) node.add(modelNode(child));
    return node;
  }
  const model = new THREE.Group();
  for (const i of gltf.scenes[gltf.scene ?? 0].nodes) model.add(modelNode(i));
  return model;
}
const model = boundsModel('terminal');
const core = new URL('../vendor/three/three.core.js', import.meta.url).href;
let layoutSource = readFileSync(new URL('../hopital/mobilier.js', import.meta.url), 'utf8');
// Extract the actual placement calculation, independent of GLTF loading.
layoutSource = layoutSource.slice(layoutSource.indexOf('export function layoutOf'), layoutSource.indexOf('export async function loadFurniture'));
const plan = new URL('../hopital/plan.js', import.meta.url).href;
const { layoutOf } = await import(`data:text/javascript,${encodeURIComponent(`import {DOORS,toF0,wx,wz,T} from '${plan}';\n${layoutSource}`)}`);
globalThis.securityMonitorTest = { model, layoutOf };
const source = readFileSync(new URL('../security-monitors.js', import.meta.url), 'utf8')
  .replace("'three'", JSON.stringify(core))
  .replace("import { loadModel } from './decor.js';", 'const loadModel = async () => globalThis.securityMonitorTest.model.clone(true);')
  .replace("'./hopital/plan.js'", JSON.stringify(plan))
  .replace("import { layoutOf } from './hopital/mobilier.js';", 'const { layoutOf } = globalThis.securityMonitorTest;');
const { createSecurityMonitors } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

test('five independent feeds follow real lenses and restore floors, hands and renderer even after failure', async () => {
  const scene = new THREE.Scene(), heads = Array.from({ length: 5 }, () => new THREE.Group());
  heads.forEach((h, i) => { h.position.set(i, 2, i); h.rotation.y = i; scene.add(h); });
  const floors = [new THREE.Group(), new THREE.Group()]; floors[1].visible = false;
  const hand = new THREE.Group(), body = new THREE.Group(); body.visible = false;
  const oldTarget = {}, renderer = {
    target: oldTarget, shadowMap: { autoUpdate: true },
    getRenderTarget() { return this.target; }, setRenderTarget(t) { this.target = t; }, clear() {},
    render(s, camera) {
      assert.ok(floors.every((f) => f.visible)); assert.equal(hand.visible, false); assert.equal(body.visible, true);
      assert.equal(camera.parent, heads[this.calls++]);
      if (this.fail) throw new Error('render failure');
    }, calls: 0,
  };
  const system = await createSecurityMonitors(scene, renderer, null, { H: { surveillanceFloors: floors } }, heads, [hand], body);
  const room = ROOMS[0].find((r) => r[4] === 'Poste de sécurité 001');
  const { cx, cz } = layoutOf(0, ...room);
  const viewer = { position: new THREE.Vector3(cx, -FH + 1.6, cz) };
  assert.equal(new Set(system.feeds.map((f) => f.target.texture)).size, 5);
  for (let i = 0; i < 5; i++) system.update(1 / 30, viewer, true);
  assert.equal(renderer.calls, 5);
  assert.equal(renderer.target, oldTarget); assert.equal(renderer.shadowMap.autoUpdate, true);
  assert.equal(floors[1].visible, false); assert.equal(hand.visible, true); assert.equal(body.visible, false);
  system.update(1, viewer, false); assert.equal(renderer.calls, 5);
  viewer.position.y = 1.6; system.update(1, viewer, true); assert.equal(renderer.calls, 5);
  viewer.position.y = -FH + 1.6; renderer.calls = 0; renderer.fail = true;
  assert.throws(() => system.update(1, viewer, true), /render failure/);
  assert.equal(renderer.target, oldTarget); assert.equal(floors[1].visible, false); assert.equal(hand.visible, true);
  system.feeds.forEach((f) => f.target.dispose());
});

// Exercise the original failure: stripping the case must not leave the CRT floating.
test('CCTV stands touch the counter and every monitor fits on a supporting table', async () => {
  const scene = new THREE.Scene();
  const heads = SECURITY_MONITORS.map(() => new THREE.Group());
  const system = await createSecurityMonitors(scene, {}, null, {}, heads);
  const room = ROOMS[0].find((r) => r[4] === 'Poste de sécurité 001');
  const { cx, cz, right, fwd, hv } = layoutOf(0, ...room);
  for (const [i, { terminal, target }] of system.feeds.entries()) {
    const bounds = new THREE.Box3().setFromObject(terminal);
    assert.ok(Math.abs(bounds.min.y - (-FH + SECURITY_DESK_H)) < 1e-6);
    const u = (terminal.position.x - cx) * right[0] + (terminal.position.z - cz) * right[1];
    const v = (terminal.position.x - cx) * fwd[0] + (terminal.position.z - cz) * fwd[1];
    assert.ok(Math.abs(u - SECURITY_MONITORS[i]) < 1e-6);
    assert.ok(Math.abs(v - (hv - SECURITY_DESK_GAP)) < 1e-6);
    assert.ok(SECURITY_DESKS.some((desk) => Math.abs(u - desk) + 0.21 < 0.65));
    for (const name of ['pc_case', 'keyboard', 'mouse']) assert.equal(terminal.getObjectByName(name), undefined);
    target.dispose();
  }
});


test('desk accessories rest completely on the counter without intersecting each other', async () => {
  let src = readFileSync(new URL('../hopital/mobilier.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replaceAll('export ', '');
  src = src.slice(0, src.indexOf('  const files = [...new Set(placements.map'));
  const placements = await new Function('THREE', ...Object.keys(planData),
    src + '\n return placements; } return loadFurniture(null, {});')(THREE, ...Object.values(planData));
  const room = ROOMS[0].find((r) => r[4] === 'Poste de sécurité 001');
  const { cx, cz, right, fwd, hu, hv } = layoutOf(0, ...room);
  const objects = placements.filter((p) => p.f === 0
    && Math.abs((p.x - cx) * right[0] + (p.z - cz) * right[1]) < hu
    && Math.abs((p.x - cx) * fwd[0] + (p.z - cz) * fwd[1]) < hv).map((p) => {
      const m = boundsModel(p.file);
      m.position.set(p.x, p.y, p.z); m.rotation.set(p.rx, p.yaw, 0, 'YXZ');
      return { ...p, box: new THREE.Box3().setFromObject(m) };
    });
  const tables = objects.filter((p) => p.file === 'table');
  assert.equal(tables.length, 5);
  const props = objects.filter((p) => p.file.startsWith('props/security_') && p.y === SECURITY_DESK_H);
  assert.equal(props.length, 4);
  for (const p of props) {
    const b = p.box;
    assert.ok(Math.abs(b.min.y - SECURITY_DESK_H) < 1e-6, `${p.file} floats above the counter`);
    // A control console can span the join between two adjacent tables.
    for (let x = b.min.x; x <= b.max.x + 1e-6; x += (b.max.x - b.min.x) / 8) {
      for (const z of [b.min.z, b.max.z]) assert.ok(tables.some((t) =>
        x >= t.box.min.x - 1e-6 && x <= t.box.max.x + 1e-6
        && z >= t.box.min.z - 1e-6 && z <= t.box.max.z + 1e-6), `${p.file} overhangs the counter`);
    }
  }
  for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++) {
    const overlap = props[i].box.clone().intersect(props[j].box);
    assert.ok(overlap.isEmpty() || Math.min(...overlap.getSize(new THREE.Vector3())) < 1e-6,
      `${props[i].file} intersects ${props[j].file}`);
  }
});
