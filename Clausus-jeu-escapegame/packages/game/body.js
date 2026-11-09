import * as THREE from 'three';

// Poses the player's bodies every frame from what the first-person view does: walking (legs and arms swing with the
// stride, forwards or backwards), crouching when the eye drops, sitting at the computer, lying on the floor after the
// collapse, the head following the view and the arms reaching for the first-person wrists when the hands are busy.
// One pose, applied to each body with its own limb lengths:
//  - player_body.glb, the deformed body that only casts the player's shadow;
//  - player_reflection.glb, the normal body that only the mirrors show (mirrors.js). When the mind goes, the reflection
//    plays the pose of a moment ago, and past 70 % its head keeps staring out of the mirror.
// Both models look along +Z (turned round in main.js): their x and z rotations are mirrored here.
export const BODY_SHADOW_LAYER = 4; // the shadow-only body: the lights see it, the torch's shadow map leaves it out

const NODES = ['hips', 'torso', 'head', 'leg_r', 'shin_r', 'foot_r', 'leg_l', 'shin_l', 'foot_l', 'arm_r', 'forearm_r', 'arm_l', 'forearm_l'];
const STAND_EYE = 1.6;
const HAND = 0.17; // the forearm meshes run on through the hand: the wrist is this far before their end
const HISTORY = 96; // frames of pose kept for the lagging reflection (~1.6 s)

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerp = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), UP = new THREE.Vector3(0, 1, 0);

// ---------- The walk ----------
// One leg's angles through a stride (forward walking), from its phase φ (heel strike at φ = π/2, as the old sine's peak).
// thigh: -0.8 (behind) .. 1 (in front), knee: flexion, ankle: + toes up. A real gait, not a sine: the foot is planted
// for 60 % of the stride while the body passes over it (the knee gives a little as it takes the weight), then rolls onto
// the toes and pushes off; the leg swings through quickly, knee folded for the foot to clear the floor, and reaches out.
const TAU = Math.PI * 2;
const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const sine = (x) => (1 - Math.cos(Math.PI * clamp(x, 0, 1))) / 2;
const strideU = (phi) => ((((phi - Math.PI / 2) / TAU) % 1) + 1) % 1;
function gait(phi, out) {
  const u = strideU(phi);
  if (u < 0.6) {
    const st = u / 0.6;
    out.thigh = 1 - 1.8 * (st * 0.8 + sm(st) * 0.2);
    out.knee = (st < 0.5 ? 0.26 * Math.sin(Math.PI * st / 0.5) : 0) + 0.55 * sm((st - 0.72) / 0.28);
    out.ankle = 0.18 * (1 - sm(st / 0.18)) - 0.4 * sm((st - 0.65) / 0.35);
  } else {
    const sw = (u - 0.6) / 0.4;
    out.thigh = -0.8 + 1.8 * sine(sw) + 0.08 * Math.sin(Math.PI * sw);
    out.knee = sw < 0.35 ? 0.55 + 0.5 * sine(sw / 0.35) : 1.05 * (1 - sine((sw - 0.35) / 0.65));
    out.ankle = sw < 0.3 ? -0.4 + 0.55 * sine(sw / 0.3) : 0.15 + 0.03 * sw;
  }
  return out;
}
const _gf = {}, _gb = {};
// Forwards, backwards (the same stride played in reverse), or in between while the direction changes.
function leg(phi, back, out) {
  gait(phi, _gf); gait(Math.PI - phi, _gb);
  out.thigh = lerp(_gf.thigh, _gb.thigh, back); out.knee = lerp(_gf.knee, _gb.knee, back); out.ankle = lerp(_gf.ankle, _gb.ankle, back);
  return out;
}
const _lr = {}, _ll = {};

// Lowest point of the meshes hanging under a bone, in that bone's frame.
function reach(bone) {
  const box = new THREE.Box3(), b = new THREE.Box3();
  bone.updateWorldMatrix(true, true);
  const inv = bone.matrixWorld.clone().invert();
  bone.children.forEach((c) => c.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(inv, o.matrixWorld));
    box.union(b);
  }));
  return -box.min.y;
}

