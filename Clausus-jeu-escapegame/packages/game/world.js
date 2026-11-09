import * as THREE from 'three';
import { rnd, pixelTexture, mat } from './util.js';
import { loadDecor } from './decor.js';
import { modelAsset, skin } from './objets.js';

// Room: x in [-RX, RX], z in [-RZ_BACK, RZ_FRONT]: a whole number of 2 m decor modules (2 wide, 3 deep).
// Window in the back wall, exit door in the right wall. WIN and DOOR match window.glb and door_*c.glb.
export const RX = 2, RZ_BACK = 3, RZ_FRONT = 3, RH = 2.7;
export const TABLE = { w: 1.3, d: 0.76, h: 0.74 }; // table.glb
export const WIN = { x: -1, y0: 0.91, y1: 2.16, w: 1.12, sillY: 0.86 };
export const DOOR = { z: 2, w: 0.94, h: 2.09 };
const GROUND_Y = -3.6;

export function buildWorld(scene) {
  // ---------- Window: the model brings wall, frame, bars and glass; rain runs on a pane behind it ----------
  const zIn = -RZ_BACK;
  const wx0 = WIN.x - WIN.w / 2, wx1 = WIN.x + WIN.w / 2;
  const glassMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uFlash; varying vec2 vUv;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float drops(vec2 uv, float scale, float speed) {
        vec2 g = uv * vec2(scale, scale * 0.6);
        vec2 id = floor(g); vec2 f = fract(g);
        float r = h(id);
        float y = fract(r * 7.0 - uTime * speed * (0.3 + r));
        vec2 c = vec2(0.3 + 0.4 * h(id + 3.1), 1.0 - y);
        float d = length((f - c) * vec2(1.0, 0.6));
        float trail = smoothstep(0.05, 0.0, abs(f.x - c.x)) * step(c.y, f.y) * (1.0 - f.y) * 0.5;
        return smoothstep(0.12, 0.04, d) * step(0.35, r) + trail * step(0.6, r);
      }
      void main() {
        float d = drops(vUv, 9.0, 0.25) + drops(vUv + 0.37, 17.0, 0.4) * 0.6;
        float a = 0.06 + d * 0.35;
        vec3 col = mix(vec3(0.35, 0.42, 0.5), vec3(0.85, 0.9, 1.0), d) * (1.0 + uFlash * 3.0);
        gl_FragColor = vec4(col, a);
      }`,
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, WIN.y1 - WIN.y0), glassMat);
  glass.position.set(WIN.x, (WIN.y0 + WIN.y1) / 2, zIn - 0.09);
  scene.add(glass);

  // Light from the courtyard, through the bars. Lightning boosts it.
  const cityGlow = new THREE.SpotLight(0x8ea4cc, 30, 14, 0.5, 0.6, 1.3);
  cityGlow.position.set(WIN.x + 0.5, 3.4, -7.5);
  cityGlow.target.position.set(WIN.x - 0.1, 0.0, -0.8);
  cityGlow.castShadow = true;
  cityGlow.shadow.mapSize.set(1024, 1024);
  cityGlow.shadow.bias = -0.0015;
  cityGlow.shadow.camera.near = 1;
  scene.add(cityGlow, cityGlow.target);

  // ---------- Outside ----------
  // The view itself is the exterior of the closing sequence (fin.js, built a second time and turned to face this
  // window, main.js): forecourt, canopy, the path to the open gate, the road, the town. Only the rain is here.
  const outside = new THREE.Group();
  scene.add(outside);

  // Rain: falling streaks outside the window.
  const RAIN = 1400;
  const rainPos = new Float32Array(RAIN * 6);
  const rainBox = { x0: -11, x1: 3.7, y0: GROUND_Y, y1: 7, z0: -3.3, z1: -16 };
  const spawn = (i, anyY) => {
    const x = rainBox.x0 + rnd() * (rainBox.x1 - rainBox.x0);
    const z = rainBox.z0 + rnd() * (rainBox.z1 - rainBox.z0);
    const y = anyY ? rainBox.y0 + rnd() * (rainBox.y1 - rainBox.y0) : rainBox.y1;
    rainPos.set([x, y, z, x + 0.03, y + 0.35, z], i * 6);
  };
  for (let i = 0; i < RAIN; i++) spawn(i, true);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0x8c98a6, transparent: true, opacity: 0.45, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  outside.add(rain);

  // ---------- Exit door and emergency exit sign (the hospital beyond is hopital/) ----------
  // Leaf, wall and sign models are added by loadDecor.
  const doorPivot = new THREE.Group();
  // Lock light on the leaf: red while locked, green once open.
  const lockLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1) }));
  lockLed.position.set(0.84, 1.2, 0.03);
  doorPivot.add(lockLed);

  const signGroup = new THREE.Group();
  signGroup.position.set(RX, DOOR.h + 0.22, DOOR.z);
  signGroup.rotation.y = -Math.PI / 2;
  scene.add(signGroup);
  // A spot turned into the room: a point light would shine through the wall onto the corridor behind.
  const signLight = new THREE.SpotLight(0x2cff6a, 1.1, 3.6, 1.35, 0.8, 1.4);
  signLight.position.set(RX - 0.3, DOOR.h + 0.2, DOOR.z);
  signLight.target.position.set(RX - 2.5, 0.6, DOOR.z);
  scene.add(signLight, signLight.target);

  // ---------- Table, chair, the patient's photo, the paper ----------
  // The paper on the table: the night shift planning.
  const paperTex = pixelTexture(24, 32, ({ rect }) => {
    rect(0, 0, 24, 32, [214, 208, 186], 4);
    rect(3, 3, 12, 2, [60, 56, 50]);
    for (let y = 8; y < 30; y += 3) rect(3, y, 6 + Math.floor(rnd() * 15), 1, [104, 98, 88]);
    rect(15, 22, 6, 6, [150, 40, 30], 6);
  });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.28), mat({ map: paperTex }));
  paper.rotation.set(-Math.PI / 2, 0, 0.32);
  paper.position.set(0.3, TABLE.h + 0.002, 0.16);
  paper.receiveShadow = true;
  scene.add(paper);

  // The nurse's photo, pinned on the wall above the bed.
  const photoCanvas = document.createElement('canvas');
  photoCanvas.width = 48; photoCanvas.height = 58;
  drawPhoto(photoCanvas.getContext('2d'));
  const photoTex = new THREE.CanvasTexture(photoCanvas);
  photoTex.colorSpace = THREE.SRGBColorSpace;
  photoTex.magFilter = photoTex.minFilter = THREE.NearestFilter;
  photoTex.generateMipmaps = false;
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.145), mat({ map: photoTex }));
  photo.position.set(1.62, 1.42, -RZ_BACK + 0.004);
  photo.rotation.z = -0.08;
  photo.receiveShadow = true;
  scene.add(photo);
  const pin = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), mat({ color: 0xb02020 }));
  pin.position.set(1.62, 1.48, -RZ_BACK + 0.01);
  scene.add(pin);

  // ---------- Coins ----------
  const coinMat = new THREE.MeshLambertMaterial({ color: 0x8c6a3a, emissive: new THREE.Color(0.08, 0.06, 0.03) }); // bronze, like 2d/coin.png
  let coinModel = null;
  // One geometry for every coin (the model's, once loaded): a coin taken or inserted leaves nothing to free.
  const coinGeo = new THREE.CylinderGeometry(0.0125, 0.0125, 0.003, 14);
  const makeCoin = () => {
    const c = new THREE.Mesh(coinGeo, coinMat);
    if (coinModel) skin(c, coinModel);
    c.castShadow = true;
    return c;
  };
  const sillCoin = makeCoin();
  sillCoin.position.set(WIN.x + 0.22, WIN.sillY + 0.0015, zIn + 0.04);
  scene.add(sillCoin);

  // ---------- Update ----------
  const rainV = 9.5;
  function update(t, dt, flash, sanityLoss) {
    glassMat.uniforms.uTime.value = t;
    glassMat.uniforms.uFlash.value = flash;
    const p = rainPos;
    for (let i = 0; i < RAIN; i++) {
      const o = i * 6;
      p[o + 1] -= rainV * dt; p[o + 4] -= rainV * dt;
      p[o] -= 0.8 * dt; p[o + 3] -= 0.8 * dt;
      if (p[o + 1] < rainBox.y0) spawn(i, false);
    }
    rainGeo.attributes.position.needsUpdate = true;
  }

  const decor = { tiles: [], updateDecay: () => {}, forceDecay: () => {} };
  return {
    update, tiles: decor.tiles, updateDecay: (camera, sanityLoss) => decor.updateDecay(camera, sanityLoss),
    forceDecay: (sanityLoss) => decor.forceDecay(sanityLoss),
    loadDecor: async (loader) => {
      const d = await loadDecor(scene, loader, { RX, RZ_BACK, RZ_FRONT, RH, WIN, DOOR, doorPivot, signGroup });
      decor.tiles.push(...d.tiles);
      decor.updateDecay = d.updateDecay;
      decor.forceDecay = d.forceDecay;
      decor.raw = d.tiles;
      // Small objects: Blockbench models in place of the code's shapes.
      const [coin, tack, led] = await Promise.all(['coin', 'thumbtack', 'lock_led'].map((f) => modelAsset(loader, `props/${f}`)));
      coinModel = coin;
      skin(sillCoin, coin);
      skin(pin, tack);
      skin(lockLed, led, true);
    },
    // Props with decay states (props.js) join the decor slots: same rule, they only change out of view.
    addDecayTiles: (tiles) => { decor.raw.push(...tiles); },
    rain, glass, cityGlow, doorPivot, lockLed, signLight, paper, photo, photoCanvas, sillCoin, makeCoin,
    zIn, wx0, wx1,
  };
}

// Small keepsake Polaroid, shared by the wall texture and the inspection view.
export function drawPhoto(ctx) {
  const rect = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const shape = (color, points) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  };
  ctx.save();
  rect('#e8dfc8', 0, 0, 48, 58);
  rect('#f5edda', 1, 1, 46, 56);
  rect('#d4c8ad', 0, 57, 48, 1);
  rect('#c7baa0', 3, 3, 42, 38);
  // A faded garden snapshot: soft sky, distant hedge and sunlit grass.
  rect('#9aafb0', 4, 4, 40, 36);
  rect('#b6bdb0', 4, 18, 40, 8);
  shape('#75846a', [[4, 23], [9, 20], [15, 22], [21, 19], [30, 22], [38, 19], [44, 22], [44, 33], [4, 33]]);
  rect('#8f986b', 4, 29, 40, 11);
  rect('#aab080', 5, 32, 9, 2); rect('#aab080', 34, 35, 10, 2);
  rect('#626f53', 7, 4, 3, 23);
  shape('#7d8e76', [[4, 4], [18, 4], [16, 9], [12, 12], [4, 10]]);
  rect('#b4b897', 34, 24, 7, 1);
  rect('#c8bc94', 8, 36, 2, 1); rect('#d8ca9e', 37, 31, 1, 1);
  // Rounded silhouette, loose brown hair and a pink cardigan.
  shape('#503d32', [[19, 10], [26, 9], [31, 13], [33, 22], [31, 29], [16, 29], [15, 21], [16, 14]]);
  shape('#78533c', [[19, 11], [26, 10], [29, 13], [22, 15], [18, 22], [16, 24], [17, 15]]);
  shape('#a5686b', [[19, 27], [28, 27], [32, 30], [35, 40], [12, 40], [15, 30]]);
  shape('#c28a85', [[18, 28], [22, 29], [21, 40], [15, 40], [16, 32]]);
  shape('#80535e', [[29, 29], [32, 31], [35, 40], [29, 40], [27, 32]]);
  rect('#c39373', 22, 24, 5, 5);
  shape('#e4b994', [[19, 15], [25, 13], [29, 16], [29, 22], [26, 26], [22, 26], [18, 22], [18, 18]]);
  shape('#c99575', [[28, 17], [30, 18], [29, 23], [26, 26], [23, 25], [27, 23]]);
  shape('#604332', [[18, 14], [22, 12], [27, 12], [30, 16], [27, 17], [24, 14], [20, 17], [18, 20]]);
  rect('#956647', 19, 13, 4, 1);
  // Tiny warm highlights keep the face legible without oversized cartoon eyes.
  rect('#544439', 20, 19, 2, 1); rect('#544439', 26, 19, 2, 1);
  rect('#f0c8a3', 21, 21, 2, 1); rect('#bb856c', 24, 21, 1, 2);
  rect('#9c6159', 23, 24, 3, 1);
  rect('#d5aa87', 17, 31, 3, 5); rect('#e8bc95', 18, 30, 2, 3);
  rect('#d6b8a0', 24, 31, 1, 1); rect('#d6b8a0', 24, 35, 1, 1);
  // Subtle fixed print grain; both views always show the same photograph.
  for (let y = 4; y < 40; y++) {
    for (let x = 4; x < 44; x++) {
      const grain = (x * 37 + y * 71 + x * y * 13) % 43;
      if (grain < 3) rect(grain ? '#ffffff0b' : '#352b2510', x, y, 1, 1);
    }
  }
  // Handwritten caption: "Léa ♥".
  ctx.fillStyle = '#2b3a8a';
  const s = [[6, 44, 1, 8], [6, 51, 5, 1], [13, 47, 4, 1], [13, 47, 1, 5], [13, 49, 4, 1], [13, 51, 4, 1], [16, 47, 1, 3], [14, 45, 2, 1],
    [19, 47, 4, 1], [22, 47, 1, 5], [19, 49, 4, 1], [19, 49, 1, 3], [19, 51, 4, 1]];
  for (const [x, y, w, h] of s) ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#b02a3a';
  ctx.fillRect(28, 46, 2, 2); ctx.fillRect(31, 46, 2, 2); ctx.fillRect(28, 48, 5, 2); ctx.fillRect(29, 50, 3, 1); ctx.fillRect(30, 51, 1, 1);
  ctx.fillStyle = '#6b6450'; ctx.fillRect(36, 50, 8, 1);
  ctx.restore();
}
