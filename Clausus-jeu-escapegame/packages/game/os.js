import * as THREE from 'three';

// MEDISYS 3.1: a tiny OS drawn on a canvas. The same canvas is the in-world screen texture
// and, when the player sits at the computer, a sharp interactive overlay (see main.js).
export const OS_W = 640, OS_H = 480;
const FONT = '"Courier New", Courier, monospace';
const C = {
  desk: '#1d4a47', deskDark: '#163a38', win: '#c9c6b8', winDark: '#8a877a', winLight: '#f2efe2',
  title: '#21483a', titleText: '#e8f2dc', text: '#1a1a1a', red: '#9c2a24', green: '#2f7a3c', ink: '#23324f',
};

// Two machines run MEDISYS (énigmes 2 and 4, see histoire.js):
// - archives: no session, a file explorer over the patients' files (the player looks for his own: room 104, patient 27);
// - securite: the decryption program of the electronic locker, with three mistakes to correct before « Tester ».
import { ARCHIVES, CIPHER, PROFILES } from './histoire.js';
// The last one is a voice of the HAL sheet (voix.js): main.js flashes and says these when the player sits at the screen.
const GLITCH = ['TU N\'ES PAS MALADE ?', 'RETOURNE TE COUCHER', 'ILS TE REGARDENT', 'PERSONNE NE VIENDRA', 'RESTE', 'IL NE SORTIRA JAMAIS'];

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export class MiniOS {
  // profile: 'archives' | 'securite'. onRead(id): a file read (the player's own). onUnlock(): the locker opens.
  constructor({ audio, profile, onRead, onUnlock, onError, onGlitch }) {
    this.audio = audio; this.pos = null; this.onRead = onRead; this.onUnlock = onUnlock; this.onError = onError; this.onGlitch = onGlitch;
    this.profile = PROFILES[profile];
    this.icons = ICONS.filter((ic) => this.profile.icons.includes(ic.id));
    this.canvas = document.createElement('canvas');
    this.canvas.width = OS_W; this.canvas.height = OS_H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.state = 'off';
    this.active = false;
    this.mouse = { x: OS_W / 2, y: OS_H / 2 };
    this.windows = [];
    this.drag = null;
    this.startMenu = false;
    this.unlocked = false;
    this.bootStart = 0; this.glitchUntil = 0; this.glitchText = ''; this.nextGlitch = 0;
    this.sanityLoss = 0;
    this.lastDraw = -1;
    this.clockMinutes = 3 * 60 + 17;
    this.draw(0);
  }

  // Only durable app state: no callbacks, active animations or error/unlock replay on restore.
  snapshot() {
    return { on: this.state !== 'off', windows: this.windows.map((w) => ({ id: w.id, data: w.snapshot?.() })) };
  }
  restore(d) {
    if (!d || typeof d !== 'object') return;
    this.state = d.on === true ? 'desktop' : 'off';
    this.fanStart = d.on === true; // a switched-on PC hums again once the sound is running (update)
    this.windows = [];
    if (!Array.isArray(d.windows)) return;
    for (const saved of d.windows.slice(0, this.icons.length)) {
      if (!saved || !this.profile.icons.includes(saved.id) || !APPS[saved.id] || this.windows.some((w) => w.id === saved.id)) continue;
      const w = APPS[saved.id](this), n = this.windows.length;
      w.id = saved.id; w.x = 110 + n * 22; w.y = 22 + n * 18;
      w.restore?.(saved.data);
      this.windows.push(w);
    }
  }

  // Only the foreground document counts; browsing folders and solving the cipher keep time running.
  get reading() {
    return this.state === 'desktop' && this.windows.at(-1)?.reading === true;
  }

  // ---------- Lifecycle ----------
  setActive(a, t) {
    this.active = a;
    if (a && this.state === 'off') this.wake(t);
  }
  // The fans start with the first boot and keep running afterwards (a later wake-up does not add a second loop).
  wake(t) {
    this.state = 'boot'; this.bootStart = t;
    this.audio.pcBoot(this.pos, !this.fanOn);
    this.fanOn = true;
  }

  // ---------- Input ----------
  pointer(x, y) {
    this.mouse.x = Math.max(0, Math.min(OS_W - 1, x));
    this.mouse.y = Math.max(0, Math.min(OS_H - 1, y));
    if (this.drag) {
      const w = this.drag.win;
      w.x = Math.max(-w.w + 60, Math.min(OS_W - 60, this.mouse.x - this.drag.dx));
      w.y = Math.max(0, Math.min(OS_H - 50, this.mouse.y - this.drag.dy));
    }
  }
  up() { this.drag = null; if (this.pressed) this.audio.mouseUp(); this.pressed = false; }
  down() {
    this.audio.mouseClick(); this.pressed = true;
    const { x, y } = this.mouse;
    // Asleep: a click wakes the screen up, the open windows are still there.
    if (this.state === 'off' && this.active) { this.wake(this.t ?? this.lastDraw); return; }
    if (this.state !== 'desktop') return;
    // Start menu.
    if (this.startMenu) {
      this.startMenu = false;
      if (x < 160 && y > OS_H - 24 - 52 && y < OS_H - 24) {
        if (y < OS_H - 24 - 26) this.windows = [];
        else this.state = 'off'; // « Mettre en veille »
        return;
      }
    }
    if (y > OS_H - 24) { if (x < 84) this.startMenu = !this.startMenu; return; }
    // Windows, top-most first.
    for (let i = this.windows.length - 1; i >= 0; i--) {
      const w = this.windows[i];
      if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) {
        this.windows.splice(i, 1); this.windows.push(w);
        if (y < w.y + 20) {
          if (x > w.x + w.w - 20) { this.windows.pop(); return; }
          this.drag = { win: w, dx: x - w.x, dy: y - w.y };
          return;
        }
        w.click?.(x - w.x - 6, y - w.y - 24);
        return;
      }
    }
    // Desktop icons.
    this.icons.forEach((ic, i) => {
      const ix = 18, iy = 16 + i * 72;
      if (x >= ix && x < ix + 64 && y >= iy && y < iy + 62) this.open(ic.id);
    });
  }
  key(e) {
    const top = this.windows[this.windows.length - 1];
    top?.key?.(e);
    this.audio.key(e.key);
  }

  // ---------- Windows ----------
  open(id) {
    const existing = this.windows.find((w) => w.id === id);
    if (existing) { this.windows.splice(this.windows.indexOf(existing), 1); this.windows.push(existing); return; }
    const n = this.windows.length;
    this.audio.pcSeek(this.pos);
    const w = APPS[id](this);
    w.id = id; w.x = 110 + n * 22; w.y = 22 + n * 18;
    this.windows.push(w);
  }

  // ---------- Drawing ----------
  bevel(x, y, w, h, inset = false) {
    const c = this.ctx;
    c.fillStyle = C.win; c.fillRect(x, y, w, h);
    c.fillStyle = inset ? C.winDark : C.winLight; c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, h);
    c.fillStyle = inset ? C.winLight : C.winDark; c.fillRect(x, y + h - 2, w, 2); c.fillRect(x + w - 2, y, 2, h);
  }
  button(x, y, w, h, label, hot = false) {
    const c = this.ctx;
    const over = this.mouse.x >= x && this.mouse.x < x + w && this.mouse.y >= y && this.mouse.y < y + h;
    this.bevel(x, y, w, h, false);
    if (over || hot) { c.fillStyle = 'rgba(33,72,58,0.15)'; c.fillRect(x + 2, y + 2, w - 4, h - 4); }
    c.fillStyle = C.text; c.font = `bold 13px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(label, x + w / 2, y + h / 2 + 1);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  }
  text(s, x, y, { size = 13, color = C.text, bold = false } = {}) {
    const c = this.ctx;
    c.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; c.fillStyle = color; c.fillText(s, x, y);
  }

  draw(t) {
    const c = this.ctx;
    c.textBaseline = 'alphabetic';
    if (this.state === 'off') {
      c.fillStyle = '#0b120f'; c.fillRect(0, 0, OS_W, OS_H);
      this.text('MEDISYS 3.1', 250, 220, { color: '#2f6a50', bold: true, size: 18 });
      this.text(`${this.profile.name} - en veille`, 320 - this.profile.name.length * 4 - 40, 250, { color: '#2a5040' });
    } else if (this.state === 'boot') this.drawBoot(t);
    else this.drawDesktop(t);
    if (this.active && this.state !== 'boot') this.drawCursor();
    this.drawGlitch(t);
    this.texture.needsUpdate = true;
  }

  drawBoot(t) {
    const c = this.ctx, k = t - this.bootStart;
    c.fillStyle = '#060a08'; c.fillRect(0, 0, OS_W, OS_H);
    const lines = ['MEDISYS BIOS v1.07  (c) 1989', 'Mémoire : 640 Ko ... OK', 'Disque C: ... OK', '', 'Chargement de MEDISYS 3.1 ...', 'Réseau de l\'établissement ... DÉGRADÉ', `C.H.S. Les Tilleuls - ${this.profile.name}`];
    lines.slice(0, Math.floor(k * 3.2)).forEach((l, i) => this.text(l, 24, 40 + i * 22, { color: '#9fd8a8' }));
    if (Math.sin(t * 8) > 0) this.text('_', 24, 40 + Math.min(lines.length, Math.floor(k * 3.2)) * 22, { color: '#9fd8a8' });
    if (k > 2.8) { this.state = 'desktop'; this.audio.ok(); }
  }

  drawDesktop(t) {
    const c = this.ctx;
    c.fillStyle = C.desk; c.fillRect(0, 0, OS_W, OS_H);
    for (let y = 0; y < OS_H; y += 4) { c.fillStyle = C.deskDark; c.fillRect(0, y, OS_W, 1); }
    this.text('C.H.S. LES TILLEULS', 430, 440, { color: '#2f6560', bold: true, size: 14 });
    this.text(this.profile.name.toUpperCase(), 430, 422, { color: '#2f6560', bold: true, size: 12 });
    this.icons.forEach((ic, i) => {
      const ix = 18, iy = 16 + i * 72;
      ic.draw(c, ix + 16, iy);
      c.font = `bold 12px ${FONT}`; c.fillStyle = '#e8f2dc'; c.textAlign = 'center';
      c.fillText(ic.label, ix + 32, iy + 54); c.textAlign = 'left';
    });
    for (const w of this.windows) this.drawWindow(w, t);
    // Taskbar.
    this.bevel(0, OS_H - 24, OS_W, 24);
    this.button(3, OS_H - 22, 80, 20, 'Démarrer', this.startMenu);
    this.windows.forEach((w, i) => { this.bevel(90 + i * 96, OS_H - 22, 92, 20, i === this.windows.length - 1); this.text(w.title.slice(0, 10), 96 + i * 96, OS_H - 8, { size: 11 }); });
    this.bevel(OS_W - 70, OS_H - 22, 66, 20, true);
    const m = this.clockMinutes + Math.floor(t / 60);
    this.text(`${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, OS_W - 58, OS_H - 8);
    if (this.startMenu) {
      this.bevel(0, OS_H - 24 - 52, 160, 52);
      this.text('Se déconnecter', 12, OS_H - 24 - 32);
      this.text('Mettre en veille', 12, OS_H - 24 - 8);
    }
  }

  drawWindow(w, t) {
    const c = this.ctx;
    this.bevel(w.x, w.y, w.w, w.h);
    c.fillStyle = this.windows[this.windows.length - 1] === w ? C.title : '#5d6b62';
    c.fillRect(w.x + 3, w.y + 3, w.w - 6, 17);
    this.text(w.title, w.x + 8, w.y + 16, { color: C.titleText, bold: true });
    this.button(w.x + w.w - 19, w.y + 4, 15, 14, 'x');
    c.save();
    c.beginPath(); c.rect(w.x + 3, w.y + 22, w.w - 6, w.h - 25); c.clip();
    w.draw(c, w.x + 6, w.y + 24, w.w - 12, w.h - 30, t);
    c.restore();
  }

  drawCursor() {
    const c = this.ctx, { x, y } = this.mouse;
    const pts = [[0, 0], [0, 15], [4, 11], [7, 17], [9, 16], [6, 10], [11, 10]];
    c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(x + px, y + py) : c.moveTo(x + px, y + py))); c.closePath();
    c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1; c.stroke();
  }

  drawGlitch(t) {
    if (this.state === 'off') return;
    if (this.sanityLoss > 0.55 && t > this.nextGlitch) {
      this.glitchUntil = t + 0.25 + Math.random() * 0.35;
      this.nextGlitch = t + 3 + Math.random() * (10 - this.sanityLoss * 7);
      this.glitchText = GLITCH[Math.floor(Math.random() * GLITCH.length)];
      this.onGlitch?.(this.glitchText);
    }
    if (t > this.glitchUntil) return;
    const c = this.ctx;
    for (let i = 0; i < 8; i++) {
      const y = Math.random() * OS_H, h = 2 + Math.random() * 14;
      c.drawImage(this.canvas, 0, y, OS_W, h, (Math.random() - 0.5) * 40, y, OS_W, h);
    }
    c.fillStyle = 'rgba(120,0,0,0.25)'; c.fillRect(0, 0, OS_W, OS_H);
    c.font = `bold 34px ${FONT}`; c.fillStyle = '#e8d8d0'; c.textAlign = 'center';
    c.fillText(this.glitchText, OS_W / 2 + (Math.random() - 0.5) * 6, OS_H / 2);
    c.textAlign = 'left';
  }

  update(t, sanityLoss) {
    this.sanityLoss = sanityLoss;
    if (this.fanStart && !this.fanOn && this.audio.ac) { this.fanStart = false; this.fanOn = true; this.audio.pcFan?.(this.pos); }
    // Full rate while in use, a few frames per second otherwise.
    this.t = t;
    if (this.active || t - this.lastDraw > 0.2 || t < this.glitchUntil) { this.lastDraw = t; this.draw(t); }
  }
}

