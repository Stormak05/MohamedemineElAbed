import { index, integer, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * A run the player chose to publish: their escape from room 104, with its stats and points
 * (computed by the server, packages/game/score.js). The leaderboard keeps each player's best.
 */
export const score = pgTable(
  "score",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Id the game gives the run, so publishing it twice keeps one row. */
    runId: text("run_id").notNull(),
    points: integer("points").notNull(),
    seconds: real("seconds").notNull(),
    hints: integer("hints").notNull(),
    errors: integer("errors").notNull(),
    pills: integer("pills").notNull(),
    /** Sanity left when leaving the room, 0 to 1. */
    sanity: real("sanity").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("score_user_run_idx").on(table.userId, table.runId),
    index("score_user_points_idx").on(table.userId, table.points),
  ],
);
