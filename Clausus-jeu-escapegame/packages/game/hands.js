import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ease, arc, vary, noise, drift } from './motion.js';

// First-person arms from assets/arm.glb (right arm; the left one is a mirrored copy without the wristband).
// Bones: upper_arm (shoulder) > forearm (elbow, 0.30 m) > hand (wrist, 0.26 m) > <finger>_1/_2/_3, thumb_1/_2/_3.
// A pose targets the WRIST (position + orientation, fingers along -z, palm down); a 2-bone IK places the elbow.
const UPPER = 0.3, FORE = 0.26;
export const ARM_REACH = UPPER + FORE; // shoulder to wrist, arm straight
const REACH = 0.22; // from the wrist to the fingertips, and a little more for what the hand holds (the torch)
const FINGERS = ['index', 'middle', 'ring', 'pinky'];

// Finger presets: [index, middle, ring, pinky, thumb], 0 = straight, 1 = fully curled.
const GRIP = {
  open: [0.05, 0.08, 0.1, 0.12, 0.05],
  relaxed: [0.25, 0.3, 0.35, 0.4, 0.2],
  fist: [1, 1, 1, 1, 0.8],
  hold: [0.85, 0.9, 0.95, 1, 0.75],
  pinch: [0.55, 0.85, 0.95, 1, 0.65],
  point: [0, 0.95, 1, 1, 0.7],
  type: [0.35, 0.35, 0.4, 0.45, 0.25],
};
const FINGER_RATE = [14, 12, 10.5, 9, 13]; // how fast each finger follows its grip: index, middle, ring, pinky, thumb
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const asGrip = (g) => (Array.isArray(g) ? g : typeof g === 'number' ? [g, g, g, g, g * 0.8] : GRIP[g] ?? GRIP.relaxed);

// Pose helpers: a pose is { pos: Vector3, quat: Quaternion } in world space.
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
// A camera pose is marked `cam`: it follows the view, so it is the one a wall can get in the way of (Arm.update).
export function camPose(camera, x, y, z, rx = 0, ry = 0, rz = 0) {
  const fn = () => ({
    pos: camera.localToWorld(new THREE.Vector3(x, y, z)),
    quat: camera.quaternion.clone().multiply(_q.setFromEuler(_e.set(rx, ry, rz))),
  });
  fn.cam = true;
  return fn;
}
export function worldPose(pos, rx = 0, ry = 0, rz = 0) {
  const p = pos.clone(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
  return () => ({ pos: p, quat: q });
}

function mirrorX(root) {
  root.traverse((o) => {
    o.position.x *= -1;
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.scale(-1, 1, 1);
    const idx = g.index;
    if (idx) for (let i = 0; i < idx.count; i += 3) { const b = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, b); }
    o.geometry = g;
  });
}

class Arm {
  constructor(scene, camera, model, side) {
    this.side = side; // 1 = right, -1 = left
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.add(model);
    scene.add(this.root);
    const get = (n) => model.getObjectByName(n);
    this.upper = get('upper_arm'); this.fore = get('forearm'); this.hand = get('hand');
    this.fingers = FINGERS.map((f) => [get(`${f}_1`), get(`${f}_2`), get(`${f}_3`)]);
    this.thumb = [get('thumb_1'), get('thumb_2'), get('thumb_3')];
    // Held items attach here (between thumb and index, under the palm).
    this.grip = new THREE.Group();
    this.grip.position.set(-0.005 * side, -0.035, -0.07);
    this.hand.add(this.grip);
    // In the view's frame, a little behind the eyes so its cut end never shows; the reaching code (main.js) uses it too.
    this.shoulder = new THREE.Vector3(0.17 * side, -0.26, 0.06);
    this.pole = new THREE.Vector3(0.7 * side, -1, 0.25);

    this.wrist = new THREE.Vector3(); this.wristQ = new THREE.Quaternion();
    this.from = null; this.fn = null; this.t0 = 0; this.dur = 0; this.resolve = null;
    this.curl = asGrip('relaxed').slice(); this.curlTarget = this.curl.slice();
    this.tap = [0, 0, 0, 0, 0];
    this.tremor = 0;
    this.shake = 0; // extra shaking asked by an animation (a rattled bottle…)
    this.clearance = null; // (a, b) => 0..1, how far the segment is clear of the walls (Hands.clearance)
    this.camW = 0; // 0..1, how much the target follows the view (eases across a tween)
    this.pull = 0; // metres the hand is drawn back from a wall
    this.seed = Math.random() * 100; // its own idle drift, not the other hand's
    this.bend = new THREE.Vector3(); // which way the current move bulges (its arc)
  }