class Rig {
  // root: the group main.js moves (its child is the model, turned round). eye: in the head's frame.
  constructor(root, model, { eye = new THREE.Vector3(0, 0.13, 0.1), flip = true, lagging = false } = {}) {
    this.root = root; this.model = model; this.lagging = lagging; this.s = flip ? -1 : 1;
    this.by = Object.fromEntries(NODES.map((n) => [n, model.getObjectByName(n)]));
    this.ok = NODES.every((n) => this.by[n]);
    if (!this.ok) return;
    this.rest = Object.fromEntries(NODES.map((n) => [n, this.by[n].position.clone()]));
    const B = this.by;
    this.hipsY = this.rest.hips.y;
    this.thigh = this.rest.shin_r.length(); this.shin = this.rest.foot_r.length();
    this.ankle = this.hipsY + this.rest.leg_r.y - this.thigh - this.shin;
    this.limbs = {};
    for (const side of ['r', 'l']) {
      const upper = this.rest[`forearm_${side}`].length();
      this.limbs[side] = { upper, fore: Math.max(0.15, reach(B[`forearm_${side}`]) - HAND) };
    }
    this.eye = new THREE.Object3D();
    this.eye.position.copy(eye);
    B.head.add(this.eye);
    // How far forward of the spine the eyes sit, as an angle seen from the torso pivot.
    this.eyeLean = Math.atan2(Math.abs(eye.z), this.rest.head.y + eye.y);
    this.fix = 0;
  }
}

export class PlayerBody {
  constructor() {
    this.rigs = [];
    this.yaw = 0; this.speed = 0; this.dir = 1; this.sitW = 0; this.lieW = 0; this.bob = 0;
    this.armW = { r: 0, l: 0 };
    this.prev = null; this.stare = 0;
    this.hist = []; this.histAt = 0;
    this.seed = Math.random() * 100; // its own breathing and idle sway
    this.sitV = 0; this.lieV = 0; // sitting down and lying are movements with a start and an end, not exponential slides
    this.prevYaw = null; this.turnAmt = 0; this.turnPh = 0; // small steps when turning on the spot
    this.legYaw = 0; // the hips turn towards a sideways step while the chest keeps facing the view
  }

  add(root, model, opts) { const r = new Rig(root, model, opts); if (r.ok) this.rigs.push(r); return r.ok; }

