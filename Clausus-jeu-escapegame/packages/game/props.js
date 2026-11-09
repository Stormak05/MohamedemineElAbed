import * as THREE from 'three';
import { loadModel } from './decor.js';
import { attachCameraEye, trackCamera } from './surveillance.js';
import { RX, RZ_BACK, RZ_FRONT, RH, TABLE, DOOR, WIN } from './world.js';

// Room props from assets/props/ (Blockbench sources in blockbench/props/, previews in preview/).
// Prop origins follow blockbench/props/BRIEF.md: floor props stand on their origin, wall props have their back on
// local z = 0 and face -Z, ceiling props hang from local y = 0.
// Some props have decay states: they join the decor slots and, like them, only change while out of view.

const W = Math.PI / 2;
// Wall yaw: the prop's front (-Z) faces into the room.
const WALL = { back: Math.PI, front: 0, left: -W, right: W };

// Glowing parts (names ending in _led or _lamp) use their own texture at full brightness.
function glow(root, boost = 1.6) {
  const lights = [];
  root.traverse((o) => {
    if (!o.isMesh || !/_(led|lamp)$/.test(o.name)) return;
    o.material = new THREE.MeshBasicMaterial({ map: o.material.map, color: new THREE.Color(boost, boost, boost) });
    lights.push(o);
  });
  return lights;
}

