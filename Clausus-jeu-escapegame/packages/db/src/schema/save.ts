import { defineRelationsPart } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

// One saved game per player (signed-in players only): the game's own snapshot (packages/game/main.js, captureSave),
// kept as is. Overwritten by each save, deleted when the game ends or the player starts over.
export const gameSave = pgTable("game_save", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const saveRelations = defineRelationsPart({ user, gameSave }, (r) => ({
  gameSave: {
    user: r.one.user({ from: r.gameSave.userId, to: r.user.id }),
  },
}));
