import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.core.js';
const source = readFileSync(new URL('../hopital/affiches.js', import.meta.url), 'utf8')
  .replace("'three'", JSON.stringify(new URL('../vendor/three/three.core.js', import.meta.url).href))
  .replace("'./plan.js'", JSON.stringify(new URL('../hopital/plan.js', import.meta.url).href))
  .replace('import.meta.url', JSON.stringify(new URL('../hopital/affiches.js', import.meta.url).href));
const { posterSpots, dressPosters } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const run = (c, extra = {}) => ({ horiz: true, c, a: 0, b: 2, bot: 0, y0: 0, f: 0, ...extra });
const hospital = (runs) => ({ wallRuns: runs, roomAt: () => 'Couloir', tiles: [] });

test('posters avoid door lintels, narrow walls and clustered placements', () => {
  const H = hospital([run(0, { bot: 2.1 }), run(0, { b: 1 }), run(0), run(2), run(9)]);
  assert.equal(posterSpots(H).length, 2);
  H.roomAt = () => 'Archives';
  assert.equal(posterSpots(H).length, 0);
});

test('Blockbench models register four decay roots in room coordinates', async () => {
  const root = new THREE.Group(); root.position.y = -3.3;
  const H = hospital([run(0)]), urls = [];
  await dressPosters(root, H, { loadAsync: async (url) => {
    urls.push(url);
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.78), new THREE.MeshLambertMaterial()));
    return { scene };
  } });
  assert.equal(urls.length, 20);
  assert.ok(urls.every((url) => /affiche_(hygiene|silence|traitement|orientation|annuaire)_[1-4]\.glb$/.test(url)));
  const tile = H.tiles[0];
  assert.equal(tile.roots.length, 4);
  assert.deepEqual(tile.roots.map((r) => r.visible), [true, false, false, false]);
  assert.ok(Math.abs(tile.box.getCenter(new THREE.Vector3()).y - (1.75 - 3.3)) < 1e-6);
});

test('all twenty Blockbench exports contain textured paper at the expected metre scale', () => {
  for (const theme of ['hygiene', 'silence', 'traitement', 'orientation', 'annuaire']) for (let state = 1; state <= 4; state++) {
    const name = `affiche_${theme}_${state}`;
    const source = JSON.parse(readFileSync(new URL(`../blockbench/props/${name}.bbmodel`, import.meta.url)));
    assert.equal(source.meta.model_format, 'free');
    assert.equal(source.elements.length, 1);
    assert.equal(Object.keys(source.elements[0].faces).length, 8);
    const glb = readFileSync(new URL(`../assets/props/${name}.glb`, import.meta.url));
    assert.equal(glb.toString('ascii', 0, 4), 'glTF');
    const doc = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)).trim());
    assert.equal(doc.images.length, 1);
    assert.ok(doc.images[0].bufferView !== undefined);
    const imageView = doc.bufferViews[doc.images[0].bufferView];
    const binStart = 20 + glb.readUInt32LE(12) + 8;
    const imageStart = binStart + (imageView.byteOffset ?? 0);
    assert.ok(glb.readUInt32BE(imageStart + 16) >= 256, `${name}: texture width`);
    assert.ok(glb.readUInt32BE(imageStart + 20) >= 360, `${name}: texture height`);
    const positions = doc.accessors.filter((a) => a.type === 'VEC3' && a.min && a.max);
    assert.ok(positions.some((a) => Math.abs(a.max[0] - a.min[0] - 0.55) < 0.001));
    assert.ok(positions.some((a) => Math.abs(a.max[1] - a.min[1] - 0.78) < 0.001));
  }
});