  // s: { visible, camera, pos (feet), floorY, bob, mode: 'stand' | 'seat' | 'lie', seat: { pos, yaw },
  //      hands (first-person Hands), loss (0..1 for the hallucinations), mirrorAt (Vector3 or null) }
  update(dt, t, s) {
    if (!this.rigs.length) return;
    for (const r of this.rigs) if (!r.lagging) r.root.visible = s.visible; // mirrors.js shows the reflection itself
    if (!s.visible) { this.prev = null; return; }
    dt = Math.max(dt, 1e-4);
    const ease = (k) => Math.min(1, dt * k);
    const cam = s.camera;
    _e.setFromQuaternion(cam.quaternion, 'YXZ');
    const camYaw = _e.y, camPitch = _e.x, camRoll = _e.z;
    // Critically damped: the body starts to move gently, and settles without a jolt.
    const h = Math.min(dt, 1 / 30);
    for (const [w, key, vel, want] of [[5.5, 'sitW', 'sitV', s.mode === 'seat'], [4.2, 'lieW', 'lieV', s.mode === 'lie']]) {
      this[vel] += (w * w * ((want ? 1 : 0) - this[key]) - 2 * w * this[vel]) * h;
      this[key] = clamp(this[key] + this[vel] * h, 0, 1);
    }
    const sitW = this.sitW, lieW = this.lieW, upright = (1 - sitW) * (1 - lieW);

    // Walking speed and direction, from how far the feet moved.
    if (!this.prev) { this.prev = s.pos.clone(); this.yaw = camYaw; }
    const dx = s.pos.x - this.prev.x, dz = s.pos.z - this.prev.z;
    this.prev.copy(s.pos);
    const dist = Math.hypot(dx, dz) < 1 ? Math.hypot(dx, dz) : 0; // a teleport is not a step
    this.speed += (Math.min(dist / dt, 3) - this.speed) * ease(8);
    if (dist > 1e-4) this.dir += (Math.sign(-Math.sin(camYaw) * dx - Math.cos(camYaw) * dz || 1) - this.dir) * ease(6);
    const walk = clamp(this.speed / 1.4, 0, 1) * upright;
    const run = clamp((this.speed - 2.0) / 0.5, 0, 1) * upright; // the chasing patient breaks into a run (the player walks at 1.8 m/s)
    // A sideways step: the hips (and so the legs) turn towards where the feet go, up to ~40°, the chest stays.
    if (dist > 1e-4) {
      let rel = wrap(Math.atan2(-dx, -dz) - camYaw);
      if (Math.abs(rel) > Math.PI / 2) rel = wrap(rel - Math.PI); // walking backwards: the same, the other way round
      this.legYaw += (clamp(rel, -0.7, 0.7) - this.legYaw) * ease(6);
    } else this.legYaw += -this.legYaw * ease(3);

    // The body turns with the view: at once when walking, lazily standing still (the head turns first).
    if (sitW > 0.5 && s.seat) this.yaw += wrap(s.seat.yaw - this.yaw) * ease(6);
    else {
      const diff = wrap(camYaw - this.yaw);
      this.yaw += diff - clamp(diff, -0.6, 0.6);
      this.yaw += wrap(camYaw - this.yaw) * ease(walk > 0.1 ? 10 : 1.6);
    }

    // Turning on the spot: the feet shuffle round in small steps, as many as the turn needs.
    const yawRate = this.prevYaw === null ? 0 : Math.abs(wrap(this.yaw - this.prevYaw)) / dt;
    this.prevYaw = this.yaw;
    this.turnAmt += (clamp(yawRate / 1.8, 0, 1) * (1 - walk) * upright - this.turnAmt) * ease(yawRate > 0.2 ? 6 : 3);
    this.turnPh += Math.min(yawRate, 6) * dt * 4.5 + (this.turnAmt > 0.05 ? dt * 2 : 0);

    const drop = clamp(s.floorY + STAND_EYE - cam.position.y, 0, 0.8) * upright;
    const torsoYaw = Math.sin(s.bob / 2) * 0.06 * walk * this.dir;
    const P = {
      t, yaw: this.yaw, sitW, lieW, upright, walk, drop, dir: this.dir,
      phase: s.bob / 2 - Math.PI / 4, // one stride = two head bobs, feet down at the bottom of each bob
      pos: s.pos.clone(), floorY: s.floorY, eye: cam.position.clone(), seat: s.seat ? s.seat.pos.clone() : null,
      torsoYaw, headYaw: clamp(wrap(camYaw - this.yaw) - torsoYaw, -1.3, 1.3), pitch: camPitch, roll: camRoll,
      // Breathing, and the slow shift of the weight from one leg to the other when standing still.
      breath: Math.sin(t * 1.45 + this.seed), shift: Math.sin(t * 0.21 + this.seed * 1.7) * Math.sin(t * 0.13 + this.seed) * (1 - walk),
      run, back: clamp((1 - this.dir) / 2, 0, 1), turnAmt: this.turnAmt, turnPh: this.turnPh, legYaw: this.legYaw * walk,
      ik: {},
    };
    // The body arms reach for the first-person wrists while those hands do something (hold, type, dial).
    const H = s.hands;
    if (H?.ready) for (const [side, arm, rest] of [['r', H.right, H.rest.right], ['l', H.left, H.rest.left]]) {
      const busy = arm.fn !== rest || !!arm.from;
      this.armW[side] += ((busy ? 1 : 0) - this.armW[side]) * ease(busy ? 8 : 3);
      P.ik[side] = { w: this.armW[side], wrist: arm.wrist.clone() };
    }

    // History for the reflection.
    this.hist[this.histAt] = P;
    this.histAt = (this.histAt + 1) % HISTORY;
    const l = s.loss ?? 0;
    const lag = l > 0.5 ? Math.min(1.4, (l - 0.5) * 2.4) : 0;
    let late = P;
    if (lag > 0) for (let k = 1; k < HISTORY; k++) {
      const h = this.hist[(this.histAt - 1 - k + HISTORY * 2) % HISTORY];
      if (!h || h.t > t) break;
      late = h;
      if (t - h.t >= lag) break;
    }
    this.stare += ((l > 0.7 && s.mirrorAt ? 1 : 0) - this.stare) * ease(1.5);
    for (const r of this.rigs) this.apply(r, r.lagging ? late : P, dt, r.lagging ? s.mirrorAt : null);
  }

