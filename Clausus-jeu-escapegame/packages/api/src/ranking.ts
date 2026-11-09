/**
 * Ranking protocol checks, independent of transport/DB. These bound client claims; they cannot prove that a
 * browser actually solved a puzzle. A capability is valid for seven days, including pauses and saved games.
 */
export const RANKED_RUN_TTL = 7 * 24 * 3600 * 1000;
export function canFinishRankedRun(startedAt: Date, now: Date, seconds: number) {
  const elapsed = now.getTime() - startedAt.getTime();
  // Allow a small clock/rounding margin, never enough to skip the minimum 20-second run.
  return elapsed >= 20_000 && elapsed <= RANKED_RUN_TTL && seconds * 1000 <= elapsed + 2000;
}
export function isRankedRunExpired(startedAt: Date, now: Date) {
  return now.getTime() - startedAt.getTime() > RANKED_RUN_TTL;
}
