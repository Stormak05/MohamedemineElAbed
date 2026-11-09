import * as THREE from 'three';
import { layoutOf } from './hopital/mobilier.js';
import { ROOMS, FH } from './hopital/plan.js';
import { canvasTexture, mat } from './util.js';

// The story of Clausus, from the team's design document (énigmes, déroulement, fins). main.js plays it.
//
// Étage 1 (zone d'hospitalisation)
//   1. Chambre 104 fermée à clé ; boîte du soignant à cadenas contenant la clé. Code à 4 chiffres : 2 derniers chiffres de la chambre + numéro de patient = 0427.
//      Indices : bracelet, feuille de soins (chambre 104) ; fiche sur le bureau (patient n° 27).
//   2. Archives : lampe torche dans le tiroir du bureau ; sur le PC, le dossier CH_104 / PATIENT_27 donne le psychiatre
//      référent, le Dr William Morel.
//   3. Laverie (noire, il faut la lampe) : les blouses portent un prénom ; celle du Dr William Morel a son trousseau.
//      L'enfiler est un choix : sans elle, le personnel du rez-de-chaussée reconnaît le patient.
//   Le trousseau ouvre la porte de l'escalier (et appelle l'ascenseur).
// Rez-de-chaussée (zone commune)
//   Arrivée : sans blouse, rattrapé (sédatif, fin) ; avec la blouse, l'infirmière de l'accueil lui parle (choix).
//   4. Poste de sécurité (trousseau) : note sur le casier, PC avec le programme de déchiffrement à corriger → CLAUSUS
//      ouvre le casier → clé de la salle de réunion.
//   5. Salle de réunion : planning de garde (5 étiquettes, contraintes) → le nom du Dr Morel s'illumine ; la consigne
//      donne le code du coffret : les 4 tâches avant les transmissions, chiffres en ordre croissant = 2368.
//   6. Cabinet du Dr Morel (007) : coffret 2368 → carte d'accès → portique de sortie → il se réveille dans sa chambre.
//   Bonus : pièces cachées → téléphone (1 indice par énigme au plus) ou distributeur de la pharmacie (1 cachet).

export const STORY = {
  room: '104', patient: '27', padlock: '0427',
  psy: 'Dr William Morel', coffre: '2368',
};

// ---------- Énigme 2: the archives' files ----------
const f = (name, text, extra = {}) => ({ name, text, ...extra });
const patientFile = (n, room, since, psy, note) => f(`PATIENT_${n}.TXT`, `DOSSIER PATIENT N° ${n}\nChambre : ${room} (étage 1, aile B)\n${since}\nPsychiatre référent : ${psy}\n\n${note}`);
export const ARCHIVES = { name: 'C:\\ARCHIVES', children: [
  { name: 'ETAGE_1_AILE_B', note: 'chambres 101 à 114', children: [
    { name: 'CH_101', children: [patientFile('08', 101, 'Admis le 03/02.', 'Dr Sarah Bernard', 'Insomnie chronique. Calme.'), patientFile('19', 101, 'Sorti le 11/06.', 'Dr Antoine Faure', 'Sortie autorisée.')] },
    { name: 'CH_102', children: [patientFile('14', 102, 'Admise le 21/09.', 'Dr Sarah Bernard', 'Sortie prévue le 05/11.')] },
    { name: 'CH_103', children: [patientFile('22', 103, 'Transféré le 30/10.', 'Dr Antoine Faure', 'Transféré en aile C.')] },
    { name: 'CH_104', note: '3 fichiers', children: [
      { ...patientFile('12', 104, 'Sorti le 02/04 (ancien occupant).', 'Dr Hélène Morel', 'Dossier clos. Le Dr Hélène Morel a pris sa retraite.'), read: 'oldMorel' },
      { ...patientFile('27', 104, 'Admis le 12/10.', STORY.psy, "Le patient affirme ne pas être malade. Refuse son traitement. Parle de « sortir » la nuit.\nConduite à tenir : surveillance renforcée. Chambre fermée à clé. Boîte de service : code = 2 derniers chiffres de la chambre + n° de patient.\nBlouse et trousseau du Dr Morel : à la laverie pour la nuit."), own: true, read: 'psy' },
      patientFile('31', 104, 'Transféré le 09/08 (ancien occupant).', 'Dr Antoine Faure', 'Transféré en aile C.'),
    ] },
    { name: 'CH_105', children: [patientFile('05', 105, 'Admise le 17/08.', 'Dr Sarah Bernard', 'Calme. Visite de sa fille jeudi.')] },
    { name: 'CH_106', children: [] },
    { name: 'CH_107', children: [patientFile('33', 107, 'Admis le 28/10.', 'Dr William Morel', 'Agité la nuit. Contention interdite sans avis médical.')] },
  ] },
  { name: 'RDC_CONSULTATIONS', children: [
    f('CABINETS.TXT', 'Cabinet 005 : Dr Antoine Faure\nCabinet 006 : Dr Sarah Bernard\nCabinet 007 : Dr William Morel\n\nSalle de réunion : 008. Pharmacie : 009. Poste de sécurité : 001.'),
  ] },
  { name: 'PERSONNEL', children: [
    f('MEDECINS.TXT', 'Dr Sarah Bernard - psychiatre\nDr Antoine Faure - psychiatre\nDr Hélène Morel - psychiatre (retraitée)\nDr William Morel - psychiatre\nLucas Perrin - infirmier de nuit\n\nLes blouses sont lavées chaque nuit et suspendues à la laverie.'),
  ] },
] };

