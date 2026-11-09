import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loading } from './loading.js';
import { gpu, showGpuNotice, hideGpuNotice } from './gpu.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { NightShader } from './post.js';
import { buildWorld, drawPhoto, RX, RZ_BACK, RZ_FRONT, RH, TABLE, WIN, DOOR } from './world.js';
import { rnd, clamp01, mat, box } from './util.js';
import { Audio, SOUND_TESTS } from './audio.js';
import { createMirrors } from './mirrors.js';
import { createSecurityMonitors } from './security-monitors.js';
import { PlayerBody, BODY_SHADOW_LAYER } from './body.js';
import { createPlayerOutfit } from './player-outfit.js';
import { FH, SECURITY_DESK_GAP } from './hopital/plan.js';
import { Hands, camPose, worldPose, wait, ARM_REACH } from './hands.js';
import { MiniOS, OS_W, OS_H } from './os.js';
import { cfg, onCfg, keyLabel } from './config.js';
import { createTouchControls, isTouch, goFullscreen, exitFullscreen } from './touch.js';
import { createMenus } from './menu.js';
import { shell } from './shell.js';
import { loadModel, makeEmissive } from './decor.js';
import { loadProps } from './props.js';
import { createHospital } from './hopital/jeu.js';
import { createNPCs } from './pnj.js';
import { createTreatment } from './treatment.js';
import { createEnding, showReport, EXIT } from './fin.js';
import { FH as FH_ROOM, wx, wz, EVAC_PLAN_F1, T as WALL_T } from './hopital/plan.js';
import { createHudScreen } from './hudscreen.js';
import { MOREL_NOTES, morelWhispers } from './morel.js';
import { createVoices, HAL, HAL_RANDOM, halOf } from './voix.js';
import { modelAsset, skin as skinMesh } from './objets.js';
import { STORY, HINTS, LEA, stageOf, spot as storySpot, COATS, TASKS, SLOTS, SOLUTION, RULES, CONSIGNE, ANNUAIRE, DOCS, makeDictaphone, makeRoomBox, makeCoatRack, makeLocker, makeBoard, makeCoffret, makeDispenser } from './histoire.js';
import { scoreOf } from './score.js';
import { ease, arc, vary, between, noise, drift } from './motion.js';
import { createFocus, FocusOutlinePass, boxOf, centerOf } from './focus.js';
import { makeEvacuationPlan, createMinimap } from './plans.js';
import { takeFor } from './repliques.js';
import { createAmbiance } from './ambiance.js';

const params = new URLSearchParams(location.search);
const DUREE_PARAM = Number(params.get('duree')) || 0;
const $ = (id) => document.getElementById(id);

// ---------- Renderer, scene, camera ----------
const canvas = $('view');
// gpu.js has already checked the graphics card: without WebGL, explain how to turn hardware acceleration on and stop.
if (!gpu.webgl) { showGpuNotice('none'); throw new Error('WebGL indisponible'); }
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true }); } catch (e) { showGpuNotice('none'); throw e; }
// The card may give up mid-game (driver reset, sleep, out of memory): say so instead of a frozen picture.
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showGpuNotice('lost'); });
canvas.addEventListener('webglcontextrestored', hideGpuNotice);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.075);
const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.04, 120);
camera.rotation.order = 'YXZ';
scene.add(camera);

const world = buildWorld(scene);
const audio = new Audio();
// The hospital around the room: room 104 is on its first floor, its door opens straight onto the corridor.
// Locked doors and the lift ask the story what the player holds (G, below).
const ITEM_OF = { cles: 'keys', cleReunion: 'meetingKey', carte: 'card' };
const LOCKED_TEXT = {
  Escalier: 'Fermée à clé. Il me faudrait les clés d\'un médecin.', Ascenseur: 'Il faut une clé du personnel pour appeler l\'ascenseur.',
  'Poste de sécurité 001': 'Fermé à clé.', 'Salle de réunion 008': 'Fermée. Ce n\'est pas une clé du trousseau.',
  'Cabinet Dr W. Morel 007': 'Fermé à clé.', Sortie: 'Le portique de sortie. Il faut une carte d\'accès.',
};
const hosp = createHospital(scene, {
  audio, cfg, toast: (text) => toast(text, 3),
  story: {
    has: (need) => !!G[ITEM_OF[need]],
    liftOk: () => G.keys,
    locked: (d) => thought(LOCKED_TEXT[d.name] ?? 'Fermé à clé.'),
    unlocked: (d) => toast(d.need === 'carte' ? 'Carte d\'accès : le portique s\'ouvre' : d.need === 'cleReunion' ? 'Ouvert avec la clé de la salle de réunion' : 'Ouvert avec le trousseau du Dr Morel', 3),
  },
});
// Beyond the hospital's main door: the courtyard, the gate, the road, and the walk out (fin.js).
const finale = createEnding(scene, { audio });
// The same exterior through room 104's window: the lit window of the closing sequence is his own (fin.js).
// The canteen (hopital/, one storey, right of the window) keeps its trees out.
const windowView = createEnding(scene, {
  audio, view: { at: new THREE.Vector3(WIN.x, (WIN.y0 + WIN.y1) / 2, -RZ_BACK - 0.13), keepOut: (x, z) => x > 3.4 && x < 22.6 && z > -22 && z < -2.5 },
});
const hands = new Hands(scene, camera);
hands.clearance = (a, b) => hosp.clearance(a, b, 0.03);
const playerBody = new THREE.Group();
playerBody.visible = false;
scene.add(playerBody);
// The player's bodies (body.js): the deformed one casts the shadow, the normal one is what the mirrors show.
// Both are posed from the first-person view every frame.
const body = new PlayerBody();
camera.layers.enable(BODY_SHADOW_LAYER); // the shadow-only body lives there: the lights cast it for this camera
const playerMirrorBody = new THREE.Group(); // what the mirrors show (mirrors.js)
let updatePlayerOutfit = () => {};
scene.add(playerMirrorBody);
const mirrors = createMirrors(scene, renderer);
mirrors.setBody(playerMirrorBody);
let securityMonitors = null;
let bodySeat = null; // { pos, yaw } while sitting at the computer
let bodyBob = 0;     // the stride goes on while the camera is scripted (walking up to something)

// ---------- Hanging lamp over the table ----------
const lamp = new THREE.Group();
lamp.position.set(0, RH, -0.05);
scene.add(lamp);
const CORD = 0.75; // pendant_lamp.glb, loaded in start()
const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 7.4, 4.6) });
const SPOT_POWER = 23; // the lamp hangs higher than it used to: kept as bright on the table
const spot = new THREE.SpotLight(0xffd59a, SPOT_POWER, 7, 0.85, 0.6, 1.8);
spot.position.y = -CORD - 0.12;
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.bias = -0.0008;
spot.shadow.camera.near = 0.05;
lamp.add(spot);
spot.target.position.set(0, -RH, 0);
lamp.add(spot.target);
const bounce = new THREE.PointLight(0xffd59a, 0.6, 2.2, 2);
bounce.position.y = -CORD - 0.3;
lamp.add(bounce);
const coneMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false,
  uniforms: { uIntensity: { value: 0.06 } },
  vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
    void main() { vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uIntensity; varying float vY; varying vec3 vN; varying vec3 vV;
    void main() {
      float d = abs(dot(vN, vV)) / max(length(vN) * length(vV), 1e-4);
      float y = clamp(vY, 0.0, 1.0);
      float a = clamp(uIntensity * d * sqrt(d) * y * y, 0.0, 1.0);
      gl_FragColor = vec4(vec3(1.0, 0.85, 0.6) * a, a); }`,
});
const coneH = 1.75;
const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 1.0, coneH, 24, 1, true), coneMat);
cone.position.y = -CORD - 0.12 - coneH / 2;
lamp.add(cone);
const DUST = 110;
const dustPos = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST);
for (let i = 0; i < DUST; i++) {
  const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 0.5;
  dustPos.set([Math.cos(a) * r, 0.8 + rnd(), Math.sin(a) * r - 0.05], i * 3);
  dustSeed[i] = rnd() * 100;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dustPoints = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffe2b0, size: 0.006, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(dustPoints);

const hemi = new THREE.HemisphereLight(0x8a9a90, 0x1a1612, 0.5);
scene.add(hemi);
// Faint night-light fill so the room reads even away from the lamp.
const roomFill = new THREE.PointLight(0x9fb0c0, 1.2, 7, 1);
roomFill.position.set(0.4, RH - 0.3, -0.6);
scene.add(roomFill);
// Follows the player: nearby things get clearer as they approach, the rest of the room stays dark.
const PLAYER_LIGHT = 3;
const playerLight = new THREE.PointLight(0xfff1dc, PLAYER_LIGHT, 4.6, 2);
playerLight.position.z = 0.6; // Behind the head, so a surface right against the player is not blown out.
camera.add(playerLight);

// ---------- Pay phone corner: red night light and coin box ----------
const PHONE_Z = -0.52;
const nightLight = new THREE.PointLight(0xff3a24, 0.45, 2.4, 1.6);
nightLight.position.set(-RX + 0.5, 1.6, PHONE_Z + 0.1);
scene.add(nightLight);
// Coin box to the right of the phone, with its slot and a "1 F" label.
const coinBox = new THREE.Group();
box(coinBox, 0.07, 0.16, 0.12, mat({ color: 0x6d726a }), 0, 0, 0);
box(coinBox, 0.004, 0.035, 0.01, mat({ color: 0x0a0a0a }), 0.036, 0.045, 0);
const labelTex = (() => {
  const c = document.createElement('canvas'); c.width = 32; c.height = 16;
  const x = c.getContext('2d'); x.fillStyle = '#d8d0b0'; x.fillRect(0, 0, 32, 16); x.fillStyle = '#7a1f18'; x.font = 'bold 11px monospace'; x.fillText('1 F', 6, 12);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t;
})();
const label = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.025), mat({ map: labelTex }));
label.rotation.y = Math.PI / 2; label.position.set(0.0361, -0.02, 0);
coinBox.add(label);
coinBox.position.set(-RX + 0.035, 1.3, PHONE_Z - 0.2);
scene.add(coinBox);

// Coiled cord drawn dynamically while the handset is off the hook.
const liveCord = new THREE.Mesh(new THREE.BufferGeometry(), mat({ color: 0x1c1d1c }));
liveCord.visible = false;
liveCord.frustumCulled = false;
scene.add(liveCord);

// ---------- Flashlight ----------
// Found on the chair. Held in the left hand, its beam follows the view.
const torch = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.15, 8), mat({ color: 0x2a2d2c }));
  body.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.018, 0.045, 8), mat({ color: 0x3a3e3c }));
  head.rotation.x = Math.PI / 2; head.position.z = -0.09;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.023, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.15, 1.0) }));
  lens.position.z = -0.113; lens.rotation.y = Math.PI;
  const sw = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.008, 0.02), mat({ color: 0x8a2a20 }));
  sw.position.set(0, 0.017, -0.02);
  torch.add(body, head, lens, sw);
  torch.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  torch.userData.lens = lens;
  torch.userData.shapes = [body, head, lens, sw];
}
torch.rotation.set(0, 0.4, 0);
scene.add(torch);
const torchLight = new THREE.SpotLight(0xfff0d6, 0, 10, 0.4, 0.5, 1.5);
torchLight.position.set(0, 0, -0.1);
torchLight.castShadow = true;
torchLight.shadow.mapSize.set(512, 512);
torchLight.shadow.bias = -0.002;
torchLight.shadow.camera.near = 0.05;
// The torch is in the player's own hand: its shadow map leaves the body out (layer 0 only; the extra layer
// makes three use this list instead of the camera's).
torchLight.shadow.camera.layers.set(0);
torchLight.shadow.camera.layers.enable(31);
torch.add(torchLight);
torchLight.target.position.set(0, 0, -2);
torch.add(torchLight.target);
let torchShown = false;
const torchHold = camPose(camera, -0.19, -0.2, -0.36, 0.08, 0.08, 0);

// ---------- Assets ----------
const loader = new GLTFLoader();
const assets = {};
let props = null; // room props (props.js), loaded in start()
async function place(file, { x = 0, y = 0, z = 0, ry = 0, back = null, wallX = null, key = file }) {
  const gltf = await loader.loadAsync(`./assets/${file}.glb`);
  const root = gltf.scene;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material;
    if (src.map) { src.map.magFilter = src.map.minFilter = THREE.NearestFilter; src.map.generateMipmaps = false; src.map.needsUpdate = true; }
    o.material = mat({ map: src.map, color: src.color });
    o.castShadow = o.name !== 'screen';
    o.receiveShadow = true;
  });
  root.rotation.y = ry;
  root.position.set(x, 0, z);
  scene.add(root);
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root);
  root.position.y += y - b.min.y;
  if (back !== null) root.position.z += back - b.min.z;
  if (wallX !== null) root.position.x += wallX - b.min.x;
  root.updateMatrixWorld(true);
  assets[key] = root;
  return root;
}

// ---------- Post-processing ----------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1);
composer.addPass(new RenderPass(scene, camera));
// Guard: a single NaN or huge HDR pixel would be smeared over the whole frame by the bloom.
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() { vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
      gl_FragColor = vec4(clamp(c, 0.0, 12.0), 1.0); }`,
}));
// Outline around what can be used, under the crosshair.
const outline = new FocusOutlinePass(scene, camera);
composer.addPass(outline);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 144), 0.5, 0.35, 7.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const night = new ShaderPass(NightShader);
composer.addPass(night);
const hudScreen = createHudScreen(night.uniforms, canvas);
// The voices the patient hears (voix.js): each line also flashes on screen, a few frames at a time.
const voices = createVoices({ audio, cfg, view: canvas, paused: () => G.paused || G.over || !G.started });

// Settings live in config.js (options menu + developer menu); this applies them to the scene.
const settings = { get postFX() { return cfg.retroFx && cfg.dPost; } };
function resize() {
  canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`;
  const aspect = innerWidth / innerHeight;
  const h = settings.postFX ? (cfg.dRes || Number(cfg.pixels)) : innerHeight;
  renderer.setSize(Math.round(h * aspect), h, false);
  composer.setSize(Math.round(h * aspect), h);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
// Phones report the new size a moment after rotating.
addEventListener('orientationchange', () => setTimeout(resize, 250));
let shadowMode = null;
function applyShadows() {
  if (shadowMode === cfg.shadows) return;
  const was = shadowMode;
  shadowMode = cfg.shadows;
  const size = cfg.shadows === 'high' ? 1024 : 512;
  for (const l of [spot, world.cityGlow, torchLight]) {
    l.shadow.map?.dispose(); l.shadow.map = null;
    const s = l === torchLight ? size / 2 : size;
    l.shadow.mapSize.set(s, s);
  }
  renderer.shadowMap.enabled = cfg.shadows !== 'off';
  if (was !== null) scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
}
function applySettings() {
  const u = night.uniforms;
  u.uGrain.value = cfg.dGrain; u.uDither.value = cfg.dDither; u.uLevels.value = Number(cfg.dLevels);
  u.uVignette.value = cfg.dVig; u.uVignetteSick.value = cfg.dVigSick; u.uAberration.value = cfg.dAberr;
  u.uScanlines.value = cfg.dScan; u.uContrast.value = cfg.dContrast; u.uSaturation.value = cfg.dSat;
  bloom.strength = cfg.dBloom;
  renderer.toneMappingExposure = cfg.dExposure * cfg.brightness;
  scene.fog.density = cfg.dFog;
  hemi.intensity = 0.5 * cfg.dAmbient; roomFill.intensity = 1.2 * cfg.dAmbient;
  playerLight.intensity = PLAYER_LIGHT * cfg.dPlayerLight;
  world.signLight.intensity = 1.1 * cfg.dSign;
  world.rain.visible = cfg.dRain;
  dustPoints.visible = cfg.dDust;
  applyShadows();
  audio.setVolumes({ master: cfg.volMaster, sfx: cfg.volSfx, amb: cfg.volAmb, voice: cfg.volVoice });
  $('debug').classList.toggle('hidden', !cfg.dDebug);
}
onCfg((id, v) => {
  applySettings();
  if (['pixels', 'dRes', 'retroFx', 'dPost'].includes(id)) resize();
  if (id === 'fov' && G.mode !== 'computer') targetFov = v;
  if (id === 'fullscreen') { if (v) goFullscreen(); else exitFullscreen(); }
});
// The toggle follows the real state: « Commencer » goes full screen; hold Escape or F11 to leave it.
for (const ev of ['fullscreenchange', 'webkitfullscreenchange'])
  document.addEventListener(ev, () => { cfg.fullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement); });

// ---------- Game state ----------
const G = {
  started: false, paused: false, over: false,
  mode: 'free', // free | busy | computer | doc | fallen | end
  sanity: 1, time: 0,
  pills: 0, bottleTaken: false, pillsTaken: 0,
  coins: 0, hints: 0, errors: 0, hinted: {},
  pillowCoin: false, sillCoin: false, mattressCoin: false,
  torch: false, torchOn: false,
  // The story (histoire.js): service box and room key, psychiatrist's name, keyring, coat, locker, planning, exit card.
  unlocked: false, doorOpen: false, psyKnown: false, keys: false, blouse: false, lockerOpen: false, meetingKey: false,
  planning: false, card: false, downstairs: false, metNurse: false,
  // Evacuation plans taken off the wall (plans.js): the floor's minimap, top right.
  planF1: false, planF0: false,
  // Léa's voice (histoire.js): the phantom call and the drawings speak once a night.
  leaCalled: false, leaDrawing: false,
  // Leaderboard: stats at the hospital exit, whether developer options touched the run, publication.
  runId: newRunId(), rankTicket: null, escape: null, cheated: false, published: false,
  pseudo: '',
};
// Once he is on the floor or the run is over, an action still finishing (a choice, a coin picked up) cannot
// hand the control back: only fallen → end goes on.
{
  let mode = G.mode;
  Object.defineProperty(G, 'mode', {
    enumerable: true,
    get: () => mode,
    set: (m) => { if (mode === 'end' || (mode === 'fallen' && m !== 'end')) return; mode = m; },
  });
}
function newRunId() {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`; }
}
const loss = () => 1 - G.sanity;

const START = { x: 0.7, z: -1.55, yaw: Math.PI }; // where the player gets to, out of bed: beside it, facing the room
const player = { pos: new THREE.Vector3(START.x, 0, START.z), y: 0, vy: 0, vx: 0, vz: 0, walk: 0, yaw: START.yaw, pitch: -0.12, bob: 0, stepDist: 0 }; // y: feet height (stairs, lift)
const keys = new Set();
const EYE = 1.6, R = 0.22;
const colliders = [[-TABLE.w / 2, TABLE.w / 2, -TABLE.d / 2, TABLE.d / 2]];

// Scripted camera: tween position + orientation, then hold.
// feet: where the player stands while bending over something (the eyes are then ahead of the feet), or null.
// Moves like a head: the gaze turns a little ahead of the body, the path bends, a walk bobs and sways, a turn leans.
// off: the idle drift (breathing…) added on top of the pose last frame, taken off before starting a new move.
const cam = { scripted: false, from: null, to: null, t0: 0, dur: 1, resolve: null, curve: null, standing: false, feet: null,
  ease: null, turnEase: null, via: null, lean: 0, walk: 0, off: { pos: new THREE.Vector3(), quat: new THREE.Quaternion() } };
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), AXIS_Z = new THREE.Vector3(0, 0, 1);
function lookQuat(pos, target, roll = 0) {
  const m = new THREE.Matrix4().lookAt(pos, target, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), roll));
  return q;
}
// opts: ease (position), turn (orientation; by default the head leads a little), via (a point the path bends towards),
// walk (false: no steps, for sitting, lying, falling), lean (roll into the turn, 0 for none).
function camTo(pos, quat, dur = 0.8, { ease: e = ease.body, turn = null, via = null, walk = true, lean = 1 } = {}) {
  cam.scripted = true;
  // Where the camera really is, without last frame's breathing.
  const base = camera.position.clone().sub(cam.off.pos);
  const baseQ = camera.quaternion.clone().multiply(cam.off.quat.clone().invert());
  cam.from = { pos: base, quat: baseQ };
  cam.to = { pos: pos.clone(), quat: quat.clone() };
  // A NaN duration would make the camera's path throw in the frame loop and stop the whole game.
  cam.t0 = performance.now() / 1000; cam.dur = Number.isFinite(dur) && dur > 0 ? vary(dur, 0.06) : 0.5;
  cam.ease = e; cam.turnEase = turn ?? ((k) => ease.reach(Math.min(1, k * 1.15)));
  cam.via = via ? via.clone() : null;
  // Steps: about one every 0.62 m walked on the flat.
  cam.walk = walk ? Math.hypot(pos.x - base.x, pos.z - base.z) : 0;
  // Leaning into a turn: the sign of the yaw change, a few degrees at most.
  const y0 = new THREE.Euler().setFromQuaternion(baseQ, 'YXZ').y, y1 = new THREE.Euler().setFromQuaternion(quat, 'YXZ').y;
  const dy = Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0));
  cam.lean = THREE.MathUtils.clamp(dy * 0.035, -0.045, 0.045) * lean;
  cam.curve = null; // camPath sets one after this call
  cam.resolve?.();
  return new Promise((r) => { cam.resolve = r; });
}
function releaseCam() {
  cam.scripted = false;
  cam.standing = false;
  cam.off.pos.set(0, 0, 0); cam.off.quat.identity();
  player.vx = player.vz = 0;
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  player.yaw = e.y; player.pitch = THREE.MathUtils.clamp(e.x, -1.35, 1.35);
  player.pos.set(camera.position.x, 0, camera.position.z);
  cam.feet = null;
}

// After using something: back on one's feet at eye height, looking the same way, then control comes back.
function standUp() {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  // Straightening up over the feet (after bending over something).
  const pos = (cam.feet ? camera.position.clone().setX(cam.feet.x).setZ(cam.feet.z) : camera.position.clone()).setY(player.y + EYE);
  const dy = camera.position.distanceTo(pos);
  if (dy < 0.03 && Math.abs(e.z) < 0.02) { releaseCam(); return; }
  cam.standing = true;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.clamp(e.x, -1.2, 1.2) * 0.6, e.y, 0, 'YXZ'));
  // If something else started meanwhile (a pill…), the frame loop asks again once the player is free.
  camTo(pos, q, 0.35 + dy * 0.55, { walk: false, lean: 0 }).then(() => { if (!cam.standing) return; cam.standing = false; if (G.mode === 'free') releaseCam(); });
}


const HUD = { palette: { full: '#c98a9a', mid: '#a0703e', low: '#8c2a24' }, fill: null };
async function setupHud() {
  $('brainIcon').src = 'hud/brain_1.png';
  $('pillIcon').src = 'hud/pill.png';
  $('coinIcon').src = 'hud/coin.png';
  $('torchIcon').src = 'hud/torch.png';
  new Image().src = 'hud/torch_on.png'; // preloaded so the first switch-on does not blink
  const spec = await (await fetch('hud/hud_spec.json')).json();
  const bar = $('bar'), fill = $('barFill'), frame = $('barFrame');
  const s = 240 / spec.bar.width;
  bar.style.height = `${Math.round(spec.bar.height * s)}px`;
  frame.src = 'hud/bar_frame.png';
  HUD.fill = { x: spec.bar.fill.x * s, y: spec.bar.fill.y * s, w: spec.bar.fill.width * s, h: spec.bar.fill.height * s };
  fill.style.backgroundImage = 'url(hud/bar_fill.png)';
  if (spec.palette) Object.assign(HUD.palette, spec.palette);
  Object.assign(fill.style, { left: `${HUD.fill.x}px`, top: `${HUD.fill.y}px`, height: `${HUD.fill.h}px` });
}
function lerpColor(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const m = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * k);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
function updateHud() {
  if (!HUD.fill) return;
  const s = G.sanity, fill = $('barFill');
  fill.style.width = `${HUD.fill.w * s}px`;
  fill.style.backgroundColor = s > 0.5 ? lerpColor(HUD.palette.mid, HUD.palette.full, (s - 0.5) * 2) : lerpColor(HUD.palette.low, HUD.palette.mid, s * 2);
  $('bar').classList.toggle('pulse', s < 0.25);
  const brain = s > 0.7 ? 1 : s > 0.45 ? 2 : s > 0.22 ? 3 : 4; // same thresholds as the room's decay
  if (brain !== hudBrain) { hudBrain = brain; $('brainIcon').src = `hud/brain_${brain}.png`; }
  $('pillCount').textContent = `×${G.pills}`;
  $('pillKey').textContent = G.pills > 0 ? `[${keyLabel(cfg.kPill)}]` : '';
  $('torchKey').textContent = `[${keyLabel(cfg.kTorch)}]`;
  $('pillIcon').parentElement.style.opacity = G.bottleTaken || G.pills > 0 ? 1 : 0.35;
  const items = [roomBox?.keyTaken && !G.unlocked && 'clé chambre', G.keys && 'trousseau', G.blouse && 'blouse', G.meetingKey && 'clé réunion', G.card && 'carte d\'accès'].filter(Boolean).join(' · ');
  if ($('items').textContent !== items) { $('items').textContent = items; $('itemsRow').classList.toggle('hidden', !items); }
  $('coinCount').textContent = `×${G.coins}`;
  $('torchRow').classList.toggle('hidden', !G.torch);
  $('torchState').textContent = G.torchOn ? 'allumée' : 'éteinte';
  const torchSrc = G.torchOn ? 'hud/torch_on.png' : 'hud/torch.png';
  if ($('torchIcon').getAttribute('src') !== torchSrc) $('torchIcon').src = torchSrc;
  const m = 3 * 60 + 17 + Math.floor(G.time / 60);
  $('clock').textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
let toastTimer = 0, hudBrain = 1;
// Top right, once the floor's evacuation plan is taken: the plan stays still, the arrow is the player.
const minimap = createMinimap($('minimap'));
function updateMinimap() {
  const f = hosp.floorOf(player.y);
  const show = G.started && !G.over && G.mode !== 'computer' && G.mode !== 'escape' && G.mode !== 'end' && (f === 1 ? G.planF1 : G.planF0);
  minimap.setBig(show && keys.has(cfg.kMap));
  minimap.update(show ? f : null, camera.position.x, camera.position.z, camYaw());
}
// How to trigger an action, as shown in hints: the bound key on a keyboard, the on-screen button on touch screens.
const KEY_TOUCH = { kPill: 'bouton cachet', kTorch: 'bouton lampe', kInteract: '✋' };
const ctl = (id) => (isTouch() ? KEY_TOUCH[id] : `[${keyLabel(cfg[id])}]`);
const keyTag = (id) => (isTouch() ? '' : ` [${keyLabel(cfg[id])}]`);
function toast(text, dur = 2.5) {
  const el = $('toast'); el.textContent = text; el.style.opacity = 1;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.opacity = 0; }, dur * 1000);
}

