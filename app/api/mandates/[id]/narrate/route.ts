import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { auditNarrator } from "@/lib/ai/os-agents/fabric";
import { handle } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { mandateJourney } from "@/lib/os/journey";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

/** The audit narrator over one mandate's whole journey: mandate, deal, commission and invoice. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "clients:read");
  await enforceRateLimit(user, "agents");
  const { id } = await params;
  const db = await getDb();
  const j = await mandateJourney(db, user.tenantId, id);
  if (!j) throw new HttpError(404, "Mandate not found.");
  const run = await auditNarrator.run({ scope: `Journey ${j.mandate.reference}`, entries: j.audit.slice(-300).map((r) => ({ at: r.createdAt.toISOString(), actor: r.actorName, actorType: r.actorType, action: r.action, costUsd: r.costUsd })) }, { tenantId: user.tenantId, actor: user.name, mandateId: id });
  return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
});
