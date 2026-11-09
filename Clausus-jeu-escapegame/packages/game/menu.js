import { SCHEMA, cfg, setCfg, resetCfg, isKey, isDev, keyLabel } from './config.js';
import { isTouch } from './touch.js';
import { kitCss, nine as nineRule, skinCss } from './ui-kit.js';

// Menus: main, mode select, pause, options (tabs, incl. developer), credits.
// Plain DOM. Painted skins from ui/ (generated assets) replace the CSS fallback when present.
const CSS = kitCss('#menus') + `
#menus { position: fixed; inset: 0; z-index: 25; pointer-events: none; font-family: var(--type); color: #e9dfc4; }
#menus .scr { position: absolute; inset: 0; display: none; pointer-events: auto; }
#menus .scr.on { display: block; animation: mfade 0.35s ease-out; }
@keyframes mfade { from { opacity: 0; } }
#mDust { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
#menus .player { position: absolute; right: 34px; top: 18px; display: flex; align-items: center; gap: 14px; }
#menus .player .who { font-size: 20px; color: #e2d3b0; letter-spacing: 2px; text-shadow: 0 2px 4px #000; max-width: 60vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#menus .player .pbtns { display: flex; gap: 8px; }
#menus .version { position: absolute; left: 34px; top: 26px; font-size: 13px; color: #9a7a5a; letter-spacing: 2px; }
#menus .stack { position: absolute; left: 50%; transform: translateX(-50%); bottom: 7vh; width: min(360px, 80vw); display: flex; flex-direction: column; gap: 10px; }
#menus .stack .gap { height: 26px; }
#menus .ptitle { position: absolute; left: 50%; transform: translateX(-50%); top: 33vh; font-size: 40px; letter-spacing: 6px; color: #efe4c8; text-shadow: 0 2px 8px #000; white-space: nowrap; }

/* Controls card (pause) */
#menus .card { position: absolute; left: 4vw; bottom: 6vh; width: 300px; padding: 20px 22px 18px; color: #2b241a; background: #c9b48e; border: 2px solid #6e5a3e; border-radius: 3px; box-shadow: 0 10px 30px rgba(0,0,0,0.7), inset 0 0 40px rgba(110,80,40,0.35); }
#menus .card h3 { margin: 0 0 8px; text-align: center; font-size: 26px; font-weight: normal; border-bottom: 2px solid #5a4630; padding-bottom: 6px; }
#menus .card .r { display: flex; align-items: center; gap: 10px; margin: 7px 0; font-size: 19px; }
#menus .card .ks { display: flex; gap: 4px; justify-content: flex-end; width: 116px; }
#menus .kc { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; padding: 0 6px; font-family: var(--type); font-size: 14px; color: #f2e6cc; background: #2c201a; border: 1px solid #100a07; border-radius: 4px; box-shadow: inset 0 -3px 0 rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.15); }

/* Options panel */
#menus .panel { position: absolute; left: 50%; top: 3vh; bottom: 3vh; transform: translateX(-50%); width: min(980px, 94vw); display: flex; flex-direction: column; padding: 18px 34px 22px; background: rgba(20,14,11,0.9); border: 2px solid #120c09; box-shadow: 0 20px 60px #000, inset 0 0 0 1px rgba(255,220,180,0.06); }
#menus .tab.dev { color: #8fc49a; }
#menus .tab.dev.on { color: #d8ffe0; background: #263a2c; }
#menus .body { flex: 1; overflow-y: auto; touch-action: pan-y; overscroll-behavior: contain; padding: 0 12px 0 4px; scrollbar-width: thin; scrollbar-color: #6e5a3e transparent; }
#menus .row { display: grid; grid-template-columns: minmax(200px, 1.1fr) 1.3fr; align-items: center; gap: 24px; min-height: 52px; }
#menus .row .lbl { font-size: 22px; color: #efe4c8; text-shadow: 0 2px 2px #000; }
#menus .help { grid-column: 1 / -1; margin: -10px 0 4px; font-size: 14px; color: #a8987a; }
#menus .ctl { display: flex; align-items: center; gap: 14px; }
#menus .slider { touch-action: none; position: relative; flex: 1; height: 16px; background: #1a120e; border: 1px solid #0a0605; border-radius: 9px; cursor: pointer; box-shadow: inset 0 2px 3px rgba(0,0,0,0.7); }
#menus .slider .fill { position: absolute; left: 1px; top: 1px; bottom: 1px; border-radius: 8px; background: linear-gradient(#f0a878, #d0784a); }
#menus .slider .knob { position: absolute; top: 50%; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%; background: #f4d8b8; border: 2px solid #5a2c18; box-shadow: 0 2px 4px #000; display: none; }
#menus .slider:hover .knob { display: block; }
#menus .val { width: 74px; font-size: 20px; color: #f0a878; text-align: left; }
#menus .opt { flex: 1; text-align: center; font-family: var(--type); font-size: 21px; color: #efe4c8; padding: 8px 12px; cursor: pointer; background: #33251e; border: 2px solid #150e0a; border-radius: 3px; box-shadow: inset 0 -2px 0 rgba(0,0,0,0.4); user-select: none; }
#menus .opt:hover { filter: brightness(1.3); }
#menus .opt .ar { color: #a8987a; padding: 0 10px; }
#menus .opt.listen { color: #f0a878; animation: blink 0.8s infinite; }
#menus .opt.danger { background: #5e1610; }
#menus .sounds .help { margin: 0 0 8px; }
#menus .sounds > .opt { display: inline-block; flex: none; padding: 5px 18px; font-size: 16px; }
#menus .sounds .group { margin: 12px 0 6px; font-size: 16px; color: #f0a878; }
#menus .sounds .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
#menus .sounds .grid .opt { padding: 6px 8px; font-size: 15px; }
#menus .sounds .grid .opt.synth { color: #a8987a; }
#menus .note { margin-top: 24px; text-align: center; font-size: 17px; color: #a8987a; line-height: 1.6; }
#menus .foot { display: flex; justify-content: center; gap: 16px; margin-top: 14px; }
#menus .foot .mb { min-width: 320px; }

/* Notice shown before the game */
#menus .notice { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(920px, 92vw); max-height: 96vh; overflow-y: auto; box-sizing: border-box; padding: 2vh 38px 2.5vh; text-align: center; background: rgba(26,18,14,0.92); border: 2px solid #2a1c16; border-radius: 4px; }
#menus .notice h2 { margin: 0 0 1.6vh; font-size: clamp(24px, 5.5vh, 38px); font-weight: normal; letter-spacing: 2px; color: #fff2dc; }
#menus .notice p { margin: 0 0 1.6vh; font-size: clamp(14px, 2.9vh, 21px); line-height: 1.4; color: #d8ccb0; }
#menus .notice p.help { margin-bottom: 2.2vh; font-size: clamp(13px, 2.6vh, 18px); color: #f0c8a8; }
#menus .notice .num { font-family: Arial, Helvetica, sans-serif; font-weight: bold; }
#menus .notice .acts { display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; }
#menus .notice .acts .mb { min-width: 240px; }
#menus .back { position: absolute; left: 50%; bottom: 6vh; transform: translateX(-50%); }

/* Credits, quit */
#menus .credits { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(640px, 90vw); max-height: 74vh; overflow-y: auto; text-align: center; font-size: 19px; line-height: 1.7; color: #d8ccb0; }
#menus .credits h3 { margin: 18px 0 4px; font-size: 16px; letter-spacing: 3px; color: #c8603a; font-weight: normal; }
#menus .quitmsg { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 34px; letter-spacing: 3px; color: #c8b89a; text-shadow: 0 0 20px #000; }
#menus .stack .saved { margin: -4px 0 2px; text-align: center; font-size: 14px; letter-spacing: 1px; color: #b8a27e; text-shadow: 0 2px 4px #000; }
#menus .stack .mb.hidden, #menus .stack .saved.hidden, #menus .notice p.hidden { display: none; }
#menus .wake { position: absolute; left: 50%; top: 58%; transform: translateX(-50%); font-size: 22px; letter-spacing: 3px; color: #e8dcb8; animation: blink 1.6s infinite; }
#menus .card .ks.t { width: 34px; flex: none; }
#menus .card .tico { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; padding: 0 6px; border-radius: 13px; font-size: 14px; color: #f2e6cc; background: #2c201a; }

/* Phones (landscape) and small windows: everything tighter. "html" bumps specificity above the painted skin rules. */
@media (max-height: 520px) {
  html #menus .version { left: 14px; top: 10px; font-size: 11px; }
  html #menus .logo { top: 7vh; width: min(440px, 50vw); }
  html #menus .stack { bottom: 4vh; gap: 6px; width: min(320px, 70vw); }
  html #menus .stack .gap { height: 6px; }
  html #menus button.mb { font-size: 18px; padding: 5px 14px; }
  html #menus button.mb.primary { font-size: 24px; padding: 7px 14px; }
  html #menus .logo.small { display: none; }
  html #menus .ptitle { top: 4vh; font-size: 26px; }
  #menus .scr[data-name="pause"] .stack { left: auto; right: max(3vw, env(safe-area-inset-right, 0px)); transform: none; top: 16vh; bottom: auto; width: min(320px, 44vw); }
  html #menus .card { left: max(3vw, env(safe-area-inset-left, 0px)); top: 16vh; bottom: auto; width: min(340px, 46vw); padding: 4px 8px; max-height: 80vh; overflow: hidden; box-sizing: border-box; }
  html #menus .card h3 { font-size: 19px; margin-bottom: 4px; padding-bottom: 3px; }
  html #menus .card { border-width: 12px; border-image-width: 12px; }
  html #menus .card .r { font-size: 14px; margin: 3px 0; gap: 8px; line-height: 1.15; }
  html #menus .card .tico { height: 22px; min-width: 22px; font-size: 12px; }
  html #menus .card .ks { width: 92px; }
  html #menus .panel { top: 2vh; bottom: 2vh; width: 96vw; padding: 8px 18px 10px; box-sizing: border-box; border-width: 14px; border-image-width: 14px; }
  html #menus .panel h2 { font-size: 22px; }
  html #menus .panel .rule { margin: 4px 0 8px; }
  html #menus .tabs { gap: 4px; margin-bottom: 8px; }
  html #menus .tab { font-size: 15px; padding: 4px 10px; min-width: 0; }
  html #menus .tab.on { transform: translateY(-2px); }
  html #menus .row { min-height: 40px; gap: 14px; grid-template-columns: minmax(150px, 1fr) 1.3fr; }
  html #menus .row .lbl { font-size: 16px; }
  html #menus .help { margin: -6px 0 4px; font-size: 12px; }
  html #menus .head { margin: 12px 0 4px; font-size: 15px; }
  html #menus .opt { font-size: 15px; padding: 5px 8px; }
  html #menus .val { width: 58px; font-size: 15px; }
  html #menus .foot { margin-top: 8px; }
  html #menus .foot .mb { min-width: 200px; }
  html #menus .note { font-size: 14px; margin-top: 12px; }
  html #menus .notice { padding: 6px 16px 10px; border-width: 12px; border-image-width: 12px; }
  html #menus .notice h2 { margin: 2px 0 6px; font-size: 24px; }
  html #menus .notice p { margin-bottom: 6px; font-size: 14px; line-height: 1.25; }
  html #menus .notice p.help { margin-bottom: 8px; font-size: 13px; }
  html #menus .notice .acts .mb { min-width: 170px; }
  html #menus .back { bottom: 3vh; }
  html #menus .credits { font-size: 14px; line-height: 1.45; }
  html #menus .credits h3 { margin: 8px 0 2px; font-size: 12px; }
  html #menus .credits > div:first-child { font-size: 30px !important; }
  html #menus .quitmsg { font-size: 24px; }
}
/* Portrait phones. */
@media (max-width: 600px) {
  html #menus .row { grid-template-columns: 1fr; gap: 4px; padding: 6px 0; }
  html #menus .card { display: none; }
  html #menus .tab { min-width: 0; font-size: 15px; padding: 4px 10px; }
}
`;

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export function createMenus(h) {
  // h: { sfx(kind), onStart(), onContinue(), onResume(), onSave(), canSave(), saveShown(), onRestart(), onMainMenu(),
  //      action(name, value), live(name), onAccount(), onLogin(), onLogout(), onLeaderboard() | null, publishState(),
  //      publishLabel(state), onPublish() }
  const style = el('style'); style.textContent = CSS; document.head.append(style);
  const root = el('div'); root.id = 'menus'; document.body.append(root);
  const dust = el('canvas'); dust.id = 'mDust';
  root.append(dust);
  const scr = {};
  const make = (name) => { const s = el('div', 'scr'); s.dataset.name = name; root.append(s); scr[name] = s; return s; };
  let current = null, settingsFrom = null;

  const btn = (label, onClick, cls = '') => {
    const b = el('button', `mb ${cls}`, label);
    b.addEventListener('mouseenter', () => h.sfx('hover'));
    b.addEventListener('click', (e) => { e.stopPropagation(); h.sfx('click'); onClick(); });
    return b;
  };
  const logo = (small = false) => {
    const d = el('div', `logo${small ? ' small' : ''}`);
    const img = new Image();
    img.onload = () => { d.replaceChildren(img); };
    img.src = 'ui/title.png';
    d.append(el('div', 'txt', 'CLAUSUS'));
    return d;
  };

  // ---------- Main ----------
  const main = make('main');
  main.append(el('div', 'veil'), el('div', 'version', 'v0.4.0'), logo());
  const mainStack = el('div', 'stack');
  // With a saved game (signed-in players): "Reprendre la partie" first, "Commencer" starts a new one over it.
  const resumeBtn = btn('Reprendre la partie', () => { hideAll(); h.onContinue(); }, 'primary hidden');
  const savedAt = el('div', 'saved hidden');
  const newBtn = btn('Commencer', () => show('notice'), 'primary');
  mainStack.append(resumeBtn, savedAt, newBtn, el('div', 'gap'),
    ...(h.onLeaderboard ? [btn('Classement', () => h.onLeaderboard())] : []),
    btn('Options', () => openSettings('main')), btn('Crédits', () => show('credits')), btn('Quitter', quit));
  main.append(mainStack);
  // Signed-in player or guest (only inside the site around the game, see shell.js).
  const playerBox = el('div', 'player hidden');
  const who = el('div', 'who');
  const playerBtns = el('div', 'pbtns');
  const signedBtns = [btn('Compte', () => h.onAccount?.(), 'small'), btn('Déconnexion', () => h.onLogout?.(), 'small')];
  const guestBtns = [btn('Se connecter', () => h.onLogin?.(), 'small')];
  playerBox.append(who, playerBtns);
  main.append(playerBox);

  // ---------- Notice before the game ----------
  const notice = make('notice');
  const noticeBox = el('div', 'notice');
  const noticeActs = el('div', 'acts');
  noticeActs.append(btn('Continuer', () => { hideAll(); h.onStart(); }, 'primary'), btn('Retour au menu', () => show('main')));
  const replaceWarn = el('p', 'help hidden', 'Une nouvelle partie remplace ta partie sauvegardée.');
  noticeBox.append(
    el('h2', '', 'Avant de commencer'),
    el('p', '', 'Une personne sur huit dans le monde vit avec un trouble mental (OMS, 2019).'),
    el('p', '', '<em>Clausus</em> est un jeu réalisé pour un projet de cours. L\'histoire, les personnages et l\'hôpital sont inventés. Ils ne décrivent pas de vrais patients ni de vrais soins.'),
    el('p', 'help', 'Si tu traverses une période difficile, toi ou un proche, parles-en à un médecin ou à quelqu\'un de confiance. En France, le <span class="num">3114</span>, numéro national de prévention du suicide, répond gratuitement 24 h/24.'),
    replaceWarn,
    noticeActs,
  );
  notice.append(el('div', 'veil heavy'), noticeBox);

  // ---------- Pause ----------
  const pause = make('pause');
  pause.append(el('div', 'veil heavy'), logo(true), el('div', 'ptitle', 'PAUSE'));
  const card = el('div', 'card');
  pause.append(card);
  const pStack = el('div', 'stack');
  // Saving: signed-in players only (shell.js); a guest is asked to sign in first. Hidden when the game runs alone.
  const saveBtn = btn('Sauvegarder', () => { if (h.canSave()) h.onSave(); else show('saveGuest'); }, h.saveShown() ? '' : 'hidden');
  // Once out of the hospital (in the site only): publish the escape, then see the leaderboard.
  const publishBtn = btn('', () => h.onPublish?.(), 'hidden');
  const refreshPublish = () => {
    const st = h.publishState?.();
    publishBtn.classList.toggle('hidden', !st);
    if (st) { publishBtn.textContent = h.publishLabel(st); publishBtn.disabled = st !== 'ready'; }
  };
  pStack.append(btn('Reprendre', () => { hideAll(); h.onResume(); }), saveBtn, btn('Recommencer', () => h.onRestart()), el('div', 'gap'),
    publishBtn, ...(h.onLeaderboard ? [btn('Classement', () => h.onLeaderboard())] : []),
    btn('Options', () => openSettings('pause')), btn('Menu principal', () => h.onMainMenu()), btn('Quitter', quit));
  pause.append(pStack);
  const renderCard = () => {
    if (isTouch()) {
      const t = (x) => `<span class="tico">${x}</span>`;
      const [walk, look] = cfg.touchSwap ? ['droite', 'gauche'] : ['gauche', 'droite'];
      card.innerHTML = `<h3>Commandes</h3>
      <div class="r"><span class="ks t">${t('◎')}</span>Glisser à ${walk} : marcher</div>
      <div class="r"><span class="ks t">${t('↔')}</span>Glisser à ${look} : regarder</div>
      <div class="r"><span class="ks t">${t('✋')}</span>${cfg.touchTap ? 'Toucher l\'objet' : 'Viser'} : interagir</div>
      <div class="r"><span class="ks t">${t('▶')}</span>Toucher : dialogue suivant</div>
      <div class="r"><span class="ks t">${t('💊')}</span>Prendre un cachet</div>
      <div class="r"><span class="ks t">${t('🔦')}</span>Lampe torche</div>
      <div class="r"><span class="ks t">${t('II')}</span>Pause</div>`;
      return;
    }
    const k = (id) => `<span class="kc">${keyLabel(cfg[id])}</span>`;
    card.innerHTML = `<h3>Commandes</h3>
      <div class="r"><span class="ks"><span style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px"><span style="grid-column:2;display:flex">${k('kForward')}</span><span style="grid-column:1;display:flex">${k('kLeft')}</span>${k('kBack')}${k('kRight')}</span></span>Se déplacer</div>
      <div class="r"><span class="ks"><span class="kc">🖱</span>/${k('kInteract')}</span>Interagir</div>
      <div class="r"><span class="ks">${k('kPill')}</span>Prendre un cachet</div>
      <div class="r"><span class="ks">${k('kTorch')}</span>Lampe torche</div>
      <div class="r"><span class="ks">${k('kMute')}</span>Couper le son</div>
      <div class="r"><span class="ks">${k('kMap')}</span>Agrandir le plan (maintenir)</div>
      <div class="r"><span class="ks"><span class="kc">ÉCHAP</span></span>Pause</div>`;
  };

  // ---------- Saving as a guest: sign in first ----------
  const saveGuest = make('saveGuest');
  const sgBox = el('div', 'notice');
  const sgActs = el('div', 'acts');
  sgActs.append(btn('Se connecter', () => h.onLogin(), 'primary'), btn('Retour', () => show('pause')));
  sgBox.append(
    el('h2', '', 'Sauvegarder la partie'),
    el('p', '', 'Tu joues en invité. Ta partie sera perdue quand tu fermeras la page.'),
    el('p', '', 'Connecte-toi pour la sauvegarder et la reprendre plus tard, sur cet appareil ou un autre.'),
    sgActs,
  );
  saveGuest.append(el('div', 'veil heavy'), sgBox);

  // ---------- Settings ----------
  const settings = make('settings');
  settings.append(el('div', 'veil heavy'));
  const panel = el('div', 'panel');
  panel.append(el('h2', '', 'OPTIONS'), el('div', 'rule'));
  const tabs = el('div', 'tabs'), body = el('div', 'body'), foot = el('div', 'foot');
  foot.append(btn('Valider', closeSettings));
  panel.append(tabs, body, foot);
  settings.append(panel);
  let tab = 'general';
  const liveRefs = [];
  function renderTabs() {
    tabs.replaceChildren(...SCHEMA.map((t) => {
      const b = el('button', `tab${t.tab === tab ? ' on' : ''}${t.tab === 'dev' ? ' dev' : ''}`, t.label);
      b.addEventListener('click', () => { h.sfx('click'); tab = t.tab; renderTabs(); renderBody(); });
      return b;
    }));
  }
  function renderBody() {
    liveRefs.length = 0;
    const t = SCHEMA.find((x) => x.tab === tab);
    body.replaceChildren();
    for (const it of t.items) {
      if (it.heading) { body.append(el('div', 'head', it.heading)); continue; }
      if (it.kind === 'sounds') { body.append(soundsBlock()); continue; }
      const row = el('div', 'row');
      row.append(el('div', 'lbl', it.label));
      const ctl = el('div', 'ctl');
      row.append(ctl);
      if (it.kind === 'slider') sliderCtl(ctl, it);
      if (it.kind === 'toggle') toggleCtl(ctl, it);
      if (it.kind === 'select') selectCtl(ctl, it);
      if (it.kind === 'key') keyCtl(ctl, it);
      if (it.kind === 'button') {
        const b = el('div', `opt${it.danger ? ' danger' : ''}`, 'Exécuter');
        b.addEventListener('click', () => { h.sfx('click'); runAction(it.action); b.textContent = 'Fait ✓'; setTimeout(() => { b.textContent = 'Exécuter'; }, 900); });
        ctl.append(b);
      }
      body.append(row);
      if (it.help) body.append(Object.assign(el('div', 'help', it.help), { style: 'grid-column:1/-1' }));
    }
  }
  function soundsBlock() {
    const box = el('div', 'sounds');
    box.append(el('div', 'help', 'Sons joués sans spatialisation. En gris : son synthétisé, sans fichier.'));
    const stop = el('div', 'opt danger', 'Tout couper');
    stop.addEventListener('click', () => h.action('stopSounds'));
    box.append(stop);
    for (const [group, sounds] of h.soundTests ?? []) {
      box.append(el('div', 'group', group));
      const grid = el('div', 'grid');
      for (const [label, file, run] of sounds) {
        const b = el('div', `opt${file ? '' : ' synth'}`, label);
        b.title = file ? `assets/audio/${file}.mp3` : 'Synthèse';
        b.addEventListener('click', () => h.action('testSound', run));
        grid.append(b);
      }
      box.append(grid);
    }
    return box;
  }
  function sliderCtl(ctl, it) {
    const s = el('div', 'slider'), fill = el('div', 'fill'), knob = el('div', 'knob'), val = el('div', 'val');
    s.append(fill, knob); ctl.append(s, val);
    const fmt = it.fmt ?? ((v) => (it.step < 0.01 ? v.toFixed(3) : it.step < 1 ? v.toFixed(2) : String(v)));
    const paint = (v) => { const k = (v - it.min) / (it.max - it.min); fill.style.width = `calc(${k * 100}% - 2px)`; knob.style.left = `${k * 100}%`; val.textContent = fmt(v); };
    const get = () => (it.live ? h.live(it.live) : cfg[it.id]);
    paint(get());
    if (it.live) liveRefs.push(() => { if (!dragging) paint(get()); });
    let dragging = false;
    const setFrom = (x) => {
      const r = s.getBoundingClientRect();
      let v = it.min + Math.min(1, Math.max(0, (x - r.left) / r.width)) * (it.max - it.min);
      v = Math.round(v / it.step) * it.step; v = +v.toFixed(5);
      if (it.live) h.action(it.live, v); else setCfg(it.id, v);
      paint(v);
    };
    s.addEventListener('pointerdown', (e) => { dragging = true; s.setPointerCapture(e.pointerId); setFrom(e.clientX); });
    s.addEventListener('pointermove', (e) => { if (dragging) setFrom(e.clientX); });
    s.addEventListener('pointerup', () => { dragging = false; h.sfx('tick'); });
    s.addEventListener('pointercancel', () => { dragging = false; }); // a touch drag taken over by the browser
  }
  function toggleCtl(ctl, it) {
    const b = el('div', 'opt');
    const paint = () => { b.textContent = cfg[it.id] ? 'Activé' : 'Désactivé'; b.style.color = cfg[it.id] ? '' : '#a8987a'; };
    paint();
    b.addEventListener('click', () => { h.sfx('click'); setCfg(it.id, !cfg[it.id]); paint(); });
    ctl.append(b);
  }
  function selectCtl(ctl, it) {
    const b = el('div', 'opt');
    const idx = () => Math.max(0, it.options.findIndex(([v]) => String(v) === String(cfg[it.id])));
    const paint = () => { b.innerHTML = `<span class="ar">◂</span>${it.options[idx()][1]}<span class="ar">▸</span>`; };
    paint();
    b.addEventListener('click', (e) => {
      h.sfx('click');
      const r = b.getBoundingClientRect(), dir = e.clientX < r.left + r.width / 3 ? -1 : 1;
      const n = (idx() + dir + it.options.length) % it.options.length;
      setCfg(it.id, it.options[n][0]);
      if (it.action) h.action(it.action, it.options[n][0]);
      paint();
    });
    ctl.append(b);
  }
  let listening = null;
  function keyCtl(ctl, it) {
    const b = el('div', 'opt');
    const paint = () => { b.innerHTML = `${it.mouse ? '🖱 / ' : ''}<span class="kc">${keyLabel(cfg[it.id])}</span>`; b.classList.remove('listen'); };
    paint();
    b.addEventListener('click', () => {
      h.sfx('click');
      if (listening) listening.cancel();
      b.textContent = 'Appuie sur une touche, Échap pour annuler'; b.classList.add('listen');
      const onKey = (e) => {
        e.preventDefault(); e.stopPropagation();
        document.removeEventListener('keydown', onKey, true);
        listening = null;
        if (e.code !== 'Escape') {
          // A key used elsewhere is swapped, so no action is left without a key.
          for (const other of SCHEMA.flatMap((t) => t.items)) if (other.id !== it.id && isKey(other.id) && cfg[other.id] === e.code) setCfg(other.id, cfg[it.id]);
          setCfg(it.id, e.code);
        }
        renderBody();
      };
      listening = { cancel: () => { document.removeEventListener('keydown', onKey, true); paint(); } };
      document.addEventListener('keydown', onKey, true);
    });
    ctl.append(b);
  }
  function runAction(name) {
    if (name === 'resetSettings') { resetCfg(); renderBody(); }
    else if (name === 'resetKeys') { resetCfg((i) => i.kind === 'key'); renderBody(); }
    else if (name === 'resetDev') { resetCfg((i) => isDev(i) && !i.transient); renderBody(); }
    h.action(name);
  }
  function openSettings(from) { settingsFrom = from; renderTabs(); renderBody(); show('settings'); }
  function closeSettings() { if (listening) listening.cancel(); show(settingsFrom || 'main'); }

  // ---------- Credits ----------
  const credits = make('credits');
  credits.append(el('div', 'veil heavy'));
  credits.append(el('div', 'credits', `
    <div style="font-size:44px;letter-spacing:6px;color:#efe4c8">CLAUSUS</div>
    <div>Escape game d'horreur · Institut G4 · Cercle de projets 2026</div>
    <h3>ÉQUIPE A</h3>Alina · Jad · Mohamed · Jules · Jordan · Luis
    <h3>VOIX</h3>
    <div>Patient &amp; Téléphone — Ivory</div>
    <div>Sécurité — Warlock</div>
    <div>Hallucinations — Warlock &amp; Sel_sel</div>
    <div>Accueil &amp; Léa — Sel_sel</div>
    <div>Annonces — Julien_lma</div>
    <div>Perrin — Chopper</div>
    <div>Psychiatre — Madmax212</div>
    <div>Autres patients — Julien_lma &amp; Sel_sel</div>
    <h3>TECHNOLOGIE</h3>Three.js r187 (licence MIT) · Web Audio : sons enregistrés ci-dessous, quelques effets synthétisés en temps réel
    <h3>SONS</h3>Horror SFX (YourPalRob) · clavier : unicaegames (OpenGameArt) · ordinateur : Sanderboah, Crinkem, alpinemesh, Kodack, Masgame (Freesound, CC0) · BigSoundBank (Joseph Sardin, CC0) · NicknameLarry, Sheyvan, kyles, LilMati, I.fekry, HaleyReeseCalhoun, dwswords (Freesound, CC0) · menus : Kenney (CC0)
    <h3>POLICE</h3>Special Elite (Astigmatic, licence Apache 2.0)
    <h3>VISUELS</h3>Modèles 3D de l'équipe et interface modélisée dans Blockbench (pixel art, sans IA générative d'images)
  `));
  const cBack = el('div', 'back'); cBack.append(btn('Retour', () => show('main'), 'small'));
  credits.append(cBack);

  // ---------- Quit, wake ----------
  const quitScr = make('quit');
  quitScr.append(el('div', 'veil heavy'), el('div', 'quitmsg', 'Il n\'y a pas de sortie.'));
  let quitFrom = 'main';
  function quit() { quitFrom = current; show('quit'); h.sfx('deny'); setTimeout(() => { if (current === 'quit') show(quitFrom); }, 2200); }
  const wake = make('wake');
  const wakeTxt = el('div', 'wake', '[ cliquer pour se réveiller ]');
  wake.append(el('div', 'veil'), wakeTxt);
  wake.addEventListener('click', () => { hideAll(); h.onStart(null); });

  // ---------- Floating dust behind the menus ----------
  const motes = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.8, v: 0.004 + Math.random() * 0.012, p: Math.random() * 6, r: Math.random() < 0.3 }));
  const dctx = dust.getContext('2d');
  function drawDust(t) {
    if (!current) return;
    if (dust.width !== innerWidth) { dust.width = innerWidth; dust.height = innerHeight; }
    dctx.clearRect(0, 0, dust.width, dust.height);
    for (const m of motes) {
      m.y -= m.v * 0.016; m.x += Math.sin(t * 0.0004 + m.p) * 0.0003;
      if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      dctx.fillStyle = m.r ? `rgba(170,60,60,${0.25 + 0.2 * Math.sin(t * 0.002 + m.p)})` : `rgba(210,190,160,${0.18 + 0.15 * Math.sin(t * 0.002 + m.p)})`;
      dctx.fillRect(m.x * dust.width, m.y * dust.height, m.s, m.s);
    }
  }

  let pauseAt = 0;
  function show(name) {
    for (const s of Object.values(scr)) s.classList.toggle('on', s.dataset.name === name);
    if (name === 'pause' && current !== 'pause') pauseAt = performance.now();
    current = name;
    root.style.pointerEvents = 'auto';
    if (name === 'pause') { renderCard(); refreshPublish(); }
    if (name === 'wake') wakeTxt.textContent = isTouch() ? '[ toucher pour se réveiller ]' : '[ cliquer pour se réveiller ]';
  }
  function hideAll() {
    if (listening) listening.cancel();
    for (const s of Object.values(scr)) s.classList.remove('on');
    current = null;
    root.style.pointerEvents = 'none';
    dctx.clearRect(0, 0, dust.width, dust.height);
  }
  // Escape inside menus: go back one level; on the pause menu, back to the game (like « Reprendre »).
  // Some browsers also deliver the Escape that released the mouse and opened the pause: ignored for a moment.
  document.addEventListener('keydown', (e) => {
    if (!current || listening || e.code !== 'Escape' || e.repeat) return;
    if (current === 'pause') { if (performance.now() - pauseAt > 400) { hideAll(); h.onResume(); } }
    else if (current === 'settings') closeSettings();
    else if (current === 'notice' || current === 'credits') show('main');
    else if (current === 'saveGuest') show('pause');
  });

  return {
    show, hideAll, openSettings,
    get current() { return current; },
    isOpen: () => current !== null,
    update(t) { drawDust(t); if (current === 'settings') for (const f of liveRefs) f(); },
    applySkin(spec) { applySkin(spec, style); },
    refreshPublish,
    /** Only called inside the site (shell.js): a pseudo, or '' for a guest. */
    setPlayer(pseudo) {
      who.textContent = pseudo || 'Invité';
      playerBtns.replaceChildren(...(pseudo ? signedBtns : guestBtns));
      playerBox.classList.remove('hidden');
      saveBtn.classList.toggle('hidden', !h.saveShown());
    },
    /** The player's saved game ({ savedAt }) or null: "Reprendre la partie" on the main menu. */
    setSave(save) {
      resumeBtn.classList.toggle('hidden', !save);
      savedAt.classList.toggle('hidden', !save);
      newBtn.classList.toggle('primary', !save);
      newBtn.textContent = save ? 'Nouvelle partie' : 'Commencer';
      replaceWarn.classList.toggle('hidden', !save);
      if (save) savedAt.textContent = `Sauvegardée ${savedLabel(save.savedAt)}`;
    },
    /** Short feedback on the pause menu's save button. */
    saveDone(ok) {
      saveBtn.textContent = ok ? 'Sauvegardé ✓' : 'Échec de la sauvegarde';
      setTimeout(() => { saveBtn.textContent = 'Sauvegarder'; }, 1600);
    },
  };
}

