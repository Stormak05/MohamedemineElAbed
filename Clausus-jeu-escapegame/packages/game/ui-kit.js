// The look of every Clausus menu, shared by the game (menu.js) and the site around it (apps/web: sign-in, pseudo,
// account). One source for fonts, colors, the veil over the room, the logo, buttons, tabs, panels and text fields.
// Plain CSS strings: kitCss() is the drawn fallback, skinCss() swaps in the painted skins from ui/ (ui_spec.json).

export const KIT_FONT = "'Special Elite', 'Courier New', monospace";

/**
 * Base rules under `scope` (e.g. '#menus'). `btn` is the button selector: 'button.mb' in the game, '.mb' on the site
 * (where links can be buttons too).
 */
export function kitCss(scope, btn = 'button.mb') {
  const s = scope;
  const b = `${s} ${btn}`;
  return `
${s} .veil { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 40%, rgba(12,10,8,0.25), rgba(4,3,2,0.86) 70%); }
${s} .veil.heavy { background: radial-gradient(ellipse at 50% 40%, rgba(10,8,6,0.55), rgba(3,2,2,0.94) 70%); backdrop-filter: blur(2px); }
${s} .logo { position: absolute; left: 50%; top: 9vh; transform: translateX(-50%); width: min(820px, 76vw); text-align: center; }
${s} .logo img { width: 100%; image-rendering: auto; filter: drop-shadow(0 6px 18px rgba(0,0,0,0.8)); }
${s} .logo .txt { font-size: clamp(56px, 10vw, 128px); letter-spacing: 0.22em; color: #e2d3b0; text-shadow: 0 0 22px rgba(160,40,30,0.45), 3px 4px 0 #2a0c08; }
${s} .logo.small { top: 4vh; width: min(500px, 54vw); }
${s} .logo.small .txt { font-size: clamp(40px, 7vw, 86px); }
${b} { font-family: var(--type, ${KIT_FONT}); font-size: 22px; color: #efe4c8; letter-spacing: 1px; padding: 10px 18px; cursor: pointer;
  background: linear-gradient(#3a2a22, #2a1d17); border: 2px solid #1a110c; border-radius: 4px; box-shadow: inset 0 1px 0 rgba(255,220,180,0.12), inset 0 -2px 0 rgba(0,0,0,0.35), 0 3px 6px rgba(0,0,0,0.6); text-shadow: 0 2px 2px #000; transition: filter 0.12s, transform 0.12s; }
${b}:hover, ${b}:focus-visible { filter: brightness(1.35); outline: none; transform: translateY(-1px); }
${b}.primary { font-size: 34px; padding: 14px 18px; background: linear-gradient(#9c3a26, #74261a); border-color: #3a1008; color: #fff4e4; }
${b}.danger { background: linear-gradient(#6e1a14, #4e100c); }
${b}.small { font-size: 18px; padding: 6px 14px; }
${b}:disabled { opacity: 0.4; cursor: default; filter: none; transform: none; }
${s} .tab { font-family: var(--type, ${KIT_FONT}); font-size: 20px; color: #d48c5c; padding: 8px 20px; min-width: 120px; cursor: pointer; background: #2a1c16; border: 2px solid #150e0a; border-radius: 3px; box-shadow: inset 0 -2px 0 rgba(0,0,0,0.4); }
${s} .tab.on { color: #fff2dc; background: #46342a; transform: translateY(-4px); box-shadow: 0 4px 10px rgba(0,0,0,0.6); }
${s} .panel h2 { margin: 0; text-align: center; font-size: 38px; font-weight: normal; letter-spacing: 4px; }
${s} .panel .rule { height: 2px; margin: 8px 0 16px; background: linear-gradient(90deg, transparent, #c8b48e 15%, #c8b48e 85%, transparent); }
${s} .tabs { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin-bottom: 18px; }
${s} .head { margin: 20px 0 8px; text-align: center; font-size: 19px; color: #c8b48e; letter-spacing: 1px; }
${s} .head::before, ${s} .head::after { content: '—'; margin: 0 12px; color: #6e5a3e; }
${s} .field { box-sizing: border-box; width: 100%; padding: 8px 12px; font: 20px 'Courier New', Courier, monospace; color: #efe4c8; background: #1a120e; border: 1px solid #0a0605; border-radius: 3px; box-shadow: inset 0 2px 3px rgba(0,0,0,0.7); }
${s} .field:focus-visible { outline: 2px solid #d0784a; outline-offset: 1px; }
`;
}

/** One 9-slice rule: `key` and `file` name a skin of ui_spec.json, drawn at scale `k`. `ui` is the folder of the images. */
export function nine(spec, sel, key, file, extra = '', k = 0.6, ui = 'ui/') {
  const d = spec[key]; if (!d) return '';
  const [t, r, b, l] = d.slice;
  const w = [t, r, b, l].map((v) => `${Math.round(v * k)}px`).join(' ');
  return `${sel} { border-style: solid; border-width: ${w}; border-image: url(${ui}${file}) ${t} ${r} ${b} ${l} fill / ${w} stretch; background: none; border-radius: 0; box-shadow: none; ${d.textColor ? `color: ${d.textColor};` : ''} ${extra} }\n`;
}

/** Painted skins for the shared pieces (buttons, panel, tabs), under `scope`. */
export function skinCss(spec, scope, btn = 'button.mb', ui = 'ui/') {
  const b = `${scope} ${btn}`;
  return nine(spec, b, 'button', 'button.png', 'padding: 2px 8px; image-rendering: pixelated;', 0.6, ui)
    + nine(spec, `${b}:hover, ${b}:focus-visible`, 'button_hover', 'button_hover.png', 'filter: none;', 0.6, ui)
    + nine(spec, `${b}.primary`, 'button_primary', 'button_primary.png', 'padding: 4px 8px; color: #fff4e4;', 0.75, ui)
    + nine(spec, `${scope} .panel`, 'panel', 'panel.png', 'padding: 10px 26px 14px;', 1, ui)
    + nine(spec, `${scope} .tab`, 'tab', 'tab.png', 'padding: 0 6px; min-width: 0; font-size: 18px;', 0.5, ui)
    + nine(spec, `${scope} .tab.on`, 'tab_active', 'tab_active.png', 'color: #fff2dc;', 0.5, ui);
}
