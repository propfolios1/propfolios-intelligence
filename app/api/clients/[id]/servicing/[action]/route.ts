import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { CLIENT_AGENT_RUNNERS, runReportWriter, runStatementGenerator } from "@/lib/client/agents";
import { computeWalletShare, generateTaxDocuments, previousMonth } from "@/lib/client/servicing";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Client servicing: report, statement, tax-documents, wallet, goal, agent. Staff only. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id, action } = await params;
  const db = await getDb();
  const actor = { tenantId: user.tenantId, name: user.name };
  switch (action) {
    case "report": {
      const b = await parseBody(req, z.object({ type: z.enum(["quarterly", "annual", "ad_hoc"]).default("ad_hoc") }));
      const r = await runReportWriter(db, actor, id, b.type);
      await audit(user, "generated client report", { entityType: "client_report", entityId: r.id, after: { title: r.title, period: r.period } });
      return NextResponse.json(r);
    }
    case "statement": {
      const b = await parseBody(req, z.object({ period: z.string().regex(/^\d{4}-\d{2}$/).default(previousMonth()) }));
      const run = await runStatementGenerator(db, actor, id, b.period);
      await audit(user, "generated statement", { entityType: "client", entityId: id, after: { period: b.period } });
      return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
    }
    case "tax-documents": {
      const b = await parseBody(req, z.object({ year: z.number().int().min(2020).max(2100) }));
      const r = await generateTaxDocuments(db, user.tenantId, id, b.year);
      await audit(user, "generated tax documents", { entityType: "client", entityId: id, after: { year: b.year, documents: r.length } });
      return NextResponse.json({ documents: r });
    }
    case "wallet": {
      const now = new Date();
      const r = await computeWalletShare(db, user.tenantId, id, `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`);
      return NextResponse.json(r);
    }
    case "goal": {
      const b = await parseBody(req, z.object({ goalType: z.enum(["income", "growth", "diversification", "liquidity", "legacy"]), title: z.string().min(3).max(160), target: z.number(), unit: z.string().max(20), by: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), notes: z.string().max(500).optional() }));
      const [g] = await db.insert(s.clientGoals).values({ tenantId: user.tenantId, clientId: id, goalType: b.goalType, title: b.title, target: { metric: b.goalType, target: b.target, current: 0, unit: b.unit, by: b.by }, progressPct: 0, notes: b.notes ?? null }).returning();
      await audit(user, "set client goal", { entityType: "client_goal", entityId: g!.id, after: g });
      return NextResponse.json(g, { status: 201 });
    }
    case "agent": {
      await enforceRateLimit(user, "agents");
      const b = await parseBody(req, z.object({ agent: z.enum(["client-success-agent", "goal-tracker", "private-banking-coordinator", "kyc-analyzer"]) }));
      const run = await CLIENT_AGENT_RUNNERS[b.agent](db, actor, id);
      await audit(user, `ran ${b.agent} agent`, { entityType: "client", entityId: id, detail: { costUsd: run.costUsd } });
      return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
    }
  }
  throw new HttpError(404, `Unknown action "${action}".`);
});
