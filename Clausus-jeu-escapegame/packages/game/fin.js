import * as THREE from 'three';
import { rnd, clamp01, smooth, pixelTexture, canvasTexture } from './util.js';
import { drift } from './motion.js';
import { loadModel } from './decor.js';
import { S, ORIGIN, FH, DOORS } from './hopital/plan.js';

// The way out: what lies beyond the hospital's main door ("Sortie", ground floor, south facade), and the closing
// sequence played when the player walks through it. Room coordinates, like main.js: ground floor at y = -FH.
// Outside, the courtyard ground is 0.3 m lower than the floor inside (world.js), hence the steps.
// Everything outside is unlit (MeshBasicMaterial): brightness is painted in, lightning scales it, and no light from
// here reaches the hospital's lit materials.

const EXIT_DOOR = DOORS.find((d) => d.name === 'Sortie');
export const EXIT = { x: (EXIT_DOOR.x - ORIGIN.x) * S, z: (EXIT_DOOR.y - ORIGIN.y) * S, half: 0.94 };
const FLOOR = -FH, GROUND = -3.6, FACE = EXIT.z + 0.13; // outer face of the south wall
const GATE_Z = EXIT.z + 19, ROAD_Z = GATE_Z + 5;
const EYE = 1.6;
const WATCH = new THREE.Vector3(EXIT.x + 3.6, 1.5, FACE + 0.02); // the lit window upstairs, someone in it

// ---------- Painted textures ----------
function facadeTexture(x0, x1, y0, y1, ppm) {
  const W = Math.round((x1 - x0) * ppm), H = Math.round((y1 - y0) * ppm);
  const X = (x) => (x - x0) * ppm, Y = (y) => (y1 - y) * ppm;
  const tex = canvasTexture(W, H, (ctx) => {
    ctx.fillStyle = '#34352f'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 14; i++) { ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.22})`; ctx.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
    // Rain streaks down from the sills and the roof edge.
    for (let i = 0; i < W / 3; i++) { ctx.fillStyle = `rgba(10,12,10,${0.08 + rnd() * 0.12})`; const x = rnd() * W; ctx.fillRect(x, 0, 1, H * (0.2 + rnd() * 0.8)); }
    // Floor band between the storeys, plinth, parapet.
    ctx.fillStyle = '#2a2b26'; ctx.fillRect(0, Y(0.05), W, 0.25 * ppm);
    ctx.fillStyle = '#1e1f1b'; ctx.fillRect(0, Y(GROUND + 0.45), W, 0.45 * ppm);
    ctx.fillStyle = '#1a1b18'; ctx.fillRect(0, 0, W, Y(FH + 0.1));
    // Windows, both storeys, barred. Left gaps for the door, the canopy and the stairwell.
    const win = (cx, base, lit) => {
      const wx = X(cx - 0.55), wy = Y(base + 2.1), ww = 1.1 * ppm, wh = 1.2 * ppm;
      ctx.fillStyle = '#121513'; ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 6);
      ctx.fillStyle = lit || '#0b0d0e'; ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = 'rgba(120,140,150,0.10)'; ctx.fillRect(wx, wy, ww, wh * 0.4);
      ctx.fillStyle = '#1a1c1c';
      for (let b = 1; b < 6; b++) ctx.fillRect(wx + b * ww / 6, wy, 2, wh);
      ctx.fillRect(wx, wy + wh / 2, ww, 2);
      ctx.fillStyle = '#4a4b44'; ctx.fillRect(wx - 4, wy + wh + 2, ww + 8, 3);
    };
    for (let x = x0 + 2; x < x1 - 1; x += 3.4) {
      if (Math.abs(x - EXIT.x) > 3.4) win(x, FLOOR + 0.9, rnd() > 0.9 ? '#3a3a2c' : null);
      if (Math.abs(x - WATCH.x) > 1.2) win(x, 0.9, rnd() > 0.92 ? '#46412c' : null);
    }
    // The watched window (lit separately, see below) and a dark gap behind the door.
    win(WATCH.x, 0.9, '#0b0d0e');
    ctx.clearRect(X(EXIT.x - EXIT.half - 0.04), Y(FLOOR + 2.15), (EXIT.half * 2 + 0.08) * ppm, 2.2 * ppm);
  });
  return tex;
}

function asphaltTexture() {
  const t = pixelTexture(64, 64, ({ rect, grime, ctx }) => {
    rect(0, 0, 64, 64, [40, 44, 47], 5);
    grime(14, 6, 0.55);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(150,170,190,${0.05 + rnd() * 0.08})`; ctx.fillRect(rnd() * 64, rnd() * 64, 1 + rnd() * 3, 1); }
  });
  return t;
}

// Soft round glow, for lamp heads, puddles of light, the window.
function glowTexture(r, g, b) {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, `rgba(${r},${g},${b},1)`); grd.addColorStop(0.35, `rgba(${r},${g},${b},0.35)`); grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
  }, false);
}

function skyTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#05070a'); g.addColorStop(0.55, '#0d1219'); g.addColorStop(0.78, '#1a222b'); g.addColorStop(0.86, '#141a20'); g.addColorStop(1, '#0a0d10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // The town, far off: low blocks, a few lit windows.
    let x = 0;
    while (x < w) {
      const bw = 6 + rnd() * 18, bh = 4 + rnd() * 14;
      ctx.fillStyle = '#07090b'; ctx.fillRect(x, h * 0.86 - bh, bw, bh + h * 0.2);
      for (let k = 0; k < bw * bh / 30; k++) if (rnd() > 0.6) { ctx.fillStyle = rnd() > 0.5 ? '#6b5a35' : '#4c5a52'; ctx.fillRect(Math.floor(x + 1 + rnd() * (bw - 2)), Math.floor(h * 0.86 - bh + 1 + rnd() * (bh - 2)), 1, 1); }
      x += bw + rnd() * 6;
    }
  });
}

// The dawn: a warm band low on the horizon, faded in at the very end.
function dawnTexture() {
  return canvasTexture(128, 64, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, 'rgba(120,80,60,0.35)'); g.addColorStop(0.85, 'rgba(200,130,80,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, false);
}

function windowFigureTexture() {
  return canvasTexture(64, 72, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 2, w / 2, h * 0.45, w * 0.7);
    g.addColorStop(0, '#f2d79a'); g.addColorStop(1, '#a8823e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Someone standing behind the glass, head and shoulders.
    ctx.fillStyle = '#0a0806';
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.38, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w / 2 - 17, h); ctx.quadraticCurveTo(w / 2 - 15, h * 0.52, w / 2, h * 0.5); ctx.quadraticCurveTo(w / 2 + 15, h * 0.52, w / 2 + 17, h); ctx.fill();
    // Bars in front.
    ctx.fillStyle = 'rgba(20,22,22,0.9)';
    for (let b = 1; b < 6; b++) ctx.fillRect(b * w / 6, 0, 2, h);
    ctx.fillRect(0, h / 2, w, 2);
  });
}

// A man in pyjamas seen from a first-floor window: pale stripes, dark hair, bare head. Drawn feet down.
function walkerTexture() {
  return canvasTexture(14, 36, (ctx) => {
    ctx.fillStyle = '#b9c2c4'; ctx.fillRect(3, 7, 8, 14); ctx.fillRect(3, 21, 3, 13); ctx.fillRect(8, 21, 3, 13); // jacket, trousers
    ctx.fillRect(1, 8, 2, 11); ctx.fillRect(11, 8, 2, 11); // arms, hanging
    ctx.fillStyle = '#7f8a8e'; for (const x of [5, 8]) ctx.fillRect(x, 7, 1, 14);
    ctx.fillStyle = '#c9a98f'; ctx.fillRect(5, 1, 4, 5); ctx.fillRect(3, 34, 3, 2); ctx.fillRect(8, 34, 3, 2); // head, bare feet
    ctx.fillStyle = '#1c1a18'; ctx.fillRect(5, 0, 4, 2);
  });
}