// ---------- Énigme 4: the decryption program ----------
// The document's code, with its three mistakes: each faulty spot cycles through its variants.
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', MESSAGE = 'HQFZXZX', ANSWER = 'CLAUSUS';
export const CIPHER = {
  spots: [
    { options: ['0', '""', '"A"'] }, // resultat ← 0 : a number instead of an empty text
    { options: ['(position + 4) MOD 26', '(position − 4) MOD 26', '(position + 5) MOD 26', '(position − 5 + 26) MOD 26'] },
    { options: ['resultat ← alphabet[nouvelle_position]', 'resultat ← alphabet[position]', 'resultat ← resultat + alphabet[nouvelle_position]'] },
  ],
  lines: [
    ['alphabet ← "ABCDEFGHIJKLMNOPQRSTUVWXYZ"'],
    [`message ← "${MESSAGE}"`],
    ['resultat ← ', 0],
    [''],
    ['POUR CHAQUE lettre DANS message'],
    ['    position ← POSITION(lettre, alphabet)'],
    ['    nouvelle_position ← ', 1],
    ['    ', 2],
    [''],
    ['AFFICHER resultat'],
  ],
  // Runs the program as written: the trace shows each letter, the casier opens only on CLAUSUS.
  run(pick) {
    const shift = [4, -4, 5, -5][pick[1]];
    const init = ['0', '', 'A'][pick[0]];
    const trace = [];
    let res = init, number = pick[0] === 0;
    for (const ch of MESSAGE) {
      const p = ALPHA.indexOf(ch), np = (((p + shift) % 26) + 26) % 26;
      const out = pick[2] === 1 ? ALPHA[p] : ALPHA[np];
      trace.push(`${ch}(${p}) -> ${String(np).padStart(2)} -> ${out}`);
      if (pick[2] === 2) {
        if (number) return { trace, ok: false, msg: 'ERREUR : on ne peut pas ajouter une lettre au nombre 0.' };
        res += out;
      } else { res = out; number = false; }
    }
    const ok = res === ANSWER;
    return { trace, ok, msg: ok ? `Résultat : ${res}  ->  CASIER 3 DÉVERROUILLÉ` : `Résultat : ${res || '(vide)'}  ->  mot de passe refusé` };
  },
};

