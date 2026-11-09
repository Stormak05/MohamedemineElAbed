import * as THREE from 'three';
import { T } from './plan.js';

const THEMES = ['hygiene', 'silence', 'traitement', 'orientation', 'annuaire'];

// Use solid wall runs only, on public-facing sides. Door openings have bot > y0.
const HALF_W = 0.28, CLEAR = HALF_W + 0.45; // a poster's half width; and from a wall fixture's centre
export function posterSpots(H) {
  const spots = [], fixtures = H.wallFixtures ?? [];
  for (const run of H.wallRuns) {
    if (run.bot > run.y0 || run.b - run.a < 1.4) continue;
    const centre = (run.a + run.b) / 2;
    for (const side of [1, -1]) {
      const probe = run.c + side * (T / 2 + 0.3);
      const room = H.roomAt(run.horiz ? centre : probe, run.y0 + 0.5, run.horiz ? probe : centre) ?? '';
      if (!/^(Couloir|Hall|Accueil|Cantine|WC)/.test(room)) continue;
      // Keep noticeboards, signs and room furnishings uncluttered; one poster per 7 m.
      const face = run.c + side * (T / 2 + 0.018);
      // Not over a clock or drawings on the same wall: slide along it, or give up this side.
      const along = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8].map((d) => centre + d).find((m) => m - HALF_W > run.a + 0.1 && m + HALF_W < run.b - 0.1
        && !fixtures.some((o) => o.f === run.f && Math.hypot(o.x - (run.horiz ? m : face), o.z - (run.horiz ? face : m)) < CLEAR));
      if (along === undefined) continue;
      const x = run.horiz ? along : face, z = run.horiz ? face : along;
      if (spots.some((p) => p.f === run.f && Math.hypot(p.x - x, p.z - z) < 7)) continue;
      spots.push({ x, z, y: run.y0 + 1.75, f: run.f,
        ry: run.horiz ? (side > 0 ? 0 : Math.PI) : side * Math.PI / 2 });
    }
  }
  return spots;
}

export async function dressPosters(root, H, loader) {
  const models = await Promise.all(THEMES.map((theme) => Promise.all(
    Array.from({ length: 4 }, async (_, level) => {
      const { scene } = await loader.loadAsync(new URL(`../assets/props/affiche_${theme}_${level + 1}.glb`, import.meta.url).href);
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const material of materials) if (material.map) {
          material.map.magFilter = material.map.minFilter = THREE.NearestFilter;
          material.map.generateMipmaps = false;
          material.map.needsUpdate = true;
        }
      });
      return scene;
    }),
  )));
  posterSpots(H).forEach((p, i) => {
    const group = new THREE.Group();
    group.name = `affiche_${THEMES[i % THEMES.length]}_${i}`;
    group.position.set(p.x, p.y, p.z);
    group.rotation.y = p.ry;
    const roots = models[i % THEMES.length].map((model, level) => {
      const state = model.clone(true);
      state.visible = level === 0;
      group.add(state);
      return state;
    });
    root.add(group);
    group.updateWorldMatrix(true, false);
    // Include the curled corner of all four states in the out-of-view check.
    const box = new THREE.Box3().setFromObject(group);
    H.tiles.push({ group, roots, box, level: 0 });
  });
}