// ---------- The exterior ----------
// view: the same exterior seen from room 104's window (the lit window of the sequence is his: he watches himself
// leave). { at: outer face of the window, keepOut(x, z): world spots where a tree would stand in the hospital }.
// Built turned half a turn so that the watched window lands on room 104's; no facade, no watcher, no rain of its own.
export function createEnding(scene, { audio, view = null }) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  if (view) {
    group.rotation.y = Math.PI;
    group.position.set(view.at.x + WATCH.x, view.at.y - WATCH.y, view.at.z + WATCH.z);
  }
  const toWorld = (x, z) => (view ? [group.position.x - x, group.position.z - z] : [x, z]);
  const mats = []; // unlit materials brightened by lightning
  const basic = (opts, base = 1) => {
    const m = new THREE.MeshBasicMaterial(opts);
    m.userData.base = m.color.clone().multiplyScalar(base);
    m.color.copy(m.userData.base);
    mats.push(m);
    return m;
  };
  const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; group.add(o); return o; };
  const glow = (tex, size, x, y, z, opacity = 1) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.scale.set(size, size, 1); s.position.set(x, y, z); group.add(s); return s;
  };
  const pool = (tex, size, x, z, opacity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, GROUND + 0.012, z); group.add(m); return m;
  };
  const sodium = glowTexture(255, 176, 90), neon = glowTexture(200, 235, 215), warm = glowTexture(255, 210, 140);

  // Facade: the whole south side of the main block, two storeys and the parapet, with a hole at the door.
  const fx0 = -2.4, fx1 = 31.2, fy0 = GROUND, fy1 = FH + 0.6;
  if (!view) {
    const facade = add(new THREE.PlaneGeometry(fx1 - fx0, fy1 - fy0), basic({ map: facadeTexture(fx0, fx1, fy0, fy1, 24), alphaTest: 0.5 }, 0.8), (fx0 + fx1) / 2, (fy0 + fy1) / 2, FACE);
    facade.renderOrder = -1;
  }
  // This mirrored backdrop is seen from room 104. Its duplicate entrance lies inside the canteen:
  // keep the landing, canopy and posts only at the real south exit.
  const entrance = new THREE.Group();
  entrance.name = 'hospital_entrance';
  entrance.visible = !view;
  group.add(entrance);
  const addEntrance = (...args) => { const mesh = add(...args); entrance.add(mesh); return mesh; };
  // Steps: a landing at floor height under the canopy, two steps down to the courtyard.
  const concrete = basic({ map: pixelTexture(32, 32, ({ rect, grime }) => { rect(0, 0, 32, 32, [92, 92, 86], 7); grime(6, 4, 0.5); }) }, 0.5);
  const landD = 2.0;
  addEntrance(new THREE.BoxGeometry(6.2, FLOOR - GROUND, landD), concrete, EXIT.x, (FLOOR + GROUND) / 2, FACE + landD / 2);
  addEntrance(new THREE.BoxGeometry(6.2, 0.15, 0.32), concrete, EXIT.x, FLOOR - 0.075, FACE + landD + 0.16);
  addEntrance(new THREE.BoxGeometry(6.2, 0.15, 0.32), concrete, EXIT.x, GROUND + 0.075, FACE + landD + 0.32 + 0.16);
  // Canopy on two posts, a fluorescent tube under it, the hospital's name on its edge (the name is scratched out).
  const canopyZ = FACE + 2.6, canopyY = FLOOR + 2.95;
  const steelDark = basic({ color: 0x23262a });
  addEntrance(new THREE.BoxGeometry(6.6, 0.22, 2.7), steelDark, EXIT.x, canopyY, FACE + 1.35);
  for (const dx of [-3.0, 3.0]) addEntrance(new THREE.BoxGeometry(0.14, canopyY - GROUND, 0.14), steelDark, EXIT.x + dx, (canopyY + GROUND) / 2, canopyZ - 0.2);
  const nameTex = canvasTexture(330, 22, (ctx, w, h) => {
    ctx.fillStyle = '#d9d6c8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#20231f'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CENTRE HOSPITALIER', w * 0.36, h / 2 + 1);
    ctx.fillStyle = '#121310'; ctx.fillRect(w * 0.66, 4, w * 0.3, h - 8); // scratched out, like the name in the room
    for (let i = 0; i < 30; i++) { ctx.fillStyle = `rgba(80,60,40,${rnd() * 0.5})`; ctx.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 1); }
  });
  addEntrance(new THREE.PlaneGeometry(6.6, 0.22), basic({ map: nameTex }, 0.75), EXIT.x, canopyY, FACE + 2.701);
  const tubeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 2.3) });
  const tube = addEntrance(new THREE.BoxGeometry(1.4, 0.04, 0.08), tubeMat, EXIT.x, canopyY - 0.13, FACE + 1.2);
  const tubeGlow = glow(neon, 3.2, EXIT.x, canopyY - 0.25, FACE + 1.2, 0.55);
  const tubePool = pool(neon, 7, EXIT.x, FACE + 2.2, 0.32);
  entrance.add(tubeGlow, tubePool);
  tubePool.position.y = FLOOR + 0.012; // on the landing

  // Courtyard: wet asphalt, a lighter path to the gate, puddles.
  const asphalt = asphaltTexture(); asphalt.repeat.set(36, 24);
  const groundMesh = add(new THREE.PlaneGeometry(120, 80), basic({ map: asphalt }, 0.55), EXIT.x, GROUND, FACE + 40);
  groundMesh.rotation.x = -Math.PI / 2;
  const pathTex = pixelTexture(16, 16, ({ rect, ctx }) => { rect(0, 0, 16, 16, [86, 86, 80], 6); ctx.fillStyle = 'rgb(48,48,44)'; ctx.fillRect(0, 15, 16, 1); ctx.fillRect(15, 0, 1, 16); });
  pathTex.repeat.set(3, GATE_Z - FACE - landD);
  const path = add(new THREE.PlaneGeometry(2.6, GATE_Z - FACE - landD), basic({ map: pathTex }, 0.5), EXIT.x, GROUND + 0.006, (FACE + landD + GATE_Z) / 2);
  path.rotation.x = -Math.PI / 2;
  const puddleTex = canvasTexture(64, 32, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(140,160,180,0.55)';
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 3, 0, 0, Math.PI * 2); ctx.fill();
  }, false);
  const puddleMat = new THREE.MeshBasicMaterial({ map: puddleTex, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [x, z, s] of [[12.6, FACE + 6, 1.6], [16.2, FACE + 9.5, 2.2], [13.4, FACE + 14, 1.3], [8, FACE + 8, 2.6], [21, FACE + 12, 1.8]]) {
    const p = add(new THREE.PlaneGeometry(s * 2, s), puddleMat, x, GROUND + 0.01, z); p.rotation.x = -Math.PI / 2; p.rotation.z = rnd() * 3;
  }

  // Fence along the street, an open gate on the path, a lamp on each gate pillar.
  const fenceMat = basic({ color: 0x15181a });
  const bars = [];
  for (let x = fx0 - 12; x < fx1 + 12; x += 0.16) if (Math.abs(x - EXIT.x) > 1.9) bars.push(x);
  const barGeo = new THREE.BoxGeometry(0.03, 2.1, 0.03);
  const barsMesh = new THREE.InstancedMesh(barGeo, fenceMat, bars.length);
  const m4 = new THREE.Matrix4();
  bars.forEach((x, i) => barsMesh.setMatrixAt(i, m4.makeTranslation(x, GROUND + 1.05, GATE_Z)));
  group.add(barsMesh);
  for (const [a, b] of [[fx0 - 12, EXIT.x - 1.9], [EXIT.x + 1.9, fx1 + 12]]) for (const y of [0.15, 1.95]) add(new THREE.BoxGeometry(b - a, 0.05, 0.05), fenceMat, (a + b) / 2, GROUND + y, GATE_Z);
  const brick = basic({ map: pixelTexture(16, 16, ({ rect, ctx }) => { rect(0, 0, 16, 16, [90, 52, 40], 10); ctx.fillStyle = 'rgb(40,32,28)'; for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1); }) }, 0.55);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.5, 2.5, 0.5), brick, EXIT.x + s * 2.1, GROUND + 1.25, GATE_Z);
    add(new THREE.BoxGeometry(0.22, 0.28, 0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.8) }), EXIT.x + s * 2.1, GROUND + 2.64, GATE_Z);
    glow(sodium, 1.6, EXIT.x + s * 2.1, GROUND + 2.64, GATE_Z, 0.8);
    pool(sodium, 4.5, EXIT.x + s * 2.1, GATE_Z, 0.22);
    // Gate leaf, left swung open into the courtyard.
    const leaf = new THREE.Group(); leaf.position.set(EXIT.x + s * 1.85, GROUND, GATE_Z); leaf.rotation.y = s * (Math.PI / 2 - 0.35); group.add(leaf);
    for (let k = 0; k < 11; k++) { const b = new THREE.Mesh(barGeo, fenceMat); b.position.set(-s * (0.08 + k * 0.16), 1.05, 0); leaf.add(b); }
    for (const y of [0.15, 1.95]) { const r = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.05, 0.05), fenceMat); r.position.set(-s * 0.87, y, 0); leaf.add(r); }
  }
  // Road beyond, street lamps along it, the town on the horizon.
  const roadTex = pixelTexture(32, 32, ({ rect, ctx }) => { rect(0, 0, 32, 32, [30, 32, 35], 4); ctx.fillStyle = 'rgb(140,140,120)'; ctx.fillRect(0, 15, 14, 2); });
  roadTex.repeat.set(30, 1);
  const road = add(new THREE.PlaneGeometry(160, 7), basic({ map: roadTex }, 0.6), EXIT.x, GROUND + 0.008, ROAD_Z + 0.5);
  road.rotation.x = -Math.PI / 2;
  const LAMPS = [];
  for (let x = EXIT.x - 60; x <= EXIT.x + 60; x += 15) LAMPS.push([x + 5, ROAD_Z - 3.6]);
  const lampGlows = LAMPS.map(([x, z]) => { pool(sodium, 9, x, z + 1.2, 0.3); return glow(sodium, 2.4, x, GROUND + 5.2, z + 0.9, 0.9); });
  const sky = add(new THREE.PlaneGeometry(420, 90), new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false, depthWrite: false }), EXIT.x, GROUND + 20, ROAD_Z + 70, Math.PI);
  sky.renderOrder = -2;
  const dawnMat = new THREE.MeshBasicMaterial({ map: dawnTexture(), fog: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const dawn = add(new THREE.PlaneGeometry(420, 30), dawnMat, EXIT.x - 40, GROUND + 9, ROAD_Z + 69, Math.PI);
  dawn.renderOrder = -1;

  // The lit window upstairs, someone standing in it.
  // From his own window, he is the one standing in it: nothing to draw.
  const watch = view ? null : add(new THREE.PlaneGeometry(1.1, 1.2), new THREE.MeshBasicMaterial({ map: windowFigureTexture(), color: new THREE.Color(1.3, 1.2, 1.0) }), WATCH.x, WATCH.y, WATCH.z);
  const watchGlow = view ? null : glow(warm, 3.2, WATCH.x, WATCH.y, WATCH.z + 0.3, 0.35);
  // Seen from the room, once he is far gone: a man in pyjamas comes out from under the canopy and walks to the gate.
  // Himself, another night. Nothing says so.
  const walker = view ? new THREE.Sprite(new THREE.SpriteMaterial({ map: walkerTexture(), transparent: true, depthWrite: false, color: new THREE.Color(0.6, 0.62, 0.65) })) : null;
  const walk = { t: -1, wait: 6 };
  if (walker) { walker.center.set(0.5, 0); walker.scale.set(0.68, 1.75, 1); walker.visible = false; group.add(walker); }
  function updateWalker(dt, sanityLoss) {
    const SECONDS = 24, z0 = FACE + 2.8, z1 = GATE_Z + 1;
    if (walk.t < 0) {
      if (sanityLoss > 0.45 && (walk.wait -= dt) <= 0) walk.t = 0;
      return;
    }
    walk.t += dt;
    const k = walk.t / SECONDS;
    if (k >= 1) { walk.t = -1; walk.wait = 40 + rnd() * 35; walker.visible = false; return; }
    walker.visible = true;
    walker.position.set(EXIT.x + Math.sin(k * 9) * 0.08 + drift(walk.t * 0.4, 54) * 0.05, GROUND + Math.abs(Math.sin(walk.t * 4.5 + drift(walk.t * 0.5, 55) * 0.4)) * 0.025, z0 + (z1 - z0) * k);
    walker.material.opacity = Math.min(1, Math.min(k, 1 - k) * 14);
  }

  // Rain around the camera.
  const RAIN = 1400, rainPos = new Float32Array(RAIN * 6), BOX = { w: 26, h: 12, d: 26 };
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0x8c98a6, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  if (!view) group.add(rain);
  const center = new THREE.Vector3();
  const underCanopy = (x, z) => Math.abs(x - EXIT.x) < 3.3 && z < FACE + 2.7;
  // Only outside the south facade: the box follows the camera, which may still be in the hall behind the door.
  const spawnDrop = (i, anyY) => {
    const z0 = Math.max(center.z - BOX.d / 2, FACE + 0.05), z1 = Math.max(center.z + BOX.d / 2, z0);
    const x = center.x + (rnd() - 0.5) * BOX.w, z = z0 + rnd() * (z1 - z0);
    const y = center.y - 3 + (anyY ? rnd() * BOX.h : BOX.h);
    rainPos.set([x, y, z, x + 0.03, y + 0.35, z], i * 6);
  };

  // Things from the team's models: street lamps, trees, a wheelchair left on the forecourt.
  async function load(loader) {
    const place = async (file, x, z, ry = 0, s = 1, base = 0.7) => {
      const m = await loadModel(loader, file);
      m.traverse((o) => { if (o.isMesh) o.material = o.name === 'lamp_head' ? new THREE.MeshBasicMaterial({ color: new THREE.Color(10, 5.5, 1.6) }) : basic({ map: o.material.map, color: o.material.color }, base); });
      m.position.set(x, GROUND, z); m.rotation.y = ry; m.scale.setScalar(s);
      group.add(m);
      return m;
    };
    const jobs = LAMPS.map(([x, z], i) => place('props/street_lamp', x, z, Math.PI, 1, 0.6).then((m) => {
      // Move the glow onto the model's head.
      const head = m.getObjectByName('lamp_head');
      if (head) { m.updateMatrixWorld(true); head.getWorldPosition(lampGlows[i].position); }
    }));
    for (const [x, z, s] of [[5.5, GATE_Z - 3, 1.2], [24, GATE_Z - 2.5, 1.4], [-1, GATE_Z - 6, 1.0], [30, GATE_Z - 7, 1.3]]) {
      if (view?.keepOut(...toWorld(x, z))) continue; // seen from the room, it would grow through the canteen
      jobs.push(place('props/tree', x, z, rnd() * 6, s, 0.35));
    }
    jobs.push(place('props/wheelchair', EXIT.x + 3.4, FACE + 5.2, 2.4, 1, 0.55));
    await Promise.all(jobs.map((j) => j.catch(() => null)));
    noFog();
  }

  // Seen from the room, through the fog of the hospital: like world.js's old view, the fog stays off.
  const noFog = () => { if (view) group.traverse((o) => { if (o.material) o.material.fog = false; }); };
  noFog();

  // ---------- The closing sequence ----------
  // Keys: t (s), camera position, yaw / pitch (yaw 0 looks towards -z, unwrapped so turns go the intended way).
  const run = { cues: {}, active: false, t: 0, dt: 1 / 60, keys: null, calm: 0, skip: false, events: [], done: null, stepDist: 0, last: new THREE.Vector3(), dawn: 0, rain: 1 };
  const ground = (z) => (z < FACE + landD ? FLOOR : z < FACE + landD + 0.64 ? FLOOR + (GROUND - FLOOR) * (z - FACE - landD) / 0.64 : GROUND);
  function keyAt(t, x, z, yaw, pitch, hold = false) { return { t, x, y: ground(z) + EYE, z, yaw, pitch, hold }; }

  // Hermite interpolation through the keys (Catmull-Rom tangents, zero at holds and both ends).
  function sample(t) {
    const K = run.keys;
    if (t <= K[0].t) return K[0];
    if (t >= K[K.length - 1].t) return K[K.length - 1];
    let i = 0;
    while (K[i + 1].t < t) i++;
    const a = K[i], b = K[i + 1], h = b.t - a.t, u = (t - a.t) / h;
    const tan = (k, ch) => {
      const P = K[k - 1], N = K[k + 1];
      if (!P || !N || K[k].hold) return 0;
      return (N[ch] - P[ch]) / (N.t - P.t);
    };
    const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
    const out = {};
    for (const ch of ['x', 'y', 'z', 'yaw', 'pitch']) out[ch] = h00 * a[ch] + h10 * h * tan(i, ch) + h01 * b[ch] + h11 * h * tan(i + 1, ch);
    return out;
  }

  // from: { x, y, z } eye position, yaw, pitch. cues: callbacks into main.js.
  function play(from, cues) {
    const PI = Math.PI;
    let yaw0 = from.yaw;
    while (yaw0 - PI > PI) yaw0 -= 2 * PI;
    while (yaw0 - PI < -PI) yaw0 += 2 * PI;
    const back = PI * 2 - Math.atan2(WATCH.x - (EXIT.x + 0.4), (EXIT.z + 11) - WATCH.z); // looking back up at the window
    const k0 = { t: 0, x: from.x, y: from.y, z: from.z, yaw: yaw0, pitch: from.pitch, hold: false };
    run.keys = [
      k0,
      keyAt(2.4, EXIT.x, FACE + 1.3, PI, 0.12),
      keyAt(4.6, EXIT.x + 0.1, FACE + 3.4, PI + 0.05, -0.05),
      keyAt(8.6, EXIT.x + 0.4, EXIT.z + 10.2, PI - 0.04, 0.0),
      keyAt(10.2, EXIT.x + 0.4, EXIT.z + 11, PI + 1.0, 0.1),
      keyAt(11.6, EXIT.x + 0.4, EXIT.z + 11, back, 0.3, true),
      keyAt(15.4, EXIT.x + 0.4, EXIT.z + 11.1, back + 0.04, 0.29, true),
      keyAt(17.4, EXIT.x + 0.3, EXIT.z + 12.2, PI + 0.1, 0.02),
      keyAt(23.0, EXIT.x, GATE_Z + 0.6, PI, 0.04),
      keyAt(27.0, EXIT.x - 0.4, ROAD_Z + 0.4, PI - 1.1, 0.1, true),
    ];
    run.events = [
      [0.6, cues.thought1], [2.5, cues.doorShut], [4.2, cues.thought2], [13.2, cues.lightning], [13.5, () => { watch.visible = false; watchGlow.visible = false; cues.watcherGone?.(); }],
      [14.6, cues.thought3], [19.5, cues.chord], [25.0, cues.fadeOut], [28.0, () => finish()],
    ];
    run.cues = cues;
    run.t = 0; run.calm = 0; run.dawn = 0; run.rain = 1; run.active = true; run.skip = false;
    run.last.set(from.x, from.y, from.z);
    if (watch) { watch.visible = true; watchGlow.visible = true; }
    return new Promise((r) => { run.done = r; });
  }
  function finish() {
    if (!run.active) return;
    run.active = false;
    run.finished = true; // the camera holds the last view, behind the report
    run.events = [];
    run.done?.();
  }
  // Skipped: a quick fade, then straight to the report.
  function skip() {
    if (!run.active || run.t < 1.2 || run.skip) return;
    run.skip = true;
    run.events = [[run.t, () => run.cues.fadeOut?.(0.8)], [run.t + 0.9, finish]];
  }

  function cameraAt(camera, t) {
    const s = sample(run.t);
    const moved = Math.hypot(s.x - run.last.x, s.z - run.last.z);
    run.last.set(s.x, s.y, s.z);
    // The stride follows the ground covered: one footfall every 0.7 m, heard (wet steps) when the head is lowest.
    const before = Math.floor(run.stepDist / 0.7);
    run.stepDist += moved;
    if (Math.floor(run.stepDist / 0.7) > before) audio.wetStep();
    // How much he walks (from the speed, not the distance per frame, which depends on the frame rate), smoothed.
    const speed = Math.min(1, moved / Math.max(run.dt, 1e-3) / 1.2);
    run.walk = (run.walk ?? 0) + (speed - (run.walk ?? 0)) * Math.min(1, run.dt * 4);
    const ph = (run.stepDist / 0.7) * Math.PI, w = run.walk;
    const bob = (0.4 - (1 - Math.abs(Math.cos(ph)))) * 0.03 * w, side = Math.sin(ph) * 0.014 * w;
    // Side to side over each foot, and a head that looks around a little, breathing in the cold.
    camera.position.set(s.x + Math.cos(s.yaw) * side, s.y + bob + Math.sin(t * 1.3) * 0.003, s.z - Math.sin(s.yaw) * side);
    camera.rotation.set(
      s.pitch + drift(t * 0.3, 51) * 0.012 + bob * 0.15,
      s.yaw + drift(t * 0.22, 52) * 0.018,
      drift(t * 0.27, 53) * 0.006 + Math.sin(ph) * 0.007 * w,
      'YXZ',
    );
  }

  // Called every frame. playerOut: how far outside the player is (0 inside, 1 out), for the fog and the rain.
  function update(dt, t, { flash, camera, player, paused, rainOn = true, hidden = false, sanityLoss = 0 }) {
    const near = player.y < -1.5 && player.pos.z > EXIT.z - 8;
    group.visible = view ? !hidden : run.active || run.finished || near;
    if (run.active && !paused) {
      run.t += dt; run.dt = dt;
      while (run.events.length && run.events[0][0] <= run.t) run.events.shift()[1]?.();
      run.calm = smooth(clamp01((run.t - 2) / 20));
      run.dawn = smooth(clamp01((run.t - 18) / 8));
      run.rain = 1 - 0.55 * smooth(clamp01((run.t - 15) / 10));
    }
    if (!group.visible) return 0;
    const k = 1 + flash * 4;
    for (const m of mats) m.color.copy(m.userData.base).multiplyScalar(k);
    // The tube under the canopy stutters now and then.
    const on = Math.sin(t * 9.1) * Math.sin(t * 2.3) < 0.82;
    tubeMat.color.setRGB(2.2, 2.6, 2.3).multiplyScalar(on ? 1 : 0.15);
    tubeGlow.material.opacity = on ? 0.55 : 0.05; tubePool.material.opacity = on ? 0.32 : 0.04;
    for (const g of lampGlows) g.material.opacity = 0.75 + 0.1 * Math.sin(t * 3 + g.position.x);
    if (view) { if (!paused) updateWalker(dt, sanityLoss); return 0; }
    watchGlow.material.opacity = 0.3 + 0.05 * Math.sin(t * 7) + flash * 0.4;
    dawnMat.opacity = run.dawn * 0.9;
    rainMat.opacity = 0.5 * run.rain;
    rain.visible = rainOn;
    // Rain follows the camera.
    camera.getWorldPosition(center);
    if (center.distanceToSquared(rain.userData.c ?? center) > 200 || !rain.userData.c) { rain.userData.c = center.clone(); for (let i = 0; i < RAIN; i++) spawnDrop(i, true); }
    if (!paused) {
      const v = 10 * dt, p = rainPos;
      for (let i = 0; i < RAIN; i++) {
        const o = i * 6;
        p[o + 1] -= v; p[o + 4] -= v; p[o] -= 0.9 * dt; p[o + 3] -= 0.9 * dt;
        const floor = underCanopy(p[o], p[o + 2]) ? canopyY : GROUND;
        if (p[o + 1] < floor || Math.abs(p[o] - center.x) > BOX.w / 2 || Math.abs(p[o + 2] - center.z) > BOX.d / 2) spawnDrop(i, false);
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    // How much the player is outside: through the door and past it.
    return run.active || run.finished ? 1 : clamp01((camera.position.z - EXIT.z + 0.4) / 2.5);
  }

  return {
    group, load, play, update, skip, walker,
    /** Sends the man in pyjamas down the path now (window view only). */
    walkNow() { if (walker && walk.t < 0) walk.t = 0; },
    get active() { return run.active; },
    /** The sequence holds the camera: while it plays, and on its last view afterwards. */
    get driving() { return run.active || !!run.finished; },
    get calm() { return run.calm; },
    get t() { return run.t; },
    get rain() { return run.rain; },
    camera: cameraAt,
    /** Hands the camera back (the story goes on after the walk out). */
    release() { run.active = false; run.finished = false; run.calm = 0; run.rain = 1; run.dawn = 0; run.events = []; },
  };
}

// ---------- The report ----------
// The night as a hospital form: the staff's report on the patient of room 104, typed line by line, with the doctor's
// note in pen and a stamp. kind: 'dream' (through the exit gate, then awake in room 104), 'caught' (the staff
// downstairs), 'sanity' (collapsed).
// stats: { time (s), clock ('03:41'), hints, errors, pillsTaken, sanity (0..1, when it ended), pseudo, where,
//   steps: [[label, done]…] (the story so far), escape: { seconds, score, cheated } | null (hospital exit, leaderboard) }.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const duration = (s) => `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`;

// The doctor's mark for the whole night: help, mistakes, pills, time, what was left of the mind.
export function grade({ time, hints, errors, pillsTaken, sanity }) {
  const score = Math.round(100 - 10 * hints - 4 * errors - 3 * pillsTaken - Math.max(0, time / 60 - 25) + 15 * sanity);
  return score >= 95 ? 'A' : score >= 78 ? 'B' : score >= 58 ? 'C' : 'D';
}

const KINDS = {
  dream: { title: 'VOUS ÊTES SORTI', form: 'Fiche d\'incident · Sortie non autorisée', stamp: 'SORTI', won: true },
  caught: { title: 'RATTRAPÉ', form: 'Rapport d\'incident · Patient intercepté au rez-de-chaussée', stamp: 'RÉINTÉGRÉ' },
  sanity: { title: 'VOUS AVEZ PERDU PIED', form: 'Rapport d\'incident · Patient retrouvé inconscient', stamp: 'RÉINTÉGRÉ' },
};

function doctorNote(kind, s) {
  if (kind === 'caught') {
    return s.blouse ? 'En blouse de médecin, il s\'est trahi lui-même. Sédatif administré. Changer les codes.'
      : `Reconnu en pyjama (${s.where}). Sédatif administré. Changer les codes.`;
  }
  if (kind === 'sanity') {
    if (!s.leftRoom) return 'N\'a pas quitté sa chambre. Sédation, retour au lit.';
    return `Retrouvé au sol (${s.where}). Il savait où il allait. Surveillance renforcée.`;
  }
  const how = s.hints === 0 && s.errors === 0 ? 'Aucun appel, aucune erreur : il a tout compris seul.'
    : s.sanity < 0.2 ? 'Sorti à bout de forces.'
      : s.hints >= 3 ? `${plural(s.hints, 'appel', 'appels')} depuis les cabines. Quelqu'un l'a guidé.`
        : s.errors >= 3 ? `${plural(s.errors, 'code erroné', 'codes erronés')} aux postes. Obstiné.`
          : 'Évasion méthodique.';
  // He woke up in his bed: a dream? The form says otherwise.
  return `${how} Retrouvé à 6 h dans son lit, chambre 104. Ses chaussures étaient trempées.`;
}

// online: { publish: bool (show the publish button), board: bool (show the leaderboard button) }. main.js wires them.
export function showReport(el, { kind, stats: s, audio, onRestart, onMenu, online = {} }) {
  const K = KINDS[kind] ?? KINDS.sanity;
  const patient = s.pseudo ? esc(s.pseudo) : 'inconnu';
  const sanityPct = Math.round(s.sanity * 100);
  const check = (ok) => `<span class="ck ${ok ? 'ok' : ''}">${ok ? '✔' : '✘'}</span>`;
  const room = s.escape ? [['Hôpital quitté en', `${duration(s.escape.seconds)} · <b>${s.escape.score} pts</b>${s.escape.cheated ? ' <i>(non classé)</i>' : ''}`]] : [];
  const rows = K.won
    ? [
      ['Heure constatée', s.clock],
      ['Durée de l\'évasion', duration(s.time)],
      ...room,
      ['Appels passés (indices)', s.hints],
      ['Codes erronés', s.errors],
      ['Cachets pris', s.pillsTaken],
      ['État mental à la sortie', `<span class="gauge"><i style="width:${sanityPct}%"></i></span> ${sanityPct} %`],
    ]
    : [
      ['Heure constatée', s.clock],
      ['Lieu', esc(s.where)],
      ['Temps écoulé', duration(s.time)],
      ...s.steps.map(([label, ok]) => [label, check(ok)]),
      ...room,
      ['Appels · erreurs · cachets', `${s.hints} · ${s.errors} · ${s.pillsTaken}`],
    ];
  el.innerHTML = `
    <div class="rp-head">
      <h1>${K.title}</h1>
    </div>
    <div class="rp-sheet ${K.won ? 'won' : 'lost'}">
      <div class="rp-top"><span>CENTRE HOSPITALIER <s>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</s></span><span>AILE B · NUIT DU 02 AU 03/11</span></div>
      <div class="rp-title">${K.form}</div>
      <div class="rp-who">Patient : <b>${patient}</b> &nbsp;·&nbsp; Chambre 104</div>
      <table>${rows.map(([k, v]) => `<tr class="rp-line"><td>${k}</td><td class="dots"></td><td class="v">${v}</td></tr>`).join('')}</table>
      <div class="rp-foot">
        <div class="rp-note"><span class="lbl">Observations du médecin de garde :</span><div class="hand">${esc(doctorNote(kind, s))}</div></div>
        ${K.won ? `<div class="rp-grade"><span class="lbl">Évaluation</span><span class="ring">${grade(s)}</span></div>` : ''}
      </div>
      <div class="rp-stamp">${K.stamp}</div>
    </div>
    <div class="rp-btns">
      ${online.publish || online.board ? `<div class="endbtns">${online.publish ? '<button class="mb" id="endPublish"></button>' : ''}${online.board ? '<button class="mb" id="endBoard">Classement</button>' : ''}</div>` : ''}
      <div class="endbtns"><button class="mb primary" id="endRestart">${K.won ? 'Rejouer' : 'Réessayer'}</button><button class="mb" id="endMenu">Menu principal</button></div>
    </div>
    <div class="rp-help">${K.won ? 'Merci d\'avoir joué. ' : ''}Si vous traversez une période difficile, parlez-en. En France, le <b>3114</b> répond 24 h/24.</div>`;
  el.classList.add('report');
  el.classList.remove('hidden');
  el.querySelector('#endRestart').onclick = onRestart;
  el.querySelector('#endMenu').onclick = onMenu;

  // Reveal: the sheet slides in, the lines are typed one by one, then the note, the grade and the stamp.
  const lines = [...el.querySelectorAll('.rp-line')];
  const steps = [
    [0, () => el.classList.add('in')],
    [700, () => el.querySelector('.rp-sheet').classList.add('in')],
    ...lines.map((line, i) => [1500 + i * 320, () => { line.classList.add('in'); for (let k = 0; k < 5; k++) setTimeout(() => audio.typeKey?.(), k * 45); if (i === lines.length - 1) setTimeout(() => audio.typeBell?.(), 320); }]),
  ];
  let at = 1500 + lines.length * 320 + 250;
  steps.push([at, () => { el.querySelector('.rp-note').classList.add('in'); audio.pen?.(); }]);
  if (K.won) steps.push([at += 1100, () => { el.querySelector('.rp-grade').classList.add('in'); audio.pen?.(); }]);
  steps.push([at += 800, () => { el.querySelector('.rp-stamp').classList.add('in'); audio.stamp?.(); }]);
  steps.push([at += 500, () => el.querySelector('.rp-btns').classList.add('in')]);
  const timers = steps.map(([ms, f]) => setTimeout(f, ms));
  // A click on the sheet shows everything at once.
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    timers.forEach(clearTimeout);
    el.classList.add('in');
    el.querySelectorAll('.rp-sheet, .rp-line, .rp-note, .rp-grade, .rp-stamp, .rp-btns').forEach((n) => n.classList.add('in'));
  }, { once: true });
}
