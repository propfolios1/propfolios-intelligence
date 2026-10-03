import "server-only";
import type { DB } from "@/db";
import * as s from "@/db/schema";

/** Audit entry written by services and automations on the caller's connection (no request context). */
export async function systemAudit(db: DB, e: { tenantId: string; actor: string; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; detail?: unknown }) {
  await db.insert(s.auditLogs).values({ tenantId: e.tenantId, actorName: e.actor, actorType: "system", action: e.action, entityType: e.entityType ?? null, entityId: e.entityId ?? null, before: (e.before ?? null) as never, after: (e.after ?? null) as never, detail: (e.detail ?? null) as never, requestId: crypto.randomUUID() });
}
