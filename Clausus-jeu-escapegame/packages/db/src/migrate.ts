// Applique les migrations de src/migrations/ : `bun run db:migrate:deploy` (lancé par le `start` du serveur).
// Un verrou Postgres empêche deux conteneurs (redéploiement, réplicas) de migrer en même temps.
import "varlock/auto-load";

import { join } from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

import { ENV } from "./env";

// Clé arbitraire mais fixe du verrou consultatif (pg_advisory_lock).
const MIGRATION_LOCK = 72_401_337;

const client = new Client({ connectionString: ENV.DATABASE_URL });
await client.connect();
try {
  await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK]);
  await migrate(drizzle({ client }), {
    migrationsFolder: join(import.meta.dir, "migrations"),
  });
  console.log("Migrations appliquées.");
} finally {
  await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK]).catch(() => {});
  await client.end();
}