// ---------- Desktop icons ----------
const folderIcon = (c, x, y) => { c.fillStyle = '#d8b04a'; c.fillRect(x, y + 4, 14, 6); c.fillRect(x, y + 8, 32, 22); c.fillStyle = '#a8842e'; c.fillRect(x, y + 28, 32, 2); };
const pageIcon = (c, x, y) => { c.fillStyle = '#f0ece0'; c.fillRect(x + 4, y, 24, 30); c.fillStyle = '#556'; for (let i = 0; i < 6; i++) c.fillRect(x + 8, y + 5 + i * 4, 16, 1); };
const ICONS = [
  { id: 'files', label: 'Archives', draw: folderIcon },
  { id: 'cipher', label: 'Déchiffre', draw: (c, x, y) => { c.fillStyle = '#20302a'; c.fillRect(x, y + 2, 32, 26); c.fillStyle = '#9fd8a8'; c.font = 'bold 11px monospace'; c.fillText('C:\\>', x + 3, y + 14); c.fillRect(x + 3, y + 19, 8, 2); } },
  { id: 'readme', label: 'Lisez-moi', draw: pageIcon },
  { id: 'trash', label: 'Corbeille', draw: (c, x, y) => { c.fillStyle = '#9aa0a0'; c.fillRect(x + 6, y + 6, 20, 24); c.fillRect(x + 3, y + 3, 26, 4); c.fillStyle = '#6a7070'; for (let i = 0; i < 3; i++) c.fillRect(x + 10 + i * 6, y + 10, 2, 16); } },
];

