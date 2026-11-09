import * as THREE from 'three';
import { PlayerBody } from './body.js';
import { loadModel } from './decor.js';
import { spot } from './histoire.js';
import { FH, wx, wz } from './hopital/plan.js';
import { createPatrol, advancePatrol, patrolClear } from './patrol.js';

// Smooth value noise (-1..1), for glances and idle shifts (no import: tests load this file from a data: URL).
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
const noise = (x, seed) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i + seed) + (hash(i + 1 + seed) - hash(i + seed)) * u; };
const turnTo = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;

const EYE = new THREE.Vector3(), STEP = { x: 0, y: 0, z: 0 };
// The wandering patient's round, in the north corridor of the first floor.
const PATROL = [[8, 4.4], [17, 4.4]];
// Ground-floor round: east, reception, south, west, north and entrance hall.
// Keep to public areas, without opening doors or entering the stairs/lift.
const GUARD_ROUTE = [[440, 485], [440, 570], [310, 570], [310, 640], [310, 570],
  [140, 570], [140, 370], [280, 370], [280, 310], [280, 370], [440, 370]];
// Never out of his floor: not on the stairs (even through the door the player opened), not into the lift.
const OFF_LIMITS = new Set(['Cage d\'escalier', 'Ascenseur', null]);

function footsteps(actor, moved, onStep) {
  actor.bob += moved * 9;
  actor.stepDist = (actor.stepDist ?? 0) + moved;
  if (actor.stepDist >= 0.62) {
    actor.stepDist %= 0.62;
    onStep(actor.pos);
  }
}