// "le 3 novembre à 21 h 04", or "aujourd'hui à 21 h 04".
function savedLabel(date) {
  const d = new Date(date), now = new Date();
  const time = `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === now.toDateString()) return `aujourd'hui à ${time}`;
  return `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${time}`;
}

// Painted 9-slice skins from ui/ui_spec.json. `k` scales the painted borders (assets are drawn at ~2x).
function applySkin(spec, style) {
  const nine = (sel, key, file, extra = '', k = 0.6) => nineRule(spec, sel, key, file, extra, k);
  let css = skinCss(spec, '#menus');
  css += nine('#menus .opt', 'button', 'button.png', 'padding: 0 6px;', 0.5);
  css += nine('#menus .opt:hover', 'button_hover', 'button_hover.png', 'filter: none;', 0.5);
  css += nine('#menus .card', 'card_paper', 'card_paper.png', 'padding: 6px 10px 8px;', 0.8);
  css += nine('#menus .kc', 'keycap', 'keycap.png', 'padding: 0 3px; min-width: 14px; height: 14px; line-height: 14px; font-size: 14px;', 0.4);
  css += nine('#menus .notice', 'mode_card', 'mode_card.png', 'padding: 8px 26px 16px;', 0.8);
  if (spec.slider_track) css += `#menus .slider { height: 18px; border: 0; border-radius: 0; box-shadow: none; background: url(ui/slider_track.png) center / 100% 100% no-repeat; image-rendering: pixelated; }
    #menus .slider .fill { top: 5px; bottom: 5px; left: 6px; border-radius: 0; background: url(ui/slider_fill.png) repeat-x left center / auto 100%; image-rendering: pixelated; }
    #menus .slider .knob { display: block; width: 26px; height: 26px; margin: -13px 0 0 -13px; border: 0; border-radius: 0; box-shadow: none; background: url(ui/slider_knob.png) center / contain no-repeat; image-rendering: pixelated; }\n`;
  if (spec.palette?.accent) css += `#menus .val { color: ${spec.palette.accent}; }\n`;
  style.textContent += css;
}
