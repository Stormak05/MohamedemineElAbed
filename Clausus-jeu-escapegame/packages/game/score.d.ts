// Types for score.js (plain JS, also imported by packages/api and apps/web).
export type Run = { seconds: number; hints: number; errors: number; sanity: number };
export declare const SCORE_LIMITS: {
  minSeconds: number;
  maxSeconds: number;
  maxHints: number;
  maxErrors: number;
  maxPills: number;
};
export declare function scoreOf(run: Run): number;
export declare function formatTime(seconds: number): string;
