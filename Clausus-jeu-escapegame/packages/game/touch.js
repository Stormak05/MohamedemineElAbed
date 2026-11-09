import { cfg, onCfg } from './config.js';

// Touch controls: dynamic joystick (one half of the screen), drag to look (other half), tap an object to use it,
// round buttons for the action / pills / torch / pause, and at the computer a "stand up" bar and an on-screen keyboard.
// Mode: Options > Commandes > « Commandes tactiles » (auto = touch screen detected or a finger was used).

const coarse = matchMedia('(pointer: coarse)');
const portrait = matchMedia('(orientation: portrait)');
let seenTouch = false;
export function isTouch() {
  return cfg.touchMode === 'on' || (cfg.touchMode !== 'off' && (coarse.matches || seenTouch));
}
function refresh() {
  document.body.classList.toggle('touch', isTouch());
}
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !seenTouch) { seenTouch = true; refresh(); } }, true);
coarse.addEventListener?.('change', refresh);
onCfg((id) => { if (id === 'touchMode') refresh(); });
// iOS Safari ignores user-scalable=no: block pinch zoom by hand.
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Keyboard Lock reserves short Escape presses for the game; the browser keeps
// hold-Escape as its emergency exit. The API must be called from the top frame.
function lockEscape() {
  try {
    const keyboard = window.top.navigator.keyboard;
    Promise.resolve(keyboard?.lock?.(['Escape'])).catch(() => {});
  } catch { /* Unsupported, denied, or a cross-origin embedding. */ }
}
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) {
  document.addEventListener(ev, () => {
    if (document.fullscreenElement || document.webkitFullscreenElement) lockEscape();
    else {
      try { window.top.navigator.keyboard?.unlock?.(); } catch { /* Cross-origin embedding. */ }
    }
  });
}

// Must run synchronously inside the player's click, after requesting pointer lock.
export function goFullscreen() {
  const d = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const request = d.requestFullscreen || d.webkitRequestFullscreen;
  if (!request) return;
  try {
    const result = request === d.requestFullscreen
      ? request.call(d, { navigationUI: 'hide' }) : request.call(d);
    Promise.resolve(result)
      .then(() => { if (isTouch()) return screen.orientation?.lock?.('landscape'); })
      .catch(() => {});
  } catch { /* Unsupported or denied: keep playing in the page. */ }
}

export function exitFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) return;
  try {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    Promise.resolve(exit?.call(document)).catch(() => {});
  } catch { /* Fullscreen may already have ended. */ }
}

