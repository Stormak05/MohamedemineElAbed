import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadModel } from './decor.js';
import { FH, CEIL } from './hopital/plan.js';

// Puts Blockbench models in the place of the simple shapes the code starts with. The code keeps moving the same meshes
// (doors, coins, lift): only what they look like changes.

const cache = new Map();
// The door frames' jambs run up through the head: cut them under it, or the faces they share flicker at the corners.
const TRIM = {
  frame_left: trimJamb,
  frame_right: trimJamb,
};
function trimJamb(g, headHeight = 0.06) {
  const p = g.attributes.position;
  let top = -Infinity;
  for (let i = 0; i < p.count; i++) top = Math.max(top, p.getY(i));
  for (let i = 0; i < p.count; i++) if (p.getY(i) > top - headHeight - 0.02) p.setY(i, p.getY(i) - headHeight);
}

// One geometry and one material from a model (its meshes share one atlas), in the model's own space.
export function modelAsset(loader, file) {
  if (!cache.has(file)) {
    cache.set(file, loadModel(loader, file).then((root) => {
      root.updateMatrixWorld(true);
      const parts = [];
      let material = null;
      root.traverse((o) => {
        if (!o.isMesh) return;
        material ??= o.material;
        const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
        if (file.startsWith('props/door_frame_')) TRIM[o.name]?.(g);
        if (file === 'props/lift_frame' && o.name.startsWith('jamb_')) trimJamb(g, 0.08);
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        parts.push(g);
      });
      return { geometry: mergeGeometries(parts), material };
    }));
  }
  return cache.get(file);
}

// keepMaterial: for meshes whose colour the code drives (lock light, lift lamp).
export function skin(mesh, asset, keepMaterial = false) {
  mesh.geometry = asset.geometry;
  if (!keepMaterial) mesh.material = asset.material;
}

// Hospital fittings: lift, stairs, reception desk, door frames, exit signs, ceiling lights.
export async function dressFittings(root, H, loader) {
  const get = (f) => modelAsset(loader, `props/${f}`);
  const lift = H.lift;
  const [door, frame, call, lamp, single, double, light] = await Promise.all([
    ...['lift_door', 'lift_frame', 'lift_call_panel', 'cabin_lamp', 'door_frame_single', 'door_frame_double'].map(get),
    loadModel(loader, 'props/ceiling_light'),
  ]);

  // Fixed pieces placed as they are.
  for (const p of H.placed) {
    const m = await loadModel(loader, `props/${p.file}`);
    m.position.set(p.x, p.y, p.z);
    m.rotation.y = p.ry ?? 0;
    root.add(m);
  }

  // Lift.
  for (const part of lift.cabinParts) part.parent.remove(part);
  const cabin = await loadModel(loader, 'props/lift_cabin');
  const panel = cabin.getObjectByName('button_panel');
  panel.position.x += lift.panel.position.x - new THREE.Box3().setFromObject(panel).getCenter(new THREE.Vector3()).x;
  cabin.position.set(0, 0, lift.czc);
  lift.cabin.add(cabin);
  skin(lift.lamp, lamp, true);
  for (const m of lift.cabDoors) skin(m, door);
  for (const l of lift.landings) {
    for (const m of l.panels) skin(m, door);
    skin(l.back, call);
    l.frame.parent.remove(l.frame);
    const f = new THREE.Mesh(frame.geometry, frame.material);
    f.position.set(l.x, l.y, l.z);
    l.group.add(f);
  }

  // Swing doors: frame and exit sign.
  const sign = await loadModel(loader, 'exit_sign');
  const glow = new THREE.MeshBasicMaterial({ map: sign.getObjectByName('sign_diffuser').material.map, color: new THREE.Color(1.6, 1.6, 1.6) });
  for (const d of H.swingDoors) {
    for (const part of d.frameParts) d.frame.remove(part);
    const a = d.d.kind === 'double' ? double : single;
    // Deeper than the wall with its skirting and rail (12 cm a side), so they stop against the frame instead of cutting into it.
    const frameMesh = new THREE.Mesh(a.geometry, a.material);
    frameMesh.scale.z = 1.25;
    d.frame.add(frameMesh);
    if (d.sign) {
      const s = sign.clone(true);
      s.position.copy(d.sign.position);
      s.position.z -= Math.sign(d.sign.position.z) * 0.024; // its back against the wall
      if (d.sign.position.z < 0) s.rotation.y = Math.PI;
      s.getObjectByName('sign_diffuser').material = glow;
      d.frame.remove(d.sign);
      d.frame.add(s);
      d.sign = s;
    }
  }

  // Only the tubes glow and flicker; the housing stays shaded even when a tube is dead.
  light.updateMatrixWorld(true);
  const tubes = [], housings = [];
  let housingMaterial;
  light.traverse((o) => {
    if (!o.isMesh) return;
    housingMaterial ??= o.material;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    (o.name.endsWith('_diffuser') ? tubes : housings).push(g);
  });
  const tubeGeometry = mergeGeometries(tubes), housingGeometry = mergeGeometries(housings);
  const at = (geometry, fx) => geometry.clone().translate(fx.pos.x, fx.floor * FH + CEIL, fx.pos.z);
  const steady = [], fixed = [];
  for (const fx of H.fixtures) {
    if (fx.noPanel) continue;
    fixed.push(at(housingGeometry, fx));
    if (fx.mesh) {
      fx.mesh.geometry = at(tubeGeometry, fx);
      fx.mesh.material.map = housingMaterial.map;
      fx.mesh.material.needsUpdate = true;
    } else steady.push(at(tubeGeometry, fx));
  }
  if (H.panelBatch) {
    H.panelBatch.geometry = mergeGeometries(steady);
    H.panelBatch.material.map = housingMaterial.map;
    H.panelBatch.material.needsUpdate = true;
  }
  if (fixed.length) {
    const housing = new THREE.Mesh(mergeGeometries(fixed), housingMaterial);
    housing.name = 'ceiling_light_housings';
    root.add(housing);
  }
}
