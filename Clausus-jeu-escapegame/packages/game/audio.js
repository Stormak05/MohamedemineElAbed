// Sound files from assets/audio/ (see SOURCES.md), with WebAudio synthesis for the rest and as a fallback until they load.
const SAMPLES = ['coin_drop', 'pills_1', 'pills_2', 'pills_3', 'page_1', 'page_2', 'page_3', 'fall', 'lock_1', 'lock_2', 'dial_tone', 'coin_flip', 'cloth', 'alarm', 'drink', 'locked', 'door_creak', 'knock', 'dial_whirr', 'breath', 'child_laugh', 'torch_on', 'torch_off', 'switch', 'flap',
  'footsteps', 'step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6', 'pipes', 'creak', 'yell', 'drip', 'stinger', 'stinger_end', 'rain', 'vent', 'drone', 'moan',
  'pc_keys', 'pc_space', 'pc_enter', 'pc_release', 'pc_crt_on', 'pc_degauss', 'pc_seek', 'pc_fan',
  // Free sound banks (BigSoundBank, Freesound, Kenney: CC0).
  'heart_1', 'heart_2', 'coat', 'drawer_open', 'drawer_close', 'phone_ring', 'ringback', 'phone_pickup', 'phone_hangup', 'mouse', 'floppy',
  'step_stone_1', 'step_stone_2', 'step_stone_3', 'step_stone_4', 'step_stone_5', 'step_stone_6',
  'step_mud_1', 'step_mud_2', 'step_mud_3', 'step_mud_4', 'step_mud_5', 'step_mud_6',
  'whisper_1', 'whisper_2', 'whisper_3', 'thunder_1', 'thunder_2', 'thunder_3', 'thunder_4', 'thunder_5', 'thunder_6', 'thunder_7',
  'door_close_1', 'door_close_2', 'door_heavy', 'lift_close', 'lift_run', 'lift_open', 'lift_ding', 'nurse_ping', 'pager',
  'type_key', 'type_space', 'type_bell', 'pen', 'stamp', 'ui_hover', 'ui_click', 'ui_tick', 'ui_deny'];