// ---------- Dialogue bubbles ----------
function bubbleEl(style, who) {
  const el = document.createElement('div');
  el.className = `bubble ${style}`;
  el.innerHTML = `<span class="who">${who}</span><span class="txt"></span><span class="more hidden">▼</span>`;
  if (style.startsWith('thought')) el.insertAdjacentHTML('beforeend', '<span class="trail" aria-hidden="true"><i></i><i></i><i></i></span>');
  else el.insertAdjacentHTML('beforeend', '<span class="tail" aria-hidden="true"><i></i><i></i><i></i></span>');
  return el;
}
let advance = null;
let bubbleBusy = false;
// Like wait(), but the pause menu stops the count: a line is not missed behind the menu.
async function playWait(s) {
  let left = s * 1000, last = performance.now();
  while (left > 0) {
    await wait(Math.min(left, 100) / 1000);
    const now = performance.now();
    if (!G.paused) left -= now - last;
    last = now;
  }
}
async function say(lines, { who = 'VOIX', style = 'phone', pitch = 1, voiceIds = [], pos = null } = {}) {
  bubbleBusy = true;
  thoughtVoice?.stop(); thoughtVoice = null;
  for (const [index, line] of lines.entries()) {
    // Its own recording (voiceIds) or the validated take of the same text (repliques.js).
    const take = voiceIds[index] || takeFor(line);
    const voice = take ? await audio.spokenLine(take, { pos }) : null;
    const el = bubbleEl(style, who);
    $('bubbles').replaceChildren(el);
    const txt = el.querySelector('.txt');
    let skip = false;
    advance = () => { skip = true; };
    for (let i = 0; i < line.length && !skip; i++) {
      txt.textContent = line.slice(0, i + 1);
      if (!voice && i % 3 === 0 && line[i] !== ' ') audio.blip(pitch);
      await playWait('.,?!…'.includes(line[i]) ? 0.12 : 0.03);
    }
    txt.textContent = line;
    el.querySelector('.more').classList.remove('hidden');
    await new Promise((res) => {
      let done = false;
      const finish = () => { if (!done) { done = true; res(); } };
      playWait(voice ? Math.max(0.4, voice.remaining) : 3 + line.length * 0.045).then(finish);
      advance = finish;
    });
    voice?.stop();
    advance = null;
  }
  $('bubbles').replaceChildren();
  bubbleBusy = false;
}
// Inner voice, non-blocking. With a recorded take, the bubble stays until the voice has finished.
// take: the file to play when the text alone does not say which (one coat of the laundry each). The key shown at the end
// (« [C] ») is not part of the line. Resolves to the voice once it plays (null without one), for whoever waits on it.
let thoughtTimer = 0, thoughtVoice = null;
function thought(text, { glitch = false, dur = 3.2, take = null } = {}) {
  if (bubbleBusy) return Promise.resolve(null);
  const el = bubbleEl(`thought${glitch ? ' glitch' : ''}`, glitch ? '???' : 'VOUS');
  el.querySelector('.txt').textContent = text;
  $('bubbles').replaceChildren(el);
  clearTimeout(thoughtTimer);
  thoughtVoice?.stop(); thoughtVoice = null;
  const hide = () => {
    if (thoughtVoice?.remaining > 0.05 && $('bubbles').firstChild === el) { thoughtTimer = setTimeout(hide, thoughtVoice.remaining * 1000 + 150); return; }
    if ($('bubbles').firstChild === el) { thoughtVoice?.stop(); thoughtVoice = null; }
    if (!bubbleBusy) $('bubbles').replaceChildren();
  };
  thoughtTimer = setTimeout(hide, dur * 1000);
  take ??= takeFor(text.replace(/ \[[^\]]*\]$/, ''));
  if (!take) return Promise.resolve(null);
  return audio.spokenLine(take).then((line) => {
    if (!line) return null;
    if ($('bubbles').firstChild !== el || bubbleBusy) { line.stop(); return null; }
    thoughtVoice = line;
    return line;
  });
}
// A voice he hears but nobody speaks (Léa): her recording if there is one, always a subtitle. Non-blocking.
function heard({ id, text }, pos = null, { who = 'LÉA ?', dur = 3, recorded = true } = {}) {
  if (recorded) audio.voiceLine(id, { pos });
  if (bubbleBusy) return;
  subtitle(text, who, 'thought glitch', dur);
}
function subtitle(text, who, style, dur) {
  thoughtVoice?.stop(); thoughtVoice = null;
  const el = bubbleEl(style, who);
  el.querySelector('.txt').textContent = text;
  $('bubbles').replaceChildren(el);
  clearTimeout(thoughtTimer);
  thoughtTimer = setTimeout(() => { if (!bubbleBusy && $('bubbles').firstChild === el) $('bubbles').replaceChildren(); }, dur * 1000);
  return el;
}
// Someone else, heard from where they are (loudspeakers, Perrin's round, the guard, the other patients: ambiance.js),
// without stopping the player: the recording plays at pos with its subtitle. Skipped while a conversation holds the
// bubbles; resolves to true once heard, so a one-off line can wait for its turn.
const bubblesQuiet = () => !bubbleBusy && !$('bubbles').firstChild && !G.over && !ending;
async function overheard({ id, text }, pos = null, { who = 'VOIX', style = 'phone', gain = 1 } = {}) {
  if (!bubblesQuiet()) return false;
  const voice = await audio.spokenLine(id, { pos, gain });
  if (!bubblesQuiet()) { voice?.stop(); return false; }
  const dur = voice ? voice.duration + 0.3 : 2 + text.length * 0.05;
  const el = subtitle(text, who, style, dur + 5);
  await playWait(dur);
  voice?.stop();
  if ($('bubbles').firstChild === el && !bubbleBusy) $('bubbles').replaceChildren();
  return true;
}
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];

// ---------- Choices in a conversation ----------
// The options are plain buttons (outside the HUD painted through the CRT effect): mouse, finger, or keys 1 to 3.
let choiceKey = null;
// The digit of a key whatever the layout: on AZERTY the top row gives « & é " » without Shift.
const keyDigit = (e) => { const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code || ''); return m ? Number(m[1]) : /^[0-9]$/.test(e.key) ? Number(e.key) : null; };
function choose(options, { who = 'VOUS' } = {}) {
  G.mode = 'busy';
  releasePointer();
  const el = $('choices');
  el.innerHTML = `<div class="who">${who}</div>`;
  return new Promise((res) => {
    const done = (i) => { choiceKey = null; el.classList.add('hidden'); el.innerHTML = ''; audio.ui?.('click'); lockPointer(); res(i); };
    options.forEach((text, i) => {
      const b = document.createElement('button');
      b.textContent = `${i + 1}. ${text}`;
      b.addEventListener('click', () => done(i));
      el.append(b);
    });
    choiceKey = (e) => { const d = keyDigit(e); if (d === null) return; const n = d - 1; if (n >= 0 && n < options.length) done(n); };
    el.classList.remove('hidden');
  });
}

// ---------- Panels: the padlocks' wheels and the planning board, over the view ----------
// The mouse is released while one is open; Escape or « Fermer » goes back to the game.
let panelClose = null, panelKey = null;
function releasePointer() { expectUnlock = document.pointerLockElement === canvas; document.exitPointerLock?.(); }
function openPanel(build) {
  G.mode = 'panel';
  releasePointer();
  const el = $('doc');
  el.innerHTML = '<div class="panel"></div>';
  el.classList.remove('hidden');
  return new Promise((res) => {
    panelClose = (result, relock = true) => {
      panelClose = null; panelKey = null;
      el.classList.add('hidden'); el.innerHTML = '';
      if (G.mode === 'panel') G.mode = 'free';
      if (relock) lockPointer(); else if (!isTouch()) showResumeHint();
      res(result);
    };
    build(el.firstChild, (r) => panelClose?.(r));
  });
}
// Four (or n) digit wheels. labels: one caption per pair of wheels. check(code) → true opens.
function codePanel({ title, sub = '', labels = null, check }) {
  return openPanel((root, close) => {
    const n = 4, digits = Array(n).fill(0);
    root.innerHTML = `<h3>${title}</h3><div class="sub">${sub}</div><div class="wheels"></div><div class="msg"></div>
      <div class="btns"><button class="ok">Essayer</button><button class="quit">Fermer</button></div>`;
    const wheels = root.querySelector('.wheels'), msg = root.querySelector('.msg');
    let cursor = 0;
    const draw = () => {
      wheels.innerHTML = digits.map((d, i) => `<div class="wheel${i === cursor ? ' cur' : ''}" data-i="${i}"><button data-d="1">▲</button><span>${d}</span><button data-d="-1">▼</button>${labels && i % 2 === 0 ? `<em>${labels[i / 2]}</em>` : ''}</div>`).join('');
    };
    wheels.addEventListener('click', (e) => {
      const b = e.target.closest('button'), w = e.target.closest('.wheel');
      if (!w) return;
      cursor = Number(w.dataset.i);
      if (b) { digits[cursor] = (digits[cursor] + Number(b.dataset.d) + 10) % 10; audio.click(null, 0.08); }
      draw();
    });
    const tryCode = () => {
      const code = digits.join('');
      if (check(code)) { audio.ok?.(); close(true); return; }
      G.errors++; audio.locked(camera.position); msg.textContent = 'Le cadenas ne s\'ouvre pas.';
    };
    root.querySelector('.ok').addEventListener('click', tryCode);
    root.querySelector('.quit').addEventListener('click', () => close(false));
    panelKey = (e) => {
      const d = keyDigit(e);
      if (e.key === 'Enter' && e.repeat) return;
      if (d !== null) { digits[cursor] = d; cursor = Math.min(n - 1, cursor + 1); audio.click(null, 0.08); draw(); }
      else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { cursor = Math.max(0, cursor - 1); draw(); }
      else if (e.key === 'ArrowRight') { cursor = Math.min(n - 1, cursor + 1); draw(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { digits[cursor] = (digits[cursor] + (e.key === 'ArrowUp' ? 1 : 9)) % 10; draw(); }
      else if (e.key === 'Enter') tryCode();
    };
    draw();
  });
}

// ---------- Interactions ----------
// Picking, hit boxes and the outline live in focus.js.
const focus = createFocus(camera);
const occluders = focus.occluders;
// hit: { pad, min } gives a small object a larger invisible box to aim at.
function canSeeInteractable(obj) {
  // Doors remain usable by touch, so the player can always leave the dark room.
  if (hosp.interactables.some((it) => it.obj === obj && it.door)) return true;
  const p = centerOf(obj);
  return hosp.roomAt(p.x, p.y, p.z) !== 'Laverie' || (G.torch && G.torchOn);
}
function addInteractable(obj, label, act, range = 1.8, hit = null) {
  focus.add(obj, () => canSeeInteractable(obj) ? label() : null,
    () => { if (canSeeInteractable(obj)) return act(); }, range, hit);
}
let focused = null;
const CENTER = new THREE.Vector2(0, 0);
function updateFocus() {
  focused = G.mode === 'free' && G.started && !G.paused && !cam.scripted ? focus.pick(CENTER) : null;
  outline.setTarget(focused && cfg.outline ? focused.obj : null);
}
// The interactable under a screen point (NDC), or null.
const pickAt = (ndc) => focus.pick(ndc);
// Touch: a tap advances dialogue, puts a document down, or uses the object under the finger.
function tapAt(x, y) {
  if (advance || G.mode === 'doc') { interact(); return; }
  if (G.mode !== 'free' || !cfg.touchTap || cam.scripted) return;
  const it = pickAt(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1));
  if (it) it.act();
}
function interact() {
  if (advance) { advance(); return; }
  if (G.mode === 'doc') { closeDoc(); return; }
  if (focused && G.mode === 'free') focused.act();
}

// ---------- Getting to things ----------
// To use something, the player steps (the camera glides) to a free spot in front of it, around the furniture, and
// crouches for what is low. Spots are tested like the player's own position, so control comes back somewhere valid.
const UP = new THREE.Vector3(0, 1, 0);
const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function segmentFree(a, b) {
  const len = flatDist(a, b), n = Math.max(1, Math.ceil(len / 0.08));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    if (!free(a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k)) return false;
  }
  return true;
}
// Eyes at `p` can see `target`: no wall between them (furniture does not count, one leans over it). The target may lie
// on a surface (a shut door, a wall): it is tested from a few centimetres in front of it.
const inSight = (p, target) => {
  const d = p.distanceTo(target);
  if (d < 0.05) return true;
  return hosp.clearance(p, target.clone().lerp(p, Math.min(0.12, d / 2) / d)) > 0.999;
};
// A free spot about `dist` metres from `target`, on its `face` side (a horizontal unit vector from the thing towards
// the player) or else on the player's side, never behind a wall. Among the free ones, it weighs stepping back against
// going round: no further than `maxDist`, and within `spread` of the wanted side.
function standSpot(target, { face = null, dist = 0.42, maxDist = dist + 0.75, spread = face ? 1.3 : Math.PI, route = true } = {}) {
  const base = face ? Math.atan2(face.x, face.z) : Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
  let best = null, bestCost = Infinity;
  const eye = new THREE.Vector3();
  for (let d = dist; d <= maxDist + 1e-6; d += 0.06) {
    for (let a = 0; a <= spread + 1e-6; a += 0.15) {
      for (const s of a ? [1, -1] : [1]) {
        const x = target.x + Math.sin(base + a * s) * d, z = target.z + Math.cos(base + a * s) * d;
        const cost = (d - dist) * 2.5 + a * 0.35;
        if (cost < bestCost && free(x, z) && (!route || detour({ x, z }) !== null) && inSight(eye.set(x, target.y, z), target)) { best = new THREE.Vector3(x, 0, z); bestCost = cost; }
      }
    }
  }
  return best;
}
// A waypoint around furniture, [] for a clear straight path, or null when no safe route exists.
function detour(dest) {
  const a = camera.position;
  if (segmentFree(a, dest)) return [];
  let best = null, bestLen = Infinity;
  const mx = (a.x + dest.x) / 2, mz = (a.z + dest.z) / 2;
  for (const r of [0.6, 0.9, 1.2, 1.6, 2.1]) {
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2, w = { x: mx + Math.sin(ang) * r, z: mz + Math.cos(ang) * r };
      if (!free(w.x, w.z) || !segmentFree(a, w) || !segmentFree(w, dest)) continue;
      const len = flatDist(a, w) + flatDist(w, dest);
      if (len < bestLen) { bestLen = len; best = w; }
    }
    if (best) break;
  }
  return best ? [best] : null;
}
// Glide the camera along a path (through the waypoints, ending at `pos`) while turning to `quat`.
function camPath(via, pos, quat, dur) {
  const p = camTo(pos, quat, dur);
  if (via.length) {
    const pts = [camera.position.clone(), ...via.map((w) => new THREE.Vector3(w.x, Math.max(camera.position.y, pos.y), w.z)), pos.clone()];
    // Follow exactly the collision-checked segments; a spline can cut through walls.
    cam.curve = new THREE.CurvePath();
    for (let i = 1; i < pts.length; i++) cam.curve.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
  }
  return p;
}
// Walk (glide) to a camera pose, round the furniture, at a walking pace.
function goTo(pos, quat, feet = null) {
  const via = detour(feet ?? pos);
  if (via === null) return camTo(camera.position, quat, 0.35);
  let len = 0, prev = camera.position;
  // Match the waypoint height used by camPath.
  const viaY = Math.max(camera.position.y, pos.y);
  for (const w of [...via, pos]) { const y = w.y ?? viaY; len += flatDist(prev, w) + Math.abs(y - prev.y); prev = { x: w.x, y, z: w.z }; }
  const turn = camera.quaternion.angleTo(quat);
  return camPath(via, pos, quat, Math.min(2.4, Math.max(0.35 + len * 0.55, 0.3 + turn * 0.35)));
}
// Eye height to use something at height y: crouch for what is low.
const eyeFor = (y) => player.y + THREE.MathUtils.clamp(y - player.y + 0.55, 0.95, EYE);
// Step in front of `target` and look at `look`. face: see standSpot. eye: height of the eyes (default: eyeFor).
async function approach(target, { face = null, dist = 0.42, maxDist, eye = null, look = target, roll = 0 } = {}) {
  // Nothing within reach on that side: the nearest free spot anywhere around (still on this side of the walls).
  const spot = standSpot(target, { face, dist, maxDist }) ?? standSpot(target, { dist, maxDist, spread: Math.PI });
  if (!spot) { await camTo(camera.position, lookQuat(camera.position, look), 0.35); return; }
  spot.y = eye ?? eyeFor(target.y);
  cam.feet = null;
  await goTo(spot, lookQuat(spot, look, roll));
}
// Where the wrist goes so that the hand's grip (between thumb and index) or its index tip lands on `at`.
const FINGERTIP = new THREE.Vector3(-0.026, -0.03, -0.172);
function wristFor(hand, at, quat, { tip = false, lift = 0, back = 0 } = {}) {
  const off = (tip ? FINGERTIP.clone().setX(FINGERTIP.x * hand.side) : hand.grip.position.clone()).applyQuaternion(quat);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  return at.clone().sub(off).addScaledVector(UP, lift).addScaledVector(fwd, -back);
}
const handQuat = (rx, ry, rz = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
// A pose whose target point (a function or a vector) may move: the hand keeps following it.
function handOn(hand, at, rx, ry, rz, opts) {
  const q = handQuat(rx, ry, rz);
  return () => ({ pos: wristFor(hand, typeof at === 'function' ? at() : at, q, opts), quat: q });
}
const yawEuler = new THREE.Euler();
const camYaw = () => yawEuler.setFromQuaternion(camera.quaternion, 'YXZ').y; // every frame (minimap): no allocation
const yawOf = (face) => Math.atan2(face.x, face.z); // hand yaw whose fingers point against `face`

// ---------- Reaching ----------
// The arms (hands.js) hang from shoulders that follow the view, and a wrist is never more than ARM_REACH from its
// shoulder: to take something, the player stands close enough, crouches for what is low and looks a little above it,
// so that the thing sits in the lower part of the view, on the side of the hand that takes it.
const ARM_OK = ARM_REACH - 0.05; // the elbow stays a little bent
// The view from `eye` with `at` a little below the middle, towards `side` (1: right hand, -1: left, 0: both).
// drop: how far below the middle of the view `at` sits (radians).
function reachView(eye, at, side = 1, drop = 0.3) {
  const dx = at.x - eye.x, dz = at.z - eye.z;
  const pitch = THREE.MathUtils.clamp(Math.atan2(at.y - eye.y, Math.hypot(dx, dz)) + drop, -1.1, 0.4);
  return handQuat(pitch, Math.atan2(-dx, -dz) + 0.1 * side);
}
// Can the hands reach their wrist targets from the camera pose (pos, quat)? targets: [{ hand, wrist: Vector3 }].
function canReach(targets, pos, quat) {
  const S = new THREE.Vector3(), ahead = new THREE.Vector3(), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
  return targets.every(({ hand, wrist }) => {
    S.copy(hand.shoulder).applyQuaternion(quat).add(pos);
    const r = S.distanceTo(wrist);
    // Within reach, the elbow not folded flat, the wrist in front of the eyes.
    return r <= ARM_OK && r >= 0.2 && ahead.subVectors(wrist, pos).dot(fwd) > 0.12;
  });
}
// The camera pose closest to the player's habits (standing, near, on the wanted side) from which every target is
// within reach. targets: [{ hand, wrist: (spot) => Vector3 }] (the wrist may depend on where the player stands).
// at: the point to look at. face: the side to come from (see standSpot). Null if there is none.
// Bending over, the eyes go ahead of the feet: only the feet need a free spot, so one leans over a table or a bed.
const leanFor = (eye) => THREE.MathUtils.clamp((EYE - eye) * 0.6, 0.05, 0.25);
// ok(point): an extra condition on where the feet and the eyes may be (out of a door's way…).
function reachPose(targets, { at, face = null, side = 1, drop = 0.3, near = 0.22, far = 0.9, spread = face ? 1.2 : Math.PI, ok = null } = {}) {
  const base = face ? Math.atan2(face.x, face.z) : Math.atan2(camera.position.x - at.x, camera.position.z - at.z);
  const pos = new THREE.Vector3(), ground = new THREE.Vector3();
  let best = null, bestCost = Infinity;
  for (let d = near; d <= far + 1e-6; d += 0.04) {
    for (let a = 0; a <= spread + 1e-6; a += 0.12) {
      for (const s of a ? [1, -1] : [1]) {
        const ux = Math.sin(base + a * s), uz = Math.cos(base + a * s);
        const x = at.x + ux * d, z = at.z + uz * d;
        const cost0 = (d - near) * 0.8 + a * 0.4 + flatDist(camera.position, { x, z }) * 0.05;
        if (cost0 >= bestCost || !inSight(ground.set(x, at.y, z), at)) continue;
        const w = targets.map((t) => ({ hand: t.hand, wrist: t.wrist(ground) }));
        // The highest eyes that work: standing if possible.
        for (let eye = EYE; eye >= 0.95 - 1e-6; eye -= 0.05) {
          const lean = leanFor(eye), fx = x + ux * lean, fz = z + uz * lean;
          pos.set(x, player.y + eye, z);
          const quat = reachView(pos, at, side, drop);
          if (!canReach(w, pos, quat)) continue;
          const cost = cost0 + (EYE - eye) * 1.6;
          // Reject unreachable or worse poses before searching a route around the furniture.
          if (cost >= bestCost) break;
          if (!free(fx, fz) || detour({ x: fx, z: fz }) === null || (ok && (!ok({ x: fx, z: fz }) || !ok({ x, z })))) continue;
          bestCost = cost; best = { pos: pos.clone(), quat, feet: new THREE.Vector3(fx, 0, fz) };
          break;
        }
      }
    }
  }
  return best;
}
// Take a pose to use something with the hands: stay put if they already reach from here (looking at it), else walk.
async function reachFor(targets, opts) {
  const here = camera.position.clone(), look = reachView(here, opts.at, opts.side ?? 1, opts.drop ?? 0.3);
  if ((!opts.ok || opts.ok(here)) && flatDist(here, opts.at) >= (opts.near ?? 0.22) - 0.02 && canReach(targets.map((t) => ({ hand: t.hand, wrist: t.wrist(here.clone().setY(opts.at.y)) })), here, look)) { await camTo(here, look, 0.35); return true; }
  const pose = reachPose(targets, opts);
  if (!pose) { await approach(opts.at, { face: opts.face, dist: 0.3, maxDist: 0.7 }); return false; }
  await goTo(pose.pos, pose.quat, pose.feet);
  cam.feet = pose.feet;
  return true;
}
// Reach for something with a hand (two steps: over it, then onto it). grip: 'hold', 'pinch', or 'point' to touch it
// with the index tip. face: the side to come from (default: the player's side, from above). Resolves to the hand's yaw.
async function reach(pos, { hand = hands.right, grip = 'hold', face = null, pitch = null, near } = {}) {
  const tip = grip === 'point';
  const rx = pitch ?? (face ? -0.15 : -0.75);
  // From above, the fingers point away from where the player stands.
  const yawAt = (spot) => (face ? yawOf(face) : Math.atan2(spot.x - pos.x, spot.z - pos.z));
  await reachFor([{ hand, wrist: (spot) => wristFor(hand, pos, handQuat(rx, yawAt(spot)), { tip }) }], { at: pos, face, side: hand.side, near });
  const ry = yawAt(camera.position);
  await hand.to(handOn(hand, pos, rx, ry, 0, { tip, lift: face ? 0.02 : 0.07, back: face ? 0.07 : 0.02 }), 0.38, tip ? 'point' : 'open');
  await hand.to(handOn(hand, pos, rx, ry, 0, { tip }), 0.2, grip);
  return ry;
}
// While something is held up to be looked at: the player straightens up, eyes level, and the hand brings it to them.
// Resolves to a function that goes back to the pose it started from (to put the thing back where it was).
function raiseView(dur = 0.5) {
  const back = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
  const yaw = camYaw(), fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const base = (cam.feet ? camera.position.clone().setX(cam.feet.x).setZ(cam.feet.z) : camera.position.clone()).setY(Math.max(camera.position.y, player.y + EYE - 0.1));
  // Against a wall, a step back: what the hand shows must not sink into it (Arm.update would pull the hand down).
  const pos = base.clone(), ahead = new THREE.Vector3();
  for (let d = 0; d <= 0.5 + 1e-6; d += 0.05) {
    const p = base.clone().addScaledVector(fwd, -d);
    if (d && !free(p.x, p.z)) break;
    pos.copy(p);
    if (hosp.clearance(p, ahead.copy(p).addScaledVector(fwd, 0.55), 0.03) >= 0.999) break;
  }
  if (cam.feet) cam.feet.set(pos.x, 0, pos.z);
  camTo(pos, handQuat(-0.2, yaw), dur);
  return (d = dur) => camTo(back.pos, back.quat, d);
}
const restRight = (dur = 0.45) => hands.right.to(hands.rest.right, dur, 'relaxed');
const done = () => { if (G.mode === 'busy') G.mode = 'free'; };
// Run fn(k) for k from 0 to 1 (eased by `curve`) over about dur seconds (give or take `jitter`, a fraction).
function tween(dur, fn, curve = ease.body, jitter = 0.06) {
  const t0 = performance.now(), ms = vary(dur, jitter) * 1000;
  return new Promise((res) => {
    const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); fn(curve(k)); if (k < 1) requestAnimationFrame(step); else res(); };
    step();
  });
}
// Shown on the palm: the hand turns palm up in front of the eyes, the fingers cradling it, above the speech bubbles.
// dist: how far from the eyes (further for something big).
const PALM_UP = (dist = 0.3) => camPose(camera, 0.04, -0.03 - (dist - 0.3) * 0.5, -dist, 0.6, -0.25, Math.PI);
// Guide the right thumb upwards before turning the palm over. A single slerp
// to a half-turn can choose the opposite, outward wrist rotation.
const PALM_SIDE = (dist = 0.3) => camPose(camera, 0.08, -0.1, -dist, 0.2, -0.25, -Math.PI / 2);
// As the hand turns, the thing held settles flat on the palm (its top up), or (back = true) goes back to how it was
// taken. Resolves to the way back (`present(obj, true)` once the hand returns).
function present(obj, dur, rel = null) {
  const from = { pos: obj.position.clone(), quat: obj.quaternion.clone() };
  let to = rel;
  if (!to) {
    // Turned over in the grip's frame (whose -y is the palm's side, up once the palm is up): its base on the grip
    // point (props stand on their origin), its centre over it.
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    const c = obj.worldToLocal(centerOf(obj)).setY(0).applyQuaternion(quat);
    to = { pos: c.negate(), quat };
  }
  tween(dur, (k) => { obj.position.lerpVectors(from.pos, to.pos, k); obj.quaternion.slerpQuaternions(from.quat, to.quat, k); }, ease.reach);
  return from;
}
// Pick something up, look at it on the palm (turning it a little), then put it back exactly where it was.
async function inspect(obj, { text, glitch = false, grip = 'pinch', far = false, turn = 0.6, secs = 2.6 } = {}) {
  const hold = PALM_UP(far ? 0.36 : 0.3);
  G.mode = 'busy';
  const at = centerOf(obj);
  const ry = await reach(at, { grip });
  audio.pickup();
  const home = { parent: obj.parent, pos: obj.position.clone(), quat: obj.quaternion.clone() };
  const graspPose = { pos: hands.right.wrist.clone(), quat: hands.right.wristQ.clone() };
  hands.right.grip.attach(obj);
  const lower = raiseView(0.55);
  const taken = present(obj, 0.55);
  await hands.right.to(PALM_SIDE(far ? 0.36 : 0.3), 0.2, grip);
  await hands.right.to(hold, 0.35, 'relaxed');
  if (text) thought(text, { glitch, dur: secs + 0.6 });
  const q0 = obj.quaternion.clone();
  // Turned one way, then back, tilted a little to catch the light: never the same twice.
  const seed = Math.random() * 50, side = Math.random() < 0.5 ? -1 : 1, tiltAxis = new THREE.Vector3(1, 0, 0);
  await tween(secs, (k) => {
    const a = Math.sin(ease.inOutSine(k) * Math.PI) * turn * side + drift(k * 2.5, seed) * 0.12;
    const tilt = arc(k) * drift(k * 1.7, seed + 9) * 0.3;
    obj.quaternion.copy(q0).multiply(tmpQ.setFromAxisAngle(UP, a)).multiply(new THREE.Quaternion().setFromAxisAngle(tiltAxis, tilt));
  }, ease.linear, 0);
  // Back down to where it was taken (the hand rides with the view), then the hand puts it down.
  await lower(0.45);
  await hands.right.to(PALM_SIDE(far ? 0.36 : 0.3), 0.2, grip);
  present(obj, 0.45, taken);
  await hands.right.to(() => graspPose, 0.45, grip);
  home.parent.attach(obj);
  obj.position.copy(home.pos); obj.quaternion.copy(home.quat);
  audio.click(at, 0.08);
  await hands.right.to(handOn(hands.right, at, -0.75, ry, 0, { lift: 0.08 }), 0.2, 'open');
  await restRight();
  done();
}
// Step up to something and look at it closely (no hands).
async function lookAt(target, { face = null, dist = 0.6, eye = null, text, glitch = false, secs = 2.2 } = {}) {
  G.mode = 'busy';
  await approach(target, { face, dist, eye: eye ?? player.y + THREE.MathUtils.clamp(target.y - player.y + 0.1, 1.0, EYE) });
  if (text) thought(text, { glitch, dur: secs + 1 });
  await wait(secs);
  done();
}

