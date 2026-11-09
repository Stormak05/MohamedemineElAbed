import * as THREE from 'three';
import { buildHospital } from './batiment.js';
import { dressHospital } from './habillage.js';
import { addExitSigns } from './sorties.js';
import { dressPosters } from './affiches.js';
import { CEIL, FH } from './plan.js';

// The hospital around room 104, for main.js. The room is on the first floor: the building is lowered by one floor so
// that room coordinates stay as they are (room floor at y = 0, ground floor at y = -FH).
// Everything the player code sees is in room coordinates; batiment.js works in building coordinates (y + FH).

const POOL = 8; // point lights that follow the nearest ceiling fixtures
const GLOW_FLOOR = 0.26, GLOW_CEIL = 0.5, GLOW_MAX_REACH = 3.2; // far fixtures: fake light on the floor and ceiling
const STEP_UP = 0.45, MAX_DROP = 0.6, BODY = 1.75;

// story: { has(item), locked(door), unlocked(door), liftOk() } (main.js): which doors and the lift the player can open.
export function createHospital(scene, { audio, toast, cfg, story = {}, R = 0.22 }) {
  const root = new THREE.Group();
  root.position.y = -FH;
  scene.add(root);
  const H = buildHospital(root);
  root.updateMatrixWorld(true);
  // Only the walls around the room cast shadows: they stop its lamp and the courtyard light from reaching the corridor.
  // The whole building in the shadow maps would cost too much.
  const near = new THREE.Box3(new THREE.Vector3(-3, -0.5, -4), new THREE.Vector3(6, 3, 4)), box = new THREE.Box3();
  root.traverse((o) => { if (o.isMesh && o.material.visible !== false && box.setFromObject(o).intersectsBox(near)) o.castShadow = true; });
  for (const t of H.tiles) t.box = new THREE.Box3().setFromObject(t.group);
  const ctx = { audio, toast, ...story };

  // ---------- Collisions and floors (room coordinates in, building coordinates inside) ----------
  const colliders = H.colliders;
  // Extra boxes from the room: its walls (the faces of its modules) and its furniture. y in room coordinates.
  function addCollider(x0, z0, x1, z1, y0, y1, extra = {}) {
    // Descriptors, not values: `active` may be a getter (the room door).
    const c = Object.defineProperties({ x0, z0, x1, z1, y0: y0 + FH, y1: y1 + FH }, Object.getOwnPropertyDescriptors(extra));
    colliders.push(c);
    return c;
  }
  // real: for the characters, the walls stay walls when the developer's noclip lets the player through.
  function blocked(x, z, hy, real = false) {
    if (cfg.dNoclip && !real) return false;
    for (const c of colliders) {
      if (c.active === false) continue;
      if (c.y1 <= hy + STEP_UP || c.y0 >= hy + BODY) continue;
      if (x > c.x0 - R && x < c.x1 + R && z > c.z0 - R && z < c.z1 + R) return true;
    }
    return false;
  }
  function groundAt(x, z, hy) {
    let best = null;
    for (const s of H.surfaces) {
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      const h = s.h(x, z);
      if (h <= hy + STEP_UP && (best === null || h > best)) best = h;
    }
    return best;
  }
  // Can the player (feet at room height y) stand at (x, z)?
  function canStand(x, z, y, real = false) {
    if (cfg.dNoclip && !real) return true;
    const hy = y + FH, g = groundAt(x, z, hy);
    return g !== null && g >= hy - MAX_DROP && !blocked(x, z, hy, real);
  }
  // Vertical: step onto stairs, ride the lift, fall otherwise.
  function settle(player, dt) {
    const hy = player.y + FH, g = groundAt(player.pos.x, player.pos.z, hy);
    if (g === null) return;
    if (g >= hy - 0.35) { player.y = g - FH; player.vy = 0; return; }
    player.vy = (player.vy ?? 0) - 9.8 * dt;
    player.y = Math.max(g - FH, player.y + player.vy * dt);
    if (player.y === g - FH) { player.vy = 0; audio.land(); }
  }
  // How far along the segment a → b (room coordinates) is clear of the walls and doors, 0..1 (1 = clear all the way).
  // For the first-person hands: they must not reach through a wall. The room's furniture boxes (`furniture`) run up to
  // 2 m whatever the piece's height, so they don't count; neither does a box `a` is already in.
  function clearance(a, b, pad = 0, real = false) {
    if (cfg.dNoclip && !real) return 1;
    const o = [a.x, a.y + FH, a.z], d = [b.x - a.x, b.y - a.y, b.z - a.z];
    let best = 1;
    for (const c of colliders) {
      if (c.active === false || c.furniture || c.y1 <= c.y0) continue;
      const lo = [c.x0 - pad, c.y0 - pad, c.z0 - pad], hi = [c.x1 + pad, c.y1 + pad, c.z1 + pad];
      let t0 = 0, t1 = best, inside = true;
      for (let i = 0; i < 3 && t0 <= t1; i++) {
        if (o[i] < lo[i] || o[i] > hi[i]) inside = false;
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) t1 = -1; continue; }
        let u = (lo[i] - o[i]) / d[i], v = (hi[i] - o[i]) / d[i];
        if (u > v) [u, v] = [v, u];
        if (u > t0) t0 = u;
        if (v < t1) t1 = v;
      }
      if (!inside && t0 <= t1) best = t0;
    }
    return best;
  }
  const roomAt = (x, y, z) => H.roomAt(x, y + FH, z);
  const floorOf = (y) => (y > -FH / 2 ? 1 : 0);

  // ---------- Lights ----------
  const pool = Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xdfe8d8, 0, 7, 1.6);
    scene.add(l);
    return l;
  });
  let poolT = 0, picked = [];
  const flickering = H.fixtures.filter((fx) => fx.flicker && !fx.dead);

  // The other fixtures have no real light: a soft patch under each one and around it on the ceiling, one instanced draw.
  // It fades out as a fixture joins the pool, whose point light takes over.
  const glowFixtures = H.fixtures.filter((fx) => fx.reach && !fx.dead);
  const glowMap = new THREE.CanvasTexture(Object.assign(document.createElement('canvas'), { width: 64, height: 64 }));
  {
    const ctx = glowMap.image.getContext('2d');
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, '#fff'); grd.addColorStop(0.45, '#777'); grd.addColorStop(1, '#000');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    glowMap.colorSpace = THREE.SRGBColorSpace;
  }
  const glow = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowMap, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    glowFixtures.length * 2,
  );
  glow.name = 'ceiling_light_glow';
  glow.frustumCulled = false;
  const glowMatrix = new THREE.Matrix4(), glowColor = new THREE.Color(), glowTint = new THREE.Color(0xdfe8d8);
  glowFixtures.forEach((fx, i) => {
    const rx = Math.min(fx.reach[0], GLOW_MAX_REACH), rz = Math.min(fx.reach[1], GLOW_MAX_REACH), y = fx.floor * FH;
    glow.setMatrixAt(i * 2, glowMatrix.makeScale(rx, 1, rz).setPosition(fx.pos.x, y + 0.02, fx.pos.z));
    glow.setMatrixAt(i * 2 + 1, glowMatrix.makeScale(rx, 1, rz).setPosition(fx.pos.x, y + CEIL - 0.02, fx.pos.z));
    glow.setColorAt(i * 2, glowTint);
    fx.glow = 1;
  });
  glow.instanceMatrix.needsUpdate = true;
  root.add(glow);
  const cam = new THREE.Vector3();
  function updateLights(t, dt, camera, player, k) {
    camera.getWorldPosition(cam);
    poolT -= dt;
    if (poolT <= 0) {
      poolT = 0.2;
      const f = floorOf(player.y);
      const inWell = /escalier|Ascenseur/.test(roomAt(player.pos.x, player.y, player.pos.z) ?? '');
      const cand = H.fixtures.filter((fx) => !fx.dead && (fx.floor === -1 || fx.floor === f || inWell));
      for (const fx of cand) { if (fx.follow) fx.pos.y = fx.follow(); fx.d = (fx.pos.x - cam.x) ** 2 + (fx.pos.y - FH - cam.y) ** 2 + (fx.pos.z - cam.z) ** 2; }
      cand.sort((a, b) => a.d - b.d);
      for (const fx of picked) fx.pooled = false;
      picked = cand.slice(0, POOL);
      for (const fx of picked) fx.pooled = true;
    }
    // Every faulty tube stutters, near or far.
    for (const fx of flickering) {
      // Steady most of the time, then a short faulty stutter every few seconds.
      fx.nextGlitch ??= t + 1 + Math.random() * 6;
      if (t > fx.nextGlitch) { fx.glitchUntil = t + 0.25 + Math.random() * 0.6; fx.nextGlitch = fx.glitchUntil + 3 + Math.random() * 7; }
      fx.on = t < (fx.glitchUntil ?? 0) && Math.sin(t * 37 + fx.pos.x) * Math.sin(t * 23 + fx.pos.z) > 0.1 ? 0.08 : 1;
      if (fx.mesh) fx.mesh.material.color.setScalar(fx.on > 0.5 ? 2.4 : 0.25);
    }
    for (let i = 0; i < POOL; i++) {
      const fx = picked[i], l = pool[i];
      if (!fx || k <= 0) { l.intensity = 0; continue; }
      if (fx.follow) fx.pos.y = fx.follow();
      l.position.set(fx.pos.x, fx.pos.y - FH - 0.15, fx.pos.z);
      l.intensity = 4.2 * fx.power * (fx.on ?? 1) * k * cfg.dAmbient;
    }
    const fade = Math.min(1, dt * 4);
    glowFixtures.forEach((fx, i) => {
      fx.glow += ((fx.pooled ? 0 : 1) - fx.glow) * fade;
      const v = fx.glow * fx.power * (fx.on ?? 1) * Math.max(k, 0) * cfg.dAmbient;
      glow.setColorAt(i * 2, glowColor.copy(glowTint).multiplyScalar(v * GLOW_FLOOR));
      glow.setColorAt(i * 2 + 1, glowColor.copy(glowTint).multiplyScalar(v * GLOW_CEIL));
    });
    glow.instanceColor.needsUpdate = true;
  }

  // The team's modules and furniture over the plan (loaded once the room is ready).
  let dressed = null;
  async function dress(loader) {
    await addExitSigns(root, loader);
    dressed = await dressHospital(root, H, loader);
    await dressPosters(root, H, loader);
  }

  // ---------- Per frame ----------
  // light: 0..1, how much the building's lights count (main.js dims them inside room 104, which has its own).
  function update(dt, t, { player, camera, light = 1, sanityLoss = 0 }) {
    H.update(dt, t, { player: { pos: player.pos, y: player.y + FH } });
    updateLights(t, dt, camera, player, light);
    dressed?.update(player);
    H.updateCameras?.(camera.position, dt, sanityLoss);
  }
  // Camera shake while riding the lift.
  function shake(player) {
    const s = H.lift.state;
    return s.shake && roomAt(player.pos.x, player.y, player.pos.z) === 'Ascenseur' && Math.abs(player.y + FH - s.y) < 0.05 ? s.shake : 0;
  }

  return {
    root, H, dress, update, canStand, settle, clearance, roomAt, floorOf, addCollider, shake,
    tiles: H.tiles, occluders: H.occluders,
    // Interactables, in main.js's form: label() and act().
    interactables: H.interactables.map((it) => ({ obj: it.obj, label: () => it.label(ctx), act: () => it.act(ctx), range: it.range, door: it.door ?? null })),
    doorNamed: (name, f) => H.swingDoors.find((d) => d.name === name && (f === undefined || d.d.f === f)),
  };
}
