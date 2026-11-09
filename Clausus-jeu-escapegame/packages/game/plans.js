import * as THREE from 'three';
import { WALLS, DOORS, ROOMS, STAIR, LIFT, S, ORIGIN, toF0 } from './hopital/plan.js';
import { mat } from './util.js';

// Evacuation plans (the regulatory "plan d'évacuation" on the wall of every floor), one per floor: drawn from the same
// plan as the building (hopital/plan.js). Taken off the wall, the floor's plan becomes the HUD's minimap, top right.
// The map stays still, north up as on the poster; only the player's arrow moves and turns.
// All drawing is in ground-floor pixels of the plan (the first floor's are shifted by toF0).

const BOUNDS = { 0: [74, 24, 523, 675], 1: [72, 264, 523, 676] }; // x0, y0, x1, y1 with a margin
export const PLAN_TITLE = { 0: 'Rez-de-chaussée', 1: 'Niveau 1' };
const C = {
  paper: '#f3f0e4', room: '#ddd8c8', hall: '#f9f7ef', wall: '#26251f', text: '#3a382e', well: '#bdb8a8',
  green: '#1f8a4c', red: '#c8261e',
};
// Room names as a safety plan prints them: numbers, and the common rooms by name.
const SHORT = {
  'Cabinet Dr W. Morel 007': '007', 'Pharmacie 009': 'Pharmacie', 'Pharmacie 009 (réserve)': '', 'Salle de réunion 008': 'Réunion',
  'Poste de sécurité 001': 'Sécurité', 'Chambre 104': '104', 'Chambre 102': '102', 'WC Hommes': 'WC', 'WC Femmes': 'WC',
  Couloir: '', Hall: '',
};
// Evacuation routes (green dashes), in ground-floor pixels: along the corridors to the stairs (floor 1) or the exit.
const ROUTES = {
  1: [[[167, 370], [457, 370], [457, 466], [476, 466]], [[177, 380], [177, 567], [457, 567], [457, 470]]],
  0: [[[476, 466], [439, 466], [439, 569], [300, 569], [300, 662]], [[139, 369], [139, 569], [292, 569]], [[439, 369], [439, 460]]],
};
// Emergency exit signs: [x, y, direction] (radians, 0 = +x).
const EXITS = { 1: [[470, 452, 0]], 0: [[296, 652, Math.PI / 2]] };

export const toPlan = (x, z) => [x / S + ORIGIN.x, z / S + ORIGIN.y];
export const planSize = (f) => { const [x0, y0, x1, y1] = BOUNDS[f]; return [x1 - x0, y1 - y0]; };

function arrowHead(ctx, x, y, a, s) {
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
  ctx.lineTo(x + Math.cos(a + 2.5) * s, y + Math.sin(a + 2.5) * s);
  ctx.lineTo(x + Math.cos(a - 2.5) * s, y + Math.sin(a - 2.5) * s);
  ctx.closePath();
  ctx.fill();
}

