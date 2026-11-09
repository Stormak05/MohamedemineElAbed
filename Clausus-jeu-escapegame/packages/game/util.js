import * as THREE from 'three';

let seed = 3170402;
export const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const smooth = (t) => t * t * (3 - 2 * t);

// Small canvas painted pixel by pixel, used as a nearest-filtered texture.
export function pixelTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const px = (x, y, col) => { ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; ctx.fillRect(x, y, 1, 1); };
  const rect = (x, y, rw, rh, col, amp = 0) => {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) {
      const n = Math.round((rnd() * 2 - 1) * amp);
      px(xx, yy, [col[0] + n, col[1] + n, col[2] + n]);
    }
  };
  const grime = (count, maxR, strength) => {
    for (let i = 0; i < count; i++) {
      const cx = rnd() * w, cy = rnd() * h, r = 1 + rnd() * maxR;
      ctx.fillStyle = `rgba(30,24,14,${strength * (0.4 + rnd() * 0.6)})`;
      for (let k = 0; k < r * r; k++) {
        const a = rnd() * 6.283, d = Math.sqrt(rnd()) * r;
        ctx.fillRect(Math.floor(cx + Math.cos(a) * d), Math.floor(cy + Math.sin(a) * d), 1, 1);
      }
    }
  };
  draw({ ctx, px, rect, grime, w, h });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const mat = (opts) => new THREE.MeshLambertMaterial(opts);

function shadowed(o, cast = true) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = true; } });
  return o;
}
export function box(parent, w, h, d, material, x, y, z) {
  const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Text drawn on a canvas, for signs, labels and documents.
export function canvasTexture(w, h, draw, nearest = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  return t;
}
