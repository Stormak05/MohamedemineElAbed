// All player and developer settings: one schema drives the options screens, persistence and defaults.
// Item kinds: slider {min,max,step,fmt}, toggle, select {options:[[value,label]]}, key (binding), button {action}, heading.
const KEY = 'clausus-settings-v1';

export const SCHEMA = [
  { tab: 'general', label: 'Général', items: [
    { id: 'sensitivity', label: 'Sensibilité de la souris', kind: 'slider', min: 0.2, max: 3, step: 0.05, def: 1, fmt: (v) => v.toFixed(2) },
    { id: 'invertY', label: 'Inverser l\'axe vertical', kind: 'toggle', def: false },
    { id: 'fov', label: 'Champ de vision', kind: 'slider', min: 55, max: 90, step: 1, def: 68, fmt: (v) => `${v}°` },
    { heading: 'Temps et santé mentale' },
    { id: 'pauseDialogues', label: 'Suspendre le temps pendant les dialogues', kind: 'toggle', def: false, help: 'Le chronomètre et la santé mentale s\'arrêtent pendant les conversations.' },
    { id: 'pauseReading', label: 'Suspendre le temps pendant la lecture', kind: 'toggle', def: false, help: 'Le chronomètre et la santé mentale s\'arrêtent pendant la lecture des documents et des fichiers sur ordinateur.' },
    { heading: 'Mouvements de caméra' },
    { id: 'headbob', label: 'Balancement de la tête', kind: 'slider', min: 0, max: 1, step: 0.05, def: 1, fmt: (v) => `${Math.round(v * 100)} %` },
    { id: 'headroll', label: 'Roulis de la tête', kind: 'toggle', def: true, help: 'La caméra penche quand le personnage vacille.' },
    { id: 'shake', label: 'Tremblements de l\'écran', kind: 'toggle', def: true },
    { id: 'reset', label: 'Réinitialiser les réglages', kind: 'button', action: 'resetSettings', danger: true, help: 'Remet aussi les options développeur par défaut.' },
  ] },
  { tab: 'controls', label: 'Commandes', items: [
    { id: 'kForward', label: 'Avancer', kind: 'key', def: 'KeyW' },
    { id: 'kBack', label: 'Reculer', kind: 'key', def: 'KeyS' },
    { id: 'kLeft', label: 'Aller à gauche', kind: 'key', def: 'KeyA' },
    { id: 'kRight', label: 'Aller à droite', kind: 'key', def: 'KeyD' },
    { id: 'kInteract', label: 'Interagir', kind: 'key', def: 'KeyE', mouse: true },
    { id: 'kPill', label: 'Prendre un cachet', kind: 'key', def: 'KeyC' },
    { id: 'kTorch', label: 'Lampe torche', kind: 'key', def: 'KeyF' },
    { id: 'kMute', label: 'Couper le son', kind: 'key', def: 'KeyM' },
    { id: 'kMap', label: 'Agrandir le plan (maintenir)', kind: 'key', def: 'Tab' },
    { id: 'resetKeys', label: 'Réinitialiser les touches', kind: 'button', action: 'resetKeys' },
    { heading: 'Écran tactile' },
    { id: 'touchMode', label: 'Commandes tactiles', kind: 'select', def: 'auto', options: [['auto', 'Automatique'], ['on', 'Toujours'], ['off', 'Jamais']], help: 'Automatique : sur téléphone et tablette, ou dès qu\'on touche l\'écran.' },
    { id: 'touchSens', label: 'Sensibilité du regard', kind: 'slider', min: 0.2, max: 3, step: 0.05, def: 1, fmt: (v) => v.toFixed(2) },
    { id: 'touchSwap', label: 'Joystick à droite (gaucher)', kind: 'toggle', def: false },
    { id: 'touchOpacity', label: 'Opacité des boutons', kind: 'slider', min: 0.2, max: 1, step: 0.05, def: 0.65, fmt: (v) => `${Math.round(v * 100)} %` },
    { id: 'touchTap', label: 'Toucher un objet pour l\'utiliser', kind: 'toggle', def: true, help: 'Sinon, viser avec le centre de l\'écran et appuyer sur ✋.' },
    { id: 'touchFullscreen', label: 'Plein écran au lancement', kind: 'toggle', def: true, help: 'Sur Android, passe aussi en paysage. Sans effet sur iPhone.' },
  ] },
  { tab: 'graphics', label: 'Graphismes', items: [
    { id: 'fullscreen', label: 'Plein écran', kind: 'toggle', def: false, transient: true },
    { id: 'pixels', label: 'Pixelisation', kind: 'select', def: 270, options: [[180, 'Très rétro'], [240, 'Rétro'], [270, 'Normale'], [360, 'Fine'], [480, 'Très fine'], [720, 'Nette']] },
    { id: 'brightness', label: 'Luminosité', kind: 'slider', min: 0.5, max: 2, step: 0.05, def: 1, fmt: (v) => v.toFixed(2) },
    { id: 'shadows', label: 'Ombres', kind: 'select', def: 'high', options: [['high', 'Hautes'], ['low', 'Basses'], ['off', 'Désactivées']] },
    { id: 'retroFx', label: 'Effets rétro', kind: 'toggle', def: true },
    { id: 'outline', label: 'Contour des objets utilisables', kind: 'toggle', def: true, help: 'Nécessite les effets rétro.' },
    { id: 'subliminal', label: 'Images subliminales', kind: 'select', def: 'full', options: [['full', 'Complètes'], ['soft', 'Douces'], ['off', 'Désactivées']], help: '« Douces » retire les écrans noirs et les images en négatif, pour les joueurs photosensibles.' },
  ] },
  { tab: 'audio', label: 'Audio', items: [
    { id: 'volMaster', label: 'Volume général', kind: 'slider', min: 0, max: 1, step: 0.01, def: 0.8, fmt: (v) => `${Math.round(v * 100)} %` },
    { id: 'volSfx', label: 'Effets sonores', kind: 'slider', min: 0, max: 1, step: 0.01, def: 1, fmt: (v) => `${Math.round(v * 100)} %` },
    { id: 'volAmb', label: 'Ambiance (pluie, néon…)', kind: 'slider', min: 0, max: 1, step: 0.01, def: 1, fmt: (v) => `${Math.round(v * 100)} %` },
    { id: 'volVoice', label: 'Voix et dialogues', kind: 'slider', min: 0, max: 1, step: 0.01, def: 1, fmt: (v) => `${Math.round(v * 100)} %` },
  ] },
  { tab: 'dev', label: 'Développeur', items: [
    { id: 'aResetDev', label: 'Réinitialiser les options développeur', kind: 'button', action: 'resetDev', danger: true },
    { heading: 'Essai des sons' },
    { kind: 'sounds' },
    { heading: 'Post-traitement' },
    { id: 'dPost', label: 'Post-traitement', kind: 'toggle', def: true },
    { id: 'dRes', label: 'Résolution interne (px)', kind: 'slider', min: 120, max: 1080, step: 10, def: 0, fmt: (v) => (v ? `${v}` : 'auto'), help: 'Auto : suit le réglage « Pixelisation ».' },
    { id: 'dBloom', label: 'Halo lumineux', kind: 'slider', min: 0, max: 2, step: 0.01, def: 0.5 },
    { id: 'dGrain', label: 'Grain', kind: 'slider', min: 0, max: 0.2, step: 0.005, def: 0.05 },
    { id: 'dDither', label: 'Tramage', kind: 'slider', min: 0, max: 2, step: 0.05, def: 1 },
    { id: 'dLevels', label: 'Niveaux de couleur / canal', kind: 'select', def: 20, options: [[6, '6'], [8, '8'], [12, '12'], [16, '16'], [20, '20'], [32, '32'], [64, '64'], [0, 'illimité']] },
    { id: 'dVig', label: 'Vignette (sain)', kind: 'slider', min: 0, max: 1, step: 0.01, def: 0.18 },
    { id: 'dVigSick', label: 'Vignette (malade)', kind: 'slider', min: 0, max: 1, step: 0.01, def: 0.85 },
    { id: 'dAberr', label: 'Aberration chromatique', kind: 'slider', min: 0, max: 0.02, step: 0.0005, def: 0.0018, fmt: (v) => v.toFixed(4) },
    { id: 'dBarrel', label: 'Courbure CRT', kind: 'slider', min: 0, max: 0.3, step: 0.01, def: 0.05 },
    { id: 'dScan', label: 'Lignes de balayage', kind: 'slider', min: 0, max: 0.4, step: 0.01, def: 0.06 },
    { id: 'dContrast', label: 'Contraste', kind: 'slider', min: 0.7, max: 2, step: 0.01, def: 1.12 },
    { id: 'dSat', label: 'Saturation', kind: 'slider', min: 0, max: 1.6, step: 0.01, def: 0.88 },
    { id: 'dSickFx', label: 'Effets visuels de la maladie', kind: 'toggle', def: true, help: 'Ondulation, vision double, désaturation, vignette qui se resserre.' },
    { heading: 'Lumières et monde' },
    { id: 'dExposure', label: 'Exposition', kind: 'slider', min: 0.3, max: 3, step: 0.05, def: 1 },
    { id: 'dPlayerLight', label: 'Lumière autour du joueur', kind: 'slider', min: 0, max: 3, step: 0.05, def: 1 },
    { id: 'dFog', label: 'Brouillard', kind: 'slider', min: 0, max: 0.3, step: 0.005, def: 0.075, fmt: (v) => v.toFixed(3) },
    { id: 'dLamp', label: 'Lampe suspendue', kind: 'slider', min: 0, max: 3, step: 0.05, def: 1 },
    { id: 'dAmbient', label: 'Lumière ambiante', kind: 'slider', min: 0, max: 3, step: 0.05, def: 1 },
    { id: 'dCity', label: 'Lumière extérieure', kind: 'slider', min: 0, max: 3, step: 0.05, def: 1 },
    { id: 'dSign', label: 'Panneau de sortie', kind: 'slider', min: 0, max: 3, step: 0.05, def: 1 },
    { id: 'dNight', label: 'Veilleuse rouge', kind: 'slider', min: 0, max: 3, step: 0.05, def: 1 },
    { id: 'dTorchPow', label: 'Lampe torche', kind: 'slider', min: 0, max: 3, step: 0.05, def: 1 },
    { id: 'dSway', label: 'Balancement de la lampe', kind: 'toggle', def: true },
    { id: 'dFlicker', label: 'Clignotement de la lampe', kind: 'toggle', def: true },
    { id: 'dDust', label: 'Poussière', kind: 'toggle', def: true },
    { id: 'dMirror', label: 'Reflets des miroirs', kind: 'toggle', def: true },
    { id: 'dRain', label: 'Pluie', kind: 'toggle', def: true },
    { id: 'dLightning', label: 'Éclairs', kind: 'toggle', def: true },
    { id: 'aLightning', label: 'Déclencher un éclair', kind: 'button', action: 'lightning' },
    { heading: 'Santé mentale' },
    { id: 'dFreeze', label: 'Figer la santé mentale', kind: 'toggle', def: false },
    { id: 'dDuration', label: 'Durée de la jauge (s)', kind: 'slider', min: 20, max: 1800, step: 10, def: 600, help: 'Temps pour vider la jauge sans cachet. Une partie complète dure une vingtaine de minutes.' },
    { id: 'dSanity', label: 'Santé mentale actuelle', kind: 'slider', min: 0, max: 1, step: 0.01, def: 1, transient: true, live: 'sanity', fmt: (v) => `${Math.round(v * 100)} %` },
    { id: 'dHallu', label: 'Hallucinations', kind: 'toggle', def: true },
    { id: 'dTremor', label: 'Tremblement des mains', kind: 'toggle', def: true },
    { id: 'dDecay', label: 'Délabrement', kind: 'select', def: 'auto', options: [['auto', 'Selon la santé'], ['off', 'Désactivé'], ['0', 'Forcé : propre'], ['1', 'Forcé : niveau 1'], ['2', 'Forcé : niveau 2'], ['3', 'Forcé : niveau 3']] },
    { id: 'aHallu', label: 'Déclencher une hallucination', kind: 'button', action: 'hallucinate' },
    { id: 'aVoice', label: 'Faire entendre une voix', kind: 'button', action: 'voice', help: 'Une réplique HAL au hasard, avec son image subliminale.' },
    { id: 'aFigure', label: 'Faire apparaître la créature', kind: 'button', action: 'figure', help: 'Devant le joueur pendant 15 s, visible une fois le menu fermé. Un second appui la retire.' },
    { id: 'dFigureStay', label: 'La créature reste quand on la regarde', kind: 'toggle', def: false, help: 'Appelée par le bouton, elle reste sans limite de temps. Une apparition normale disparaît dès qu\'on la regarde.' },
    { heading: 'Joueur et progression' },
    { id: 'dHands', label: 'Bras visibles', kind: 'toggle', def: true },
    { id: 'dSpeed', label: 'Vitesse de marche', kind: 'slider', min: 0.3, max: 4, step: 0.1, def: 1 },
    { id: 'dNoclip', label: 'Traverser les obstacles', kind: 'toggle', def: false },
    { id: 'dDebug', label: 'Infos de débogage à l\'écran', kind: 'toggle', def: false },
    { id: 'dTeleport', label: 'Téléporter', kind: 'select', def: 'none', transient: true, action: 'teleport', options: [['none', '—'], ['start', 'Départ'], ['phone', 'Téléphone'], ['window', 'Fenêtre'], ['bed', 'Lit'], ['door', 'Porte'], ['corridor', 'Étage : couloir'], ['archives', 'Étage : archives'], ['laverie', 'Étage : laverie'], ['stairs', 'Escalier'], ['lift', 'Ascenseur'], ['ground', 'RDC : accueil'], ['securite', 'RDC : poste de sécurité'], ['reunion', 'RDC : salle de réunion'], ['cabinet', 'RDC : cabinet du Dr Morel'], ['pharmacie', 'RDC : pharmacie'], ['sortie', 'RDC : sortie']] },
    { id: 'aCoin', label: 'Donner une pièce', kind: 'button', action: 'giveCoin' },
    { id: 'aPills', label: 'Donner le flacon de cachets', kind: 'button', action: 'givePills' },
    { id: 'aTorch', label: 'Donner la lampe torche', kind: 'button', action: 'giveTorch' },
    { id: 'aRoomKey', label: 'Donner la clé de la chambre', kind: 'button', action: 'giveRoomKey' },
    { id: 'aKeys', label: 'Donner le trousseau du Dr Morel', kind: 'button', action: 'giveKeys' },
    { id: 'aMeetingKey', label: 'Donner la clé de la salle de réunion', kind: 'button', action: 'giveMeetingKey' },
    { id: 'aCard', label: 'Donner la carte d\'accès', kind: 'button', action: 'giveCard' },
    { id: 'aUnlock', label: 'Déverrouiller la chambre', kind: 'button', action: 'unlock' },
    { id: 'dStory', label: 'Aller à l\'énigme', kind: 'select', def: 'none', transient: true, action: 'story', options: [['none', '—'], ['2', '2 : archives'], ['3', '3 : laverie'], ['4', '4 : sécurité (clés + blouse)'], ['5', '5 : salle de réunion'], ['6', '6 : cabinet du Dr Morel'], ['7', 'Sortie (carte)']], help: 'Valide les énigmes précédentes. À combiner avec « Téléporter ».' },
    { id: 'aWin', label: 'Terminer la partie (réveil)', kind: 'button', action: 'win' },
  ] },
];

