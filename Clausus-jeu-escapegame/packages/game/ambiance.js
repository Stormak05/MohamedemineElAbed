import * as THREE from 'three';
import { spot } from './histoire.js';

// What the patient hears of the others, without anyone stopping him: the loudspeakers, the lift, Lucas Perrin's
// night round on the first floor (heard through the doors and on his radio, never seen), the guard's round and the
// other patients behind their doors. Each line is a recording of the voice sheet (assets/audio/voix/<id>.mp3),
// played where it comes from with its subtitle; every scene plays once, one at a time, with a pause between two.
// main.js gives what it needs (ctx below) and calls update() every frame of play.

export const LINES = {
  // Loudspeakers (Julien_lma).
  ANN_05: 'Le docteur Morel est demandé à l\'accueil.',
  ANN_06: 'Test de l\'alarme incendie dans l\'aile C. Ceci est un exercice.',
  ANN_07: 'Rappel : les visites sont terminées. Merci de regagner vos chambres.',
  ANN_08: 'La pharmacie est fermée. Merci de vous adresser à l\'accueil.',
  ANN_09: 'Rez-de-chaussée',
  ANN_10: 'Premier étage.',
  ANN_11: 'Sous-sol.',
  ANN_12: 'Patient cent quatre, vous êtes attendu.',
  // Lucas Perrin, night nurse: his round of the first floor, aile B.
  PER_03: 'Étage un, aile B, ronde de vingt-trois heures quarante. RAS.',
  PER_04: 'Aile B, minuit dix. La cent quatre est agité. Je repasse.',
  PER_05: 'Non, non, la cent quatre dort. Je te dis qu\'il dort.',
  PER_06: 'Le docteur Morel ? Il est parti à vingt-trois heures. Sa blouse est à la laverie.',
  PER_07: 'Qui a encore laissé traîner des pièces ?',
  PER_08: 'Dors, Garnier. Il est tard.',
  PER_09: 'Bonne nuit, madame Roux. Demain, c\'est le grand jour.',
  PER_10: 'Ça va, là-dedans ?',
  PER_11: 'Tu devrais dormir, tu sais. C\'est mieux pour tout le monde.',
  PER_12: 'Calmez-vous, monsieur… On en parle demain avec le docteur.',
  // The guard, the night nurse at the reception.
  SEC_03: 'Poste de sécurité. Ronde du rez-de-chaussée, RAS.',
  SEC_04: 'Quelqu\'un a touché au casier trois ?',
  ACC_07: 'Lucas ? Tu peux monter voir la cent quatre ? …Merci.',
  // The other patients: M. Garnier (101, insomnia), Mme Roux (102, goes home on the 5th), the man of 107 (agitated
  // at night), the woman of 105.
  VOI_G01: 'Quatre cent douze, quatre cent treize…',
  VOI_G03: 'Vous aussi, vous l\'entendez ?',
  VOI_R02: 'Je sors le cinq. Je sors le cinq…',
  VOI_A01: 'Docteur ! DOCTEUR ! Je sais que vous êtes là !',
  VOI_F_HEURE: 'Il est quelle heure ?',
  VOI_F_ENTENDEZ: 'Vous aussi, vous l’entendez ?',
  VOI_F_COMPTAGE: 'Quatre cent douze, quatre cent treize, quatre cent quatorze, quatre cent quinze…',
};
// His own answers, as thoughts (they play through repliques.js like any other).
const GARNIER = 'Garnier ? Vous dormez pas, vous non plus ?';
const CALLED = 'Docteur Morel… On m\'appelle. C\'est moi, maintenant ?';

const WHO = {
  ANN: 'HAUT-PARLEUR', PER: 'INFIRMIER DE NUIT', SEC: 'AGENT DE SÉCURITÉ', ACC: 'INFIRMIÈRE DE GARDE',
  VOI_G: 'CHAMBRE 101', VOI_R: 'CHAMBRE 102', VOI_A: 'CHAMBRE 107', VOI_F: 'CHAMBRE 105',
};
const whoOf = (id) => WHO[id.slice(0, 5)] ?? WHO[id.slice(0, 3)];
// First-floor rooms Perrin's radio can be heard from, out of sight.
const FAR_ROOMS = ['103', '105', '106', '107', '108', '110', '112', '113', '114', 'Archives'];