const CSS = `
html, body { touch-action: none; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; -webkit-user-select: none; }
#touch { position: fixed; inset: 0; z-index: 7; pointer-events: none; display: none; font-family: var(--type); color: #e8dcb8; --op: 0.6;
  --sl: env(safe-area-inset-left, 0px); --sr: env(safe-area-inset-right, 0px); --sb: env(safe-area-inset-bottom, 0px); --st: env(safe-area-inset-top, 0px); }
#touch.on { display: block; }
#touch .tzone { position: absolute; inset: 0; pointer-events: auto; touch-action: none; }
#touch.pc .tzone, #touch.pc .tgame, #touch:not(.pc) .tpc, #touch:not(.pc) .tkb { display: none !important; }
#touch .tjoy { position: absolute; width: 132px; height: 132px; margin: -66px 0 0 -66px; border-radius: 50%; pointer-events: none;
  border: 2px solid rgba(232,220,184,0.55); background: radial-gradient(circle, rgba(20,16,12,0.1) 40%, rgba(20,16,12,0.5));
  box-shadow: 0 0 0 1px rgba(0,0,0,0.5), inset 0 0 18px rgba(0,0,0,0.5); opacity: calc(var(--op) * 0.5); transition: opacity 0.25s; }
#touch .tjoy.live { opacity: var(--op); transition: none; }
#touch .tjoy.gone { opacity: 0; }
#touch .tjoy .knob { position: absolute; left: 50%; top: 50%; width: 58px; height: 58px; margin: -29px 0 0 -29px; border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #f1e7cc, #9a8f74 70%, #5a5242); box-shadow: 0 3px 6px rgba(0,0,0,0.8); }
#touch .tjoy .hint { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: 6px; font-size: 12px; letter-spacing: 1px; white-space: nowrap; color: #bdb397; text-shadow: 0 1px 2px #000; }
#touch .tjoy.live .hint, #touch .tjoy.used .hint { display: none; }
#touch .tbtn { position: absolute; right: calc(var(--sr) + var(--x)); bottom: calc(var(--sb) + var(--y)); width: var(--s, 60px); height: var(--s, 60px);
  margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; pointer-events: auto; touch-action: none;
  font: 22px var(--type); color: #efe4c8; background: radial-gradient(circle at 50% 35%, rgba(70,54,42,0.75), rgba(20,15,11,0.8));
  border: 2px solid rgba(232,220,184,0.55); box-shadow: 0 3px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,230,190,0.18); opacity: var(--op);
  transition: transform 0.08s, opacity 0.2s, border-color 0.2s; -webkit-tap-highlight-color: transparent; user-select: none; }
#touch.swap .tbtn.side { right: auto; left: calc(var(--sl) + var(--x)); }
#touch .tbtn.press { transform: scale(0.9); filter: brightness(1.45); }
#touch .tbtn.off { display: none; }
#touch .tbtn img { width: 60%; height: 60%; image-rendering: pixelated; pointer-events: none; }
#touch .tbtn .n { position: absolute; right: -4px; bottom: -4px; min-width: 20px; height: 20px; padding: 0 4px; box-sizing: border-box; border-radius: 10px;
  font: 13px/20px var(--type); text-align: center; color: #1d1a14; background: #e8dcb8; box-shadow: 0 1px 3px #000; }
#touch .tact { --s: 80px; --x: 24px; --y: 26px; font-size: 34px; }
#touch .tact.dim { opacity: calc(var(--op) * 0.55); }
#touch .tact.hot { opacity: 1; border-color: #f4e4b8; animation: thot 1.1s ease-in-out infinite; }
#touch .tact.next { opacity: 1; border-color: #f4e4b8; font-size: 28px; }
@keyframes thot { 50% { box-shadow: 0 0 0 6px rgba(244,228,184,0.18), 0 3px 8px rgba(0,0,0,0.6); } }
#touch .tpill { --x: 118px; --y: 22px; }
#touch .ttorch { --x: 34px; --y: 122px; }
#touch .ttorch.lit { border-color: #fff2c0; box-shadow: 0 0 14px rgba(255,236,170,0.45), 0 3px 8px rgba(0,0,0,0.6); }
#touch .tpause { --s: 46px; right: calc(var(--sr) + 14px); top: calc(var(--st) + 12px); bottom: auto; font-size: 18px; letter-spacing: 2px; opacity: calc(var(--op) * 0.9); }
#touch .tpc { position: absolute; top: calc(var(--st) + 10px); right: calc(var(--sr) + 70px); display: flex; gap: 8px; pointer-events: none; }
#touch .tpill2 { pointer-events: auto; touch-action: none; padding: 9px 16px; font: 16px var(--type); color: #efe4c8; border-radius: 22px;
  background: rgba(20,15,11,0.82); border: 2px solid rgba(232,220,184,0.55); box-shadow: 0 3px 8px rgba(0,0,0,0.6); }
#touch .tpill2.on { background: #6e2a1c; border-color: #f0c8a8; }
#touch .tpill2.press { filter: brightness(1.4); }
#touch .tkb { position: absolute; left: 0; right: 0; bottom: 0; padding: 6px calc(var(--sr) + 6px) calc(var(--sb) + 6px) calc(var(--sl) + 6px);
  display: none; flex-direction: column; gap: 5px; pointer-events: auto; touch-action: none; background: linear-gradient(rgba(14,11,8,0.82), rgba(8,6,5,0.95));
  border-top: 2px solid rgba(232,220,184,0.35); }
#touch.kb .tkb { display: flex; }
#touch .tkb .r { display: flex; justify-content: center; gap: 5px; }
#touch .tkb .k { flex: 0 1 54px; height: 34px; display: flex; align-items: center; justify-content: center; font: 17px var(--type); color: #2b241a;
  background: linear-gradient(#e6dcc0, #c9bc98); border-radius: 5px; box-shadow: inset 0 -3px 0 rgba(0,0,0,0.3), 0 2px 0 #000; }
#touch .tkb .k.w { flex-basis: 84px; color: #efe4c8; background: linear-gradient(#5a4234, #3a2a22); }
#touch .tkb .k.press { transform: translateY(2px); box-shadow: inset 0 -1px 0 rgba(0,0,0,0.3); filter: brightness(1.15); }
#touch .trot { position: fixed; inset: 0; z-index: 40; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding: 24px;
  text-align: center; pointer-events: auto; background: rgba(4,3,2,0.94); font-size: 20px; line-height: 1.5; color: #e8dcb8; }
#touch .trot.on { display: flex; }
#touch .trot .ico { font-size: 64px; animation: trot 2.4s ease-in-out infinite; }
@keyframes trot { 0%, 30% { transform: rotate(0); } 60%, 100% { transform: rotate(-90deg); } }
#touch .trot button { font: 17px var(--type); color: #efe4c8; padding: 10px 22px; background: #3a2a22; border: 2px solid #1a110c; border-radius: 4px; }
body.touch #hud .key { display: none; }
body.touch #osHint { display: none; }
body.touch .bubble { min-width: 0; max-width: min(560px, 66vw); padding: 20px 34px 12px 16px; font-size: 18px; }
@media (max-height: 460px) {
  body.touch #hud { transform: scale(0.8); transform-origin: 0 0; left: calc(env(safe-area-inset-left, 0px) + 10px); top: 8px; }
  body.touch #bubbles { bottom: 52px; }
  #touch .tact { --s: 70px; --x: 18px; --y: 18px; }
  #touch .tpill { --x: 100px; --y: 14px; --s: 54px; }
  #touch .ttorch { --x: 26px; --y: 100px; --s: 54px; }
  #touch .tkb { gap: 4px; padding-top: 4px; }
  #touch .tkb .k { height: 30px; }
}
`;