export const PROFILES = {
  archives: {
    name: 'Poste ARCHIVES', icons: ['files', 'readme', 'trash'],
    readme: 'ARCHIVES PATIENTS - MEDISYS\n\nUn dossier par étage, puis un dossier par chambre (CH_101, CH_102...). Chaque chambre garde les fichiers de ses occupants, actuels et anciens, sous leur numéro de patient (PATIENT_27.TXT...).\n\nNe pas sortir les dossiers papier de la salle.',
    trash: ['memo_lampe.txt', "La lampe torche du bureau est dans le tiroir. La laverie n'a toujours pas de courant : la prendre avant d'y porter les blouses."],
  },
  securite: {
    name: 'Poste SÉCURITÉ', icons: ['cipher', 'readme', 'trash'],
    readme: "CASIER ÉLECTRONIQUE N° 3\n\nIl s'ouvre avec un mot de passe. Le mot de passe a été chiffré en avançant chaque lettre de cinq positions dans l'alphabet ; pour le déchiffrer, il faut reculer de cinq positions : H devient C.\n\nLe programme DECHIFFRE.ALG fait ce travail et envoie le résultat au casier, mais quelqu'un l'a modifié : il contient des erreurs. Les positions vont de 0 (A) à 25 (Z). Corriger, puis « Tester ».",
    trash: ['brouillon.alg', "resultat ← resultat + ... : ajouter chaque lettre au texte, sinon il ne reste que la dernière.\nUn texte commence vide (\"\"), pas à 0.\nReculer de 5 : -5, et +26 pour revenir à la fin de l'alphabet avant A."],
  },
};

// ---------- Énigme 5: the night shift board ----------
export const TASKS = [
  { id: 'dossiers', label: 'Consulter les dossiers', n: 6 },
  { id: 'reunion', label: 'Participer à la réunion de relève', n: 3 },
  { id: 'visite', label: 'Effectuer la visite des patients', n: 8 },
  { id: 'traitements', label: 'Administrer les traitements prescrits', n: 2 },
  { id: 'transmissions', label: 'Rédiger les transmissions', n: 5 },
];
export const SLOTS = ['21 h 00', '21 h 30', '22 h 00', '22 h 30', '23 h 00'];
export const SOLUTION = ['dossiers', 'reunion', 'visite', 'traitements', 'transmissions'];
export const RULES = [
  'Une seule tâche par créneau.',
  'Les dossiers doivent être consultés avant la réunion.',
  'La visite des patients commence immédiatement après la réunion.',
  'Les traitements sont administrés après la visite.',
  'Les transmissions sont rédigées en dernier.',
];
export const CONSIGNE = '« Le médecin chargé de la visite conserve la carte de sortie dans son cabinet. Son code de coffre correspond aux quatre tâches qui précèdent les transmissions, dans l\'ordre croissant. »';
export const ANNUAIRE = [
  { at: '21 h 30', task: 'Réunion', who: 'Dr Sarah Bernard', cab: 'cabinet 006' },
  { at: '22 h 00', task: 'Visite', who: STORY.psy, cab: 'cabinet 007', key: true },
  { at: '22 h 30', task: 'Traitements', who: 'Infirmier Lucas Perrin', cab: 'poste infirmier' },
];

// ---------- Énigme 3: the coats in the laundry ----------
// voice: his take reading the name (« La blouse de … », PAT_P30 one coat per take; none for the Dr William Morel).
export const COATS = [
  { who: 'Dr Sarah Bernard', pocket: 'Un stylo et un badge de parking.', voice: 'PAT_P30' },
  { who: 'Dr Hélène Morel', pocket: 'coin', voice: 'PAT_P30_3' },
  { who: STORY.psy, pocket: 'keys' },
  { who: 'Dr Antoine Faure', pocket: 'Un paquet de mouchoirs.', voice: 'PAT_P30_2' },
  { who: 'Lucas Perrin, infirmier', pocket: 'Une liste de chambres… la 104 est entourée.', voice: 'PAT_P30_4' },
];

