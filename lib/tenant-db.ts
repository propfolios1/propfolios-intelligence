import "server-only";
import { and, eq, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getDb, type DB } from "@/db";

/**
 * Tenant isolation at the query layer. Every tenant-owned query is built
 * through `tenantDb(tenantId)` or `scope(table, tenantId)`; calling either
 * without a tenant throws, so an unscoped query cannot be written by accident.
 * Postgres row-level security (migration 0001) is the second line of defence.
 */

export class TenantContextError extends Error {
  constructor() {
    super("Tenant context is required for this query.");
  }
}

type TenantTable = PgTable & { tenantId: PgColumn };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertTenant(tenantId: string | null | undefined): asserts tenantId is string {
  if (!tenantId || !UUID.test(tenantId)) throw new TenantContextError();
}

/** `tenant_id = $tenant` for a table, combined with any extra conditions. */
export function scope(table: TenantTable, tenantId: string | null | undefined, ...conditions: (SQL | undefined)[]) {
  assertTenant(tenantId);
  return and(eq(table.tenantId, tenantId), ...conditions)!;
}

export interface TenantDb {
  db: DB;
  tenantId: string;
  /** WHERE clause scoped to this tenant. */
  where: (table: TenantTable, ...conditions: (SQL | undefined)[]) => SQL;
  /** Inserts rows with tenant_id set; any tenant_id supplied by the caller is overwritten. */
  insert: <T extends TenantTable>(table: T, values: Record<string, unknown> | Record<string, unknown>[]) => ReturnType<ReturnType<DB["insert"]>["values"]>;
  /** Updates only this tenant's rows. */
  update: <T extends TenantTable>(table: T, set: Record<string, unknown>, ...conditions: (SQL | undefined)[]) => ReturnType<ReturnType<ReturnType<DB["update"]>["set"]>["where"]>;
  /** Deletes only this tenant's rows. */
  remove: <T extends TenantTable>(table: T, ...conditions: (SQL | undefined)[]) => ReturnType<ReturnType<DB["delete"]>["where"]>;
}

export async function tenantDb(tenantId: string | null | undefined): Promise<TenantDb> {
  assertTenant(tenantId);
  const db = await getDb();
  return {
    db,
    tenantId,
    where: (table, ...c) => scope(table, tenantId, ...c),
    insert: (table, values) => {
      const rows = (Array.isArray(values) ? values : [values]).map((v) => ({ ...v, tenantId }));
      return db.insert(table).values(rows as never);
    },
    update: (table, set, ...c) => db.update(table).set({ ...set, tenantId } as never).where(scope(table, tenantId, ...c)),
    remove: (table, ...c) => db.delete(table).where(scope(table, tenantId, ...c)),
  };
}
