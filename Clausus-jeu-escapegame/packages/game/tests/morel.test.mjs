import { test } from 'node:test';
import assert from 'node:assert/strict';
import { morelWhispers, MOREL_NOTES } from '../morel.js';
import { Audio } from '../audio.js';

test('Morel whispers respect sanity and disguise; the final revelation needs very low sanity', () => {
  assert.deepEqual(morelWhispers(0.49, true), []);
  assert.ok(!morelWhispers(1, false).some(x => x.id === 'MOR_H04'));
  assert.ok(morelWhispers(0.5, true).some(x => x.id === 'MOR_H04'));
  assert.ok(!morelWhispers(0.84, true).some(x => x.id === 'MOR_H06'));
  assert.ok(morelWhispers(0.85, false).some(x => x.id === 'MOR_H06'));
  assert.equal(MOREL_NOTES.length, 6);
  assert.match(MOREL_NOTES[0].text, /cent quatre/);
});

test('recorded dialogue waits for first decoding, pauses at its offset, resumes and stops', async () => {
  const audio = new Audio(), starts = [], sources = [];
  audio.voice = {};
  audio.out = () => ({});
  audio.ac = {
    currentTime: 0,
    createGain: () => ({ gain: {}, connect() {}, disconnect() {} }),
    createBufferSource: () => {
      const source = { connect() {}, disconnect() {}, start: (...args) => starts.push(args), stop() { this.stopped = true; } };
      sources.push(source); return source;
    },
  };
  let finishLoad, loads = 0;
  audio.load = async name => {
    loads++;
    await new Promise(resolve => { finishLoad = resolve; });
    audio.buffers[name] = { duration: 10 };
  };
  const pending = audio.spokenLine('MOR_D01');
  assert.equal(starts.length, 0);
  finishLoad();
  const voice = await pending;
  assert.deepEqual(starts, [[0, 0]]);
  audio.ac.currentTime = 3;
  audio.setPaused(true);
  assert.equal(voice.remaining, 7);
  assert.equal(sources[0].stopped, true);
  audio.ac.currentTime = 20;
  assert.equal(voice.remaining, 7);
  audio.setPaused(false);
  assert.deepEqual(starts[1], [20, 3]);
  voice.stop();
  assert.equal(sources[1].stopped, true);
  assert.equal(audio.spoken.size, 0);
  (await audio.spokenLine('MOR_D01')).stop();
  assert.equal(loads, 1);
});

test('a missing recording falls back to subtitles without retrying each interaction', async () => {
  const audio = new Audio();
  audio.ac = {};
  let loads = 0;
  audio.load = async () => { loads++; };
  assert.equal(await audio.spokenLine('MOR_D02'), null);
  assert.equal(await audio.spokenLine('MOR_D02'), null);
  assert.equal(loads, 1);
});
