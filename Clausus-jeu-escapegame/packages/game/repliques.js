// The recorded lines of the voice sheet (studio clausus-voix.frohub.eu), effects, gain and trim already applied.
// assets/audio/voix/voix.json lists the takes of each code ({ "PAT_P03": ["PAT_P03"], "PAT_P30": ["PAT_P30", "PAT_P30_2"] }),
// repliques.json the text the game shows for it. say() and thought() play the take of the line they show,
// matched on that text: a line whose wording changes in the game simply goes back to silence (or blips).
const key = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

let takes = {};
const byText = new Map();
const json = (name) => fetch(`assets/audio/voix/${name}.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
Promise.all([json('voix'), json('repliques')]).then(([t, texts]) => {
  takes = t;
  for (const [code, text] of Object.entries(texts)) byText.set(key(text), code);
});

// The file to play for a line shown on screen (name under assets/audio/voix/, without .mp3), or null.
export function takeFor(text) {
  const list = takes[byText.get(key(text))];
  return list?.length ? list[Math.floor(Math.random() * list.length)] : null;
}
