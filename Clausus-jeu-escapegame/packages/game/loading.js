import * as THREE from 'three';

// Loading screen (#loading in index.html). It is shown by the HTML itself, before any module runs: the first visit
// downloads ~10 MB of models and compiles the shaders, which takes a while.
// Progress: the files loaded through Three (every GLTFLoader uses DefaultLoadingManager) fill the bar up to FILES;
// the rest is for building the scene and compiling the shaders (see step() in main.js).

const FILES = 0.85;
const $ = (id) => document.getElementById(id);
const root = $('loading'), bar = $('loadingBar'), label = $('loadingStep');
let shown = 0, files = 0;

function draw(k) {
  shown = Math.max(shown, Math.min(1, k)); // never goes back, even when new files are discovered
  if (!bar) return;
  root.classList.add('known');
  bar.style.transform = `scaleX(${shown})`;
}

const manager = THREE.DefaultLoadingManager;
manager.onProgress = (_url, loaded, total) => {
  files = total ? loaded / total : 0;
  draw(files * FILES);
};

export const loading = {
  // A step after the downloads: its label, and where the bar stands once it starts (0..1).
  step(text, k) {
    if (label) label.textContent = text;
    draw(Math.max(k, files * FILES));
  },
  // Fades the screen out (after the first frame is on screen).
  done() {
    if (!root) return;
    draw(1);
    if (label) label.textContent = '';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.add('out');
      setTimeout(() => root.remove(), 900);
    }));
  },
  fail() { root?.remove(); },
};
