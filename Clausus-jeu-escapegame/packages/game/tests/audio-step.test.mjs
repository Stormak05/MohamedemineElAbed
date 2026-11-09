import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Audio } from '../audio.js';

test('footsteps use existing samples and preserve their world position, including the fallback', () => {
  const audio = new Audio(), pos = { x: 4, y: -3.3, z: 7 };
  let sample, fallback;
  audio.play = (name, options) => { sample = { name, ...options }; return true; };
  audio.noise = (duration, options) => { fallback = { duration, ...options }; };
  audio.step(0.16, pos);
  assert.match(sample.name, /^step_[1-6]$/);
  assert.equal(sample.pos, pos);
  assert.equal(sample.gain, 0.32);
  assert.equal(fallback, undefined);
  audio.play = () => false;
  audio.step(0.16, pos);
  assert.equal(fallback.pos, pos);
  assert.equal(fallback.gain, 0.16);
  audio.step(0.1);
  assert.equal(fallback.pos, null, 'player footsteps remain unpositioned');
});
