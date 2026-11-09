import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as plan from '../hopital/plan.js';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

// Run the building's actual wall/opening and floor calculations without painting textures.
function hospital() {
  const src = source('hopital/batiment.js');
  const geometry = src.slice(src.indexOf('  const doors = DOORS.map'), src.indexOf('  // Roof over'));
  return new Function(...Object.keys(plan), `
    const colliders = [], surfaces = [];
    const SHELL_INSET = 0.03, REVEAL_INSET = 0.02, STOREY_JOIN = FH - 0.04;
    const addBox = () => {};
    const solid = (x0, z0, x1, z1, y0, y1) => colliders.push({ x0, z0, x1, z1, y0, y1 });
    ${geometry}
    return { colliders, floorRects };
  `)(...Object.values(plan));
}

function ceilings(H) {
  const src = source('hopital/habillage.js');
  const pick = "const VARIANTS = ['a', 'b', 'c'];\n" + src.slice(src.indexOf('const pick ='), src.indexOf('const noise ='));
  const placement = src.slice(src.indexOf('  for (const q of H.floorRects)'), src.indexOf('  // The strip'));
  const items = [];
  new Function('H', 'FH', 'CEIL', 'cellAt', 'add', pick + placement)(
    H, plan.FH, plan.CEIL, () => null, (_, item) => items.push(item),
  );
  return items.filter((item) => item.type === 'ceiling');
}

test('ceiling grilles outside room 104 clear its door wall, including the lintel', () => {
  const H = hospital();
  const tile = (items) => items.find((it) => it.y === plan.FH + plan.CEIL && it.x === 3 && it.z === 2);
  // Without walls this tile selects a grille at x 2.3125–2.6875, inside the door wall's x 2.15–2.35.
  assert.equal(tile(ceilings({ ...H, colliders: [] })).v, 'b');
  assert.equal(tile(ceilings(H)).v, 'a');
  const door = plan.DOORS.find((d) => d.name === 'Chambre 104');
  const [px, pz] = plan.toF0(1, door.x, door.y);
  assert.ok(H.colliders.some((q) => q.x0 < plan.wx(px) && q.x1 > plan.wx(px)
    && q.z0 < plan.wz(pz) && q.z1 > plan.wz(pz) && q.y0 > plan.FH));
});

test('every retained hospital ceiling grille clears walls and tile cuts in all decay states', () => {
  const H = hospital(), vents = ceilings(H).filter((it) => it.v === 'b');
  assert.ok(vents.length > 0);
  for (const state of [1, 2, 3, 4]) {
    const data = readFileSync(new URL(`../assets/decor/ceiling_${state}b.glb`, import.meta.url));
    const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)));
    const node = gltf.nodes.find((n) => n.name === 'ceiling_vent');
    const bounds = gltf.accessors[gltf.meshes[node.mesh].primitives[0].attributes.POSITION];
    for (const it of vents) {
      const [x0, y0, z0] = bounds.min.map((v, i) => v + [it.x, it.y, it.z][i]);
      const [x1, y1, z1] = bounds.max.map((v, i) => v + [it.x, it.y, it.z][i]);
      const label = `state ${state}, grille at ${it.x}, ${it.y}, ${it.z}`;
      assert.ok(x0 >= it.min[0] && x1 <= it.max[0] && z0 >= it.min[2] && z1 <= it.max[2], label + ' is cut');
      assert.ok(!H.colliders.some((q) => x0 < q.x1 && x1 > q.x0 && z0 < q.z1 && z1 > q.z0
        && y0 < q.y1 && y1 > q.y0), label + ' intersects a wall');
    }
  }
});