// ---------- Hints: one per énigme, bought with a coin at a phone ----------
export function stageOf(G) {
  if (!G.unlocked) return 1;
  if (!G.torch || !G.psyKnown) return 2;
  if (!G.keys || !G.blouse) return 3;
  if (!G.meetingKey) return 4;
  if (!G.planning) return 5;
  if (!G.card) return 6;
  return 7;
}
export const HINTS = {
  1: ['…Allô ? C\'est toi, la 104 ?', 'La boîte oubliée sur ton bureau contient une clé. Son cadenas, quatre chiffres. Ils ne se cassent pas la tête : le numéro de la chambre, puis le tien.', 'Les deux derniers chiffres de ta chambre, puis ton numéro de patient. Il est sur ton bureau. Ta chambre, regarde ton bracelet.'],
  2: ['Tu es dehors. Bien.', 'La laverie est noire comme un four. Il y a une lampe dans le tiroir du bureau, aux archives.', 'Et sur l\'ordinateur des archives, cherche ta chambre, puis ton numéro. Retiens le nom de ton psychiatre.'],
  3: ['Les blouses des médecins sèchent à la laverie, un prénom brodé sur chacune.', 'Prends celle de ton psychiatre : son trousseau est dans la poche. Il ouvre l\'escalier.', 'Et enfile-la. En bas, un patient en pyjama, ils le reconnaîtront tout de suite.'],
  4: ['Le poste de sécurité, au fond à gauche de l\'accueil. Le trousseau l\'ouvre.', 'Le casier s\'ouvre avec un mot déchiffré. Le programme sur le PC est faux à trois endroits :', 'un texte qui commence à 0, un mauvais décalage, et une lettre qui écrase la précédente au lieu de s\'ajouter.'],
  5: ['La salle de réunion. Le tableau de garde.', 'Les dossiers avant la réunion, la visite juste après la réunion, les traitements après la visite, les transmissions à la fin.'],
  6: ['Le médecin de la visite garde la carte dans son cabinet. Le 007.', 'Le code du coffret : les chiffres des quatre premières étiquettes, du plus petit au plus grand.'],
  7: ['Tu as la carte. La sortie est au bout du hall, après l\'accueil.', 'Va. Ne te retourne pas.', '…Et cette fois, ne reviens pas.'],
};

// Léa, the girl in the photo above the bed and on the "PAPA" drawings: heard, never seen, never explained.
// Ids are the voice sheet's codes (LEA_01…); main.js plays assets/audio/voix/<id>.mp3 once recorded.
export const LEA = {
  phone: { id: 'LEA_01', text: 'Papa ? Tu rentres quand ?' }, // after a phantom ring
  drawing: { id: 'LEA_03', text: 'Je t\'ai fait un dessin !' }, // looking at the drawings, once he is far gone
  soleil: { id: 'LEA_04', text: 'Un, deux, trois… soleil !' }, // the figure vanishes as he turns to it
  goodnight: { id: 'LEA_09', text: 'Bonne nuit, papa.' }, // waking up in room 104
  halluc: [
    { id: 'LEA_02', text: 'Papa, t\'es où ?' },
    { id: 'LEA_05', text: 'Maman dit que t\'es malade.' },
    { id: 'LEA_06', text: 'Papa, tu mens.' },
    { id: 'LEA_07', text: 'Tu m\'as promis.' },
    { id: 'LEA_08', text: 'Chut. Ils écoutent.' },
  ],
};

// ---------- Where things are, in main.js coordinates (floor 1 at y = 0, ground floor at y = -FH) ----------
// u to the right seen from the door, v towards the far wall, from the centre of the room (mobilier.js).
export function spot(f, room, u, v, h = 0) {
  const r = ROOMS[f].find((x) => x[4] === room);
  const L = layoutOf(f, ...r.slice(0, 5));
  return {
    x: L.cx + L.right[0] * u + L.fwd[0] * v, y: (f === 1 ? 0 : -FH) + h, z: L.cz + L.right[1] * u + L.fwd[1] * v,
    // yaw that turns a model's +Z towards the far wall (fwd), and the room's half sizes.
    yaw: Math.atan2(L.fwd[0], L.fwd[1]), hu: L.hu, hv: L.hv, fwd: L.fwd, right: L.right,
  };
}

