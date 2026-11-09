import * as THREE from 'three';
import { loadModel } from '../decor.js';
import { FH, CEIL, T, STAIR, wx } from './plan.js';
import { loadFurniture } from './mobilier.js';
import { dressFittings } from '../objets.js';

// Dresses the hospital with the team's 2 m modules (assets/decor/) over the plan's walls, which stay as the shell and the
// colliders. Modules are never stretched: they sit on the room's 2 m grid and are cut where a wall stops or a door opens.
// Grouped in 8 m cells; a cell only changes state out of view (decor.js rule). Its geometry is built when it is needed.

const STATES = [1, 2, 3, 4], VARIANTS = ['a', 'b', 'c'];
const GAP = 0.004; // keeps a module's face off the shell behind it
const PER_FRAME = 3; // cells rebuilt per frame while the building decays

async function loadSources(loader) {
  const src = {};
  const jobs = [];
  for (const type of ['wall', 'floor', 'ceiling']) for (const s of STATES) for (const v of VARIANTS) {
    const name = `${type}_${s}${v}`;
    jobs.push(loadModel(loader, `decor/${name}`).then((root) => {
      root.updateMatrixWorld(true);
      const parts = [];
      root.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        parts.push({ material: o.material, pos: g.attributes.position.array, nor: g.attributes.normal.array, uv: g.attributes.uv.array, idx: g.index?.array ?? null, count: g.attributes.position.count });
      });
      src[name] = parts;
    }));
  }
  await Promise.all(jobs);
  return src;
}

// Sutherland-Hodgman on one triangle against an axis-aligned box. A vertex is [x, y, z, nx, ny, nz, u, v].
function clipPolygon(poly, min, max) {
  let out = poly;
  for (let axis = 0; axis < 3; axis++) {
    for (const [limit, sign] of [[min[axis], 1], [max[axis], -1]]) {
      if (!Number.isFinite(limit)) continue;
      const input = out;
      out = [];
      for (let i = 0; i < input.length; i++) {
        const a = input[i], b = input[(i + 1) % input.length];
        const da = (a[axis] - limit) * sign, db = (b[axis] - limit) * sign;
        if (da >= 0) out.push(a);
        if (da >= 0 !== db >= 0) {
          const k = da / (da - db);
          out.push(a.map((v, n) => v + (b[n] - v) * k));
        }
      }
      if (out.length < 3) return [];
    }
  }
  return out;
}

function buildCellMeshes(items, level, src) {
  const byMat = new Map();
  for (const it of items) {
    const parts = src[`${it.type}_${level + 1}${it.v}`];
    const c = Math.cos(it.ry), s = Math.sin(it.ry);
    for (const p of parts) {
      if (!byMat.has(p.material)) byMat.set(p.material, { pos: [], nor: [], uv: [] });
      const out = byMat.get(p.material);
      const n = p.idx ? p.idx.length : p.count;
      const vert = (k) => {
        const i = p.idx ? p.idx[k] : k;
        const x = p.pos[i * 3], z = p.pos[i * 3 + 2], nx = p.nor[i * 3], nz = p.nor[i * 3 + 2];
        return [c * x + s * z + it.x, p.pos[i * 3 + 1] + it.y, -s * x + c * z + it.z, c * nx + s * nz, p.nor[i * 3 + 1], -s * nx + c * nz, p.uv[i * 2], p.uv[i * 2 + 1]];
      };
      for (let k = 0; k < n; k += 3) {
        const poly = clipPolygon([vert(k), vert(k + 1), vert(k + 2)], it.min, it.max);
        for (let f = 1; f < poly.length - 1; f++) for (const q of [poly[0], poly[f], poly[f + 1]]) {
          out.pos.push(q[0], q[1], q[2]); out.nor.push(q[3], q[4], q[5]); out.uv.push(q[6], q[7]);
        }
      }
    }
  }
  const meshes = [];
  for (const [material, a] of byMat) {
    if (!a.pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(a.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(a.nor), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(a.uv), 2));
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    meshes.push(m);
  }
  return meshes;
}

// Same variant for the same spot on every run.
const pick = (a, b) => VARIANTS[Math.abs((Math.floor(a) * 73856093) ^ (Math.floor(b) * 19349663)) % 3];
const noise = (a, b) => { const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return n - Math.floor(n); };
// Walls: a is plain, c carries the conduit and the socket, b a vent. About 10 plain walls for 1 or 2 with a socket.
const pickWall = (a, b) => { const n = noise(a, b); return n < 0.12 ? 'c' : n < 0.16 ? 'b' : 'a'; };

