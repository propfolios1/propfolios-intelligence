import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { runAnomalyDetector, runCommissionComputer } from "@/lib/commission/agents";
import { issueInvoice } from "@/lib/commission/service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { scope } from "@/lib/tenant-db";

/** POST /api/commissions/{id}/{agent|invoice|split}. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id, action } = await params;
  const db = await getDb();
  const actor = { tenantId: user.tenantId, name: user.name };
  if (action === "agent") {
    await enforceRateLimit(user, "agents");
    const { agent } = await parseBody(req, z.object({ agent: z.enum(["commission-computer", "anomaly-detector"]) }));
    const run = agent === "commission-computer" ? await runCommissionComputer(db, actor, id) : await runAnomalyDetector(db, actor, id);
    await audit(user, `ran ${agent} agent`, { entityType: "commission", entityId: id, detail: { costUsd: run.costUsd } });
    return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
  }
  if (user.role !== "tenant_admin") throw new HttpError(403, "Only administrators can issue invoices or approve splits.");
  if (action === "invoice") {
    const inv = await issueInvoice(db, actor, id);
    await audit(user, "issued invoice", { entityType: "invoice", entityId: inv.id, after: inv });
    return NextResponse.json(inv);
  }
  if (action === "split") {
    const b = await parseBody(req, z.object({ splitId: z.string().uuid(), status: z.enum(["pending", "approved", "paid"]) }));
    const [before] = await db.select().from(s.splits).where(scope(s.splits, user.tenantId, eq(s.splits.id, b.splitId), eq(s.splits.commissionId, id)));
    if (!before) throw new HttpError(404, "Split not found.");
    const [after] = await db.update(s.splits).set({ status: b.status }).where(eq(s.splits.id, b.splitId)).returning();
    if (b.status === "paid") {
      const all = await db.select({ status: s.splits.status }).from(s.splits).where(eq(s.splits.commissionId, id));
      if (all.every((x) => x.status === "paid")) await db.update(s.commissions).set({ status: "paid_out" }).where(scope(s.commissions, user.tenantId, eq(s.commissions.id, id)));
    }
    await audit(user, `split ${b.status}`, { entityType: "split", entityId: b.splitId, before, after });
    return NextResponse.json(after);
  }
  throw new HttpError(404, `Unknown action "${action}".`);
});
