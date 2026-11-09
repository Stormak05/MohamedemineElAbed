import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadModel } from '../decor.js';
import { attachCameraEye, trackCamera } from '../surveillance.js';
import { SECURITY_DESKS, SECURITY_DESK_GAP, ROOMS, DOORS, FH, CEIL, T, S, NORTH_HALL_Y, EVAC_PLAN_F1, toF0, wx, wz } from './plan.js';

// Furniture of the hospital's rooms, from the same models as room 104. It does not move or decay, so it is merged by
// room and by material: a bed alone is 62 meshes.
// In a room, "far" is the wall facing its door; t runs to the right seen from the door, or towards "far" on the side walls.
// wall(side, t, gap, file): the model's front (-Z) faces the room, its origin gap metres from the wall.
// at(u, v, file, deg): free-standing, u to the right, v towards "far", from the centre of the room.

const BED = 'medical_bed', STAND = 'props/nightstand', ROBE = 'props/wardrobe_open', SINK = 'props/sink', MIRROR = 'props/mirror_steel';
const RAD = 'props/radiator', POLE = 'props/iv_pole', CHAIR = 'chair', TABLE = 'table', TOILET = 'props/toilet_steel', WHEEL = 'props/wheelchair';
const DESK_H = 0.74, MIRROR_H = 1.22;
const P = (n) => `props/${n}`;
const CANTEEN_TABLE = P('canteen_table'), BENCH = P('canteen_bench'), SERVING = P('serving_counter'), TRAYS = P('tray_rack');
const COUNTER = P('kitchen_counter'), RANGE = P('kitchen_range'), HOOD = P('kitchen_hood'), KSINK = P('kitchen_sink'), FRIDGE = P('kitchen_fridge');
const SHELF = P('kitchen_shelf'), KRACK = P('kitchen_rack'), POTS = P('kitchen_pots'), KBIN = P('kitchen_bin');
const solidOf = new Set([BED, STAND, ROBE, SINK, TOILET, TABLE, CHAIR, RAD, WHEEL, CANTEEN_TABLE, BENCH, SERVING, TRAYS, COUNTER, RANGE, KSINK, FRIDGE, KRACK, KBIN, P('security_rack')]);

// The personal PAPA drawings (kid_drawings / kid_drawings_4) belong only to room 104 in props.js.
const DRAWINGS = ['garden', 'sea', 'sky', 'animals', 'vehicles'].map((theme) => P(`ward_drawings_${theme}`));
const patient = (m, drawing, writingOffset = 0) => ({ wall, at, hv }) => {
  const near = m > 0 ? 'right' : 'left', other = m > 0 ? 'left' : 'right';
  wall('far', -1.2 * m, 1.08, BED, { flip: true });
  wall('far', -0.4 * m, 0.25, STAND);
  wall('far', 1.5 * m, 0, RAD);
  wall(near, 1.0, 0.3, ROBE);
  wall(other, 1.6, 0, SINK);
  wall(other, 1.6, 0, MIRROR, { y: MIRROR_H });
  // A bedside meal and a small writing corner make each room feel occupied.
  wall('far', -0.4 * m, 0.25, P('meal_tray'), { y: 0.6 });
  wall('far', -1.95 * m, 0, P('nurse_call'), { y: 1.05 });
  wall(other, 1.78, 0.07, P('toothbrush_cup'), { y: 0.85 });
  wall(near, -0.4, 0, P('clipboard'), { y: 1.25 });
  wall(other, -0.6, 0, DRAWINGS[drawing], { y: 1.45, flip: true });
  wall('far', 0.8 * m, 0, P('wall_clock'), { y: 2.05 });
  wall(near, Math.min(1.8, hv - 0.25), 0, P('vent_grille'), { y: 2.3 });
  // Move the writing corner as a unit where the entrance needs more clearance (room 101).
  at((0.75 + writingOffset) * m, -0.65, TABLE, 0);
  at((0.75 + writingOffset) * m, -1.4, CHAIR, m * 8);
  at((0.45 + writingOffset) * m, -0.65, P('diary'), m * 12, { y: DESK_H });
  at((1.05 + writingOffset) * m, -0.65, P('books_pile'), -m * 8, { y: DESK_H });
  at((0.75 + writingOffset) * m, -0.4, P('pill_organizer'), 0, { y: DESK_H });
  at((1.2 + writingOffset) * m, -0.4, P('dose_cup'), 0, { y: DESK_H });
  at(-1.2 * m, 1.6, P('plush'), m * 20, { y: 0.72 });
  at(-2.0 * m, 1.3, POLE, 0, { solid: true });
  at(-1.2 * m, 0.6, 'props/slippers', 20);
};
const consult = (m) => ({ wall, at }) => {
  at(0.4 * m, 0.6, TABLE, 0);
  at(0.4 * m, 1.2, CHAIR, 180);
  at(0.2 * m, -0.2, CHAIR, 10);
  at(0.75 * m, 0.6, 'props/books_pile', 15, { y: DESK_H });
  wall(m > 0 ? 'left' : 'right', 1.2, 0.3, ROBE);
  wall(m > 0 ? 'right' : 'left', 1.6, 0, SINK);
  wall(m > 0 ? 'right' : 'left', 1.6, 0, MIRROR, { y: MIRROR_H });
  wall('far', -0.7, 0, RAD);
  wall('far', 0.8, 0, P('wall_clock'), { y: 2.05 });
  wall(m > 0 ? 'left' : 'right', -0.5, 0, P('clipboard'), { y: 1.4 });
  at(0.15 * m, 0.45, P('diary'), 12, { y: DESK_H });
  at(0.65 * m, 0.35, P('dose_cup'), 0, { y: DESK_H });
};
const toilets = ({ wall }) => {
  wall('far', -0.6, 0.28, TOILET);
  wall('left', 0.6, 0, SINK);
  wall('left', 0.6, 0, MIRROR, { y: MIRROR_H });
};

