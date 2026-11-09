import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The 64 recorded lines that had a file but no scene (list of 2026-11-06): each one is now said somewhere in the game.
// Lines matched on their text (say/thought, repliques.js) need that text in the game; the others (announcements,
// rounds, other patients: ambiance.js) are played by their code and show the same text as subtitle.
const CODES = [
  'ACC_07',
  'ANN_01', 'ANN_02', 'ANN_03', 'ANN_04', 'ANN_05', 'ANN_06', 'ANN_07', 'ANN_08', 'ANN_10', 'ANN_11', 'ANN_12',
  'PAT_H04', 'PAT_H05', 'PAT_H06', 'PAT_H07', 'PAT_H08', 'PAT_H09', 'PAT_H10', 'PAT_H11', 'PAT_H12', 'PAT_H13',
  'PAT_H14', 'PAT_H15', 'PAT_H16',
  'PAT_P12', 'PAT_P20', 'PAT_P26', 'PAT_P27', 'PAT_P30', 'PAT_P31', 'PAT_P44', 'PAT_P45', 'PAT_P47', 'PAT_P49',
  'PAT_P50', 'PAT_P51', 'PAT_P52',
  'PER_03', 'PER_04', 'PER_05', 'PER_06', 'PER_07', 'PER_08', 'PER_09', 'PER_10', 'PER_11', 'PER_12',
  'SEC_03', 'SEC_04',
  'TEL_19', 'TEL_20', 'TEL_21', 'TEL_22', 'TEL_23', 'TEL_24', 'TEL_25',
  'VOI_A01', 'VOI_F_COMPTAGE', 'VOI_F_ENTENDEZ', 'VOI_F_HEURE', 'VOI_G01', 'VOI_G03', 'VOI_R02',
];
// Left aside, with the reason (none today).
const EXCEPTIONS = {};
// Played by their code (ambiance.js, the phantom call), not found from the text on screen.
const BY_CODE = /^(ACC|ANN_0[5-9]|ANN_1|PER|SEC|VOI)|^TEL_24$/;

const game = new URL('../', import.meta.url);
const texts = JSON.parse(readFileSync(new URL('assets/audio/voix/repliques.json', game), 'utf8'));
const takes = JSON.parse(readFileSync(new URL('assets/audio/voix/voix.json', game), 'utf8'));
const files = [...readdirSync(game).filter((f) => f.endsWith('.js')).map((f) => new URL(f, game)),
  ...readdirSync(new URL('hopital/', game)).filter((f) => f.endsWith('.js')).map((f) => new URL(`hopital/${f}`, game))];
const source = files.map((f) => readFileSync(f, 'utf8')).join('\n');
// Same normalisation as repliques.js: no accents, no punctuation, lower case.
const key = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// The game's strings, one by one (quotes and template literals), escaped apostrophes included.
const strings = [...source.matchAll(/'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)].map((m) => key((m[1] ?? m[2]).replace(/\\'/g, '\'').replace(/\$\{[^}]*\}/g, '')));

test('chaque réplique à intégrer a son texte dans le jeu, ou une raison de rester de côté', () => {
  for (const code of CODES) {
    if (EXCEPTIONS[code]) continue;
    assert(texts[code], `${code} absent de repliques.json`);
    assert(takes[code]?.length, `${code} sans prise`);
    if (code === 'PAT_P30') continue; // one take per coat, below
    assert(strings.includes(key(texts[code])), `${code} : « ${texts[code]} » n'est affiché nulle part`);
  }
});

test('les voix jouées par leur code sont appelées par ce code', () => {
  for (const code of CODES.filter((c) => BY_CODE.test(c) && !EXCEPTIONS[c])) {
    assert(new RegExp(`\\b${code}\\b`).test(source), `${code} n'est jamais joué`);
  }
});

test('le portant de la laverie lit chaque nom avec sa prise (PAT_P30, une blouse par prise)', () => {
  const histoire = readFileSync(new URL('histoire.js', game), 'utf8');
  for (const take of takes.PAT_P30) assert(histoire.includes(`voice: '${take}'`), take);
  assert(source.includes('La blouse de ${c.who}.'));
  assert.equal(key(texts.PAT_P30), key('La blouse de Dr Sarah Bernard.'));
});

test('les pensées suivies d\'une touche (« [C] ») retrouvent leur prise', () => {
  assert(source.includes("takeFor(text.replace(/ \\[[^\\]]*\\]$/, ''))"));
  assert(source.includes('Ma tête… Il me faut un cachet.${keyTag(\'kPill\')}'));
  assert(source.includes('Mes cachets…${keyTag(\'kPill\')}'));
  assert.equal(key(texts.PAT_P45), key('Ma tête… Il me faut un cachet.'));
  assert.equal(key(texts.PAT_P47), key('Mes cachets…'));
});
