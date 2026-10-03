import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { DEAL_AGENT_NAMES, type DealAgentName, runDealAgent } from "@/lib/deals/agents";
import { DEAL_STAGES } from "@/lib/deals/domain";
import { addNegotiationRound, closeDeal, createOffer, generateContract, getDeal, loseDeal, respondOffer, sendForSignature, setStage, submitOffer, updateChecklistItem, updatePayment } from "@/lib/deals/service";
import { notifyMentions } from "@/lib/os/notify";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

const S = {
  stage: z.object({ stage: z.enum(DEAL_STAGES), notes: z.string().max(500).optional() }),
  offer: z.object({ type: z.enum(["offer", "counter", "final"]).default("offer"), party: z.enum(["buyer", "seller"]), amount: z.number().positive(), submit: z.boolean().default(true), parentOfferId: z.string().uuid().nullable().optional(), expiresInDays: z.number().int().min(1).max(30).optional(), terms: z.object({ depositPct: z.number().min(0).max(100).optional(), completionDays: z.number().int().min(1).max(730).optional(), paymentPlan: z.string().max(300).optional(), conditions: z.array(z.string().max(200)).max(10).optional(), inclusions: z.array(z.string().max(200)).max(10).optional() }).optional() }),
  "offer-submit": z.object({ offerId: z.string().uuid() }),
  "offer-respond": z.object({ offerId: z.string().uuid(), decision: z.enum(["accepted", "rejected", "withdrawn"]), response: z.string().max(1000).optional() }),
  round: z.object({ party: z.enum(["buyer", "seller", "advisor"]), price: z.number().positive().optional(), asks: z.array(z.string().max(200)).max(10).default([]), concessions: z.array(z.string().max(200)).max(10).default([]), notes: z.string().max(1000).optional() }),
  contract: z.object({ type: z.enum(["mou", "agreement_for_sale", "deed_of_sale", "spa", "form_f", "brokerage_agreement"]).optional() }),
  send: z.object({ contractId: z.string().uuid(), signers: z.array(z.object({ party: z.enum(["buyer", "seller", "advisor", "witness"]), name: z.string().min(2).max(120), email: z.string().email() })).min(1).max(6) }),
  payment: z.object({ paymentId: z.string().uuid(), status: z.enum(["paid", "waived", "due", "overdue"]), reference: z.string().max(120).optional() }),
  checklist: z.object({ itemId: z.string().uuid(), status: z.enum(["open", "in_progress", "done", "waived"]) }),
  close: z.object({}),
  lose: z.object({ reason: z.string().min(3).max(500) }),
  agent: z.object({ agent: z.enum(DEAL_AGENT_NAMES as [DealAgentName, ...DealAgentName[]]), contractId: z.string().uuid().optional() }),
} as const;
type Action = keyof typeof S;

/** Every deal mutation: POST /api/deals/{id}/{action}. Staff only; each is audited with before and after. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id, action } = await params;
  if (!(action in S)) throw new HttpError(404, `Unknown deal action "${action}".`);
  const db = await getDb();
  const actor = { tenantId: user.tenantId, name: user.name, id: user.id };
  const before = await getDeal(db, user.tenantId, id);
  if (!before) throw new HttpError(404, "Deal not found.");
  const b = (await parseBody(req, S[action as Action])) as never;
  const a = action as Action;
  if (a === "close") requirePermission(user, "deals:close");
  else if (a === "send") requirePermission(user, "contracts:send");
  else if (a !== "agent") requirePermission(user, "deals:manage");
  let result: unknown;
  switch (a) {
    case "stage":
      result = await setStage(db, actor, id, (b as z.infer<typeof S.stage>).stage, (b as z.infer<typeof S.stage>).notes);
      break;
    case "offer":
      result = await createOffer(db, actor, id, b as z.infer<typeof S.offer>);
      break;
    case "offer-submit":
      result = await submitOffer(db, actor, (b as z.infer<(typeof S)["offer-submit"]>).offerId);
      break;
    case "offer-respond": {
      const x = b as z.infer<(typeof S)["offer-respond"]>;
      result = await respondOffer(db, actor, x.offerId, x.decision, x.response);
      break;
    }
    case "round": {
      const x = b as z.infer<typeof S.round>;
      result = await addNegotiationRound(db, actor, id, x);
      if (x.notes) await notifyMentions(db, { tenantId: user.tenantId, text: x.notes, author: user.name, href: `/analyst/deals/${id}?tab=negotiations`, context: `${before.deal.reference} negotiation note` });
      break;
    }
    case "contract": {
      const c = await generateContract(db, actor, id, (b as z.infer<typeof S.contract>).type);
      after(() => runDealAgent(db, actor, id, "contract-reviewer", { contractId: c.id }).then(() => undefined, (e: Error) => console.error("contract review failed", e)));
      result = c;
      break;
    }
    case "send": {
      const x = b as z.infer<typeof S.send>;
      result = await sendForSignature(db, actor, x.contractId, x.signers);
      break;
    }
    case "payment": {
      const x = b as z.infer<typeof S.payment>;
      const r = await updatePayment(db, actor, x.paymentId, x);
      await audit(user, `marked payment ${x.status}`, { entityType: "payment", entityId: x.paymentId, before: r.before, after: r.after });
      return NextResponse.json(r.after);
    }
    case "checklist": {
      const x = b as z.infer<typeof S.checklist>;
      const r = await updateChecklistItem(db, actor, x.itemId, x.status);
      await audit(user, `checklist item ${x.status.replace("_", " ")}`, { entityType: "checklist", entityId: x.itemId, before: r.before, after: r.after });
      return NextResponse.json(r.after);
    }
    case "close":
      result = await closeDeal(db, actor, id);
      break;
    case "lose": {
      const r = await loseDeal(db, actor, id, (b as z.infer<typeof S.lose>).reason);
      await audit(user, "marked deal lost", { entityType: "deal", entityId: id, before: r.before, after: r.after });
      return NextResponse.json(r.after);
    }
    case "agent": {
      await enforceRateLimit(user, "agents");
      const x = b as z.infer<typeof S.agent>;
      const run = await runDealAgent(db, actor, id, x.agent, { contractId: x.contractId });
      await audit(user, `ran ${x.agent} agent`, { entityType: "deal", entityId: id, detail: { costUsd: run.costUsd, model: run.model } });
      return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd, replay: run.replay });
    }
  }
  await audit(user, `deal ${a.replace("-", " ")}`, { entityType: "deal", entityId: id, before: { stage: before.deal.stage, status: before.deal.status, value: before.deal.value }, after: result });
  return NextResponse.json(result ?? { ok: true });
});
