import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const section = (from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));

test('leaving the bedroom continues the story without recording a score', () => {
  let recorded = 0, zones = 0;
  const G = { doorOpen: true, leftRoom: false };
  const ctx = vm.createContext({ G, RX: 2, loss: () => 0,
    THREE: { MathUtils: { clamp: (v) => v } }, keys: new Set(), cfg: {}, touch: { move: { x: 0, y: 0 } },
    player: { pos: { x: 3, z: 0 } }, hosp: { settle() {} },
    recordEscape: () => recorded++, storyZones: () => zones++, setTimeout() {} });
  vm.runInContext(section('function move(dt, t)', '// ---------- Story moments'), ctx);
  vm.runInContext('move(0.016, 1)', ctx);
  assert.equal(G.leftRoom, true);
  assert.equal(zones, 1);
  assert.equal(recorded, 0);
});

test('hospital exit freezes the full run before the cinematic, without a success toast', () => {
  const G = { time: 540.12, hints: 2, errors: 3, pillsTaken: 2, sanity: 0.42, escape: null };
  const stop = new Error('cinematic boundary');
  const ctx = vm.createContext({ G, shell: { embedded: false }, keys: { clear() { throw stop; } } });
  vm.runInContext(section('function recordEscape()', 'const helped ='), ctx);
  vm.runInContext(section('function walkOutside()', '// Developer shortcut'), ctx);
  assert.throws(() => vm.runInContext('walkOutside()', ctx), (e) => e === stop);
  assert.deepEqual(JSON.parse(JSON.stringify(G.escape)), { seconds: 540.1, hints: 2, errors: 3, pills: 2, sanity: 0.42 });
  G.time = 600;
  vm.runInContext('recordEscape()', ctx);
  assert.equal(G.escape.seconds, 540.1);
});

test('resuming an old bedroom score clears it and renews its publication id', () => {
  const G = { escape: {}, published: true, rankTicket: 'old-ticket', runId: 'old-run-id' };
  const ctx = vm.createContext({ G, d: { escape: { seconds: 20 } }, newRunId: () => 'new-run-id' });
  vm.runInContext(section('  // Playable saves precede', '  if (G.bottleTaken)'), ctx);
  assert.equal(G.escape, null);
  assert.equal(G.published, false);
  assert.equal(G.runId, 'new-run-id');
  assert.equal(G.rankTicket, null);
});

test('hospital exit sends the final stats through the server ticket protocol', async () => {
  const G = { time: 600, hints: 1, errors: 2, pillsTaken: 3, sanity: 0.5 };
  let sent;
  const ctx = vm.createContext({ G, shell: { embedded: true, finishRun: async (data) => { sent = data; return data.ticket; } },
    rankingStart: Promise.resolve('run-ticket'), rankingFinish: null });
  vm.runInContext(section('function recordEscape()', 'const helped ='), ctx);
  vm.runInContext('recordEscape()', ctx);
  assert.equal(await ctx.rankingFinish, 'run-ticket');
  assert.deepEqual(JSON.parse(JSON.stringify(sent)), { ticket: 'run-ticket', seconds: 600, hints: 1, errors: 2, pills: 3, sanity: 0.5, cheated: false });
});
