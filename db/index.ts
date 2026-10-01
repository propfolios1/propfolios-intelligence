import "server-only";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

const MIGRATIONS = path.join(process.cwd(), "drizzle");

interface DbState {
  db?: Promise<DB>;
  kind?: "neon" | "embedded";
}
const g = globalThis as unknown as { __pfDb?: DbState };
const state: DbState = (g.__pfDb ??= {});

/** True when running against Neon; false for the embedded demo database. */
export const isNeon = () => Boolean(process.env.DATABASE_URL);

async function connectNeon(): Promise<DB> {
  const { neon } = await import("@neondatabase/serverless");
  const { drizzle } = await import("drizzle-orm/neon-http");
  return drizzle(neon(process.env.DATABASE_URL!), { schema }) as unknown as DB;
}

/**
 * Embedded Postgres (PGlite + pgvector) for demo mode. Migrated and seeded on
 * first use so the product renders fully without any external database.
 */
async function connectEmbedded(): Promise<DB> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { vector } = await import("@electric-sql/pglite-pgvector");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  const { seed } = await import("./seed");
  await seed(db as unknown as DB);
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!state.db) {
    state.kind = isNeon() ? "neon" : "embedded";
    state.db = (isNeon() ? connectNeon() : connectEmbedded()).catch((e) => {
      state.db = undefined;
      throw e;
    });
  }
  return state.db;
}

/** Applies pending migrations to Neon. Idempotent. */
export async function migrateNeon() {
  const { migrate } = await import("drizzle-orm/neon-http/migrator");
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: MIGRATIONS });
}

export function dbKind() {
  return state.kind ?? (isNeon() ? "neon" : "embedded");
}
