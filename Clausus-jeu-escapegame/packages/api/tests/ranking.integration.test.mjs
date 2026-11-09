// Run with Bun and RANKING_TEST_DATABASE_URL pointing at an isolated, migrated PostgreSQL database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call } from '@orpc/server';
import { eq } from 'drizzle-orm';
import { createDb } from '../../db/src/index.ts';
import { user } from '../../db/src/schema/auth.ts';
import { rankedRun } from '../../db/src/schema/ranked-run.ts';
import { score } from '../../db/src/schema/score.ts';
import { scoresRouter } from '../src/routers/scores.ts';

const url = process.env.RANKING_TEST_DATABASE_URL;
test('ranking lifecycle and replay protection against PostgreSQL', { skip: !url }, async () => {
  const db = createDb({ DATABASE_URL: url });
  const users = [crypto.randomUUID(), crypto.randomUUID()];
  const tickets = [];
  const context = (id = null) => ({ db, session: id ? { user: { id } } : null });
  const invoke = (name, input, id = null) => call(scoresRouter[name], input, { context: context(id) });
  const begin = async (id = null) => {
    const result = await invoke('begin', undefined, id);
    tickets.push(result.ticket);
    return result.ticket;
  };
  const age = (ticket, ms) => db.update(rankedRun).set({ startedAt: new Date(Date.now() - ms) }).where(eq(rankedRun.id, ticket));
  const stats = { seconds: 60, hints: 2, errors: 1, pills: 0, sanity: .8, cheated: false };
  try {
    for (const id of users) await db.insert(user).values({ id, name: 'Ranking test', email: `${id}@example.invalid` });
    await assert.rejects(invoke('publish', { runId: 'fake-run', ...stats }, users[0]));
    await assert.rejects(invoke('publish', { ticket: crypto.randomUUID() }, users[0]));
    const ticket = await begin();
    await assert.rejects(invoke('publish', { ticket }, users[0]));
    await assert.rejects(invoke('finish', { ticket, ...stats }));
    await age(ticket, 61_000);
    await assert.rejects(invoke('finish', { ticket, ...stats, seconds: 120 }));
    await assert.rejects(invoke('finish', { ticket, ...stats, cheated: true }));
    await assert.rejects(invoke('finish', { ticket, ...stats, hints: -1 }));
    await invoke('finish', { ticket, ...stats });
    await invoke('finish', { ticket, ...stats, hints: 0, errors: 0, sanity: 1 });
    const published = await invoke('publish', { ticket }, users[0]);
    assert.equal(published.points, 9400);
    const duplicate = await Promise.all(Array.from({ length: 5 }, () => invoke('publish', { ticket }, users[0])));
    assert.ok(duplicate.every(r => r.id === published.id && r.points === published.points));
    await assert.rejects(invoke('publish', { ticket }, users[1]));
    const owned = await begin(users[0]);
    await age(owned, 61_000);
    await assert.rejects(invoke('finish', { ticket: owned, ...stats }, users[1]));
    await assert.rejects(invoke('finish', { ticket: owned, ...stats }));
    await invoke('finish', { ticket: owned, ...stats }, users[0]);
    await assert.rejects(invoke('publish', { ticket: owned }, users[1]));
    const contested = await begin();
    await age(contested, 61_000);
    await invoke('finish', { ticket: contested, ...stats });
    const race = await Promise.allSettled(users.map(id => invoke('publish', { ticket: contested }, id)));
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1);
    const expired = await begin();
    await age(expired, 8 * 24 * 3600_000);
    await assert.rejects(invoke('finish', { ticket: expired, ...stats }));
    await age(ticket, 8 * 24 * 3600_000);
    await assert.rejects(invoke('publish', { ticket }, users[0]));
    const rows = await db.select().from(score).where(eq(score.runId, ticket));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].hints, 2);
    assert.ok(Math.abs(rows[0].sanity - .8) < 1e-6);
  } finally {
    for (const ticket of tickets) await db.delete(rankedRun).where(eq(rankedRun.id, ticket));
    for (const id of users) await db.delete(user).where(eq(user.id, id));
    await db.$client.end();
  }
});
