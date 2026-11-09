import type { Session } from "@clausus/auth";
import type { Database } from "@clausus/db";

export type Context = {
  session: Session | null;
  db: Database;
};
