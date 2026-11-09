import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const grant = source.slice(source.indexOf('  S.giveKey ='), source.indexOf('  // Developer menu: jump'));

for (const [action, flag] of [['giveRoomKey', null], ['giveKeys', 'keys'], ['giveMeetingKey', 'meetingKey'], ['giveCard', 'card']]) {
  test(`${action} grants only the requested item, including on repeated use`, () => {
    const G = { unlocked: false, keys: false, blouse: false, lockerOpen: false, meetingKey: false, planning: false, card: false };
    const roomBox = { open: false, keyTaken: false, lid: { rotation: { x: 0 } }, key: { visible: true } };
    const locker = { key: { visible: true } }, coffret = { card: { visible: true } }, S = {};
    vm.runInNewContext(grant, { S, G, roomBox, locker, coffret });
    S.giveKey(action);
    S.giveKey(action);
    for (const [name, value] of Object.entries(G)) assert.equal(value, name === flag, name);
    assert.equal(roomBox.keyTaken, action === 'giveRoomKey');
    assert.equal(roomBox.open, action === 'giveRoomKey');
    assert.equal(roomBox.key.visible, action !== 'giveRoomKey');
    assert.equal(locker.key.visible, action !== 'giveMeetingKey');
    assert.equal(coffret.card.visible, action !== 'giveCard');
  });
}