// stay: keep the pose (the other hand is busy holding something up, the pillow).
async function pickUpCoin(obj, _where, { stay = false } = {}) {
  G.mode = 'busy';
  const p = centerOf(obj);
  await reach(p, { grip: 'pinch' });
  audio.pickup('coin');
  hands.right.grip.attach(obj);
  // Under the pillow, keep the pinch: turning the palm up and back adds an
  // unnecessary wrist roll while the other hand is still holding the pillow.
  if (!stay) {
    raiseView(0.45);
    present(obj, 0.45);
    await hands.right.to(PALM_SIDE(), 0.2, 'pinch');
    await hands.right.to(PALM_UP(), 0.25, 'relaxed');
    await wait(0.4);
  }
  await hands.right.to(camPose(camera, 0.24, -0.5, -0.1, -0.6, 0, 0), 0.35, 'pinch');
  obj.parent.remove(obj);
  G.coins++;
  toast('Une pièce');
  await restRight(0.35);
  done();
  if (G.coins === 1 && G.hints === 0) setTimeout(() => thought('Une pièce… Le vieux téléphone marche peut-être encore.'), 600);
}

async function takeBottle(bottle = assets.pills, count = 2) {
  G.mode = 'busy';
  const b = boxOf(bottle), p = b.getCenter(new THREE.Vector3());
  // Fingers around the bottle, from the side.
  const face = new THREE.Vector3(camera.position.x - p.x, 0, camera.position.z - p.z).normalize();
  await reach(p, { face, grip: 'hold', pitch: -0.35 });
  audio.rattle();
  hands.right.grip.attach(bottle);
  raiseView(0.45);
  await hands.right.to(camPose(camera, 0.08, -0.07, -0.32, 0.35, -0.3, 0), 0.45, 'hold');
  // A shake: it rattles.
  await tween(0.5, (k) => { hands.right.shake = Math.sin(k * Math.PI) * 4; });
  hands.right.shake = 0;
  await hands.right.to(camPose(camera, 0.24, -0.5, -0.1, -0.6, 0, 0), 0.35, 'hold');
  bottle.visible = false;
  if (bottle === assets.pills) G.bottleTaken = true;
  G.pills += count;
  toast(`Flacon de cachets ×${count} · ${ctl('kPill')} pour en prendre un`, 3.5);
  await restRight(0.35);
  done();
}

const pillMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.014, 2, 6), new THREE.MeshBasicMaterial({ color: 0xd9d2c0 }));
let relief = 0, pillBargain = -Infinity;
async function takePill() {
  if (G.mode !== 'free' || G.pills <= 0) return;
  G.mode = 'busy';
  audio.rattle();
  hands.right.hand.add(pillMesh);
  // Rest on the palm itself: the grip sits below it, between thumb and index.
  // In the hand's frame the palm surface here is y ≈ -0.018 m; the rotated capsule half-height is 0.0052 m.
  pillMesh.position.set(0, -0.0232, -0.045); pillMesh.rotation.set(0, 0, Math.PI / 2); pillMesh.visible = true;
  await hands.right.to(PALM_UP(), 0.45, 'relaxed');
  // From the second one on, he bargains with himself (not every time).
  if (G.pillsTaken >= 1 && G.time - pillBargain > 90) { pillBargain = G.time; thought('Un cachet. Juste un.'); }
  await wait(0.35);
  const mouthQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.25, -0.3, Math.PI));
  await hands.right.to(() => {
    const quat = camera.quaternion.clone().multiply(mouthQ);
    return { pos: wristFor(hands.right, camera.localToWorld(new THREE.Vector3(0, -0.09, -0.05)), quat), quat };
  }, 0.35, 'relaxed');
  pillMesh.visible = false;
  audio.swallow();
  G.pills--; G.pillsTaken++;
  G.sanity = Math.min(1, G.sanity + 0.4);
  relief = 1;
  audio.relief();
  await hands.right.to(hands.rest.right, 0.45, 'relaxed');
  if (G.mode === 'busy') G.mode = 'free';
  if (G.pills === 0) toast('Le flacon est vide.');
}

async function takeTorch() {
  G.mode = 'busy';
  const p = centerOf(torch);
  await reach(p, { face: torch.userData.drawerFace ?? null, near: 0.45, pitch: -0.6 });
  audio.pickup('torch');
  hands.right.grip.attach(torch);
  raiseView(0.45);
  await hands.right.to(camPose(camera, 0.05, -0.07, -0.32, 0.3, 0.2, 0), 0.45, 'hold');
  // The left hand takes it from the right one, beam forward; it clicks on.
  const leftQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -0.2, 0));
  await hands.left.to(() => { const quat = camera.quaternion.clone().multiply(leftQ); return { pos: wristFor(hands.left, centerOf(torch), quat), quat }; }, 0.3, 'open');
  hands.left.curlTarget = 'fist';
  await wait(0.12);
  hands.left.grip.attach(torch);
  present(torch, 0.25, { pos: new THREE.Vector3(0, 0, -0.02), quat: new THREE.Quaternion() });
  G.torch = true; G.torchOn = true; takingTorch = true; // shown and lit at once, though the player is still busy
  audio.torchClick(true);
  toast(`Lampe torche · ${ctl('kTorch')} pour l'allumer ou l'éteindre`, 3.5);
  await restRight(0.4);
  takingTorch = false;
  done();
}
function toggleTorch() {
  if (!G.torch || G.mode === 'computer') return;
  G.torchOn = !G.torchOn;
  audio.torchClick(G.torchOn);
}
// Show the torch only while walking around; the phone and the computer need both hands.
let takingTorch = false;
function updateTorch(t) {
  const want = G.torch && G.torchOn && (G.mode === 'free' || G.mode === 'doc' || G.mode === 'fallen' || takingTorch);
  if (G.torch) torch.visible = want || (G.mode === 'free' && torchShown);
  if (want !== torchShown && G.torch) {
    torchShown = want;
    if (want) hands.left.to(torchHold, 0.35, 'fist');
    else if (G.mode === 'free') hands.left.to(hands.rest.left, 0.35, 'relaxed');
  }
  let k = want ? 1 : 0;
  if (want && loss() > 0.5 && Math.sin(t * 31) * Math.sin(t * 7.3) > 0.75) k = 0.15;
  torchLight.intensity = 22 * k * cfg.dTorchPow;
  torch.userData.lens.material.color.setScalar(k ? 3 : 0.3);
}

// ---------- Documents ----------
const closeHint = () => (isTouch() ? 'Toucher pour reposer' : `${keyLabel(cfg.kInteract)} / clic : reposer`);
// kind: 'photo', a key of DOCS (histoire.js), or raw HTML for the sheet.
let docClosed = null; // what to do once the document is put down (put the sheet back…)
function showDoc(kind, onClose = null) {
  G.mode = 'doc';
  docClosed = onClose;
  const el = $('doc');
  if (kind === 'photo') {
    const c = document.createElement('canvas'); c.width = 48; c.height = 58;
    drawPhoto(c.getContext('2d'));
    el.replaceChildren(c);
    el.insertAdjacentHTML('beforeend', `<div class="close">${closeHint()}</div>`);
    setTimeout(() => thought('Une photo d\'enfant… Je ne sais même plus qui c\'est.'), 300);
  } else {
    el.innerHTML = `<div class="sheet">${DOCS[kind] ?? kind}</div><div class="close">${closeHint()}</div>`;
  }
  el.classList.remove('hidden');
  audio.paper();
}
function closeDoc() {
  $('doc').classList.add('hidden'); G.mode = 'free'; audio.paper();
  const then = docClosed; docClosed = null; then?.();
}
// A sheet lying flat (the fiche on the desk): picked up, read, put back.
async function readSheet(sheet, kind) {
  G.mode = 'busy';
  const at = centerOf(sheet);
  await reach(at, { grip: 'pinch' });
  const home = { parent: sheet.parent, pos: sheet.position.clone(), quat: sheet.quaternion.clone() };
  const grasp = { pos: hands.right.wrist.clone(), quat: hands.right.wristQ.clone() };
  hands.right.grip.attach(sheet);
  const lower = raiseView(0.5);
  await hands.right.to(camPose(camera, 0.02, -0.08, -0.3, 1.1, -0.1, 0), 0.5, 'pinch');
  showDoc(kind, async () => {
    G.mode = 'busy';
    await lower(0.4);
    await hands.right.to(() => grasp, 0.4, 'pinch');
    home.parent.attach(sheet);
    sheet.position.copy(home.pos); sheet.quaternion.copy(home.quat);
    await restRight(0.4);
    done();
  });
}
// The photo above the bed: lean over to look at it.
async function lookPhoto() {
  G.mode = 'busy';
  const at = centerOf(world.photo);
  await approach(at, { face: new THREE.Vector3(0, 0, 1), dist: 0.5, maxDist: 1.8, eye: at.y + 0.08 });
  showDoc('photo');
}
$('doc').addEventListener('click', () => { if (G.mode === 'doc') closeDoc(); });

// ---------- Pay phones (room 104 and the entrance hall) ----------
// A coin buys a hint about the current énigme (histoire.js), one per énigme at most.
// Each phone hangs on a wall facing +x: everything is placed from its base (wall, floor, centre).
const phones = [];
const phoneCordAnchor = new THREE.Vector3();
let livePhone = null;
function makeCoinBox(base) {
  const b = coinBox.clone(true);
  b.position.copy(base).add(new THREE.Vector3(0.035, 1.3, -0.2));
  scene.add(b);
  return b;
}
// A coin from the pocket, shown, then pushed edgewise into a slot whose front faces `face` (the hand already reaches).
async function insertCoin(slotPos, face) {
  const coin = world.makeCoin();
  hands.right.grip.add(coin);
  coin.position.set(0, 0, 0); coin.rotation.set(0, 0, Math.PI / 2);
  await hands.right.to(camPose(camera, 0.08, -0.07, -0.32, 0.25, -0.15, 0), 0.45, 'pinch');
  await wait(0.2);
  const slot = (out) => handOn(hands.right, slotPos.clone().addScaledVector(face, out), -0.05, yawOf(face), 0);
  await hands.right.to(slot(0.05), 0.45, 'pinch');
  await hands.right.to(slot(0.0), 0.22, 'pinch');
  coin.removeFromParent();
  audio.coinDrop(slotPos);
  await hands.right.to(slot(0.06), 0.15, 'relaxed');
}
// The switchboard's answering machine, for a call without a coin (once, and once more when he is far gone).
const ANSWERING = ['C.H.S. Les Tilleuls, bonsoir. Le standard est fermé de vingt-deux heures à six heures.', 'Pour une urgence, composez le quinze.', 'Merci de votre appel.'];
const ANSWERING_LOST = [ANSWERING[0], 'Patient de la chambre cent quatre, retournez vous coucher.'];
let answered = 0;
const PATIENT_SAYS = { who: 'VOUS', style: 'thought' };
async function usePhone(P) {
  const face = new THREE.Vector3(1, 0, 0), facing = yawOf(face); // every phone hangs on a wall facing +x
  const answering = G.coins <= 0 && (answered === 0 || (answered === 1 && loss() > 0.55));
  if (G.coins <= 0 && !answering) {
    // No coin: a finger in the empty slot, the return button clicks, nothing more.
    G.mode = 'busy';
    await reach(P.slot, { face, grip: 'point', pitch: 0 });
    audio.click(P.slot);
    await wait(0.15);
    await restRight(0.35);
    done();
    thought('Il faut une pièce pour appeler. Il doit bien en traîner quelque part.');
    return;
  }
  const stage = stageOf(G);
  if (!answering && G.hinted[stage]) { thought('J\'ai déjà eu mon indice pour ça. Réfléchis.'); return; }
  G.mode = 'busy';
  const phone = P.root, handset = P.handset, B = P.base;
  livePhone = P;
  const between = B.clone().add(new THREE.Vector3(0, 1.28, -0.1));
  const hsPos = centerOf(handset.getObjectByName('handset_handle'));
  const dial = phone.getObjectByName('dial');
  const dialC = centerOf(phone.getObjectByName('dial_center'));
  // Where both hands reach the slot, the dial and the handset.
  const coinQ = handQuat(-0.05, facing), dialQ = handQuat(-0.1, facing), hsQ = handQuat(0, facing, Math.PI / 2);
  await reachFor([
    { hand: hands.right, wrist: () => wristFor(hands.right, P.slot, coinQ) },
    { hand: hands.right, wrist: () => wristFor(hands.right, dialC.clone().addScaledVector(face, 0.012), dialQ, { tip: true }) },
    { hand: hands.left, wrist: () => wristFor(hands.left, hsPos, hsQ) },
  ], { at: between, face, side: 0, drop: 0.12, near: 0.4 });

  // 1. A coin into the slot (none: he dials the switchboard all the same).
  if (!answering) {
    await insertCoin(P.slot, face);
    G.coins--; G.hints++;
    G.hinted[stage] = true;
  }
  hands.right.to(hands.rest.right, 0.4, 'relaxed');

  // 2. The left hand takes the handset off the hook (thumb up around the handle) and holds it to the ear.
  const grab = handOn(hands.left, hsPos, 0, facing, Math.PI / 2);
  await hands.left.to(handOn(hands.left, hsPos.clone().addScaledVector(face, 0.06), 0, facing, Math.PI / 2), 0.45, 'open');
  await hands.left.to(grab, 0.18, 'hold');
  hands.left.grip.attach(handset);
  audio.click(hsPos, 0.25);
  phoneCordAnchor.copy(P.cordAnchor);
  liveCord.visible = true; phone.getObjectByName('cord').visible = false;
  await hands.left.to(handOn(hands.left, hsPos.clone().addScaledVector(face, 0.12).add(new THREE.Vector3(0, 0.05, 0)), 0, facing, Math.PI / 2), 0.25, 'hold');
  // At the ear: beside the cheek, mostly out of the view.
  await hands.left.to(camPose(camera, -0.17, -0.11, 0.0, 0.1, 0.35, Math.PI / 2 - 0.2), 0.6, 'hold');
  audio.dialTone();

  // 3. Dial the switchboard: the index goes into a hole and turns the dial to the stop, the dial runs back alone.
  // Point of the dial at radius r and angle a (in the dial's plane, turning with it), slightly in front of it.
  const hole = (a, r = 0.038) => {
    const t = a + dial.rotation.z;
    return dialC.clone().add(new THREE.Vector3(0.012, r * Math.sin(t), -r * Math.cos(t)));
  };
  for (const a of [2.3, 1.5]) {
    const finger = (out = 0) => handOn(hands.right, () => hole(a).addScaledVector(face, out), -0.1, facing, 0, { tip: true });
    await hands.right.to(finger(0.04), 0.4, 'point');
    await hands.right.to(finger(0), 0.12, 'point');
    await tween(0.45, (k) => { dial.rotation.z = -1.6 * k; }, ease.reach);
    audio.dialWhirr(dialC);
    // Finger out, the dial runs back.
    hands.right.to(handOn(hands.right, hole(a).addScaledVector(face, 0.05), -0.1, facing, 0, { tip: true }), 0.15, 'point');
    await tween(0.5, (k) => { dial.rotation.z = -1.6 * (1 - k); }, ease.governor, 0.03);
  }
  restRight(0.5);
  audio.ringback(0.3); audio.ringback(2.3);
  await wait(4.0);
  audio.pickupLine();
  await wait(0.5);

  // 4. The voice gives the hint for the énigme in progress; the answering machine without a coin.
  const call = G.hints, voice = { who: 'VOIX AU TÉLÉPHONE', style: 'phone', pitch: 0.75 };
  let cut = false;
  if (answering) {
    answered++;
    await say(answered === 2 ? ANSWERING_LOST : ANSWERING, { who: 'STANDARD', style: 'phone', pitch: 0.9 });
  } else {
    // The first time, nobody seems to be there at first.
    if (call === 1) await say(['Allô ? …Allô ?'], PATIENT_SAYS);
    const lines = [...HINTS[stage]];
    // He has taken a lot of pills: the voice hears it.
    if (G.pillsTaken >= 3 && !G.toldPills) { G.toldPills = true; lines.splice(1, 0, 'Tu as encore pris tes cachets, hein ? Tu as la voix pâteuse.'); }
    await say(lines, voice);
    // Then he asks who it is; the voice does not say, and knows he always asks. The last call ends on its own
    // words (HINTS[7]: « …Et cette fois, ne reviens pas. »).
    const more = stage < 7;
    if (more && P.key === 'wall_phone_accueil' && !G.toldCut) {
      // At the reception, someone comes: the voice hangs up on him.
      G.toldCut = true;
      await say(['Quelqu\'un vient. Raccroche. Raccroche !'], voice);
      audio.hangUp(null);
      cut = true;
      await say(['Attendez ! Ne raccrochez pas !'], PATIENT_SAYS);
    } else if (more && call === 1) {
      await say(['Qui est à l\'appareil ?'], PATIENT_SAYS);
      await say(['Ne me demande pas qui je suis. On n\'a pas le temps.'], voice);
    } else if (more && call === 2) {
      await say(['Comment vous savez où je suis ?'], PATIENT_SAYS);
      await say(['Tu poses toujours les mêmes questions.'], voice);
    } else if (more && call === 3) {
      await say(['Qui est à l\'appareil ?'], PATIENT_SAYS);
      await say(['Je t\'ai déjà dit tout ça. La dernière fois.'], voice);
    }
  }
  if (!cut) audio.noise(0.4, { f: 600, gain: 0.05 });

  // 5. Hang up: the handset goes back on its hook.
  await hands.left.to(handOn(hands.left, hsPos.clone().addScaledVector(face, 0.08).add(new THREE.Vector3(0, 0.04, 0)), 0, facing, Math.PI / 2), 0.55, 'hold');
  await hands.left.to(grab, 0.2, 'hold');
  handset.removeFromParent();
  P.home.parent.add(handset);
  handset.position.copy(P.home.position); handset.quaternion.copy(P.home.quaternion);
  audio.hangUp(hsPos);
  liveCord.visible = false; phone.getObjectByName('cord').visible = true;
  livePhone = null;
  await hands.left.to(handOn(hands.left, hsPos.clone().addScaledVector(face, 0.07), 0, facing, Math.PI / 2), 0.2, 'open');
  await hands.left.to(hands.rest.left, 0.4, 'relaxed');
  done();
  if (answering) { thought('Il faut une pièce pour appeler. Il doit bien en traîner quelque part.'); return; }
  // After the first call, the voice stays with him.
  if (call === 1) setTimeout(() => thought('Cette voix… je la connais.'), 700);
  if (G.coins === 0 && stage < 7) setTimeout(() => thought('Plus de pièce. Il va falloir me débrouiller.'), call === 1 ? 4500 : 800);
}
function updateCord() {
  if (!liveCord.visible || !livePhone) return;
  const [p0, p1, mid, p3, end] = cordCurve.points;
  livePhone.handset.getObjectByName('handset_mouthpiece').getWorldPosition(end);
  p0.copy(phoneCordAnchor);
  mid.copy(p0).lerp(end, 0.5); mid.y -= 0.22;
  p1.copy(p0).lerp(mid, 0.5); p1.y -= 0.05;
  p3.copy(mid).lerp(end, 0.5);
  // Same vertex count every frame: the new positions are copied into the buffers already on the GPU.
  const tube = new THREE.TubeGeometry(cordCurve, 28, 0.006, 4, false);
  const g = liveCord.geometry;
  if (!g.index) { liveCord.geometry.dispose(); liveCord.geometry = tube; return; }
  for (const name of ['position', 'normal']) { g.attributes[name].array.set(tube.attributes[name].array); g.attributes[name].needsUpdate = true; }
  g.computeBoundingSphere();
  tube.dispose();
}
const cordCurve = new THREE.CatmullRomCurve3(Array.from({ length: 5 }, () => new THREE.Vector3()));
async function addPhone(key, base) {
  const root = await place('wall_phone', { x: base.x, z: base.z, y: base.y + 1.08, ry: Math.PI / 2, wallX: base.x, key });
  root.userData.home = root.position.clone();
  const handset = root.getObjectByName('handset');
  const cordBox = new THREE.Box3().setFromObject(root.getObjectByName('cord'));
  const P = {
    key, root, handset, base, home: { parent: handset.parent, position: handset.position.clone(), quaternion: handset.quaternion.clone() },
    slot: base.clone().add(new THREE.Vector3(0.075, 1.345, -0.2)),
    cordAnchor: new THREE.Vector3((cordBox.min.x + cordBox.max.x) / 2, cordBox.max.y, (cordBox.min.z + cordBox.max.z) / 2),
  };
  P.box = key === 'wall_phone' ? coinBox : makeCoinBox(base);
  const label = () => (G.coins > 0 ? 'Téléphoner (1 pièce = 1 indice)' : 'Téléphone payant');
  addInteractable(root, label, () => usePhone(P), 1.9, { pad: 0.03 });
  addInteractable(P.box, () => (G.coins > 0 ? 'Téléphoner (1 pièce = 1 indice)' : 'Monnayeur : 1 F'), () => usePhone(P), 1.9, { pad: 0.02 });
  phones.push(P);
  return P;
}

// ---------- Computers (archives, security post) ----------
// Each one: a terminal model on a desk, its own MEDISYS (os.js) whose canvas is the screen texture and, while the player
// sits at it, the sharp overlay projected on the screen.
const computers = [];
let pcAt = null; // the computer in use
let targetFov = cfg.fov;
const screenNormal = (C) => new THREE.Vector3(Math.sin(C.yaw), 0, Math.cos(C.yaw));
async function addComputer({ key, x, z, floorY, yaw, profile, onRead, onUnlock }) {
  const pc = await place('terminal', { x, z, ry: yaw, y: floorY + TABLE.h, key });
  const os = new MiniOS({ audio, profile, onRead, onUnlock, onError: () => { G.errors++; },
    // The screen's glitch: the player sitting at it hears and sees it (HAL_09 « Il ne sortira jamais », the others).
    onGlitch: (text) => { const id = halOf(text); if (id && pcAt === C && G.mode === 'computer') voices.hal(id, { strength: loss() }); } });
  const C = { pc, os, yaw, floorY, keys: new THREE.Vector3(), mouse: new THREE.Vector3() };
  const screenMesh = pc.getObjectByName('screen');
  screenMesh.material = new THREE.MeshBasicMaterial({ color: 0x07100c });
  screenMesh.geometry.computeBoundingBox();
  const sb = screenMesh.geometry.boundingBox, sw = (sb.max.x - sb.min.x) * 0.86, sh = (sb.max.y - sb.min.y) * 0.84;
  C.screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: os.texture, color: new THREE.Color(1.1, 1.15, 1.1) }));
  C.screen.position.set((sb.min.x + sb.max.x) / 2, (sb.min.y + sb.max.y) / 2, sb.max.z + 0.002);
  C.screen.userData = { w: sw, h: sh };
  screenMesh.add(C.screen);
  pc.updateMatrixWorld(true);
  const glow = new THREE.PointLight(0x9fe0c0, 0.5, 1.6, 2);
  C.screen.getWorldPosition(glow.position);
  os.pos = glow.position.clone(); // where its sounds come from
  glow.position.addScaledVector(screenNormal(C), 0.4);
  scene.add(glow);
  const kb = new THREE.Box3().setFromObject(pc.getObjectByName('keyboard_keys'));
  kb.getCenter(C.keys); C.keys.y = kb.max.y + 0.03;
  C.keys.add(new THREE.Vector3(-0.07 * Math.cos(yaw), 0, 0.07 * Math.sin(yaw)));
  const mb = new THREE.Box3().setFromObject(pc.getObjectByName('mouse_body'));
  mb.getCenter(C.mouse); C.mouse.y = mb.max.y + 0.02;
  addInteractable(pc, () => 'Utiliser l\'ordinateur', () => useComputer(C), 1.9);
  computers.push(C);
  return C;
}
async function useComputer(C) {
  G.mode = 'busy';
  pcAt = C;
  const os = C.os;
  const center = new THREE.Vector3(); C.screen.getWorldPosition(center);
  const seat = center.clone().addScaledVector(screenNormal(C), 0.62); seat.y = C.floorY + 1.18;
  // Round the desk to the chair first if needed, then sit down.
  if (flatDist(camera.position, seat) > 0.75 || !segmentFree(camera.position, seat, 0.3)) await approach(center, { face: screenNormal(C), dist: 0.95, eye: C.floorY + EYE, look: center });
  bodySeat = { pos: seat.clone().addScaledVector(screenNormal(C), 0.16), yaw: C.yaw };
  // Sitting down: the head goes forward a little and drops, the chair takes the weight.
  const sitVia = camera.position.clone().lerp(seat, 0.75).setY(seat.y - 0.06);
  await camTo(seat, lookQuat(seat, center.clone().add(new THREE.Vector3(0, -0.05, 0))), 0.95, { via: sitVia, walk: false, lean: 0 });
  const ry = C.yaw;
  hands.left.to(worldPose(C.keys, -0.15, ry, 0), 0.5, 'type');
  await hands.right.to(worldPose(C.mouse, -0.1, ry, 0), 0.5, 'hold');
  // The right hand follows the OS cursor on the mouse.
  hands.right.fn = () => {
    const u = (os.mouse.x / OS_W - 0.5) * 0.08, v = (os.mouse.y / OS_H - 0.5) * 0.06;
    const p = C.mouse.clone().add(new THREE.Vector3(Math.cos(ry) * u + Math.sin(ry) * v, 0, -Math.sin(ry) * u + Math.cos(ry) * v));
    return { pos: p, quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, ry, 0, 'YXZ')) };
  };
  // Then lean in: the screen fills most of the view so the OS is readable.
  await wait(0.25);
  const close = center.clone().addScaledVector(screenNormal(C), 0.36); close.y = center.y + 0.005;
  targetFov = isTouch() ? 36 : 50; // phones: zoom in further so the OS text stays readable
  await camTo(close, lookQuat(close, center), 0.75, { ease: ease.inOutSine, walk: false, lean: 0 });
  expectUnlock = document.pointerLockElement === canvas;
  document.exitPointerLock?.();
  // The overlay shows this computer's canvas.
  const layer = $('osLayer');
  layer.querySelector('canvas')?.remove();
  layer.prepend(os.canvas);
  os.canvas.style.width = `${OS_W}px`; os.canvas.style.height = `${OS_H}px`;
  G.mode = 'computer';
  os.setActive(true, G.time);
  layer.classList.remove('hidden');
  $('osHint').classList.remove('hidden');
}
async function leaveComputer(relock) {
  if (G.mode !== 'computer') return;
  const C = pcAt;
  G.mode = 'busy';
  C.os.setActive(false, G.time);
  $('osLayer').classList.add('hidden');
  $('osHint').classList.add('hidden');
  hands.restBoth(0.5);
  targetFov = cfg.fov;
  const center = new THREE.Vector3(); C.screen.getWorldPosition(center);
  // Rise over the seat: a walking route from inside the chair collider cannot exist.
  const stand = standSpot(center, { face: screenNormal(C), dist: 1.0, route: false }) ?? center.clone().addScaledVector(screenNormal(C), 1.15);
  stand.y = C.floorY + EYE;
  bodySeat = null;
  // Getting up: pushed up over the seat first, then a step back from the desk.
  const upVia = camera.position.clone().lerp(stand, 0.3).setY(stand.y - 0.1);
  await camTo(stand, lookQuat(stand, center.clone().add(new THREE.Vector3(0, -0.2, 0))), 1.0, { via: upVia, walk: false });
  releaseCam();
  pcAt = null;
  if (G.mode === 'busy') G.mode = 'free';
  if (relock) lockPointer(); else if (!isTouch()) showResumeHint();
}

