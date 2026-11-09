import { rankedRun } from "@clausus/db/schema/ranked-run";
import { ORPCError } from "@orpc/server";
import { score } from "@clausus/db/schema/score";
import { SCORE_LIMITS, scoreOf } from "@clausus/game/score.js";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { canFinishRankedRun, isRankedRunExpired } from "../ranking";
import { protectedProcedure, publicProcedure } from "../index";

const L = SCORE_LIMITS;
const TOP = 50;

/** One row of the leaderboard: a player's best published escape. */
export type LeaderRow = {
  rank: number;
  id: string;
  pseudo: string;
  points: number;
  seconds: number;
  hints: number;
  errors: number;
  pills: number;
  sanity: number;
  createdAt: string;
  mine: boolean;
};

export const scoresRouter = {
  // Guests get a capability too, so finishing then signing in remains supported. One unfinished ticket is
  // kept by the browser per run; tokens are opaque and no endpoint enumerates them.
  begin: publicProcedure.handler(async ({ context }) => {
    const id = crypto.randomUUID();
    await context.db.insert(rankedRun).values({ id, userId: context.session?.user.id ?? null });
    return { ticket: id };
  }),

  finish: publicProcedure
    .input(
      z.object({
        ticket: z.uuid(),
        seconds: z.number().min(L.minSeconds).max(L.maxSeconds),
        hints: z.number().int().min(0).max(L.maxHints),
        errors: z.number().int().min(0).max(L.maxErrors),
        pills: z.number().int().min(0).max(L.maxPills),
        sanity: z.number().min(0).max(1),
        cheated: z.literal(false),
      }),
    )
    .handler(async ({ context, input }) =>
      context.db.transaction(async (tx) => {
        const [run] = await tx
          .select()
          .from(rankedRun)
          .where(eq(rankedRun.id, input.ticket))
          .for("update");
        const now = new Date();
        if (
          !run ||
          isRankedRunExpired(run.startedAt, now) ||
          (run.userId && run.userId !== context.session?.user.id)
        ) {
          throw new ORPCError("FORBIDDEN", { message: "Partie non reconnue ou expirée." });
        }
        // Repeated finish messages never replace the original statistics.
        if (run.finishedAt) return { ticket: run.id };
        if (!canFinishRankedRun(run.startedAt, now, input.seconds)) {
          throw new ORPCError("BAD_REQUEST", { message: "Durée de partie incohérente." });
        }
        const { ticket: _ticket, cheated: _cheated, ...stats } = input;
        await tx.update(rankedRun).set({ finishedAt: now, stats }).where(eq(rankedRun.id, run.id));
        return { ticket: run.id };
      }),
    ),

  // Only the immutable server snapshot is published. The lock makes replay across accounts and simultaneous
  // publications safe: a guest capability can be claimed by exactly one account.
  publish: protectedProcedure
    .input(z.object({ ticket: z.uuid() }))
    .handler(async ({ context, input }) =>
      context.db.transaction(async (tx) => {
        const [run] = await tx
          .select()
          .from(rankedRun)
          .where(eq(rankedRun.id, input.ticket))
          .for("update");
        const userId = context.session.user.id;
        if (
          !run ||
          !run.finishedAt ||
          !run.stats ||
          isRankedRunExpired(run.startedAt, new Date()) ||
          (run.userId && run.userId !== userId)
        ) {
          throw new ORPCError("FORBIDDEN", { message: "Cette partie ne peut pas être classée." });
        }
        const points = scoreOf(run.stats);
        if (run.publishedId) return { id: run.publishedId, points };
        const id = crypto.randomUUID();
        await tx.insert(score).values({ id, userId, runId: run.id, ...run.stats, points });
        await tx.update(rankedRun).set({ userId, publishedId: id }).where(eq(rankedRun.id, run.id));
        return { id, points };
      }),
    ),

  /**
   * Each player's best escape (most points, then fastest, then first), the top 50 plus the signed-in player's row
   * when lower.
   */
  leaderboard: protectedProcedure.handler(async ({ context }) => {
    const me = context.session.user.id;
    const result = await context.db.execute<{
      rank: string;
      id: string;
      pseudo: string;
      points: number;
      seconds: number;
      hints: number;
      errors: number;
      pills: number;
      sanity: number;
      created_at: string;
      user_id: string;
    }>(sql`
      with best as (
        select distinct on (s.user_id) s.*
        from ${score} s
        order by s.user_id, s.points desc, s.seconds asc, s.created_at asc
      ), ranked as (
        select best.*, coalesce(u.display_username, u.username, u.name) as pseudo,
          row_number() over (order by best.points desc, best.seconds asc, best.created_at asc) as rank
        from best join "user" u on u.id = best.user_id
      )
      select * from ranked where rank <= ${TOP} or user_id = ${me} order by rank
    `);
    const total = await context.db.execute<{ players: string; runs: string }>(
      sql`select count(distinct user_id) as players, count(*) as runs from ${score}`,
    );
    const rows: LeaderRow[] = result.rows.map((r) => ({
      rank: Number(r.rank),
      id: r.id,
      pseudo: r.pseudo,
      points: r.points,
      seconds: r.seconds,
      hints: r.hints,
      errors: r.errors,
      pills: r.pills,
      sanity: r.sanity,
      createdAt: new Date(r.created_at).toISOString(),
      mine: r.user_id === me,
    }));
    return {
      rows,
      players: Number(total.rows[0]?.players ?? 0),
      runs: Number(total.rows[0]?.runs ?? 0),
    };
  }),
};