  set curlTarget(v) { this._ct = asGrip(v).slice(); }
  get curlTarget() { return this._ct; }

  // Tween the wrist from its current pose to a (possibly moving) target pose, then keep following it.
  // Like a real gesture: never twice the same length, along an arc, the wrist turning ahead of the arm.
  to(fn, dur = 0.5, grip = null) {
    this.from = { pos: this.wrist.clone(), quat: this.wristQ.clone() };
    this.fn = fn; this.t0 = performance.now() / 1000; this.dur = Math.max(0.04, vary(dur, 0.07));
    // The arc: mostly upwards, a little outwards (away from the body's middle), more for a longer move.
    this.bend.set(1, 0, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(0.35 * this.side * Math.random()).add(_up).normalize();
    if (grip !== null) this.curlTarget = grip;
    this.resolve?.();
    return new Promise((r) => { this.resolve = r; });
  }
  snap(fn) { this.fn = fn; this.from = null; const p = fn(); this.wrist.copy(p.pos); this.wristQ.copy(p.quat); }

  update(dt, t) {
    if (!this.fn) return;
    const target = this.fn();
    const now = performance.now() / 1000;
    if (this.from) {
      const k = Math.min(1, (now - this.t0) / this.dur), e = ease.reach(k);
      this.wrist.lerpVectors(this.from.pos, target.pos, e);
      // Bent into an arc: straight lines are what machines draw. Short presses barely bulge.
      const span = this.from.pos.distanceTo(target.pos);
      if (span > 0.01) {
        const dir = _v.subVectors(target.pos, this.from.pos).divideScalar(span);
        const off = _v2.copy(this.bend).addScaledVector(dir, -this.bend.dot(dir));
        this.wrist.addScaledVector(off, Math.min(0.055, span * 0.16) * arc(k));
      }
      // The wrist turns ahead of the arm: it is ready before the hand gets there.
      this.wristQ.slerpQuaternions(this.from.quat, target.quat, ease.reach(Math.min(1, k * 1.12)));
      if (k >= 1) { this.from = null; this.resolve?.(); this.resolve = null; }
    } else { this.wrist.copy(target.pos); this.wristQ.copy(target.quat); }

    // A hand held up in the air is never still: breathing, small drifts. Not on things it rests on (keys, a lever).
    const W = this.wrist.clone(), sd = this.seed;
    if (this.camW > 0.01) {
      W.x += drift(t * 0.31, sd) * 0.004 * this.camW;
      W.y += (drift(t * 0.27, sd + 1) * 0.004 + Math.sin(t * 1.45 + sd) * 0.0025) * this.camW;
      W.z += drift(t * 0.23, sd + 2) * 0.003 * this.camW;
    }
    // Shaky hands when the mind goes: an irregular tremor, not three sines.
    if (this.tremor > 0) W.add(_v.set(noise(t * 9 + sd, 1), noise(t * 10.5 + sd, 2), noise(t * 8.2 + sd, 3)).multiplyScalar(0.003 * this.tremor));

    // Against a wall: a hand that follows the view (at rest, holding the torch, looking at something) would go
    // through it. Draw it back towards the eye, and down out of the way, by as much as the fingertips (and what they
    // hold) would sink in. Poses on things in the world (the phone, the keyboard) are left alone.
    const cam = this.camera;
    this.camW += ((this.fn.cam ? 1 : 0) - this.camW) * Math.min(1, dt * 6);
    let want = 0;
    if (this.clearance && this.camW > 0.01) {
      const eye = cam.getWorldPosition(new THREE.Vector3());
      const tip = W.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(this.wristQ), REACH);
      const len = tip.distanceTo(eye);
      if (len > 1e-4) want = (1 - this.clearance(eye, tip)) * len;
      this.pull = want > this.pull ? want : this.pull + (want - this.pull) * Math.min(1, dt * 8); // in at once, out gently
      const back = eye.sub(tip).normalize();
      W.addScaledVector(back, this.pull * this.camW);
      W.y -= this.pull * this.camW * 0.6;
    } else this.pull = 0;

    // 2-bone IK: shoulder S, elbow E, wrist W.
    const S = cam.localToWorld(this.shoulder.clone());
    this.root.position.copy(S);
    const toW = W.clone().sub(S);
    const d = THREE.MathUtils.clamp(toW.length(), 0.08, UPPER + FORE - 0.002);
    const u = toW.normalize();
    const pole = this.pole.clone().applyQuaternion(cam.quaternion);
    pole.addScaledVector(u, -pole.dot(u)).normalize();
    const cosA = THREE.MathUtils.clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const E = S.clone().addScaledVector(u, UPPER * cosA).addScaledVector(pole, UPPER * sinA);
    const Wr = S.clone().addScaledVector(u, d);

    // Keep the arm in its elbow plane. Using the palm normal as lookAt up
    // makes the forearm flip when that normal crosses the forearm direction
    // (palm-up inspections and low reaches such as the pillow). Wrist rotation
    // belongs to the hand; it must not reverse the elbow frame.
    const bendUp = pole.clone().negate();
    const look = (from, to, up) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(from, to, up));
    const qUpper = look(S, E, bendUp);
    const qFore = look(E, Wr, bendUp);
    this.upper.quaternion.copy(qUpper);
    this.fore.quaternion.copy(qUpper.clone().invert().multiply(qFore));
    this.hand.quaternion.copy(qFore.clone().invert().multiply(this.wristQ));

