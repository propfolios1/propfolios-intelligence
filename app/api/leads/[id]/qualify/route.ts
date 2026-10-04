import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { leadQualifier } from "@/lib/ai/os-agents/brokerage";
import { getLead } from "@/lib/brokerage/leads";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

/** Runs the lead qualifier on the lead, its itemised score, its listing and its activity. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "leads:manage");
  await enforceRateLimit(user, "agents");
  const { id } = await params;
  const d = await getLead(await getDb(), user.tenantId, id);
  if (!d) throw new HttpError(404, "Lead not found.");
  const l = d.lead;
  const run = await leadQualifier.run(
    {
      lead: { id: l.id, name: l.name, email: l.email, phone: l.phone, intent: l.intent, timeline: l.timeline, source: l.source, budgetMax: l.budgetMax, currency: l.currency, locations: l.locations, message: l.message, stage: l.stage },
      score: l.score,
      factors: l.scoreFactors,
      listing: d.listing ? { title: d.listing.title, price: d.listing.price, currency: d.listing.currency, community: d.listing.community } : null,
      activities: d.activities.slice(0, 12).map((a) => ({ type: a.a.type, summary: a.a.summary, at: a.a.occurredAt.toISOString() })),
    },
    { tenantId: user.tenantId, actor: user.name },
  );
  await audit(user, "ran lead qualifier", { entityType: "lead", entityId: id, detail: { costUsd: run.costUsd } });
  return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
});
