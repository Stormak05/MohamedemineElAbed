import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pixelTexture, canvasTexture, rnd } from '../util.js';
import { S, FH, CEIL, DOOR_H, T, WALLS, DOORS, ROOMS, FLOORS, STAIR, LIFT, CHAMBRE, wx, wz, toF0 } from './plan.js';

// Builds the hospital from plan.js: merged walls, floors and ceilings, swing doors, the stairwell and the lift.
// Returns what the player needs: colliders, walkable surfaces, interactables, light fixtures, room names.

// ---------- Textures (pixel art, tiled in world space), each in four states of decay ----------
// Like the room's decor modules: 0 clean, 1 lightly marked, 2 and 3 run-down. Damage accumulates: every state
// redraws the same marks (same seed) and adds its own.
function prng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
function decayStates(w, h, base, damage, seed) {
  const t0 = pixelTexture(w, h, base);
  const out = [t0];
  for (let level = 1; level <= 3; level++) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(t0.image, 0, 0);
    const R = prng(seed);
    const fill = (x, y, rw, rh, col) => { ctx.fillStyle = col; ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, Math.floor(rw)), Math.max(1, Math.floor(rh))); };
    const blob = (cx, cy, rx, ry, col, n = 40) => { for (let i = 0; i < n; i++) { const a = R() * 6.283, d = Math.sqrt(R()); fill(cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, 1 + R() * 2, 1 + R() * 2, col); } };
    const line = (x, y, len, dx, dy, col) => { for (let i = 0; i < len; i++) { fill(x, y, 1, 1, col); x += dx + (R() - 0.5) * 0.8; y += dy + (R() - 0.5) * 0.8; } };
    // Every feature consumes the generator whatever the level, so a mark keeps its place from one state to the next.
    damage({ R, fill, blob, line, at: (lv) => lv <= level, w, h });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    out.push(t);
  }
  return out;
}
const when = (on, fn) => { if (on) fn(); };
// Wall: 128 × 64 px = 8 m × FH. Top of the canvas = ceiling.
const wallTex = decayStates(128, 64, ({ rect }) => {
  rect(0, 0, 128, 6, [70, 70, 66], 3); // slab, above the ceiling
  rect(0, 6, 128, 37, [176, 172, 150], 5); // cream paint
  rect(0, 43, 128, 2, [58, 66, 60], 2); // chair rail
  rect(0, 45, 128, 17, [104, 124, 108], 5); // green paint
  rect(0, 62, 128, 2, [44, 46, 42], 2); // skirting
}, ({ R, fill, blob, line, at }) => {
  for (let i = 0; i < 14; i++) { const x = R() * 128, y = 48 + R() * 13, l = 2 + R() * 5; when(at(1), () => fill(x, y, l, 1, 'rgba(40,44,40,0.45)')); } // trolley scuffs
  for (let i = 0; i < 8; i++) { const x = R() * 128, y = 8 + R() * 32; when(at(1), () => fill(x, y, 1, 1, 'rgba(90,86,74,0.5)')); }
  for (let i = 0; i < 5; i++) { const x = R() * 128, rw = 4 + R() * 8, rh = 6 + R() * 16; when(at(2), () => { blob(x, 6 + rh / 2, rw, rh / 2, 'rgba(110,86,50,0.22)', 60); fill(x - rw / 2, 6, rw, 1, 'rgba(90,70,40,0.4)'); }); } // water from above
  for (let i = 0; i < 7; i++) { const x = R() * 128, y = 46 + R() * 14, rw = 2 + R() * 5, rh = 1 + R() * 3; when(at(2), () => fill(x, y, rw, rh, 'rgb(156,152,140)')); } // chipped paint
  for (let i = 0; i < 4; i++) { const x = R() * 128, y = 8 + R() * 50, n = 8 + R() * 14, dx = R() - 0.5; when(at(2), () => line(x, y, n, dx, 0.8, 'rgba(50,48,42,0.7)')); } // cracks
  for (let i = 0; i < 4; i++) { const x = R() * 128, y = 10 + R() * 30, rw = 6 + R() * 10, rh = 4 + R() * 8; when(at(3), () => { blob(x, y, rw, rh, 'rgb(140,136,124)', 70); blob(x, y, rw * 0.6, rh * 0.6, 'rgb(118,114,104)', 25); }); } // peeling, bare plaster
  for (let i = 0; i < 5; i++) { const x = R() * 128, rw = 6 + R() * 10, rh = 14 + R() * 30; when(at(3), () => blob(x, 6 + rh / 2, rw, rh / 2, 'rgba(48,36,22,0.32)', 90)); } // dark run-off
  for (let i = 0; i < 3; i++) { const x = R() * 120, y = 24 + R() * 20; when(at(3), () => { for (let k = 0; k < 4; k++) line(x + k * 2, y, 10, 0.25, 1, 'rgba(30,24,20,0.8)'); }); } // scratches
  for (let i = 0; i < 12; i++) { const x = R() * 128; when(at(3), () => blob(x, 61, 3, 2, 'rgba(30,48,30,0.6)', 8)); } // damp at the skirting
}, 7101);
// Floor: 64 px = 4 m, tiles of 50 cm.
const floorTex = decayStates(64, 64, ({ rect, grime }) => {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) rect(x * 8, y * 8, 8, 8, (x + y) % 2 ? [150, 146, 128] : [128, 130, 118], 4);
  grime(30, 3, 0.2);
}, ({ R, fill, blob, line, at }) => {
  for (let i = 0; i < 12; i++) { const x = R() * 64, y = R() * 64, l = 2 + R() * 4; when(at(1), () => fill(x, y, l, 1, 'rgba(40,38,30,0.4)')); }
  for (let i = 0; i < 6; i++) { const x = R() * 64, y = R() * 64, n = 5 + R() * 8, dx = R() - 0.5; when(at(2), () => line(x, y, n, dx, 1 - Math.abs(dx), 'rgba(40,38,32,0.8)')); }
  for (let i = 0; i < 3; i++) { const tx = Math.floor(R() * 8) * 8, ty = Math.floor(R() * 8) * 8; when(at(2), () => { fill(tx, ty, 8, 8, 'rgb(86,84,76)'); blob(tx + 4, ty + 4, 3, 3, 'rgba(60,58,52,0.8)', 10); }); } // tile gone
  for (let i = 0; i < 4; i++) { const x = R() * 64, y = R() * 64; when(at(2), () => blob(x, y, 4, 3, 'rgba(90,70,40,0.25)', 30)); }
  for (let i = 0; i < 6; i++) { const tx = Math.floor(R() * 8) * 8, ty = Math.floor(R() * 8) * 8; when(at(3), () => fill(tx, ty, 8, 8, 'rgb(80,78,70)')); }
  for (let i = 0; i < 3; i++) { const x = R() * 64, y = R() * 64, r = 4 + R() * 6; when(at(3), () => blob(x, y, r, r * 0.7, 'rgba(18,22,20,0.55)', 80)); } // puddles
  for (let i = 0; i < 30; i++) { const x = R() * 64, y = R() * 64; when(at(3), () => fill(x, y, 1, 1, 'rgb(170,166,156)')); } // debris
}, 7202);
// Ceiling: 64 px = 4.8 m, tiles of 60 cm.
const ceilTex = decayStates(64, 64, ({ rect }) => {
  rect(0, 0, 64, 64, [168, 168, 160], 4);
  for (let i = 0; i < 64; i += 8) { rect(i, 0, 1, 64, [96, 98, 94]); rect(0, i, 64, 1, [96, 98, 94]); }
}, ({ R, fill, blob, at }) => {
  for (let i = 0; i < 4; i++) { const x = R() * 64, y = R() * 64; when(at(1), () => blob(x, y, 2, 2, 'rgba(150,120,60,0.25)', 12)); }
  for (let i = 0; i < 4; i++) { const x = R() * 64, y = R() * 64, r = 4 + R() * 5; when(at(2), () => { blob(x, y, r, r, 'rgba(140,100,50,0.25)', 60); blob(x, y, r * 0.5, r * 0.5, 'rgba(110,80,40,0.3)', 20); }); }
  for (let i = 0; i < 1; i++) { const tx = Math.floor(R() * 8) * 8, ty = Math.floor(R() * 8) * 8; when(at(2), () => fill(tx + 1, ty + 1, 7, 7, 'rgb(14,14,14)')); } // tile gone
  for (let i = 0; i < 4; i++) { const tx = Math.floor(R() * 8) * 8, ty = Math.floor(R() * 8) * 8; when(at(3), () => fill(tx + 1, ty + 1, 7, 7, 'rgb(12,12,12)')); }
  for (let i = 0; i < 3; i++) { const x = R() * 64, y = R() * 64, r = 6 + R() * 8; when(at(3), () => blob(x, y, r, r, 'rgba(60,44,24,0.35)', 90)); }
}, 7303);
const concreteTex = pixelTexture(32, 32, ({ rect, grime }) => { rect(0, 0, 32, 32, [120, 120, 114], 7); grime(10, 2, 0.3); });
const doorTex = decayStates(24, 48, ({ rect }) => {
  rect(0, 0, 24, 48, [150, 120, 84], 4);
  rect(0, 0, 24, 1, [90, 70, 50]); rect(0, 0, 1, 48, [90, 70, 50]); rect(23, 0, 1, 48, [90, 70, 50]);
  rect(8, 8, 8, 10, [30, 38, 40], 2); rect(8, 8, 8, 1, [70, 70, 64]); // small window
  rect(1, 40, 22, 7, [130, 132, 128], 3); // kick plate
}, ({ R, fill, line, blob, at }) => {
  for (let i = 0; i < 6; i++) { const x = 1 + R() * 20, y = 38 + R() * 9; when(at(1), () => fill(x, y, 2 + R() * 3, 1, 'rgba(50,46,40,0.6)')); }
  for (let i = 0; i < 3; i++) { const x = 2 + R() * 18, y = 20 + R() * 16; when(at(2), () => line(x, y, 6, 0.3, 1, 'rgba(70,52,34,0.8)')); }
  when(at(2), () => line(9, 9, 9, 0.7, 0.9, 'rgba(160,170,170,0.8)')); // cracked window
  for (let i = 0; i < 2; i++) { const x = 4 + R() * 12, y = 20 + R() * 12; when(at(3), () => { for (let k = 0; k < 3; k++) line(x + k * 2, y, 9, 0.15, 1, 'rgba(60,40,24,0.55)'); }); } // scratches
  when(at(3), () => { blob(12, 32, 5, 8, 'rgba(40,30,20,0.2)', 40); fill(8, 8, 8, 10, 'rgb(6,6,6)'); line(8, 12, 7, 1, -0.3, 'rgb(140,150,150)'); }); // window broken
}, 7404);
const liftTex = pixelTexture(16, 32, ({ rect }) => { rect(0, 0, 16, 32, [138, 142, 144], 6); for (let y = 0; y < 32; y += 2) rect(0, y, 16, 1, [126, 130, 132], 3); });
const lambert = (map, color = 0xffffff) => new THREE.MeshLambertMaterial({ map, color });
const MAT = {
  wall: wallTex.map((t) => lambert(t)), floor: floorTex.map((t) => lambert(t)), ceil: ceilTex.map((t) => lambert(t, 0xb8b8b0)),
  door: doorTex.map((t) => lambert(t)), concrete: lambert(concreteTex),
  steel: lambert(liftTex), dark: new THREE.MeshLambertMaterial({ color: 0x2a2c2c }),
  rail: new THREE.MeshLambertMaterial({ color: 0x5a3a26 }),
  hit: new THREE.MeshBasicMaterial({ visible: false }),
};
const DECAY = ['wall', 'floor', 'ceil']; // merged by area, one decay slot per 8 m cell and per floor
const UV = { wall: 1 / 8, floor: 1 / 4, ceil: 1 / 4.8 };
const SHELL_INSET = 0.03;
// The door frame's jambs and head lie on the opening's edges: the shell steps back under them, or their faces flicker.
const REVEAL_INSET = 0.02;
// The two storeys' shells meet under the upper floor's modules (3.1 cm thick), not level with them: where the upper
// storey has no wall over a lower one (another layout, a doorway), the top of that wall would flicker with the floor.
const STOREY_JOIN = FH - 0.04;