// Draws floor f with its top-left corner at (ox, oy), k canvas pixels per plan pixel.
export function drawFloor(ctx, f, k, ox = 0, oy = 0) {
  const [bx, by] = BOUNDS[f];
  const [w, h] = planSize(f);
  ctx.save();
  ctx.setTransform(k, 0, 0, k, ox - bx * k, oy - by * k);
  ctx.fillStyle = C.paper; ctx.fillRect(bx, by, w, h);
  // Rooms, then corridors over them (some corridor boxes overlap a room's corner).
  const rooms = ROOMS[f].map(([a, b, c, d, name, kind]) => { const [x0, y0] = toF0(f, a, b), [x1, y1] = toF0(f, c, d); return { x0, y0, x1, y1, name, kind }; });
  for (const r of rooms) if (r.kind !== 'hall') { ctx.fillStyle = C.room; ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); }
  for (const r of rooms) if (r.kind === 'hall') { ctx.fillStyle = C.hall; ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); }
  // Stairwell (steps across both lanes) and lift (a cross).
  ctx.fillStyle = C.well; ctx.fillRect(STAIR.x0, 270, STAIR.x1 - STAIR.x0, STAIR.yNorth - 270);
  ctx.fillStyle = C.hall; ctx.fillRect(STAIR.x0, STAIR.yNorth, STAIR.x1 - STAIR.x0, LIFT.y0 - STAIR.yNorth);
  ctx.strokeStyle = C.text; ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i <= STAIR.steps; i++) {
    const y = STAIR.yHalf + (i * (STAIR.yLanding - STAIR.yHalf)) / STAIR.steps;
    ctx.moveTo(STAIR.x0, y); ctx.lineTo(STAIR.x1, y);
  }
  ctx.moveTo(STAIR.xMid, STAIR.yHalf); ctx.lineTo(STAIR.xMid, STAIR.yLanding);
  ctx.moveTo(LIFT.x0, LIFT.y0); ctx.lineTo(LIFT.x1, LIFT.y1); ctx.moveTo(LIFT.x1, LIFT.y0); ctx.lineTo(LIFT.x0, LIFT.y1);
  ctx.stroke();
  // Walls, then the doors cut through them.
  ctx.strokeStyle = C.wall; ctx.lineWidth = 3; ctx.lineCap = 'square';
  ctx.beginPath();
  for (const [a, b, c, d] of [...WALLS[f], ...WALLS.shared]) {
    const [x0, y0] = toF0(f, a, b), [x1, y1] = toF0(f, c, d);
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  for (const d of DOORS) {
    if (d.f !== f) continue;
    const [x, y] = toF0(f, d.x, d.y), exit = d.name === 'Sortie';
    ctx.fillStyle = exit ? C.green : C.hall;
    if (d.o === 'h') ctx.fillRect(x - d.w / 2, y - 2, d.w, 4); else ctx.fillRect(x - 2, y - d.w / 2, 4, d.w);
  }
  // Names, where they fit.
  ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const r of rooms) {
    const label = r.name in SHORT ? SHORT[r.name] : r.name;
    if (!label) continue;
    let size = 11;
    ctx.font = `bold ${size}px monospace`;
    while (size > 6 && ctx.measureText(label).width > r.x1 - r.x0 - 6) { size--; ctx.font = `bold ${size}px monospace`; }
    if (ctx.measureText(label).width > r.x1 - r.x0 - 4) continue;
    ctx.fillText(label, (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
  }
  ctx.save();
  ctx.translate((STAIR.x0 + STAIR.x1) / 2, (STAIR.yNorth + STAIR.yHalf) / 2); ctx.rotate(-Math.PI / 2);
  ctx.font = 'bold 8px monospace'; ctx.fillText('ESCALIER', 0, 0);
  ctx.restore();
  // Evacuation routes and exit signs.
  ctx.strokeStyle = C.green; ctx.fillStyle = C.green; ctx.lineWidth = 2.2; ctx.lineCap = 'butt';
  ctx.setLineDash([6, 4]);
  for (const route of ROUTES[f]) {
    ctx.beginPath();
    route.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const route of ROUTES[f]) {
    const [ax, ay] = route[route.length - 2], [bx2, by2] = route[route.length - 1];
    arrowHead(ctx, bx2, by2, Math.atan2(by2 - ay, bx2 - ax), 6);
  }
  for (const [x, y, a] of EXITS[f]) {
    ctx.fillStyle = C.green; ctx.fillRect(x - 8, y - 8, 16, 16);
    ctx.fillStyle = '#fff'; arrowHead(ctx, x + Math.cos(a) * 2, y + Math.sin(a) * 2, a, 5.5);
    ctx.fillRect(x - Math.cos(a) * 5 - 1.2, y - Math.sin(a) * 5 - 1.2, 2.4 + Math.abs(Math.cos(a)) * 5, 2.4 + Math.abs(Math.sin(a)) * 5);
  }
  ctx.restore();
}

// ---------- The poster on the wall ----------
// here: [x, z] in room coordinates, the "vous êtes ici" dot. Returns a group whose front (-Z) faces the room.
export function makeEvacuationPlan(f, here, width = 0.62) {
  const [pw, ph] = planSize(f);
  const PX = 512, pad = 18, head = 70, foot = 46;
  const k = (PX - pad * 2) / pw, H = Math.round(head + ph * k + foot);
  const c = document.createElement('canvas');
  c.width = PX; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fbfaf4'; ctx.fillRect(0, 0, PX, H);
  ctx.fillStyle = C.green; ctx.fillRect(0, 0, PX, 46);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 26px sans-serif'; ctx.fillText('PLAN D\'ÉVACUATION', PX / 2, 24);
  ctx.fillStyle = C.text; ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`Centre hospitalier · ${PLAN_TITLE[f]}`, PX / 2, 59);
  drawFloor(ctx, f, k, pad, head);
  // You are here.
  const [hx, hy] = toPlan(...here), [bx, by] = BOUNDS[f];
  const dx = pad + (hx - bx) * k, dy = head + (hy - by) * k;
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(dx, dy, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  // Legend.
  const ly = H - foot / 2;
  ctx.textAlign = 'left'; ctx.font = '13px sans-serif'; ctx.fillStyle = C.red;
  ctx.beginPath(); ctx.arc(26, ly, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.text; ctx.fillText('Vous êtes ici', 38, ly);
  ctx.strokeStyle = C.green; ctx.lineWidth = 3; ctx.setLineDash([7, 4]);
  ctx.beginPath(); ctx.moveTo(160, ly); ctx.lineTo(196, ly); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillText('Chemin d\'évacuation', 204, ly);
  ctx.fillStyle = C.green; ctx.fillRect(372, ly - 8, 16, 16);
  ctx.fillStyle = C.text; ctx.fillText('Sortie', 396, ly);
  ctx.fillStyle = '#8a8676'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText('Ne pas retirer', PX - 10, ly);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const w = width, h = (width * H) / PX;
  const g = new THREE.Group();
  g.name = `evacuation_plan_${f}`;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.012), mat({ color: 0xc9ccc6 }));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat({ map: tex }));
  face.position.z = -0.0065; face.rotation.y = Math.PI;
  g.add(frame, face);
  return g;
}

