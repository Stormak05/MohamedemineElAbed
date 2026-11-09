import * as THREE from 'three';

// Puts the HUD on the game's "cathode ray tube". The HUD stays in the DOM, which main.js keeps updating, but hidden: its
// elements are copied onto a canvas and drawn through a shader that bends and scans them exactly like the game's image
// (same uniforms as post.js). The picture is low resolution, so the HUD gets its own full-resolution layer to stay legible.

const ROOTS = ['hud', 'crosshair', 'prompt', 'bubbles', 'toast'];
const COPY_EVERY = 1 / 20; // seconds between two looks at the DOM

const FRAGMENT = /* glsl */`
  uniform sampler2D tHud;
  uniform vec2 uTexel;
  uniform vec4 uCalm;
  uniform float uTime, uLoss, uPulse, uBlack, uAberration, uBarrel, uGrain, uScan, uLines, uFx;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec4 split(vec2 uv, vec2 dir) {
    vec4 r = texture2D(tHud, uv + dir), g = texture2D(tHud, uv), b = texture2D(tHud, uv - dir);
    return vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
  }
  void main() {
    // Same lens as NightShader, so the HUD sits on the same glass as the picture.
    vec2 cc = vUv - 0.5;
    float r2 = dot(cc, cc);
    vec2 uv = 0.5 + cc * (1.0 + uBarrel * r2 * 4.0) * (1.0 - uBarrel * 0.45);
    float s = uLoss * uLoss;
    uv.x += sin(uv.y * 9.0 + uTime * 2.1) * 0.005 * s;
    uv.y += sin(uv.x * 7.0 - uTime * 1.6) * 0.004 * s;
    uv = 0.5 + (uv - 0.5) * (1.0 - 0.02 * s * sin(uTime * 0.9));

    // The dialogue panel keeps the lens but sheds most of the fringes and scanlines: its text must stay easy to read.
    float calm = step(uCalm.x, uv.x) * step(uv.x, uCalm.z) * step(uCalm.y, uv.y) * step(uv.y, uCalm.w) * 0.8;

    vec2 dir = (1.0 - calm) * (cc * (uAberration + 0.012 * s + 0.006 * uPulse) + vec2(0.0003, 0.0)) * uFx;
    vec4 c = split(uv, dir);
    float dbl = smoothstep(0.45, 1.0, uLoss) * (0.5 + 0.5 * sin(uTime * 0.7)) * (1.0 - calm);
    vec2 off = vec2(0.012 + 0.01 * sin(uTime * 1.3), 0.004 * sin(uTime * 0.9)) * dbl;
    c = mix(c, split(uv + off, dir), 0.42 * dbl);

    // Phosphor glow around what is lit.
    vec4 glow = vec4(0.0);
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      glow += texture2D(tHud, uv + vec2(cos(a), sin(a)) * uTexel * 3.0);
    }
    glow *= 0.125 * uFx;
    // Dim parts are lifted to stay readable; the glow only spills around what is lit, never over it.
    float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    c.rgb = c.rgb * mix(1.0, mix(1.35, 0.92, smoothstep(0.2, 0.75, lum)), uFx) + glow.rgb * 0.45 * (1.0 - c.a);
    c.a = max(c.a, glow.a * 0.45);

    // Scanlines on the rows of the picture, a faint shadow mask, a slow flicker, grain.
    float row = mod(floor(vUv.y * uLines), 2.0);
    float scan = 1.0 - uScan * row * uFx * (1.0 - calm);
    float px = mod(gl_FragCoord.x, 3.0);
    vec3 mask = mix(vec3(1.0), vec3(px < 1.0 ? 1.08 : 0.94, px >= 1.0 && px < 2.0 ? 1.08 : 0.94, px >= 2.0 ? 1.08 : 0.94), uFx);
    float flicker = 1.0 - 0.025 * uFx * (0.5 + 0.5 * sin(uTime * 61.0));
    c.rgb *= scan * mask * flicker;
    c.rgb += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 113.0) - 0.5) * (uGrain + 0.07 * uLoss) * c.a * uFx * (1.0 - calm);
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) c = vec4(0.0);
    gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a) * (1.0 - uBlack);
  }`;

