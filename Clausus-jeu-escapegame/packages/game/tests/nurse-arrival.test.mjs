import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
function setup() {
  let calls = 0, zone = 'Cage d\'escalier', floor = 0, visible = true;
  const G = { blouse: true, metNurse: false, downstairs: false, mode: 'free' };
  const nurse = { id: 'nurse', root: { visible: true }, pos: { x: 10, z: 0 }, camera: { position: {} } };
  const ctx = vm.createContext({ G, player: { pos: { x: 0, z: 0 }, y: -3.3 },
    camera: { position: {} }, groundFloorArrival: () => calls++,
    hosp: { roomAt: () => zone, floorOf: () => floor, clearance: () => visible ? 1 : 0 },
  });
  vm.runInContext(source.slice(source.indexOf('let story = null, lastZone'), source.indexOf('let arrivalTalking =')), ctx);
  ctx.actors = [nurse];
  vm.runInContext('npcs = { actors };', ctx);
  return { G, nurse, ctx, calls: () => calls,
    tick: () => vm.runInContext('storyZones()', ctx),
    zone: (v) => { zone = v; }, floor: (v) => { floor = v; }, visible: (v) => { visible = v; } };
}

for (const blouse of [true, false]) for (const well of ['Cage d\'escalier', 'Ascenseur']) test(`${well}, coat=${blouse}: wait for proximity to the nurse after arriving downstairs`, () => {
  const h = setup(); h.G.blouse = blouse;
  h.zone(well); h.tick();
  h.zone('Couloir'); h.tick();
  assert.equal(h.G.downstairs, true);
  assert.equal(h.calls(), 0);
  h.ctx.player.pos.x = 8;
  h.visible(false); h.tick();
  assert.equal(h.calls(), 0, 'wall blocks the conversation');
  h.visible(true); h.floor(1); h.tick();
  assert.equal(h.calls(), 0, 'other floor');
  h.floor(0); h.G.mode = 'busy'; h.tick();
  assert.equal(h.calls(), 0, 'another interaction is running');
  h.G.mode = 'free'; h.tick();
  assert.equal(h.calls(), 1);
  if (blouse) {
    h.G.metNurse = true; h.tick();
    assert.equal(h.calls(), 1, 'completed conversation does not repeat');
  }
});

test('without the coat, no nurse means no capture', () => {
  const h = setup(); h.G.blouse = false;
  h.ctx.actors.length = 0;
  h.tick(); h.zone('Couloir'); h.tick(); h.tick();
  assert.equal(h.G.downstairs, true);
  assert.equal(h.calls(), 0);
});

test('a hidden nurse cannot trigger recognition, even at close range', () => {
  const h = setup(); h.G.blouse = false;
  h.nurse.root.visible = false;
  h.ctx.player.pos.x = 8;
  h.zone('Couloir'); h.tick();
  assert.equal(h.calls(), 0);
  h.G.blouse = true; h.nurse.root.visible = true; h.tick();
  assert.equal(h.calls(), 1);
});

test('without the coat, proximity in the stairwell or lift does not trigger capture', () => {
  for (const well of ['Cage d\'escalier', 'Ascenseur']) {
    const h = setup(); h.G.blouse = false;
    h.ctx.player.pos.x = 8;
    h.zone(well); h.tick();
    assert.equal(h.calls(), 0);
  }
});

test('the nurse can recognise an undisguised player after an earlier conversation', () => {
  const h = setup(); h.G.blouse = false; h.G.metNurse = true;
  h.ctx.player.pos.x = 8;
  h.zone('Couloir'); h.tick();
  assert.equal(h.calls(), 1);
});

for (const blouse of [false, true]) test(`arrival dialogue, coat=${blouse}: existing nurse lines precede security`, async () => {
  const events = [];
  const G = { blouse, mode: 'free', metNurse: false };
  let finishRecognition;
  const recognition = new Promise((resolve) => { finishRecognition = resolve; });
  const ctx = vm.createContext({ G, ending: false, keys: { clear() {} },
    wait: async () => {}, choose: async () => 2,
    say: async (lines, speaker) => {
      events.push({ lines: Array.from(lines), speaker });
      if (lines.includes('Mais… c\'est le patient de la 104 ! Sécurité !')) await recognition;
    },
    caughtEnding: (alreadySaid) => events.push({ caught: alreadySaid }),
  });
  vm.runInContext(source.slice(source.indexOf('let arrivalTalking ='), source.indexOf('function updateCamera(')), ctx);
  const arrival = vm.runInContext('groundFloorArrival()', ctx);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(G.mode, 'busy');
  assert.equal(events.some((event) => event.caught), false, 'security waits until the nurse finishes');
  const speech = events.at(-1);
  assert.deepEqual(speech.lines, ['…Quoi ?', 'Mais… c\'est le patient de la 104 ! Sécurité !']);
  assert.equal(speech.speaker.who, 'INFIRMIÈRE DE GARDE');
  assert.equal(events.length, blouse ? 2 : 1, 'no doctor greeting without the coat');
  await vm.runInContext('groundFloorArrival()', ctx);
  assert.equal(events.at(-1), speech, 'recognition cannot overlap itself');
  finishRecognition();
  await arrival;
  assert.deepEqual(events.at(-1), { caught: true }, 'security skips the generic recognition lines');
  assert.equal(G.metNurse, false);
});

test('with the coat, a convincing answer keeps the normal nurse conversation', async () => {
  const G = { blouse: true, mode: 'free', metNurse: false };
  let caught = false;
  const ctx = vm.createContext({ G, ending: false, keys: { clear() {} },
    wait: async () => {}, say: async () => {}, choose: async () => 0,
    caughtEnding: () => { caught = true; }, setTimeout: () => {},
  });
  vm.runInContext(source.slice(source.indexOf('let arrivalTalking ='), source.indexOf('function updateCamera(')), ctx);
  await vm.runInContext('groundFloorArrival()', ctx);
  assert.equal(caught, false);
  assert.equal(G.metNurse, true);
  assert.equal(G.mode, 'free');
});
