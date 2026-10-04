import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { evaluateDeal, recordPaymentMethod, waiveCheck } from "@/lib/compliance/service";

type Ctx = { params: Promise<{ id: string }> };

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("evaluate") }),
  z.object({ action: z.literal("waive"), checkId: z.string().uuid(), reason: z.string().trim().min(10).max(1000) }),
  z.object({ action: z.literal("payment_method"), paymentId: z.string().uuid(), method: z.enum(["bank_transfer", "cheque", "cash", "virtual_asset", "mixed"]), cashAmount: z.number().min(0).max(1e12).nullable().optional() }),
]);

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const b = await parseBody(req, body);
  const db = await getDb();
  if (b.action === "waive") {
    if (user.role !== "tenant_admin") return NextResponse.json({ error: "Only the firm's administrator or MLRO can waive a check." }, { status: 403 });
    const c = await waiveCheck(db, user.tenantId, b.checkId, { reason: b.reason, userId: user.id });
    await audit(user, `waived compliance check "${c.title}"`, { entityType: "deal", entityId: id, after: { rule: c.rule, reason: b.reason } });
  }
  if (b.action === "payment_method") {
    const p = await recordPaymentMethod(db, user.tenantId, b.paymentId, b);
    await audit(user, `recorded payment method ${b.method.replace("_", " ")} for "${p.milestone}"`, { entityType: "deal", entityId: id, after: { method: b.method, cashAmount: b.cashAmount ?? null } });
  }
  const r = await evaluateDeal(db, user.tenantId, id);
  if (b.action === "evaluate") await audit(user, "evaluated AML compliance checks", { entityType: "deal", entityId: id, after: { open: r.checks.filter((c) => c.status === "action_required" || c.status === "fail").map((c) => c.rule) } });
  return NextResponse.json(r);
});