const images = new Map();
function imageOf(src) {
  if (!images.has(src)) { const im = new Image(); im.src = src; images.set(src, im); }
  const im = images.get(src);
  return im.complete && im.naturalWidth ? im : null;
}
const urlOf = (css) => css.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
const px = (v) => parseFloat(v) || 0;
const CLEAR = 'rgba(0, 0, 0, 0)';

// Reads the DOM as a list of drawing commands. `sig` says what they look like, to skip work when nothing moved.
function collect(el, alpha, out) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none') return;
  const a = alpha * parseFloat(cs.opacity);
  if (a <= 0.003) return;
  const b = el.getBoundingClientRect();
  const k = el.offsetWidth ? b.width / el.offsetWidth : 1; // the touch layout scales the HUD down
  const paint = cs.filter !== 'none' ? { filter: cs.filter } : {};
  const push = (sig, fn) => { out.sig.push(sig); out.list.push({ a, ...paint, fn }); };

  if (cs.backgroundColor !== CLEAR && cs.backgroundImage === 'none') {
    const rad = px(cs.borderTopLeftRadius) * k;
    push(`f${b.x},${b.y},${b.width},${b.height},${cs.backgroundColor},${rad}`, (x) => {
      x.fillStyle = cs.backgroundColor; x.beginPath(); x.roundRect(b.x, b.y, b.width, b.height, cs.borderTopLeftRadius.endsWith('%') ? Math.min(b.width, b.height) / 2 : rad); x.fill();
    });
  }
  if (cs.backgroundImage !== 'none') {
    const src = urlOf(cs.backgroundImage), im = src && imageOf(src), tint = cs.backgroundColor;
    if (im) push(`i${src},${b.x},${b.y},${b.width},${b.height},${tint}`, (x) => paintBackground(x, im, b, tint, cs.backgroundSize));
    else out.waiting = true;
  }
  const edge = px(cs.borderTopWidth) * k;
  if (cs.borderImageSource !== 'none') {
    const src = urlOf(cs.borderImageSource), im = src && imageOf(src);
    if (im) push(`b${src},${b.x},${b.y},${b.width},${b.height}`, (x) => nineSlice(x, im, b, cs, k));
    else out.waiting = true;
  } else if (edge > 0 && cs.borderTopStyle !== 'none') {
    const rad = px(cs.borderTopLeftRadius) * k;
    push(`l${b.x},${b.y},${b.width},${b.height},${cs.borderTopColor},${edge}`, (x) => {
      x.strokeStyle = cs.borderTopColor; x.lineWidth = edge; x.setLineDash(cs.borderTopStyle === 'dashed' ? [edge * 3, edge * 2] : []);
      x.beginPath(); x.roundRect(b.x + edge / 2, b.y + edge / 2, b.width - edge, b.height - edge, cs.borderTopLeftRadius.endsWith('%') ? Math.min(b.width, b.height) / 2 : rad); x.stroke(); x.setLineDash([]);
    });
  }
  if (el.tagName === 'IMG') {
    const im = el.complete && el.naturalWidth ? el : null;
    if (im) push(`m${el.src},${b.x},${b.y},${b.width},${b.height}`, (x) => { x.imageSmoothingEnabled = false; x.drawImage(im, b.x, b.y, b.width, b.height); });
    else out.waiting = true;
  }
  for (const pseudo of ['::before', '::after']) pseudoBox(el, pseudo, b, k, a, paint, out);
  for (const node of el.childNodes) {
    if (node.nodeType === 1) collect(node, a, out);
    else if (node.nodeType === 3 && node.textContent.trim()) textLines(node, cs, k, push);
  }
}

// Small round shapes hung on an element (the thought bubble's trail).
function pseudoBox(el, which, b, k, a, paint, out) {
  const ps = getComputedStyle(el, which);
  if (ps.content === 'none' || ps.display === 'none' || ps.position !== 'absolute') return;
  const w = px(ps.width) * k, h = px(ps.height) * k;
  if (!w || !h) return;
  const edge = px(ps.borderTopWidth) * k;
  const x0 = b.x + px(getComputedStyle(el).borderLeftWidth) * k + px(ps.left) * k, y0 = b.y + px(getComputedStyle(el).borderTopWidth) * k + px(ps.top) * k;
  out.sig.push(`p${x0},${y0},${w},${h}`);
  out.list.push({ a, ...paint, fn: (x) => {
    const rx = w / 2 + edge, ry = h / 2 + edge;
    x.beginPath(); x.ellipse(x0 + rx, y0 + ry, rx - edge / 2, ry - edge / 2, 0, 0, 7);
    x.fillStyle = ps.backgroundColor; x.fill();
    if (edge) { x.strokeStyle = ps.borderTopColor; x.lineWidth = edge; x.stroke(); }
  } });
}

