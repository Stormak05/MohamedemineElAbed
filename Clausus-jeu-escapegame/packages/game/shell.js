// Link with the site around the game (apps/web serves it full screen at /, in a same-origin frame):
// the site sends the player's pseudo (empty for a guest) and covers the game with its own screens (welcome, sign-in,
// pseudo, account), drawn with the same kit (ui-kit.js); the game asks it to open the account page, the sign-in page or
// the leaderboard, to sign out, or to publish an escape (the site sends it to the server once signed in, and answers
// clausus:published).
// Saved games go through the site too (it holds the session and calls the API): it sends the player's save, the game
// sends a snapshot to keep or asks to drop it. Only signed-in players have one.
// Run standalone (node serve.mjs), the game has no site around it and none of this shows.
const embedded = window.parent !== window;
const post = (type, extra) => window.parent.postMessage({ type, ...extra }, location.origin);
let onPlayer = () => {};
let onCover = () => {};
let onSave = () => {};
let onSaved = () => {};
const ranking = new Map();
function rankRequest(action, input) {
  if (!embedded) return Promise.resolve(null);
  const requestId = crypto.randomUUID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => { ranking.delete(requestId); resolve(null); }, 15000);
    ranking.set(requestId, (ticket) => { clearTimeout(timer); resolve(ticket); });
    post('clausus:rank', { requestId, action, input });
  });
}
const publishing = new Map(); // runId → cb(ok)
let covered = embedded; // In the site, covered until it says otherwise (it answers clausus:ready right away).
let pseudo = '';

if (embedded) {
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    const d = e.data;
    if (d?.type === 'clausus:player') { pseudo = String(d.pseudo ?? ''); onPlayer(pseudo); }
    else if (d?.type === 'clausus:cover') { covered = Boolean(d.on); onCover(covered, Boolean(d.start)); }
    else if (d?.type === 'clausus:save') onSave(d.save && typeof d.save.data === 'object' ? { data: d.save.data, savedAt: new Date(d.save.savedAt) } : null);
    else if (d?.type === 'clausus:saved') onSaved(Boolean(d.ok));
    else if (d?.type === 'clausus:ranked') {
      const cb = ranking.get(d.requestId); ranking.delete(d.requestId); cb?.(d.ticket || null);
    }
    else if (d?.type === 'clausus:published') {
      // A guest is first told no (sent to sign in), then yes once signed in: keep the callback until a yes.
      const cb = publishing.get(d.runId);
      if (d.ok) publishing.delete(d.runId);
      cb?.(Boolean(d.ok));
    }
  });
}

export const shell = {
  embedded,
  /** Signed in (the site sent a pseudo): the only players whose game can be saved. */
  signedIn: () => embedded && pseudo !== '',
  /** cb(pseudo) runs each time the site sends the signed-in player ('' for a guest). */
  onPlayer(cb) { onPlayer = cb; if (embedded) post('clausus:ready'); },
  /** True while one of the site's screens is over the game: menus hidden, nothing starts. */
  isCovered: () => covered,
  /**
   * cb(on, start) runs each time the site shows (on) or removes (off) one of its screens over the game. `start`: the
   * player chose "Jouer" on the site's welcome screen, so open the notice before the game rather than the main menu.
   */
  onCover(cb) { onCover = cb; },
  /** cb(save) runs each time the site sends the player's saved game: { data, savedAt }, or null (none, or a guest). */
  onSave(cb) { onSave = cb; },
  /** cb(ok) runs when the site has stored (or failed to store) the last snapshot. */
  onSaved(cb) { onSaved = cb; },
  /** Keep this snapshot as the player's saved game (signed-in players only). */
  save(data) { if (shell.signedIn()) post('clausus:save', { data }); },
  /** Drop the player's saved game (game over, or starting over). */
  clearSave() { if (shell.signedIn()) post('clausus:save', { data: null }); },
  account() { if (embedded) post('clausus:account'); },
  login(data) { if (embedded) post('clausus:login', { data }); },
  logout() { if (embedded) post('clausus:logout'); },
  leaderboard() { if (embedded) post('clausus:leaderboard'); },
  beginRun() { return rankRequest('begin', {}); },
  finishRun(input) { return rankRequest('finish', input); },
  /** run: { runId, ticket }; cb(ok) once the site has answered. */
  publish(run, cb) {
    if (!embedded) { cb(false); return; }
    publishing.set(run.runId, cb);
    window.parent.postMessage({ type: 'clausus:publish', run }, location.origin);
  },
};
