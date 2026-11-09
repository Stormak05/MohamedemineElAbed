import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.core.js';
import * as plan from '../hopital/plan.js';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

function model(file) {
  const data = readFileSync(new URL(`../assets/props/${file}.glb`, import.meta.url));
  const size = data.readUInt32LE(12), doc = JSON.parse(data.subarray(20, 20 + size));
  const bin = data.subarray(28 + size), root = new THREE.Group();
  for (const node of doc.nodes.filter((n) => n.mesh !== undefined)) {
    const primitive = doc.meshes[node.mesh].primitives[0];
    const accessor = doc.accessors[primitive.attributes.POSITION], view = doc.bufferViews[accessor.bufferView];
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const positions = Array.from({ length: accessor.count * 3 }, (_, i) => bin.readFloatLE(offset + i * 4));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (primitive.indices !== undefined) {
      const index = doc.accessors[primitive.indices], iv = doc.bufferViews[index.bufferView];
      const io = (iv.byteOffset ?? 0) + (index.byteOffset ?? 0);
      const bytes = index.componentType === 5125 ? 4 : 2;
      geometry.setIndex(Array.from({ length: index.count }, (_, i) => bytes === 4 ? bin.readUInt32LE(io + i * bytes) : bin.readUInt16LE(io + i * bytes)));
    }
    const mesh = new THREE.Mesh(geometry); mesh.name = node.name;
    if (node.matrix) mesh.applyMatrix4(new THREE.Matrix4().fromArray(node.matrix));
    root.add(mesh);
  }
  return root;
}

async function liftWithModels() {
  const scene = new THREE.Scene(), interactables = [];
  const src = source('hopital/batiment.js');
  const texture = () => new THREE.Texture();
  const build = new Function('THREE', 'MAT', 'pixelTexture', 'canvasTexture', ...Object.keys(plan),
    src.slice(src.indexOf('function buildLift(')) + '\nreturn buildLift;')(
    THREE, { steel: new THREE.MeshBasicMaterial(), dark: new THREE.MeshBasicMaterial(), rail: new THREE.MeshBasicMaterial() },
    texture, texture, ...Object.values(plan),
  );
  const lift = build(scene, {
    doors: [0, 1].map((f) => ({ f, c: plan.wx(plan.LIFT.x0) })),
    colliders: [], surfaces: [], interactables, plateTex: texture,
  });
  const fittings = source('objets.js');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const dress = new AsyncFunction('THREE', 'lift', 'loadModel', 'skin', 'loader', 'lamp', 'door', 'call', 'frame',
    fittings.slice(fittings.indexOf('  // Lift.'), fittings.indexOf('  // Swing doors:')));
  await dress(THREE, lift, async () => model('lift_cabin'), (mesh, asset) => { mesh.geometry = asset.geometry; },
    null, { geometry: lift.lamp.geometry }, model('lift_door').children[0], { geometry: lift.panel.geometry }, { geometry: new THREE.BoxGeometry() });
  return { scene, lift, interactables };
}

test('cabin controls remain visible in front of the real panel and sliding doors at both floors', async () => {
  const { scene, lift, interactables } = await liftWithModels();
  const controls = interactables.filter((it) => ['Étage 1', 'Rez-de-chaussée', 'Alarme'].includes(it.label()));
  assert.equal(controls.length, 3);
  for (const floor of [0, 1]) for (const doors of [0, 0.5, 1]) {
    Object.assign(lift.state, { y: floor * plan.FH, floor, doors, mode: 'opening' });
    lift.update(0, 0);
    scene.updateMatrixWorld(true);
    for (const control of controls) {
      const target = control.obj.getWorldPosition(new THREE.Vector3());
      const ray = new THREE.Raycaster(target.clone().add(new THREE.Vector3(0.7, 0, 0)), new THREE.Vector3(-1, 0, 0), 0, 1.6);
      const hits = ray.intersectObject(lift.cabin, true);
      assert.equal(hits[0]?.object, control.obj, `${control.label()}, floor ${floor}, doors ${doors}: control is obscured`);
    }
  }
});

test('cabin floor buttons take the lift upstairs and back to the ground floor', async () => {
  const { lift, interactables } = await liftWithModels();
  for (const [label, floor] of [['Étage 1', 1], ['Rez-de-chaussée', 0]]) {
    interactables.find((it) => it.label() === label).act({});
    for (let i = 0; i < 1200 && !(lift.state.floor === floor && lift.state.mode === 'idle'); i++) lift.update(1 / 60, i / 60);
    assert.equal(lift.state.floor, floor);
    assert.equal(lift.state.y, floor * plan.FH);
    assert.equal(lift.state.mode, 'idle');
    assert.equal(lift.state.doors, 1);
  }
});
