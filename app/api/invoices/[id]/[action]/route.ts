import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { runTaxAdvisor } from "@/lib/commission/agents";
import { recordPayment } from "@/lib/commission/service";
import { formatLocal } from "@/lib/format";
import { sendEmail } from "@/lib/os/notify";
import { scope } from "@/lib/tenant-db";

/** POST /api/invoices/{id}/{payment|void|send|agent}. Administrators only. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string; action: string }> }) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { id, action } = await params;
  const db = await getDb();
  const actor = { tenantId: user.tenantId, name: user.name };
  const [inv] = await db.select().from(s.invoices).where(scope(s.invoices, user.tenantId, eq(s.invoices.id, id)));
  if (!inv) throw new HttpError(404, "Invoice not found.");
  switch (action) {
    case "payment": {
      const b = await parseBody(req, z.object({ amount: z.number().positive(), method: z.enum(["bank_transfer", "cheque", "card", "cash"]), reference: z.string().min(2).max(120), receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }));
      const r = await recordPayment(db, actor, id, { ...b, receivedAt: b.receivedAt ? new Date(`${b.receivedAt}T09:00:00Z`) : undefined });
      await audit(user, "recorded payment", { entityType: "invoice", entityId: id, before: { status: r.before.status }, after: { status: r.after.status, amount: b.amount, reference: b.reference } });
      return NextResponse.json(r.after);
    }
    case "void": {
      if (inv.status === "paid") throw new HttpError(422, "A paid invoice cannot be voided; issue a credit note instead.");
      const [after] = await db.update(s.invoices).set({ status: "void" }).where(eq(s.invoices.id, id)).returning();
      await db.update(s.commissions).set({ status: "expected", invoiceId: null }).where(scope(s.commissions, user.tenantId, eq(s.commissions.invoiceId, id)));
      await audit(user, "voided invoice", { entityType: "invoice", entityId: id, before: inv, after });
      return NextResponse.json(after);
    }
    case "send": {
      const b = await parseBody(req, z.object({ to: z.string().email() }));
      const out = await sendEmail(db, { tenantId: user.tenantId, to: b.to, subject: `Invoice ${inv.number}: ${formatLocal(inv.total, inv.currency, { compact: false })}`, text: `Please find invoice ${inv.number} for ${formatLocal(inv.total, inv.currency, { compact: false })}, due ${inv.dueAt?.toISOString().slice(0, 10) ?? "on receipt"}.\n\n${inv.lines.map((l) => `${l.description}: ${formatLocal(l.amount, inv.currency, { compact: false })}`).join("\n")}\n${inv.tax.type}: ${formatLocal(inv.tax.amount, inv.currency, { compact: false })}\n` });
      await db.update(s.invoices).set({ recipientEmail: b.to }).where(eq(s.invoices.id, id));
      await audit(user, "sent invoice", { entityType: "invoice", entityId: id, after: { to: b.to, status: out.status } });
      return NextResponse.json({ status: out.status });
    }
    case "agent": {
      const run = await runTaxAdvisor(db, actor, id);
      await audit(user, "ran tax-advisor agent", { entityType: "invoice", entityId: id, detail: { costUsd: run.costUsd } });
      return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
    }
  }
  throw new HttpError(404, `Unknown action "${action}".`);
});
