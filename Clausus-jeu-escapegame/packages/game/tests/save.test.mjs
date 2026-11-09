import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../vendor/three/three.core.js';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
function game() {
  const sent = [], restored = [];
  const G = { started: true, mode: 'free', time: 150, sanity: .6, hinted: { 2: true }, pills: 3, coins: 2, runId: 'abcdefgh',
    rankTicket: '12345678-1234-1234-1234-123456789abc', unlocked: true, doorOpen: true, keys: true, blouse: true, planning: true };
  const player = { pos: new THREE.Vector3(12, 0, 4), y: -3.3, vy: 0, yaw: 1, pitch: -.2 };
  const door = { target: 1, leaves: [{ pivot: { rotation: {} }, openAngle: 1.5 }], col: { active: true } };
  const context = vm.createContext({ G, player, props: { setClock() {} }, computers: [{ os: { snapshot: () => ({ on: true }), restore: (d) => restored.push(d) } }],
    hosp: { H: { swingDoors: [door] }, roomAt: () => 'Couloir', canStand: () => true },
    shell: { signedIn: () => true, save: (d) => sent.push(plain(d)), clearSave: () => sent.push(null) },
    story: { snapshot: () => ({ coins: [true], plan: ['visite'] }), restore: (d) => restored.push(d) },
    world: { forceDecay() {}, doorPivot: { rotation: {} } }, assets: {}, scene: {}, loss: () => .4,
    unlockRoom() {}, menus: { setSave() {} } });
  vm.runInContext(source.slice(source.indexOf('const SAVE_VERSION ='), source.indexOf('// [x, z, yaw, y]')), context);
  return { G, player, door, sent, restored, context, run: (code) => vm.runInContext(code, context) };
}

test('round trip retains hospital progression, inventory, stats, hints, run and safe position', () => {
  const h = game();
  h.run('trackSafeSpot(); saveGame(); globalThis.saved = JSON.parse(JSON.stringify(snapshot))');
  Object.assign(h.G, { time: 0, sanity: 1, keys: false, blouse: false, planning: false, pills: 0 });
  h.player.pos.set(0, 0, 0);
  assert.equal(h.run('applySave(saved)'), true);
  assert.equal(h.G.time, 150); assert.equal(h.G.sanity, .6);
  assert.equal(h.G.keys, true); assert.equal(h.G.blouse, true); assert.equal(h.G.planning, true);
  assert.equal(h.G.pills, 3); assert.equal(h.G.coins, 2); assert.equal(h.G.hinted[2], true);
  assert.equal(h.G.runId, 'abcdefgh'); assert.equal(h.G.rankTicket, '12345678-1234-1234-1234-123456789abc');
  assert.equal(h.player.pos.x, 12); assert.equal(h.player.y, -3.3);
  assert.deepEqual(plain(h.restored), [{ coins: [true], plan: ['visite'] }, { on: true }]);
  assert.equal(h.door.open, 1); assert.equal(h.door.col.active, false);
  assert.equal(h.door.leaves[0].pivot.rotation.y, 1.5);
});

test('lift and airborne positions keep the previous safe floor position', () => {
  const h = game(); h.run('trackSafeSpot()');
  h.player.pos.x = 90; h.player.vy = 1; h.run('trackSafeSpot()');
  h.player.vy = 0; h.context.hosp.roomAt = () => 'Ascenseur'; h.run('trackSafeSpot(); saveGame()');
  assert.equal(h.sent[0].player.x, 12);
});

test('guest, not started and finished games cannot overwrite a saved game', () => {
  const h = game(); h.context.shell.signedIn = () => false;
  assert.equal(h.run('saveGame()'), false);
  h.context.shell.signedIn = () => true; h.G.started = false;
  assert.equal(h.run('saveGame()'), false);
  h.G.started = true; h.G.over = true;
  assert.equal(h.run('saveGame()'), false); assert.equal(h.sent.length, 0);
});