// ---------- Puzzle objects built in code ----------
// Placeholders until the team makes them in Blockbench (REGLES_ASSETS.md): padlock, coat rack and coats, locker, boards,
// coffret, medicine dispenser. Text (tags, notes, boards) is painted on canvases, like the room's sheet and the plates.
const paint = (w, h, fn) => canvasTexture(w, h, fn);
const label = (text, { w = 128, h = 32, bg = '#e8e2cc', fg = '#22201a', font = 'bold 15px monospace' } = {}) => paint(w, h, (ctx) => {
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  while (ctx.measureText(text).width > w - 8 && size > 7) { size--; ctx.font = font.replace(/\d+px/, `${size}px`); }
  ctx.fillText(text, w / 2, h / 2 + 1);
});
const plane = (w, h, map, basic = false) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map }) : mat({ map }));
const STEEL = mat({ color: 0x8a8e8c }), DARK = mat({ color: 0x2a2c2c }), CLOTH = mat({ color: 0xe6e4da });

// Coat rack against a wall, coats facing -Z of the group (towards the room once turned).
export function makeCoatRack() {
  const g = new THREE.Group();
  const pole = (x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.85, 8), STEEL); m.position.set(x, 0.925, 0); g.add(m); };
  pole(-1.55); pole(1.55);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 3.1, 8), STEEL);
  rail.rotation.z = Math.PI / 2; rail.position.y = 1.82; g.add(rail);
  const coats = COATS.map((c, i) => {
    const coat = new THREE.Group();
    coat.position.set(-1.2 + i * 0.6, 1.8, 0);
    const hanger = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 4, 8), STEEL);
    hanger.position.y = 0.01;
    const shoulders = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 0.12, 6, 1), CLOTH);
    shoulders.scale.z = 0.4; shoulders.position.y = -0.08;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.95, 6, 1), CLOTH);
    body.scale.z = 0.4; body.position.y = -0.62;
    const tag = plane(0.14, 0.04, label(c.who.replace(', infirmier', ''), { w: 128, h: 36, bg: '#f4f2ea', fg: '#1c2a5a', font: 'bold 16px monospace' }));
    tag.position.set(0.06, -0.3, -0.081); tag.rotation.y = Math.PI;
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.01), mat({ color: 0xd4d2c8 }));
    pocket.position.set(-0.08, -0.75, -0.1);
    coat.add(hanger, shoulders, body, tag, pocket);
    coat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(coat);
    return coat;
  });
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return { group: g, coats };
}