// Map the OS canvas onto the projected screen quad (CSS matrix3d homography).
function solve(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
  return x;
}
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}
function invert3(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g;
  const det = a * A + b * B + c * Cc;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
let Hinv = null;
const crt = $('osLayer').querySelector('.crt');
crt.style.width = `${OS_W}px`; crt.style.height = `${OS_H}px`;
function updateOverlay() {
  if (G.mode !== 'computer' || !pcAt) return;
  const screenPlane = pcAt.screen;
  const { w, h } = screenPlane.userData;
  const corners = [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h / 2], [-w / 2, -h / 2]].map(([x, y]) => {
    const p = screenPlane.localToWorld(new THREE.Vector3(x, y, 0)).project(camera);
    return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight];
  });
  const H = homography([[0, 0], [OS_W, 0], [OS_W, OS_H], [0, OS_H]], corners);
  const css = `matrix3d(${H[0][0]},${H[1][0]},0,${H[2][0]},${H[0][1]},${H[1][1]},0,${H[2][1]},0,0,1,0,${H[0][2]},${H[1][2]},0,${H[2][2]})`;
  pcAt.os.canvas.style.transform = css; crt.style.transform = css;
  Hinv = invert3(H);
}
function toOS(cx, cy) {
  if (!Hinv) return null;
  const x = Hinv[0][0] * cx + Hinv[0][1] * cy + Hinv[0][2];
  const y = Hinv[1][0] * cx + Hinv[1][1] * cy + Hinv[1][2];
  const w = Hinv[2][0] * cx + Hinv[2][1] * cy + Hinv[2][2];
  return [x / w, y / w];
}

// ---------- Door: the service key from the locked box ----------
// Code = the last two digits of the room + the patient number (histoire.js): 04 + 27.
function unlockRoom(sound = true) {
  G.unlocked = true;
  world.lockLed.material.color.setRGB(0.2, 3, 0.4);
  if (roomBox) {
    roomBox.open = roomBox.keyTaken = true;
    roomBox.lid.rotation.x = 1.7;
    roomBox.key.visible = false;
  }
  if (sound) audio.doorUnlock(new THREE.Vector3(RX, 1.2, DOOR.z));
}
let roomBox = null;
let doorTries = 0; // tries at the locked door: the second time, he bangs on it
// The lever of the room door (the one of the leaf shown: it changes with the decay).
function doorLever() {
  let lever = null;
  world.doorPivot.traverse((o) => {
    if (lever || o.name !== 'handle_lever_front') return;
    for (let p = o; p; p = p.parent) { if (!p.visible) return; if (p === world.doorPivot) break; }
    lever = o;
  });
  return lever;
}
async function useDoor() {
  if (G.doorOpen) return;
  G.mode = 'busy';
  const lever = doorLever();
  const at = () => (lever ? centerOf(lever) : new THREE.Vector3(RX - 0.035, 1.05, DOOR.z + 0.34));
  const face = new THREE.Vector3(-1, 0, 0), ry = yawOf(face);
  // Hand on the lever, palm down, then press it.
  const onLever = (down = 0) => handOn(hands.right, () => at().add(new THREE.Vector3(0, 0.012 - down, 0)), -0.25, ry, 0);
  await reach(at(), { face, pitch: -0.25 });
  await hands.right.to(onLever(0), 0.12, 'hold');
  if (!G.unlocked) {
    if (roomBox?.keyTaken) {
      audio.doorUnlock(at());
      unlockRoom(false);
      toast('Chambre déverrouillée avec la clé de service', 3);
    } else {
      await hands.right.to(onLever(0.03), 0.12, 'hold');
      audio.locked(at());
      await restRight(0.35);
      done();
      // The second time, he loses his temper and bangs on the door; then the hint again.
      doorTries++;
      if (doorTries === 2) { audio.knock(at()); thought('Ouvrez ! Je sais que vous êtes là !'); }
      else thought('Fermée à clé… Le soignant a laissé une boîte sur le bureau.');
      return;
    }
  }
  await hands.right.to(onLever(0.03), 0.15, 'hold');
  audio.doorCreak(at());
  G.doorOpen = true;
  // The hand stays on the lever for the start of the swing, then lets go.
  let letGo = false;
  // Pushed, then swinging on by its own weight and slowing down.
  await tween(1.6, (k) => {
    world.doorPivot.rotation.y = 1.45 * k;
    if (!letGo && k > 0.4) { letGo = true; restRight(0.5); }
  }, ease.push, 0.1);
  done();
}

// A swing door of the hospital (hopital/batiment.js): pushed open with the palm from the side it swings away from,
// pulled open by its handle from the other side (stepping out of its way), pulled shut by the end of the open leaf.
// A locked one: the handle rattles.
async function useSwingDoor(it) {
  const door = it.door, d = door.d;
  const opens = !door.target, locked = d.need && !door.unlocked && !G[ITEM_OF[d.need]];
  door.frame.updateMatrixWorld(true);
  const l0 = door.leaves[0];
  const localInto = -Math.sign(l0.openAngle) * l0.dir;
  const into = new THREE.Vector3(0, 0, localInto).transformDirection(door.frame.matrixWorld).setY(0).normalize();
  const lw = d.kind === 'double' ? d.half : d.half * 2; // each leaf's width (hopital/batiment.js)
  const leaves = door.leaves.map((l) => {
    const hinge = l.pivot.getWorldPosition(new THREE.Vector3());
    const along = new THREE.Vector3(l.dir, 0, 0).transformDirection(door.frame.matrixWorld).setY(0).normalize(); // closed: hinge → latch
    // The leaf shown (habillage.js puts one model per decay state under the pivot), and its lever handles.
    const shown = l.pivot.children.find((c) => c.visible) ?? l.pivot;
    const handles = [];
    shown.traverse((o) => { if (/^handle_lever_/.test(o.name)) handles.push(o); });
    if (!handles.length) shown.traverse((o) => { if (/^handle_rose_/.test(o.name)) handles.push(o); });
    return { ...l, hinge, along, handles };
  });
  // Out of a leaf's way: not in the quarter it sweeps (on the side it swings to), with a body's width to spare.
  const clear = (q) => leaves.every((l) => {
    const rx = q.x - l.hinge.x, rz = q.z - l.hinge.z, a = rx * l.along.x + rz * l.along.z, b = rx * into.x + rz * into.z;
    return b < -0.05 || a < -0.3 || Math.hypot(a, b) > lw + 0.3;
  });
  // Closing reactivates the doorway collider: neither the eyes nor the feet may end up inside it.
  const outsideShutDoor = (q) => {
    const c = door.col, pad = R + 0.03;
    return q.x <= c.x0 - pad || q.x >= c.x1 + pad || q.z <= c.z0 - pad || q.z >= c.z1 + pad;
  };
  const safe = (q) => free(q.x, q.z) && (opens || outsideShutDoor(q));
  const side = (camera.position.x - door.center.x) * into.x + (camera.position.z - door.center.z) * into.z; // > 0: the side it swings to
  const leaf = leaves.reduce((m, l) => (l.hinge.distanceTo(camera.position) < m.hinge.distanceTo(camera.position) ? l : m));
  // The leaf's face normal (its pivot's z), and the handle on the player's side of it.
  const normal = () => new THREE.Vector3(0, 0, 1).transformDirection(leaf.pivot.matrixWorld).setY(0).normalize();
  const sideOf = (p) => Math.sign((camera.position.x - p.x) * normal().x + (camera.position.z - p.z) * normal().z) || 1;
  const handle = leaf.handles.reduce((m, h) => (m && centerOf(m).distanceTo(camera.position) < centerOf(h).distanceTo(camera.position) ? m : h), null);
  const faceSide = sideOf(leaf.hinge); // which face of the leaf the player sees
  const out = () => normal().multiplyScalar(faceSide); // from the leaf towards the player
  // A point on the leaf's face on the player's side, near the latch (its handle), following the leaf as it turns.
  const onLeaf = (back = 0, up = 0) => () => {
    const c = handle ? centerOf(handle) : leaf.hinge.clone().addScaledVector(leaf.along, lw - 0.12).setY(player.y + 1.0);
    const toHinge = new THREE.Vector3(leaf.hinge.x - c.x, 0, leaf.hinge.z - c.z).normalize();
    return c.addScaledVector(toHinge, back).add(new THREE.Vector3(0, up, 0));
  };
  const push = opens && side < 0 && !locked;
  if (push) {
    // The palm flat on the leaf beside the handle, fingers up; it gives way, the hand goes with it a little.
    const palm = () => { const n = out(), q = handQuat(Math.PI / 2 - 0.2, yawOf(n)); return { pos: wristFor(hands.right, onLeaf(0.14, 0.1)().addScaledVector(n, 0.01), q, { back: 0.03 }), quat: q }; };
    await reachFor([{ hand: hands.right, wrist: () => palm().pos }], { at: onLeaf(0.14, 0.1)(), face: out(), near: 0.4, drop: 0.2 });
    await hands.right.to(palm, 0.35, 'open');
    it.act();
    await followDoor(door, 0.3, palm);
    await restRight(0.4);
    done();
    return;
  }
  // The lever on the player's side: pulled open (stepping out of the leaf's way), pulled shut, or rattled if locked.
  const grip = (outBy = 0, dy = 0) => () => { const n = out(), q = handQuat(-0.2, yawOf(n)); return { pos: wristFor(hands.right, onLeaf(0, dy)().addScaledVector(n, outBy), q), quat: q }; };
  // Far enough to see the lever and the hand on it, in the middle of the view: the pull has to read as one.
  await reachFor([{ hand: hands.right, wrist: () => grip()().pos }], { at: onLeaf()(), face: out(), near: 0.4, drop: 0.2, ok: safe });
  await hands.right.to(grip(0.05), 0.3, 'open');
  await hands.right.to(grip(), 0.15, 'hold');
  if (locked) {
    // Pressed down twice: it does not give.
    for (const dy of [-0.02, -0.025]) { await hands.right.to(grip(0, dy), 0.1, 'hold'); await hands.right.to(grip(), 0.12, 'hold'); }
    it.act();
    await hands.right.to(grip(0.06), 0.2, 'open');
  } else {
    await hands.right.to(grip(0, -0.025), 0.12, 'hold'); // the lever goes down
    // Step out before the leaf moves or its doorway collider becomes active.
    if (!clear(camera.position) || !safe(camera.position) || (cam.feet && (!clear(cam.feet) || !safe(cam.feet)))) {
      const spot = (() => {
        const p = new THREE.Vector3();
        for (let r = 0.15; r <= 1.5; r += 0.1) {
          let best = null, bestD = Infinity;
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            p.set(camera.position.x + Math.sin(a) * r, camera.position.y, camera.position.z + Math.cos(a) * r);
            if (!clear(p) || !safe(p) || !segmentFree(camera.position, p) || !inSight(p, door.center.clone().setY(camera.position.y))) continue;
            const dd = p.distanceTo(onLeaf()());
            if (dd < bestD) { bestD = dd; best = p.clone(); }
          }
          if (best) return best;
        }
        return null;
      })();
      if (!spot) { await restRight(0.4); done(); return; }
      spot.y = player.y + EYE; cam.feet = null;
      await camTo(spot, lookQuat(spot, onLeaf()().setY(player.y + 1.3)), 0.6);
    }
    it.act();
    // Pulling: the hand stays on the lever and brings the leaf along while the player backs away with it.
    await followDoor(door, opens ? 0.55 : 0.4, grip(0, -0.025));
    // Let go (straight back to rest if the door has already gone out of reach).
    const S = hands.right.shoulder.clone().applyQuaternion(camera.quaternion).add(camera.position);
    if (S.distanceTo(grip(0.06)().pos) < ARM_OK) await hands.right.to(grip(0.06), 0.15, 'open');
  }
  await restRight(0.4);
  done();
}
// Keep the right hand on a moving door (`pose` follows the leaf) until it has swung by `k` of its way, or the arm
// runs out of reach.
async function followDoor(door, k, pose) {
  const arm = hands.right;
  arm.to(pose, 0.05, null);
  const from = door.open, S = new THREE.Vector3();
  await new Promise((res) => {
    const step = () => {
      const over = Math.abs(door.open - from) >= k || door.open === door.target;
      S.copy(arm.shoulder).applyQuaternion(camera.quaternion).add(camera.position);
      if (over || S.distanceTo(pose().pos) > ARM_OK) res(); else requestAnimationFrame(step);
    };
    step();
  });
}

// A swing door or a lift button out in the hospital.
async function useBuilding(it) {
  G.mode = 'busy';
  const box = boxOf(it.obj), c = box.getCenter(new THREE.Vector3());
  if (it.door) { await useSwingDoor(it); return; }
  const face = new THREE.Vector3(camera.position.x - c.x, 0, camera.position.z - c.z).normalize();
  await reach(c, { face, grip: 'point', pitch: -0.05 });
  audio.click(c, 0.2);
  it.act();
  await wait(0.12);
  await restRight(0.4);
  done();
}

// ---------- Falls, hallucinations ----------
let nextHallu = 0, nextThought = 0;
const figure = new THREE.Group();
let figureRig = null;
{
  // Body and head from shadow_figure.glb (Blockbench), drawn as a flat shadow with two glowing eyes.
  const m = new THREE.MeshBasicMaterial({ color: 0x020202, transparent: true, opacity: 0.92 });
  const eyes = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.1, 0.9) }));
  loader.loadAsync('./assets/shadow_figure.glb').then((gltf) => {
    gltf.scene.traverse((o) => { if (o.isMesh) o.material = m; });
    const head = gltf.scene.getObjectByName('head');
    // The slit sits on the front of whatever head the model has.
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(head), c = box.getCenter(new THREE.Vector3());
    eyes.position.copy(head.worldToLocal(new THREE.Vector3(c.x, c.y + 0.015, box.max.z + 0.003)));
    head.add(eyes);
    figureRig = { head, arm_l: gltf.scene.getObjectByName('arm_l'), arm_r: gltf.scene.getObjectByName('arm_r') };
    figure.add(gltf.scene);
  });
  figure.visible = false;
  scene.add(figure);
}
let figureUntil = 0, figureForced = false;
const HALLU_SPOTS = [[RX - 0.4, 1.9], [-RX + 0.4, 1.8], [WIN.x, -RZ_BACK + 0.4], [RX - 0.3, -2.4], [-RX + 0.5, -2.4], [0.9, 1.9]];
let phoneShakeUntil = 0, flickBurst = 0, blackout = 0;

let morelLastHeard = -Infinity;
function hallucinate() {
  const l = loss();
  const pick = Math.random();
  const doorP = new THREE.Vector3(RX + 0.6, 1.4, DOOR.z);
  const phoneP = new THREE.Vector3(-RX + 0.1, 1.3, PHONE_Z);
  const behind = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-0.6));
  // Even while healthy, ordinary sounds suggest someone nearby, wherever the player is.
  const a = Math.random() * Math.PI * 2, distance = 3 + Math.random() * 2;
  const nearby = camera.position.clone().add(new THREE.Vector3(Math.cos(a) * distance, -0.4, Math.sin(a) * distance));
  if (l < 0.22) {
    if (pick < 0.5) audio.doorClose(nearby);
    else audio.footsteps(nearby);
    return;
  }
  const whispers = morelWhispers(l, G.blouse);
  if (!bubbleBusy && G.mode === 'free' && whispers.length && G.time - morelLastHeard > 45 && Math.random() < 0.2) {
    morelLastHeard = G.time;
    const line = pickOf(whispers);
    void (async () => {
      const voice = await audio.spokenLine(line.id);
      if (bubbleBusy || G.mode !== 'free' || G.over || G.paused) { voice?.stop(); return; }
      const dur = Math.max(4, voice?.duration ?? 0);
      heard(line, null, { who: 'DR MOREL ?', dur, recorded: false });
      await playWait(dur);
      voice?.stop();
    })();
    return;
  }
  if (pick < 0.12) audio.doorClose(nearby);
  else if (pick < 0.22) {
    const a = Math.random() * 6.28;
    audio.whisper(camera.position.clone().add(new THREE.Vector3(Math.cos(a) * 1.5, 0.2, Math.sin(a) * 1.5)));
    if (l > 0.5 && Math.random() < 0.5) {
      randomVoice(l, a);
      // The worst ones: he shouts back at the voices (now and then).
      if (l > 0.7 && G.time - saidAt.stop > 120) { saidAt.stop = G.time; playWait(2.4).then(() => thought('Arrête. Arrête. ARRÊTE !')); }
    }
    else if (l > 0.55 && Math.random() < 0.4) voices.hal('HAL_15', { strength: l, silent: true }); // the whisper, half-read
  } else if (pick < 0.32) audio.knock(doorP);
  else if (pick < 0.42) audio.footsteps(doorP);
  else if (pick < 0.5) audio.distant(new THREE.Vector3(RX + 2, 1.5, DOOR.z + (Math.random() - 0.5) * 6), l);
  else if (pick < 0.6) audio.breath(behind);
  else if (pick < 0.7 && l > 0.45) {
    audio.bell(phoneP); phoneShakeUntil = G.time + 1.0;
    // Once a night, the ringing phone has a child on the line.
    if (l > 0.6 && !G.leaCalled && inRoom()) { G.leaCalled = true; playWait(2.2).then(() => heard(LEA.phone, phoneP)).then(() => answerLea(3.4)); }
    // Later, a man on the line, too calm: the voice of the calls (once).
    else if (l > 0.65 && G.leaCalled && !G.ghostCall && inRoom()) {
      G.ghostCall = true;
      playWait(2.2).then(() => overheard({ id: 'TEL_24', text: 'Tu te souviens de m\'avoir appelé ?' }, phoneP, { who: 'VOIX AU TÉLÉPHONE ?', style: 'thought glitch' }))
        .then((ok) => { if (!ok) G.ghostCall = false; });
    }
  } else if (pick < 0.78 && l > 0.55) {
    const at = new THREE.Vector3(1.4, 1.0, -2.4);
    audio.childHum(at);
    if (Math.random() < 0.5) playWait(1.8).then(() => heard(pickOf(LEA.halluc), at)).then(() => answerLea(3.4));
  }
  else if (pick < 0.92 && l > 0.4) { if (showFigure() && l > 0.6 && Math.random() < 0.5) voices.hal('HAL_13', { strength: l, pos: () => behind }); }
  else flickBurst = G.time + 1.2;
  if (l > 0.35 && Math.random() < 0.35) {
    thought(['Je ne suis pas malade.', 'Ils mentent.', 'Il y a quelqu\'un ?', 'Concentre-toi…', G.pills > 0 ? `Mes cachets…${keyTag('kPill')}` : 'J\'ai besoin d\'un cachet.'][Math.floor(Math.random() * 5)], { glitch: l > 0.7 });
  }
}
// When a line of his own was last heard, for the ones that must stay rare.
const saidAt = { stop: -Infinity, lea: -Infinity, figure: -Infinity, nobody: -Infinity, rain: -Infinity };
// After hearing the child: he calls her (not every time).
function answerLea(after) {
  if (G.time - saidAt.lea < 120) return;
  saidAt.lea = G.time;
  playWait(after).then(() => thought('Léa ? …Léa, c\'est toi ?'));
}
// Developer menu: shows it wherever the player is, in full view if it is set to stay.
function forceFigure() {
  if (figure.visible && figureForced) { figure.visible = false; figureForced = false; toast('Créature retirée.'); return; }
  const f = camera.getWorldDirection(new THREE.Vector3()); f.y = 0; f.normalize();
  // As far ahead as the room allows, up to 3 m, so a wall never hides it.
  let d = 1.2;
  for (let k = 1.2; k <= 3; k += 0.2) {
    if (!free(camera.position.x + f.x * k, camera.position.z + f.z * k)) break;
    d = k;
  }
  figure.position.set(camera.position.x + f.x * d, player.y, camera.position.z + f.z * d);
  figure.lookAt(camera.position.x, player.y, camera.position.z);
  figure.visible = true;
  figureForced = true;
  figureUntil = G.time + 15;
  toast(`Créature devant toi, à ${d.toFixed(1)} m. ${cfg.dFigureStay ? 'Elle reste' : 'Elle part dans 15 s'}. Encore une fois pour la retirer.`, 4);
}
function showFigure() {
  const f = camera.getWorldDirection(new THREE.Vector3()); f.y = 0; f.normalize();
  // In the room, its usual corners; in the hospital, somewhere the player could stand, a few metres away.
  const around = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2, r = 2.5 + (i % 3);
    return new THREE.Vector3(player.pos.x + Math.cos(a) * r, player.y, player.pos.z + Math.sin(a) * r);
  }).filter((p) => hosp.canStand(p.x, p.z, player.y));
  const spots = (inRoom() ? HALLU_SPOTS.map(([x, z]) => new THREE.Vector3(x, 0, z)) : around)
    .filter((p) => { const d = p.clone().sub(camera.position); d.y = 0; return d.length() > 1.2 && d.normalize().dot(f) < 0.5; });
  if (!spots.length) return false;
  figure.position.copy(spots[Math.floor(Math.random() * spots.length)]);
  figure.lookAt(camera.position.x, figure.position.y, camera.position.z);
  figure.visible = true;
  figureUntil = G.time + 6;
  return true;
}
// One of the HAL lines the player can hear any time, the harsher ones only once far gone; a crowd around him.
function randomVoice(l, a = Math.random() * 6.28) {
  const pool = HAL_RANDOM.filter(([, from]) => l >= from).map(([id]) => id);
  const id = pool[Math.floor(Math.random() * pool.length)] ?? 'HAL_01';
  const around = (i) => camera.position.clone().add(new THREE.Vector3(Math.cos(a + i * 1.7) * 1.2, 0.1, Math.sin(a + i * 1.7) * 1.2));
  voices.hal(id, { strength: l, pos: around });
}
// The phrases on the walls at the last decay state: read aloud and flashed the first time the player looks at one,
// again after a while. tile.text is the phrase of the wall's last state in decor.js.
const WALL_HAL = { ils_te_voient: 'HAL_06', ils_ecoutent: 'HAL_07', sors: 'HAL_08' };
const wallHeard = new Map();
let forceVoice = false;
function watchWalls(t, l) {
  if (!cfg.dHallu || G.mode !== 'free' || !inRoom()) return;
  const dir = camera.getWorldDirection(tmpV);
  for (const tile of world.tiles) {
    const id = WALL_HAL[tile.text];
    if (!id || tile.level !== 3 || t < (wallHeard.get(tile) ?? 0)) continue;
    const c = tile.box.getCenter(new THREE.Vector3()).setY(camera.position.y);
    const d = c.sub(camera.position), dist = d.length();
    if (dist > 4.5 || d.normalize().dot(dir) < 0.94) continue;
    wallHeard.set(tile, t + 70 + Math.random() * 40);
    voices.hal(id, { strength: l, pos: () => tile.box.getCenter(new THREE.Vector3()) });
  }
}

// ---------- Input ----------
let expectUnlock = false, lockedAt = 0, skipMoves = 0;
// The browser can refuse the capture, e.g. about a second after the player left it with Escape:
// then a click on the "click to resume" veil asks again instead of leaving the game running without the mouse.
function lockPointer() {
  if (isTouch() || G.over) return;
  try { const p = canvas.requestPointerLock?.(); p?.catch?.(lockFailed); } catch { lockFailed(); }
}
function lockFailed() {
  if (document.pointerLockElement === canvas || !G.started || G.over || G.mode === 'computer' || menus.isOpen()) return;
  showResumeHint();
}
document.addEventListener('pointerlockerror', lockFailed);
function showPause() { if (G.over || !G.started) return; G.paused = true; audio.setPaused(true); keys.clear(); menus.show('pause'); saveGame(); }
// After leaving the PC with Escape the browser needs a click to grab the mouse again.
function showResumeHint() { $('resumeHint').classList.remove('hidden'); }
$('resumeHint').addEventListener('click', () => { $('resumeHint').classList.add('hidden'); lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { lockedAt = performance.now(); skipMoves = 1; G.paused = false; audio.setPaused(false); if (menus.current === 'pause') menus.hideAll(); $('resumeHint').classList.add('hidden'); return; }
  if (expectUnlock) { expectUnlock = false; return; }
  if (G.started && !['computer', 'panel'].includes(G.mode) && !choiceKey && !G.over) showPause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.started && !G.over) showPause();
});
addEventListener('pointerdown', () => audio.start(), { once: true });

let rankingStart = Promise.resolve(null), rankingFinish = Promise.resolve(null);
function startGame({ resumed = false } = {}) {
  const runId = G.runId;
  rankingStart = resumed ? Promise.resolve(G.rankTicket) : shell.beginRun();
  rankingStart.then((ticket) => { if (G.runId === runId) G.rankTicket = ticket; });
  audio.start();
  audio.setPaused(false);
  $('fade').style.transition = 'none'; $('fade').style.opacity = 1;
  // A new game opens its eyes itself (wakeUp); a resumed one fades in.
  if (resumed) requestAnimationFrame(() => { $('fade').style.transition = 'opacity 1.6s ease-in-out'; $('fade').style.opacity = 0; });
  cam.scripted = false;
  $('hud').classList.remove('hidden');
  G.started = true; G.paused = false;
  // Fullscreen consumes user activation: request pointer lock first, without awaiting it.
  lockPointer();
  if (!isTouch() || cfg.touchFullscreen) goFullscreen();
  nextHallu = G.time + 14; nextThought = G.time + 4;
  lastSaveAt = G.time;
  if (resumed) setTimeout(() => thought('Où en étais-je… Toujours cette chambre.'), 1600);
  else wakeUp();
}
// Starting over drops the saved game; going back to the main menu keeps where the player was.
function restart() { leaving = true; dropSave(); try { sessionStorage.setItem('clausus-autostart', '1'); } catch { /* ignore */ } location.reload(); }
function mainMenu() { saveGame(); leaving = true; try { sessionStorage.removeItem('clausus-autostart'); } catch { /* ignore */ } location.reload(); }