// World-space UVs: u along the face, v up the wall (relative to the floor the piece belongs to).
function worldUV(geo, { floorY = 0, su = 0.5, sv = 1 / FH, flat = 0.5 } = {}) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay > 0.5) uv.setXY(i, x * flat, z * flat);
    else uv.setXY(i, (ax > 0.5 ? z : x) * su, (y - floorY) * sv);
  }
  return geo;
}
function boxGeo(x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
function plane(x0, z0, x1, z1, y, down, scale = 0.5) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(down ? Math.PI / 2 : -Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  return worldUV(g, { flat: scale });
}

export function buildHospital(scene) {
  const colliders = []; // { x0, z0, x1, z1, y0, y1, active? }
  const surfaces = []; // { x0, z0, x1, z1, h(x, z) }
  const interactables = []; // { obj, label(), act(), range }
  const fixtures = []; // ceiling lights { pos, floor, power, flicker }
  const occluders = [];
  const geos = { wall: [], floor: [], ceil: [], concrete: [], dark: [], rail: [], steel: [] };
  const tiles = []; // decay slots (decor.js rule: one only changes state out of view); box set once placed
  const updaters = [];

  const addBox = (kind, x0, y0, z0, x1, y1, z1, opts) => geos[kind].push(worldUV(boxGeo(x0, y0, z0, x1, y1, z1), { su: UV[kind] ?? 0.5, ...opts }));
  const solid = (x0, z0, x1, z1, y0, y1) => colliders.push({ x0, z0, x1, z1, y0, y1 });

  // ---------- Walls, with openings cut for the doors ----------
  const doors = DOORS.map((d) => {
    const [px, py] = toF0(d.f, d.x, d.y);
    const c = d.o === 'h' ? wz(py) : wx(px), s = d.o === 'h' ? wx(px) : wz(py);
    // Swing doors take the width of the door module's leaf (0.94 m), two of them for a double door.
    const half = d.kind === 'lift' || d.kind === 'open' ? (d.w * S) / 2 : d.kind === 'double' ? 0.94 : 0.47;
    return { ...d, c, s, half, y0: d.f * FH };
  });
  const wallRuns = []; // pieces of wall, for the modules (habillage.js)
  const floorRects = [];
  const placed = []; // Blockbench models set in place once loaded (objets.js)
  const wallList = [];
  for (const f of [0, 1]) for (const w of WALLS[f]) wallList.push({ w, f, y0: f * FH, y1: f * FH + FH });
  for (const w of WALLS.shared) for (const f of [0, 1]) wallList.push({ w, f, y0: f * FH, y1: f * FH + FH, shared: true });
  for (const { w, f, y0, y1, shared } of wallList) {
    const [ax, ay] = shared ? w : toF0(f, w[0], w[1]);
    const [bx, by] = shared ? w.slice(2) : toF0(f, w[2], w[3]);
    const horiz = ay === by;
    const c = horiz ? wz(ay) : wx(ax);
    const s0 = (horiz ? wx(Math.min(ax, bx)) : wz(Math.min(ay, by))) - T / 2;
    const s1 = (horiz ? wx(Math.max(ax, bx)) : wz(Math.max(ay, by))) + T / 2;
    const ops = doors.filter((d) => d.o === (horiz ? 'h' : 'v') && Math.abs(d.c - c) < 0.02 && d.s > s0 && d.s < s1 && d.y0 >= y0 - 0.01 && d.y0 < y1 - 0.01);
    const grid = []; // 8 m pieces, for the decay cells
    for (let k = Math.ceil(s0 / 8) * 8; k < s1; k += 8) grid.push(k);
    const cuts = [s0, s1, ...grid, ...ops.flatMap((d) => [d.s - d.half, d.s + d.half])].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1];
      if (b - a < 1e-3) continue;
      const op = ops.find((d) => d.s - d.half <= a + 1e-4 && d.s + d.half >= b - 1e-4);
      const bot = op ? op.y0 + DOOR_H : y0;
      if (bot >= y1) continue;
      const [x0, z0, x1, z1] = horiz ? [a, c - T / 2, b, c + T / 2] : [c - T / 2, a, c + T / 2, b];
      // The shell sits back from the modules laid on it: 4 mm of gap flickers at a distance. Colliders keep the full wall.
      const [ix, iz] = horiz ? [0, SHELL_INSET] : [SHELL_INSET, 0];
      const framed = ops.filter((d) => d.kind !== 'open');
      const ra = framed.some((d) => Math.abs(d.s + d.half - a) < 1e-4) ? REVEAL_INSET : 0;
      const rb = framed.some((d) => Math.abs(d.s - d.half - b) < 1e-4) ? REVEAL_INSET : 0;
      const rt = op && framed.includes(op) ? REVEAL_INSET : 0;
      const [sx0, sz0, sx1, sz1] = horiz ? [x0 + ra, z0 + iz, x1 - rb, z1 - iz] : [x0 + ix, z0 + ra, x1 - ix, z1 - rb];
      const sy0 = f === 1 && !op ? STOREY_JOIN : bot + rt, sy1 = f === 0 ? STOREY_JOIN : y1;
      addBox('wall', sx0, sy0, sz0, sx1, sy1, sz1, { floorY: f * FH });
      wallRuns.push({ horiz, c, a, b, bot, y0: f * FH, f });
      solid(x0, z0, x1, z1, bot, y1);
    }
  }

  // ---------- Floors and ceilings ----------
  // Room 104 brings its own floor and ceiling modules: no plane there (the floor stays walkable).
  const [hx0, hz0] = toF0(1, CHAMBRE.x0, CHAMBRE.y0), [hx1, hz1] = toF0(1, CHAMBRE.x1, CHAMBRE.y1);
  const hole = { x0: wx(hx0), z0: wz(hz0), x1: wx(hx1), z1: wz(hz1) };
  const minus = (r, h) => {
    if (h.x0 >= r.x1 || h.x1 <= r.x0 || h.z0 >= r.z1 || h.z1 <= r.z0) return [r];
    return [
      { ...r, z1: h.z0 }, { ...r, z0: h.z1 },
      { x0: r.x0, x1: h.x0, z0: Math.max(r.z0, h.z0), z1: Math.min(r.z1, h.z1) },
      { x0: h.x1, x1: r.x1, z0: Math.max(r.z0, h.z0), z1: Math.min(r.z1, h.z1) },
    ].filter((q) => q.x1 - q.x0 > 1e-3 && q.z1 - q.z0 > 1e-3);
  };
  for (const f of [0, 1]) {
    for (const [a, b, c, d] of FLOORS[f]) {
      const r = { x0: wx(a), z0: wz(b), x1: wx(c), z1: wz(d) };
      const y = f * FH;
      surfaces.push({ ...r, h: () => y });
      for (const q of f === 1 ? minus(r, hole) : [r]) floorRects.push({ ...q, f }); // floor and ceiling modules: habillage.js
    }
  }
  // Roof over the one-storey annex (canteen, kitchen): seen from room 104's window.
  const roofTex = pixelTexture(32, 32, ({ rect, grime }) => { rect(0, 0, 32, 32, [58, 60, 58], 6); grime(12, 3, 0.4); });
  // It stops at the wall it shares with the storey above, whose floor lies at the same height.
  const roofZ0 = wz(30) - (T + 0.3) / 2, roofZ1 = wz(270);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(wx(399) - wx(160) + T + 0.3, 0.3, roofZ1 - roofZ0), new THREE.MeshLambertMaterial({ map: roofTex, color: 0x9a9a96 }));
  roof.position.set((wx(160) + wx(399)) / 2, FH - 0.15, (roofZ0 + roofZ1) / 2);
  scene.add(roof);

  // ---------- Stairwell ----------
  const sx0 = wx(STAIR.x0) + T / 2, sx1 = wx(STAIR.x1) - T / 2, sxm = wx(STAIR.xMid);
  const zL = wz(STAIR.yLanding), zH = wz(STAIR.yHalf), zN = wz(STAIR.yNorth), zS = wz(LIFT.y0) - T / 2;
  const half = FH / 2, rise = half / STAIR.steps, tread = (zL - zH) / STAIR.steps;
  geos.concrete.push(plane(sx0, zN, sx1, zS, 0, false));
  geos.ceil.push(plane(sx0, zN, sx1, zS, FH + CEIL, true, UV.ceil));
  // Landings start at the wall's centre line so the doorway has floor under it.
  surfaces.push({ x0: wx(STAIR.x0), z0: zL, x1: sx1, z1: zS, h: () => 0 }); // ground landing
  surfaces.push({ x0: wx(STAIR.x0), z0: zL, x1: sx1, z1: zS, h: () => FH }); // first-floor landing
  surfaces.push({ x0: sx0, z0: zN, x1: sx1, z1: zH, h: () => half }); // half landing
  surfaces.push({ x0: sx0, z0: zH, x1: sxm, z1: zL, h: (x, z) => ((zL - z) / (zL - zH)) * half }); // up, west lane
  surfaces.push({ x0: sxm, z0: zH, x1: sx1, z1: zL, h: (x, z) => half + ((z - zH) / (zL - zH)) * half }); // up, east lane
  // Flights and landings: Blockbench models. West flight climbs north from the ground, east flight climbs south from the half landing.
  placed.push(
    { file: 'stair_flight_lower', x: (sx0 + sxm - 0.05) / 2, y: 0, z: zL },
    { file: 'stair_flight_upper', x: (sxm + 0.05 + sx1) / 2, y: half, z: zH, ry: Math.PI },
    { file: 'stair_landing_half', x: (sx0 + sx1) / 2, y: 0, z: (zN + zH) / 2 },
    { file: 'stair_slab', x: (sx0 + sx1) / 2, y: FH - 0.3, z: (zL + zS) / 2 },
    { file: 'stair_guard', x: (sx0 + sxm) / 2, y: FH, z: zL },
    { file: 'stair_handrail', x: sx0 + 0.04, y: 0.9, z: zL },
    { file: 'stair_handrail', x: sx1 - 0.04, y: half + 0.9, z: zH, ry: Math.PI },
  );
  // Central wall between the two flights, wall closing the well to the north.
  addBox('wall', sxm - 0.05, 0, zH, sxm + 0.05, FH, zL, { floorY: 0 });
  addBox('wall', sxm - 0.05, FH, zH, sxm + 0.05, 2 * FH, zL, { floorY: FH });
  solid(sxm - 0.05, zH, sxm + 0.05, zL, 0, 2 * FH);
  addBox('wall', sx0, 0, zN - T, sx1, FH, zN, { floorY: 0 });
  addBox('wall', sx0, FH, zN - T, sx1, 2 * FH, zN, { floorY: FH });
  solid(sx0, zN - T, sx1, zN, 0, 2 * FH);
  // Railings: along the first-floor landing over the west flight, and handrails on the flights.
  solid(sx0, zL - 0.08, sxm, zL + 0.08, FH, FH + 1.0);
  // Big floor numbers painted on the landing walls.
  for (const [f, txt] of [[0, 'RDC'], [1, '1']]) {
    const tex = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = '#1e3a2c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d8d0b0'; ctx.font = `bold ${txt.length > 1 ? 26 : 44}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, w / 2, h / 2 + 2);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshLambertMaterial({ map: tex }));
    m.position.set(sx1 - 0.03, f * FH + 1.7, (zL + zS) / 2 + 0.4);
    m.rotation.y = -Math.PI / 2;
    scene.add(m);
  }
  fixtures.push({ pos: new THREE.Vector3((sx0 + sx1) / 2, CEIL - 0.1, (zL + zS) / 2), floor: 0, power: 0.8 });
  fixtures.push({ pos: new THREE.Vector3((sx0 + sx1) / 2, FH + CEIL - 0.1, (zL + zS) / 2), floor: 1, power: 0.8 });
  fixtures.push({ pos: new THREE.Vector3((sx0 + sx1) / 2, FH + CEIL - 0.1, (zN + zH) / 2), floor: 1, power: 0.6, flicker: true });

  // ---------- Swing doors ----------
  const plateTex = (text) => canvasTexture(128, 32, (ctx, w, h) => {
    text = text.replace(/^Chambre\s+(\d+)$/, '$1');
    ctx.fillStyle = '#d9d3bb'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#3a3a34'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.fillStyle = '#23231e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = 20; ctx.font = `bold ${size}px monospace`;
    while (ctx.measureText(text).width > w - 10 && size > 8) { size--; ctx.font = `bold ${size}px monospace`; }
    ctx.fillText(text, w / 2, h / 2 + 1);
  });
  const swingDoors = [];
  for (const d of doors) {
    if (d.kind === 'lift' || d.kind === 'open') continue;
    const frame = new THREE.Group(); // local x along the wall, local +z = world "into" side for into = +1
    if (d.o === 'h') frame.position.set(d.s, d.y0, d.c);
    else { frame.position.set(d.c, d.y0, d.s); frame.rotation.y = -Math.PI / 2; } // local +x → world +z, local +z → world -x
    scene.add(frame);
    const localInto = d.o === 'h' ? d.into : -d.into;
    const w = d.half * 2;
    const leaves = d.kind === 'double' ? [[-w / 2, w / 2, 1], [w / 2, w / 2, -1]] : [[-w / 2, w, 1]];
    const door = { d, frame, frameParts: [], open: 0, target: 0, leaves: [], name: d.name, into: localInto };
    const leafMeshes = [];
    for (const [hx, lw, dir] of leaves) {
      const pivot = new THREE.Group();
      pivot.position.set(hx, 0, -localInto * 0.06);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(lw - 0.02, DOOR_H - 0.02, 0.05), MAT.door[0]);
      leafMeshes.push(leaf);
      leaf.position.set(dir * lw / 2, DOOR_H / 2, 0);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.03), MAT.steel);
      handle.position.set(dir * (lw - 0.12), 1.0, 0.04 * localInto * -1);
      const handle2 = handle.clone(); handle2.position.z *= -1;
      pivot.add(leaf, handle, handle2);
      frame.add(pivot);
      // Open: the leaf turns towards the "into" side. Rotation θ sends local +x to (cos θ, 0, -sin θ).
      door.leaves.push({ pivot, dir, openAngle: -dir * localInto * Math.PI / 2 * 0.92 });
    }
    // Frame (jambs and head) in dark steel.
    const jamb = (x, wj) => { const m = new THREE.Mesh(new THREE.BoxGeometry(wj, DOOR_H + 0.06, T + 0.04), MAT.dark); m.position.set(x, DOOR_H / 2, 0); frame.add(m); door.frameParts.push(m); };
    jamb(-w / 2 - 0.02, 0.05); jamb(w / 2 + 0.02, 0.05);
    const head = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.06, T + 0.04), MAT.dark);
    head.position.set(0, DOOR_H + 0.03, 0); frame.add(head); door.frameParts.push(head);
    // Invisible volume to aim at, open or shut.
    const hit = new THREE.Mesh(new THREE.BoxGeometry(w, DOOR_H, T + 0.12), MAT.hit);
    hit.position.set(0, DOOR_H / 2, 0);
    frame.add(hit);
    // Name plate on the corridor side (the side the leaf does not swing to) and, for the stairs, an exit sign.
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.105), new THREE.MeshLambertMaterial({ map: plateTex(d.name) }));
    plate.position.set(w / 2 + 0.36, 1.55, -localInto * (T / 2 + 0.03));
    if (localInto > 0) plate.rotation.y = Math.PI;
    frame.add(plate);
    if (d.stair || d.name === 'Sortie') {
      const sign = new THREE.Group(); // Filled with the existing exit_sign asset during dressing.
      sign.position.set(0, DOOR_H + 0.22, -localInto * (T / 2 + 0.03));
      if (localInto > 0) sign.rotation.y = Math.PI;
      frame.add(sign);
      door.sign = sign;
    }
    // Collider while shut: the opening, in world space.
    const c = d.o === 'h'
      ? { x0: d.s - d.half, x1: d.s + d.half, z0: d.c - T / 2, z1: d.c + T / 2 }
      : { x0: d.c - T / 2, x1: d.c + T / 2, z0: d.s - d.half, z1: d.s + d.half };
    const col = { ...c, y0: d.y0, y1: d.y0 + DOOR_H, active: true };
    colliders.push(col);
    door.col = col;
    door.center = frame.position.clone().setY(d.y0 + 1.2);
    swingDoors.push(door);
    // Each door keeps its own pitch, spread evenly over the range, so no two neighbours sound alike.
    door.rate = 0.6 + ((swingDoors.length * 0.618034) % 1) * 0.75;
    door.tile = { group: frame, level: 0, apply: (l) => { for (const m of leafMeshes) m.material = MAT.door[l]; } };
    tiles.push(door.tile);
    interactables.push({
      obj: hit, range: 2.4, door,
      // h: { audio, toast, has(item), locked(door) } from hopital/jeu.js. A door with `need` opens once the item is held.
      label: (h) => (d.need && !door.unlocked && !h?.has?.(d.need) ? `${d.name} · porte verrouillée` : door.target ? 'Fermer la porte' : `Ouvrir : ${d.name}`),
      act: (h) => {
        if (d.need && !door.unlocked) {
          if (!h.has?.(d.need)) { h.audio?.locked(door.center, door.rate); h.locked?.(d); return; }
          door.unlocked = true;
          h.unlocked?.(d);
        }
        door.target = door.target ? 0 : 1;
        if (door.target) h.audio?.doorUnlock(door.center, door.rate); else h.audio?.doorClose(door.center, door.rate, 0.45);
        h.audio?.doorCreak(door.center, door.rate);
      },
    });
  }
  // Doors have weight: pushed, a leaf picks up speed, swings on and slows down by itself; it knocks softly against its
  // stop or its frame and rebounds a little before coming to rest. Each door is a little stiffer or looser than the next.
  for (const door of swingDoors) { door.v = 0; door.stiff = 0.85 + Math.random() * 0.3; }
  updaters.push((dt) => {
    for (const door of swingDoors) {
      if (door.open === door.target && !door.v) continue;
      const w = 6.2 * door.stiff, h = Math.min(dt, 1 / 30);
      door.v = (door.v ?? 0) + (w * w * (door.target - door.open) - 2 * 0.8 * w * door.v) * h;
      door.open += door.v * h;
      // The stop (open) and the frame (shut): a soft knock back.
      if (door.open > 1) { door.open = 2 - door.open; door.v = -Math.abs(door.v) * 0.25; }
      if (door.open < 0) { door.open = -door.open; door.v = Math.abs(door.v) * 0.2; }
      if (Math.abs(door.target - door.open) < 0.002 && Math.abs(door.v) < 0.03) { door.open = door.target; door.v = 0; }
      for (const l of door.leaves) l.pivot.rotation.y = l.openAngle * door.open;
      door.col.active = door.open < 0.6;
    }
  });

  // ---------- Reception desk: a curved counter in the entrance hall ----------
  const P = (k) => { const u = 1 - k; return [u * u * 322 + 2 * u * k * 328 + k * k * 358, u * u * 668 + 2 * u * k * 604 + k * k * 591]; };
  for (let i = 0; i < 10; i++) {
    const [ax, ay] = P(i / 10), [bx, by] = P((i + 1) / 10);
    const x0 = wx(ax), z0 = wz(ay), x1 = wx(bx), z1 = wz(by);
    solid(Math.min(x0, x1) - 0.22, Math.min(z0, z1) - 0.22, Math.max(x0, x1) + 0.22, Math.max(z0, z1) + 0.22, 0, 1.1);
  }
  placed.push({ file: 'reception_desk', x: wx(322), y: 0, z: wz(668) });

  // ---------- Lift ----------
  const lift = buildLift(scene, { doors: doors.filter((d) => d.kind === 'lift'), colliders, surfaces, interactables, plateTex });
  updaters.push(lift.update);
  fixtures.push(...lift.fixtures);

  // ---------- Light fixtures: a grid over each room ----------
  for (const f of [0, 1]) {
    for (const [a, b, c, d, , kind] of ROOMS[f]) {
      if (kind === 'none') continue;
      const [x0, y0] = toF0(f, a, b), [x1, y1] = toF0(f, c, d);
      const w = (x1 - x0) * S, h = (y1 - y0) * S;
      const step = kind === 'room' ? 5 : 4.5;
      const nx = Math.max(1, Math.round(w / step)), nz = Math.max(1, Math.round(h / step));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        fixtures.push({
          pos: new THREE.Vector3(wx(x0) + (i + 0.5) * w / nx, f * FH + CEIL - 0.04, wz(y0) + (j + 0.5) * h / nz),
          floor: f, power: kind === 'hall' ? 1 : kind === 'bright' ? 0.95 : 0.55, flicker: rnd() < 0.08, dead: kind === 'room' && rnd() < 0.15,
          reach: [w / nx / 2, h / nz / 2], // half its grid cell: the far glow (jeu.js) stays inside the room
        });
      }
    }
  }
  // Glowing panels (bloom does the rest); flickering ones get their own material.
  const panelGeo = [];
  const panelOn = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.5, 2.3) });
  const panelOff = new THREE.MeshBasicMaterial({ color: 0x3a3c3a });
  for (const fx of fixtures) {
    if (fx.noPanel) continue;
    const g = new THREE.BoxGeometry(1.2, 0.04, 0.3); g.translate(fx.pos.x, fx.pos.y + 0.02, fx.pos.z);
    if (fx.flicker || fx.dead) {
      fx.mesh = new THREE.Mesh(g, fx.dead ? panelOff : new THREE.MeshBasicMaterial({ color: panelOn.color.clone() }));
      scene.add(fx.mesh);
    } else panelGeo.push(g);
  }
  const panelBatch = panelGeo.length ? new THREE.Mesh(mergeGeometries(panelGeo), panelOn) : null;
  if (panelBatch) scene.add(panelBatch);

  // ---------- Merge the static geometry ----------
  // Walls, floors and ceilings are grouped by 8 m cell and floor: each cell is a decay slot.
  const cells = new Map();
  const center = new THREE.Vector3();
  for (const [kind, list] of Object.entries(geos)) {
    if (!list.length) continue;
    if (!DECAY.includes(kind)) {
      const m = new THREE.Mesh(mergeGeometries(list), MAT[kind]);
      m.receiveShadow = true;
      scene.add(m);
      occluders.push(m);
      continue;
    }
    for (const g of list) {
      g.computeBoundingBox();
      g.boundingBox.getCenter(center);
      const key = `${Math.floor(center.y / FH)}|${Math.floor(center.x / 8)}|${Math.floor(center.z / 8)}`;
      if (!cells.has(key)) cells.set(key, {});
      (cells.get(key)[kind] ??= []).push(g);
    }
  }
  for (const cell of cells.values()) {
    const group = new THREE.Group();
    scene.add(group);
    const meshes = Object.entries(cell).map(([kind, list]) => {
      const m = new THREE.Mesh(mergeGeometries(list), MAT[kind][0]);
      m.userData.kind = kind;
      m.receiveShadow = true;
      group.add(m);
      occluders.push(m);
      return m;
    });
    tiles.push({ group, level: 0, apply: (l) => { for (const m of meshes) m.material = MAT[m.userData.kind][l]; } });
  }

  // ---------- Room under a point ----------
  const roomRects = [0, 1].flatMap((f) => ROOMS[f].map(([a, b, c, d, name]) => {
    const [x0, y0] = toF0(f, a, b), [x1, y1] = toF0(f, c, d);
    return { f, x0: wx(x0), z0: wz(y0), x1: wx(x1), z1: wz(y1), name };
  }));
  function roomAt(x, y, z) {
    if (x > sx0 - T / 2 && x < sx1 + T / 2) {
      if (z > zS) return 'Ascenseur';
      if (z > zN) return 'Cage d\'escalier';
    }
    const f = y > FH / 2 ? 1 : 0;
    return roomRects.find((r) => r.f === f && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)?.name ?? null;
  }

  return {
    colliders, surfaces, interactables, fixtures, occluders, lift, swingDoors, roomAt, tiles, wallRuns, floorRects, hole, placed, panelBatch,
    update(dt, t, ctx) { for (const u of updaters) u(dt, t, ctx); },
  };
}

// ---------- Lift: cabin, sliding doors on each landing and on the cabin, call buttons, floor indicators ----------
function buildLift(scene, { doors, colliders, surfaces, interactables, plateTex }) {
  const x0 = wx(LIFT.x0) + T / 2, x1 = wx(LIFT.x1) - T / 2, z0 = wz(LIFT.y0) + T / 2, z1 = wz(LIFT.y1) - T / 2;
  const cx = (x0 + x1) / 2, cz = wz(LIFT.door);
  const DW = LIFT.doorW * S; // opening width
  const H = 2.3; // cabin height
  const SPEED = 0.9;
  const state = { y: 0, floor: 0, target: 0, mode: 'idle', doors: 1, wait: 0, queue: [], moving: false, v: 0 };

  // Pit and roof of the shaft.
  const shaft = new THREE.Group();
  scene.add(shaft);
  const pit = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, z1 - z0), MAT.dark);
  pit.position.set(cx, -0.35, (z0 + z1) / 2);
  const top = pit.clone(); top.position.y = 2 * FH - 0.1;
  shaft.add(pit, top);

  // Cabin.
  const cabin = new THREE.Group();
  cabin.position.set(cx, state.y, 0);
  scene.add(cabin);
  const cw = x1 - x0 - 0.04, cd = z1 - z0 - 0.04, czc = (z0 + z1) / 2;
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); cabin.add(mesh); return mesh; };
  const floorTexC = pixelTexture(16, 16, ({ rect }) => { rect(0, 0, 16, 16, [70, 72, 70], 4); for (let i = 0; i < 16; i += 4) rect(i, 0, 1, 16, [52, 54, 52]); });
  add(new THREE.Mesh(new THREE.BoxGeometry(cw, 0.12, cd), new THREE.MeshLambertMaterial({ map: floorTexC })), 0, -0.06, czc);
  add(new THREE.Mesh(new THREE.BoxGeometry(cw, 0.08, cd), MAT.steel), 0, H + 0.04, czc);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, H, cd), MAT.steel), cw / 2 - 0.025, H / 2, czc); // back (east)
  add(new THREE.Mesh(new THREE.BoxGeometry(cw, H, 0.05), MAT.steel), 0, H / 2, z0 + 0.045); // north
  add(new THREE.Mesh(new THREE.BoxGeometry(cw, H, 0.05), MAT.steel), 0, H / 2, z1 - 0.045); // south
  // Front (west) with the opening.
  const fx = -cw / 2 + 0.025;
  const sideN = (cz - DW / 2) - (z0 + 0.02), sideS = (z1 - 0.02) - (cz + DW / 2);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, H, sideN), MAT.steel), fx, H / 2, z0 + 0.02 + sideN / 2);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, H, sideS), MAT.steel), fx, H / 2, z1 - 0.02 - sideS / 2);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.05, H - DOOR_H, DW), MAT.steel), fx, DOOR_H + (H - DOOR_H) / 2, cz);
  // Handrail and ceiling light.
  add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, cd - 0.3), MAT.rail), cw / 2 - 0.1, 0.95, czc);
  const lamp = add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 1.0), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.0) })), 0, H - 0.01, czc);
  const cabinParts = cabin.children.filter((m) => m !== lamp);
  // Cabin doors: two panels that part.
  const cabDoors = [-1, 1].map((sgn) => add(new THREE.Mesh(new THREE.BoxGeometry(0.03, DOOR_H, DW / 2), MAT.steel), fx + 0.05, DOOR_H / 2, cz + sgn * DW / 4));

  // Button panel inside, beside the door.
  const btnTex = (txt, lit) => canvasTexture(32, 32, (ctx, w, h) => {
    ctx.fillStyle = '#8a8c88'; ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = lit ? '#ffcf6a' : '#3a3c3a'; ctx.beginPath(); ctx.arc(16, 16, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d0d2cc'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = lit ? '#3a2400' : '#f0ede0'; ctx.font = `bold ${txt.length > 1 ? 11 : 16}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 16, 17);
  }, false);
  // Open door leaves slide behind the controls: keep the panel beyond their inner face.
  const panel = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.22), MAT.dark), fx + 0.1, 1.2, cz + DW / 2 + 0.3);
  const buttonX = panel.position.x + 0.012;
  const buttons = [];
  for (const [f, txt, y] of [[1, '1', 1.33], [0, 'RDC', 1.2]]) {
    const tex = [btnTex(txt, false), btnTex(txt, true)];
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), new THREE.MeshBasicMaterial({ map: tex[0] }));
    b.rotation.y = Math.PI / 2;
    add(b, buttonX, y, cz + DW / 2 + 0.3);
    buttons.push({ f, mesh: b, tex });
    interactables.push({ obj: b, range: 1.6, label: () => (f ? 'Étage 1' : 'Rez-de-chaussée'), act: (h) => request(f, h) });
  }
  const alarm = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), new THREE.MeshBasicMaterial({ map: btnTex('!', false) }));
  alarm.rotation.y = Math.PI / 2;
  add(alarm, buttonX, 1.06, cz + DW / 2 + 0.3);
  interactables.push({ obj: alarm, range: 1.6, label: () => 'Alarme', act: (h) => { h.audio?.alarm(alarm.getWorldPosition(new THREE.Vector3())); h.toast?.('Personne ne répond.'); } });
  cabinParts.push(panel);

  // Landing doors, call buttons and floor indicators on each floor.
  const indicatorTex = ['RDC', '1'].map((t) => canvasTexture(64, 24, (ctx, w, h) => {
    ctx.fillStyle = '#100806'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff5a2a'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, w / 2, h / 2 + 1);
  }));
  const landings = doors.map((d) => {
    const f = d.f, y = f * FH;
    const g = new THREE.Group();
    scene.add(g);
    const panels = [-1, 1].map((sgn) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, DOOR_H, DW / 2), MAT.steel);
      m.position.set(d.c + T / 2 - 0.03, y + DOOR_H / 2, cz + sgn * DW / 4);
      g.add(m);
      return m;
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(T + 0.06, 0.08, DW + 0.16), MAT.dark);
    frame.position.set(d.c, y + DOOR_H + 0.04, cz);
    g.add(frame);
    const ind = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.135), new THREE.MeshBasicMaterial({ map: indicatorTex[state.floor], color: new THREE.Color(1.5, 1.5, 1.5) }));
    ind.position.set(d.c - T / 2 - 0.03, y + DOOR_H + 0.3, cz);
    ind.rotation.y = -Math.PI / 2;
    g.add(ind);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.105), new THREE.MeshLambertMaterial({ map: plateTex('Ascenseur') }));
    plate.position.set(d.c - T / 2 - 0.03, y + 1.55, cz + DW / 2 + 0.5);
    plate.rotation.y = -Math.PI / 2;
    g.add(plate);
    // Call button: a plate with one round button.
    const callTex = [false, true].map((lit) => btnTex(f ? '▼' : '▲', lit));
    const call = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ map: callTex[0], color: new THREE.Color(0.8, 0.8, 0.8) }));
    call.position.set(d.c - T / 2 - 0.04, y + 1.15, cz - DW / 2 - 0.3);
    call.rotation.y = -Math.PI / 2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.26, 0.17), MAT.steel);
    back.position.set(d.c - T / 2 - 0.0275 + 0.001, y + 1.15, cz - DW / 2 - 0.3);
    g.add(back, call);
    interactables.push({ obj: call, range: 1.8, label: (h) => (h?.liftOk && !h.liftOk() ? 'Ascenseur (clé du personnel requise)' : 'Appeler l\'ascenseur'), act: (h) => request(f, h, true) });
    const col = { x0: d.c - T / 2, x1: d.c + T / 2, z0: cz - DW / 2, z1: cz + DW / 2, y0: y, y1: y + DOOR_H, active: true };
    colliders.push(col);
    return { f, y, panels, frame, back, group: g, x: d.c, z: cz, ind, call, callTex, col, center: new THREE.Vector3(d.c, y + 1.2, cz) };
  });
  // The cabin floor is walkable wherever it is.
  surfaces.push({ x0: wx(LIFT.x0), z0, x1, z1, h: () => state.y });
  // Inside the cabin, its front wall stops the player while it travels (shaft walls do the rest).
  const cabCol = { x0: wx(LIFT.x0) - T / 2, x1: wx(LIFT.x0) + T / 2 + 0.08, z0: cz - DW / 2, z1: cz + DW / 2, y0: 0, y1: 0, active: false };
  colliders.push(cabCol);

  let ctx = {};
  function request(f, h, fromCall = false) {
    ctx = h;
    // The lift needs a staff key (Dr Morel's keyring): without it, the call button does nothing.
    if (fromCall && h.liftOk && !h.liftOk()) {
      const l = landings.find((x) => x.f === f);
      h.audio?.locked(l.call.getWorldPosition(new THREE.Vector3()));
      h.locked?.({ name: 'Ascenseur' });
      return;
    }
    const btn = fromCall ? landings.find((l) => l.f === f) : buttons.find((b) => b.f === f);
    h.audio?.click(btn.mesh?.getWorldPosition?.(new THREE.Vector3()) ?? btn.call.getWorldPosition(new THREE.Vector3()), 0.2);
    // Already at this floor (stopped, or its doors opening or closing): the doors open again, no empty trip.
    if (!state.moving && state.floor === f && state.mode !== 'moving') {
      if (state.doors < 1) { state.mode = 'opening'; }
      state.wait = 0;
      return;
    }
    if (state.queue.includes(f) || (state.moving && state.target === f)) return;
    state.queue.push(f);
    light(f, fromCall, true);
  }
  function light(f, fromCall, on) {
    if (fromCall) { const l = landings.find((x) => x.f === f); l.call.material.map = l.callTex[on ? 1 : 0]; l.lit = on; }
    else { const b = buttons.find((x) => x.f === f); b.mesh.material.map = b.tex[on ? 1 : 0]; b.lit = on; }
  }
  function lightsOff(f) {
    const l = landings.find((x) => x.f === f); l.call.material.map = l.callTex[0];
    const b = buttons.find((x) => x.f === f); b.mesh.material.map = b.tex[0];
  }

  const cabinPos = new THREE.Vector3();
  function update(dt, t, { player } = {}) {
    // Someone in the doorway keeps the doors open.
    const inDoorway = player && Math.abs(player.pos.z - cz) < DW / 2 + 0.1 && Math.abs(player.pos.x - (wx(LIFT.x0) + 0.1)) < 0.45 && Math.abs(player.y - state.y) < 0.5;
    if (state.mode === 'idle') {
      if (state.doors < 1) state.mode = 'opening';
      else if (state.queue.length) { state.wait += dt; if (state.wait > 0.6 && !inDoorway) { state.mode = 'closing'; } }
    }
    if (state.mode === 'opening') {
      state.doors = Math.min(1, state.doors + dt / 1.1);
      if (state.doors >= 1) { state.mode = 'idle'; state.wait = 0; }
    } else if (state.mode === 'closing') {
      if (inDoorway) { state.mode = 'opening'; }
      else {
        if (state.doors === 1) ctx.audio?.liftClose(landings[state.floor].center);
        state.doors = Math.max(0, state.doors - dt / 1.1);
        if (state.doors <= 0) {
          state.target = state.queue.shift();
          state.mode = 'moving'; state.moving = true;
          state.motor = ctx.audio?.liftRun(cabin.getWorldPosition(cabinPos));
        }
      }
    } else if (state.mode === 'moving') {
      const goal = state.target * FH, dir = Math.sign(goal - state.y), dist = Math.abs(goal - state.y);
      // Ease in and out: accelerate, cruise, slow down near the floor.
      const vmax = Math.min(SPEED, Math.sqrt(2 * 0.6 * dist) + 0.05);
      state.v = Math.min(vmax, state.v + 0.6 * dt);
      state.y += dir * Math.min(dist, state.v * dt);
      state.floor = state.y > FH / 2 ? 1 : 0;
      if (Math.abs(goal - state.y) < 1e-3) {
        state.y = goal; state.v = 0; state.moving = false; state.floor = state.target;
        state.mode = 'opening';
        lightsOff(state.target);
        state.motor?.(); state.motor = null;
        ctx.audio?.liftArrive(landings[state.floor].center);
      }
    }
    cabin.position.y = state.y;
    // Cabin doors and landing doors part together when the cabin is at that floor.
    const e = state.doors * state.doors * (3 - 2 * state.doors);
    cabDoors.forEach((m, i) => { m.position.z = cz + (i ? 1 : -1) * (DW / 4 + e * (DW / 2 - 0.04)); });
    for (const l of landings) {
      const here = !state.moving && state.floor === l.f;
      const k = here ? e : 0;
      l.panels.forEach((m, i) => { m.position.z = cz + (i ? 1 : -1) * (DW / 4 + k * (DW / 2 - 0.04)); });
      l.col.active = !(here && state.doors > 0.8);
      l.ind.material.map = indicatorTex[state.floor];
    }
    // While travelling, the cabin's own doorway is shut.
    cabCol.active = state.doors < 0.8;
    cabCol.y0 = state.y; cabCol.y1 = state.y + DOOR_H;
    // Hum and a slight shake while moving.
    state.shake = state.moving ? 0.004 * Math.min(1, state.v / SPEED) : 0;
    lamp.material.color.setScalar(2.2 + (state.moving ? Math.sin(t * 40) * 0.05 : 0));
  }

  return {
    state, update, cabin, landings, cabinParts, lamp, cabDoors, czc, panel,
    fixtures: [{ pos: new THREE.Vector3(cx, 0, czc), floor: -1, power: 0.7, noPanel: true, follow: () => state.y + H - 0.15 }],
  };
}