// Electronic locker (three doors), front towards -Z; door 3 opens when the program outputs CLAUSUS.
export function makeLocker() {
  const g = new THREE.Group();
  const W = 0.45, H = 1.8, D = 0.45;
  const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mat({ color: 0x6f7d78 }));
  shell.position.set(0, H / 2, 0); g.add(shell);
  const doors = [];
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(-W / 2, 0.05 + i * 0.58, -D / 2 - 0.05); // doors stand off the shell: room for the key behind
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 0.54, 0.012), mat({ color: 0x7e8c86 }));
    leaf.position.set(W / 2, 0.27, 0);
    const num = plane(0.06, 0.04, label(String(3 - i), { w: 32, h: 24, bg: '#d8d0b0' }));
    num.position.set(W / 2, 0.44, -0.007); num.rotation.y = Math.PI;
    pivot.add(leaf, num);
    g.add(pivot);
    doors.push(pivot);
  }
  // Top door = n° 3: keypad and LED.
  const top = doors[2];
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.012), DARK);
  pad.position.set(W - 0.07, 0.25, -0.01); top.add(pad);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.01), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1) }));
  led.position.set(W - 0.07, 0.33, -0.014); top.add(led);
  // Behind door 3: a dark back plate (the compartment) and the key on its hook, in front of the shell.
  const back = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 0.54, 0.02), mat({ color: 0x1c201e }));
  back.position.set(0, 1.21 + 0.27, -D / 2 - 0.01); g.add(back);
  const key = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 10), mat({ color: 0xb89a40 }));
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.004), mat({ color: 0xb89a40 }));
  bit.position.y = -0.045; key.add(ring, bit);
  const tag = plane(0.05, 0.025, label('RÉUNION', { w: 64, h: 24, bg: '#d8c060', font: 'bold 12px monospace' }));
  tag.position.set(0.035, -0.03, -0.005); tag.rotation.y = Math.PI; key.add(tag);
  key.position.set(0, 1.6, -D / 2 - 0.032); // between the back plate and the closed door
  g.add(key);
  // The note taped on it.
  const note = plane(0.16, 0.12, paint(64, 48, (ctx) => {
    ctx.fillStyle = '#efe6b0'; ctx.fillRect(0, 0, 64, 48);
    ctx.fillStyle = '#26408a'; for (let y = 8; y < 44; y += 6) ctx.fillRect(5, y, 20 + ((y * 7) % 30), 1);
  }));
  note.position.set(-0.05, 0.95, -D / 2 - 0.058); note.rotation.set(0, Math.PI, 0.05); // on door 2
  g.add(note);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, doors, led, key, note, open: doors[2] };
}

// A wall board, front towards -Z, with a canvas the code redraws.
export function makeBoard(w, h, px, draw) {
  const c = document.createElement('canvas');
  c.width = px; c.height = Math.round(px * h / w);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.03), DARK);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat({ map: tex }));
  face.position.z = -0.017; face.rotation.y = Math.PI;
  g.add(frame, face);
  const redraw = (...a) => { draw(c.getContext('2d'), c.width, c.height, ...a); tex.needsUpdate = true; };
  redraw();
  return { group: g, face, redraw };
}

// Small locked box (coffret) on a desk: lid on a hinge at the back, the exit card inside.
export function makeCoffret() {
  const g = new THREE.Group();
  const W = 0.32, H = 0.14, D = 0.22, T = 0.012;
  const steel = mat({ color: 0x3e4a44 });
  // A floor and four walls leave the contents visible inside the opened box.
  for (const [w, h, d, x, y, z] of [
    [W, T, D, 0, T / 2, 0],
    [W, H - T, T, 0, (H + T) / 2, -(D - T) / 2],
    [W, H - T, T, 0, (H + T) / 2, (D - T) / 2],
    [T, H - T, D - 2 * T, -(W - T) / 2, (H + T) / 2, 0],
    [T, H - T, D - 2 * T, (W - T) / 2, (H + T) / 2, 0],
  ]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel);
    panel.position.set(x, y, z); g.add(panel);
  }
  const lid = new THREE.Group();
  lid.position.set(0, H, D / 2);
  const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.01, 0.025, D + 0.01), steel);
  top.position.set(0, 0.0125, -D / 2); lid.add(top);
  g.add(lid);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.01), mat({ color: 0x9a7a2a }));
  lock.position.set(0, H * 0.6, -D / 2 - 0.005); g.add(lock);
  const dials = plane(0.06, 0.016, label('_ _ _ _', { w: 64, h: 16, bg: '#1a1a16', fg: '#d8d0b0', font: 'bold 12px monospace' }));
  dials.position.set(0, H * 0.6, -D / 2 - 0.011); dials.rotation.y = Math.PI; g.add(dials);
  const card = plane(0.085, 0.054, label('ACCÈS', { w: 64, h: 40, bg: '#e8e4d8', fg: '#1f5a8a', font: 'bold 13px monospace' }));
  card.rotation.x = -Math.PI / 2; card.position.set(0, T + 0.003, 0); g.add(card);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, lid, card };
}

