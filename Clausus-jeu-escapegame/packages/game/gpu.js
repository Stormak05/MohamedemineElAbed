import { cfg, setCfg } from './config.js';
import { kitCss, skinCss, nine } from './ui-kit.js';

// Is the graphics card really used? Without hardware acceleration the browser either refuses WebGL (recent Chrome
// and Edge) or draws it on the processor (SwiftShader, llvmpipe…), far too slowly for this game.
// This module probes it once, before the renderer exists, lowers the settings when the card is missing, and shows
// the player how to turn hardware acceleration on in their own browser (#gpuNotice).

const LITE_KEY = 'clausus-gpu-lite'; // the settings changed by the lite preset, to put back once the card is there
const MUTE_KEY = 'clausus-gpu-mute'; // "don't warn me again"
const LITE = { shadows: 'off', pixels: 240, dMirror: false };
const SOFTWARE = /swiftshader|llvmpipe|softpipe|lavapipe|software|basic render|microsoft basic|gdi generic/i;

function probe() {
  const context = (opts) => {
    try { return document.createElement('canvas').getContext('webgl2', opts); } catch { return null; }
  };
  // failIfMajorPerformanceCaveat: the browser refuses the context when it would be drawn by the processor.
  let gl = context({ failIfMajorPerformanceCaveat: true });
  let caveat = false;
  if (!gl) { gl = context(); caveat = !!gl; }
  if (!gl) return { webgl: false, software: true, name: '' };
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return { webgl: true, software: caveat || SOFTWARE.test(name), name };
}

// Where hardware acceleration is, browser by browser. Pages may not open these addresses themselves,
// so the player copies the address into the address bar.
function browserGuide() {
  const ua = navigator.userAgent;
  const chromium = (name, scheme) => ({
    name, url: `${scheme}://settings/system`,
    steps: ['Activez « Utiliser l\'accélération graphique si disponible ».', 'Cliquez sur « Relancer » (ou fermez et rouvrez le navigateur).'],
  });
  if (/Edg\//.test(ua)) return chromium('Microsoft Edge', 'edge');
  if (/OPR\/|Opera/.test(ua)) return { ...chromium('Opera', 'opera'), steps: ['Dans Navigateur › Système, activez « Utiliser l\'accélération matérielle si disponible ».', 'Redémarrez Opera.'] };
  if (navigator.brave) return chromium('Brave', 'brave');
  if (/Firefox\//.test(ua)) return {
    name: 'Firefox', url: 'about:preferences#general',
    steps: ['Dans Général › Performances, décochez « Utiliser les paramètres de performance recommandés ».', 'Cochez « Utiliser l\'accélération graphique si disponible ».', 'Redémarrez Firefox.'],
  };
  if (/Chrome\//.test(ua)) return chromium('Google Chrome', 'chrome');
  if (/Safari\//.test(ua)) return { name: 'Safari', url: '', steps: ['Safari utilise toujours la carte graphique : mettez à jour macOS, ou essayez Chrome ou Firefox.'] };
  return { name: 'votre navigateur', url: '', steps: ['Dans ses paramètres, cherchez « accélération matérielle » (ou « graphique ») et activez-la.', 'Redémarrez le navigateur.'] };
}

const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key, value) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ } };

// Lite preset on software rendering, applied once (the player may then change it); undone when the card is back.
function applyLite(software) {
  const saved = read(LITE_KEY);
  if (software && !saved) {
    write(LITE_KEY, JSON.stringify(Object.fromEntries(Object.keys(LITE).map((id) => [id, cfg[id]]))));
    for (const [id, v] of Object.entries(LITE)) setCfg(id, v);
    return true;
  }
  if (!software && saved) {
    try { for (const [id, v] of Object.entries(JSON.parse(saved))) if (cfg[id] === LITE[id]) setCfg(id, v); } catch { /* corrupt */ }
    write(LITE_KEY, null);
  }
  return false;
}

export const gpu = probe();
const lowered = gpu.webgl && applyLite(gpu.software);

