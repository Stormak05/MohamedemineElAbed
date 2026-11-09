// The voices the patient hears when he loses his grip (recording sheet "HAL", recorded by everyone).
// Each line is heard and flashed as a subliminal image, Alan Wake style: a few frames at most, in a burst,
// the words full screen on black, then over the picture, sometimes in negative.
//
// Sound: the recorded takes go in assets/audio/voix/ and are listed per line in voix.json
// ({ "HAL_06": ["hal_06_jules_neutre", "hal_06_jules_oreille", …] }). Several takes played together, offset and
// spread around the player, make the whispering crowd. Without takes, only the text flashes.

export const HAL = {
  HAL_01: 'Reste.',
  HAL_02: 'Tu es malade.',
  HAL_03: 'Ils te regardent.',
  HAL_04: 'Retourne te coucher.',
  HAL_05: 'Personne ne viendra.',
  HAL_06: 'Ils te voient.', // wall « ILS TE VOIENT »
  HAL_07: 'Ils écoutent.', // wall « ILS ÉCOUTENT »
  HAL_08: 'Sors.', // wall « SORS »
  HAL_09: 'Il ne sortira jamais.', // the PC's screen
  HAL_10: 'Cent quatre.',
  HAL_11: 'Tu te souviens ?',
  HAL_12: 'C\'est de ta faute.',
  HAL_13: 'Regarde derrière toi.',
  HAL_14: 'Il ment.', // repeated over and over
  HAL_15: null, // whispers, no real words
};
// What shows when it is not the spoken text: the number rather than the words, scraps of words for HAL_15.
const SHOWN = { HAL_10: '104' };
const MURMURS = ['SSSH', 'IL…', 'TU…', 'MAL—', 'RES—', 'NON NON', 'VOI—', 'ORTE', 'TOI TOI', 'CHUT', 'ÇA—', 'DORS'];
// Lines heard at random during hallucinations, [id, from this sanity loss on], the harshest last.
export const HAL_RANDOM = [['HAL_01', 0.5], ['HAL_02', 0.5], ['HAL_03', 0.5], ['HAL_04', 0.5], ['HAL_05', 0.5],
  ['HAL_11', 0.6], ['HAL_10', 0.65], ['HAL_12', 0.7], ['HAL_14', 0.75]];
export const halOf = (text) => Object.keys(HAL).find((id) => HAL[id] && norm(HAL[id]) === norm(text));
const norm = (s) => s.toLowerCase().replace(/[^a-zà-ÿ ]/g, '').trim();

const FONTS = ['900 {s}px Impact, "Arial Narrow", "Helvetica Neue", sans-serif', '{s}px "Special Elite", "Courier New", monospace'];

