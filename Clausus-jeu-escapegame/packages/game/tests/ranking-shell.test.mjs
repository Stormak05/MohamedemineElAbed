import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function makeShell() {
  const messages = [], timers = new Map();
  let receive;
  const parent = { postMessage: (data, origin) => messages.push({ data, origin }) };
  const shell = new Function('window', 'location', 'addEventListener', 'setTimeout', 'clearTimeout',
    readFileSync(new URL('../shell.js', import.meta.url), 'utf8').replace('export const shell =', 'const shell =') + '\nreturn shell;'
  )({ parent }, { origin: 'https://clausus.example' }, (_, cb) => { receive = cb; },
    (cb) => { const id = Symbol(); timers.set(id, cb); return id; }, (id) => timers.delete(id));
  const answer = (data, origin = 'https://clausus.example', source = parent) => receive({ data, origin, source });
  return { shell, messages, timers, answer, parent };
}

test('ranking tickets cross the frame bridge and only accept the parent origin/source', async () => {
  const h = makeShell();
  const pending = h.shell.beginRun();
  const { data, origin } = h.messages[0];
  assert.equal(origin, 'https://clausus.example');
  assert.equal(data.action, 'begin');
  h.answer({ type: 'clausus:ranked', requestId: data.requestId, ticket: 'forged' }, 'https://attacker.example');
  h.answer({ type: 'clausus:ranked', requestId: data.requestId, ticket: 'forged' }, origin, {});
  assert.equal(h.timers.size, 1);
  h.answer({ type: 'clausus:ranked', requestId: data.requestId, ticket: 'server-ticket' });
  assert.equal(await pending, 'server-ticket');
  assert.equal(h.timers.size, 0);
});
test('offline ranking times out without blocking gameplay or retaining callbacks', async () => {
  const h = makeShell();
  const pending = h.shell.finishRun({ ticket: 'ticket', seconds: 30, cheated: false });
  assert.equal(h.messages[0].data.action, 'finish');
  for (const callback of h.timers.values()) callback();
  assert.equal(await pending, null);
});
