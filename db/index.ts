import "server-only";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

const MIGRATIONS = path.join(process.cwd(), "drizzle");

interface DbState {
  db?: Promise<DB>;
  kind?: "supabase" | "postgres" | "embedded";
}
const g = globalThis as unknown as { __pfDb?: DbState };
const state: DbState = (g.__pfDb ??= {});

/**
 * Connection string for the application. `DATABASE_URL` wins; otherwise the
 * variables the Vercel Supabase integration sets are used, pooled first.
 */
export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

/** Direct (non-pooled) connection for migrations when one is available. */
function migrationUrl(): string | undefined {
  return process.env.DATABASE_URL_DIRECT || process.env.POSTGRES_URL_NON_POOLING || databaseUrl();
}

/** True when an external Postgres (Supabase) is configured; false for the embedded demo database. */
export const hasExternalDb = () => Boolean(databaseUrl());

/**
 * Supabase connection strings carry hints for other drivers (`supa`,
 * `pgbouncer`) that Postgres would reject as startup parameters; SSL is set
 * explicitly instead of through `sslmode`.
 */
function clean(raw: string) {
  const url = new URL(raw);
  for (const p of ["supa", "pgbouncer", "sslmode", "connection_limit", "pool_timeout"]) url.searchParams.delete(p);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname) || url.hostname.endsWith(".local");
  return { url: url.toString(), local, supabase: url.hostname.includes("supabase") };
}

async function client(raw: string, max: number) {
  const { default: postgres } = await import("postgres");
  const { url, local } = clean(raw);
  // prepare: false — Supabase's transaction pooler (port 6543) does not support prepared statements.
  return postgres(url, { prepare: false, max, idle_timeout: 20, connect_timeout: 15, ssl: local ? false : "require", onnotice: () => {} });
}

async function connectPostgres(): Promise<DB> {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const sql = await client(databaseUrl()!, 5);
  const db = drizzle(sql, { schema });
  // Drizzle makes date serializers pass-through and maps column values itself;
  // a Date bound inside a raw sql`` fragment would then reach the wire as an
  // object. Serialize those as ISO strings, as the embedded driver does.
  const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
  for (const oid of [1082, 1114, 1184]) sql.options.serializers[oid] = iso;
  return db as unknown as DB;
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
    state.kind = dbKind();
    state.db = (hasExternalDb() ? connectPostgres() : connectEmbedded()).catch((e) => {
      state.db = undefined;
      throw e;
    });
  }
  return state.db;
}

/** Applies pending migrations to the external database over a short-lived connection. Idempotent. */
export async function migrateExternal() {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const sql = await client(migrationUrl()!, 1);
  try {
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function dbKind(): NonNullable<DbState["kind"]> {
  if (state.kind) return state.kind;
  const url = databaseUrl();
  if (!url) return "embedded";
  return clean(url).supabase ? "supabase" : "postgres";
}
