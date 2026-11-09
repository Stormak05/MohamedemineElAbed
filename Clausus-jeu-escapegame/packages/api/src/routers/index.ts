import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { saveRouter } from "./save";
import { scoresRouter } from "./scores";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  save: saveRouter,
  scores: scoresRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
