// Motion helpers: easing curves, organic noise and small random variations, so that nothing moves like a machine.
// No imports: usable anywhere (tests load some modules from data: URLs, which cannot resolve relative imports).

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------- Easing curves: k in 0..1 → progress (0 at 0, 1 at 1) ----------
const minJerk = (t) => t * t * t * (10 + t * (-15 + 6 * t)); // the velocity profile of a relaxed human gesture
// Moves the curve's midpoint to `p`: a quicker start and a longer landing (p < 0.5), or the reverse.
const skew = (t, p) => Math.pow(t, Math.log(0.5) / Math.log(p));
export const ease = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuart: (t) => 1 - (1 - t) ** 4,
  minJerk,
  // A hand or a head going somewhere: peak speed a little before the middle, a long soft landing.
  reach: (t) => minJerk(skew(clamp01(t), 0.44)),
  // A body moving (standing up, sitting down, walking a few steps): starts gently, settles gently.
  body: (t) => minJerk(skew(clamp01(t), 0.47)),
  // Pushed, then carried by its own weight: a quick start, a long slowing down.
  push: (t) => minJerk(skew(clamp01(t), 0.32)),
  // Overshoots a little and comes back (a lid against its stop, a head settling). s: how much.
  outBack: (t, s = 1.2) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  settle: (t) => ease.outBack(t, 0.6),
  // Falling: gravity, then the impact and a small rebound.
  fall: (t) => {
    const h = 0.8;
    if (t <= 0) return 0;
    if (t < h) return (t / h) ** 2;
    return 1 - 0.035 * Math.sin(((t - h) / (1 - h)) * Math.PI);
  },
  // A mechanism with a governor (a rotary dial running back): soft start, then constant speed.
  governor: (t, a = 0.18) => (t < a ? (t * t) / (2 * a) : t - a / 2) / (1 - a / 2),
};

// The bulge of a path between its ends (0 at both ends, 1 in the middle), to bend straight lines into arcs.
export const arc = (k) => Math.sin(Math.PI * clamp01(k));
// Staggered start: progress of something that begins `delay` (0..1) into the move and ends with it.
export const late = (k, delay) => clamp01((k - delay) / (1 - delay));

// ---------- Randomness ----------
// `v` give or take `amount` (a fraction): no two gestures last exactly as long.
export const vary = (v, amount = 0.08) => v * (1 + (Math.random() * 2 - 1) * amount);
export const between = (a, b) => a + Math.random() * (b - a);

// Smooth 1D value noise in -1..1: organic drift, unlike a sine that repeats exactly.
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return (s - Math.floor(s)) * 2 - 1; };
export function noise(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * f * (f * (f * 6 - 15) + 10);
  const a = hash(i + seed * 57.3), b = hash(i + 1 + seed * 57.3);
  return a + (b - a) * u;
}
// Two octaves: a slow wander with a little texture.
export const drift = (x, seed = 0) => noise(x, seed) * 0.7 + noise(x * 2.3 + 17.1, seed + 3.7) * 0.3;