const ITEMS = SCHEMA.flatMap((t) => t.items).filter((i) => i.id && i.kind !== 'button');
const DEFAULTS = Object.fromEntries(ITEMS.map((i) => [i.id, i.def]));

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    delete saved.lang; // Le jeu est uniquement en français.
    if ([1.35, 0.6].includes(saved.dExposure)) delete saved.dExposure; // Old defaults, saved along with every setting.
    if (saved.dDuration === 120) delete saved.dDuration; // 2 min was the room demo's; the whole story needs more.
    return { ...DEFAULTS, ...saved };
  } catch { return { ...DEFAULTS }; }
}
export const cfg = load();
for (const i of ITEMS) if (i.transient) cfg[i.id] = i.def;

const listeners = new Set();
export function onCfg(fn) { listeners.add(fn); }
export function setCfg(id, value) {
  cfg[id] = value;
  save();
  for (const fn of listeners) fn(id, value);
}
export function save() {
  const out = {};
  for (const i of ITEMS) if (!i.transient) out[i.id] = cfg[i.id];
  try { localStorage.setItem(KEY, JSON.stringify(out)); } catch { /* private mode: settings last for the session */ }
}
export function resetCfg(filter = () => true) {
  for (const i of ITEMS) if (filter(i)) setCfg(i.id, i.def);
}
const DEV_IDS = new Set(SCHEMA.find((t) => t.tab === 'dev').items.map((i) => i.id));
export const isDev = (i) => DEV_IDS.has(i.id);
export const isKey = (id) => ITEMS.find((i) => i.id === id)?.kind === 'key';

// Readable label for a key code, using the real keyboard layout when the browser exposes it (AZERTY → Z Q S D).
let layout = null;
navigator.keyboard?.getLayoutMap?.().then((m) => { layout = m; }).catch(() => {});
export function keyLabel(code) {
  const k = layout?.get(code);
  if (k) return k.toUpperCase();
  const map = { Space: 'ESPACE', ShiftLeft: 'MAJ', ShiftRight: 'MAJ', ControlLeft: 'CTRL', ControlRight: 'CTRL', Tab: 'TAB', Enter: 'ENTRÉE', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', AltLeft: 'ALT' };
  return map[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'PAV ');
}