  apply(R, P, dt, mirrorAt) {
    const B = R.by, k = R.s;
    for (const n of NODES) { B[n].position.copy(R.rest[n]); B[n].rotation.set(0, 0, 0); }
    const { sitW, lieW, upright, walk, drop, dir, phase } = P;
    const run = P.run ?? 0, back = P.back ?? 0, turnAmt = P.turnAmt ?? 0;
    // The pelvis: lowest as a heel strikes (the weight drops onto it), highest as the body passes over the planted foot;
    // it shifts over the leg that carries it, turns with the leg that swings forward and dips on the swinging side.
    const uR = strideU(phase);
    const bobY = -(0.5 + 0.5 * Math.cos(4 * Math.PI * uR)) * 0.024 * walk * (1 + run * 0.8);
    const over = Math.cos(TAU * (uR - 0.3)); // +1: all the weight on the right leg
    leg(phase, back, _lr); leg(phase + Math.PI, back, _ll);
    const pelvisYaw = (_lr.thigh - _ll.thigh) * 0.5 * 0.08 * walk + (P.legYaw ?? 0);
    const pelvisRoll = over * 0.035 * walk;

    // Legs: crouch from the eye height (2-bone IK, feet under the hips), stride, or seated.
    const hipsStand = Math.min(R.hipsY, R.hipsY - drop * 0.96 - walk * 0.02 + R.fix * upright);
    const D = Math.min(hipsStand + R.rest.leg_r.y - R.ankle, R.thigh + R.shin - 0.001);
    const a = Math.acos(clamp((R.thigh ** 2 + D * D - R.shin ** 2) / (2 * R.thigh * D), -1, 1));
    const g = Math.acos(clamp((R.shin ** 2 + D * D - R.thigh ** 2) / (2 * R.shin * D), -1, 1));
    const hipsY = lerp(hipsStand, 0.52, sitW) + bobY;
    B.hips.position.y = hipsY;
    B.hips.position.x += -over * 0.016 * walk + (P.shift ?? 0) * 0.02 * upright; // right leg at -x
    B.hips.rotation.set(0, pelvisYaw, k * pelvisRoll);
    const A = 0.46 * (1 + 0.3 * run) * walk, KN = walk * (1 + 0.6 * run);
    for (const [side, off, sg, L] of [['r', 0, 1, _lr], ['l', Math.PI, -1, _ll]]) {
      // Turning on the spot: a small step, the foot lifted and put down a little further round.
      const step = Math.max(0, Math.sin((P.turnPh ?? 0) + off)) * turnAmt;
      let thigh = a + L.thigh * A + step * 0.32, knee = -(a + g) - L.knee * KN - step * 0.65;
      thigh = lerp(lerp(thigh, Math.PI / 2 - 0.06, sitW), 0.25, lieW);
      knee = lerp(lerp(knee, -Math.PI / 2 + 0.12, sitW), -0.4, lieW);
      // The legs stay under the body as the pelvis rolls; a sideways step turns the leg out a little more.
      B[`leg_${side}`].rotation.set(k * thigh, 0, k * (sg * (0.02 + sitW * 0.06) - pelvisRoll));
      B[`shin_${side}`].rotation.x = k * knee;
      B[`foot_${side}`].rotation.x = k * (-(thigh + knee) * (1 - lieW * 0.5) + L.ankle * walk * (1 - sitW) + step * 0.2);
    }

    // Root: on the floor under the eyes, or on the chair; on its side when lying.
    R.root.rotation.set(0, P.yaw, -lieW * Math.PI / 2 * 0.97, 'YXZ');
    if (sitW > 0.01 && P.seat) R.root.position.lerpVectors(P.pos, P.seat, sitW);
    else R.root.position.copy(P.pos);
    R.root.position.y = P.floorY - 0.01 + lieW * 0.21;

    // Torso: leans into a crouch; seated, leans so the head meets the camera (the lean-in to the screen).
    let lean = -drop * 0.85 - walk * 0.05 - run * 0.2;
    if (sitW > 0.01) {
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      _v2.set(P.eye.x - R.root.position.x, P.eye.y - (P.floorY + hipsY + R.rest.torso.y), P.eye.z - R.root.position.z);
      const need = Math.atan2(_v2.x * fx + _v2.z * fz, Math.max(0.05, _v2.y));
      lean = lerp(lean, clamp(-(need - R.eyeLean), -0.9, 0.3), sitW);
    }
    const breath = (P.breath ?? 0) * (1 - lieW * 0.5), shift = (P.shift ?? 0) * upright;
    // In the hips' frame: the chest keeps its own heading (it counters the pelvis), and stays upright over a rolling pelvis.
    B.torso.rotation.set(k * (lean - breath * 0.012 + bobY * 0.6), P.torsoYaw - pelvisYaw + shift * 0.03, shift * 0.035 - k * pelvisRoll * 0.8);
    B.head.rotation.set(k * clamp(P.pitch - lean, -1.1, 1.0), P.headYaw, k * P.roll * 0.6 * (1 - lieW), 'YXZ');

    // Arms: swing with the stride, rest on the thighs seated.
    // Arms: pendulums opposite to the legs, a little behind them (they are carried, not driven), the forearm trailing
    // further still and folding as it swings forward; bent and pumping when running; on the thighs seated.
    const armDir = 1 - 2 * back;
    for (const [side, sg, off] of [['r', 1, Math.PI], ['l', -1, 0]]) {
      const ph = phase + off - 0.35 * armDir;
      const swing = Math.sin(ph) * (0.42 + 0.35 * run) * walk * armDir;
      const fold = 0.5 + 0.5 * Math.sin(ph - 0.5 * armDir) * armDir;
      B[`arm_${side}`].rotation.set(k * lerp(lerp(swing + drop * 0.5 + run * 0.15, 0.55, sitW), 1.1, lieW), 0, k * sg * (0.05 + walk * 0.03 + run * 0.05));
      B[`forearm_${side}`].rotation.x = k * (0.14 + walk * (0.08 + 0.22 * fold) + run * (1.0 + 0.3 * fold) + sitW * 0.75 + drop * 0.6 + breath * 0.015);
    }

    // Slide the root so the eyes land on the camera; correct the crouch depth over the next frames.
    R.root.updateMatrixWorld(true);
    R.eye.getWorldPosition(_v);
    R.root.position.x += P.eye.x - _v.x;
    R.root.position.z += P.eye.z - _v.z;
    R.fix = clamp(R.fix + (drop > 0.02 ? (P.eye.y - _v.y) * Math.min(1, dt * 10) : -R.fix * Math.min(1, dt * 10)), -0.1, 0.3);
    R.root.updateMatrixWorld(true);

    for (const side of ['r', 'l']) if (P.ik[side]?.w > 0.01) this.armIK(R, side, P.ik[side], P.yaw);

    // The reflection's head stops following and keeps looking out of the mirror.
    if (mirrorAt && this.stare > 0.01) {
      B.head.getWorldPosition(_v);
      // lookAt aims -Z from its first point to its second: swap them for the models that look along +Z.
      _q2.setFromRotationMatrix(k < 0 ? _m.lookAt(mirrorAt, _v, UP) : _m.lookAt(_v, mirrorAt, UP));
      B.head.parent.getWorldQuaternion(_q);
      B.head.quaternion.slerp(_q.invert().multiply(_q2), this.stare);
    }
    R.root.updateMatrixWorld(true);
  }

