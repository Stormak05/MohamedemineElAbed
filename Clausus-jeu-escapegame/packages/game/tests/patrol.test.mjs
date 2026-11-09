import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPatrol, advancePatrol, patrolClear } from '../patrol.js';
import { FH } from '../hopital/plan.js';

const home = { x: 0, y: 0, z: 0 };
const hospital = (colliders = [], surfaces = [{ x0: -4, x1: 4, z0: -4, z1: 4, h: () => FH }]) => ({ H: { colliders, surfaces } });
const box = { x0: 0.5, x1: 1, z0: -0.5, z1: 0.5, y0: FH, y1: FH + 2 };

test('rounds never cross walls, closed doors or low furniture even when destination is clear', () => {
  const H = hospital([{ ...box, x0: -0.5, x1: 0.5, z0: 0.5, z1: 0.6, y1: FH + 0.3 }]);
  const clear = (p) => patrolClear(p, H);
  const route = createPatrol(home, clear), pos = { ...home };
  assert.ok(route.enabled);
  for (let i = 0; i < 3000; i++) {
    advancePatrol(route, pos, 1 / 60, false, clear);
    assert.ok(clear(pos));
    assert.ok(Math.hypot(pos.x, pos.z) < 2.5);
  }
});

test('patrol rejects missing floors and different elevations, including floors above another actor', () => {
  assert.equal(patrolClear(home, hospital([], [])), false);
  assert.equal(patrolClear(home, hospital([], [{ x0: -4, x1: 4, z0: -4, z1: 4, h: () => 0 }])), false);
  assert.equal(patrolClear(home, hospital([{ ...box, x0: -1, y0: FH * 2, y1: FH * 2 + 2 }])), true);
});

test('own collider is ignored while other actors, closed doors and furniture block movement', () => {
  const own = { ...box, x0: -1 };
  const H = hospital([own]);
  assert.equal(patrolClear(home, H), false);
  assert.equal(patrolClear(home, H, own), true);
  H.H.colliders.push({ ...own });
  assert.equal(patrolClear(home, H, own), false);
  H.H.colliders[1].active = false;
  assert.equal(patrolClear(home, H, own), true);
});

test('actor walks out, waits, returns to post and stops immediately for a conversation or pause', () => {
  const route = createPatrol(home, () => true), pos = { ...home };
  for (let i = 0; i < 310; i++) advancePatrol(route, pos, 1 / 60, false, () => true);
  assert.ok(Math.hypot(pos.x, pos.z) > 1);
  const before = { ...pos };
  for (let i = 0; i < 100; i++) advancePatrol(route, pos, 1 / 60, true, () => true);
  assert.deepEqual(pos, before);
  advancePatrol(route, pos, 0, false, () => true);
  assert.deepEqual(pos, before);
  for (let i = 0; i < 800; i++) {
    advancePatrol(route, pos, 1 / 60, false, () => true);
    if (!route.outward && Math.hypot(pos.x, pos.z) < 0.02) return;
  }
  assert.fail('actor did not return to its post');
});

test('new obstacle interrupts the route; removing it allows the round to resume without teleporting', () => {
  const route = createPatrol(home, () => true), pos = { ...home };
  route.wait = 0;
  assert.equal(advancePatrol(route, pos, 1 / 60, false, () => false), 0);
  assert.deepEqual(pos, home);
  route.wait = 0;
  assert.ok(advancePatrol(route, pos, 10, false, () => true) <= 0.08);
});

test('no safe route keeps the actor at its original post', () => {
  const route = createPatrol(home, () => false), pos = { ...home };
  assert.equal(route.enabled, false);
  assert.equal(advancePatrol(route, pos, 10, false, () => true), 0);
  assert.deepEqual(pos, home);
});