// ---------- Saved games ----------
// Signed-in players only: the site keeps one saved game per account (shell.js, apps/web game-stage.tsx, API save.*).
// A guest is asked to sign in first (menus: saveGuest); once signed in, the game in progress is saved right away.
// Saved automatically every SAVE_EVERY s of play, on pause and when going back to the main menu; dropped at the end.
const SAVE_VERSION = 2; // 2: the whole story (histoire.js); a save from the room demo is not offered
const SAVE_EVERY = 45;
const SAVED_FLAGS = ['cheated', 'leftRoom', 'bottleTaken', 'pillowCoin', 'sillCoin', 'mattressCoin', 'torch', 'torchOn', 'unlocked', 'doorOpen',
  'psyKnown', 'keys', 'blouse', 'lockerOpen', 'meetingKey', 'planning', 'card', 'downstairs', 'metNurse', 'planF1', 'planF0', 'patientEncounterDone',
  'leaCalled', 'leaDrawing'];
const SAVED_COUNTS = { pills: 99, pillsTaken: 99, coins: 20, hints: 99, errors: 999 };
let savedGame = null; // { data, savedAt } from the site, offered as "Reprendre la partie"
let snapshot = null; // the last consistent state (taken while nothing is half done)
let safeSpot = null; // where the player last stood on a floor, outside the lift
let lastSaveAt = 0, manualSave = false, saveOnSignIn = false, snapshotAt = -1e9;
// leaving: the page is reloading; its last visibilitychange must not save the game just dropped (or save it twice).
let leaving = false;
const SETTLED = new Set(['free', 'doc', 'computer']);
function trackSafeSpot() {
  if (G.mode !== 'free' || player.vy) return;
  if (hosp.roomAt(player.pos.x, player.y, player.pos.z) === 'Ascenseur') return;
  safeSpot = { x: player.pos.x, z: player.pos.z, y: player.y, yaw: player.yaw, pitch: player.pitch };
}
function takeSnapshot() {
  if (!G.started || G.over || !SETTLED.has(G.mode)) return snapshot;
  const data = { v: SAVE_VERSION, time: G.time, sanity: G.sanity, hinted: Object.keys(G.hinted).map(Number), story: story?.snapshot(), computers: computers.map((c) => c.os.snapshot()),
    doors: hosp.H.swingDoors.map((d) => d.target === 1) };
  for (const k of SAVED_FLAGS) data[k] = G[k];
  for (const k of Object.keys(SAVED_COUNTS)) data[k] = G[k];
  if (safeSpot) data.player = { ...safeSpot };
  // Keep the run id across saves; completed runs are normally dropped at the end.
  data.runId = G.runId; data.rankTicket = G.rankTicket; data.escape = G.escape; data.published = G.published === true;
  snapshot = data;
  return snapshot;
}
/** Sends the current game to the site; false when there is nothing to save or nobody to save it for. */
function saveGame({ manual = false } = {}) {
  if (leaving || !shell.signedIn() || !G.started || G.over) return false;
  const data = takeSnapshot();
  if (!data) return false;
  manualSave = manual;
  shell.save(data);
  lastSaveAt = G.time;
  savedGame = { data, savedAt: new Date() };
  return true;
}
function dropSave() { shell.clearSave(); savedGame = null; menus.setSave(null); }
// Puts the room back as the saved game left it. Untrusted input (it came back from the server): checked field by field.
function applySave(d) {
  if (!d || d.v !== SAVE_VERSION) return false;
  const num = (v, def, lo, hi) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
  G.time = num(d.time, 0, 0, 1e6);
  G.sanity = num(d.sanity, 1, 0.05, 1);
  for (const k of SAVED_FLAGS) G[k] = d[k] === true;
  for (const [k, max] of Object.entries(SAVED_COUNTS)) G[k] = Math.round(num(d[k], 0, 0, max));
  if (typeof d.runId === 'string' && /^[\w-]{8,64}$/.test(d.runId)) G.runId = d.runId;
  G.rankTicket = typeof d.rankTicket === 'string' && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(d.rankTicket) ? d.rankTicket : null;
  // Playable saves precede the hospital exit. Discard old room-only scores and their publication id.
  G.escape = null;
  G.published = false;
  if (d.escape) { G.runId = newRunId(); G.rankTicket = null; }
  if (G.bottleTaken) assets.pills.visible = false;
  if (G.sillCoin) world.sillCoin.removeFromParent();
  if (G.mattressCoin) scene.getObjectByName('stash_coin')?.removeFromParent();
  if (G.torch) { hands.left.grip.add(torch); torch.position.set(0, 0, -0.02); torch.rotation.set(0, 0, 0); }
  G.hinted = {};
  if (Array.isArray(d.hinted)) for (const n of d.hinted) if (Number.isInteger(n) && n >= 1 && n <= 7) G.hinted[n] = true;
  if (G.unlocked) unlockRoom(false);
  if (G.doorOpen) world.doorPivot.rotation.y = 1.45;
  // The story's objects: what was taken, opened, worn or solved (histoire.js puzzle objects in setupStory).
  story?.restore(d.story);
  if (Array.isArray(d.computers)) computers.forEach((c, i) => c.os.restore(d.computers[i]));
  if (Array.isArray(d.doors)) hosp.H.swingDoors.forEach((door, i) => {
    if (d.doors[i] !== true) return;
    door.open = door.target = 1; door.col.active = false;
    for (const leaf of door.leaves) leaf.pivot.rotation.y = leaf.openAngle;
  });
  world.forceDecay(loss());
  props?.setClock?.(G.time);
  const p = d.player;
  if (p && [p.x, p.z, p.y, p.yaw].every(Number.isFinite) && hosp.canStand(p.x, p.z, p.y)) {
    player.pos.set(p.x, 0, p.z); player.y = p.y; player.vy = 0; player.yaw = p.yaw; player.pitch = num(p.pitch, -0.1, -1.4, 1.4);
  }
  return true;
}
// [x, z, yaw, y]: y is the floor height (first floor = room = 0, ground floor = -3.3).
const TELEPORTS = {
  start: [START.x, START.z, START.yaw], phone: [-RX + 0.8, -0.6, Math.PI / 2], window: [WIN.x, -RZ_BACK + 0.7, 0], bed: [0.3, -1.4, 0.3], door: [RX - 0.8, DOOR.z, -Math.PI / 2],
  corridor: [4.5, 4.4, -Math.PI / 2], archives: [2.9, 11.0, Math.PI / 2], laverie: [2.9, 19.2, Math.PI / 2], stairs: [26.4, 11.6, -Math.PI / 2], lift: [26.4, 17.45, -Math.PI / 2],
  ground: [14.45, 23.9, Math.PI, -3.3], securite: [9.3, 21.8, Math.PI, -3.3], reunion: [18.4, -0.175, -Math.PI / 2, -3.3], cabinet: [4.85, 6.7, Math.PI, -3.3],
  pharmacie: [7.6, -0.175, Math.PI / 2, -3.3], sortie: [14.15, 25.2, Math.PI, -3.3],
};
const menus = createMenus({
  sfx: (k) => audio.ui(k),
  // A new game replaces the saved one.
  onStart: () => { if (savedGame) dropSave(); startGame(); },
  onContinue: () => {
    const ok = savedGame && applySave(savedGame.data);
    if (!ok && savedGame) toast('Sauvegarde illisible : nouvelle partie.', 3);
    startGame({ resumed: Boolean(ok) });
  },
  onSave: () => { if (!saveGame({ manual: true })) menus.saveDone(false); },
  canSave: () => shell.signedIn(),
  saveShown: () => shell.embedded,
  // Only a game in progress is saved on sign-in (from the main menu there is nothing to save).
  onLogin: () => { saveOnSignIn = G.started && !G.over; shell.login(takeSnapshot()); },
  // The game resumes once the mouse is captured again (pointerlockchange), not before.
  // At the PC, over a padlock or a choice the mouse stays free: capturing it would freeze the cursor.
  onResume: () => {
    if (isTouch() || ['computer', 'panel'].includes(G.mode) || choiceKey) { G.paused = false; audio.setPaused(false); } else lockPointer();
  },
  onRestart: restart,
  onMainMenu: mainMenu,
  onAccount: () => shell.account(),
  onLogout: () => shell.logout(),
  onLeaderboard: shell.embedded ? () => shell.leaderboard() : null,
  publishState,
  publishLabel: (st) => PUBLISH_LABEL[st],
  onPublish: publishRun,
  live: (name) => (name === 'sanity' ? G.sanity : 0),
  soundTests: SOUND_TESTS,
  action: (name, v) => {
    // Only what helps the player marks the run as unranked: trying a sound or a scare does not.
    const harmless = ['lightning', 'hallucinate', 'voice', 'figure', 'testSound', 'stopSounds', 'resetSettings', 'resetKeys', 'resetDev'];
    if (G.started && !harmless.includes(name) && !(name === 'teleport' && !TELEPORTS[v])) G.cheated = true;
    if (name === 'sanity') G.sanity = v;
    else if (name === 'testSound') audio.test(v);
    else if (name === 'stopSounds') audio.stopTest();
    else if (name === 'lightning') forceLightning = true;
    else if (name === 'hallucinate') hallucinate();
    else if (name === 'voice') forceVoice = true; // heard once the menu is closed: it would hide the flashes
    else if (name === 'figure') forceFigure();
    else if (name === 'teleport' && TELEPORTS[v]) { const [x, z, yaw, y = 0] = TELEPORTS[v]; player.pos.set(x, 0, z); player.y = y; player.vy = 0; player.yaw = yaw; player.pitch = -0.1; lastZone = 'teleport'; }
    else if (name === 'giveCoin') G.coins++;
    else if (name === 'givePills') { G.bottleTaken = true; G.pills = 4; assets.pills.visible = false; }
    else if (name === 'giveTorch' && !G.torch) { hands.left.grip.add(torch); torch.position.set(0, 0, -0.02); torch.rotation.set(0, 0, 0); G.torch = true; G.torchOn = true; }
    else if (['giveRoomKey', 'giveKeys', 'giveMeetingKey', 'giveCard'].includes(name)) story?.giveKey(name);
    else if (name === 'unlock') { if (!G.unlocked) unlockRoom(); }
    else if (name === 'story') story?.cheat(Number(v));
    else if (name === 'win') { if (G.started) walkOut(); }
    else if (name === 'resetSettings' || name === 'resetKeys' || name === 'resetDev') { applySettings(); resize(); }
  },
});
shell.onPlayer((pseudo) => {
  G.pseudo = pseudo;
  menus.setPlayer(pseudo);
  if (!pseudo) { savedGame = null; menus.setSave(null); return; }
  // A guest who signed in to save: their game in progress is saved at once.
  if (saveOnSignIn && G.started && !G.over) { saveOnSignIn = false; saveGame({ manual: true }); }
});
shell.onSave((save) => {
  // Mid-game, the game in progress is newer than what the site had.
  if (G.started) return;
  savedGame = save;
  menus.setSave(save);
});
shell.onSaved((ok) => {
  if (manualSave) { menus.saveDone(ok); toast(ok ? 'Partie sauvegardée.' : 'Sauvegarde impossible.', 2.5); }
  else if (!ok) toast('Sauvegarde automatique impossible.', 2.5);
  manualSave = false;
});
// The site's screens (sign-in, pseudo, account) over the game: hide the menus and hold the start until they close.
// `start`: "Jouer" on the site's welcome screen, which stands for the main menu's "Commencer" (notice next).
let menuReady = false, pendingBegin = null, startNext = false;
const firstMenu = () => { const name = startNext ? 'notice' : 'main'; startNext = false; return name; };
shell.onCover((on, start) => {
  if (start) startNext = true;
  if (on) {
    if (G.started && !G.over && !G.paused) { if (document.pointerLockElement) document.exitPointerLock(); showPause(); }
    if (menus.isOpen()) menus.hideAll();
  } else if (pendingBegin) { const begin = pendingBegin; pendingBegin = null; begin(); }
  else if (G.started && G.paused && !G.over) menus.show('pause');
  else if (menuReady && !G.started && !menus.isOpen()) menus.show(firstMenu());
});

// The computer uses pointer events: mouse, finger and pen alike, without the mouse events browsers emulate after a tap.
addEventListener('pointermove', (e) => {
  if (G.mode !== 'computer') return;
  const p = toOS(e.clientX, e.clientY);
  if (p) pcAt.os.pointer(p[0], p[1]);
});
// ---------- Touch screens ----------
const touch = createTouchControls({
  state: () => ({
    show: G.started && !G.over && !G.paused && !menus.isOpen() && !finale.driving,
    mode: G.mode, free: G.mode === 'free', hot: !!focused, next: !!advance,
    pills: G.pills, torch: G.torch, torchOn: G.torchOn, osState: pcAt?.os.state,
  }),
  look: (dx, dy) => {
    const k = 0.0042 * cfg.touchSens * (1 - 0.25 * loss());
    player.yaw -= dx * k;
    player.pitch = THREE.MathUtils.clamp(player.pitch - dy * k * (cfg.invertY ? -1 : 1), -1.35, 1.35);
  },
  tap: tapAt,
  interact,
  pill: takePill,
  torch: toggleTorch,
  pause: showPause,
  leavePC: () => leaveComputer(false),
  typeKey: (key) => {
    if (G.mode !== 'computer') return;
    pcAt?.os.key({ key, preventDefault() {} });
    hands.left.tap[Math.floor(Math.random() * 4)] = 1;
  },
});

addEventListener('mousemove', (e) => {
  if (G.mode === 'computer') return;
  if (document.pointerLockElement !== canvas || G.mode !== 'free') return;
  // Ignore the jump some browsers send right after the mouse is captured.
  if (skipMoves > 0) { skipMoves--; return; }
  if (performance.now() - lockedAt < 150 || Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
  const k = 0.0022 * cfg.sensitivity * (1 - 0.25 * loss());
  player.yaw -= e.movementX * k;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * k * (cfg.invertY ? -1 : 1), -1.35, 1.35);
});
addEventListener('pointerdown', (e) => {
  if (G.mode === 'computer') {
    if (menus.isOpen()) return;
    if (e.button === 2) { leaveComputer(true); return; }
    const p = toOS(e.clientX, e.clientY);
    // Only presses on the screen itself: a tap beside it must not click its edge.
    if (p && p[0] >= 0 && p[0] < OS_W && p[1] >= 0 && p[1] < OS_H) { pcAt.os.pointer(p[0], p[1]); pcAt.os.down(); hands.right.tap[1] = 1; }
    return;
  }
  if (e.pointerType !== 'mouse' || !G.started || G.over || menus.isOpen()) return;
  // Safety net: a click in the game without the mouse captured grabs it again.
  if (document.pointerLockElement !== canvas) { if (G.mode === 'free' && !G.paused) lockPointer(); return; }
  if (!G.paused && e.button === 0) interact();
});
addEventListener('pointerup', () => { if (G.mode === 'computer') pcAt.os.up(); });
addEventListener('pointercancel', () => { if (G.mode === 'computer') pcAt.os.up(); });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => {
  if (G.mode === 'computer') {
    if (menus.isOpen()) return;
    if (e.code === 'Escape') { leaveComputer(false); return; }
    if (e.key === 'Tab' || e.key === 'Backspace') e.preventDefault();
    pcAt.os.key(e);
    hands.left.tap[Math.floor(Math.random() * 4)] = 1;
    return;
  }
  if (G.mode === 'panel' && !menus.isOpen()) {
    if (e.code === 'Escape') panelClose?.(false, false); else panelKey?.(e);
    return;
  }
  if (choiceKey && !menus.isOpen()) { if (!e.repeat) choiceKey(e); return; }
  if (menus.isOpen() || !G.started) return;
  // With Keyboard Lock, a short Escape reaches us instead of releasing the mouse.
  // Releasing it here keeps the usual pause behavior without leaving fullscreen.
  if (e.code === 'Escape') {
    if (!e.repeat && document.pointerLockElement === canvas) document.exitPointerLock();
    return;
  }
  // Tab would move the browser's focus, which drops the mouse capture and opens the pause menu.
  if (e.code === 'Tab' || e.code === cfg.kMap) e.preventDefault();
  keys.add(e.code);
  // Held keys repeat: one press, one action (the torch or the sound would flicker on and off).
  if (e.repeat) return;
  // Space also interacts, unless the player gave it to another action.
  const spaceTaken = [cfg.kPill, cfg.kTorch, cfg.kMute].includes('Space');
  if (e.code === cfg.kInteract || (e.code === 'Space' && !spaceTaken)) interact();
  if (e.code === cfg.kPill) takePill();
  if (e.code === cfg.kTorch) toggleTorch();
  if (e.code === cfg.kMute) audio.setMuted(audio.on);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// ---------- Movement ----------
// Inside room 104, outside in the hospital: one set of colliders and walkable floors (hopital/jeu.js).
const inRoom = () => player.pos.x < RX + 0.05 && Math.abs(player.y) < 0.5 && player.pos.z > -RZ_BACK - 0.2 && player.pos.z < RZ_FRONT + 0.2;
const free = (x, z) => hosp.canStand(x, z, player.y);
function move(dt, t) {
  const l = loss();
  // Keys give a full step; the touch joystick is analog (push further to walk faster).
  const f = THREE.MathUtils.clamp((keys.has(cfg.kForward) || keys.has('ArrowUp') ? 1 : 0) - (keys.has(cfg.kBack) || keys.has('ArrowDown') ? 1 : 0) - touch.move.y, -1, 1);
  const s = THREE.MathUtils.clamp((keys.has(cfg.kRight) || keys.has('ArrowRight') ? 1 : 0) - (keys.has(cfg.kLeft) || keys.has('ArrowLeft') ? 1 : 0) + touch.move.x, -1, 1);
  // A body has weight: it takes a few steps' worth of time to get going and to stop (no instant start or halt).
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  let wantX = 0, wantZ = 0;
  if (f || s) {
    const amount = Math.hypot(f, s);
    const speed = 1.8 * cfg.dSpeed * (1 - 0.4 * l) * Math.min(1, amount) / amount;
    wantX = (-sin * f + cos * s) * speed; wantZ = (-cos * f - sin * s) * speed;
    // Unsteady legs: the walk drifts sideways, irregularly.
    const sway = drift(t * 0.45, 21) * 0.8 * l * l * speed;
    wantX += cos * sway; wantZ -= sin * sway;
  }
  const grip = Math.min(1, dt * (f || s ? 8 : 10.5));
  player.vx += (wantX - player.vx) * grip; player.vz += (wantZ - player.vz) * grip;
  if (Math.hypot(player.vx, player.vz) < 0.01 && !f && !s) player.vx = player.vz = 0;
  if (player.vx || player.vz) {
    const dx = player.vx * dt, dz = player.vz * dt;
    const { x, z } = player.pos;
    const stuck = !free(x, z); // e.g. after stepping close to the bed: let the player walk out
    if (stuck || free(x + dx, z)) player.pos.x += dx; else player.vx = 0;
    if (stuck || free(player.pos.x, z + dz)) player.pos.z += dz; else player.vz = 0;
    const d = Math.hypot(player.pos.x - x, player.pos.z - z);
    player.bob += d * 9;
    player.stepDist += d;
    if (player.stepDist > 0.62) {
      player.stepDist = 0;
      if (/escalier/.test(hosp.roomAt(player.pos.x, player.y, player.pos.z) ?? '')) audio.stairStep(); // concrete, echo
      else audio.step(0.1);
    }
  }
  hosp.settle(player, dt);
  // Out of the room: the hospital goes on.
  if (!G.leftRoom && G.doorOpen && player.pos.x > RX + 0.6) {
    G.leftRoom = true;
    setTimeout(() => thought('Le couloir… La sortie doit être en bas. L\'escalier, au bout.'), 600);
  }
  storyZones();
}

// ---------- Story moments tied to places (histoire.js) ----------
let story = null, lastZone = null, npcs = null, treatment = null, ambiance = null;
const inWell = (zone) => zone === 'Cage d\'escalier' || zone === 'Ascenseur';
function storyZones() {
  const zone = hosp.roomAt(player.pos.x, player.y, player.pos.z) ?? '';
  const floor = hosp.floorOf(player.y);
  if (zone !== lastZone) {
    const from = lastZone;
    lastZone = zone;
    // The laundry is pitch dark: énigme 3 needs the torch from the archives.
    if (zone === 'Laverie' && !(G.torch && G.torchOn)) thought(G.torch ? `Il fait noir comme dans un four. Ma lampe…${keyTag('kTorch')}` : 'Il fait noir comme dans un four. Il me faudrait une lampe.');
    // Remember the arrival; recognition requires an actual encounter with the nurse.
    if (floor === 0 && !inWell(zone) && inWell(from) && !G.downstairs) {
      G.downstairs = true;
    }
  }
  // The nurse recognises or speaks to the player only nearby, with no wall between them.
  if (floor === 0 && !inWell(zone) && (!G.blouse || !G.metNurse) && G.mode === 'free') {
    const nurse = npcs?.actors.find((actor) => actor.id === 'nurse');
    if (nurse && nurse.root.visible && Math.hypot(player.pos.x - nurse.pos.x, player.pos.z - nurse.pos.z) < 3
      && hosp.clearance(camera.position, nurse.camera.position, 0.15) >= 1) groundFloorArrival();
  }
  // Through the exit gate: the end.
  if (floor === 0 && G.card && hosp.doorNamed('Sortie')?.open > 0.8 && player.pos.z > 26.45 && Math.abs(player.pos.x - 14.15) < 1.3) dreamEnding();
}
let arrivalTalking = false;
async function groundFloorArrival() {
  if (arrivalTalking || ending || G.over) return;
  arrivalTalking = true;
  try {
    G.mode = 'busy';
    keys.clear();
    await wait(0.4);
    const nurse = { who: 'INFIRMIÈRE DE GARDE', style: 'phone', pitch: 1.15 };
    if (!G.blouse) {
      await say(['…Quoi ?', 'Mais… c\'est le patient de la 104 ! Sécurité !'], nurse);
      await caughtEnding(true);
      return;
    }
    // In the doctor's coat: the night nurse at the reception speaks to him.
    G.mode = 'busy';
    keys.clear();
    await say(['Docteur ? Je ne vous avais pas vu arriver…', 'Tout va bien ?'], nurse);
    const c = await choose(['« Oui. Je repasse à mon cabinet, j\'ai oublié un dossier. »', '« Ce ne sont pas vos affaires. »', '« Je ne suis pas médecin. Laissez-moi sortir. »']);
    if (c === 2) { await say(['…Quoi ?', 'Mais… c\'est le patient de la 104 ! Sécurité !'], nurse); caughtEnding(true); return; }
    await say(c === 0 ? ['Ah. Ne travaillez pas trop tard, docteur.'] : ['…Pardon, docteur. Bonne nuit.'], nurse);
    G.metNurse = true;
    if (G.mode === 'busy') G.mode = 'free';
    setTimeout(() => thought('Elle n\'a rien vu. Une sortie… il me faut une carte, ou une clé.'), 400);
  } finally { arrivalTalking = false; }
}

function updateCamera(t) {
  if (!G.started) { menuCamera(t); return; }
  if (finale.driving) { finale.camera(camera, t); return; }
  if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov += (targetFov - camera.fov) * 0.12; camera.updateProjectionMatrix(); }
  if (cam.scripted) {
    if (cam.from) {
      const k = Math.min(1, (performance.now() / 1000 - cam.t0) / cam.dur), e = cam.ease(k);
      if (cam.curve) cam.curve.getPointAt(THREE.MathUtils.clamp(e, 0, 1), camera.position);
      else if (cam.via) {
        // A bent path (sitting up, standing up): a quadratic Bézier through the control point.
        const u = 1 - e;
        camera.position.copy(cam.from.pos).multiplyScalar(u * u).addScaledVector(cam.via, 2 * u * e).addScaledVector(cam.to.pos, e * e);
      } else camera.position.lerpVectors(cam.from.pos, cam.to.pos, e);
      camera.quaternion.slerpQuaternions(cam.from.quat, cam.to.quat, cam.turnEase(k));
      // Walking there: the head dips at each step and sways from one foot to the other, fading in and out.
      if (cam.walk > 0.25) {
        const steps = cam.walk / 0.62, ph = e * steps * Math.PI, fade = Math.min(1, arc(k) * 2.2) * cfg.headbob;
        camera.position.y -= Math.abs(Math.sin(ph)) * 0.02 * fade;
        const side = Math.sin(ph) * 0.012 * fade, yaw = camYaw();
        camera.position.x += Math.cos(yaw) * side; camera.position.z -= Math.sin(yaw) * side;
      }
      if (cam.lean) camera.quaternion.multiply(tmpQ.setFromAxisAngle(AXIS_Z, cam.lean * arc(k) * (cfg.headroll ? 1 : 0.3)));
      if (k >= 1) { cam.from = null; cam.resolve?.(); cam.resolve = null; }
    } else {
      camera.position.copy(cam.to.pos);
      camera.quaternion.copy(cam.to.quat);
    }
    // Never quite still: breathing, the head drifting a little (less at the computer, where the text must stay put).
    const pc = G.mode === 'computer', l = 1 + loss();
    cam.off.pos.set(
      drift(t * 0.21, 11) * (pc ? 0.0006 : 0.0025) * l,
      (Math.sin(t * 1.45 + drift(t * 0.1, 12) * 1.5) * (pc ? 0.0015 : 0.0035) + drift(t * 0.17, 13) * 0.0015) * l,
      drift(t * 0.19, 14) * (pc ? 0.0006 : 0.002) * l,
    );
    const r = pc ? 0 : 0.003; // the screen's overlay is projected through the camera: keep it steady
    tmpE.set(drift(t * 0.23, 15) * r * l, drift(t * 0.18, 16) * r * 1.3 * l, drift(t * 0.15, 17) * r * 0.6 * l, 'YXZ');
    cam.off.quat.setFromEuler(tmpE);
    camera.position.add(cam.off.pos);
    camera.quaternion.multiply(cam.off.quat);
    return;
  }
  const l2 = loss() ** 2;
  // Hard to stand: the eye sinks and sways, the head rolls, never in a loop.
  const sink = 0.14 * l2 * (0.6 + 0.4 * drift(t * 0.3, 31));
  const sway = cfg.shake ? 1 : 0.3, roll = cfg.headroll ? 1 : 0;
  const lift = hosp.shake(player);
  // The walk: how fast the feet go (it fades in and out with the speed, the head does not freeze mid-step).
  player.walk += (Math.min(1, Math.hypot(player.vx, player.vz) / 1.5) - player.walk) * 0.15;
  const w = player.walk * cfg.headbob;
  // The head dips at each footfall (sharper at the bottom) and shifts over the foot that carries it.
  // (In phase with body.js's stride: lowest where sin(bob) was, feet down.)
  const ph = (player.bob + Math.PI / 2) * 0.5, step = 1 - Math.abs(Math.cos(ph)), side = Math.sin(ph) * 0.011 * w;
  const shakeX = noise(t * 23, 32) * lift, shakeY = noise(t * 27, 33) * lift;
  camera.position.set(
    player.pos.x + drift(t * 0.5, 34) * 0.05 * l2 * sway + Math.cos(player.yaw) * side + shakeX,
    player.y + EYE - sink + (step - 0.6) * 0.03 * w + drift(t * 0.25, 35) * 0.002 + shakeY,
    player.pos.z - Math.sin(player.yaw) * side,
  );
  camera.rotation.set(
    player.pitch + (drift(t * 0.38, 36) * 0.04 * l2 + Math.sin(t * 1.45) * 0.003 + drift(t * 0.2, 37) * 0.002) * sway + (step - 0.6) * 0.006 * w,
    player.yaw + drift(t * 0.27, 38) * 0.05 * l2 * sway,
    (drift(t * 0.42, 39) * (0.01 + 0.09 * l2) + Math.sin(ph) * 0.008 * w) * roll,
  );
}
// Behind the main menu: a slow drift around the dark room.
function menuCamera(t) {
  // Like a hand-held camera: the orbit wanders and the operator breathes.
  const a = t * 0.045 + drift(t * 0.03, 41) * 0.25;
  camera.position.set(0.3 + Math.sin(a) * 1.1 + drift(t * 0.21, 42) * 0.01, 1.75 + Math.sin(a * 1.7) * 0.08 + Math.sin(t * 1.3) * 0.004, 1.0 + Math.cos(a) * 0.7);
  camera.lookAt(0.1 + Math.sin(a * 0.6) * 0.4 + drift(t * 0.17, 43) * 0.03, 0.95 + drift(t * 0.13, 44) * 0.03, -0.9);
  if (Math.abs(camera.fov - cfg.fov) > 0.05) { camera.fov = cfg.fov; camera.updateProjectionMatrix(); }
}