// Drawn with the menus' kit (ui-kit.js): the same veil, card and painted buttons as the "information" screen.
const CSS = kitCss('#gpuNotice') + `
#gpuNotice { position: fixed; inset: 0; z-index: 60; font-family: var(--type); color: #e9dfc4; user-select: text; }
#gpuNotice .notice { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(820px, 92vw); max-height: 96vh; overflow-y: auto; box-sizing: border-box; padding: 2vh 38px 2.5vh; text-align: center; background: rgba(26,18,14,0.92); border: 2px solid #2a1c16; border-radius: 4px; }
#gpuNotice h2 { margin: 0 0 1.6vh; font-size: clamp(24px, 5.5vh, 38px); font-weight: normal; letter-spacing: 2px; color: #fff2dc; }
#gpuNotice p { margin: 0 0 1.6vh; font-size: clamp(14px, 2.9vh, 21px); line-height: 1.4; color: #d8ccb0; }
#gpuNotice p.help { font-size: clamp(13px, 2.6vh, 18px); color: #f0c8a8; }
#gpuNotice p.small { font-size: clamp(12px, 2.2vh, 15px); color: #9a7a5a; }
#gpuNotice ol { display: inline-block; margin: 0 0 1.8vh; padding-left: 1.4em; text-align: left; font-size: clamp(14px, 2.7vh, 19px); line-height: 1.45; color: #d8ccb0; }
#gpuNotice li { margin: 0.6vh 0; }
#gpuNotice button.mb.addr { display: block; margin: 0.6vh 0; font-family: 'Courier New', Courier, monospace; font-weight: bold; font-size: 18px; letter-spacing: 0; }
#gpuNotice .copied { display: block; font-size: 15px; color: #f0c8a8; }
#gpuNotice .acts { display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; }
#gpuNotice .acts .mb { min-width: 240px; }
@media (max-height: 520px) { #gpuNotice .notice { padding: 6px 16px 10px; } #gpuNotice h2 { margin: 2px 0 6px; font-size: 24px; } }
`;
let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const tag = Object.assign(document.createElement('style'), { textContent: CSS });
  document.head.append(tag);
  fetch('ui/ui_spec.json').then((r) => (r.ok ? r.json() : null)).then((spec) => {
    if (spec) tag.textContent += skinCss(spec, '#gpuNotice') + nine(spec, '#gpuNotice .notice', 'mode_card', 'mode_card.png', 'padding: 8px 26px 16px;', 0.8);
  }).catch(() => { /* drawn fallback */ });
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const field = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(field); field.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* nothing more to try */ }
    field.remove();
    return ok;
  }
}

const tag = (name, props = {}, ...children) => { const e = Object.assign(document.createElement(name), props); e.append(...children); return e; };

let notice = null;
// kind: 'none' (no WebGL at all, the game can't start), 'slow' (drawn by the processor), 'lost' (the card gave up).
export function showGpuNotice(kind) {
  notice?.remove();
  if (kind === 'slow' && read(MUTE_KEY)) return;
  style();
  const g = browserGuide();
  const title = { none: 'Le jeu ne peut pas démarrer', slow: 'Carte graphique non utilisée', lost: 'L\'affichage s\'est interrompu' }[kind];
  const intro = {
    none: `${g.name} n'a pas accès à la carte graphique : sans elle, Clausus ne peut pas afficher la 3D.`,
    slow: `${g.name} dessine le jeu avec le processeur au lieu de la carte graphique : il sera lent et peut se bloquer.`,
    lost: 'La carte graphique a cessé de répondre (pilote, mise en veille ou manque de mémoire).',
  }[kind];
  const card = tag('div', { className: 'notice' }, tag('h2', { textContent: title }), tag('p', { textContent: intro }));
  if (kind === 'slow' && lowered) card.append(tag('p', { className: 'help', textContent: 'Les graphismes ont été réduits automatiquement (ombres, miroirs, résolution).' }));
  if (kind !== 'lost') {
    card.append(tag('p', { textContent: g.url ? `Activez l'accélération matérielle dans ${g.name} :` : 'Que faire :' }));
    const list = tag('ol');
    if (g.url) {
      // Browsers never let a page open their settings: one click copies the address, the player pastes it.
      const hint = tag('span', { className: 'copied', textContent: 'Cliquez pour copier l\'adresse, puis collez-la dans la barre d\'adresse (Ctrl+V, Entrée).' });
      const addr = tag('button', { className: 'mb small addr', textContent: g.url });
      addr.onclick = async () => { hint.textContent = (await copy(g.url)) ? 'Adresse copiée : collez-la dans la barre d\'adresse (Ctrl+V), puis Entrée.' : 'Sélectionnez l\'adresse et copiez-la (Ctrl+C).'; };
      list.append(tag('li', {}, 'Ouvrez les réglages :', addr, hint));
    }
    for (const s of g.steps) list.append(tag('li', { textContent: s }));
    card.append(list, tag('p', { className: 'small', textContent: 'Toujours rien ? Mettez à jour le pilote de la carte graphique ; sur un PC portable, branchez le chargeur.' }));
  }
  const acts = tag('div', { className: 'acts' });
  const button = (text, onclick, primary) => acts.append(tag('button', { className: `mb${primary ? ' primary' : ''}`, textContent: text, onclick }));
  if (kind === 'slow') {
    button('Continuer quand même', hideGpuNotice, true);
    button('Ne plus me prévenir', () => { write(MUTE_KEY, '1'); hideGpuNotice(); });
  } else button('Recharger la page', () => location.reload(), true);
  card.append(acts);
  notice = tag('div', { id: 'gpuNotice' }, tag('div', { className: 'veil heavy' }), card);
  document.body.append(notice);
  if (kind === 'none') document.getElementById('loading')?.remove();
}
export const hideGpuNotice = () => { notice?.remove(); notice = null; };

if (gpu.software) console.warn(`[gpu] rendu ${gpu.webgl ? `logiciel (${gpu.name || 'inconnu'})` : 'impossible : WebGL indisponible'}`);
if (gpu.webgl && gpu.software) {
  if (document.body) showGpuNotice('slow');
  else addEventListener('DOMContentLoaded', () => showGpuNotice('slow'), { once: true });
}
