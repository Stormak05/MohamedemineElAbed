// Score of an escape from the hospital, shared by the game (end screen, pause) and the server (packages/api), which
// recomputes it from the submitted stats: the formula lives only here.
// 10 000 points, minus 5 per second, 500 per hint (phone call), 100 per error, plus 10 per % of sanity left.
export const SCORE_LIMITS = {
  minSeconds: 20, maxSeconds: 4 * 3600,
  // Pills: the four free ones plus one per coin (the save keeps at most 20); errors: as many as a save keeps.
  maxHints: 50, maxErrors: 999, maxPills: 4 + 20,
};

/** run: { seconds, hints, errors, sanity (0 to 1) } → points (integer, ≥ 0). */
export function scoreOf(run) {
  const points = 10000 - 5 * run.seconds - 500 * run.hints - 100 * run.errors + 1000 * run.sanity;
  return Math.max(0, Math.round(points));
}

/** 192.4 → "3 min 12 s". */
export function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}