// Staff make short rounds; one wandering patient is a one-shot encounter.
export async function createNPCs(scene, loader, hospital, { blouse = false } = {}) {
  const posts = [
    { id: 'nurse', name: 'INFIRMIÈRE DE GARDE', pitch: 1.15, x: wx(348), y: -FH, z: wz(642), yaw: -Math.PI / 2 },
    { id: 'orderly_male', model: 'security_guard', name: 'AGENT DE SÉCURITÉ', pitch: 0.8, x: wx(460), y: -FH, z: wz(485), yaw: Math.PI / 2 },
    { id: 'doctor', name: 'MÉDECIN', pitch: 0.9, ...spot(0, '005', -1.8, 0) },
    { id: 'doctor_female', name: 'MÉDECIN', pitch: 1.1, ...spot(0, '006', -1.8, 0) },
    // As in the archives: M. Garnier in 101, Mme Roux in 102 (their voices come from there, ambiance.js).
    { id: 'patient_male', name: 'PATIENT', pitch: 0.9, ...spot(1, '101', -2, 0) },
    { id: 'patient_female', name: 'PATIENTE', pitch: 1.1, ...spot(1, 'Chambre 102', -2, 0) },
  ];
  const wanderer = { id: 'patient_male', name: 'PATIENT', pitch: 0.9, x: 12, y: 0, z: 4.4, yaw: 0, wandering: true };
  const actors = await Promise.all([...posts, wanderer].map(async (post) => {
    const model = await loadModel(loader, post.model ?? post.id);
    const root = new THREE.Group();
    root.name = `pnj_${post.id}`;
    model.rotation.y = Math.PI;
    root.add(model);
    scene.add(root);
    const pos = new THREE.Vector3(post.x, post.y, post.z);
    const camera = new THREE.Object3D();
    camera.rotation.order = 'YXZ'; // a glance up or down stays a nod, whatever the heading
    camera.position.copy(pos).y += 1.6;
    // body.js expects a camera looking along -Z; the models look along +Z.
    camera.rotation.y = post.yaw + Math.PI;
    const body = new PlayerBody();
    if (!body.add(root, model)) throw new Error(`Squelette PNJ incomplet : ${post.id}`);
    const collider = post.wandering ? null : hospital.addCollider(pos.x - 0.25, pos.z - 0.25, pos.x + 0.25, pos.z + 0.25, pos.y, pos.y + 1.85, { furniture: true });
    body.update(1 / 60, 0, { visible: true, camera, pos, floorY: pos.y, bob: 0, mode: 'stand' });
    const needsCoat = post.id === 'nurse' || post.id.startsWith('doctor');
    root.visible = !needsCoat || blouse;
    if (collider) collider.active = root.visible;
    return { ...post, root, body, camera, pos, collider, needsCoat, bob: 0, chasing: false, waypoint: 0, v: 0, seed: Math.random() * 100 };
  }));
  for (const a of actors) {
    if (a.wandering) continue;
    const room = hospital.roomAt(a.pos.x, a.pos.y, a.pos.z);
    a.clear = (p) => (a.id === 'orderly_male'
      ? Math.abs(p.y + FH) < 0.05 && ['Couloir', 'Hall', 'Accueil'].includes(hospital.roomAt(p.x, p.y, p.z))
      : hospital.roomAt(p.x, p.y, p.z) === room) && patrolClear(p, hospital, a.collider);
    a.patrol = createPatrol(a.pos, a.clear);
    if (a.id === 'orderly_male') Object.assign(a.patrol, {
      enabled: true, waypoint: 0,
      route: GUARD_ROUTE.map(([x, z]) => ({ x: wx(x), y: -FH, z: wz(z) })),
    });
  }
  // Same walls, doors and level floors as the staff (patrolClear ignores the developer's noclip).
  const wanderOk = (x, z, y) => {
    STEP.x = x; STEP.y = y; STEP.z = z;
    return !OFF_LIMITS.has(hospital.roomAt(x, y, z)) && patrolClear(STEP, hospital, null);
  };
  return {
    actors,
    update(dt, t, viewer, { active = false, consumed = false, blouse = false, onCatch = () => {}, onStep = () => {} } = {}) {
      for (const a of actors) {
        if (!a.needsCoat) continue;
        a.root.visible = blouse;
        a.collider.active = blouse;
      }
      if (dt <= 0) return;
      for (const a of actors) {
        if (a.needsCoat && !blouse) continue;
        if (a.wandering) {
          a.root.visible = !consumed;
          if (consumed || !active) continue;
          const sameFloor = Math.abs(viewer.y - a.camera.position.y) < 1;
          const eye = EYE.set(a.pos.x, a.pos.y + 1.4, a.pos.z);
          const clear = sameFloor && hospital.clearance(eye, viewer, 0.15, true) >= 1;
          const distance = Math.hypot(viewer.x - a.pos.x, viewer.z - a.pos.z);
          if (clear && distance < 7) a.chasing = true;
          if (clear && a.chasing && distance < 0.65) {
            a.root.visible = false;
            onCatch();
            continue;
          }
          // Patrol the north corridor. Movement uses the same walls, doors and floors as the player.
          const chase = a.chasing && sameFloor;
          const dx = (chase ? viewer.x : PATROL[a.waypoint][0]) - a.pos.x, dz = (chase ? viewer.z : PATROL[a.waypoint][1]) - a.pos.z;
          const length = Math.hypot(dx, dz);
          if (length < 0.3 && !a.chasing) a.waypoint = 1 - a.waypoint;
          if (length > 0.01) {
            // Speeds up into a run when he sees the player, slows down at the end of the corridor, turns his body round.
            const h = Math.min(dt, 0.05), want = a.chasing ? 2.5 : Math.min(0.7, Math.sqrt(2 * 0.8 * length) + 0.05);
            a.v += Math.max(-2.5 * h, Math.min((a.chasing ? 3 : 1.2) * h, want - a.v));
            const step = Math.min(length, a.v * h);
            const x = a.pos.x + dx / length * step, z = a.pos.z + dz / length * step;
            const ox = a.pos.x, oz = a.pos.z;
            if (wanderOk(x, a.pos.z, a.pos.y)) a.pos.x = x;
            if (wanderOk(a.pos.x, z, a.pos.y)) a.pos.z = z;
            footsteps(a, Math.hypot(a.pos.x - ox, a.pos.z - oz), onStep);
            a.camera.rotation.y = turnTo(a.camera.rotation.y, Math.atan2(-dx, -dz), Math.min(1, h * (a.chasing ? 9 : 4)));
          } else a.v = 0;
          a.camera.rotation.x = noise(t * 0.3, a.seed) * 0.12 - 0.05;
          a.camera.position.copy(a.pos).y += 1.6;
          a.body.update(dt, t, { visible: true, camera: a.camera, pos: a.pos, floorY: a.pos.y, bob: a.bob, mode: 'stand' });
          continue;
        }
        // Only a player in sight turns their head (not one walking past behind the wall).
        const near = Math.abs(viewer.y - a.camera.position.y) < 1.5 && Math.hypot(a.pos.x - viewer.x, a.pos.z - viewer.z) < 3
          && hospital.clearance(EYE.set(a.pos.x, a.pos.y + 1.4, a.pos.z), viewer, 0.15, true) >= 1;
        const oldX = a.pos.x, oldZ = a.pos.z;
        // The guard waits beside the ground-floor stair door until the player wears the coat.
        const waiting = a.id === 'orderly_male' && !blouse;
        const moved = advancePatrol(a.patrol, a.pos, dt, near || waiting, (p) => a.clear(p) && (Math.abs(viewer.y - a.camera.position.y) >= 1.5 || Math.hypot(p.x - viewer.x, p.z - viewer.z) > 0.8));
        footsteps(a, moved, onStep);
        a.collider.x0 = a.pos.x - 0.25; a.collider.x1 = a.pos.x + 0.25;
        a.collider.z0 = a.pos.z - 0.25; a.collider.z1 = a.pos.z + 0.25;
        a.camera.position.set(a.pos.x, a.pos.y + 1.6, a.pos.z);
        if (moved) a.walkYaw = Math.atan2(oldX - a.pos.x, oldZ - a.pos.z);
        // Facing the player who comes near, the way it walks, or its post; standing still, its gaze wanders a little.
        const idle = moved ? 0 : 1;
        const glance = noise(t * 0.17, a.seed) * 0.45 * idle + noise(t * 0.6, a.seed + 7) * 0.05;
        const yaw = (near ? Math.atan2(a.pos.x - viewer.x, a.pos.z - viewer.z) : a.walkYaw ?? a.yaw + Math.PI) + glance * (near ? 0.25 : 1);
        a.camera.rotation.y = turnTo(a.camera.rotation.y, yaw, Math.min(1, dt * (near ? 3.5 : 2.2)));
        a.camera.rotation.x = noise(t * 0.23, a.seed + 3) * 0.1 - (near ? 0 : 0.06);
        // The skeleton is only posed for a player on the same floor, within sight distance (the round goes on anyway).
        if (Math.abs(viewer.y - a.camera.position.y) < 2.5 && Math.hypot(a.pos.x - viewer.x, a.pos.z - viewer.z) < 30)
          a.body.update(dt, t, { visible: true, camera: a.camera, pos: a.pos, floorY: a.pos.y, bob: a.bob, mode: 'stand' });
      }
    },
  };
}
