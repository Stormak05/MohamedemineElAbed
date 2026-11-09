import { gameSave } from "@clausus/db/schema/save";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

// The game's snapshot is opaque here (the game checks it when restoring), but kept small: a few hundred bytes today.
const MAX_BYTES = 32_000;
const snapshot = z
  .record(z.string(), z.unknown())
  .refine((data) => JSON.stringify(data).length <= MAX_BYTES, "Sauvegarde trop lourde.");

// One saved game per signed-in player. Guests have none: the game asks them to sign in first.
export const saveRouter = {
  get: protectedProcedure.handler(async ({ context }) => {
    const [row] = await context.db
      .select()
      .from(gameSave)
      .where(eq(gameSave.userId, context.session.user.id));
    return row ? { data: row.data as Record<string, unknown>, savedAt: row.updatedAt } : null;
  }),
  put: protectedProcedure
    .input(z.object({ data: snapshot }))
    .handler(async ({ context, input }) => {
      const savedAt = new Date();
      const values = { userId: context.session.user.id, data: input.data, updatedAt: savedAt };
      await context.db
        .insert(gameSave)
        .values(values)
        .onConflictDoUpdate({
          target: gameSave.userId,
          set: { data: input.data, updatedAt: savedAt },
        });
      return { savedAt };
    }),
  clear: protectedProcedure.handler(async ({ context }) => {
    await context.db.delete(gameSave).where(eq(gameSave.userId, context.session.user.id));
    return { ok: true };
  }),
};