  // 2-bone IK of one arm to a world-space wrist.
  armIK(R, side, { w, wrist }, yaw) {
    const { upper: L1, fore: L2 } = R.limbs[side], sg = side === 'r' ? 1 : -1;
    const up = R.by[`arm_${side}`], fore = R.by[`forearm_${side}`];
    const S = up.getWorldPosition(new THREE.Vector3());
    const u = wrist.clone().sub(S);
    const d = clamp(u.length(), 0.1, L1 + L2 - 0.002);
    u.normalize();
    // Elbow: out, back and a little down from the body.
    const pole = new THREE.Vector3(0.55 * sg, -0.3, 0.8).applyAxisAngle(UP, yaw);
    pole.addScaledVector(u, -pole.dot(u)).normalize();
    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const E = S.clone().addScaledVector(u, L1 * cosA).addScaledVector(pole, L1 * Math.sqrt(1 - cosA * cosA));
    const W = S.clone().addScaledVector(u, d);
    const d1 = E.clone().sub(S).normalize(), d2 = W.sub(E).normalize();
    const hinge = new THREE.Vector3().crossVectors(d1, d2);
    if (hinge.lengthSq() < 1e-6) hinge.crossVectors(pole, d1);
    hinge.normalize().multiplyScalar(R.s); // the bones' x axis (mirrored on the models that look along +Z)
    const basis = (dir) => {
      const y = dir.clone().negate(), z = new THREE.Vector3().crossVectors(hinge, y);
      return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(hinge, y, z));
    };
    const Q1 = basis(d1), Q2 = basis(d2);
    up.parent.getWorldQuaternion(_q);
    up.quaternion.slerp(_q.invert().multiply(Q1), w);
    up.updateMatrixWorld(true);
    up.getWorldQuaternion(_q);
    fore.quaternion.slerp(_q.invert().multiply(Q2), w);
    up.updateMatrixWorld(true);
  }
}
