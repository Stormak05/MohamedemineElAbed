import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// What the player can use: the object under the crosshair (or a finger), the invisible hit boxes that make small
// things easy to aim at, and the outline drawn around the object in focus.

// Layers used only by the outline mask (the main camera only sees layer 0, so they change nothing on screen).
const L_SOLID = 5, L_FOCUS = 6;
const HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });

const isHitBox = (o) => o.userData.hitBox === true;
// The meshes that draw an object (not its hit box).
function drawnMeshes(root, fn) {
  root.traverse((o) => { if (o.isMesh && !isHitBox(o)) fn(o); });
}
// World-space box of what an object draws (its hit box left out).
export function boxOf(root, box = new THREE.Box3()) {
  box.makeEmpty();
  root.updateWorldMatrix(true, true);
  const b = new THREE.Box3();
  drawnMeshes(root, (o) => {
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  return box;
}
export const centerOf = (root) => boxOf(root).getCenter(new THREE.Vector3());

// Visible in the scene: neither it nor a parent hidden, and still attached to the scene.
function shown(o) {
  for (let p = o; p; p = p.parent) {
    if (!p.visible && !isHitBox(p)) return false;
    if (p.isScene) return true;
  }
  return false;
}

export function createFocus(camera) {
  const list = [];
  const owners = new Map(); // object → interactable
  const occluders = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 2.8;

  // A box around the object, in its own frame, at least `min` metres on each side and `pad` metres larger than the
  // object. It moves with the object (drawers, coins in hand…).
  function addHitBox(obj, { pad = 0.02, min = 0 } = {}) {
    obj.updateWorldMatrix(true, true);
    const inv = obj.matrixWorld.clone().invert(), m = new THREE.Matrix4();
    const box = new THREE.Box3(), b = new THREE.Box3();
    drawnMeshes(obj, (o) => {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.union(b.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)));
    });
    if (box.isEmpty()) return;
    const scale = obj.getWorldScale(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    for (const k of ['x', 'y', 'z']) size[k] = Math.max(size[k] + (2 * pad) / scale[k], min / scale[k]);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), HIT_MAT);
    hit.position.copy(c);
    hit.visible = false;
    hit.userData.hitBox = true;
    hit.castShadow = hit.receiveShadow = false;
    obj.add(hit);
  }

  // hit: null (the object's own meshes) or { pad, min } for an enlarged box (see addHitBox).
  function add(obj, label, act, range = 1.8, hit = null) {
    if (!obj) return;
    const it = { obj, label, act, range };
    list.push(it);
    owners.set(obj, it);
    if (hit) addHitBox(obj, hit);
    return it;
  }
  const ownerOf = (o) => { for (; o; o = o.parent) { const it = owners.get(o); if (it) return it; } return null; };

  // The interactable under a screen point (NDC), or null. Anything else in the way (furniture, a wall, a table top)
  // stops the ray. A hit on a real mesh wins over a hit box met before it: a large box does not hide the small thing
  // lying next to it.
  const targets = [];
  function pick(ndc) {
    raycaster.setFromCamera(ndc, camera);
    targets.length = 0;
    for (const it of list) if (it.obj.visible) targets.push(it.obj);
    for (const o of occluders) targets.push(o);
    const hits = raycaster.intersectObjects(targets, true);
    let byBox = null, last = null;
    for (const h of hits) {
      if (h.object === last || !shown(h.object)) continue;
      last = h.object;
      const it = ownerOf(h.object);
      if (!it) break; // something solid in the way
      const box = isHitBox(h.object);
      if (h.distance > it.range) { if (box) continue; break; }
      const text = it.label();
      if (!text) {
        if (box) continue;
        break; // An inactive object still hides what is behind its real meshes.
      }
      if (!box) return { ...it, text };
      byBox ??= { ...it, text };
    }
    return byBox;
  }

  // Meshes that hide the outline of what is behind them: the same ones that stop the ray.
  function markSolids() {
    for (const root of [...occluders, ...list.map((i) => i.obj)]) drawnMeshes(root, (o) => { if (!o.material?.transparent) o.layers.enable(L_SOLID); });
  }

  return { list, occluders, add, addHitBox, pick, markSolids };
}

// Outline around the object in focus, with a faint glow over it. Drawn in the scene's (linear, HDR) colours, before
// the bloom and the retro grading, so it gets dithered and pixelated like the rest.
export class FocusOutlinePass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.maskCam = new THREE.PerspectiveCamera();
    this.mask = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
    this.solid = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
    this.lit = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false, depthFunc: THREE.LessEqualDepth, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.target = null;
    this.enabled = false;
    this.color = new THREE.Color(1.0, 0.82, 0.52);
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, tMask: { value: this.mask.texture }, uTexel: { value: new THREE.Vector2() },
        uColor: { value: this.color }, uEdge: { value: 1 }, uFill: { value: 0.1 },
      },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse, tMask; uniform vec2 uTexel; uniform vec3 uColor; uniform float uEdge, uFill;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float m = texture2D(tMask, vUv).r, n = 0.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) n = max(n, texture2D(tMask, vUv + vec2(x, y) * uTexel).r);
          float edge = clamp(n - m, 0.0, 1.0);
          c.rgb = c.rgb * (1.0 + uFill * m) + uColor * (uEdge * edge + uFill * 0.15 * m);
          gl_FragColor = c;
        }`,
      depthTest: false, depthWrite: false,
    }));
  }

  setTarget(obj) {
    // An invisible aiming volume (the hospital's doors): outline what it stands for, its parent.
    if (obj?.isMesh && obj.material?.visible === false && obj.parent) obj = obj.parent;
    if (obj === this.target) return;
    if (this.target) this.target.traverse((o) => o.layers.disable(L_FOCUS));
    this.target = obj;
    if (obj) obj.traverse((o) => { if (o.isMesh && !isHitBox(o)) o.layers.enable(L_FOCUS); });
    this.enabled = !!obj;
  }

  setSize(w, h) {
    this.mask.setSize(w, h);
    this.quad.material.uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  render(renderer, writeBuffer, readBuffer) {
    // Mask: the solid things in black (they hide what is behind them), then the focused object in white.
    const cam = this.maskCam, scene = this.scene;
    cam.copy(this.camera, false);
    const bg = scene.background, over = scene.overrideMaterial, clear = renderer.getClearColor(this.clearColor ??= new THREE.Color()), alpha = renderer.getClearAlpha();
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    scene.background = null;
    renderer.setRenderTarget(this.mask);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    cam.layers.set(L_SOLID);
    scene.overrideMaterial = this.solid;
    renderer.render(scene, cam);
    cam.layers.set(L_FOCUS);
    scene.overrideMaterial = this.lit;
    renderer.render(scene, cam);
    scene.overrideMaterial = over;
    scene.background = bg;
    renderer.setClearColor(clear, alpha);
    renderer.autoClear = autoClear;

    const u = this.quad.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 1000 * 3.2);
    u.uEdge.value = 1.1 * pulse;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() { this.mask.dispose(); this.quad.dispose(); }
}
