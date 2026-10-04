import "server-only";
import { createHash, createHmac } from "node:crypto";
import { asc, count, eq, gte, lt } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { toCsv } from "@/lib/compliance/reports";
import { scope } from "@/lib/tenant-db";

/**
 * Audit log export for a firm's own records, in CSV for review or JSON Lines
 * for a SIEM (Splunk, Datadog, Elastic, Microsoft Sentinel all ingest JSONL).
 * Each export carries a SHA-256 digest of the file and an HMAC signature over
 * the digest and the export parameters, so the firm can show the file has not
 * been altered since it left Nakhla.
 */

export const MAX_EXPORT_ROWS = 100_000;
export type ExportFilter = { from: Date; to: Date; actorType?: "user" | "agent" | "system" | null; entityType?: string | null };

function conds(tenantId: string, f: ExportFilter) {
  if (!(f.from < f.to)) throw new HttpError(422, "The start date must be before the end date.");
  if (f.to.getTime() - f.from.getTime() > 400 * 86_400_000) throw new HttpError(422, "Export at most 400 days at a time.");
  const c = [gte(s.auditLogs.createdAt, f.from), lt(s.auditLogs.createdAt, f.to)];
  if (f.actorType) c.push(eq(s.auditLogs.actorType, f.actorType));
  if (f.entityType) c.push(eq(s.auditLogs.entityType, f.entityType));
  return scope(s.auditLogs, tenantId, ...c);
}

export async function previewExport(db: DB, tenantId: string, f: ExportFilter) {
  const [{ n }] = (await db.select({ n: count() }).from(s.auditLogs).where(conds(tenantId, f))) as [{ n: number }];
  const types = await db.selectDistinct({ t: s.auditLogs.entityType }).from(s.auditLogs).where(scope(s.auditLogs, tenantId));
  return { rows: n, entityTypes: types.map((x) => x.t).filter((x): x is string => !!x).sort(), tooLarge: n > MAX_EXPORT_ROWS };
}

export function signature(digest: string, meta: string) {
  return createHmac("sha256", process.env.AUDIT_EXPORT_SECRET || process.env.SETUP_SECRET || "nakhla-audit").update(`${digest}\n${meta}`).digest("hex");
}

export async function exportAudit(db: DB, tenantId: string, f: ExportFilter, format: "csv" | "jsonl") {
  const rows = await db.select().from(s.auditLogs).where(conds(tenantId, f)).orderBy(asc(s.auditLogs.createdAt)).limit(MAX_EXPORT_ROWS + 1);
  if (rows.length > MAX_EXPORT_ROWS) throw new HttpError(413, `More than ${MAX_EXPORT_ROWS.toLocaleString("en-GB")} events in this range. Export a shorter period.`);
  const records = rows.map((r) => ({
    id: r.id,
    timestamp: r.createdAt.toISOString(),
    tenant_id: r.tenantId,
    actor_type: r.actorType,
    actor_id: r.userId,
    actor_name: r.actorName,
    action: r.action,
    entity_type: r.entityType,
    entity_id: r.entityId,
    mandate_id: r.mandateId,
    ip: r.ip,
    user_agent: r.userAgent,
    request_id: r.requestId,
    model: r.model,
    input_tokens: r.inputTokens,
    output_tokens: r.outputTokens,
    cost_usd: r.costUsd,
    duration_ms: r.durationMs,
    detail: r.detail ?? null,
    before: r.before ?? null,
    after: r.after ?? null,
  }));
  const body =
    format === "jsonl"
      ? records.map((r) => JSON.stringify(r)).join("\n") + (records.length ? "\n" : "")
      : toCsv(
          Object.keys(records[0] ?? { id: "" }),
          records.map((r) => Object.values(r).map((v) => (v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)))),
        );
  const digest = createHash("sha256").update(body).digest("hex");
  const meta = `tenant=${tenantId};from=${f.from.toISOString()};to=${f.to.toISOString()};actor=${f.actorType ?? "all"};entity=${f.entityType ?? "all"};rows=${records.length};format=${format}`;
  return { body, rows: records.length, digest, meta, signature: signature(digest, meta), filename: `audit-${f.from.toISOString().slice(0, 10)}-to-${f.to.toISOString().slice(0, 10)}.${format === "jsonl" ? "jsonl" : "csv"}` };
}

/** Checks a downloaded file against the digest and signature that came with it. */
export function verifyExport(body: string, meta: string, sig: string) {
  const digest = createHash("sha256").update(body).digest("hex");
  return { digest, valid: signature(digest, meta) === sig };
}