// ---------- Endings ----------
// dream: through the exit gate, the walk out, then he wakes up in room 104. caught: the staff recognise him.
// sanity: he collapses. Titles and the report: fin.js.
// ---------- Escape and leaderboard ----------
// Freeze the complete run at the hospital gate; the score appears on the final report.
// A run where developer options helped (frozen or slower sanity, noclip, speed, cheats) is not ranked.
function recordEscape() {
  if (G.escape) return;
  G.escape = { seconds: Math.round(G.time * 10) / 10, hints: G.hints, errors: G.errors, pills: G.pillsTaken, sanity: Math.round(G.sanity * 1000) / 1000 };
  if (shell.embedded && !G.cheated) {
    const stats = { ...G.escape };
    rankingFinish = rankingStart.then((ticket) => ticket ? shell.finishRun({ ticket, ...stats, cheated: false }) : null);
  }
}
const helped = () => cfg.dFreeze || cfg.dNoclip || cfg.dSpeed !== 1 || (DUREE_PARAM || cfg.dDuration) > 600; // 600 s: the gauge's default since the whole story
/** null: nothing to publish; 'ready' / 'sending' / 'done' / 'cheated'. */
function publishState() {
  if (!shell.embedded || !G.escape) return null;
  if (G.cheated) return 'cheated';
  return G.published === true ? 'done' : G.published === 'sending' ? 'sending' : 'ready';
}
async function publishRun() {
  if (publishState() !== 'ready') return;
  G.published = 'sending';
  refreshPublish();
  const runId = G.runId;
  // A late yes (a guest who signed in after) only counts for the run it was about.
  // A resumed run may already have its escape frozen. Repeating finish is safe and returns the original receipt.
  let ticket = await rankingFinish;
  if (!ticket && G.rankTicket) ticket = await shell.finishRun({ ticket: G.rankTicket, ...G.escape, cheated: G.cheated });
  if (G.runId !== runId) return;
  if (!ticket) {
    G.published = false; refreshPublish();
    toast('Partie non classée : il faut être connecté au serveur depuis le début de la partie.', 5);
    return;
  }
  shell.publish({ runId, ticket }, (ok) => { if (G.runId !== runId) return; G.published = ok ? true : false; refreshPublish(); });
}
const PUBLISH_LABEL = { ready: 'Publier mon score', sending: 'Publication…', done: 'Score publié ✓', cheated: 'Partie non classée' };
function refreshPublish() {
  menus.refreshPublish();
  const b = $('endPublish'), st = publishState();
  if (b && st) { b.textContent = PUBLISH_LABEL[st]; b.disabled = st !== 'ready'; }
}

// ---------- End of game ----------
// Through the exit gate (fin.js): the camera takes over for the walk across the courtyard to the road, then fades out.
function walkOutside() {
  recordEscape();
  G.mode = 'escape';
  keys.clear();
  expectUnlock = document.pointerLockElement === canvas;
  document.exitPointerLock?.();
  $('resumeHint').classList.add('hidden');
  $('hud').style.opacity = 0;
  minimap.hide();
  $('skipHint').textContent = isTouch() ? '[ toucher l\'écran pour passer ]' : '[ passer : clic ou touche ]';
  $('skipHint').classList.remove('hidden');
  G.exitStats = { time: G.time, sanity: G.sanity }; // the report shows the night as it was at the gate
  const sortie = hosp.doorNamed('Sortie', 0);
  return finale.play(
    { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: player.yaw, pitch: player.pitch },
    {
      thought1: () => thought('L\'air froid… La pluie.', { dur: 2.6 }),
      doorShut: () => { if (sortie) sortie.target = 0; audio.doorSlam(sortie?.center ?? new THREE.Vector3(EXIT.x, -2.1, EXIT.z)); },
      thought2: () => thought('Ne te retourne pas.', { dur: 2.6 }),
      lightning: () => { forceLightning = true; },
      watcherGone: () => audio.whisper(new THREE.Vector3(EXIT.x + 3.6, 1.5, EXIT.z)),
      thought3: () => thought('Ils ne me reprendront pas.', { dur: 3 }),
      chord: () => audio.outro(),
      fadeOut: (dur = 2.6) => { $('skipHint').classList.add('hidden'); $('fade').style.transition = `opacity ${dur}s`; $('fade').style.opacity = 1; },
    },
  );
}
// Developer shortcut (Options > Développeur > Terminer la partie): in front of the exit gate, open it and walk out.
function walkOut() {
  if (G.over || ending) return;
  if (G.mode === 'computer') leaveComputer(false);
  const door = hosp.doorNamed('Sortie', 0);
  if (door) { door.target = 1; audio.doorUnlock(door.center); }
  player.pos.set(EXIT.x, 0, EXIT.z - 0.9); player.y = -FH_ROOM; player.vy = 0; player.yaw = Math.PI; player.pitch = 0;
  updateCamera(G.time);
  dreamEnding();
}
// Skip the walk outside: any key, click or tap.
function skipWalk(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
  finale.skip();
}
addEventListener('keydown', (e) => { if (finale.active && !G.paused) skipWalk(e); }, true);
addEventListener('pointerdown', (e) => { if (finale.active && !G.paused && !menus.isOpen()) skipWalk(e); }, true);

