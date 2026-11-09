import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SCORE_LIMITS } from '../score.js';

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const line = (start) => source.slice(source.indexOf(start), source.indexOf('\n', source.indexOf(start)));

test('digits are read from the physical key, so the AZERTY top row types numbers', () => {
  const ctx = vm.createContext({});
  vm.runInContext(line('const keyDigit ='), ctx);
  const keyDigit = vm.runInContext('keyDigit', ctx);
  assert.equal(keyDigit({ code: 'Digit1', key: '&' }), 1);
  assert.equal(keyDigit({ code: 'Digit0', key: 'à' }), 0);
  assert.equal(keyDigit({ code: 'Numpad7', key: '7' }), 7);
  assert.equal(keyDigit({ code: 'KeyE', key: 'e' }), null);
  assert.equal(keyDigit({ code: '', key: '4' }), 4); // virtual keyboards give no code
});

test('a held Enter on a padlock counts one wrong code, not one per key repeat', () => {
  const start = source.indexOf('function codePanel(');
  const body = source.slice(start, source.indexOf('// ---------- Interactions', start));
  assert.match(body, /if \(e\.key === 'Enter' && e\.repeat\) return;/);
});

test('bought pills stay within what the server accepts for a ranked run', () => {
  assert.ok(SCORE_LIMITS.maxPills >= 4 + 20, 'four free pills plus one per coin a save can hold');
  const counts = source.match(/const SAVED_COUNTS = \{([^}]*)\}/)[1];
  assert.ok(SCORE_LIMITS.maxErrors >= Number(/errors: (\d+)/.exec(counts)[1]));
});