// One of the numbered takes of a sound (step_stone_1 … step_stone_6), for variety.
const HUM_GAIN = 0.008;
const HUM_TONES = [[50, 1], [100, 0.6], [150, 0.25]];
const pick = (base, n) => `${base}_${1 + Math.floor(Math.random() * n)}`;
// Developer menu, "Essai des sons": [label, file played or null if synthesised, how the game plays it].
export const SOUND_TESTS = [
  ['Joueur', [
    ['Pas', 'step_*', (a) => a.step(0.1)], ['Pas dans l\'escalier', 'step_stone_*', (a) => a.stairStep()], ['Pas dehors', 'step_mud_*', (a) => a.wetStep()],
    ['Chute', 'fall', (a) => a.fallThud()], ['Atterrissage', 'fall', (a) => a.land()], ['Effondrement sous la pluie', 'fall', (a) => a.collapse()], ['Cœur', 'heart_*', (a) => a.thump(0.4)],
    ['Enfiler la blouse', 'coat', (a) => a.coat()], ['Ouvrir le tiroir', 'drawer_open', (a) => a.drawer(true, null)], ['Fermer le tiroir', 'drawer_close', (a) => a.drawer(false, null)],
    ['Avaler un cachet', 'drink', (a) => a.swallow()], ['Soulagement', null, (a) => a.relief()], ['Ramasser', null, (a) => a.pickup()], ['Ramasser une pièce', 'coin_flip', (a) => a.pickup('coin')], ['Ramasser la lampe', 'cloth', (a) => a.pickup('torch')], ['Document', 'page_*', (a) => a.paper()],
    ['Allumer la lampe', 'torch_on', (a) => a.torchClick(true)], ['Éteindre la lampe', 'torch_off', (a) => a.torchClick(false)],
    ['Voix du dialogue', null, (a) => { for (let i = 0; i < 5; i++) setTimeout(() => a.blip(1), i * 110); }],
  ]],
  ['Objets', [
    ['Flacon de pilules', 'pills_*', (a) => a.rattle()], ['Pièce', 'coin_drop', (a) => a.coinDrop(null)], ['Bouton, pilulier', 'switch', (a) => a.click(null)], ['Sonnette d\'infirmière', 'nurse_ping', (a) => a.nurseCall(null)],
    ['Trappe qui claque', 'flap', (a) => a.flap(null)], ['Radiateur', 'pipes', (a) => a.radiator(null)], ['Alarme', 'alarm', (a) => a.alarm(null)],
  ]],
  ['Porte', [
    ['Verrouillée', 'locked', (a) => a.locked(null)], ['Grincement', 'door_creak', (a) => a.doorCreak(null)], ['Grincement grave', 'door_creak', (a) => a.doorCreak(null, 0.6)], ['Grincement aigu', 'door_creak', (a) => a.doorCreak(null, 1.35)], ['Déverrouillage', 'lock_*', (a) => a.doorUnlock(null)],
    ['Porte qui se referme', 'door_close_*', (a) => a.doorClose(null)], ['Porte de sortie', 'door_heavy', (a) => a.doorSlam(null)],
  ]],
  ['Ascenseur', [
    ['Portes qui se ferment', 'lift_close', (a) => a.liftClose(null)], ['Moteur (4 s)', 'lift_run', (a) => { const stop = a.liftRun(null); setTimeout(() => stop?.(), 4000); }],
    ['Arrivée', 'lift_ding', (a) => a.liftArrive(null)],
  ]],
  ['Téléphone', [
    ['Sonnerie', 'phone_ring', (a) => a.bell(null)], ['Tonalité', 'dial_tone', (a) => a.dialTone()], ['Cadran', 'dial_whirr', (a) => a.dialWhirr(null)],
    ['Appel en cours', 'ringback', (a) => a.ringback()], ['Décroché', 'phone_pickup', (a) => a.pickupLine()], ['Raccroché', 'phone_hangup', (a) => a.hangUp(null)],
  ]],
  ['Ordinateur', [
    ['Touche', 'pc_keys', (a) => a.key()], ['Espace', 'pc_space', (a) => a.key(' ')], ['Entrée', 'pc_enter', (a) => a.key('Enter')],
    ['Clic', 'mouse', (a) => a.mouseClick()], ['Bouton relâché', 'pc_release', (a) => a.mouseUp()], ['Disque dur', 'pc_seek', (a) => a.pcSeek(null)],
    ['Démarrage', 'floppy', (a) => a.pcBoot(null, false)], ['Bip', null, (a) => a.beep()], ['Accepté', null, (a) => a.ok()], ['Refusé', null, (a) => a.buzz()],
  ]],
  ['Hallucinations', [
    ['Chuchotements', 'whisper_*', (a) => a.whisper(null)], ['Coups à la porte', 'knock', (a) => a.knock(null)], ['Pas au loin', 'footsteps', (a) => a.footsteps(null)],
    ['Respiration', 'breath', (a) => a.breath(null)], ['Rire d\'enfant', 'child_laugh', (a) => a.childHum(null)], ['Grincements', 'creak', (a) => a.play('creak', { gain: 0.45 })],
    ['Goutte', 'drip', (a) => a.play('drip', { gain: 0.45 })], ['Tuyaux', 'pipes', (a) => a.play('pipes', { gain: 0.45 })], ['Cri lointain', 'yell', (a) => a.play('yell', { gain: 0.3 })],
  ]],
  ['Peur', [
    ['Piano, silhouette vue', 'stinger', (a) => a.stinger()], ['Piano, partie perdue', 'stinger_end', (a) => a.stinger(true)], ['Tonnerre', 'thunder_*', (a) => a.thunder(0, 1)],
  ]],
  ['Rapport de fin', [
    ['Machine à écrire', 'type_*', (a) => { for (let k = 0; k < 6; k++) setTimeout(() => a.typeKey(), k * 90); setTimeout(() => a.typeBell(), 700); }],
    ['Stylo', 'pen', (a) => a.pen()], ['Tampon', 'stamp', (a) => a.stamp()],
  ]],
  ['Menus', [
    ['Survol', 'ui_hover', (a) => a.ui('hover')], ['Clic', 'ui_click', (a) => a.ui('click')], ['Curseur', 'ui_tick', (a) => a.ui('tick')], ['Refus', 'ui_deny', (a) => a.ui('deny')],
  ]],
  ['Fonds (6 s)', [
    ['Pluie', 'rain', (a) => a.testLoop('rain', 0.7)], ['Néon', null, (a) => { for (const [f, g] of HUM_TONES) a.tone(f, 6, { gain: HUM_GAIN * g, attack: 0.2, bus: a.amb }); }], ['Ventilation', 'vent', (a) => a.testLoop('vent', 0.28)],
    ['Drone', 'drone', (a) => a.testLoop('drone', 0.5)], ['Plaintes', 'moan', (a) => a.testLoop('moan', 0.4)], ['Ventilateurs du PC', 'pc_fan', (a) => a.testLoop('pc_fan', 0.5)],
  ]],
];

export class Audio {
  constructor() { this.ac = null; this.on = true; this.paused = false; this.vol = { master: 0.8, sfx: 1, amb: 1, voice: 1 }; this.buffers = {}; }