// ---------- Applications ----------
const APPS = {
  // File explorer: folders, then a text file. The player's own file triggers onRead.
  files: (os) => {
    const path = [ARCHIVES];
    let file = null;
    const scroll = 0;
    const here = () => path[path.length - 1];
    const rows = () => [...(path.length > 1 ? [{ name: '..', up: true }] : []), ...here().children];
    return {
      title: 'Archives patients', w: 470, h: 330,
      snapshot: () => ({ path: path.slice(1).map((p) => p.name), file: file?.name }),
      restore(d) {
        if (!d || typeof d !== 'object') return;
        if (Array.isArray(d.path)) for (const name of d.path.slice(0, 10)) {
          const folder = here().children.find((e) => e.name === name && e.children);
          if (!folder) break;
          path.push(folder);
        }
        file = here().children.find((e) => e.name === d.file && !e.children) ?? null;
      },
      get reading() { return file !== null; },
      draw(c, x, y, w, h, t) {
        c.fillStyle = '#fff'; c.fillRect(x, y, w, h);
        c.fillStyle = '#e4e0d0'; c.fillRect(x, y, w, 20);
        os.text(file ? `${path.map((p) => p.name).join('\\')}\\${file.name}` : path.map((p) => p.name).join('\\'), x + 6, y + 14, { size: 12, bold: true });
        if (file) {
          os.button(x + w - 74, y + 24, 68, 20, '< Retour');
          c.font = `12px ${FONT}`;
          let body = file.text;
          if (file.own && os.sanityLoss > 0.5 && Math.sin(t * 1.7) > 0.7) body = 'IL NE SORTIRA JAMAIS. IL NE SORTIRA JAMAIS. IL NE SORTIRA JAMAIS.';
          wrap(c, body, w - 16).forEach((l, i) => os.text(l, x + 8, y + 62 + i * 16, { size: 12, color: body !== file.text ? C.red : C.text }));
          return;
        }
        const list = rows();
        list.slice(scroll, scroll + 13).forEach((e, i) => {
          const ry = y + 24 + i * 22;
          if (os.active && os.mouse.y >= ry && os.mouse.y < ry + 22 && os.mouse.x >= x && os.mouse.x < x + w) { c.fillStyle = '#d6e4dc'; c.fillRect(x, ry, w, 22); }
          if (e.up || e.children) { c.fillStyle = '#d8b04a'; c.fillRect(x + 8, ry + 4, 7, 3); c.fillRect(x + 8, ry + 6, 18, 12); }
          else { c.fillStyle = '#d8d2bc'; c.fillRect(x + 10, ry + 3, 13, 16); c.fillStyle = '#556'; c.fillRect(x + 12, ry + 7, 9, 1); c.fillRect(x + 12, ry + 11, 9, 1); c.fillRect(x + 12, ry + 15, 6, 1); }
          os.text(e.up ? '.. (dossier parent)' : e.name, x + 44, ry + 16, { size: 13 });
          if (e.note) os.text(e.note, x + 250, ry + 16, { size: 11, color: '#666' });
        });
      },
      click(mx, my) {
        if (file) { if (my >= 24 && my < 44 && mx >= 470 - 12 - 74) file = null; return; }
        if (my < 24) return;
        const i = Math.floor((my - 24) / 22) + scroll;
        const e = rows()[i];
        if (!e) return;
        if (e.up) path.pop();
        else if (e.children) path.push(e);
        else { file = e; if (e.read) os.onRead?.(e.read); }
      },
    };
  },
  // The locker's decryption program: three faulty spots, each cycles through its variants; « Tester » runs it.
  cipher: (os) => {
    const pick = CIPHER.spots.map(() => 0);
    let run = null, hits = [];
    return {
      title: 'DECHIFFRE.ALG', w: 560, h: 380,
      snapshot: () => ({ pick: [...pick] }),
      restore(d) {
        if (Array.isArray(d?.pick)) CIPHER.spots.forEach((spot, i) => {
          const value = d.pick[i];
          if (Number.isInteger(value) && value >= 0 && value < spot.options.length) pick[i] = value;
        });
      },
      draw(c, x, y, w, h, t) {
        hits = [];
        c.fillStyle = '#0d1a14'; c.fillRect(x, y, w, h);
        c.font = `13px ${FONT}`;
        CIPHER.lines.forEach((parts, i) => {
          let px = x + 10;
          const py = y + 18 + i * 18;
          parts.forEach((p) => {
            const s = typeof p === 'number' ? CIPHER.spots[p].options[pick[p]] : p;
            c.font = `13px ${FONT}`;
            const pw = c.measureText(s).width;
            if (typeof p === 'number') {
              const over = os.active && os.mouse.x >= px - 2 && os.mouse.x < px + pw + 2 && os.mouse.y >= py - 12 && os.mouse.y < py + 4;
              c.fillStyle = over ? '#4a4a20' : '#2e3a20'; c.fillRect(px - 2, py - 12, pw + 4, 16);
              c.strokeStyle = '#c8b040'; c.strokeRect(px - 2.5, py - 12.5, pw + 5, 17);
              hits.push({ x: px - 2 - x, y: py - 12 - y, w: pw + 4, h: 16, n: p });
            }
            os.text(s, px, py, { color: typeof p === 'number' ? '#f0e090' : '#9fd8a8' });
            px += pw;
          });
        });
        os.text('Cliquer sur un passage encadré pour le modifier.', x + 10, y + 206, { size: 11, color: '#6fa880' });
        os.button(x + w - 110, y + 192, 100, 24, 'Tester');
        c.fillStyle = '#060c09'; c.fillRect(x + 6, y + 222, w - 12, h - 228);
        if (!run) { os.text('> _', x + 14, y + 242, { color: '#6fa880' }); return; }
        const k = Math.floor((t - run.t0) / 0.32);
        run.trace.slice(0, k).forEach((l, i) => os.text(l, x + 14 + Math.floor(i / 4) * 250, y + 242 + (i % 4) * 16, { size: 12, color: '#9fd8a8' }));
        if (k >= run.trace.length) {
          os.text(run.msg, x + 14, y + h - 14, { bold: true, color: run.ok ? '#6fe080' : '#e07060' });
          if (!run.done) {
            run.done = true;
            if (run.ok) { os.audio.ok(); os.onUnlock?.(); } else { os.audio.buzz(); os.onError?.('cipher'); }
          }
        }
      },
      click(mx, my) {
        if (mx > 560 - 12 - 110 && my >= 192 && my < 216) {
          if (run && !run.done) return;
          const r = CIPHER.run(pick);
          run = { ...r, t0: os.t ?? 0, done: false };
          os.audio.beep(); os.audio.pcSeek(os.pos);
          return;
        }
        const hit = hits.find((b) => mx >= b.x && mx < b.x + b.w && my >= b.y && my < b.y + b.h);
        if (hit) { pick[hit.n] = (pick[hit.n] + 1) % CIPHER.spots[hit.n].options.length; os.audio.key(); run = null; }
      },
    };
  },
  readme: (os) => ({
    title: 'LISEZ-MOI.TXT', w: 440, h: 290, reading: true,
    draw(c, x, y, w) {
      c.fillStyle = '#fff'; c.fillRect(x, y, w, 300);
      c.font = `12px ${FONT}`;
      wrap(c, os.profile.readme, w - 16).forEach((l, i) => os.text(l, x + 8, y + 18 + i * 16, { size: 12 }));
    },
  }),
  trash: (os) => {
    let open = false;
    return {
      title: 'Corbeille', w: 380, h: 210,
      get reading() { return open; },
      draw(c, x, y, w) {
        c.fillStyle = '#fff'; c.fillRect(x, y, w, 24);
        os.text(os.profile.trash[0], x + 6, y + 16);
        if (!open) return;
        c.font = `12px ${FONT}`;
        wrap(c, os.profile.trash[1], w - 12).forEach((l, i) => os.text(l, x + 6, y + 44 + i * 16, { size: 12 }));
      },
      click(mx, my) { if (my < 24) open = true; },
    };
  },
};
