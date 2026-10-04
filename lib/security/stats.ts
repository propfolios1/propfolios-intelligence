import "server-only";
import { sql } from "drizzle-orm";
import type { DB } from "@/db";

/**
 * Security figures read from the live database catalogue, so the public
 * security page states what is deployed rather than what was documented.
 */
export type SecurityStats = { rlsPolicies: number; rlsTables: number; publicTables: number; tablesWithoutRls: string[]; storagePolicies: number; generatedAt: string };

const rows = <T,>(r: unknown): T[] => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

export async function securityStats(db: DB): Promise<SecurityStats> {
  const [p] = rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from pg_policies where schemaname = 'public'`));
  const [sp] = rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from pg_policies where schemaname = 'storage'`).catch(() => [{ n: 0 }]));
  const tables = rows<{ name: string; rls: boolean }>(await db.execute(sql`select c.relname as name, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and left(c.relname, 2) <> '__'`));
  return {
    rlsPolicies: Number(p?.n ?? 0),
    rlsTables: tables.filter((t) => t.rls).length,
    publicTables: tables.length,
    tablesWithoutRls: tables.filter((t) => !t.rls).map((t) => t.name).sort(),
    storagePolicies: Number(sp?.n ?? 0),
    generatedAt: new Date().toISOString(),
  };
}