const KB_ROWS = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'], ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'], ['W', 'X', 'C', 'V', 'B', 'N', ' ', '⌫', '↵']];
const JOY_R = 56, DEAD = 0.12;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export function createTouchControls(h) {
  // h: { state(), look(dx, dy), tap(x, y), interact(), pill(), torch(), pause(), leavePC(), typeKey(key) }
  const style = el('style'); style.textContent = CSS; document.head.append(style);
  const root = el('div'); root.id = 'touch'; document.body.append(root);
  const zone = el('div', 'tzone');
  const game = el('div', 'tgame');
  const joy = el('div', 'tjoy', '<div class="knob"></div><div class="hint">glisser pour marcher</div>');
  const knob = joy.firstChild;
  const btn = (cls, html, fn, tag = 'button') => {
    const b = el(tag, cls, html);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 120);
      fn();
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return b;
  };
  const act = btn('tbtn side tact dim', '✋', () => h.interact());
  const pill = btn('tbtn side tpill off', '<img src="hud/pill.png" alt=""><span class="n">0</span>', () => h.pill());
  pill.querySelector('img').onerror = function () { this.replaceWith('💊'); };
  const torch = btn('tbtn side ttorch off', '<img src="hud/torch.png" alt="">', () => h.torch());
  const pause = btn('tbtn tpause', 'II', () => h.pause());
  act.setAttribute('aria-label', 'Interagir'); pill.setAttribute('aria-label', 'Prendre un cachet');
  torch.setAttribute('aria-label', 'Lampe torche'); pause.setAttribute('aria-label', 'Pause');
  game.append(joy, act, pill, torch);

  // At the computer.
  const pc = el('div', 'tpc');
  const kbBtn = btn('tpill2', '⌨ Clavier', () => setKb(!kbOpen));
  pc.append(kbBtn, btn('tpill2', 'Se lever ✕', () => h.leavePC()));
  const kb = el('div', 'tkb');
  for (const row of KB_ROWS) {
    const r = el('div', 'r');
    for (const k of row) {
      const key = k === '⌫' ? 'Backspace' : k === '↵' ? 'Enter' : k;
      const label = k === '↵' ? '↵ OK' : k === ' ' ? 'Espace' : k;
      r.append(btn(`k${key.length > 1 || k === ' ' ? ' w' : ''}`, label, () => h.typeKey(key), 'div'));
    }
    kb.append(r);
  }

  const rot = el('div', 'trot', '<div class="ico">📱</div><div>Tourne l\'appareil à l\'horizontale.</div>');
  let rotDismissed = false;
  rot.append(btn('', 'Continuer quand même', () => { rotDismissed = true; rot.classList.remove('on'); }));
  root.append(zone, game, pc, kb, pause, rot);

  // ---------- Joystick and look ----------
  const move = { x: 0, y: 0 };
  const ptrs = new Map();
  let joyId = null, lookId = null;
  const base = { x: 0, y: 0 };
  const joySide = (x) => (x < innerWidth / 2) !== !!cfg.touchSwap;
  function idleJoy() {
    const pad = 40 + JOY_R;
    base.x = cfg.touchSwap ? innerWidth - pad - 30 : pad + 30;
    base.y = innerHeight - pad - 20;
    joy.style.left = `${base.x}px`; joy.style.top = `${base.y}px`;
    knob.style.transform = '';
    joy.classList.remove('live');
  }
  function setKnob(x, y) {
    let dx = x - base.x, dy = y - base.y;
    const d = Math.hypot(dx, dy);
    // Dynamic: past the rim the base follows the thumb.
    if (d > JOY_R) {
      base.x = x - dx / d * JOY_R; base.y = y - dy / d * JOY_R;
      dx = x - base.x; dy = y - base.y;
      joy.style.left = `${base.x}px`; joy.style.top = `${base.y}px`;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, Math.hypot(dx, dy) / JOY_R);
    const k = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD) / (m || 1);
    move.x = dx / JOY_R * k; move.y = dy / JOY_R * k;
  }
  function release(id) {
    if (id === joyId) { joyId = null; move.x = move.y = 0; idleJoy(); }
    if (id === lookId) lookId = null;
    ptrs.delete(id);
  }
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    const p = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), kind: null };
    const free = h.state().free;
    if (joySide(e.clientX) && joyId === null && free) {
      p.kind = 'joy'; joyId = e.pointerId;
      base.x = Math.max(JOY_R + 8, Math.min(innerWidth - JOY_R - 8, e.clientX));
      base.y = Math.max(JOY_R + 8, Math.min(innerHeight - JOY_R - 8, e.clientY));
      joy.style.left = `${base.x}px`; joy.style.top = `${base.y}px`;
      joy.classList.add('live', 'used');
      setKnob(e.clientX, e.clientY);
    } else if (!joySide(e.clientX) && lookId === null) { p.kind = 'look'; lookId = e.pointerId; }
    ptrs.set(e.pointerId, p);
  });
  zone.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    // Coalesced events give smoother look on high-rate touch screens.
    const evs = e.getCoalescedEvents?.() ?? [];
    const list = evs.length ? evs : [e];
    for (const ev of list) {
      const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
      p.x = ev.clientX; p.y = ev.clientY;
      if (p.kind === 'look' && h.state().free) h.look(dx, dy);
    }
    if (p.kind === 'joy') setKnob(e.clientX, e.clientY);
  });
  const end = (e, cancel) => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    const isTap = !cancel && performance.now() - p.t0 < 350 && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 16;
    release(e.pointerId);
    if (isTap) h.tap(e.clientX, e.clientY);
  };
  zone.addEventListener('pointerup', (e) => end(e, false));
  zone.addEventListener('pointercancel', (e) => end(e, true));
  zone.addEventListener('contextmenu', (e) => e.preventDefault());
  // No emulated click after a tap: it would land on what the tap just opened (a document closes at once).
  zone.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  for (const b of [game, pc, kb, pause]) b.addEventListener('touchend', (e) => { if (e.cancelable && e.target.closest('.tbtn, .tpill2, .k')) e.preventDefault(); }, { passive: false });
  addEventListener('resize', () => { if (joyId === null) idleJoy(); });

  // ---------- Keyboard at the computer ----------
  let kbOpen = false, kbAuto = false, lastOs = null, lift = 0;
  function setKb(on) { kbOpen = on; root.classList.toggle('kb', on); kbBtn.classList.toggle('on', on); }

  // ---------- Per-frame state ----------
  let shown = false, prev = '';
  function update(dt) {
    const s = h.state();
    const on = isTouch();
    const show = on && s.show;
    rot.classList.toggle('on', on && portrait.matches && !rotDismissed);
    if (show !== shown) {
      shown = show;
      root.classList.toggle('on', show);
      if (!show) { for (const id of [...ptrs.keys()]) release(id); }
    }
    const atPc = s.mode === 'computer';
    if (!atPc && (kbOpen || kbAuto)) { kbAuto = false; setKb(false); }
    lastOs = atPc ? s.osState : null;
    if (!s.free && joyId !== null) release(joyId);
    // Lift the 3D view above the keyboard so the screen stays readable.
    const want = show && atPc && kbOpen ? kb.offsetHeight * 0.62 : 0;
    lift += (want - lift) * Math.min(1, dt * 10);
    if (Math.abs(want - lift) < 0.5) lift = want;
    if (!show) return;
    root.style.setProperty('--op', cfg.touchOpacity);
    const key = `${atPc}|${s.free}|${s.hot}|${s.next}|${s.pills}|${s.torch}|${s.torchOn}|${cfg.touchSwap}|${s.mode}`;
    if (key === prev) return;
    prev = key;
    root.classList.toggle('pc', atPc);
    root.classList.toggle('swap', !!cfg.touchSwap);
    joy.classList.toggle('gone', !s.free);
    act.classList.toggle('hot', s.free && s.hot && !s.next);
    act.classList.toggle('next', s.next);
    act.classList.toggle('dim', !s.next && !(s.free && s.hot));
    act.textContent = s.next ? '▶' : '✋';
    pill.classList.toggle('off', !(s.pills > 0 && s.free));
    pill.querySelector('.n') && (pill.querySelector('.n').textContent = s.pills);
    torch.classList.toggle('off', !s.torch || atPc);
    torch.classList.toggle('lit', s.torchOn);
    torch.querySelector('img').src = s.torchOn ? 'hud/torch_on.png' : 'hud/torch.png';
    if (joyId === null) idleJoy();
  }
  idleJoy();
  refresh();

  return {
    move,
    update,
    get lift() { return lift; },
  };
}