  start() {
    if (this.ac) { this.ac.resume(); return; }
    const ac = this.ac = new AudioContext();
    this.master = ac.createGain();
    this.master.gain.value = this.on ? this.vol.master * 0.75 : 0;
    this.master.connect(ac.destination);

    // Gameplay bus: muted when paused so in-game audio stops, but UI clicks remain audible.
    this.gameBus = ac.createGain();
    this.gameBus.connect(this.master);

    // Buses for the volume settings.
    for (const k of ['sfx', 'amb', 'voice']) {
      this[k] = ac.createGain();
      this[k].gain.value = this.vol[k];
      this[k].connect(this.gameBus);
    }
    this.uiBus = ac.createGain();
    this.uiBus.connect(this.master);

    this.noiseBuf = this.makeNoise(4, 'white');
    this.brownBuf = this.makeNoise(4, 'brown');

    // Continuous bulb hum: oscillators avoid audible sample loop seams.
    this.hum = ac.createGain(); this.hum.gain.value = HUM_GAIN; this.hum.connect(this.amb);
    for (const [f, g] of HUM_TONES) {
      const o = ac.createOscillator(); o.frequency.value = f;
      const og = ac.createGain(); og.gain.value = g;
      o.connect(og).connect(this.hum); o.start();
    }
    // Rain in the courtyard (audible only when approaching the window).
    this.rainFar = this.loop(this.brownBuf, { type: 'lowpass', f: 900 }, 0.0);
    // Ear ringing at low sanity.
    const tin = ac.createOscillator(); tin.frequency.value = 6100;
    this.tinnitus = ac.createGain(); this.tinnitus.gain.value = 0;
    tin.connect(this.tinnitus).connect(this.amb); tin.start();
    this.loadSamples();
  }

  async loadSamples() {
    await Promise.all(SAMPLES.map((name) => this.load(name)));
    this.startBeds();
  }
  // One file of assets/audio/ (name without .mp3, may include a folder: voix/hal_01_…).
  async load(name) {
    if (this.buffers[name]) return;
    try {
      const r = await fetch(`assets/audio/${name}.mp3`);
      if (r.ok) this.buffers[name] = await this.ac.decodeAudioData(await r.arrayBuffer());
    } catch { /* keeps the synthesised version */ }
  }

  // Looping layers, silent until update() raises them. The rain replaces its synthesised version.
  bed(name, { filter = null, pos = null } = {}) {
    const buf = this.buffers[name];
    if (!buf) return null;
    const ac = this.ac, src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf; src.loop = true;
    // Skips the silence MP3 encoders leave at both ends.
    src.loopStart = 0.06; src.loopEnd = Math.max(0.1, buf.duration - 0.06);
    g.gain.value = 0;
    let head = src;
    if (filter) { const f = ac.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.f; head = src.connect(f); }
    head.connect(g).connect(this.out(pos, this.amb));
    src.start(0, 0.06 + Math.random() * Math.max(0, buf.duration - 0.2));
    return { g, src };
  }
  startBeds() {
    const rain = this.bed('rain', { filter: { type: 'lowpass', f: 2200 } });
    if (rain) { this.rainNoise = this.rainFar; this.rainFar = rain.g; this.rainNoise.gain.setTargetAtTime(0, this.t, 0.2); this.rainLevel = 1; }
    this.beds = { vent: this.bed('vent'), drone: this.bed('drone'), moan: this.bed('moan', { filter: { type: 'lowpass', f: 1400 } }) };
  }

  // Developer menu: the menus mute the game's sounds, so let them through for as long as the longest one lasts.
  test(run) {
    this.start();
    clearTimeout(this.testTimer);
    this.gameBus.gain.setTargetAtTime(1, this.t, 0.02);
    run(this);
    this.testTimer = setTimeout(() => { if (this.paused) this.gameBus.gain.setTargetAtTime(0, this.t, 0.05); }, 11000);
  }
  stopTest() {
    if (!this.ac) return;
    clearTimeout(this.testTimer);
    this.gameBus.gain.setTargetAtTime(0, this.t, 0.02);
  }
  testLoop(name, gain) {
    const buf = this.buffers[name];
    if (!buf) return;
    const src = this.ac.createBufferSource(), g = this.ac.createGain(), t = this.t;
    src.buffer = buf; src.loop = true;
    g.gain.setValueAtTime(gain, t); g.gain.setValueAtTime(gain, t + 5.5); g.gain.linearRampToValueAtTime(0, t + 6);
    src.connect(g).connect(this.sfx); src.start(t); src.stop(t + 6.1);
  }

  // Plays a sound file; false when it isn't there, so the caller can fall back on synthesis.
  play(name, { gain = 1, at = 0, pos = null, rate = 1, bus, offset = 0, dur } = {}) {
    const buf = this.ac && this.buffers[name];
    if (!buf) return false;
    const src = this.ac.createBufferSource(), g = this.ac.createGain();
    src.buffer = buf; src.playbackRate.value = rate; g.gain.value = gain;
    src.connect(g).connect(this.out(pos, bus));
    if (dur) src.start(this.t + at, offset, dur); else src.start(this.t + at, offset);
    return true;
  }