const ROOM_LAYOUT = {
  '0|Cabinet Dr W. Morel 007': consult(1), '0|006': consult(-1), '0|005': consult(1), '0|002': consult(-1), '0|003': consult(1), '0|004': consult(-1),
  '0|WC Hommes': toilets, '0|WC Femmes': toilets,
  '1|103': patient(1, 0), '1|Chambre 102': patient(-1, 1), '1|101': patient(1, 2, 0.7), '1|105': patient(1, 3), '1|106': patient(-1, 4), '1|107': patient(1, 0),
  '1|108': patient(-1, 1), '1|109': patient(1, 2), '1|110': patient(-1, 3), '1|112': patient(1, 4), '1|113': patient(-1, 0), '1|114': patient(1, 1),
  // Refectory: rows of tables either side of the aisle from the door, the serving line along the kitchen wall.
  '0|Cantine': ({ wall, at }) => {
    let n = 0;
    for (const u of [-6.4, -3.2, 3.2, 6.4]) for (const v of [-3.6, -1, 1.6]) {
      at(u, v, CANTEEN_TABLE, 0);
      at(u, v - 0.62, BENCH, 0); at(u, v + 0.62, BENCH, 0);
      if (n++ % 3 === 0) at(u - 0.5, v, 'props/meal_tray', 0, { y: DESK_H });
    }
    wall('far', 2.6, 0, SERVING, { flip: true });
    wall('far', -0.6, 0, SERVING, { flip: true });
    wall('far', 5, 0.3, TRAYS);
    wall('far', -3, 0.3, KBIN);
  },
  // Kitchen: cold store, washing up and cooking along the far wall, a double island in the middle. The door is near t = 6.9.
  '0|Cuisine': ({ wall, at }) => {
    const back = { flip: true };
    wall('far', -7.9, 0, FRIDGE, back); wall('far', -6.4, 0, FRIDGE, back);
    wall('far', -4.7, 0, KSINK, back); wall('far', -3.2, 0, KSINK, back);
    wall('far', -1.4, 0, COUNTER, back); wall('far', -1.4, 0, SHELF, { flip: true, y: 1.5 });
    for (const t of [0.6, 2.2]) {
      wall('far', t, 0, RANGE, back);
      wall('far', t, 0, HOOD, { flip: true, y: CEIL });
    }
    wall('far', 2.2, 0.4, POTS, { y: 0.9 });
    wall('far', 4.1, 0, COUNTER, back); wall('far', 4.1, 0, SHELF, { flip: true, y: 1.5 });
    wall('far', 6.2, 0, COUNTER, back);
    wall('far', 4.1, 0.35, POTS, { y: 0.9 });
    for (const u of [-3, -1, 1, 3]) { at(u, -0.4, COUNTER, 0); at(u, -0.4, COUNTER, 180); }
    at(-1, 0.05, POTS, 0, { y: 0.9 });
    wall('left', -0.9, 0.27, KRACK); wall('left', 0.9, 0.27, KRACK);
    wall('right', -1.8, 0.27, KBIN);
  },
  '0|Salle de réunion 008': ({ wall, at }) => {
    at(0, -0.65, TABLE, 90); at(0, 0.65, TABLE, 90);
    for (const v of [-0.65, 0.65]) { at(-0.62, v, CHAIR, -90); at(0.62, v, CHAIR, 90); }
    wall('far', 0, 0, RAD);
  },
  '0|Pharmacie 009': ({ wall, at }) => {
    for (const t of [-1.6, -0.6, 0.4, 1.4]) wall('far', t, 0.3, ROBE);
    at(1, -0.8, TABLE, 0);
    at(1, -0.8, 'props/pill_organizer', 0, { y: DESK_H });
    at(1.3, -0.65, 'props/dose_cup', 0, { y: DESK_H });
  },
  '0|Poste de sécurité 001': ({ wall, at, hv }) => {
    const deskV = hv - SECURITY_DESK_GAP;
    // Continuous surveillance counter: four CCTV screens, the MEDISYS PC, then a fifth feed.
    for (const u of SECURITY_DESKS) wall('far', u, SECURITY_DESK_GAP, TABLE);
    for (const u of [-1.95, 0, 1.3]) at(u, deskV - 0.95, CHAIR, 0);
    wall('left', 0.5, 0.3, ROBE);
    wall('right', 1.1, 0.4, P('security_rack'), { flip: true });
    wall('right', -0.2, 0.005, P('security_keys'), { y: 1.15, flip: true });
    wall('right', -1.3, 0.005, 'wall_phone', { y: 1.15, flip: true });
    wall('far', 0, 0.005, P('wall_clock'), { y: 2.05 });
    wall('far', 1.95, 0.005, P('security_sign'), { y: 1.8, flip: true });
    at(-1.95, deskV - 0.2, P('security_console'), 180, { y: DESK_H });
    at(2.65, deskV + 0.12, P('security_vcr'), 180, { y: DESK_H });
    at(2.15, deskV + 0.13, P('security_radio'), 180, { y: DESK_H });
    at(2.2, deskV - 0.17, P('security_logbook'), 180, { y: DESK_H });
    wall('left', -0.65, 0.025, P('clipboard'), { y: 1.3 });
  },
  '1|Archives': ({ wall, at }) => {
    // Along the long far wall, and a free-standing row down the middle.
    for (const t of [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]) wall('far', t, 0.3, ROBE);
    for (const t of [-4, -3, -2, 2, 3, 4]) at(t, 0, ROBE, 0, { solid: true });
  },
  '1|Laverie': ({ wall, at }) => {
    for (const t of [-1.5, 0, 1.5]) wall('far', t, 0, SINK);
    wall('right', 0, 0.3, ROBE); wall('right', 1.2, 0.3, ROBE);
    at(-1.5, -0.8, 'props/floor_mattress', 80);
    at(-2.2, 0.8, WHEEL, 40);
  },
};
// Corridors and halls, by plan position: [floor, px, py, file, yaw in degrees, y above the floor].
const VENT_WALL_GAP = (T / 2 + 0.005) / S; // plan pixels, back of grille 5 mm off the wall face
const CLOCK_WALL_GAP = (T / 2 + 0.005) / S; // plan pixels, back of clock 5 mm off the wall face
const LOOSE = [
  [0, 330, 382, WHEEL, 92], [0, 472, 500, POLE, 0], [1, 87, 240, WHEEL, 2], [1, 396, 150, POLE, 0],
  [0, 228, 277, CHAIR, 0], [0, 238, 277, CHAIR, 0], [0, 248, 277, CHAIR, 0],
  // Waiting areas against uninterrupted walls, clear of the doors and stair/lift landings.
  [0, 205, 355, BENCH, 0], [0, 380, 355, BENCH, 0],
  [0, 125, 435, CHAIR, 90], [0, 125, 448, CHAIR, 90],
  [0, 155, 583, BENCH, 180], [0, 405, 416, BENCH, 90],
  [0, 467, 565, P('tray_rack'), -90],
  [1, 205, NORTH_HALL_Y + 6, BENCH, 0], [1, 300, NORTH_HALL_Y + 6, BENCH, 0],
  [1, 86, 210, CHAIR, 90], [1, 86, 222, CHAIR, 90],
  [1, 200, 313, BENCH, 180], [1, 290, 313, BENCH, 180],
  // Wall fixtures add rhythm without narrowing the walking route.
  [0, 205, 349 + CLOCK_WALL_GAP, P('wall_clock'), 180, 2.05],
  [0, 380, 351, DRAWINGS[0], 0, 1.4],
  [0, 120, 480, RAD, -90], [0, 118 + VENT_WALL_GAP, 510, P('vent_grille'), -90, 2.3],
  [0, 476, 420, RAD, 90], [0, 478.5 - CLOCK_WALL_GAP, 495, P('wall_clock'), 90, 2.05],
  [0, 205, 588, P('clipboard'), 180, 1.4],
  [1, 205, NORTH_HALL_Y + 2, DRAWINGS[2], 0, 1.4],
  [1, 306, NORTH_HALL_Y + CLOCK_WALL_GAP, P('wall_clock'), 180, 2.05],
  [1, 81, 245, RAD, -90], [1, 79 + VENT_WALL_GAP, 145, P('vent_grille'), -90, 2.3],
  [1, 398, 145, P('clipboard'), -90, 1.4],
  [1, 398, 235, RAD, 90], [1, 400.5 - VENT_WALL_GAP, 300, P('vent_grille'), 90, 2.3],
  [1, 200, 318, DRAWINGS[1], 180, 1.4],
  [1, 290, 320 - CLOCK_WALL_GAP, P('wall_clock'), 0, 2.05],
];
// Corner cameras: on the corner of two walls, [floor, px, py, yaw in degrees].
const CAMERAS = [[1, 400.5, NORTH_HALL_Y, 135], [1, 79, 320, -45], [0, 478.5, 590, 45], [0, 118, 549, -135]];