function paintBackground(x, im, b, tint, size) {
  x.imageSmoothingEnabled = false;
  if (size === 'contain') {
    const f = Math.min(b.width / im.width, b.height / im.height), w = im.width * f, h = im.height * f;
    x.drawImage(im, b.x + (b.width - w) / 2, b.y + (b.height - h) / 2, w, h);
    return;
  }
  // Repeated along x at the height of the box, tinted like background-blend-mode: multiply.
  const w = Math.max(1, Math.ceil(b.width)), h = Math.max(1, Math.ceil(b.height));
  const layer = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = c.getContext('2d'); t.imageSmoothingEnabled = false; return [c, t]; };
  const [strip, s] = layer();
  const tw = im.width * (h / im.height);
  for (let i = 0; i < w; i += tw) s.drawImage(im, i, 0, tw, h);
  const [tmp, t] = layer();
  t.drawImage(strip, 0, 0);
  if (tint !== CLEAR) {
    t.globalCompositeOperation = 'multiply'; t.fillStyle = tint; t.fillRect(0, 0, w, h);
    t.globalCompositeOperation = 'destination-in'; t.drawImage(strip, 0, 0);
  }
  x.drawImage(tmp, b.x, b.y, b.width, b.height);
}

function nineSlice(x, im, b, cs, k) {
  x.imageSmoothingEnabled = false;
  const sl = cs.borderImageSlice.split(/\s+/).map(parseFloat).filter(Number.isFinite); // the browser adds "fill" and shortens the list
  const [st, sr, sb, sl4] = [sl[0], sl[1] ?? sl[0], sl[2] ?? sl[0], sl[3] ?? sl[1] ?? sl[0]];
  const [t, r, bo, l] = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map((v) => px(v) * k);
  const W = im.width, H = im.height, mw = W - sl4 - sr, mh = H - st - sb, iw = b.width - l - r, ih = b.height - t - bo;
  const part = (sx, sy, sw, sh, dx, dy, dw, dh) => { if (sw > 0 && sh > 0 && dw > 0 && dh > 0) x.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh); };
  part(0, 0, sl4, st, b.x, b.y, l, t); part(sl4, 0, mw, st, b.x + l, b.y, iw, t); part(W - sr, 0, sr, st, b.x + b.width - r, b.y, r, t);
  part(0, st, sl4, mh, b.x, b.y + t, l, ih); part(sl4, st, mw, mh, b.x + l, b.y + t, iw, ih); part(W - sr, st, sr, mh, b.x + b.width - r, b.y + t, r, ih);
  part(0, H - sb, sl4, sb, b.x, b.y + b.height - bo, l, bo); part(sl4, H - sb, mw, sb, b.x + l, b.y + b.height - bo, iw, bo); part(W - sr, H - sb, sr, sb, b.x + b.width - r, b.y + b.height - bo, r, bo);
}

