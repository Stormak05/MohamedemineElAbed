import * as THREE from 'three';
import { mat } from './util.js';

// Modular decor from assets/decor/: 2 m modules named type_STATEvariant, 4 decay states, 3 variants.
// Each slot holds its 4 states; a slot only switches state while it is out of view.

const sources = new Map();
// Loads a .glb once, converts its materials to the game's Lambert look, returns a fresh clone.
export async function loadModel(loader, file) {
  if (!sources.has(file)) {
    sources.set(file, loader.loadAsync(`./assets/${file}.glb`).then((gltf) => {
      const converted = new Map();
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const src = o.material;
        if (!converted.has(src)) {
          if (src.map) { src.map.magFilter = src.map.minFilter = THREE.NearestFilter; src.map.generateMipmaps = false; src.map.needsUpdate = true; }
          const glass = src.transparent;
          const cutout = src.alphaTest > 0 ? { alphaTest: src.alphaTest } : {}; // alphaMode MASK (decals, grilles)
          // Glass stays unlit: the light that follows the player would wash it out and hide what is behind.
          converted.set(src, glass
            ? new THREE.MeshBasicMaterial({ map: src.map, color: src.color.clone().multiplyScalar(0.3), ...cutout, transparent: true, depthWrite: false, side: THREE.DoubleSide })
            : mat({ map: src.map, color: src.color, ...cutout }));
        }
        o.material = converted.get(src);
        o.castShadow = false;
        o.receiveShadow = true;
      });
      return gltf.scene;
    }));
  }
  return (await sources.get(file)).clone(true);
}

// Replaces a mesh's material by a glowing one, for bulbs and light diffusers.
export function makeEmissive(root, name, material) {
  root.getObjectByName(name).material = material;
}

const setCast = (root) => root.traverse((o) => { if (o.isMesh) o.castShadow = !o.material.transparent; });

export async function loadDecor(scene, loader, { RX, RZ_BACK, RZ_FRONT, RH, WIN, DOOR, doorPivot, signGroup }) {
  const tiles = [];
  const states = (type, v, text) => [1, 2, 3, 4].map((s) => `decor/${type}_${s === 4 && text ? `4_${text}` : `${s}${v}`}`);

  async function addSlot(files, x, y, z, ry, castShadow = false) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = ry;
    scene.add(group);
    const roots = await Promise.all(files.map((f) => loadModel(loader, f)));
    roots.forEach((r, i) => { r.visible = i === 0; group.add(r); if (castShadow) setCast(r); });
    group.updateMatrixWorld(true);
    const tile = { mesh: roots[0], roots, box: new THREE.Box3().setFromObject(group), level: 0, tint: null, leaves: null };
    tiles.push(tile);
    return tile;
  }

  // Which variant goes where is deliberate: plain walls behind the phone and the photo, one phrase per wall at state 4.
  const W = Math.PI / 2;
  const walls = [
    [RX / 2, -RZ_BACK, 0, 'a', null, true], // bed and photo
    [-RX / 2, RZ_FRONT, Math.PI, 'a', null], // sink and mirror
    [RX / 2, RZ_FRONT, Math.PI, 'c', 'sors'],
    [-RX, -2, W, 'b', 'ils_ecoutent'],
    [-RX, 0, W, 'a', null], // phone and red light
    [-RX, 2, W, 'a', null], // wardrobe
    [RX, -2, -W, 'a', 'ils_te_voient'],
    [RX, 0, -W, 'a', 'mourez'],
  ];
  const floors = [[-1, -2, 'c'], [1, -2, 'a'], [-1, 0, 'a'], [1, 0, 'b'], [-1, 2, 'b'], [1, 2, 'a']];
  const ceilings = [[-1, -2, 'a'], [1, -2, 'b'], [-1, 0, 'b'], [1, 0, 'a'], [-1, 2, 'c'], [1, 2, 'a']];

  const jobs = [
    ...walls.map(([x, z, ry, v, text, cast]) => addSlot(states('wall', v, text), x, 0, z, ry, cast).then((t) => { t.text = text; return t; })),
    ...floors.map(([x, z, v]) => addSlot(states('floor', v), x, 0, z, 0)),
    ...ceilings.map(([x, z, v]) => addSlot(states('ceiling', v), x, RH, z, 0)),
  ];

  // Window wall: the same four decay states as the neighbouring wall modules.
  jobs.push(addSlot(states('wall_window', 'a'), WIN.x, 0, -RZ_BACK, 0, true));

  // Door: each state's leaf moves under doorPivot, so the leaf turns as one whatever its state.
  jobs.push(addSlot(states('door', 'c'), RX, 0, DOOR.z, -W, true).then((tile) => {
    tile.mesh.parent.add(doorPivot);
    doorPivot.position.set(-DOOR.w / 2, 0, -0.01);
    tile.leaves = tile.roots.map((r, i) => {
      const leaf = r.getObjectByName('door_leaf');
      leaf.position.set(0, 0, 0);
      leaf.visible = i === 0;
      doorPivot.add(leaf);
      return leaf;
    });
  }));

  // Exit sign above the door.
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6) });
  jobs.push(loadModel(loader, 'exit_sign').then((sign) => {
    glow.map = sign.getObjectByName('sign_diffuser').material.map;
    makeEmissive(sign, 'sign_diffuser', glow);
    signGroup.add(sign);
  }));

  await Promise.all(jobs);

  // Level from sanity loss; slots catch up only when the player is not looking at them.
  const wideCam = new THREE.PerspectiveCamera();
  const frustum = new THREE.Frustum(), projView = new THREE.Matrix4();
  const levelFor = (sanityLoss) => (sanityLoss < 0.3 ? 0 : sanityLoss < 0.55 ? 1 : sanityLoss < 0.78 ? 2 : 3);
  function setLevel(t, target) {
    t.level = target;
    if (t.apply) { t.apply(target); return; }
    if (t.tint) { t.tint(target); return; }
    t.roots.forEach((r, i) => { r.visible = i === target; });
    t.leaves?.forEach((l, i) => { l.visible = i === target; });
  }
  function updateDecay(camera, sanityLoss) {
    const target = levelFor(sanityLoss);
    if (tiles.every((t) => t.level === target)) return;
    wideCam.copy(camera, false); // not its children: the player light would be cloned into it every frame
    wideCam.fov = Math.min(170, camera.fov * 1.6);
    wideCam.aspect = camera.aspect * 1.3;
    wideCam.near = 0.01;
    wideCam.updateProjectionMatrix();
    wideCam.updateMatrixWorld(true);
    projView.multiplyMatrices(wideCam.projectionMatrix, wideCam.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projView);
    for (const t of tiles) {
      if (t.level === target) continue;
      // Props whose states sit in different places (props.js) give one box per state: both must be out of view.
      const boxes = t.boxes ? [t.boxes[t.level], t.boxes[target]] : [t.box];
      if (boxes.some((b) => !b.isEmpty() && frustum.intersectsBox(b))) continue;
      setLevel(t, target);
    }
  }
  // A restored game: everything at the state of its sanity at once, before the player sees the room.
  function forceDecay(sanityLoss) {
    const target = levelFor(sanityLoss);
    for (const t of tiles) if (t.level !== target) setLevel(t, target);
  }
  return { tiles, updateDecay, forceDecay };
}