  // A random stretch of a long file (whispers, pen), faded in and out so the cut doesn't click.
  slice(name, { dur = 1, gain = 1, at = 0, pos = null, rate = 1, bus, fade = 0.08 } = {}) {
    const buf = this.ac && this.buffers[name];
    if (!buf) return false;
    const d = Math.min(dur, buf.duration - 0.1), off = 0.05 + Math.random() * Math.max(0, buf.duration - d - 0.1);
    const src = this.ac.createBufferSource(), g = this.ac.createGain(), t0 = this.t + at, len = d / rate;
    src.buffer = buf; src.playbackRate.value = rate;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + fade);
    g.gain.setValueAtTime(gain, t0 + Math.max(fade, len - fade)); g.gain.linearRampToValueAtTime(0, t0 + len);
    src.connect(g).connect(this.out(pos, bus));
    src.start(t0, off, d);
    return true;
  }

  get t() { return this.ac.currentTime; }

  setPaused(p) {
    this.paused = !!p;
    for (const line of this.spoken ?? []) line.pause(this.paused);
    if (this.gameBus && this.ac) {
      this.gameBus.gain.setTargetAtTime(p ? 0 : 1, this.t, 0.05);
    }
  }

  makeNoise(seconds, kind) {
    const ac = this.ac, len = ac.sampleRate * seconds, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  loop(buf, filter, gain) {
    const ac = this.ac, src = ac.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.f; if (filter.q) f.Q.value = filter.q;
    const g = ac.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(this.amb); src.start();
    return g;
  }

  setMuted(m) { this.on = !m; if (this.ac) this.master.gain.setTargetAtTime(m ? 0 : this.vol.master * 0.75, this.t, 0.05); }
  setVolumes(v) {
    Object.assign(this.vol, v);
    if (!this.ac) return;
    this.master.gain.setTargetAtTime(this.on ? this.vol.master * 0.75 : 0, this.t, 0.05);
    for (const k of ['sfx', 'amb', 'voice']) this[k].gain.setTargetAtTime(this.vol[k], this.t, 0.05);
  }
  // Menu sounds.
  ui(kind) {
    if (!this.ac) return;
    const bus = this.uiBus;
    if (kind === 'hover') { if (!this.play('ui_hover', { gain: 0.06, bus, rate: 0.95 + Math.random() * 0.1 })) this.noise(0.03, { f: 1800, q: 3, gain: 0.025, bus }); }
    else if (kind === 'click') { if (!this.play('ui_click', { gain: 0.2, bus })) { this.noise(0.05, { f: 900, q: 1, gain: 0.08, type: 'lowpass', bus }); this.tone(180, 0.08, { gain: 0.04, slide: 0.6, bus }); } }
    else if (kind === 'tick') { if (!this.play('ui_tick', { gain: 0.08, bus })) this.noise(0.02, { f: 2600, q: 4, gain: 0.03, bus }); }
    else if (kind === 'deny') { if (!this.play('ui_deny', { gain: 0.22, bus, rate: 0.8 })) this.tone(70, 0.9, { gain: 0.12, type: 'sawtooth', slide: 0.7, attack: 0.05, bus }); this.whisper(null); }
  }

  // Listener follows the camera, for the positioned hallucinations.
  updateListener(camera) {
    if (!this.ac) return;
    const l = this.ac.listener, p = camera.position;
    const f = camera.getWorldDirection(this._v ??= camera.position.clone());
    const t = this.t;
    if (l.positionX) {
      l.positionX.setValueAtTime(p.x, t); l.positionY.setValueAtTime(p.y, t); l.positionZ.setValueAtTime(p.z, t);
      l.forwardX.setValueAtTime(f.x, t); l.forwardY.setValueAtTime(f.y, t); l.forwardZ.setValueAtTime(f.z, t);
      l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  // Output node, optionally placed in 3D.
  out(pos, bus = this.sfx) {
    if (!pos) return bus;
    const p = this.ac.createPanner();
    p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 0.6; p.rolloffFactor = 1.2;
    p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
    p.connect(bus);
    return p;
  }

  tone(f, dur, { type = 'sine', gain = 0.2, at = 0, attack = 0.005, pos = null, slide = 0, bus } = {}) {
    if (!this.ac) return;
    const ac = this.ac, t0 = this.t + at;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.out(pos, bus)); o.start(t0); o.stop(t0 + dur + 0.05);
  }

  noise(dur, { f = 1000, q = 1, type = 'bandpass', gain = 0.2, at = 0, attack = 0.005, pos = null, brown = false, bus } = {}) {
    if (!this.ac) return;
    const ac = this.ac, t0 = this.t + at;
    const src = ac.createBufferSource(); src.buffer = brown ? this.brownBuf : this.noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl).connect(g).connect(this.out(pos, bus));
    src.start(t0, Math.random() * 3); src.stop(t0 + dur + 0.05);
  }

  // ---------- Effects ----------
  step(gain = 0.12, pos = null) { if (this.play(`step_${1 + Math.floor(Math.random() * 6)}`, { gain: gain * 2, rate: 0.92 + Math.random() * 0.16, pos })) return; this.noise(0.12, { f: 180 + Math.random() * 80, q: 0.8, gain, type: 'lowpass', pos }); }
  // Heartbeat (one "lub-dub").
  thump(gain = 0.5) { if (this.play(pick('heart', 2), { gain: gain * 1.4, rate: 0.95 + Math.random() * 0.1 })) return; this.tone(60, 0.2, { gain, slide: 0.5 }); this.tone(52, 0.2, { gain: gain * 0.7, at: 0.17, slide: 0.5 }); }
  // Landing after a drop (hopital/jeu.js), the collapse outside in the rain (main.js).
  land() { if (this.play('fall', { gain: 0.5, rate: 1.1 })) return; this.thump(0.3); }
  collapse() { if (this.play('fall', { gain: 0.9, rate: 0.9 })) { this.play(pick('step_mud', 6), { gain: 0.45, at: 0.08, rate: 0.8 }); return; } this.noise(2.5, { f: 300, type: 'lowpass', gain: 0.4, brown: true }); }
  // Concrete stairwell (with its echo), wet ground outside.
  stairStep() { if (this.play(pick('step_stone', 6), { gain: 0.35, rate: 0.92 + Math.random() * 0.16 })) return; this.step(0.16); this.noise(0.25, { f: 900, q: 3, gain: 0.015, at: 0.06 }); }
  wetStep() { if (this.play(pick('step_mud', 6), { gain: 0.3, rate: 0.92 + Math.random() * 0.16 })) return; this.step(0.08); this.noise(0.09, { f: 3200, q: 0.7, gain: 0.03 }); }
  coat() { if (this.play('coat', { gain: 0.5 })) return; this.noise(0.8, { f: 700, q: 0.6, gain: 0.08 }); }
  drawer(open, pos) { if (this.play(open ? 'drawer_open' : 'drawer_close', { gain: 0.45, pos })) return; this.noise(0.5, { f: 900, q: 0.8, gain: 0.08, pos }); }
  fallThud() { if (this.play('fall', { gain: 0.95 })) return; this.noise(0.5, { f: 140, type: 'lowpass', gain: 0.9, brown: true }); this.tone(48, 0.4, { gain: 0.6, slide: 0.5 }); }
  swallow() { if (this.play('drink', { gain: 0.35 })) return; this.tone(320, 0.12, { gain: 0.08, slide: 0.5, type: 'triangle' }); this.noise(0.1, { f: 500, gain: 0.05, at: 0.1 }); }
  rattle() { if (this.play(`pills_${1 + Math.floor(Math.random() * 3)}`, { gain: 0.45, rate: 0.95 + Math.random() * 0.1 })) return; for (let i = 0; i < 6; i++) this.noise(0.04, { f: 3000 + Math.random() * 2000, q: 4, gain: 0.08, at: i * 0.05 }); }
  pickup(kind) { if (kind === 'coin' && this.play('coin_flip', { gain: 0.4 })) return; if (kind === 'torch' && this.play('cloth', { gain: 0.7 })) return; this.noise(0.06, { f: 2400, q: 2, gain: 0.08 }); }
  coinDrop(pos) { if (this.play('coin_drop', { gain: 0.5, pos })) return;
    this.tone(2400, 0.25, { gain: 0.08, type: 'triangle', pos });
    this.tone(3100, 0.2, { gain: 0.05, type: 'triangle', at: 0.09, pos });
    this.tone(1800, 0.4, { gain: 0.06, type: 'triangle', at: 0.22, pos });
    this.noise(0.15, { f: 600, gain: 0.08, at: 0.3, pos });
  }
  click(pos, gain = 0.15) { if (this.play('switch', { gain: gain * 1.6, pos, rate: 1.05 })) return; this.noise(0.03, { f: 2000, q: 1, gain, pos }); }
  dialTone() { if (this.play('dial_tone', { gain: 0.3 })) return; this.tone(440, 1.4, { gain: 0.05, attack: 0.02 }); }
  dialWhirr(pos, at = 0) { if (this.play('dial_whirr', { gain: 0.3, at, pos })) return; for (let i = 0; i < 7; i++) this.noise(0.03, { f: 1500, q: 6, gain: 0.05, at: at + i * 0.07, pos }); }
  ringback(at = 0) { if (this.play('ringback', { gain: 0.12, at })) return; this.tone(440, 1.5, { gain: 0.05, at, attack: 0.02 }); }
  // Someone answers at the other end (heard in the earpiece), the handset put back on its hook.
  pickupLine() { if (this.play('phone_pickup', { gain: 0.35 })) return; this.noise(0.4, { f: 800, q: 0.5, gain: 0.04 }); }
  hangUp(pos) { if (this.play('phone_hangup', { gain: 0.6, pos })) return; this.noise(0.08, { f: 300, type: 'lowpass', gain: 0.4, pos }); this.click(pos, 0.2); }
  bell(pos, at = 0) {
    if (this.play('phone_ring', { gain: 0.4, pos, at })) return;
    for (let k = 0; k < 20; k++) {
      this.tone(1180, 0.05, { type: 'square', gain: 0.03, at: at + k * 0.045, pos });
      this.tone(1520, 0.05, { type: 'square', gain: 0.02, at: at + k * 0.045, pos });
    }
  }
  doorUnlock(pos, rate = 1) { if (this.play(rate < 1 ? 'lock_1' : 'lock_2', { gain: 0.5, pos, rate })) return; this.noise(0.15, { f: 400 * rate, type: 'lowpass', gain: 0.5, pos }); this.tone(900 * rate, 0.08, { gain: 0.05, at: 0.15, pos }); this.noise(0.1, { f: 1500 * rate, gain: 0.15, at: 0.2, pos }); }
  doorCreak(pos, rate = 0.85) { if (this.play('door_creak', { gain: 0.8, pos, rate })) return; this.tone(180, 1.6, { type: 'sawtooth', gain: 0.03, slide: 1.6, attack: 0.3, pos }); }
  locked(pos, rate = 1) { if (this.play('locked', { gain: 0.6, pos, rate })) return; this.noise(0.1, { f: 500, type: 'lowpass', gain: 0.4, pos }); this.noise(0.1, { f: 500, type: 'lowpass', gain: 0.3, at: 0.14, pos }); }
  buzz() { this.tone(110, 0.35, { type: 'square', gain: 0.05 }); }
  beep() { this.tone(880, 0.08, { type: 'square', gain: 0.03 }); }
  ok() { this.tone(660, 0.1, { type: 'square', gain: 0.03 }); this.tone(990, 0.15, { type: 'square', gain: 0.03, at: 0.1 }); }
  // The computers (os.js). pc_keys holds 32 key presses, one every 0.35 s; Space and Enter have their own sound.
  key(k) {
    const rate = 0.96 + Math.random() * 0.08;
    const own = k === ' ' ? 'pc_space' : k === 'Enter' ? 'pc_enter' : null;
    if (own && this.play(own, { gain: 0.3, rate })) return;
    let i; do i = Math.floor(Math.random() * 32); while (i === this.lastKey);
    this.lastKey = i;
    if (this.play('pc_keys', { gain: 0.28, rate, offset: i * 0.35 + 0.04, dur: 0.3 })) return;
    this.noise(0.025, { f: 2500 + Math.random() * 1500, q: 2, gain: 0.06 });
  }
  mouseClick() { if (!this.play('mouse', { gain: 0.25, rate: 0.95 + Math.random() * 0.1 })) this.noise(0.015, { f: 3500, q: 3, gain: 0.05 }); }
  mouseUp() { this.play('pc_release', { gain: 0.12, rate: 0.95 + Math.random() * 0.1 }); }
  // Switching on: the floppy drive reads, the CRT clicks and degausses, the BIOS beeps, then the fans keep
  // running near the computer for the rest of the game (idle = false for the sound test).
  pcBoot(pos, idle = true) {
    if (!this.ac) return;
    if (!this.play('floppy', { gain: 0.3, pos })) { this.beep(); return; }
    this.play('pc_crt_on', { gain: 0.3, pos, at: 0.1 });
    this.play('pc_degauss', { gain: 0.35, pos, at: 0.4 });
    this.tone(880, 0.08, { type: 'square', gain: 0.03, at: 1.1 });
    if (idle) this.pcFan(pos, 2);
  }
  pcFan(pos, delay = 0) {
    const fan = this.ac && this.bed('pc_fan', { pos });
    if (fan) { const t = this.t + delay; fan.g.gain.setValueAtTime(0, t); fan.g.gain.linearRampToValueAtTime(0.3, t + 2); }
  }
  // The drive reading: opening a window, running a program.
  pcSeek(pos) {
    const buf = this.ac && this.buffers.pc_seek;
    if (!buf) return;
    const dur = 0.25 + Math.random() * 0.5;
    this.play('pc_seek', { gain: 0.3, pos, offset: Math.random() * Math.max(0, buf.duration - dur - 0.1), dur });
  }
  // Hospital doors (hopital/batiment.js): a swing door shutting, the heavy exit door.
  doorClose(pos, rate = 1, at = 0) { if (this.play(pick('door_close', 2), { gain: 0.6, pos, rate, at })) return; this.noise(0.25, { f: 220 * rate, type: 'lowpass', gain: 0.5, at, pos, brown: true }); }
  // The lift: doors closing, the motor while it moves (returns its stop function), the bell and the doors on arrival.
  liftClose(pos) { if (this.play('lift_close', { gain: 0.45, pos })) return; this.noise(1.1, { f: 600, q: 0.6, gain: 0.05, pos }); }
  liftRun(pos) {
    const buf = this.ac && this.buffers.lift_run;
    if (!buf) { this.noise(0.4, { f: 120, type: 'lowpass', gain: 0.4, pos, brown: true }); return null; }
    const src = this.ac.createBufferSource(), g = this.ac.createGain();
    src.buffer = buf; src.loop = true; src.loopStart = 0.3; src.loopEnd = buf.duration - 0.3;
    g.gain.setValueAtTime(0, this.t); g.gain.linearRampToValueAtTime(0.3, this.t + 0.5);
    src.connect(g).connect(this.out(pos)); src.start(this.t, 0.3);
    return () => { g.gain.setTargetAtTime(0, this.t, 0.15); src.stop(this.t + 1); };
  }
  liftArrive(pos) {
    if (this.play('lift_ding', { gain: 0.3, pos })) { this.play('lift_open', { gain: 0.45, at: 0.4, pos }); return; }
    this.tone(1046, 0.9, { gain: 0.08, pos }); this.tone(784, 1.2, { gain: 0.06, at: 0.25, pos }); this.noise(0.3, { f: 100, type: 'lowpass', gain: 0.35, brown: true, pos });
  }
  // Nurse call button (props.js): its ping, then far off, a pager that nobody answers.
  nurseCall(pos) {
    if (this.play('nurse_ping', { gain: 0.25, pos })) { this.play('pager', { gain: 0.08, at: 1.4 }); return; }
    this.tone(660, 0.25, { type: 'square', gain: 0.03, pos }); this.tone(660, 0.25, { type: 'square', gain: 0.03, at: 0.4, pos });
  }
  relief() { this.tone(220, 2.5, { gain: 0.05, attack: 0.4 }); this.tone(330, 2.5, { gain: 0.03, attack: 0.6 }); }

  // The way out (fin.js). The heavy exit door falls shut behind the player.
  doorSlam(pos) { if (this.play('door_heavy', { gain: 0.9, pos })) return; this.noise(0.6, { f: 160, type: 'lowpass', gain: 1.1, brown: true, pos }); this.tone(55, 0.5, { gain: 0.35, slide: 0.6, pos }); this.locked(pos); }
  // Outside: a slow chord rises while the rain eases (on the menu bus, so it carries on over the report).
  outro() {
    if (!this.ac) return;
    const bus = this.uiBus;
    [[110, 0], [164.8, 0.8], [220, 1.6], [277.2, 2.6], [329.6, 3.6]].forEach(([f, at]) => {
      this.tone(f, 9 - at, { gain: 0.035, attack: 2.5, at, bus });
      this.tone(f * 1.003, 9 - at, { gain: 0.02, attack: 3, at, bus, type: 'triangle' });
    });
  }
  // The report: typewriter keys, a pen, the stamp.
  typeKey() { if (this.ac && this.play(Math.random() < 0.15 ? 'type_space' : 'type_key', { gain: 0.3, bus: this.uiBus, rate: 0.9 + Math.random() * 0.2 })) return; if (this.ac) { this.noise(0.03, { f: 1800 + Math.random() * 1400, q: 2, gain: 0.07, bus: this.uiBus }); this.noise(0.02, { f: 300, type: 'lowpass', gain: 0.06, at: 0.01, bus: this.uiBus }); } }
  typeBell() { if (this.ac) this.play('type_bell', { gain: 0.25, bus: this.uiBus }); }
  pen() { if (this.ac && this.slice('pen', { dur: 0.75, gain: 0.4, bus: this.uiBus, fade: 0.05 })) return; if (this.ac) for (let i = 0; i < 7; i++) this.noise(0.09, { f: 2600 + Math.random() * 1500, q: 1.5, gain: 0.018, at: i * 0.1, bus: this.uiBus }); }
  stamp() { if (this.ac && this.play('stamp', { gain: 0.7, bus: this.uiBus })) return; if (this.ac) { this.noise(0.18, { f: 220, type: 'lowpass', gain: 0.7, brown: true, bus: this.uiBus }); this.tone(70, 0.2, { gain: 0.2, slide: 0.5, bus: this.uiBus }); } }

  // Dialogue "voice": short pitched blips, one every few letters (placeholder for dubbing).
  blip(pitch = 1) {
    const f = (170 + Math.random() * 60) * pitch;
    this.tone(f, 0.06, { type: 'square', gain: 0.025, slide: 0.9, bus: this.voice });
    this.noise(0.05, { f: f * 4, q: 3, gain: 0.02, bus: this.voice });
  }

  thunder(at, strength) {
    if (this.play(pick('thunder', 7), { gain: 0.75 * strength, at, bus: this.amb, rate: 0.9 + Math.random() * 0.15 })) return;
    this.noise(3.5 + strength * 2, { f: 120, type: 'lowpass', gain: 0.5 * strength, at, attack: 0.25, brown: true, bus: this.amb });
    this.noise(0.8, { f: 400, type: 'lowpass', gain: 0.35 * strength, at, attack: 0.02, brown: true, bus: this.amb });
  }

  // ---------- Auditory hallucinations ----------
  whisper(pos) {
    if (this.slice(pick('whisper', 3), { dur: 1.6 + Math.random() * 1.4, gain: 0.35, pos, rate: 0.85 + Math.random() * 0.2, fade: 0.25 })) return;
    const n = 4 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) this.noise(0.14 + Math.random() * 0.18, { f: 1800 + Math.random() * 2600, q: 5, gain: 0.05 + Math.random() * 0.05, at: i * 0.17 + Math.random() * 0.08, pos, attack: 0.05 });
  }
  knock(pos) { if (this.play('knock', { gain: 0.9, pos })) return; for (const at of [0, 0.32, 0.64]) this.noise(0.12, { f: 180, type: 'lowpass', gain: 0.9, at, pos, brown: true }); }
  footsteps(pos) { if (this.play('footsteps', { gain: 0.8, pos })) return; for (let i = 0; i < 6; i++) this.noise(0.12, { f: 220, type: 'lowpass', gain: 0.4, at: i * 0.55, pos, brown: true }); }
  breath(pos) { if (this.play('breath', { gain: 0.7, pos, rate: 0.8 })) { this.play('breath', { gain: 0.55, at: 2.1, pos, rate: 0.72 }); return; } this.noise(1.6, { f: 700, q: 0.7, gain: 0.08, attack: 0.7, pos }); this.noise(1.4, { f: 500, q: 0.7, gain: 0.06, attack: 0.5, at: 1.8, pos }); }
  childHum(pos) {
    if (this.play('child_laugh', { gain: 0.3, pos })) return;
    const notes = [523, 587, 659, 523, 659, 587];
    notes.forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', gain: 0.025, at: i * 0.5, attack: 0.1, pos }));
  }
  // Sounds that only exist as files: silent if they failed to load.
  torchClick(on) { if (!this.play(on ? 'torch_on' : 'torch_off', { gain: 0.3 })) this.click(null, 0.15); }
  paper() { if (!this.play(`page_${1 + Math.floor(Math.random() * 3)}`, { gain: 0.6 })) this.pickup(); }
  alarm(pos) { if (!this.play('alarm', { gain: 0.5, pos })) this.bell(pos); }
  flap(pos) { if (!this.play('flap', { gain: 0.8, pos })) this.locked(pos); }
  radiator(pos) { this.play('pipes', { gain: 0.45, pos }); }
  // Something far off in the building. Distant cries only once the player is far gone.
  distant(pos, loss) {
    const pool = loss > 0.6 ? ['creak', 'drip', 'pipes', 'yell'] : ['creak', 'drip', 'pipes'];
    const name = pool[Math.floor(Math.random() * pool.length)];
    this.play(name, { gain: name === 'yell' ? 0.3 : 0.45, pos });
  }
  stinger(end = false) { this.play(end ? 'stinger_end' : 'stinger', { gain: end ? 0.45 : 0.32 }); }

  // Blocking dialogue: await decoding even on the first use; expose stop and pause.
  async spokenLine(id, { pos = null, gain = 1 } = {}) {
    if (!this.ac) return null;
    const name = `voix/${id}`;
    this.spokenLoads ??= new Map();
    if (!this.spokenLoads.has(name)) this.spokenLoads.set(name, this.load(name));
    await this.spokenLoads.get(name);
    const buffer = this.buffers[name];
    if (!buffer) return null;
    this.spoken ??= new Set();
    const ac = this.ac, output = ac.createGain();
    output.gain.value = gain;
    output.connect(this.out(pos, this.voice));
    let source = null, offset = 0, started = 0, stopped = false;
    const elapsed = () => Math.min(buffer.duration, offset + (source ? ac.currentTime - started : 0));
    const line = {
      duration: buffer.duration,
      get remaining() { return buffer.duration - elapsed(); },
      pause: (paused) => {
        if (stopped) return;
        if (paused && source) {
          offset = elapsed(); source.stop(); source.disconnect(); source = null;
        } else if (!paused && !source && offset < buffer.duration) {
          source = ac.createBufferSource(); source.buffer = buffer;
          source.connect(output); started = ac.currentTime; source.start(started, offset);
        }
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        source?.stop(); source?.disconnect(); output.disconnect();
        this.spoken.delete(line);
      },
    };
    this.spoken.add(line);
    line.pause(this.paused);
    return line;
  }

  // Recorded voice lines, named by their code on the voice sheet: assets/audio/voix/LEA_01.mp3 and so on.
  // Loaded on first use; until a file is there (or while it loads), returns false and the caller only shows the subtitle.
  voiceLine(id, { pos = null, gain = 1 } = {}) {
    const name = `voix/${id}`;
    if (this.buffers[name]) return this.play(name, { gain, pos, bus: this.voice });
    this.voiceTried ??= new Set();
    if (this.ac && !this.voiceTried.has(name)) {
      this.voiceTried.add(name);
      fetch(`assets/audio/${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((b) => b && this.ac.decodeAudioData(b)).then((buf) => { if (buf) this.buffers[name] = buf; }).catch(() => {});
    }
    return false;
  }

  update(dt, { rainNear, sanityLoss }) {
    if (!this.ac || this.paused) return;
    const t = this.t;
    this.rainFar.gain.setTargetAtTime(rainNear * (this.rainLevel ?? 0.15), t, 0.2);
    if (this.beds) {
      const { vent, drone, moan } = this.beds;
      vent?.g.gain.setTargetAtTime(0.28, t, 1);
      drone?.g.gain.setTargetAtTime(Math.max(0, sanityLoss - 0.25) * 0.75, t, 1.5);
      moan?.g.gain.setTargetAtTime(Math.max(0, sanityLoss - 0.6) * 0.7, t, 2);
    }
    this.tinnitus.gain.setTargetAtTime(Math.max(0, sanityLoss - 0.6) * 0.012, t, 0.5);
  }
}