// Reuse the existing service coffret, replacing its access card with a room key.
export function makeRoomBox() {
  const box = makeCoffret();
  box.card.removeFromParent();
  const key = new THREE.Group();
  const brass = mat({ color: 0xb89a40 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 10), brass);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.004), brass);
  shaft.position.y = -0.045;
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.009, 0.004), brass);
  tooth.position.set(0.006, -0.068, 0);
  key.add(ring, shaft, tooth);
  key.rotation.x = -Math.PI / 2;
  key.position.set(0, 0.017, -0.03);
  box.group.add(key);
  return { group: box.group, lid: box.lid, key };
}

// Medicine dispenser of the pharmacy: a cabinet with a glass front, a coin slot and a tray. Front towards -Z.
export function makeDispenser() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.75, 0.5), mat({ color: 0xd8d4c6 }));
  body.position.y = 0.875; g.add(body);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.8), new THREE.MeshBasicMaterial({ color: 0x0e1a18 }));
  glass.position.set(-0.08, 1.15, -0.251); glass.rotation.y = Math.PI; g.add(glass);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), mat({ color: [0xd06a50, 0x6aa0c0, 0xe0d070, 0xf0f0e8][(r + k) % 4] }));
    box.position.set(-0.24 + k * 0.105, 0.86 + r * 0.19, -0.24); g.add(box);
  }
  const sign = plane(0.62, 0.12, label('MÉDICAMENTS · 1 PIÈCE', { w: 160, h: 32, bg: '#1f5a3a', fg: '#e8f0e0', font: 'bold 13px monospace' }), true);
  sign.position.set(0, 1.65, -0.252); sign.rotation.y = Math.PI; g.add(sign);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.02), DARK);
  slot.position.set(0.25, 1.1, -0.255); g.add(slot);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.05), DARK);
  tray.position.set(0, 0.45, -0.26); g.add(tray);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { group: g, slot };
}

// ---------- Documents (HTML for main.js's reader) ----------
export const DOCS = {
  fiche: `<h3>FICHE DE SÉJOUR</h3><div class="sub">C.H.S. Les Tilleuls · étage 1 · aile B</div>
    <table><tr><td>N° de patient</td><td><b>${STORY.patient}</b></td></tr><tr><td>Admission</td><td>12/10</td></tr>
    <tr><td>Traitement</td><td>4 cachets, si agitation</td></tr><tr><td>Sorties</td><td>non autorisées</td></tr></table>
    <div class="hand">Boîte de service : les deux derniers chiffres de la chambre + n° de patient. — L. Perrin<br>Perrin, récupère ta boîte et la clé de service après la ronde.</div>`,
  noteCasier: `<h3>Note scotchée sur le casier</h3>
    <div class="hand">Je n'ai trouvé personne, alors j'ai déposé les clefs de la salle de réunion dans le casier.<br>Le mot de passe passe par le PC (programme DECHIFFRE). — Sécurité</div>`,
};

// Pocket cassette recorder, laid flat on the desk. +Y is its top face.
export function makeDictaphone() {
  const group = new THREE.Group();
  group.name = 'morel_dictaphone';
  const box = (w, h, d, material, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); group.add(mesh); return mesh;
  };
  box(0.13, 0.035, 0.22, DARK, 0, 0.018, 0);
  box(0.1, 0.004, 0.075, STEEL, 0, 0.038, -0.04);
  for (const x of [-0.027, 0.027]) {
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.005, 8), DARK);
    spool.position.set(x, 0.042, -0.04); group.add(spool);
  }
  for (let i = 0; i < 4; i++) box(0.02, 0.008, 0.025, i === 0 ? mat({ color: 0x943a31 }) : STEEL, -0.039 + i * 0.026, 0.04, 0.07);
  const tag = plane(0.115, 0.025, label('W. MOREL'));
  tag.rotation.x = -Math.PI / 2; tag.position.set(0, 0.037, 0.015); group.add(tag);
  return group;
}