test('busy actions use the last consistent snapshot and dropping clears the save', () => {
  const h = game(); h.run('saveGame()'); h.G.mode = 'busy'; h.G.keys = false;
  h.run('saveGame(); dropSave()');
  assert.equal(h.sent[1].keys, true); assert.equal(h.sent[2], null);
});

test('old version rejected; invalid numbers and positions do not corrupt the player', () => {
  const h = game(); assert.equal(h.run('applySave({v: 1})'), false);
  h.context.hosp.canStand = () => false;
  h.run('applySave({v: 2, time: Infinity, sanity: -3, pills: 9999, coins: -2, hinted: [2, 99], player: {x: 999, z: 3, y: 0, yaw: 0}})');
  assert.equal(h.G.time, 0); assert.equal(h.G.sanity, .05); assert.equal(h.G.pills, 99); assert.equal(h.G.coins, 0);
  assert.equal(h.player.pos.x, 12); assert.deepEqual(Object.keys(h.G.hinted), ['2']);
});

test('story restores collected coins, searched coats, drawers, planning and final card', () => {
  const sourceBlock = source.slice(source.indexOf('  S.snapshot ='), source.indexOf('  // Developer menu: jump'));
  const drawer = () => ({ open: false, restore(v) { this.open = v === true; } });
  const coins = [{ taken: false, c: { removeFromParent() { this.removed = true; } } }];
  const context = vm.createContext({ S: { archDrawer: drawer() }, rd: drawer(), storyCoins: coins, medicine: [{ id: 'ward', taken: false, bottle: { visible: true } }],
    roomBox: { open: false, keyTaken: false, lid: { rotation: {} }, key: { visible: true } },
    searchedCoats: new Set(), coffretOpen: false, placedTasks: [null, null, null, null, null],
    rack: { coats: [{ userData: {} }] }, G: { card: true, meetingKey: true }, COATS: [],
    locker: { key: {} }, TASKS: [{ id: 'a' }, { id: 'b' }], SOLUTION: [], board: { redraw() {} }, dir: { redraw() {} },
    coffret: { lid: { rotation: {} }, card: {} }, dropPlans() {} });
  vm.runInContext(sourceBlock, context);
  vm.runInContext('S.restore({roomBoxOpen:true,roomKey:true,medicine:["ward"], coins:[true], searched:[0,999], drawers:[true,true], plan:["a","a","invalid","b"]})', context);
  assert.equal(context.medicine[0].taken, true); assert.equal(context.medicine[0].bottle.visible, false);
  assert.equal(context.roomBox.keyTaken, true); assert.equal(context.roomBox.key.visible, false);
  assert.equal(plain(context.S.snapshot()).roomKey, true);
  assert.equal(context.rd.open, true); assert.equal(context.S.archDrawer.open, true);
  assert.equal(coins[0].taken, true); assert.equal(coins[0].c.removed, true);
  assert.deepEqual(plain(context.placedTasks), ['a', null, null, 'b', null]);
  assert.equal(context.coffret.card.visible, false);
  assert.equal(plain(context.S.snapshot()).drawers[0], true);
});

test('drawer restoration updates both the interaction state and actual model position', () => {
  const drawer = { position: { z: .05 } }, table = new THREE.Group();
  table.getObjectByName = () => drawer;
  const context = vm.createContext({ THREE, table, yawOf: () => 0, addInteractable() {} });
  vm.runInContext(source.slice(source.indexOf('function makeDrawer('), source.indexOf('// Local (x, z)')), context);
  vm.runInContext('globalThis.state = makeDrawer(table, null); state.restore(true)', context);
  assert.equal(context.state.open, true); assert.equal(drawer.position.z, .35);
  context.state.restore(false); assert.equal(drawer.position.z, .05);
});