export async function loadProps(scene, loader, { bed, doorPivot }) {
  const placed = {};
  const tiles = [];
  const colliders = [];
  const solid = (root, pad = 0) => {
    const b = new THREE.Box3().setFromObject(root);
    colliders.push([b.min.x - pad, b.max.x + pad, b.min.z - pad, b.max.z + pad]);
  };

  async function put(file, x, y, z, ry = 0, parent = scene) {
    const m = await loadModel(loader, `props/${file}`);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    parent.add(m);
    m.updateMatrixWorld(true);
    placed[file] = m;
    return m;
  }

  // One slot per decay level (0 clean … 3 worst); each entry is null (nothing) or [file, x, y, z, ry, parent?].
  // An entry may repeat the previous file at another spot: the prop then "moves" between two glances.
  async function states(entries) {
    const roots = await Promise.all(entries.map((e) => (e ? put(e[0], e[1], e[2], e[3], e[4] ?? 0, e[5]) : null)));
    const shown = roots.map((r) => r ?? new THREE.Group());
    shown.forEach((r, i) => { r.visible = i === 0; });
    const boxes = shown.map((r) => (r.parent ? new THREE.Box3().setFromObject(r) : new THREE.Box3()));
    const tile = { roots: shown, boxes, level: 0, apply: (lv) => shown.forEach((r, i) => { r.visible = i === lv; }) };
    tiles.push(tile);
    return tile;
  }

  const bedLocal = (x, y, z) => [x / 16, y / 16, z / 16]; // bed model units (16 = 1 m), in the bed's own frame

  const jobs = [
    // ---------- Furniture ----------
    put('nightstand', -0.3, 0, -RZ_BACK + 0.21, WALL.back).then((m) => solid(m)),
    put('meal_tray', -0.3, 0.6, -RZ_BACK + 0.22, WALL.back + 0.12),
    put('wardrobe_open', -RX + 0.25, 0, 1.2, WALL.left).then((m) => solid(m)),
    put('books_pile', -RX + 0.2, 0, 0.42, 0.3),
    put('sink', -0.75, 0, RZ_FRONT, WALL.front).then((m) => {
      solid(m);
      // Toothbrush cup on the back corner of the rim (the basin's top, not the tap's).
      const b = new THREE.Box3().setFromObject(m.getObjectByName('basin_shell') ?? m);
      return put('toothbrush_cup', b.min.x + 0.05, b.max.y, b.max.z - 0.05, 2.6);
    }),
    put('mirror_steel', -0.75, 1.22, RZ_FRONT - 0.005, WALL.front),
    put('toilet_steel', -1.6, 0, RZ_FRONT - 0.275, WALL.front).then((m) => {
      solid(m);
      // Its water turns black at the last stage.
      const water = m.getObjectByName('water');
      if (!water) return;
      water.material = water.material.clone();
      const clean = water.material.color.clone();
      const box = new THREE.Box3().setFromObject(m);
      tiles.push({ boxes: [box, box, box, box], level: 0, apply: (lv) => { water.material.color.copy(clean).multiplyScalar(lv === 3 ? 0.08 : 1); } });
    }),
    put('radiator', -1.0, 0, -RZ_BACK, WALL.back),
    put('iv_pole', -0.32, 0, -2.2, 0.4).then((m) => solid(m, -0.12)),
    put('slippers', 0.72, 0, -1.78, Math.PI - 0.25),
    put('pill_organizer', 0.45, TABLE.h, -0.3, 0.06),
    put('dose_cup', 0.6, TABLE.h, 0.06, 0),
    put('id_bracelet', 0.13, TABLE.h, -0.28, 0.5),
    // On the bed, in its own frame (the bed is turned a quarter, head towards -x).
    put('diary', ...bedLocal(-2.2, 11.5, 7), 0.4, bed),
    put('plush', ...bedLocal(-3.2, 11.5, -6.5), W - 0.3, bed),
    put('clipboard', RX - 0.005, 0.98, -0.55, WALL.right),

    // ---------- Fixtures ----------
    // On the solid wall to the right of the window, within reach above the nightstand.
    put('nurse_call', WIN.x + WIN.w / 2 + 0.28, 0.98, -RZ_BACK, WALL.back),
    put('light_switch_locked', RX, 1.08, 1.22, WALL.right),
    put('wall_clock', RX - 0.003, 2.0, -0.65, WALL.right),
    put('vent_grille', 0.95, 2.3, RZ_FRONT, WALL.front),
    put('smoke_detector', 0.5, RH, -0.9, 0),
    put('camera_corner', -RX, RH, RZ_FRONT, -W / 2),

    // ---------- Decay states ----------
    // The drawings stay up (« Toujours là ») until the last state swaps them for the corrupted ones.
    states([['kid_drawings', -RX + 0.004, 1.28, -1.85, WALL.left], null, null, ['kid_drawings_4', -RX + 0.004, 1.28, -1.85, WALL.left]]).then((tile) => {
      const [clean, , , dirty] = tile.roots, [cleanBox, , , dirtyBox] = tile.boxes;
      tile.boxes = [cleanBox, cleanBox, cleanBox, dirtyBox];
      tile.apply = (lv) => { clean.visible = lv < 3; dirty.visible = lv === 3; };
    }),
    states([null, ['ceiling_stain', 1.0, RH, 0.9, 0.3], ['ceiling_stain', 1.0, RH, 0.9, 0.3], ['ceiling_stain', 1.0, RH, 0.9, 0.3]]),
    states([null, null, ['puddle_bucket', 1.0, 0, 0.9, 0.3], ['puddle_bucket', 1.0, 0, 0.9, 0.3]]),
    states([null, null, ['decal_scratches', RX - 0.002, 0.45, 0.6, WALL.right], ['decal_scratches', RX - 0.002, 0.45, 0.6, WALL.right]]),
    states([null, null, null, ['decal_handprints', 0.85, 1.0, -RZ_BACK + 0.002, WALL.back]]),
    states([null, null, null, ['debris', -1.15, 0, -1.45, 0.4]]),
    states([null, null, ['floor_mattress', 1.45, 0, -0.75, 0.05], ['floor_mattress_torn', 1.45, 0, -0.75, 0.05]]),
    // The blanket slides off the bed, then is found elsewhere each time.
    states([null, ['blanket_floor', 1.5, 0, -1.55, 0.2], ['blanket_floor', -0.6, 0, 2.0, 1.9], ['blanket_floor', 0.0, 0, -1.15, -0.6]]),
    states([null, null, ['doll', -1.7, 0, -2.66, Math.PI - 0.7], ['doll', 0.95, 0, -1.6, Math.PI + 0.4]]),
    states([null, null, null, ['wheelchair', 0.7, 0, 2.35, 0.5]]),
  ];
  // The bed's restraints: its own neat straps, then open, then buckled on an empty bed, then torn.
  const ownStraps = [];
  bed.traverse((o) => { if (/^(strap_(chest|thighs)|cuff_(wrist|ankle)_[lr])$/.test(o.name)) ownStraps.push(o); });
  jobs.push(Promise.all(['restraints_2', 'restraints_3', 'restraints_4'].map((f) => put(f, 0, 0, 0, 0, bed))).then((roots) => {
    roots.forEach((r) => { r.visible = false; });
    const box = new THREE.Box3().setFromObject(bed);
    tiles.push({
      boxes: [box, box, box, box], level: 0,
      apply: (lv) => { ownStraps.forEach((s) => { s.visible = lv === 0; }); roots.forEach((r, i) => { r.visible = lv === i + 1; }); },
    });
  }));
  // The door's flat flaps become the hatch prop: wired-glass window and a food flap that drops open into the room.
  jobs.push(put('door_hatch', DOOR.w / 2, 0, 0, Math.PI, doorPivot).then((m) => {
    for (const leaf of doorPivot.children.filter((c) => c.name === 'door_leaf')) {
      for (const n of ['observation_flap_front', 'observation_flap_back', 'food_hatch_front', 'food_hatch_back']) {
        const o = leaf.getObjectByName(n); if (o) o.visible = false;
      }
    }
    // The leaf is solid: the window is drawn as dark wired glass slightly proud of both faces.
    const glass = m.getObjectByName('hatch_glass');
    glass.material = new THREE.MeshLambertMaterial({ map: glass.material.map, color: new THREE.Color(0.35, 0.4, 0.45) });
    glass.scale.z = 4.2;
  }));
  await Promise.all(jobs);

  // ---------- Live parts ----------
  const camHead = placed.camera_corner.getObjectByName('camera_head');
  const camLed = glow(placed.camera_corner)[0];
  const [eyeModel, eyeMount] = await Promise.all(['props/camera_eye', 'props/camera_eye_mount'].map((file) => loadModel(loader, file)));
  attachCameraEye(camHead, eyeModel, eyeMount);
  const smokeLed = glow(placed.smoke_detector)[0];
  const callLamps = glow(placed.nurse_call, 2.4);
  const OFF = new THREE.Color(0.12, 0.12, 0.12);
  callLamps.forEach((l) => { l.userData.on = l.material.color.clone(); l.material.color.copy(OFF); });
  const callButton = placed.nurse_call.getObjectByName('call_button');
  const hands = ['hand_hour', 'hand_minute', 'hand_second'].map((n) => placed.wall_clock.getObjectByName(n));
  const gown = placed.wardrobe_open.getObjectByName('gown');
  const dollRoots = tiles.flatMap((t) => t.roots ?? []).filter((r) => r.getObjectByName('skull'));
  const lids = [...Array(7)].map((_, i) => placed.pill_organizer.getObjectByName(`lid_${i}`));
  const tornMattress = tiles.flatMap((t) => t.roots ?? []).find((r) => r.getObjectByName('stash'));
  const flap = doorPivot.getObjectByName('hatch_flap');
  const pos = (o) => o.getWorldPosition(new THREE.Vector3());
  const ventPos = pos(placed.vent_grille), radiatorPos = pos(placed.radiator).setY(0.4);

  let callUntil = -1, nextVent = 40, nextRadiator = 25, flapUntil = -1;
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
  // Clock: starts at 03:17 like the HUD and follows the game time; it stutters, then runs backwards as sanity goes.
  const CLOCK_START = 3 * 3600 + 17 * 60;
  let clockS = CLOCK_START;
  const setClock = (gameSeconds) => { clockS = CLOCK_START + gameSeconds; };

  function update(t, dt, loss, camera, audio, running) {
    // Clock.
    if (running) clockS += loss > 0.78 ? -dt * 3 : loss > 0.55 && Math.sin(t * 0.7) > 0.6 ? 0 : dt;
    const s = ((clockS % 43200) + 43200) % 43200;
    const tick = loss > 0.3 ? Math.floor(s) : s; // the second hand jumps once the room starts to rot
    // Seen from the front (-Z), a positive turn about Z is clockwise.
    hands[0].rotation.z = (s / 43200) * Math.PI * 2;
    hands[1].rotation.z = ((s % 3600) / 3600) * Math.PI * 2;
    hands[2].rotation.z = ((tick % 60) / 60) * Math.PI * 2;

    // Surveillance follows the player from the start, at every sanity level.
    trackCamera(camHead, camera.position, dt, loss);
    camLed.visible = !camHead.userData.eye.active && (loss > 0.4 || Math.sin(t * 3) > 0);

    // Smoke detector: a red blink every 4 s.
    smokeLed.visible = t % 4 < 0.12;

    // Nurse call lamp.
    const callOn = t < callUntil && Math.sin(t * 6) > -0.3;
    callLamps.forEach((l) => l.material.color.copy(callOn ? l.userData.on : OFF));

    // The gown in the wardrobe stirs, the doll turns its head towards the player when not watched.
    if (gown) gown.rotation.x = loss > 0.55 ? Math.sin(t * 1.3) * 0.05 * loss + Math.sin(t * 4.1) * 0.01 : 0;
    camera.getWorldDirection(fwd);
    for (const r of dollRoots) {
      const head = r.getObjectByName?.('head');
      if (!head || !r.visible) continue;
      const toDoll = pos(head).sub(camera.position).normalize();
      if (toDoll.dot(fwd) > 0.55) continue; // watched: frozen
      head.parent.worldToLocal(tmp.copy(camera.position));
      head.rotation.y = THREE.MathUtils.clamp(Math.atan2(-tmp.x, -tmp.z), -1.3, 1.3);
    }

    // Food flap: it bangs open by itself now and then at low sanity.
    if (flap) {
      if (running && loss > 0.6 && t > flapUntil + 30 && Math.random() < dt / 20) { flapUntil = t + 1.6; audio.flap(pos(flap)); }
      const k = t < flapUntil ? Math.min(1, (flapUntil - t) * 3, (t - flapUntil + 1.6) * 6) : 0;
      flap.rotation.x = k * 1.2;
    }

    if (!running) return;
    // Vent whispers, radiator knocks.
    if (loss > 0.3 && t > nextVent) { nextVent = t + 30 + Math.random() * 25; audio.whisper(ventPos); }
    if (loss > 0.2 && t > nextRadiator) {
      nextRadiator = t + 35 + Math.random() * 30;
      audio.radiator(radiatorPos);
    }
  }

  // ---------- Interactions (main.js supplies the hands, the moves, thoughts and coins) ----------
  // Each entry: obj, label(), act(), range, hit (an enlarged box to aim at small things, see focus.js).
  function interactions({ G, audio, voices, thought, heard, lea, reach, inspect, lookAt, tween, hands, handOn, yawOf, centerOf, done, rest, pickUpCoin, wait }) {
    const list = [];
    const add = (obj, label, act, range = 1.8, hit = null) => obj && list.push({ obj, label, act, range, hit });
    // The way a wall prop faces (its front is local -Z), flat.
    const faceOf = (o) => new THREE.Vector3(0, 0, -1).transformDirection(o.matrixWorld).setY(0).normalize();
    // Press something on a wall with the index.
    async function press(obj, at, { face = faceOf(obj), depth = 0.006 } = {}) {
      const ry = yawOf(face);
      await reach(at, { face, grip: 'point', pitch: -0.05 });
      await hands.right.to(handOn(hands.right, at.clone().addScaledVector(face, -depth), -0.05, ry, 0, { tip: true }), 0.1, 'point');
      await wait(0.08);
      await hands.right.to(handOn(hands.right, at.clone().addScaledVector(face, 0.03), -0.05, ry, 0, { tip: true }), 0.12, 'point');
    }

    let called = false;
    add(placed.nurse_call, () => 'Appeler l\'infirmière', async () => {
      G.mode = 'busy';
      const at = centerOf(callButton);
      await press(placed.nurse_call, at, { depth: 0 });
      callButton.position.z += 0.006; audio.click(at, 0.3);
      await wait(0.15);
      callButton.position.z -= 0.006;
      await rest();
      callUntil = G.time + 18;
      audio.nurseCall(at);
      done();
      // The first call: he asks politely, then louder.
      if (!called) {
        called = true;
        await wait(1.4);
        const voice = await thought('Il y a quelqu\'un ? …S\'il vous plaît !', { dur: 3 });
        await wait(voice ? voice.remaining + 0.4 : 1.6);
      } else await wait(3);
      if (1 - G.sanity > 0.5) voices.hal(Math.random() < 0.5 ? 'HAL_04' : 'HAL_05', { strength: 1 - G.sanity, pos: () => at });
      else thought('Personne ne répond… Ils ne viennent jamais la nuit.');
    }, 1.8, { pad: 0.03 });

    // Pill organizer: the index flips the seven lids one after the other.
    let lidsOpen = false;
    add(placed.pill_organizer, () => (lidsOpen ? 'Fermer le pilulier' : 'Ouvrir le pilulier'), async () => {
      G.mode = 'busy';
      lidsOpen = !lidsOpen;
      const order = lidsOpen ? lids : [...lids].reverse();
      const yaw = await reach(centerOf(placed.pill_organizer), { grip: 'point' });
      for (const l of order) {
        if (!l) continue;
        const at = centerOf(l);
        await hands.right.to(handOn(hands.right, at.clone().add(new THREE.Vector3(0, 0.02, 0)), -0.9, yaw, 0, { tip: true }), 0.1, 'point');
        audio.click(at, 0.06);
        // Flicked open against its hinge (a little bounce), or pressed shut.
        await tween(0.12, (k) => { l.rotation.x = lidsOpen ? 1.75 * k : 1.75 * (1 - k); }, (k) => (lidsOpen ? 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * 0.06 : k * k));
      }
      await rest();
      done();
      if (lidsOpen) setTimeout(() => thought('Lundi, mercredi, samedi… vides. Je ne me souviens pas de les avoir pris.'), 300);
    }, 1.9, { pad: 0.025 });

    add(placed.mirror_steel, () => 'Se regarder', async () => {
      const l = 1 - G.sanity;
      const at = centerOf(placed.mirror_steel);
      await lookAt(at, { face: faceOf(placed.mirror_steel), dist: 0.55, eye: at.y + 0.05, secs: 2.4,
        text: l < 0.4 ? 'Du métal poli. Je ne me reconnais presque pas.' : l < 0.7 ? 'Mon reflet… il a bougé avant moi ?' : 'Ce n\'est pas moi.', glitch: l > 0.7 });
      if (l > 0.6) audio.breath(new THREE.Vector3(-0.75, 1.6, RZ_FRONT - 1.2));
    }, 1.8);

    const look = (obj, text, opts = {}) => () => lookAt(centerOf(obj), { face: faceOf(obj), dist: 0.6, text, ...opts });
    const lookDrawings = look(placed.kid_drawings, '« PAPA ». Des dessins d\'enfant… Qui les a accrochés ici ?');
    add(placed.kid_drawings, () => 'Regarder les dessins', async () => {
      await lookDrawings();
      // Once he is far gone, a child answers the drawings (once a night).
      if (1 - G.sanity > 0.5 && !G.leaDrawing) { G.leaDrawing = true; await wait(0.6); heard(lea.drawing, centerOf(placed.kid_drawings)); }
    }, 2.0, { pad: 0.03 });
    const dirty = tiles.flatMap((t) => t.roots ?? []).find((r) => r.visible === false && r.getObjectByName('drawing_0'));
    // « IL MENT »: the voice says it over and over (HAL_14) while he looks, and a little after.
    if (dirty) add(dirty, () => 'Regarder les dessins', () => { voices.hal('HAL_14', { strength: 1 - G.sanity, repeat: 8 }); return look(dirty, '« IL MENT »… Ce n\'est pas son écriture.', { glitch: true })(); }, 2.0, { pad: 0.03 });
    add(placed.clipboard, () => 'Lire la feuille de soins', look(placed.clipboard, 'Feuille de soins, chambre 104. Les cases de la nuit sont vides.', { dist: 0.5 }), 1.9, { pad: 0.03 });

    // Small things picked up, turned in the hand, put back.
    add(placed.id_bracelet, () => 'Regarder le bracelet', () => inspect(placed.id_bracelet, { text: 'Mon bracelet d\'hôpital. Chambre 104… Le nom est effacé.' }), 1.9, { pad: 0.035, min: 0.09 });
    add(placed.diary, () => 'Ouvrir le carnet', () => inspect(placed.diary, { grip: 'hold', far: true, text: 'Mon carnet… Les dernières pages sont arrachées.', turn: 0.3 }), 1.9, { pad: 0.03 });

    add(placed.light_switch_locked, () => 'Interrupteur à clé', async () => {
      G.mode = 'busy';
      const at = centerOf(placed.light_switch_locked);
      await press(placed.light_switch_locked, at);
      audio.locked(at);
      await rest();
      done();
      thought('Fermé à clé. Ils décident quand il fait nuit.');
    }, 1.8, { pad: 0.03 });

    // A coin hidden in the torn mattress (last stage only: the prop is invisible before).
    if (tornMattress) {
      // G.mattressCoin: kept in saved games (main.js), like the other coins.
      add(tornMattress, () => (G.mattressCoin ? null : 'Fouiller le matelas éventré'), async () => {
        G.mattressCoin = true;
        await pickUpCoin(tornMattress.getObjectByName('stash_coin'), 'dans la mousse du matelas');
      }, 2.0);
    }
    return list;
  }

  return { tiles, colliders, update, interactions, placed, setClock };
}
