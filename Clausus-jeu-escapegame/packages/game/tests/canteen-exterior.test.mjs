import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.core.js';
import { FH, ROOMS, wx, wz } from '../hopital/plan.js';

const base = new URL('../', import.meta.url);
const uri = (s) => `data:text/javascript,${encodeURIComponent(s)}`;
const three = new URL('vendor/three/three.core.js', base).href;
// Texture painting and asset loading are irrelevant to the exterior's actual geometry/transforms.
const util = uri(`import {Texture} from '${three}';
  export const rnd = () => 0.5, clamp01 = v => Math.min(1, Math.max(0, v)), smooth = t => t*t*(3-2*t);
  export const pixelTexture = () => new Texture(), canvasTexture = pixelTexture;`);
const source = readFileSync(new URL('fin.js', base), 'utf8')
  .replace("'three'", JSON.stringify(three))
  .replace("'./util.js'", JSON.stringify(util))
  .replace("'./motion.js'", JSON.stringify(new URL('motion.js', base).href))
  .replace("'./decor.js'", JSON.stringify(uri('export const loadModel = async () => {};')))
  .replace("'./hopital/plan.js'", JSON.stringify(new URL('hopital/plan.js', base).href));
const { createEnding } = await import(uri(source));

test('the window backdrop hides the duplicate entrance that intersects the canteen; the real exit keeps it', () => {
  const scene = new THREE.Group();
  createEnding(scene, { audio: {} });
  createEnding(scene, { audio: {}, view: { at: new THREE.Vector3(-1, 1.535, -3.13), keepOut: () => false } });
  const [real, backdrop] = scene.children;
  const entrance = real.getObjectByName('hospital_entrance');
  const duplicate = backdrop.getObjectByName('hospital_entrance');
  assert.equal(entrance.visible, true);
  assert.equal(duplicate.visible, false);
  assert.equal(entrance.children.length, 10); // steps, canopy, two posts, sign, tube and its two glows
  assert.equal(duplicate.children.length, entrance.children.length);
  backdrop.updateMatrixWorld(true);
  const [a, b, c, d] = ROOMS[0].find((r) => r[4] === 'Cantine');
  const canteen = new THREE.Box3(new THREE.Vector3(wx(a), -FH, wz(b)), new THREE.Vector3(wx(c), -FH + 2.7, wz(d)));
  // Reproduces the screenshot: the right-hand canopy post penetrates a canteen table.
  const posts = duplicate.children.filter((o) => o.geometry?.parameters?.width === 0.14);
  assert.equal(posts.length, 2);
  assert.ok(posts.some((o) => new THREE.Box3().setFromObject(o).intersectsBox(canteen)));
  const drawn = [];
  backdrop.visible = true;
  backdrop.traverseVisible((o) => drawn.push(o));
  for (const part of duplicate.children) assert.ok(!drawn.includes(part));
  scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
});