// One command per line of text, as the browser laid it out.
function textLines(node, cs, k, push) {
  const text = node.textContent, range = document.createRange();
  const lines = [];
  for (const m of text.matchAll(/\S+\s*/g)) {
    range.setStart(node, m.index); range.setEnd(node, m.index + m[0].trimEnd().length);
    const r = range.getBoundingClientRect();
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - r.y) < 2) { last.text += m[0]; last.h = Math.max(last.h, r.height); } else lines.push({ text: m[0], x: r.x, y: r.y, h: r.height });
  }
  const size = px(cs.fontSize) * k;
  const font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
  const shadow = cs.textShadow !== 'none' ? cs.textShadow.match(/(rgba?\([^)]*\)|#\w+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/) : null;
  for (const l of lines) {
    const line = l.text.trimEnd();
    push(`t${line},${l.x},${l.y},${font},${cs.color}`, (x) => {
      x.font = font; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
      if ('letterSpacing' in x) x.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      const mt = x.measureText('Hg');
      const base = l.y + (l.h + mt.fontBoundingBoxAscent - mt.fontBoundingBoxDescent) / 2;
      if (shadow) { x.shadowColor = shadow[1]; x.shadowOffsetX = +shadow[2]; x.shadowOffsetY = +shadow[3]; x.shadowBlur = +shadow[4]; }
      // A dark edge: the shader's glow and scanlines would otherwise melt light text on a bright surface.
      if (shadow) { x.lineJoin = 'round'; x.lineWidth = Math.max(2, size * 0.16); x.strokeStyle = 'rgba(0, 0, 0, 0.8)'; x.strokeText(line, l.x, base); }
      x.fillStyle = cs.color; x.fillText(line, l.x, base);
      // Thin glyphs would dissolve in the colour fringes: thicken them a little.
      x.lineJoin = 'round'; x.lineWidth = size * 0.055; x.strokeStyle = cs.color; x.strokeText(line, l.x, base);
      x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetX = x.shadowOffsetY = 0;
    });
  }
}

export function createHudScreen(nightUniforms, gameCanvas) {
  const el = document.createElement('canvas');
  el.id = 'hudScreen';
  Object.assign(el.style, { position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 8, pointerEvents: 'none' });
  document.body.append(el);
  const style = document.createElement('style');
  style.textContent = ROOTS.map((id) => `#${id}`).join(', ') + ' { visibility: hidden !important; }';
  document.head.append(style);

  const renderer = new THREE.WebGLRenderer({ canvas: el, alpha: true, premultipliedAlpha: true, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const page = document.createElement('canvas');
  const ctx = page.getContext('2d');
  const texture = new THREE.CanvasTexture(page);
  texture.premultiplyAlpha = true;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  const n = nightUniforms;
  const uniforms = {
    tHud: { value: texture }, uTexel: { value: new THREE.Vector2() }, uCalm: { value: new THREE.Vector4(2, 2, 2, 2) }, uScan: { value: 0.3 }, uLines: { value: 270 }, uFx: { value: 1 },
    uTime: n.uTime, uLoss: n.uLoss, uPulse: n.uPulse, uBlack: n.uBlack, uAberration: n.uAberration, uBarrel: n.uBarrel, uGrain: n.uGrain,
  };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms, transparent: false, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FRAGMENT,
  })));

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    page.width = w; page.height = h;
    texture.dispose();
    uniforms.uTexel.value.set(1 / w, 1 / h);
    last = '';
  }
  let last = '', wait = 0, empty = true;
  addEventListener('resize', resize);
  resize();

  function copyDom() {
    const out = { sig: [], list: [], waiting: false };
    for (const id of ROOTS) { const root = document.getElementById(id); if (root) collect(root, 1, out); }
    const panel = document.querySelector('#bubbles .bubble')?.getBoundingClientRect();
    if (panel) uniforms.uCalm.value.set((panel.left - 14) / innerWidth, 1 - (panel.bottom + 52) / innerHeight, panel.right / innerWidth, 1 - (panel.top - 20) / innerHeight); // name tag and puffs included
    else uniforms.uCalm.value.set(2, 2, 2, 2);
    const sig = out.sig.join('|');
    empty = out.list.length === 0;
    if (sig === last && !out.waiting) return;
    last = out.waiting ? '' : sig;
    ctx.clearRect(0, 0, page.width, page.height);
    for (const c of out.list) {
      ctx.save();
      ctx.globalAlpha = c.a;
      if (c.filter && 'filter' in ctx) ctx.filter = c.filter;
      c.fn(ctx);
      ctx.restore();
    }
    texture.needsUpdate = true;
  }

  return {
    // fx: false when the player turned the retro effects off (the HUD then stays straight and clean).
    update(dt, fx) {
      wait -= dt;
      if (wait <= 0) { wait = COPY_EVERY; copyDom(); }
      uniforms.uFx.value = fx ? 1 : 0;
      uniforms.uLines.value = gameCanvas.height || 270;
      uniforms.uScan.value = Math.min(0.35, n.uScanlines.value + 0.12);
      if (empty) { renderer.clear(); return; }
      renderer.render(scene, camera);
    },
  };
}