export function layoutOf(f, a, b, c, d, name) {
  const [x0, y0] = toF0(f, a, b), [x1, y1] = toF0(f, c, d);
  const r = { x0: wx(x0), z0: wz(y0), x1: wx(x1), z1: wz(y1) };
  const door = DOORS.find((q) => q.f === f && q.name === name);
  let fwd = [0, 1];
  if (door) {
    const [px, py] = toF0(f, door.x, door.y);
    const dx = wx(px), dz = wz(py);
    if (door.o === 'h') fwd = Math.abs(dz - r.z0) < Math.abs(dz - r.z1) ? [0, 1] : [0, -1];
    else fwd = Math.abs(dx - r.x0) < Math.abs(dx - r.x1) ? [1, 0] : [-1, 0];
  }
  const right = [-fwd[1], fwd[0]]; // seen from above with +z down: to the right of someone walking along fwd
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const hu = (Math.abs(right[0]) * (r.x1 - r.x0) + Math.abs(right[1]) * (r.z1 - r.z0)) / 2 - T / 2 - 0.03;
  const hv = (Math.abs(fwd[0]) * (r.x1 - r.x0) + Math.abs(fwd[1]) * (r.z1 - r.z0)) / 2 - T / 2 - 0.03;
  return { fwd, right, cx, cz, hu, hv };
}