function endGame(kind = 'sanity') {
  if (G.over) return;
  G.over = true; G.mode = 'end';
  // An ending reached behind the pause menu: the report must not stay under it.
  if (G.paused) { G.paused = false; audio.setPaused(false); menus.hideAll(); }
  $('resumeHint').classList.add('hidden');
  dropSave();
  if (kind !== 'dream') audio.stinger(true);
  expectUnlock = document.pointerLockElement === canvas;
  document.exitPointerLock?.();
  $('hud').classList.add('hidden'); $('prompt').classList.add('hidden'); $('skipHint').classList.add('hidden');
  minimap.hide();
  $('fade').style.transition = 'opacity 1.2s';
  $('fade').style.opacity = 1;
  // The report (fin.js): the night as the staff wrote it down, over the last view, dimmed.
  const end = G.exitStats ?? { time: G.time, sanity: G.sanity };
  const m = 3 * 60 + 17 + Math.floor(end.time / 60);
  const stats = {
    time: end.time, sanity: end.sanity, hints: G.hints, errors: G.errors, pillsTaken: G.pillsTaken, pseudo: G.pseudo,
    blouse: G.blouse, leftRoom: G.leftRoom,
    clock: `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    where: inRoom() ? 'Chambre 104' : whereLabel(),
    steps: [['Porte de la chambre 104', G.unlocked], ['Psychiatre référent identifié', G.psyKnown], ['Trousseau du Dr Morel', G.keys],
      ['Clé de la salle de réunion', G.meetingKey], ['Carte d\'accès', G.card]],
    escape: G.escape ? { seconds: G.escape.seconds, score: scoreOf(G.escape), cheated: G.cheated } : null,
  };
  setTimeout(() => {
    $('fade').style.transition = 'opacity 2.5s';
    $('fade').style.opacity = kind === 'dream' ? 0.55 : 0.7;
    showReport($('end'), { kind, stats, audio, onRestart: restart, onMenu: mainMenu, online: { publish: !!publishState(), board: shell.embedded } });
    if ($('endPublish')) $('endPublish').onclick = publishRun;
    if ($('endBoard')) $('endBoard').onclick = () => shell.leaderboard();
    refreshPublish();
  }, kind === 'dream' ? 900 : 1300);
}
// Eyelids, drawn by the black veil: steps of [opacity, seconds], each eased like a lid (slow to part, quick to droop).
async function eyelids(steps) {
  const fade = $('fade');
  for (const [o, secs] of steps) {
    const d = vary(secs, 0.1);
    fade.style.transition = `opacity ${d}s ${o < parseFloat(fade.style.opacity || 0) ? 'cubic-bezier(0.4, 0, 0.3, 1)' : 'cubic-bezier(0.5, 0, 0.8, 0.6)'}`;
    fade.style.opacity = o;
    await wait(d);
  }
}
// A fall to the floor: the knees give first (a sag, the head tipping), then the body drops, hits and rebounds a little.
// end: { y (eyes above the floor), yaw, pitch, roll }. sag: how long the legs hold. Resolves on the ground.
async function fallDown({ y, yaw, pitch, roll }, sag = 0.5, drop = 0.55) {
  const p = camera.position.clone(), side = Math.sign(roll) || 1;
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const mid = p.clone().setY(Math.min(p.y, player.y + EYE) - 0.35).addScaledVector(right, 0.05 * side);
  await camTo(mid, new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch * 0.5 - 0.15, player.yaw + (yaw - player.yaw) * 0.25, roll * 0.12, 'YXZ')), sag,
    { ease: ease.inOutSine, walk: false, lean: 0 });
  const end = p.clone().setY(player.y + y).addScaledVector(right, 0.25 * side);
  const fall = camTo(end, new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ')), drop, { ease: ease.fall, turn: ease.fall, walk: false, lean: 0 });
  setTimeout(() => audio.fallThud(), drop * 800); // on the impact
  await fall;
}
async function collapse() {
  if (ending || G.over) return;
  ending = true;
  if (G.mode === 'panel') panelClose?.(false);
  if (G.mode === 'doc') { $('doc').classList.add('hidden'); const then = docClosed; docClosed = null; then?.(); } // the sheet goes back
  if (choiceKey) { choiceKey = null; $('choices').classList.add('hidden'); }
  G.mode = 'fallen';
  if (pcAt?.os.active) { pcAt.os.setActive(false, G.time); $('osLayer').classList.add('hidden'); $('osHint').classList.add('hidden'); hands.restBoth(0.3); }
  await fallDown({ y: 0.25, yaw: player.yaw + 0.6, pitch: -0.3, roll: 1.4 }, 0.45, 0.5);
  await wait(0.7);
  endGame('sanity');
}
// The staff notice the escaped patient: a sedative, he loses consciousness.
let ending = false;
async function caughtEnding(alreadySaid = false) {
  if (ending || G.over) return;
  ending = true;
  G.mode = 'fallen';
  keys.clear();
  const staff = { who: 'PERSONNEL', style: 'phone', pitch: 0.9 };
  if (!alreadySaid) await say(['Hé ! Vous, là !', 'C\'est le patient de la 104… Il s\'est échappé de sa chambre !'], staff);
  await say(['Restez ici. Le médecin arrive.'], { who: 'AGENT DE SÉCURITÉ', style: 'phone', pitch: 0.8 });
  if (!treatment.begin(camera.position, player.yaw, player.y)) {
    // No safe approach in this confined spot: never claim an injection that could not be shown.
    await say(['Nous vous raccompagnons dans votre chambre.'], staff);
    endGame('caught');
    return;
  }
  const medicEye = treatment.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
  await camTo(camera.position.clone(), lookQuat(camera.position, medicEye), 0.6, { walk:false, lean:0 });
  if (!await treatment.arrived()) {
    await say(['Nous vous raccompagnons dans votre chambre.'], staff);
    endGame('caught');
    return;
  }
  await camTo(camera.position.clone(), lookQuat(camera.position, treatment.pos.clone().add(new THREE.Vector3(0, 1.15, 0))), 0.6, { walk:false, lean:0 });
  const medic = { who: 'MÉDECIN', style: 'phone', pitch: 0.9 };
  await say(['Tenez-le. Doucement…'], medic);
  await treatment.inject();
  await say(['Voilà. Le sédatif va faire effet.'], medic);
  relief = 0; blackout = 1;
  // The sedative: the legs go slowly, the world tilts, then he slumps to the floor.
  await fallDown({ y: 0.3, yaw: player.yaw + 0.4, pitch: -0.2, roll: 1.3 }, 1.3, 0.75);
  thought('Non… je ne suis pas…', { glitch: true, dur: 2 });
  await wait(1.8);
  endGame('caught');
}
// Lying in bed, head on the pillow, eyes on the ceiling: how the game starts and how it ends.
function lieInBed(mode = 'fallen') {
  G.mode = mode;
  keys.clear();
  const pillow = new THREE.Vector3(); assets.medical_bed.getObjectByName('pillow').getWorldPosition(pillow);
  player.pos.set(pillow.x, 0, pillow.z); player.y = 0;
  const eye = pillow.clone().add(new THREE.Vector3(0, 0.25, 0));
  cam.scripted = true; cam.from = null; cam.curve = null; cam.standing = false;
  cam.to = { pos: eye, quat: lookQuat(eye, eye.clone().add(new THREE.Vector3(0.3, 1, 0.4))) };
}
// A new game: he wakes up in his bed, sits on the edge, gets up, and the player takes over.
async function wakeUp() {
  // The introduction is a scripted action, not the irreversible collapse at the end of a run.
  lieInBed('busy');
  // The eyes open with difficulty: a first slit, they close again, then open for good.
  await wait(0.35);
  await eyelids([[0.5, 0.9], [0.9, 0.3], [0.2, 0.75], [0.55, 0.18], [0, 0.9]]);
  thought('…Quelle heure il est ?', { dur: 2 });
  // A look aside, at the room, still lying.
  const eye = camera.position.clone().sub(cam.off.pos);
  const room = new THREE.Vector3(START.x, 1.1, 0.6);
  await camTo(eye, lookQuat(eye, eye.clone().lerp(room, 0.5).setY(eye.y + 0.55)), 1.3, { ease: ease.inOutSine, walk: false, lean: 0 });
  await wait(between(0.3, 0.6));
  G.mode = 'busy';
  audio.noise(0.9, { f: 500, q: 0.8, gain: 0.05 }); // the sheets
  // Sitting up: the head rises first, then swings round over the edge of the bed.
  const edge = new THREE.Vector3(START.x, 0.95, -2.2);
  const rise = eye.clone().lerp(edge, 0.35).setY(Math.max(eye.y, edge.y) + 0.22);
  await camTo(edge, lookQuat(edge, new THREE.Vector3(START.x, 0.1, -1.5)), 1.75, { via: rise, walk: false, lean: 0.6 });
  // A moment on the edge, head low, then a breath and a look up at the room.
  await wait(between(0.4, 0.7));
  const up = edge.clone().add(new THREE.Vector3(0, 0.03, -0.02));
  await camTo(up, lookQuat(up, new THREE.Vector3(START.x + 0.1, 0.85, 0)), 0.9, { ease: ease.inOutSine, walk: false, lean: 0 });
  await wait(between(0.3, 0.5));
  // Standing: the weight goes forward over the feet, then up, a little wobble at the top.
  const feet = new THREE.Vector3(START.x, EYE, START.z);
  const over = edge.clone().lerp(feet, 0.55).setY(edge.y + 0.05);
  audio.step(0.3);
  await camTo(feet, new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, START.yaw, 0, 'YXZ')), 1.35,
    { via: over, ease: (k) => ease.outBack(ease.inOutSine(k), 0.6), walk: false, lean: 0.5 });
  releaseCam();
  done();
  thought('Encore cette chambre… Il faut que je sorte d\'ici. Je ne suis pas malade.');
}
// Through the gate: he walks out into the rain… and wakes up in his bed, in room 104.
async function dreamEnding() {
  if (ending || G.over) return;
  ending = true;
  // Out in the rain, to the road and the first light (fin.js)…
  await walkOutside();
  finale.release();
  G.mode = 'fallen';
  keys.clear();
  audio.collapse();
  await wait(1.4);
  // … back in the room, lying in bed, the door shut and the service box closed again.
  G.torchOn = false;
  hands.restBoth(0.3);
  world.doorPivot.rotation.y = 0;
  world.lockLed.material.color.setRGB(3, 0.2, 0.1);
  if (roomBox) { roomBox.lid.rotation.x = 0; roomBox.key.visible = true; }
  lieInBed();
  G.sanity = 1;
  await eyelids([[0.5, 1.2], [0.85, 0.4], [0, 1.3]]);
  audio.thump(0.3);
  thought('…', { dur: 1.5 });
  await wait(1.8);
  thought('Encore cette chambre ? Je… je suis sorti. J\'étais dehors.', { dur: 3.5 });
  await wait(4);
  thought('Ce n\'était qu\'un rêve ?', { dur: 3 });
  await wait(3.2);
  heard(LEA.goodnight, null, { dur: 2.6 });
  await wait(2.8);
  endGame('dream');
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
let flickUntil = 0, nextFlick = 5, nextBeat = 0, pulse = 0;
let nextLightning = 6, flash = 0, flashSeq = [], forceLightning = false;
let fpsAvg = 60;
function updateDebug(dt) {
  fpsAvg += (1 / Math.max(dt, 1e-3) - fpsAvg) * 0.05;
  const i = renderer.info.render, p = camera.position, lv = world.tiles.reduce((a, x) => a + x.level, 0) / world.tiles.length;
  $('debug').textContent = `${fpsAvg.toFixed(0)} img/s · ${i.calls} appels · ${(i.triangles / 1000).toFixed(1)}k tri\npos ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)} · cap ${(player.yaw * 57.3 % 360).toFixed(0)}°\nmode ${G.mode} · santé ${(G.sanity * 100).toFixed(0)} % · délabrement ${lv.toFixed(2)}\npièces ${G.coins} · cachets ${G.pills} · indices ${G.hints} · erreurs ${G.errors} · énigme ${stageOf(G)}`;
}
const tmpV = new THREE.Vector3();
let promptHtml = '', whereText = '', hospLight = 0, darkK = 1;
function whereLabel() {
  const room = hosp.roomAt(player.pos.x, player.y, player.pos.z);
  const floor = hosp.floorOf(player.y) ? 'Étage 1' : 'Rez-de-chaussée';
  return room === 'Ascenseur' ? `Ascenseur · ${floor}` : room ? `${floor} · ${room}` : floor;
}
const WIN_CENTER = new THREE.Vector3(WIN.x, (WIN.y0 + WIN.y1) / 2, -RZ_BACK);
// The bodies follow the camera, even when it is scripted (walking up to the phone, sitting at the computer, falling).
const bodyPos = new THREE.Vector3(), bodyPrev = new THREE.Vector3();
function updateBody(dt, t) {
  updatePlayerOutfit(G.blouse);
  const visible = G.started && !G.over && G.mode !== 'end';
  if (cam.scripted) bodyPos.set(camera.position.x, player.y, camera.position.z);
  else bodyPos.set(player.pos.x, player.y, player.pos.z);
  const moved = Math.hypot(bodyPos.x - bodyPrev.x, bodyPos.z - bodyPrev.z);
  if (cam.scripted && visible && moved < 1) bodyBob += moved * 9;
  bodyPrev.copy(bodyPos);
  const shown = mirrors.mirrors.find((m) => m.mesh.visible); // the mirror drawn last frame
  body.update(dt, t, {
    visible, camera, pos: bodyPos, floorY: player.y, bob: player.bob + bodyBob,
    mode: G.mode === 'fallen' ? 'lie' : bodySeat ? 'seat' : 'stand', seat: bodySeat,
    hands, loss: cfg.dHallu ? loss() : 0, mirrorAt: shown ? shown.mesh.getWorldPosition(new THREE.Vector3()) : null,
  });
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const running = G.started && !G.paused && !G.over;
  const pauseAudio = G.started && (G.paused || G.over);
  if (audio.paused !== pauseAudio) audio.setPaused(pauseAudio);
  const narrativePaused = (cfg.pauseDialogues && (bubbleBusy || choiceKey !== null))
    || (cfg.pauseReading && (G.mode === 'doc' || (G.mode === 'computer' && pcAt?.os.reading)));
  if (running && !narrativePaused) G.time += dt;
  const t = G.started ? G.time : clock.elapsedTime;
  const l = loss();

  if (running) {
    if (!G.escape && helped()) G.cheated = true;
    // Sanity drains over the configured duration (three times slower in "Visite" mode).
    const duration = DUREE_PARAM || cfg.dDuration;
    const out = G.mode === 'escape'; // outside, it is over: no more drain, no more visions
    if (!cfg.dFreeze && !out && !narrativePaused) G.sanity = Math.max(0, G.sanity - dt / duration);
    if (G.sanity <= 0 && G.mode !== 'fallen' && !ending) collapse();
    if (G.mode === 'free' && !cam.scripted) { move(dt, t); trackSafeSpot(); }
    // Keep a recent consistent state, so a save asked in the middle of an action is not 45 s old.
    if (G.mode === 'free' && G.time - snapshotAt > 3) { snapshotAt = G.time; takeSnapshot(); }
    if (shell.signedIn() && G.time - lastSaveAt > SAVE_EVERY && G.mode === 'free') saveGame();
    if (cfg.dHallu && !out && t > nextHallu) { nextHallu = t + 26 - 20 * l + Math.random() * 6; hallucinate(); }
    if (!out && !narrativePaused) ambiance?.update();
    if (G.mode === 'free' && t > nextThought && G.sanity < 0.45) {
      nextThought = t + 25;
      // No pill left, or now and then all the same: the panic, then the prayer, then, at the very bottom, he cries.
      const panic = G.sanity < 0.15 ? 'Pardon… pardon…' : G.sanity < 0.25 ? 'Ce n\'est pas réel. Ce n\'est pas réel.' : G.sanity < 0.35 ? 'Respire. Un, deux, trois… respire.' : null;
      if (panic && (G.pills <= 0 || Math.random() < 0.35)) thought(panic, { dur: 3.6 });
      else if (G.pills > 0) thought(`Ma tête… Il me faut un cachet.${keyTag('kPill')}`);
      else if (!G.bottleTaken) thought('Mes cachets… ils sont sur la table.');
    }
  }

  // Lamp swing and flicker.
  const swing = cfg.dSway ? 1 + l * 1.5 : 0;
  lamp.rotation.z = (Math.sin(t * 0.85) * 0.05 + Math.sin(t * 2.3 + 1.7) * 0.008) * swing;
  lamp.rotation.x = (Math.sin(t * 0.61 + 0.6) * 0.03 + Math.sin(t * 1.9) * 0.006) * swing;
  if (t > nextFlick) { flickUntil = t + 0.12 + rnd() * (0.2 + l * 0.3); nextFlick = t + (10 - l * 5) * (0.6 + rnd() * 0.8); }
  const on = !cfg.dFlicker || (t > flickUntil && t > flickBurst) || Math.sin(t * 18) > 0.2;
  const lvl = on ? 1 : 0.08;
  spot.intensity = SPOT_POWER * lvl * cfg.dLamp; bounce.intensity = 0.6 * lvl * cfg.dLamp; coneMat.uniforms.uIntensity.value = 0.06 * lvl;
  bulbMat.color.setRGB(9 * lvl, 7.4 * lvl, 4.6 * lvl).multiplyScalar(Math.min(1.5, cfg.dLamp));
  nightLight.intensity = 0.45 * (0.85 + 0.15 * Math.sin(t * 1.3)) * cfg.dNight;

  // Lightning: a few quick flashes, thunder a moment later.
  if ((cfg.dLightning && t > nextLightning) || forceLightning) {
    forceLightning = false;
    nextLightning = t + 9 + Math.random() * 14;
    const strength = 0.5 + Math.random() * 0.5;
    flashSeq = [[t, strength], [t + 0.09, 0], [t + 0.16, strength * 0.7], [t + 0.3, 0], [t + 0.42, strength * 0.4], [t + 0.55, 0]];
    audio.thunder(0.6 + Math.random() * 1.8, strength);
    // A big one, once he is not well: he tells himself it is only the rain (now and then).
    if (running && strength > 0.8 && l > 0.3 && G.mode === 'free' && G.time - saidAt.rain > 150) {
      saidAt.rain = G.time;
      playWait(3).then(() => thought('C\'est la pluie. Ce n\'est que la pluie.'));
    }
  }
  let target = 0;
  for (const [ts, v] of flashSeq) if (t >= ts) target = v;
  flash = target > flash ? target : flash * Math.exp(-dt * 10);
  world.cityGlow.intensity = (45 + flash * 450) * cfg.dCity;
  world.update(t, dt, flash, l);
  if (running) watchWalls(t, l);
  if (running && forceVoice) { forceVoice = false; const ids = Object.keys(HAL); voices.hal(ids[Math.floor(Math.random() * ids.length)], { strength: Math.max(0.5, l) }); }
  world.updateDecay(camera, cfg.dDecay === 'auto' ? l : cfg.dDecay === 'off' ? 0 : [0, 0.4, 0.65, 0.9][Number(cfg.dDecay)]);
  props?.update(t, dt, l, camera, audio, running);

  // Heartbeat at low sanity.
  const lb = l * (1 - finale.calm);
  if (running && lb > 0.55 && t > nextBeat) { nextBeat = t + 60 / (70 + 80 * lb); pulse = 1; audio.thump(0.4 * lb); }
  pulse = Math.max(0, pulse - dt * 4);
  relief = Math.max(0, relief - dt * 0.4);
  blackout = Math.max(0, blackout - dt * 1.2);

  // Dust.
  const p = dustGeo.attributes.position.array;
  for (let i = 0; i < DUST; i++) {
    const k = dustSeed[i];
    p[i * 3] += Math.sin(t * 0.3 + k) * 0.0006;
    p[i * 3 + 1] -= 0.015 * dt * (0.3 + (k % 1));
    p[i * 3 + 2] += Math.cos(t * 0.27 + k * 1.3) * 0.0006;
    if (p[i * 3 + 1] < 0.78) p[i * 3 + 1] = 1.8;
  }
  dustGeo.attributes.position.needsUpdate = true;

  // Phantom ringing shakes the phone.
  const phone = assets.wall_phone;
  phone.position.copy(phone.userData.home);
  if (G.time < phoneShakeUntil) phone.position.y += Math.sin(t * 160) * 0.003;
  // The figure vanishes when looked at, or after a while.
  if (figure.visible) {
    // Barely moving: it breathes, and the head searches.
    if (figureRig) {
      figureRig.head.rotation.z = Math.sin(t * 0.7) * 0.09;
      figureRig.head.rotation.y = Math.sin(t * 0.43 + 1) * 0.12;
      if (figureRig.arm_l) figureRig.arm_l.rotation.x = Math.sin(t * 0.9) * 0.035;
      if (figureRig.arm_r) figureRig.arm_r.rotation.x = Math.sin(t * 0.9 + 2) * 0.035;
    }
    const d = figure.position.clone().setY(1.5).sub(camera.position).normalize();
    const seen = d.dot(camera.getWorldDirection(tmpV)) > 0.93;
    const leaves = figureForced ? !cfg.dFigureStay && G.time > figureUntil : seen || G.time > figureUntil;
    if (leaves) {
      const forced = figureForced;
      figure.visible = false;
      figureForced = false;
      if (seen) audio.stinger();
      if (seen && loss() > 0.6 && Math.random() < 0.3) heard(LEA.soleil, figure.position.clone().setY(1.0));
      else {
        audio.whisper(figure.position.clone().setY(1.6));
        // He turns on it, then tells himself nobody was there (each one now and then).
        if (seen && !forced && G.time - saidAt.figure > 60) {
          saidAt.figure = G.time;
          thought('Qui est là ?', { dur: 1.6 });
          if (G.time - saidAt.nobody > 150) { saidAt.nobody = G.time; playWait(3.5).then(() => thought('Il n\'y avait personne. Il n\'y avait personne.')); }
        }
      }
    }
  }

  if (G.mode === 'free' && cam.scripted && !cam.from && !cam.standing) standUp();
  updateCamera(t);
  // The building's ceiling lights: off from inside the room (no shadows: they would shine through its walls),
  // fading in as the player reaches the open door.
  // The laundry is dark (énigme 3): no building light, hardly any light around the player, only the torch.
  const dark = hosp.roomAt(player.pos.x, player.y, player.pos.z) === 'Laverie' && G.started;
  const lightWant = dark ? 0 : inRoom() ? (G.doorOpen ? clamp01((player.pos.x - 0.9) / 1.1) : 0) : 1;
  hospLight += (lightWant - hospLight) * Math.min(1, dt * 4);
  darkK += ((dark ? 0.05 : 1) - darkK) * Math.min(1, dt * 3);
  playerLight.intensity = PLAYER_LIGHT * cfg.dPlayerLight * darkK;
  hosp.update(running ? dt : 0, t, { player, camera, light: hospLight, sanityLoss: l });
  npcs?.update(running ? dt : 0, G.time, camera.position, {
    active: G.mode === 'free' && G.leftRoom && !ending && !finale.driving,
    consumed: G.patientEncounterDone === true,
    blouse: G.blouse,
    onStep: (pos) => audio.step(0.16, pos),
    onCatch: () => {
      G.patientEncounterDone = true;
      G.sanity = Math.max(0, G.sanity - 0.2);
      audio.stinger();
      audio.thump(0.6);
    },
  });
  treatment?.update(running ? dt : 0, G.time, (pos) => audio.step(0.16, pos));
  // Outside: fog thins and turns to rain mist, the sickness lets go during the walk away.
  const outside = finale.update(dt, t, { flash, camera, player, paused: G.paused, rainOn: cfg.dRain });
  windowView.update(dt, t, { flash, camera, player, paused: G.paused, hidden: finale.driving, sanityLoss: l });
  const calm = finale.calm;
  scene.fog.density = cfg.dFog + (Math.min(cfg.dFog, 0.03) - cfg.dFog) * outside;
  scene.fog.color.setRGB(0.035 * outside, 0.045 * outside, 0.06 * outside);
  touch.update(dt);
  // On-screen keyboard open at the computer: shift the image up so the screen stays above it.
  if (touch.lift > 0.5) camera.setViewOffset(innerWidth, innerHeight, 0, touch.lift, innerWidth, innerHeight);
  else if (camera.view?.enabled) camera.clearViewOffset();
  updateTorch(t);
  hands.tremor = cfg.dTremor ? Math.max(0, loss() - 0.4) * 1.7 : 0;
  if (hands.ready) hands.right.root.visible = hands.left.root.visible = cfg.dHands && !finale.driving;
  hands.update(dt, t);
  updateBody(dt, t);
  updateCord();
  updateFocus();
  updateOverlay();
  for (const C of computers) C.os.update(t, l);
  audio.updateListener(camera);
  audio.update(dt, { rainNear: Math.max(clamp01(1 - camera.position.distanceTo(WIN_CENTER) / 4.5), outside * 1.6 * finale.rain), sanityLoss: l * (1 - calm), lampOn: on });

  // HUD.
  updateHud();
  updateMinimap();
  const where = G.started && !inRoom() ? whereLabel() : '';
  if (where !== whereText) { whereText = where; $('where').textContent = where; }
  const showPrompt = !!focused;
  $('prompt').classList.toggle('hidden', !showPrompt);
  if (showPrompt) {
    const html = `<b>${isTouch() ? '✋' : keyLabel(cfg.kInteract)}</b>${focused.text}`;
    if (html !== promptHtml) { promptHtml = html; $('prompt').innerHTML = html; }
  }
  $('crosshair').classList.toggle('hot', showPrompt);
  $('crosshair').classList.toggle('hidden', !G.started || G.mode !== 'free' || G.over);

  // Post uniforms. At the computer the lens effects calm down so the overlay lines up.
  const u = night.uniforms, atScreen = G.mode === 'computer' ? 1 : 0;
  u.uTime.value = t;
  u.uLoss.value = cfg.dSickFx ? l * (1 - 0.6 * atScreen) * (1 - calm) : 0;
  u.uPulse.value = pulse * l * (1 - calm);
  u.uRelief.value = Math.max(relief, calm * 0.9);
  u.uBlack.value = blackout * 0.85;
  u.uBarrel.value = cfg.dBarrel * (1 - atScreen);
  menus.update(performance.now());
  if (cfg.dDebug) updateDebug(dt);

  securityMonitors?.update(dt, camera, G.started && !G.paused);
  mirrors.update(camera, cfg.dMirror && G.started && !G.paused);
  if (settings.postFX) composer.render(dt); else renderer.render(scene, camera);
  hudScreen.update(dt, settings.postFX);
  requestAnimationFrame(frame);
}

// ---------- The story's objects and their interactions (histoire.js) ----------
// A table's drawer that slides out along the table's own +z. contents: an object laid in it, or null.
function makeDrawer(table, contents) {
  const drawer = table.getObjectByName('drawer');
  const handleObj = table.getObjectByName('drawer_handle');
  const out = new THREE.Vector3(0, 0, 1).applyQuaternion(table.getWorldQuaternion(new THREE.Quaternion()));
  if (contents) {
    const tray = new THREE.Box3().setFromObject(table.getObjectByName('drawer_tray'));
    const c = tray.getCenter(new THREE.Vector3()).addScaledVector(out, 0.12);
    scene.add(contents);
    contents.position.set(c.x, tray.min.y + 0.03, c.z);
    contents.rotation.y += table.rotation.y;
    drawer.attach(contents);
  }
  const state = { open: false };
  const z0 = drawer.position.z;
  state.restore = (open) => { state.open = open === true; drawer.position.z = z0 + (state.open ? 0.3 : 0); };
  // Its front: the side to use it from, whatever side the player comes from.
  const face = out.clone().setY(0).normalize(), ry = yawOf(face);
  if (contents) contents.userData.drawerFace = face;
  addInteractable(drawer, () => (state.open ? 'Fermer le tiroir' : 'Ouvrir le tiroir'), async () => {
    G.mode = 'busy';
    // Crouched in front of it, hand on the handle (the hand follows the handle as the drawer slides).
    const grip = (o = 0) => handOn(hands.right, () => centerOf(handleObj).addScaledVector(face, o), -0.2, ry, 0);
    const h = centerOf(handleObj);
    await reachFor([{ hand: hands.right, wrist: () => grip(0)().pos }], { at: h, face, near: 0.3 });
    await hands.right.to(grip(0.06), 0.35, 'open');
    await hands.right.to(grip(0), 0.15, 'hold');
    state.open = !state.open;
    audio.drawer(state.open, h);
    const a = drawer.position.z, b = state.open ? z0 + 0.3 : z0;
    // The body goes with the handle: back as it pulls, forward as it pushes; the hand stays on it.
    const shift = face.clone().multiplyScalar(b - a);
    const c1 = camera.position.clone().add(shift);
    camTo(c1, reachView(c1, h.clone().add(shift)), 0.6);
    await tween(0.6, (k) => { drawer.position.z = a + (b - a) * k; }, ease.reach);
    const look = centerOf(drawer);
    audio.click(look, 0.12);
    await hands.right.to(grip(0.07), 0.18, 'open');
    // Opened: a look inside.
    if (state.open) camTo(c1, lookQuat(c1, look.clone().addScaledVector(face, 0.1)), 0.45);
    await restRight(0.4);
    done();
  }, 2.0);
  return state;
}
// Local (x, z) on a model turned by yaw → world offset.
const turn = (lx, lz, yaw) => [lx * Math.cos(yaw) + lz * Math.sin(yaw), -lx * Math.sin(yaw) + lz * Math.cos(yaw)];
// Yaw that turns a group's front (-Z) towards the direction d = [x, z].
const facing = (d) => Math.atan2(-d[0], -d[1]);
function solidBox(obj) {
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj);
  // Furniture: it stops the player, not the eyes or the hands (one reaches into it, over it).
  hosp.addCollider(b.min.x, b.min.z, b.max.x, b.max.z, b.min.y, b.max.y, { furniture: true });
}
// The story's coins, in order of creation: saved games keep which ones were picked up.
const storyCoins = [];
function addCoin(x, y, z, where) {
  const c = world.makeCoin();
  c.position.set(x, y + 0.0015, z);
  scene.add(c);
  const entry = { c, taken: false };
  storyCoins.push(entry);
  addInteractable(c, () => (entry.taken ? null : 'Ramasser la pièce'), () => { entry.taken = true; pickUpCoin(c, where); }, 1.9, { pad: 0.035, min: 0.08 });
  return c;
}
const animate = (dur, fn, curve = ease.body) => tween(dur, fn, curve);

async function setupStory({ roomDrawer }) {
  const S = {};
  const medicine = [];
  const addMedicine = async (id, pos) => {
    const bottle = await place('pills', { ...pos, key: `pills_${id}` });
    const entry = { id, bottle, taken: false };
    medicine.push(entry);
    addInteractable(bottle, () => (entry.taken ? null : 'Prendre le flacon (1 cachet)'), () => {
      entry.taken = true;
      return takeBottle(bottle, 1);
    }, 2.0, { pad: 0.03 });
  };
  // ----- Énigme 1: a forgotten service box on the desk contains the room key.
  roomBox = makeRoomBox();
  roomBox.open = roomBox.keyTaken = false;
  roomBox.group.position.set(-0.35, TABLE.h, 0.05);
  scene.add(roomBox.group);
  let padlockSeen = false;
  addInteractable(roomBox.group, () => (roomBox.open ? null : 'Boîte du soignant (cadenassée)'), async () => {
    // The first look at the wheels.
    if (!padlockSeen) { padlockSeen = true; thought('Quatre chiffres… Le numéro de la chambre, et le mien ?', { dur: 4 }); }
    const ok = await codePanel({
      title: 'BOÎTE DU SOIGNANT', sub: 'Sous les molettes : « CH · PAT ».',
      labels: ['chambre', 'patient'], check: (code) => code === STORY.padlock,
    });
    if (!ok) return;
    G.mode = 'busy';
    roomBox.open = true;
    audio.doorUnlock(centerOf(roomBox.group));
    await animate(0.8, (k) => { roomBox.lid.rotation.x = 1.7 * k; }, (k) => ease.outBack(k, 0.8));
    done();
    thought('Une clé de service… Elle doit ouvrir la chambre.');
  }, 2.0);
  addInteractable(roomBox.key, () => (roomBox.open && !roomBox.keyTaken ? 'Prendre la clé de la chambre' : null), async () => {
    G.mode = 'busy';
    await reach(centerOf(roomBox.key), { grip: 'pinch' });
    audio.pickup();
    roomBox.keyTaken = true;
    roomBox.key.visible = false;
    toast('Clé de service : chambre 104', 3);
    await restRight(0.4);
    done();
  }, 2.0, { pad: 0.03, min: 0.08 });

  // ----- Énigme 2, archives: desk against the door wall, PC, torch in the drawer.
  let readOldMorel = false;
  const A0 = storySpot(1, 'Archives', 0, 0), A = storySpot(1, 'Archives', -3.2, -A0.hv + 0.42);
  const desk = await place('table', { x: A.x, z: A.z, ry: A.yaw, key: 'table_archives' });
  const [cx, cz] = turn(-0.22, 0.74, A.yaw);
  await place('chair', { x: A.x + cx, z: A.z + cz, ry: A.yaw + Math.PI + 0.25, key: 'chair_archives' });
  const [tx, tz] = turn(-0.3, -0.12, A.yaw);
  await addComputer({
    key: 'terminal_archives', x: A.x + tx, z: A.z + tz, floorY: 0, yaw: A.yaw + 0.2, profile: 'archives',
    onRead: (file) => {
      // The old occupant's file (histoire.js): the trap of the other Dr Morel, once.
      if (file === 'oldMorel') {
        if (!readOldMorel) { readOldMorel = true; setTimeout(() => thought('Hélène Morel… Le même nom que mon psychiatre.', { dur: 4 }), 400); }
        return;
      }
      if (G.psyKnown) return;
      G.psyKnown = true;
      setTimeout(() => thought('Psychiatre référent : Dr William Morel. Mon psychiatre… Je dois m\'en souvenir.', { dur: 4 })
        .then((v) => playWait((v ? v.remaining : 4) + 0.6))
        .then(() => { if (G.mode === 'computer') thought('Patient vingt-sept. Pas de nom. Juste un numéro.', { dur: 3.6 }); }), 400);
    },
  });
  const [px, pz] = turn(0.4, -0.12, A.yaw);
  await addMedicine('archives', { x: A.x + px, y: TABLE.h, z: A.z + pz, ry: A.yaw });
  solidBox(desk);
  S.archDrawer = makeDrawer(desk, torch);
  occluders.push(desk);
  addInteractable(torch, () => (G.torch || !S.archDrawer.open ? null : 'Prendre la lampe torche'), takeTorch, 2.0, { pad: 0.03 });
  addCoin(storySpot(1, 'Archives', 1.1, 0.7).x, 0, storySpot(1, 'Archives', 1.1, 0.7).z, 'entre deux armoires des archives');

  // ----- Room 109, outside the story: The King in Yellow lies on the desk (hopital/mobilier.js puts it at u 0.75, v -0.65).
  const KY = storySpot(1, '109', 0.82, -0.84);
  const book = await place('props/king_in_yellow', { x: KY.x, z: KY.z, key: 'king_in_yellow' });
  book.rotation.set(-Math.PI / 2, KY.yaw + Math.PI + 0.35, 0, 'YXZ'); // Cover up, with the title readable from the desk chair.
  book.updateMatrixWorld(true);
  book.position.y += TABLE.h - new THREE.Box3().setFromObject(book).min.y;
  addInteractable(book, () => 'Regarder le livre', () => thought('Je tiendrai ma promesse.'), 1.9, { pad: 0.03 });

  // ----- Énigme 3, laundry: the coats on a rack against the south wall, readable with the torch only.
  const L0 = storySpot(1, 'Laverie', 0, 0), L = storySpot(1, 'Laverie', -(L0.hu - 0.3), 0);
  const rack = makeCoatRack();
  rack.group.position.set(L.x, 0, L.z);
  rack.group.rotation.y = facing(L.right);
  scene.add(rack.group);
  solidBox(rack.group);
  const lit = () => G.torch && G.torchOn;
  const searchedCoats = new Set();
  COATS.forEach((c, i) => {
    const coat = rack.coats[i];
    let searched = false;
    Object.defineProperty(coat.userData, 'searched', { get: () => searched, set: (v) => { searched = v; } });
    const isMorel = c.pocket === 'keys';
    addInteractable(coat, () => {
      if (!lit()) return 'Une blouse (trop sombre pour lire le nom)';
      if (isMorel) return G.blouse ? null : G.keys ? `Enfiler la blouse : ${c.who}` : `Blouse : ${c.who} · fouiller les poches`;
      return searched ? `Blouse : ${c.who}` : `Blouse : ${c.who} · fouiller les poches`;
    }, async () => {
      if (!lit()) { thought(G.torch ? `Je ne vois rien. La lampe…${keyTag('kTorch')}` : 'Je ne vois rien. Il me faut une lampe.'); return; }
      // The hand goes into the pocket, from the front of the coat.
      const p = coat.children[4].getWorldPosition(new THREE.Vector3());
      if (isMorel && G.keys) { wearCoat(coat); return; }
      // The embroidered name, read aloud (one recording per coat, histoire.js), then the pocket.
      const name = thought(`La blouse de ${c.who}.`, { take: c.voice });
      if (searched && !isMorel) return;
      G.mode = 'busy';
      await reach(p, { grip: 'hold', face: coatFront(), pitch: -0.5 });
      const read = await name;
      if (read?.remaining > 0) await playWait(read.remaining + 0.2);
      audio.pickup();
      await hands.right.to(hands.rest.right, 0.4, 'relaxed');
      if (G.mode === 'busy' && !isMorel) G.mode = 'free';
      searched = true;
      searchedCoats.add(i);
      if (c.pocket === 'coin') { const coin = world.makeCoin(); coin.position.copy(p); scene.add(coin); await pickUpCoin(coin, 'dans une poche de blouse'); return; }
      if (!isMorel) { thought(c.pocket); return; }
      // The keyring: énigme 3 solved. Wearing the coat is a choice, with consequences downstairs.
      G.keys = true;
      toast('Trousseau de clés du Dr William Morel', 3.5);
      await say(['Ses clés… L\'escalier, sûrement. Et cette blouse : de loin, on me prendrait pour un médecin.'], { who: 'VOUS', style: 'thought' });
      const k = await choose(['Enfiler la blouse du Dr Morel', 'La laisser sur le portant']);
      if (k === 0) wearCoat(coat);
      else { if (G.mode === 'busy') G.mode = 'free'; thought('Pas maintenant.'); }
    }, 1.8);
  });
  // The way the coats face (towards the room), flat.
  const coatFront = () => new THREE.Vector3(0, 0, -1).transformDirection(rack.group.matrixWorld).setY(0).normalize();
  // Both hands take the coat by the shoulders, lift it off the rail and swing it on over the shoulders.
  async function wearCoat(coat, { instant = false } = {}) {
    G.blouse = true;
    if (!instant) {
      G.mode = 'busy';
      const face = coatFront(), right = new THREE.Vector3(face.z, 0, -face.x); // the player's right, facing the coat
      const top = coat.getWorldPosition(new THREE.Vector3());
      const shoulder = (sg) => top.clone().addScaledVector(right, 0.15 * sg).add(new THREE.Vector3(0, -0.1, 0)).addScaledVector(face, 0.04);
      const q = handQuat(-0.3, yawOf(face));
      const on = (hand, sg) => () => ({ pos: wristFor(hand, shoulder(sg), q), quat: q });
      await reachFor([{ hand: hands.right, wrist: () => on(hands.right, 1)().pos }, { hand: hands.left, wrist: () => on(hands.left, -1)().pos }], { at: top.clone().add(new THREE.Vector3(0, -0.3, 0)), face, side: 0, near: 0.3 });
      await Promise.all([hands.right.to(on(hands.right, 1), 0.4, 'hold'), hands.left.to(on(hands.left, -1), 0.4, 'hold')]);
      const home = coat.parent;
      hands.right.grip.attach(coat);
      audio.coat();
      // Off the rail, up in front of the face…
      await Promise.all([hands.right.to(camPose(camera, 0.2, 0.08, -0.34, 0.3, 0, 0), 0.5, 'hold'), hands.left.to(camPose(camera, -0.2, 0.08, -0.34, 0.3, 0, 0), 0.5, 'hold')]);
      // … and round the back, the arms into the sleeves.
      await Promise.all([hands.right.to(camPose(camera, 0.3, -0.05, 0.12, 0.6, 0, 0), 0.45, 'relaxed'), hands.left.to(camPose(camera, -0.3, -0.05, 0.12, 0.6, 0, 0), 0.45, 'relaxed')]);
      home.attach(coat);
      coat.visible = false;
      await hands.restBoth(0.45);
    }
    coat.visible = false;
    if (instant) audio.coat();
    if (G.mode === 'busy') G.mode = 'free';
    setTimeout(() => thought('Elle sent le tabac froid. Je suis le docteur Morel, maintenant.'), 600);
  }

  // ----- Énigme 4, security post: the locker (note on it) and the PC with the program to correct.
  const P0 = storySpot(0, 'Poste de sécurité 001', 0, 0);
  const T = storySpot(0, 'Poste de sécurité 001', 0, P0.hv - SECURITY_DESK_GAP);
  await addComputer({
    key: 'terminal_securite', x: T.x + T.fwd[0] * 0.08, z: T.z + T.fwd[1] * 0.08, floorY: -FH_ROOM, yaw: T.yaw + Math.PI, profile: 'securite',
    onUnlock: () => openLocker(),
  });
  const K = storySpot(0, 'Poste de sécurité 001', -(P0.hu - 0.25), -1.4);
  const locker = makeLocker();
  locker.group.position.set(K.x, K.y, K.z);
  locker.group.rotation.y = facing(K.right);
  scene.add(locker.group);
  solidBox(locker.group);
  occluders.push(locker.group);
  addInteractable(locker.note, () => 'Lire la note', () => showDoc('noteCasier'), 2.0);
  addInteractable(locker.doors[2], () => (G.lockerOpen ? null : 'Casier n° 3 (verrouillé électroniquement)'), () => {
    audio.locked(locker.led.getWorldPosition(new THREE.Vector3()));
    thought('Fermé. Pas de serrure, juste un voyant. Le PC, peut-être ?');
  }, 2.0);
  addInteractable(locker.key, () => (G.lockerOpen && !G.meetingKey ? 'Prendre la clé de la salle de réunion' : null), async () => {
    G.mode = 'busy';
    await reach(locker.key.getWorldPosition(new THREE.Vector3()), { grip: 'pinch' });
    audio.pickup();
    locker.key.visible = false;
    G.meetingKey = true;
    toast('Clé de la salle de réunion', 3);
    await hands.right.to(hands.rest.right, 0.4, 'relaxed');
    if (G.mode === 'busy') G.mode = 'free';
  }, 2.0);
  async function openLocker() {
    if (G.lockerOpen) return;
    G.lockerOpen = true;
    locker.led.material.color.setRGB(0.2, 3, 0.4);
    audio.doorUnlock(locker.group.getWorldPosition(new THREE.Vector3()));
    setTimeout(() => thought('Un déclic, du côté du casier…'), 700);
    await animate(1.2, (k) => { locker.open.rotation.y = 1.8 * k; }, ease.push);
  }
  S.openLocker = openLocker;

  // ----- Énigme 5, meeting room: the night shift board and the on-call directory, on the far wall.
  const M0 = storySpot(0, 'Salle de réunion 008', 0, 0);
  const placedTasks = Array(5).fill(null); // task id per slot
  const board = makeBoard(1.6, 1.0, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8ece6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f3a2c'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText('ORGANISATION DE LA GARDE', w / 2, 18);
    ctx.textAlign = 'left';
    SLOTS.forEach((at, i) => {
      const y = 30 + i * 22;
      ctx.fillStyle = '#2a2a24'; ctx.font = 'bold 11px monospace'; ctx.fillText(at, 8, y + 14);
      ctx.strokeStyle = '#7a8a80'; ctx.strokeRect(70, y + 2, 176, 18);
      const task = TASKS.find((x) => x.id === placedTasks[i]);
      if (task) { ctx.fillStyle = '#f2e6a0'; ctx.fillRect(71, y + 3, 174, 16); ctx.fillStyle = '#2a2a24'; ctx.font = '9px monospace'; ctx.fillText(task.label.slice(0, 30), 74, y + 14); }
    });
    ctx.fillStyle = '#4a4a40'; ctx.font = '8px monospace';
    ctx.fillText('Le médecin de la visite garde la carte de sortie…', 8, h - 8);
  });
  const B = storySpot(0, 'Salle de réunion 008', -0.9, M0.hv, 1.55);
  board.group.position.set(B.x, B.y, B.z);
  board.group.rotation.y = facing([-M0.fwd[0], -M0.fwd[1]]);
  scene.add(board.group);
  const dir = makeBoard(1.0, 1.0, 160, (ctx, w, h) => {
    ctx.fillStyle = '#20241e'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d8d0b0'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.fillText('ANNUAIRE DE GARDE', w / 2, 18);
    ctx.textAlign = 'left';
    ANNUAIRE.forEach((a, i) => {
      const y = 36 + i * 43, on = G.planning && a.key;
      if (on) { ctx.fillStyle = '#ffe070'; ctx.fillRect(4, y - 12, w - 8, 40); }
      ctx.fillStyle = on ? '#2a1a00' : '#b8b098'; ctx.font = '9px monospace';
      ctx.fillText(`${a.at} ${a.task}`, 8, y);
      ctx.font = 'bold 10px monospace'; ctx.fillText(a.who, 8, y + 13);
      ctx.font = '9px monospace'; ctx.fillText(a.cab, 8, y + 25);
    });
  });
  const D = storySpot(0, 'Salle de réunion 008', 1.35, M0.hv, 1.55);
  dir.group.position.set(D.x, D.y, D.z);
  dir.group.rotation.y = board.group.rotation.y;
  scene.add(dir.group);
  addInteractable(board.group, () => (G.planning ? 'Relire le planning de garde' : 'Tableau : organisation de la garde'), () => planningPanel(), 2.6);
  addInteractable(dir.group, () => 'Annuaire de garde', () => showDoc(`<h3>ANNUAIRE DE GARDE</h3><div class="sub">Nuit du 2 au 3 novembre · codes des coffrets effacés</div>
    <table>${ANNUAIRE.map((a) => `<tr${G.planning && a.key ? ' style="background:#f6e27a"' : ''}><td>${a.at}</td><td>${a.task}</td><td><b>${a.who}</b></td><td>${a.cab}</td><td>code : ▒▒▒▒</td></tr>`).join('')}</table>
    ${G.planning ? '<div class="hand">Le nom du Dr William Morel est allumé.</div>' : ''}`), 2.6);
  function planningPanel() {
    return openPanel((root, close) => {
      let pick = null;
      const draw = (msg = '') => {
        const free = TASKS.filter((t) => !placedTasks.includes(t.id));
        root.innerHTML = `<h3>ORGANISATION DE LA GARDE</h3><div class="sub">${G.planning ? 'Planning complet.' : 'Choisir une étiquette, puis un créneau. Toucher un créneau rempli le vide.'}</div>
          <div class="slots">${SLOTS.map((at, i) => { const t = TASKS.find((x) => x.id === placedTasks[i]); return `<button class="slot" data-i="${i}"><b>${at}</b><span>${t ? `${t.label}<i>${t.n}</i>` : '—'}</span></button>`; }).join('')}</div>
          <div class="tags">${free.map((t) => `<button class="tag${pick === t.id ? ' cur' : ''}" data-t="${t.id}">${t.label}<i>${t.n}</i></button>`).join('')}</div>
          <ul class="rules">${RULES.map((r) => `<li>${r}</li>`).join('')}</ul>
          <div class="hand">${CONSIGNE}</div><div class="msg">${msg}</div>
          <div class="btns"><button class="quit">Fermer</button></div>`;
        root.querySelector('.quit').addEventListener('click', () => close(false));
        if (G.planning) return;
        root.querySelectorAll('.tag').forEach((b) => b.addEventListener('click', () => { pick = b.dataset.t; audio.click(null, 0.08); draw(); }));
        root.querySelectorAll('.slot').forEach((b) => b.addEventListener('click', () => {
          const i = Number(b.dataset.i);
          if (pick) { placedTasks[i] = pick; pick = null; } else placedTasks[i] = null;
          audio.click(null, 0.1);
          board.redraw();
          if (placedTasks.every(Boolean)) {
            if (placedTasks.every((t, k) => t === SOLUTION[k])) {
              G.planning = true;
              dir.redraw();
              audio.ok();
              draw('Un déclic au mur : sur l\'annuaire, un nom s\'allume.');
              const thisPanel = panelClose; // closed by hand meanwhile: the timer must not close the next panel
              setTimeout(() => { if (panelClose === thisPanel) close(true); thought('22 h, la visite… Dr William Morel. Son cabinet, le 007. Et le code : 2, 3, 6, 8.', { dur: 5 }); }, 1800);
              return;
            }
            G.errors++; audio.buzz?.();
            draw('Ça ne colle pas avec les consignes.');
            return;
          }
          draw();
        }));
      };
      draw();
    });
  }
  addCoin(storySpot(0, 'Salle de réunion 008', 0.3, -0.65).x, -FH_ROOM + 0.74, storySpot(0, 'Salle de réunion 008', 0.3, -0.65).z, 'sur la table de réunion');

  // ----- Énigme 6, Dr Morel's office: the locked box on his desk, the exit card inside.
  const C = storySpot(0, 'Cabinet Dr W. Morel 007', 0.05, 0.6, 0.74);
  // Optional lore: replayable notes on the desk beside the locked box.
  const recorder = makeDictaphone();
  recorder.position.set(C.x + C.right[0] * 0.38, C.y, C.z + C.right[1] * 0.38);
  recorder.rotation.y = C.yaw;
  scene.add(recorder);
  addInteractable(recorder, () => 'Écouter le dictaphone du Dr Morel', async () => {
    G.mode = 'busy';
    keys.clear();
    try {
      const index = await choose([...MOREL_NOTES.map((_, i) => `Note ${i + 1}`), 'Reposer le dictaphone'], { who: 'DICTAPHONE — DR MOREL' });
      if (index < MOREL_NOTES.length) {
        const line = MOREL_NOTES[index];
        await say([line.text], { who: 'DR WILLIAM MOREL', pitch: 0.9, voiceIds: [line.id], pos: recorder.position });
      }
    } finally { if (G.mode === 'busy') G.mode = 'free'; }
  }, 1.8);
  const medicineSpot = storySpot(0, 'Cabinet Dr W. Morel 007', 0.8, 0.35, 0.74);
  await addMedicine('morel', { x: medicineSpot.x, y: medicineSpot.y, z: medicineSpot.z, ry: medicineSpot.yaw });
  const coffret = makeCoffret();
  coffret.group.position.set(C.x, C.y, C.z);
  coffret.group.rotation.y = facing([-C.fwd[0], -C.fwd[1]]);
  scene.add(coffret.group);
  let coffretOpen = false;
  S.coffret = () => coffretOpen;
  addInteractable(coffret.group, () => (coffretOpen ? null : 'Coffret cadenassé'), async () => {
    const ok = await codePanel({ title: 'COFFRET', sub: 'Étiquette : « Dr W. Morel ».', check: (code) => code === STORY.coffre });
    if (!ok) { if (G.mode === 'free') thought(G.planning ? 'Les quatre premières tâches… dans l\'ordre croissant.' : 'Quatre chiffres. Où est-ce qu\'il les aurait notés ?'); return; }
    coffretOpen = true;
    audio.doorUnlock(coffret.group.getWorldPosition(new THREE.Vector3()));
    await animate(0.8, (k) => { coffret.lid.rotation.x = 1.7 * k; }, (k) => ease.outBack(k, 0.8));
  }, 1.8);
  addInteractable(coffret.card, () => (coffretOpen && !G.card ? 'Prendre la carte d\'accès' : null), async () => {
    G.mode = 'busy';
    await reach(coffret.card.getWorldPosition(new THREE.Vector3()), { grip: 'pinch' });
    audio.pickup();
    coffret.card.visible = false;
    G.card = true;
    toast('Carte d\'accès du Dr Morel', 3);
    await hands.right.to(hands.rest.right, 0.4, 'relaxed');
    if (G.mode === 'busy') G.mode = 'free';
    setTimeout(() => thought('Le portique de sortie. Au bout du hall.'), 500);
  }, 1.8);

  // ----- Bonus: the pharmacy's dispenser (1 coin = 1 pill), a second phone in the entrance hall, hidden coins.
  const R0 = storySpot(0, 'Pharmacie 009', 0, 0), R = storySpot(0, 'Pharmacie 009', 2.0, -R0.hv + 0.27);
  const disp = makeDispenser();
  disp.group.position.set(R.x, R.y, R.z);
  disp.group.rotation.y = facing(R0.fwd);
  scene.add(disp.group);
  solidBox(disp.group);
  addInteractable(disp.group, () => (G.coins > 0 ? 'Distributeur : 1 pièce = 1 cachet' : 'Distributeur de médicaments (1 pièce)'), async () => {
    const slotAt = disp.slot.getWorldPosition(new THREE.Vector3());
    const face = new THREE.Vector3(R0.fwd[0], 0, R0.fwd[1]).normalize();
    G.mode = 'busy';
    if (G.coins <= 0) {
      // A finger in the empty slot.
      await reach(slotAt, { face, grip: 'point', pitch: 0 });
      audio.click(slotAt);
      await wait(0.15);
      await restRight(0.35);
      done();
      thought('Il faut une pièce.');
      return;
    }
    await reachFor([{ hand: hands.right, wrist: () => wristFor(hands.right, slotAt, handQuat(-0.05, yawOf(face))) }], { at: slotAt, face, near: 0.25 });
    await insertCoin(slotAt, face);
    G.coins--; G.pills++;
    setTimeout(() => audio.rattle(), 700);
    toast(`Un cachet tombe dans le bac · ${ctl('kPill')} pour le prendre`, 3.5);
    await restRight(0.4);
    done();
  }, 2.0);
  await addPhone('wall_phone_accueil', new THREE.Vector3(wx(259) + WALL_T / 2, -FH_ROOM, 23.0)); // west wall of the entrance hall
  const coinAt = (f, room, u, v, h, where) => { const p = storySpot(f, room, u, v, h); addCoin(p.x, p.y, p.z, where); };
  coinAt(1, '103', 0.2, 0.1, 0, 'par terre, dans la chambre 103');
  coinAt(0, 'Cantine', -1.5, -1.6, 0.74, 'sur une table de la cantine');
  coinAt(0, 'Poste de sécurité 001', -2.9, P0.hv - SECURITY_DESK_GAP - 0.28, 0.74, 'sur un bureau du poste de sécurité');
  coinAt(0, 'WC Hommes', 0.3, 0.2, 0, 'par terre, aux toilettes');

  // ----- Evacuation plans (plans.js): one by the way out of room 104, on the north corridor wall; one in the entrance hall.
  // Taken off the wall, each gives the minimap of its floor.
  const plans = [
    // face: the way the poster looks, [x, z].
    { f: 1, flag: 'planF1', x: wx(EVAC_PLAN_F1.x), y: 1.5, z: wz(EVAC_PLAN_F1.y) + WALL_T / 2 + 0.035, width: 0.62, face: [0, 1] }, // north wall, just outside room 104
    // The east corridor's west wall, facing the stairwell and lift doors, between the two.
    { f: 0, flag: 'planF0', x: wx(399) + WALL_T / 2 + 0.035, y: -FH_ROOM + 1.45, z: wz(505), width: 0.55, face: [1, 0] },
  ].map((p) => {
    const poster = makeEvacuationPlan(p.f, [p.x, p.z], p.width);
    poster.position.set(p.x, p.y, p.z);
    poster.rotation.y = facing(p.face);
    scene.add(poster);
    return { ...p, poster };
  });
  const takePlan = async (p) => {
    G.mode = 'busy';
    const face = new THREE.Vector3(p.face[0], 0, p.face[1]), at = centerOf(p.poster);
    await reach(at.clone().add(new THREE.Vector3(0, 0, 0.18)), { grip: 'pinch', face, dist: 0.5 });
    audio.pickup();
    hands.right.grip.attach(p.poster);
    await Promise.all([
      hands.right.to(camPose(camera, 0.08, -0.16, -0.38, 0.4, 0, 0), 0.55, 'pinch'),
      tween(0.55, (k) => p.poster.scale.setScalar(1 - 0.5 * k), ease.reach),
    ]);
    await wait(0.35);
    p.poster.removeFromParent();
    G[p.flag] = true;
    toast(`Plan ${p.f ? 'de l\'étage 1' : 'du rez-de-chaussée'}, en haut à droite${isTouch() ? '' : ` · ${ctl('kMap')} pour l'agrandir`}`, 3.5);
    await restRight(0.4);
    done();
    if (p.f === 1) setTimeout(() => thought('Un plan. Au moins, je ne tournerai plus en rond.'), 500);
  };
  for (const p of plans) addInteractable(p.poster, () => (G[p.flag] ? null : 'Décrocher le plan d\'évacuation'), () => takePlan(p), 2.0, { pad: 0.02 });
  const dropPlans = () => { for (const p of plans) if (G[p.flag]) p.poster.removeFromParent(); };

  // The room's own drawer: a coin instead of the torch, now in the archives.
  const drawerCoin = world.makeCoin();
  const rd = makeDrawer(roomDrawer, drawerCoin);
  const drawerEntry = { c: drawerCoin, taken: false };
  storyCoins.push(drawerEntry);
  addInteractable(drawerCoin, () => (drawerEntry.taken || !rd.open ? null : 'Ramasser la pièce'), () => { drawerEntry.taken = true; pickUpCoin(drawerCoin, 'au fond du tiroir'); }, 1.9, { pad: 0.035, min: 0.08 });

  // Saved games (main.js saveGame / applySave): the objects' state beyond the G flags. restore() gets untrusted data.
  S.snapshot = () => ({
    roomBoxOpen: roomBox.open, roomKey: roomBox.keyTaken,
    medicine: medicine.filter((e) => e.taken).map((e) => e.id),
    coins: storyCoins.map((e) => e.taken), searched: [...searchedCoats], coffret: coffretOpen, plan: [...placedTasks], drawers: [rd.open, S.archDrawer.open],
  });
  S.restore = (d) => {
    if (!d || typeof d !== 'object') d = {};
    if (Array.isArray(d.drawers)) { rd.restore(d.drawers[0]); S.archDrawer.restore(d.drawers[1]); }
    roomBox.keyTaken = G.unlocked || d.roomKey === true;
    roomBox.open = roomBox.keyTaken || d.roomBoxOpen === true;
    roomBox.lid.rotation.x = roomBox.open ? 1.7 : 0;
    roomBox.key.visible = !roomBox.keyTaken;
    // Older saves already received all four pills in the room.
    const takenMedicine = Array.isArray(d.medicine) ? d.medicine : G.bottleTaken ? medicine.map((e) => e.id) : [];
    medicine.forEach((e) => {
      if (takenMedicine.includes(e.id)) { e.taken = true; e.bottle.visible = false; }
    });
    if (Array.isArray(d.coins)) storyCoins.forEach((e, i) => { if (d.coins[i] === true) { e.taken = true; e.c.removeFromParent(); } });
    if (Array.isArray(d.searched)) for (const i of d.searched) if (Number.isInteger(i) && rack.coats[i]) { rack.coats[i].userData.searched = true; searchedCoats.add(i); }
    if (G.blouse) rack.coats[COATS.findIndex((c) => c.pocket === 'keys')].visible = false;
    if (G.lockerOpen) { locker.led.material.color.setRGB(0.2, 3, 0.4); locker.open.rotation.y = 1.8; }
    if (G.meetingKey) locker.key.visible = false;
    const ids = new Set(TASKS.map((t) => t.id));
    if (G.planning) SOLUTION.forEach((t, i) => { placedTasks[i] = t; });
    else if (Array.isArray(d.plan)) d.plan.slice(0, 5).forEach((t, i) => { placedTasks[i] = ids.has(t) && !placedTasks.includes(t) ? t : null; });
    board.redraw(); dir.redraw();
    if (d.coffret === true || G.card) { coffretOpen = true; coffret.lid.rotation.x = 1.7; }
    if (G.card) coffret.card.visible = false;
    dropPlans();
  };

  // Developer menu: grant one access item without completing the previous puzzles.
  S.giveKey = (name) => {
    if (name === 'giveRoomKey') {
      roomBox.open = roomBox.keyTaken = true;
      roomBox.lid.rotation.x = 1.7;
      roomBox.key.visible = false;
    } else if (name === 'giveKeys') G.keys = true;
    else if (name === 'giveMeetingKey') { G.meetingKey = true; locker.key.visible = false; }
    else if (name === 'giveCard') { G.card = true; coffret.card.visible = false; }
  };

  // Developer menu: jump to an énigme with everything before it done.
  S.cheat = (n) => {
    if (n >= 2) { if (!G.unlocked) unlockRoom(); }
    if (n >= 3) { if (!G.torch) { hands.left.grip.add(torch); torch.position.set(0, 0, -0.02); torch.rotation.set(0, 0, 0); G.torch = true; G.torchOn = true; } G.psyKnown = true; }
    if (n >= 4) { G.keys = true; if (!G.blouse) wearCoat(rack.coats[2], { instant: true }); }
    if (n >= 5) { if (!G.lockerOpen) openLocker(); G.meetingKey = true; locker.key.visible = false; }
    if (n >= 6) { G.planning = true; SOLUTION.forEach((t, i) => { placedTasks[i] = t; }); board.redraw(); dir.redraw(); }
    if (n >= 7) { G.card = true; coffret.card.visible = false; coffretOpen = true; coffret.lid.rotation.x = 1.7; }
    if (n >= 2) G.planF1 = true;
    if (n >= 4) G.planF0 = true;
    dropPlans();
  };
  return S;
}

// ---------- Start ----------
async function start() {
  loading.step('Chargement de la chambre…', 0);
  // The room: no computer any more (it is in the archives, énigme 2); the table is the patient's desk.
  const [bed, pills] = await Promise.all([
    place('medical_bed', { x: 1.0, z: 0, ry: Math.PI / 2, back: -RZ_BACK + 0.08 }),
    place('pills', { x: 0.5, z: -0.14, ry: -0.5, y: TABLE.h }),
    place('table', { x: 0, z: 0 }),
    place('chair', { x: -0.22, z: 0.74, ry: Math.PI + 0.25 }),
    addPhone('wall_phone', new THREE.Vector3(-RX, 0, PHONE_Z)),
    setupHud(),
    hands.load(),
    loader.loadAsync('./assets/player_body.glb').then((gltf) => {
      // Cast both faces: back-face-only shadows leak through feet whose soles meet the floor.
      const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, shadowSide: THREE.DoubleSide });
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.material = shadowOnly;
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        o.layers.set(BODY_SHADOW_LAYER);
      });
      gltf.scene.rotation.y = Math.PI; // modelled looking along +Z, the camera looks along -Z
      playerBody.add(gltf.scene);
      body.add(playerBody, gltf.scene);
    }),
    loader.loadAsync('./assets/player_reflection.glb').then((gltf) => {
      // Lit by itself: the room's lamp is behind the player when they face a mirror, and the shadow body stands in the same spot.
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false;
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0xffffff);
        o.material.emissiveMap = o.material.map;
        o.material.emissiveIntensity = 0.35;
      });
      gltf.scene.rotation.y = Math.PI;
      playerMirrorBody.add(gltf.scene);
      body.add(playerMirrorBody, gltf.scene, { lagging: true });
    }).catch(() => {}),
    world.loadDecor(loader),
    loadModel(loader, 'pendant_lamp').then((m) => {
      makeEmissive(m, 'lamp_bulb', bulbMat);
      scene.add(m);
      m.position.copy(lamp.position);
      lamp.add(m.getObjectByName('lamp_swing')); // the ceiling rose stays put, the rest swings
    }),
    loadModel(loader, 'red_light').then((m) => {
      makeEmissive(m, 'red_glass', new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.35, 0.25) }));
      m.position.set(-RX, 1.72, PHONE_Z);
      m.rotation.y = Math.PI / 2;
      scene.add(m);
    }),
  ]);
  updatePlayerOutfit = createPlayerOutfit([playerMirrorBody, hands.right.root, hands.left.root]);
  updatePlayerOutfit(G.blouse);
  const bb = new THREE.Box3().setFromObject(bed);
  colliders.push([bb.min.x, bb.max.x, bb.min.z, bb.max.z]);

  loading.step('Préparation de la chambre…', 0.86);
  // Room props: furniture, fixtures, and the ones that come with the decay (they change out of view, like the walls).
  props = await loadProps(scene, loader, { bed, doorPivot: world.doorPivot });
  world.addDecayTiles(props.tiles);
  colliders.push(...props.colliders);
  // The room in the hospital: walls at the faces of its modules, the door opening shut until the door opens, furniture.
  const doorZ0 = DOOR.z - DOOR.w / 2, doorZ1 = DOOR.z + DOOR.w / 2;
  hosp.addCollider(-RX - 0.2, -RZ_BACK - 0.2, -RX, RZ_FRONT + 0.2, 0, RH);
  hosp.addCollider(-RX - 0.2, -RZ_BACK - 0.2, RX + 0.2, -RZ_BACK, 0, RH);
  hosp.addCollider(-RX - 0.2, RZ_FRONT, RX + 0.2, RZ_FRONT + 0.2, 0, RH);
  hosp.addCollider(RX - 0.02, -RZ_BACK - 0.2, RX + 0.2, doorZ0, 0, RH);
  hosp.addCollider(RX - 0.02, doorZ1, RX + 0.2, RZ_FRONT + 0.2, 0, RH);
  hosp.addCollider(RX - 0.02, doorZ0, RX + 0.36, doorZ1, 0, DOOR.h, { get active() { return !G.doorOpen; } });
  for (const [a, b, c, d] of colliders) hosp.addCollider(a, c, b, d, 0, 2, { furniture: true });
  await Promise.all([hosp.dress(loader), finale.load(loader), windowView.load(loader)]);
  securityMonitors = await createSecurityMonitors(scene, renderer, loader, hosp,
    [...hosp.H.cameraHeads, props.placed.camera_corner.getObjectByName('camera_head')],
    [hands.right.root, hands.left.root, playerBody], playerMirrorBody);
  mirrors.hide(hands.right.root, hands.left.root);
  mirrors.add(props.placed.mirror_steel);
  for (const p of hosp.H.mirrorSpots ?? []) mirrors.add(hosp.root, new THREE.Vector3(p.x, p.f * FH + p.y, p.z), p.yaw);
  // The flashlight and the swallowed pill: Blockbench models in place of the code's shapes.
  const torchModel = await loadModel(loader, 'props/torch');
  torch.userData.shapes.forEach((m) => torch.remove(m));
  torchModel.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    if (o.name === 'torch_lens') { o.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.15, 1.0) }); torch.userData.lens = o; }
  });
  torch.add(torchModel);
  skinMesh(pillMesh, await modelAsset(loader, 'props/pill_capsule'), true);
  world.addDecayTiles(hosp.tiles);
  // The building: swing doors are pushed with the palm, lift buttons pressed with a finger.
  for (const it of hosp.interactables) addInteractable(it.obj, it.label, () => useBuilding(it), it.range, it.door ? null : { pad: 0.02, min: 0.04 });
  occluders.push(...hosp.occluders);

  // Coin under the pillow (hidden until found).
  const pillow = bed.getObjectByName('pillow');
  const pillowCoin = world.makeCoin();
  const pb = new THREE.Box3().setFromObject(pillow);
  pillowCoin.position.set((pb.min.x + pb.max.x) / 2, pb.min.y + 0.004, pb.max.z + 0.04);
  pillowCoin.visible = false;
  scene.add(pillowCoin);

  // Interactables.
  story = await setupStory({ roomDrawer: assets.table });
  npcs = await createNPCs(scene, loader, hosp, { blouse: G.blouse });
  // The others, heard around him (ambiance.js): loudspeakers, the lift, Perrin's round, the guard, the patients.
  ambiance = createAmbiance({
    G, player, hosp, npcs: () => npcs, say: overheard, thought, wait: playWait, quiet: bubblesQuiet, loss, inRoom,
    door: new THREE.Vector3(RX + 0.8, 1.5, DOOR.z), ear: () => camera.position, footsteps: (pos) => audio.footsteps(pos),
  });
  treatment = await createTreatment(scene, loader, hosp);
  for (const actor of npcs.actors) {
    if (actor.wandering) continue;
    occluders.push(actor.root);
    addInteractable(actor.root, () => `Parler · ${actor.name.toLowerCase()}`, async () => {
      if (!actor.root.visible) return;
      if (actor.id === 'nurse' && !G.metNurse) {
        if (ending) return;
        G.downstairs = true;
        await groundFloorArrival();
        return;
      }
      G.mode = 'busy';
      keys.clear();
      const patient = actor.id.startsWith('patient_');
      if (!patient && !G.blouse) { await caughtEnding(); return; }
      await say([patient ? 'Je voudrais seulement dormir…' : actor.id === 'nurse' ? 'Bonne nuit, docteur.' : 'La garde est calme. Bonne nuit, docteur.'], { who: actor.name, style: 'phone', pitch: actor.pitch });
      if (G.mode === 'busy') G.mode = 'free';
    }, 2.2);
  }
  // What hides what is behind it (from the aim and the outline): furniture, room props, walls.
  occluders.push(assets.chair, assets.table, bed, ...world.tiles.map((x) => x.mesh));
  occluders.push(...Object.values(props.placed), ...props.tiles.flatMap((t) => t.roots ?? []));
  addInteractable(pills, () => (G.bottleTaken ? null : 'Prendre le flacon (2 cachets)'), () => takeBottle(), 2.0, { pad: 0.03 });
  // The pillow: lifted by the left hand, the coin under it taken by the right one.
  addInteractable(pillow, () => (G.pillowCoin ? null : 'Fouiller sous l\'oreiller'), async () => {
    G.mode = 'busy';
    G.pillowCoin = true;
    const pc0 = centerOf(pillow), home = pillow.position.clone(), homeQ = pillow.quaternion.clone();
    const edge = pc0.clone(); edge.z = pb.max.z - 0.03; edge.y = pb.max.y;
    const yawAt = (spot) => Math.atan2(spot.x - edge.x, spot.z - edge.z);
    const coinAt = pillowCoin.getWorldPosition(new THREE.Vector3());
    // Where the left hand lifts the pillow and the right one reaches under it.
    await reachFor([
      { hand: hands.left, wrist: (spot) => wristFor(hands.left, edge.clone().add(new THREE.Vector3(0, 0.08, 0)), handQuat(-0.9, yawAt(spot))) },
      { hand: hands.left, wrist: (spot) => wristFor(hands.left, edge, handQuat(-0.9, yawAt(spot))) },
      { hand: hands.right, wrist: (spot) => wristFor(hands.right, coinAt, handQuat(-0.75, yawAt(spot))) },
    ], { at: edge, side: 0 });
    const ry = yawAt(camera.position);
    await hands.left.to(handOn(hands.left, edge, -0.9, ry, 0, { lift: 0.06 }), 0.4, 'open');
    await hands.left.to(handOn(hands.left, edge, -0.9, ry, 0), 0.15, 'hold');
    // Lift it (the left hand goes up with it).
    const par = pillow.parent, o = par.worldToLocal(pc0.clone()), up = par.worldToLocal(pc0.clone().add(new THREE.Vector3(0, 0.08, 0))).sub(o);
    audio.noise(0.4, { f: 500, q: 0.6, gain: 0.05 });
    hands.left.to(handOn(hands.left, edge.clone().add(new THREE.Vector3(0, 0.08, 0)), -0.9, ry, 0), 0.45, 'hold');
    await tween(0.45, (k) => { pillow.position.copy(home).addScaledVector(up, k); });
    pillowCoin.visible = true; audio.pickup('coin');
    await pickUpCoin(pillowCoin, 'sous l\'oreiller', { stay: true });
    G.mode = 'busy';
    hands.left.to(handOn(hands.left, edge, -0.9, ry, 0), 0.35, 'hold');
    await tween(0.35, (k) => { pillow.position.copy(home).addScaledVector(up, 1 - k); }, ease.inOutSine);
    pillow.quaternion.copy(homeQ);
    await hands.left.to(hands.rest.left, 0.4, 'relaxed');
    done();
  }, 2.0);
  addInteractable(world.sillCoin, () => (G.sillCoin ? null : 'Ramasser la pièce'), () => { G.sillCoin = true; pickUpCoin(world.sillCoin, 'sur le rebord de la fenêtre'); }, 1.9, { pad: 0.035, min: 0.08 });
  addInteractable(world.paper, () => 'Lire la fiche sur le bureau', () => readSheet(world.paper, 'fiche'), 1.9, { pad: 0.02 });
  addInteractable(world.photo, () => 'Regarder la photo', lookPhoto, 2.4, { pad: 0.04 });
  addInteractable(world.doorPivot, () => (G.doorOpen ? null : G.unlocked ? 'Ouvrir la porte' : 'Porte de la chambre (fermée à clé)'), useDoor, 2.0);
  const kit = { G, audio, voices, thought, heard, lea: LEA, reach, inspect, lookAt, tween, hands, handOn, yawOf, centerOf, camera, done, rest: restRight, pickUpCoin, wait };
  for (const i of props.interactions(kit)) addInteractable(i.obj, i.label, i.act, i.range, i.hit);
  focus.markSolids();

  applySettings();
  resize();
  try { const r = await fetch('ui/ui_spec.json'); if (r.ok) menus.applySkin(await r.json()); } catch { /* CSS fallback */ }
  let auto = null;
  try { auto = sessionStorage.getItem('clausus-autostart'); sessionStorage.removeItem('clausus-autostart'); } catch { /* ignore */ }
  const begin = () => {
    if (params.get('jouer') !== null) { startGame(); }
    else if (auto) { menus.show('wake'); }
    else menus.show(firstMenu());
  };
  menuReady = true;
  if (shell.isCovered()) pendingBegin = begin; else begin();
  updateCamera(0);
  // Compile the shaders now rather than on the first frames (a long freeze, the first time on a given GPU).
  loading.step('Préparation de l\'hôpital…', 0.93);
  try { await renderer.compileAsync(scene, camera); } catch { /* compiled on the first frame instead */ }
  window.__clausus = {
    G, player, camera, assets, world, decayLevels: () => world.tiles.map((x) => x.level), computers, phones, story, hands, settings, audio, figure,
    setSanity: (v) => { G.sanity = v; }, menus, cfg,
    begin: startGame,
    go: (x, z, yaw, pitch = 0, y = 0) => { player.pos.set(x, 0, z); player.y = y; player.vy = 0; player.yaw = yaw; player.pitch = pitch; }, hosp,
    aim: (obj) => { const p = new THREE.Vector3(); (typeof obj === 'string' ? scene.getObjectByName(obj) : obj).getWorldPosition(p); const d = p.sub(new THREE.Vector3(player.pos.x, EYE, player.pos.z)); player.yaw = Math.atan2(-d.x, -d.z); player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); },
    torch, props, interactables: focus.list, body, npcs,
    say, thought, choose, codePanel, useComputer, usePhone, useDoor, unlockRoom, stageOf: () => stageOf(G), panelClose: (r) => panelClose?.(r), showDoc, closeDoc, takeBottle, takePill, hallucinate, showFigure, leaveComputer, interact,
    focused: () => focused?.text ?? null,
    pickAt: (x, y) => pickAt(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1))?.text ?? null, tapAt,
    giveCoin: () => { G.coins++; },
    walkOut, finale, windowView, endGame,
    // For automated checks of the animations (reaching, held objects): internals, read-only use.
    _dbg: { THREE, reachPose, canReach, reachView, wristFor, handQuat, free, inSight, standSpot, boxOf, centerOf, camPose, inspect, reach, raiseView, pickUpCoin },
  };
  frame();
  loading.done();
  window.__ready = true;
}

start().catch((err) => {
  loading.fail();
  const box = $('error');
  box.style.display = 'block';
  box.textContent = `Impossible de démarrer la scène.\n\n${err.stack || err}\n\nLance-la avec : node packages/game/serve.mjs`;
  console.error(err);
});
