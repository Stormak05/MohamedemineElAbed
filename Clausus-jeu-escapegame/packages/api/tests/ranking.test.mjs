import { test } from "node:test";
import assert from "node:assert/strict";

import { canFinishRankedRun, isRankedRunExpired, RANKED_RUN_TTL } from "../src/ranking.ts";

const start = new Date("2026-11-04T12:00:00Z");
const after = (ms) => new Date(start.getTime() + ms);

test("a ticket cannot finish immediately, even with a plausible claimed duration", () => {
  assert.equal(canFinishRankedRun(start, after(0), 20), false);
  assert.equal(canFinishRankedRun(start, after(19_999), 20), false);
  assert.equal(canFinishRankedRun(start, after(20_000), 20), true);
});
test("claimed game time cannot exceed the server's elapsed clock", () => {
  assert.equal(canFinishRankedRun(start, after(60_000), 120), false);
  assert.equal(canFinishRankedRun(start, after(60_000), 61), true);
  assert.equal(canFinishRankedRun(start, after(60_000), 63), false);
});
test("pauses, a saved game and a later login stay valid for seven days", () => {
  assert.equal(canFinishRankedRun(start, after(2 * 3600_000), 600), true);
  assert.equal(isRankedRunExpired(start, after(RANKED_RUN_TTL)), false);
  assert.equal(isRankedRunExpired(start, after(RANKED_RUN_TTL + 1)), true);
  assert.equal(canFinishRankedRun(start, after(RANKED_RUN_TTL + 1), 600), false);
});