const osSource = readFileSync(new URL('../os.js', import.meta.url), 'utf8');
const storySource = readFileSync(new URL('../histoire.js', import.meta.url), 'utf8');
function os(profile) {
  const context = vm.createContext({ THREE: { CanvasTexture: class {} },
    document: { createElement: () => ({ getContext: () => ({}) }) } });
  vm.runInContext(storySource.slice(storySource.indexOf('export const STORY'), storySource.indexOf('// ---------- Énigme 3:')).replaceAll('export ', ''), context);
  vm.runInContext(osSource.replace(/^import .*;$/gm, '').replaceAll('export ', '') + '\nglobalThis.MiniOS = MiniOS;', context);
  context.MiniOS.prototype.draw = () => {};
  return new context.MiniOS({ profile, audio: { pcSeek() {} } });
}

test('PC session restores archive location and partially corrected program without replaying callbacks', () => {
  const cipher = os('securite');
  cipher.restore({ on: true, windows: [{ id: 'cipher', data: { pick: [1, 3, 2] } }] });
  assert.equal(cipher.state, 'desktop');
  assert.deepEqual(plain(cipher.snapshot()).windows[0].data.pick, [1, 3, 2]);
  const restored = os('securite'); restored.restore(plain(cipher.snapshot()));
  assert.deepEqual(plain(restored.snapshot()), plain(cipher.snapshot()));
  // Untrusted values and apps from another machine are discarded.
  restored.restore({ on: true, windows: [{ id: 'files' }, { id: 'cipher', data: { pick: [-1, Infinity, 99] } }] });
  assert.deepEqual(plain(restored.snapshot()).windows, [{ id: 'cipher', data: { pick: [0, 0, 0] } }]);
  const archives = os('archives'); archives.open('files');
  const app = archives.windows[0]; app.click(0, 25); // enter the first folder
  const save = plain(archives.snapshot());
  assert.ok(save.windows[0].data.path.length);
  const another = os('archives'); another.restore(save);
  assert.deepEqual(plain(another.snapshot()), save);
});

const stageSource = readFileSync(new URL('../../../apps/web/src/components/game-stage.tsx', import.meta.url), 'utf8');
function storeHarness() {
  const calls = [], replies = [];
  let release;
  const block = new Promise((resolve) => { release = resolve; });
  const context = vm.createContext({
    user: { current: 'alice' }, gen: { current: 0 }, save: {}, writes: { current: block },
    client: { save: { put: async ({ data }) => calls.push(data), clear: async () => calls.push(null) } },
    frame: { current: { contentWindow: { postMessage: (d) => replies.push(d) } } }, window: { location: { origin: 'local' } },
    useCallback: (fn) => fn });
  const start = stageSource.indexOf('  const store = useCallback(');
  const end = stageSource.indexOf('\n\n  useEffect(', start);
  vm.runInContext(stageSource.slice(start, end).replace('(data: SaveData | null)', '(data)'), context);
  return { context, calls, replies, release, run: (s) => vm.runInContext(s, context) };
}

test('site persists save/clear/new save in order and acknowledges every completed write', async () => {
  const h = storeHarness(); h.run('store({time: 1}); store(null); store({time: 2})'); h.release();
  await h.context.writes.current;
  assert.deepEqual(plain(h.calls), [{ time: 1 }, null, { time: 2 }]);
  assert.equal(h.replies.length, 3); assert.ok(h.replies.every((r) => r.ok));
});

test('queued saves cannot write into a different signed-in account', async () => {
  const h = storeHarness(); h.run('store({time: 1}); store(null)');
  h.context.user.current = 'bob'; h.release(); await h.context.writes.current;
  assert.deepEqual(h.calls, []); assert.deepEqual(h.replies, []);
});

test('a failed save reports failure and does not block subsequent saves', async () => {
  const h = storeHarness(); let fail = true;
  h.context.client.save.put = async () => { if (fail) { fail = false; throw Error('offline'); } };
  h.run('store({time: 1}); store({time: 2})'); h.release(); await h.context.writes.current;
  assert.deepEqual(plain(h.replies).map((r) => r.ok), [false, true]);
});