    // Fingers: ease towards the grip one after the other (the index leads, the little finger follows), add typing
    // taps, idle drift and tremor.
    for (let i = 0; i < 5; i++) {
      this.curl[i] += (this._ct[i] - this.curl[i]) * Math.min(1, dt * FINGER_RATE[i]);
      this.tap[i] = Math.max(0, this.tap[i] - dt * 7);
    }
    this.fingers.forEach((bones, i) => {
      const idle = drift(t * 0.45 + i * 0.37, sd + 5) * 0.05 + (this.tremor ? noise(t * 11 + i * 3.1, sd + i) * 0.07 * this.tremor : 0);
      const c = Math.max(0, this.curl[i] + idle);
      bones[0].rotation.x = -c * 1.05 + this.tap[i] * -0.55;
      bones[1].rotation.x = -c * 1.35 + this.tap[i] * 0.25;
      bones[2].rotation.x = -c * 0.9;
      bones[0].rotation.y = (i - 1.5) * 0.04 * (1 - c) * this.side;
    });
    const ct = this.curl[4] + this.tap[4] * 0.3;
    this.thumb[0].rotation.set(-ct * 0.35, -ct * 0.55 * this.side, -ct * 0.25 * this.side);
    this.thumb[1].rotation.x = -ct * 0.6;
    this.thumb[2].rotation.x = -ct * 0.7;
  }
}

export class Hands {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.rest = {
      right: camPose(camera, 0.2, -0.78, -0.02, -1.2, 0, 0),
      left: camPose(camera, -0.2, -0.78, -0.02, -1.2, 0, 0),
    };
    this.ready = false;
    this.tremor = 0;
    this.clearance = null; // (a, b) => 0..1: keeps the hands out of the walls (main.js gives the hospital's)
  }

  async load(url = './assets/arm.glb') {
    const gltf = await new GLTFLoader().loadAsync(url);
    const prep = (root) => root.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material;
      if (src.map) { src.map.magFilter = src.map.minFilter = THREE.NearestFilter; src.map.generateMipmaps = false; src.map.needsUpdate = true; }
      o.material = new THREE.MeshLambertMaterial({ map: src.map, color: src.color, emissive: new THREE.Color(0.09, 0.08, 0.07), emissiveMap: src.map });
      o.castShadow = false; o.receiveShadow = true; // the shadow comes from player_body.glb
      o.frustumCulled = false;
    });
    const rightModel = gltf.scene;
    const leftModel = rightModel.clone(true);
    prep(rightModel);
    mirrorX(leftModel);
    prep(leftModel);
    // Only the right arm wears the patient wristband.
    leftModel.getObjectByName('wristband').visible = false;
    this.right = new Arm(this.scene, this.camera, rightModel, 1);
    this.left = new Arm(this.scene, this.camera, leftModel, -1);
    this.right.snap(this.rest.right);
    this.left.snap(this.rest.left);
    this.ready = true;
  }

  restBoth(dur = 0.5) { return Promise.all([this.right.to(this.rest.right, dur, 'relaxed'), this.left.to(this.rest.left, dur, 'relaxed')]); }
  update(dt, t) {
    if (!this.ready) return;
    this.right.clearance = this.left.clearance = this.clearance;
    this.right.tremor = this.tremor + this.right.shake; this.left.tremor = this.tremor + this.left.shake;
    this.right.update(dt, t); this.left.update(dt, t);
  }
}

export const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
