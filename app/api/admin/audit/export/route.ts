import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { exportAudit, previewExport, verifyExport } from "@/lib/enterprise/audit-export";
import { auditExportQuery } from "@/lib/enterprise/schemas";
import { requirePlan } from "@/lib/plan-gate";

const range = (q: z.infer<typeof auditExportQuery>) => ({ from: new Date(`${q.from}T00:00:00Z`), to: new Date(new Date(`${q.to}T00:00:00Z`).getTime() + 86_400_000), actorType: q.actorType ?? null, entityType: q.entityType || null });

/** Downloads the export. The digest and signature travel in the response headers. */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  await requirePlan(user, "audit_export");
  requirePermission(user, "audit:read");
  const q = auditExportQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  const out = await exportAudit(await getDb(), user.tenantId, range(q), q.format);
  await audit(user, `exported ${out.rows} audit events (${q.format.toUpperCase()})`, { entityType: "audit_export", detail: { meta: out.meta, sha256: out.digest } });
  return new Response(out.body, {
    headers: {
      "content-type": q.format === "jsonl" ? "application/x-ndjson; charset=utf-8" : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${out.filename}"`,
      "x-nakhla-sha256": out.digest,
      "x-nakhla-export-meta": out.meta,
      "x-nakhla-signature": out.signature,
      "cache-control": "no-store",
    },
  });
});

/** Preview (row count) or verification of a previously downloaded file. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "audit:read");
  const b = await parseBody(req, z.union([z.object({ action: z.literal("preview") }).and(auditExportQuery), z.object({ action: z.literal("verify"), body: z.string().max(60_000_000), meta: z.string().max(500), signature: z.string().length(64) })]));
  if (b.action === "verify") return NextResponse.json(verifyExport(b.body, b.meta, b.signature));
  return NextResponse.json(await previewExport(await getDb(), user.tenantId, range(b)));
});