export async function loadFurniture(loader, H) {
  const placements = [];
  const put = (f, file, x, z, yaw, y = 0, solid = solidOf.has(file), rx = 0) => placements.push({ f, file, x, z, yaw, y, solid, rx });
  for (const f of [0, 1]) {
    for (const [a, b, c, d, name] of ROOMS[f]) {
      const layout = ROOM_LAYOUT[`${f}|${name}`];
      if (!layout) continue;
      const { fwd, right, cx, cz, hu, hv } = layoutOf(f, a, b, c, d, name);
      const wall = (side, t, gap, file, o = {}) => {
        const [out, along, half] = side === 'far' ? [fwd, right, hv] : side === 'right' ? [right, fwd, hu] : [[-right[0], -right[1]], fwd, hu];
        const yaw = Math.atan2(out[0], out[1]); // local -Z → (-sin, -cos) = into the room
        put(f, file, cx + out[0] * (half - gap) + along[0] * t, cz + out[1] * (half - gap) + along[1] * t, o.flip ? yaw + Math.PI : yaw, o.y ?? 0, o.solid ?? solidOf.has(file), o.rx ?? 0);
      };
      const at = (u, v, file, deg, o = {}) => {
        put(f, file, cx + right[0] * u + fwd[0] * v, cz + right[1] * u + fwd[1] * v, Math.atan2(fwd[0], fwd[1]) + THREE.MathUtils.degToRad(deg), o.y ?? 0, o.solid ?? solidOf.has(file), o.rx ?? 0);
      };
      layout({ wall, at, hv });
    }
  }
  // What hangs on the corridor walls (above the floor): the posters keep clear of it (affiches.js).
  H.wallFixtures = [{ f: 1, x: wx(EVAC_PLAN_F1.x), z: wz(EVAC_PLAN_F1.y) + T / 2 + 0.035 }];
  for (const [f, px, py, file, deg, height = 0] of LOOSE) {
    const [x, y] = toF0(f, px, py);
    put(f, file, wx(x), wz(y), THREE.MathUtils.degToRad(deg), height);
    if (height > 0) H.wallFixtures.push({ f, x: wx(x), z: wz(y) });
  }
  for (const [f, px, py, deg] of CAMERAS) {
    const [x, y] = toF0(f, px, py);
    const yaw = THREE.MathUtils.degToRad(deg);
    // The corner is the walls' faces, inwards from their centre lines.
    put(f, 'props/camera_corner', wx(x) - Math.sin(yaw) * (T / 2 + 0.01) * Math.SQRT2, wz(y) - Math.cos(yaw) * (T / 2 + 0.01) * Math.SQRT2, yaw, CEIL, false);
  }

  const files = [...new Set(placements.map((p) => p.file))];
  const models = Object.fromEntries(await Promise.all(files.map(async (file) => [file, await loadModel(loader, file)])));
  const groups = [new THREE.Group(), new THREE.Group()];
  const [eyeModel, eyeMount] = await Promise.all(['props/camera_eye', 'props/camera_eye_mount'].map((file) => loadModel(loader, file)));
  const cameras = [];
  const byCell = new Map();
  const box = new THREE.Box3();
  const holder = new THREE.Group();
  H.mirrorSpots = placements.filter((p) => p.file === MIRROR);
  for (const p of placements) {
    const model = models[p.file];
    // Keep surveillance articulated instead of baking its head into the static furniture.
    if (p.file === 'props/camera_corner') {
      const camera = model.clone(true);
      camera.position.set(p.x, p.f * FH + p.y, p.z);
      camera.rotation.y = p.yaw;
      groups[p.f].add(camera);
      const head = camera.getObjectByName('camera_head');
      if (cameras.length % 2 === 0) attachCameraEye(head, eyeModel, eyeMount);
      cameras.push(head);
      continue;
    }
    holder.position.set(p.x, p.f * FH + p.y, p.z);
    holder.rotation.set(p.rx, p.yaw, 0, 'YXZ');
    holder.add(model);
    holder.updateMatrixWorld(true);
    const cell = `${p.f}|${Math.floor(p.x / 8)}|${Math.floor(p.z / 8)}`;
    if (!byCell.has(cell)) byCell.set(cell, new Map());
    const mats = byCell.get(cell);
    model.traverse((o) => {
      if (!o.isMesh) return;
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      if (!mats.has(o.material)) mats.set(o.material, []);
      mats.get(o.material).push(g);
    });
    if (p.solid) {
      box.setFromObject(holder);
      H.colliders.push({ x0: box.min.x, z0: box.min.z, x1: box.max.x, z1: box.max.z, y0: box.min.y, y1: Math.max(box.max.y, box.min.y + 0.6), furniture: true }); // low furniture such as a bench must still stop the player
    }
    holder.remove(model);
  }
  for (const [cell, mats] of byCell) {
    const f = Number(cell[0]);
    for (const [material, list] of mats) {
      const m = new THREE.Mesh(mergeGeometries(list), material);
      m.receiveShadow = true;
      groups[f].add(m);
    }
  }
  H.cameraHeads = cameras;
  H.updateCameras = (position, dt, loss) => {
    for (const head of cameras) trackCamera(head, position, dt, loss);
  };
  return groups;
}
