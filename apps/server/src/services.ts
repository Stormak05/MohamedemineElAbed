import { createAuth } from "@clausus/auth";
import { createDb } from "@clausus/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
