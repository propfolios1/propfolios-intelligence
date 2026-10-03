import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { runAmlScreener, runKycAnalyzer } from "@/lib/client/agents";
import { reviewAml } from "@/lib/client/aml";
import { decideKyc, updateKycDocument } from "@/lib/client/kyc";
import { enforceRateLimit } from "@/lib/rate-limit";

const DOC = z.enum(["passport", "emirates_id", "proof_of_address", "source_of_funds", "pan", "aadhaar", "oci_card"]);

/** KYC and AML actions for one client: document, decide, screen, aml-review, agent. Administrators (compliance) only. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ clientId: string; action: string }> }) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { clientId, action } = await params;
  requirePermission(user, action === "decide" ? "kyc:decide" : action === "aml-review" ? "aml:disposition" : "kyc:review");
  const db = await getDb();
  const actor = { tenantId: user.tenantId, name: user.name };
  switch (action) {
    case "document": {
      const b = await parseBody(req, z.object({ type: DOC, status: z.enum(["missing", "received", "verified", "rejected"]), expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), documentId: z.string().uuid().nullable().optional() }));
      const r = await updateKycDocument(db, user.tenantId, clientId, b);
      await audit(user, `KYC document ${b.status}`, { entityType: "kyc", entityId: r.after.id, before: r.before.documents.find((d) => d.type === b.type), after: r.after.documents.find((d) => d.type === b.type) });
      return NextResponse.json(r.after);
    }
    case "decide": {
      const b = await parseBody(req, z.object({ decision: z.enum(["verified", "rejected"]), pep: z.boolean().optional(), sourceOfFunds: z.string().max(1000).nullable().optional(), notes: z.string().max(2000).optional() }));
      const r = await decideKyc(db, user.tenantId, clientId, { ...b, by: user.name });
      await audit(user, `KYC ${b.decision}`, { entityType: "kyc", entityId: r.after.id, before: { status: r.before.status, riskLevel: r.before.riskLevel }, after: { status: r.after.status, riskLevel: r.after.riskLevel, expiresAt: r.after.expiresAt } });
      return NextResponse.json(r.after);
    }
    case "screen":
    case "agent": {
      await enforceRateLimit(user, "agents");
      const b = action === "agent" ? await parseBody(req, z.object({ agent: z.enum(["kyc-analyzer", "aml-screener"]) })) : { agent: "aml-screener" as const };
      const run = b.agent === "kyc-analyzer" ? await runKycAnalyzer(db, actor, clientId) : await runAmlScreener(db, actor, clientId, { rescreen: action === "screen" });
      await audit(user, action === "screen" ? "ran AML screening" : `ran ${b.agent} agent`, { entityType: "client", entityId: clientId, detail: { costUsd: run.costUsd } });
      return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
    }
    case "aml-review": {
      const b = await parseBody(req, z.object({ checkId: z.string().uuid(), outcome: z.enum(["clear", "confirmed_match"]) }));
      const r = await reviewAml(db, user.tenantId, b.checkId, { outcome: b.outcome, by: user.name });
      await audit(user, `AML alert ${b.outcome === "clear" ? "cleared as false positive" : "confirmed"}`, { entityType: "aml_check", entityId: b.checkId, before: { status: r.before.status }, after: { status: r.after.status } });
      return NextResponse.json(r.after);
    }
  }
  throw new HttpError(404, `Unknown action "${action}".`);
});
