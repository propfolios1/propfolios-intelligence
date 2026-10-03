import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { dataQualityAgent, auditNarrator } from "@/lib/ai/os-agents/fabric";
import { completeStep, createDataRequest, eraseClient, exportClientData, setConsent } from "@/lib/os/compliance";
import { scanDataQuality } from "@/lib/os/data-quality";
import { scope } from "@/lib/tenant-db";

/** Compliance: request, step, export, erase, consent, retention, data-quality, narrate. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ action: string }> }) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { action } = await params;
  const db = await getDb();
  const ctx = { tenantId: user.tenantId, actor: user.name };
  if (action === "data-quality" || action === "narrate") {
    requirePermission(user, "audit:read");
    if (action === "data-quality") {
      const run = await dataQualityAgent.run({ checks: await scanDataQuality(db, user.tenantId) }, ctx);
      return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
    }
    const b = await parseBody(req, z.object({ days: z.number().int().min(1).max(90).default(7) }));
    const since = new Date(Date.now() - b.days * 86_400_000);
    const rows = (await db.select().from(s.auditLogs).where(scope(s.auditLogs, user.tenantId))).filter((r) => r.createdAt >= since).slice(-300);
    const run = await auditNarrator.run({ scope: `Workspace, last ${b.days} days`, entries: rows.map((r) => ({ at: r.createdAt.toISOString(), actor: r.actorName, actorType: r.actorType, action: r.action, costUsd: r.costUsd })) }, ctx);
    return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
  }
  requirePermission(user, "compliance:requests");
  switch (action) {
    case "request": {
      const b = await parseBody(req, z.object({ clientId: z.string().uuid().nullable(), subjectEmail: z.string().email(), type: z.enum(["access", "deletion", "rectification", "portability"]), regime: z.enum(["GDPR", "DPDP", "UAE PDPL"]) }));
      const r = await createDataRequest(db, user.tenantId, { ...b, by: user.name });
      return NextResponse.json(r, { status: 201 });
    }
    case "step": {
      const b = await parseBody(req, z.object({ requestId: z.string().uuid(), index: z.number().int().min(0).max(10) }));
      const [r] = await db.select().from(s.dataRequests).where(scope(s.dataRequests, user.tenantId, eq(s.dataRequests.id, b.requestId)));
      if (!r) throw new HttpError(404, "Request not found.");
      const step = r.steps[b.index]?.step ?? "";
      let detail: unknown = null;
      if (/Erase/.test(step)) {
        if (!r.clientId) throw new HttpError(422, "The request is not linked to a client record.");
        detail = await eraseClient(db, user.tenantId, r.clientId, user.name);
      }
      const u = await completeStep(db, user.tenantId, b.requestId, b.index, user.name);
      return NextResponse.json({ request: u, detail });
    }
    case "export": {
      const b = await parseBody(req, z.object({ clientId: z.string().uuid() }));
      const data = await exportClientData(db, user.tenantId, b.clientId);
      await audit(user, "exported client data", { entityType: "client", entityId: b.clientId });
      return new NextResponse(JSON.stringify(data, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="data-export-${b.clientId.slice(0, 8)}.json"` } });
    }
    case "consent": {
      const b = await parseBody(req, z.object({ clientId: z.string().uuid(), purpose: z.enum(["data_processing", "marketing", "cross_border_transfer", "federation"]), granted: z.boolean(), jurisdiction: z.enum(["UAE", "India", "EU"]) }));
      const r = await setConsent(db, user.tenantId, b.clientId, { ...b, source: `Recorded by ${user.name}` });
      await audit(user, `consent ${b.granted ? "granted" : "withdrawn"}: ${b.purpose}`, { entityType: "consent", entityId: r.id, after: r });
      return NextResponse.json(r);
    }
    case "retention": {
      const b = await parseBody(req, z.object({ uaeYears: z.number().int().min(5).max(15), indiaYears: z.number().int().min(5).max(15), euYears: z.number().int().min(1).max(15), auditYears: z.number().int().min(5).max(15) }));
      const [t] = await db.select({ cfg: s.tenants.configJson }).from(s.tenants).where(eq(s.tenants.id, user.tenantId));
      await db.update(s.tenants).set({ configJson: { ...t!.cfg, retention: b } }).where(eq(s.tenants.id, user.tenantId));
      await audit(user, "updated retention policy", { entityType: "tenant", entityId: user.tenantId, before: t!.cfg.retention ?? null, after: b });
      return NextResponse.json(b);
    }
  }
  throw new HttpError(404, `Unknown action "${action}".`);
});