// cfg.subliminal: 'full' (black frames and negatives), 'soft' (the words only, no full-screen flash), 'off'.
// view: the game's canvas (turned negative for a frame); paused(): no flash while a menu is open.
export function createVoices({ audio, cfg, view, paused }) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const level = () => (cfg.subliminal === 'full' && reduce?.matches ? 'soft' : cfg.subliminal);

  const el = document.createElement('canvas');
  el.id = 'subliminal';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, { position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 11, pointerEvents: 'none', display: 'none' });
  document.body.append(el);
  const ctx = el.getContext('2d');

  // The recorded takes, once voix.json lists some.
  let takes = {};
  fetch('assets/audio/voix/voix.json').then((r) => (r.ok ? r.json() : {})).then((j) => { takes = j; }).catch(() => {});
  const loaded = new Set();
  async function loadTakes(id) {
    if (loaded.has(id) || !audio.ac) return;
    loaded.add(id);
    await Promise.all((takes[id] ?? []).map((name) => audio.load(`voix/${name}`)));
  }

  // A burst: frames { a, b (seconds from t0), style, txt, x, y (0..1), size, font }.
  let frames = [], t0 = 0, raf = 0;
  const now = () => performance.now() / 1000;

  function burst(id, { strength = 1, words = null } = {}) {
    const lv = level();
    if (lv === 'off') return;
    const text = (SHOWN[id] ?? HAL[id] ?? MURMURS[Math.floor(Math.random() * MURMURS.length)]).toUpperCase().replace(/[.]/g, '');
    const parts = words ?? text.split(/\s+/).filter((w) => w.length > 1 || text.length < 4);
    const r = Math.random;
    const out = [];
    let t = 0.02;
    const add = (dur, style, txt, opts = {}) => { out.push({ a: t, b: t + dur, style, txt, x: 0.5, y: 0.5, size: 1, font: 0, ...opts }); t += dur; };
    const gap = (min, max) => { t += min + r() * (max - min); };
    // 1. The hit: the whole line, full screen, on black (over the picture when soft).
    add(lv === 'full' ? 0.05 + r() * 0.03 : 0.09, lv === 'full' ? 'cut' : 'over', text, { size: 1.1, font: r() < 0.7 ? 0 : 1 });
    // 2. The words one by one, elsewhere on the screen.
    for (const w of parts.length > 1 ? parts : []) {
      gap(0.04, 0.16);
      add(0.035 + r() * 0.04, 'over', w, { x: 0.2 + r() * 0.6, y: 0.22 + r() * 0.56, size: 0.6 + r() * 0.9, font: r() < 0.5 ? 0 : 1 });
    }
    // 3. The worse he is, the more it comes back: a negative, the line again.
    const extra = Math.round(strength * (1 + r() * 2));
    for (let i = 0; i < extra; i++) {
      gap(0.06, 0.3);
      const style = lv === 'full' && r() < 0.35 + 0.3 * strength ? 'negative' : 'over';
      add(0.03 + r() * 0.05, style, r() < 0.5 ? text : parts[Math.floor(r() * parts.length)] ?? text,
        { x: 0.5 + (r() - 0.5) * 0.3, y: 0.5 + (r() - 0.5) * 0.3, size: 0.8 + r() * 0.6, font: r() < 0.6 ? 0 : 1 });
    }
    return play(out);
  }

  function play(out) {
    const start = now();
    if (frames.length && start < t0 + frames.at(-1).b) {
      // A burst already playing: the new one follows it.
      const end = frames.at(-1).b - (start - t0) + 0.05;
      out.forEach((f) => { f.a += end; f.b += end; });
      out = [...frames.map((f) => ({ ...f, a: f.a - (start - t0), b: f.b - (start - t0) })).filter((f) => f.b > 0), ...out];
    }
    frames = out; t0 = start;
    if (!raf) raf = requestAnimationFrame(draw);
    return frames;
  }

  function draw() {
    raf = 0;
    const t = now() - t0;
    if (!frames.length || t > frames.at(-1).b || paused()) { frames = []; clear(); return; }
    const f = frames.find((x) => t >= x.a && t < x.b);
    if (f) render(f); else clear();
    raf = requestAnimationFrame(draw);
  }

  function clear() {
    if (el.style.display !== 'none') { el.style.display = 'none'; view.style.filter = ''; }
  }

  function render(f) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
    el.style.display = 'block';
    view.style.filter = f.style === 'negative' ? 'invert(1) contrast(1.6) grayscale(0.6)' : '';
    ctx.clearRect(0, 0, w, h);
    if (f.style === 'cut') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); }

    // Size: the line fits in 86 % of the width, a single word can be huge.
    let size = Math.min(h * 0.32, w * 0.16) * f.size;
    const font = (s) => FONTS[f.font].replace('{s}', Math.round(s));
    ctx.font = font(size);
    let tw = ctx.measureText(f.txt).width;
    if (tw > w * 0.86) { size *= (w * 0.86) / tw; tw = w * 0.86; ctx.font = font(size); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const jx = (Math.random() - 0.5) * size * 0.04, jy = (Math.random() - 0.5) * size * 0.04;
    // Kept inside the screen, whatever the word's size and place.
    const x = Math.min(w - tw / 2, Math.max(tw / 2, f.x * w)) + jx, y = Math.min(h - size * 0.6, Math.max(size * 0.6, f.y * h)) + jy;
    const ink = f.style === 'negative' ? '#000' : '#f2ece0';

    // Red and cyan fringes, the text, then a few torn bands shifted sideways.
    ctx.globalCompositeOperation = f.style === 'negative' ? 'source-over' : 'lighter';
    const split = size * 0.035;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = f.style === 'negative' ? '#600' : '#c01010'; ctx.fillText(f.txt, x - split, y);
    ctx.fillStyle = f.style === 'negative' ? '#055' : '#10a0b0'; ctx.fillText(f.txt, x + split, y + split * 0.3);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = f.style === 'over' ? 0.92 : 1;
    ctx.fillStyle = ink; ctx.fillText(f.txt, x, y);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
      const by = y + (Math.random() - 0.5) * size, bh = 2 + Math.random() * size * 0.08, dx = (Math.random() - 0.5) * size * 0.5;
      ctx.drawImage(el, 0, by, w, bh, dx, by, w, bh);
    }
  }

  // The voice, then the image. repeat: says it again for that many seconds (HAL_14). silent: the image only.
  // pos(i): where the i-th voice of the crowd stands (null: inside his head).
  function say(id, strength, pos) {
    const names = (takes[id] ?? []).filter((n) => audio.buffers[`voix/${n}`]);
    if (names.length) {
      const crowd = names.sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(strength * 3));
      crowd.forEach((n, i) => audio.play(`voix/${n}`, { gain: 0.8 / Math.sqrt(crowd.length), at: i * (0.05 + Math.random() * 0.12), pos: pos?.(i) ?? null, bus: audio.voice, rate: 0.97 + Math.random() * 0.06 }));
    }
  }
  async function hal(id, { strength = 1, pos = null, repeat = 0, silent = false } = {}) {
    if (!(id in HAL)) return;
    if (!silent) { await loadTakes(id); say(id, strength, pos); }
    burst(id, { strength });
    if (repeat > 0) {
      const until = now() + repeat;
      const again = () => {
        if (now() > until || paused()) return;
        if (!silent) say(id, strength, pos);
        burst(id, { strength: Math.min(1, strength + 0.2) });
        setTimeout(again, 1400 + Math.random() * 1600);
      };
      setTimeout(again, 1600);
    }
  }

  return { hal, burst };
}
