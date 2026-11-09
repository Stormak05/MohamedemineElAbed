import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../assets/audio/voix/', import.meta.url);
const takes = JSON.parse(readFileSync(new URL('voix.json', dir), 'utf8'));
const texts = JSON.parse(readFileSync(new URL('repliques.json', dir), 'utf8'));

test('chaque prise listée existe et chaque fichier est listé', () => {
  const listed = Object.values(takes).flat();
  for (const name of listed) assert(existsSync(new URL(`${name}.mp3`, dir)), name);
  const files = readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4));
  assert.deepEqual(files.sort(), [...listed].sort());
});

test('les textes reconnus ont une prise, les voix HAL restent jouées par leur code', () => {
  for (const code of Object.keys(texts)) assert(takes[code]?.length, code);
  assert(!Object.keys(texts).some((code) => code.startsWith('HAL_')));
});

test('takeFor retrouve la prise du texte affiché, accents et ponctuation ignorés', async () => {
  globalThis.fetch = async (url) => ({ ok: true, json: async () => (String(url).endsWith('voix.json') ? { PAT_X: ['PAT_X'] } : { PAT_X: 'Mon carnet… Les pages sont arrachées.' }) });
  const { takeFor } = await import('../repliques.js');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(takeFor("mon carnet... les pages sont arrachees"), 'PAT_X');
  assert.equal(takeFor('Autre chose.'), null);
});
