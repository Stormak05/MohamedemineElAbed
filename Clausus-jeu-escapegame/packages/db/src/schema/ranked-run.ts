import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** An unguessable capability, including for guests; never exposed by a listing endpoint. */
export const rankedRun = pgTable("ranked_run", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  stats: jsonb("stats").$type<{
    seconds: number;
    hints: number;
    errors: number;
    pills: number;
    sanity: number;
  }>(),
  publishedId: text("published_id"),
});