test('a guest requesting sign-in saves their active game once the pseudo arrives', () => {
  const h = game(); let onPlayer;
  h.context.shell.onPlayer = (cb) => { onPlayer = cb; };
  h.context.menus.setPlayer = () => {};
  h.run('saveOnSignIn = true');
  vm.runInContext(source.slice(source.indexOf('shell.onPlayer((pseudo)'), source.indexOf('shell.onSave((save)')), h.context);
  onPlayer(''); assert.equal(h.sent.length, 0);
  onPlayer('Jules'); assert.equal(h.sent.length, 1);
  onPlayer('Jules'); assert.equal(h.sent.length, 1);
  assert.equal(h.run('manualSave'), true);
});

test('only messages from the same-origin parent may deliver a save or acknowledgement', () => {
  const events = {}, parent = { postMessage() {} };
  const context = vm.createContext({ window: { parent }, location: { origin: 'local' }, addEventListener: (k, cb) => events[k] = cb });
  const shellSource = readFileSync(new URL('../shell.js', import.meta.url), 'utf8').replace('export const shell', 'globalThis.shell');
  vm.runInContext(shellSource, context);
  let got = 0; context.shell.onSave(() => got++);
  const message = { type: 'clausus:save', save: { data: { v: 2 }, savedAt: new Date().toISOString() } };
  events.message({ origin: 'foreign', source: parent, data: message });
  events.message({ origin: 'local', source: {}, data: message });
  assert.equal(got, 0);
  events.message({ origin: 'local', source: parent, data: message }); assert.equal(got, 1);
});

test('guest save survives a fresh site load after OAuth and is consumed once for the signed-in account', async () => {
  const h = storeHarness(), data = { v: 2, time: 180, keys: true };
  const storage = new Map([['clausus-pending-save', JSON.stringify({ at: Date.now(), data })]]);
  let delivered = 0;
  Object.assign(h.context, { userId: 'alice', PENDING_SAVE: 'clausus-pending-save', PENDING_SAVE_TTL: 60000,
    sessionStorage: { getItem: (key) => storage.get(key), removeItem: (key) => storage.delete(key) },
    sendSave: () => delivered++, useEffect: (fn) => fn() });
  const start = stageSource.indexOf('  useEffect(() => {\n    const mine = ++gen.current;');
  const end = stageSource.indexOf('\n\n  const send =', start);
  vm.runInContext(stageSource.slice(start, end).replace(' as SaveData', ''), h.context);
  h.release(); await h.context.writes.current;
  assert.deepEqual(plain(h.calls), [data]); assert.equal(delivered, 1);
  assert.equal(storage.size, 0); assert.deepEqual(plain(h.context.save.current.data), data);
});

test('an abandoned guest save from an old sign-in attempt does not replace the account save', async () => {
  const h = storeHarness(), data = { v: 2, time: 180, keys: true };
  const storage = new Map([['clausus-pending-save', JSON.stringify({ at: Date.now() - 3600e3, data })]]);
  let fetched = 0;
  Object.assign(h.context, { userId: 'alice', PENDING_SAVE: 'clausus-pending-save', PENDING_SAVE_TTL: 60000,
    sessionStorage: { getItem: (key) => storage.get(key), removeItem: (key) => storage.delete(key) },
    sendSave() {}, useEffect: (fn) => fn(), client: { save: { get: () => { fetched++; return new Promise(() => {}); } } } });
  const start = stageSource.indexOf('  useEffect(() => {\n    const mine = ++gen.current;');
  const end = stageSource.indexOf('\n\n  const send =', start);
  vm.runInContext(stageSource.slice(start, end).replace(' as SaveData', ''), h.context);
  assert.deepEqual(plain(h.calls), []); assert.equal(fetched, 1); assert.equal(storage.size, 0);
});
