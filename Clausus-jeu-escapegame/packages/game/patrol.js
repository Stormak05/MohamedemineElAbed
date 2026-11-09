// Short, reversible rounds stay on the same level and never open a story door.
import { FH } from './hopital/plan.js';

export function patrolClear(pos, hospital, ownCollider) {
  const y = pos.y + FH, radius = 0.3;
  if (!hospital.H.surfaces.some((s) => pos.x >= s.x0 && pos.x <= s.x1 && pos.z >= s.z0 && pos.z <= s.z1 && Math.abs(s.h(pos.x, pos.z) - y) < 0.05)) return false;
  return !hospital.H.colliders.some((c) => c !== ownCollider && c.active !== false && c.y1 > y + 0.1 && c.y0 < y + 1.85 && pos.x > c.x0 - radius && pos.x < c.x1 + radius && pos.z > c.z0 - radius && pos.z < c.z1 + radius);
}

export function createPatrol(home, clear) {
  let end = { ...home }, best = 0;
  // Sample the entire segment, including furniture, rather than just its destination.
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    for (let d = 0.1; d <= 2.4; d += 0.1) {
      const p = { x: home.x + Math.cos(angle) * d, y: home.y, z: home.z + Math.sin(angle) * d };
      if (!clear(p)) break;
      if (d > best) { best = d; end = p; }
    }
  }
  return { home: { ...home }, end, outward: true, wait: 2, enabled: best >= 0.6, v: 0, pace: 0.62 + Math.random() * 0.16 };
}

export function advancePatrol(patrol, pos, dt, paused, clear) {
  if (paused || !patrol.enabled || dt <= 0) { if (paused) patrol.v = 0; return 0; }
  if (patrol.wait > 0) { patrol.wait = Math.max(0, patrol.wait - dt); return 0; }
  const target = patrol.route ? patrol.route[patrol.waypoint] : patrol.outward ? patrol.end : patrol.home;
  const dx = target.x - pos.x, dz = target.z - pos.z, distance = Math.hypot(dx, dz);
  // Never the same pause twice; each actor walks at its own pace, speeds up from a stop and slows down to arrive.
  if (distance < 0.02) {
    if (patrol.route) patrol.waypoint = (patrol.waypoint + 1) % patrol.route.length;
    else patrol.outward = !patrol.outward;
    patrol.wait = 2.2 + Math.random() * 2; patrol.v = 0; return 0;
  }
  const pace = patrol.pace ?? 0.7;
  const want = Math.min(pace, Math.sqrt(2 * 0.9 * distance) + 0.06);
  patrol.v = (patrol.v ?? 0) + Math.max(-2 * dt, Math.min(1.4 * dt, want - (patrol.v ?? 0)));
  const step = Math.min(distance, Math.max(0, patrol.v) * dt, 0.08);
  const next = { x: pos.x + dx / distance * step, y: pos.y, z: pos.z + dz / distance * step };
  // A player, another actor or a newly closed door can interrupt an existing round.
  if (!clear(next)) { patrol.wait = 0.8 + Math.random() * 0.6; patrol.v = 0; return 0; }
  pos.x = next.x; pos.z = next.z;
  return step;
}