// ctx: G, player, hosp, npcs() (pnj.js, once loaded), say(line, pos, opts) (main.js's overheard: resolves once
// heard), thought(text) (resolves to its voice, or null), wait(s) (stops with the pause), quiet() (no dialogue nor
// bubble on screen), loss(), inRoom(), door (outside room 104's door), ear() (the camera's position), footsteps(pos).
export function createAmbiance(ctx) {
  const { G, player, hosp } = ctx;
  const done = new Set();
  const at = {}; // when a scene played (G.time)
  let busy = false, next = 20;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const room = (name, f = 1) => { const s = spot(f, name, 0, 0, 1.5); return V(s.x, s.y, s.z); };
  const floor = () => hosp.floorOf(player.y);
  const zone = () => hosp.roomAt(player.pos.x, player.y, player.pos.z) ?? '';
  const dist = (p) => Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
  const closed = (name) => (hosp.doorNamed(name, 1)?.open ?? 0) < 0.1;
  // Next to a patient's room, in the corridor, its door shut.
  const by = (name, r = 8) => floor() === 1 && zone() === 'Couloir' && closed(name) && dist(room(name)) < r;
  const ceiling = () => { const e = ctx.ear(); return V(e.x, player.y + 2.6, e.z); };
  // Somewhere along the first floor, out of sight, about 14 m away.
  const far = () => FAR_ROOMS.map((n) => room(n)).sort((a, b) => Math.abs(dist(a) - 14) - Math.abs(dist(b) - 14))[0];
  const actor = (id) => ctx.npcs()?.actors.find((a) => a.id === id && !a.wandering && a.root.visible);
  const headOf = (a) => V(a.pos.x, a.pos.y + 1.5, a.pos.z);
  const line = (id, pos, opts = {}) => ctx.say({ id, text: LINES[id] }, pos, { who: whoOf(id), ...opts });
  const after = (id, s) => at[id] !== undefined && G.time - at[id] > s;

  // [id, when, play]: the first one whose `when` holds plays, once. play() returns false if it did not play.
  const SCENES = [
    // Room 104, still locked in: Perrin on his round, far away, then at the door, then leaving.
    ['PER_03', () => floor() === 1 && G.time > 30, () => line('PER_03', far(), { gain: 2.5 })],
    ['PER_104', () => ctx.inRoom() && !G.doorOpen && after('PER_03', 20), async () => {
      ctx.footsteps(ctx.door);
      await ctx.wait(1.6);
      if (!await line('PER_10', ctx.door)) return false;
      await ctx.wait(2.2);
      await line('PER_11', ctx.door);
      ctx.footsteps(ctx.door.clone().add(V(1.5, 0, 2)));
      await ctx.wait(4);
      await line('PER_04', ctx.door.clone().add(V(4, 0, 6)), { gain: 2 });
    }],
    // Out in the first floor.
    ['ANN_07', () => G.leftRoom && floor() === 1 && zone() === 'Couloir', () => line('ANN_07', ceiling())],
    ['GARNIER', () => by('101'), async () => {
      if (!await line('VOI_G01', room('101'), { gain: 1.6 })) return false;
      await ctx.wait(0.6);
      const own = await ctx.thought(GARNIER);
      await ctx.wait(own ? own.remaining + 0.6 : 3);
      await line('VOI_G03', room('101'), { gain: 1.6 });
    }],
    ['ROUX', () => by('Chambre 102'), async () => {
      if (!await line('VOI_R02', room('Chambre 102'), { gain: 1.6 })) return false;
      await ctx.wait(1.5);
      await line('PER_09', room('Chambre 102'), { gain: 1.4 });
    }],
    ['A107', () => by('107', 9), async () => {
      ctx.footsteps(room('107'));
      if (!await line('VOI_A01', room('107'), { gain: 1.8 })) return false;
      await ctx.wait(1.2);
      await line('PER_12', room('107'), { gain: 1.4 });
    }],
    ['VOI_F_HEURE', () => by('105'), () => line('VOI_F_HEURE', room('105'), { gain: 1.6 })],
    ['PER_08', () => after('GARNIER', 45) && by('101', 10), () => line('PER_08', room('101'), { gain: 1.4 })],
    ['VOI_F_ENTENDEZ', () => after('VOI_F_HEURE', 40) && ctx.loss() > 0.35 && by('105', 10), () => line('VOI_F_ENTENDEZ', room('105'), { gain: 1.6 })],
    ['VOI_F_COMPTAGE', () => after('VOI_F_HEURE', 70) && by('105', 10), () => line('VOI_F_COMPTAGE', room('105'), { gain: 1.4 })],
    ['PER_07', () => G.leftRoom && floor() === 1 && !ctx.inRoom() && after('PER_03', 60), () => line('PER_07', far(), { gain: 2.5 })],
    // Between the archives and the laundry: his radio gives away where the coat is.
    ['PER_06', () => G.psyKnown && !G.keys && floor() === 1 && !ctx.inRoom(), () => line('PER_06', far(), { gain: 2.5 })],
    // The ground floor.
    ['ANN_08', () => floor() === 0 && /^Pharmacie/.test(zone()), () => line('ANN_08', ceiling())],
    ['ACC_07', () => {
      const nurse = actor('nurse');
      return G.metNurse && floor() === 0 && nurse && dist(nurse.pos) > 6 && dist(nurse.pos) < 18;
    }, async () => {
      const nurse = actor('nurse');
      if (!await line('ACC_07', headOf(nurse), { gain: 1.6 })) return false;
      await ctx.wait(1.5);
      // Perrin answers on her radio, from upstairs.
      await line('PER_05', headOf(nurse), { gain: 1.2, who: 'TALKIE · INFIRMIER DE NUIT' });
    }],
    ['ANN_05', () => G.blouse && G.metNurse && floor() === 0 && zone() !== 'Accueil' && after('ACC_07', 30), async () => {
      if (!await line('ANN_05', ceiling())) return false;
      await ctx.wait(0.8);
      await ctx.thought(CALLED);
    }],
    ['SEC_03', () => {
      const guard = actor('orderly_male');
      return G.blouse && floor() === 0 && guard && dist(guard.pos) > 5 && dist(guard.pos) < 15;
    }, () => line('SEC_03', headOf(actor('orderly_male')), { gain: 1.4 })],
    ['SEC_04', () => {
      const guard = actor('orderly_male');
      return after('LOCKER', 20) && floor() === 0 && guard && dist(guard.pos) < 14;
    }, () => line('SEC_04', headOf(actor('orderly_male')), { gain: 1.4 })],
    ['ANN_06', () => G.time > 240 && zone() === 'Couloir', () => line('ANN_06', ceiling())],
    // Far gone: the loudspeaker calls him.
    ['ANN_12', () => ctx.loss() > 0.65, () => line('ANN_12', ceiling(), { style: 'thought glitch', who: 'HAUT-PARLEUR ?' })],
  ];

  // The lift's voice on arrival; once far gone, it names a basement the hospital does not have (once).
  let moving = false;
  function lift() {
    const state = hosp.H.lift?.state;
    if (!state) return;
    const arrived = moving && !state.moving;
    moving = state.moving;
    if (!arrived || zone() !== 'Ascenseur' || Math.abs(player.y - state.y) > 0.5) return;
    const pos = V(player.pos.x, state.y + 2.4, player.pos.z);
    if (state.floor === 0 && ctx.loss() > 0.6 && !done.has('ANN_11')) { done.add('ANN_11'); line('ANN_11', pos); }
    else line(state.floor === 1 ? 'ANN_10' : 'ANN_09', pos);
  }

  return {
    update() {
      if (at.LOCKER === undefined && G.lockerOpen) at.LOCKER = G.time;
      lift();
      if (busy || G.time < next || G.over || !ctx.quiet()) return;
      const scene = SCENES.find(([id, when]) => !done.has(id) && when());
      if (!scene) return;
      const [id, , play] = scene;
      busy = true;
      done.add(id);
      at[id] = G.time;
      Promise.resolve(play()).then((ok) => { if (ok === false) { done.delete(id); delete at[id]; } })
        .catch(() => {})
        .finally(() => { busy = false; next = G.time + 15 + Math.random() * 10; });
    },
  };
}