// ---------- The minimap ----------
// el: the HUD's minimap box (a canvas inside). show(f): the floor to show, or null to hide it.
export function createMinimap(el) {
  const canvas = el.querySelector('canvas'), title = el.querySelector('.title');
  const ctx = canvas.getContext('2d');
  const BASE_W = 1100; // canvas pixels: sharp both in the corner and enlarged (held key)
  const bases = {};
  let floor = null, last = '', big = false;
  function base(f) {
    if (bases[f]) return bases[f];
    const [pw, ph] = planSize(f), k = BASE_W / pw;
    const c = document.createElement('canvas');
    c.width = Math.round(pw * k); c.height = Math.round(ph * k);
    drawFloor(c.getContext('2d'), f, k);
    return (bases[f] = { c, k });
  }
  // x, z: room coordinates; yaw: the player's (forward is (-sin, -cos) in x, z).
  function update(f, x, z, yaw) {
    if (f === null) { if (floor !== null) { floor = null; el.classList.add('hidden'); } return; }
    const b = base(f);
    if (f !== floor) {
      floor = f; last = '';
      canvas.width = b.c.width; canvas.height = b.c.height;
      title.textContent = `Plan · ${PLAN_TITLE[f]}`;
      el.classList.remove('hidden');
    }
    const [px, py] = toPlan(x, z), [bx, by] = BOUNDS[f];
    const cx = (px - bx) * b.k, cy = (py - by) * b.k;
    const key = `${cx.toFixed(1)}|${cy.toFixed(1)}|${yaw.toFixed(2)}`;
    if (key === last) return;
    last = key;
    ctx.drawImage(b.c, 0, 0);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-yaw);
    const ratio = canvas.width / Math.max(1, canvas.clientWidth); // canvas pixels per screen pixel
    const s = (big ? 11 : 7) * ratio;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.3); ctx.lineTo(s * 0.85, s); ctx.lineTo(0, s * 0.45); ctx.lineTo(-s * 0.85, s); ctx.closePath();
    ctx.fillStyle = C.red; ctx.fill();
    ctx.lineWidth = 1.5 * ratio; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }
  // Held key: the same map, large in the middle of the screen.
  function setBig(on) {
    if (on === big) return;
    big = on; last = '';
    el.classList.toggle('big', on);
  }
  return { update, setBig, hide: () => update(null) };
}