export async function dressHospital(root, H, loader) {
  const src = await loadSources(loader);
  const floors = [new THREE.Group(), new THREE.Group()];
  root.add(...floors);
  const cells = new Map();
  const cellAt = (f, x, z) => {
    const key = `${f}|${Math.floor(x / 8)}|${Math.floor(z / 8)}`;
    if (!cells.has(key)) cells.set(key, { f, items: [], meshes: [], group: new THREE.Group(), box: new THREE.Box3() });
    return cells.get(key);
  };
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
  const add = (cell, item, x0, y0, z0, x1, y1, z1) => {
    cell.items.push(item);
    cell.box.expandByPoint(v0.set(x0, y0 - FH, z0)).expandByPoint(v1.set(x1, y1 - FH, z1));
  };

  // A wall face only exists where someone can stand in front of it, outside room 104, which has its own modules.
  const { hole } = H;
  const standable = (x, y0, z) => {
    if (x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1 && y0 > FH / 2) return false;
    if (H.roomAt(x, y0 + 0.5, z) === 'Ascenseur') return false;
    return H.surfaces.some((s) => x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.h(x, z) >= y0 - 0.01 && s.h(x, z) < y0 + FH - 0.01);
  };

  for (const run of H.wallRuns) {
    const { horiz, c, a, b, bot, y0 } = run;
    const top = y0 + CEIL;
    if (bot >= top) continue;
    const odd = horiz ? 0 : 1; // grid of room 104: x boundaries on even metres, z boundaries on odd ones
    for (const side of [1, -1]) {
      const face = c + side * (T / 2 + GAP);
      for (let k = Math.floor((a - odd) / 2) * 2 + odd; k < b - 1e-3; k += 2) {
        const s0 = Math.max(a, k), s1 = Math.min(b, k + 2);
        if (s1 - s0 < 0.01) continue;
        const mid = (s0 + s1) / 2, probe = c + side * (T / 2 + 0.25);
        if (!standable(horiz ? mid : probe, y0, horiz ? probe : mid)) continue;
        const x = horiz ? k + 1 : face, z = horiz ? face : k + 1;
        const ry = horiz ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        const min = horiz ? [s0, bot, -Infinity] : [-Infinity, bot, s0];
        const max = horiz ? [s1, Infinity, Infinity] : [Infinity, Infinity, s1];
        const [cx, cz] = horiz ? [mid, face] : [face, mid];
        let v = pickWall(k + 7 * side, c * 3 + y0);
        if (v === 'b') {
          // wall_*b's grille occupies local x [0.33125, 0.66875], y [2.14375, 2.35625], z [0, 0.01].
          // Keep it whole at module cuts and clear of perpendicular partitions.
          const direction = horiz ? side : -side;
          const g0 = k + 1 + (direction > 0 ? 0.33125 : -0.66875);
          const g1 = k + 1 + (direction > 0 ? 0.66875 : -0.33125);
          const front0 = Math.min(face, face + side * 0.01), front1 = Math.max(face, face + side * 0.01);
          const [gx0, gz0, gx1, gz1] = horiz ? [g0, front0, g1, front1] : [front0, g0, front1, g1];
          if (g0 < s0 || g1 > s1 || bot > y0 + 2.14375 || H.colliders.some((q) =>
            gx0 < q.x1 && gx1 > q.x0 && gz0 < q.z1 && gz1 > q.z0 && y0 + 2.14375 < q.y1 && y0 + 2.35625 > q.y0)) v = 'a';
        }
        add(cellAt(run.f, cx, cz), { type: 'wall', v, x, y: y0, z, ry, min, max }, horiz ? s0 : face, bot, horiz ? face : s0, horiz ? s1 : face, top, horiz ? face : s1);
      }
    }
  }

  for (const q of H.floorRects) {
    const y = q.f * FH;
    for (let i = Math.floor(q.x0 / 2) * 2; i < q.x1 - 1e-3; i += 2) for (let j = Math.floor((q.z0 - 1) / 2) * 2 + 1; j < q.z1 - 1e-3; j += 2) {
      const x0 = Math.max(q.x0, i), x1 = Math.min(q.x1, i + 2), z0 = Math.max(q.z0, j), z1 = Math.min(q.z1, j + 2);
      if (x1 - x0 < 0.01 || z1 - z0 < 0.01) continue;
      const min = [x0, -Infinity, z0], max = [x1, Infinity, z1];
      const cell = cellAt(q.f, (x0 + x1) / 2, (z0 + z1) / 2);
      add(cell, { type: 'floor', v: pick(i, j), x: i + 1, y, z: j + 1, ry: 0, min, max }, x0, y, z0, x1, y, z1);
      let ceilingVariant = pick(j, i);
      if (ceilingVariant === 'b') {
        // ceiling_*b's vent is offset into the tile's northwest quarter (37.5 cm square).
        const vx0 = i + 0.3125, vx1 = i + 0.6875, vz0 = j + 0.3125, vz1 = j + 0.6875;
        const gap = 0.03; // keep the whole grille clear of cut edges and wall finishes
        if (vx0 - gap < x0 || vx1 + gap > x1 || vz0 - gap < z0 || vz1 + gap > z1 || H.colliders.some((q) =>
          vx0 - gap < q.x1 && vx1 + gap > q.x0 && vz0 - gap < q.z1 && vz1 + gap > q.z0 && y + CEIL - 0.0125 < q.y1 && y + CEIL > q.y0)) ceilingVariant = 'a';
      }
      add(cell, { type: 'ceiling', v: ceilingVariant, x: i + 1, y: y + CEIL, z: j + 1, ry: 0, min, max }, x0, y + CEIL, z0, x1, y + CEIL, z1);
    }
  }

  // The strip between room 104's floor modules and its partition, under the door.
  const ROOM_EDGE = 2;
  for (const q of [{ x0: ROOM_EDGE, x1: hole.x1, z0: hole.z0, z1: hole.z1, f: 1 }]) {
    const y = q.f * FH;
    for (let j = Math.floor((q.z0 - 1) / 2) * 2 + 1; j < q.z1 - 1e-3; j += 2) {
      const z0 = Math.max(q.z0, j), z1 = Math.min(q.z1, j + 2);
      add(cellAt(q.f, q.x0, (z0 + z1) / 2), { type: 'floor', v: pick(3, j), x: 3, y, z: j + 1, ry: 0, min: [q.x0, -Infinity, z0], max: [q.x1, Infinity, z1] }, q.x0, y, z0, q.x1, y, z1);
    }
  }

  // Cells: state 1 now, the others when they are asked for.
  const count = { a: 0, b: 0, c: 0 };
  for (const cell of cells.values()) for (const it of cell.items) if (it.type === 'wall') count[it.v]++;
  H.wallVariants = count;
  const pending = new Map();
  const build = (cell, level) => {
    for (const m of cell.meshes) { cell.group.remove(m); m.geometry.dispose(); }
    cell.meshes = buildCellMeshes(cell.items, level, src);
    cell.group.add(...cell.meshes);
  };
  for (const cell of cells.values()) {
    floors[cell.f].add(cell.group);
    build(cell, 0);
    H.tiles.push({ box: cell.box, level: 0, apply: (l) => pending.set(cell, l) });
  }

  // Doors: the leaf of the door's model, one per state. Patient rooms take the room's door module (door_<state>c), the
  // others their own leaf (plan.js `look`). Those leaves face their pull side (+Z) to the side they swing to, so a panic
  // bar or a WC indicator ends up on the side it serves.
  const looks = new Map();
  const leafSources = (look) => {
    if (!looks.has(look)) looks.set(look, Promise.all(STATES.map((s) => loadModel(loader, look ? `decor/door_${look}_${s}` : `decor/door_${s}c`))));
    return looks.get(look);
  };
  await Promise.all(H.swingDoors.map(async (door) => {
    const sources = await leafSources(door.d.look);
    const states = STATES.map(() => []);
    for (const leaf of door.leaves) {
      leaf.pivot.clear();
      sources.forEach((source, i) => {
        const clone = source.getObjectByName('door_leaf').clone(true);
        clone.position.set(0, 0, 0);
        if (leaf.dir < 0) clone.rotation.y = Math.PI; // opens from the other jamb
        if (door.d.look && (leaf.dir > 0) !== (door.into > 0)) {
          clone.scale.z = -1;
          // Mirroring the leaf also mirrors its painted fire-door labels. Reverse each face's U mapping
          // on a private geometry so the shared model and doors facing the other way stay untouched.
          if (door.d.look === 'fire') {
            const body = clone.getObjectByName('leaf_body');
            body.geometry = body.geometry.clone();
            const { uv, normal } = body.geometry.attributes;
            for (const side of [-1, 1]) {
              let min = Infinity, max = -Infinity;
              for (let j = 0; j < uv.count; j++) {
                if (normal.getZ(j) * side < 0.9) continue;
                min = Math.min(min, uv.getX(j)); max = Math.max(max, uv.getX(j));
              }
              for (let j = 0; j < uv.count; j++) {
                if (normal.getZ(j) * side >= 0.9) uv.setX(j, min + max - uv.getX(j));
              }
            }
            uv.needsUpdate = true;
          }
        }
        clone.visible = i === 0;
        leaf.pivot.add(clone);
        states[i].push(clone);
      });
    }
    door.tile.apply = (l) => states.forEach((list, i) => list.forEach((o) => { o.visible = i === l; }));
  }));

  await dressFittings(root, H, loader);
  const furniture = await loadFurniture(loader, H);
  furniture.forEach((group, f) => floors[f].add(group));
  H.surveillanceFloors = floors;

  // The other floor's interior only draws from the stairwell's doorway on, where it can be seen. Any further and, down a
  // long corridor, it can show through the floor at a grazing angle.
  const stairX = wx(STAIR.x0) - 1;
  function update(player) {
    for (const [cell, level] of [...pending].slice(0, PER_FRAME)) { build(cell, level); pending.delete(cell); }
    const hy = player.y + FH, f = hy > FH / 2 ? 1 : 0;
    const both = player.pos.x > stairX;
    floors[0].visible = both || f === 0;
    floors[1].visible = both || f === 1;
  }
  return { update, modules: [...cells.values()].reduce((n, c) => n + c.items.length, 0) };
}
