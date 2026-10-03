import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { anomalyDetector, collectionAgent, commissionComputer, commissionTaxAdvisor } from "@/lib/ai/os-agents/commission";
import { DomainError } from "@/lib/errors";
import { scope } from "@/lib/tenant-db";
import { toAed } from "./engine";

type Actor = { tenantId: string; name: string };
const ctx = (a: Actor) => ({ tenantId: a.tenantId, actor: a.name });

async function commissionContext(db: DB, tenantId: string, commissionId: string) {
  const [row] = await db
    .select({ c: s.commissions, d: s.deals, st: s.commissionStructures, p: s.properties })
    .from(s.commissions)
    .innerJoin(s.deals, eq(s.deals.id, s.commissions.dealId))
    .innerJoin(s.properties, eq(s.properties.id, s.deals.propertyId))
    .leftJoin(s.commissionStructures, eq(s.commissionStructures.id, s.commissions.structureId))
    .where(scope(s.commissions, tenantId, eq(s.commissions.id, commissionId)));
  if (!row) throw new DomainError("Commission not found.", 404);
  const sp = await db.select().from(s.splits).where(scope(s.splits, tenantId, eq(s.splits.commissionId, commissionId)));
  return { ...row, splits: sp };
}

export async function runCommissionComputer(db: DB, a: Actor, commissionId: string) {
  const x = await commissionContext(db, a.tenantId, commissionId);
  return commissionComputer.run({ commissionId, deal: { reference: x.d.reference, jurisdiction: x.d.jurisdiction, dealType: x.d.dealType, value: x.c.grossDealValue, currency: x.c.currency }, structure: { name: x.st?.name ?? "Unassigned", type: x.st?.type ?? "percentage", ratePct: x.st?.ratePct ?? null, payer: x.c.payer }, computation: { amount: x.c.amount, percentage: x.c.percentage, steps: x.c.computation.steps }, splits: x.splits.map((p) => ({ label: p.label, percentage: p.percentage, amount: p.amount })) }, ctx(a));
}

export async function runAnomalyDetector(db: DB, a: Actor, commissionId: string) {
  const x = await commissionContext(db, a.tenantId, commissionId);
  const hist = await db.select({ c: s.commissions, d: s.deals }).from(s.commissions).innerJoin(s.deals, eq(s.deals.id, s.commissions.dealId)).where(scope(s.commissions, a.tenantId));
  return anomalyDetector.run({ commissionId, commission: { amount: x.c.amount, currency: x.c.currency, pct: x.c.percentage, jurisdiction: x.d.jurisdiction, dealType: x.d.dealType, structure: x.st?.name ?? "Unassigned", payer: x.c.payer, dealValue: x.c.grossDealValue, priceMin: x.p.priceMin, priceMax: x.p.priceMax, splitsTotalPct: x.splits.length ? x.splits.reduce((s2, p) => s2 + p.percentage, 0) : 100 }, history: hist.filter((h) => h.c.id !== commissionId).map((h) => ({ pct: h.c.percentage, jurisdiction: h.d.jurisdiction, dealType: h.d.dealType, amountAed: toAed(h.c.amount, h.c.currency) })) }, ctx(a));
}

export async function runTaxAdvisor(db: DB, a: Actor, invoiceId: string) {
  const [inv] = await db.select({ i: s.invoices, d: s.deals, c: s.commissions }).from(s.invoices).leftJoin(s.deals, eq(s.deals.id, s.invoices.dealId)).leftJoin(s.commissions, eq(s.commissions.invoiceId, s.invoices.id)).where(scope(s.invoices, a.tenantId, eq(s.invoices.id, invoiceId)));
  if (!inv) throw new DomainError("Invoice not found.", 404);
  return commissionTaxAdvisor.run({ invoiceId, number: inv.i.number, jurisdiction: inv.d?.jurisdiction ?? "other", currency: inv.i.currency, amount: inv.i.amount, tax: inv.i.tax, payer: inv.c?.payer ?? "buyer", issuedAt: (inv.i.issuedAt ?? inv.i.createdAt).toISOString().slice(0, 10) }, ctx(a));
}

export async function runCollectionAgent(db: DB, a: Actor) {
  const open = await db.select({ i: s.invoices, c: s.commissions }).from(s.invoices).leftJoin(s.commissions, eq(s.commissions.invoiceId, s.invoices.id)).where(scope(s.invoices, a.tenantId, inArray(s.invoices.status, ["issued", "partially_paid", "overdue"])));
  return collectionAgent.run({ currency: "AED", invoices: open.map((x) => ({ id: x.i.id, number: x.i.number, recipient: x.i.recipient, payerType: x.c?.payer === "developer" ? ("developer" as const) : x.i.kind === "advisory_fee" ? ("client" as const) : ("counterparty" as const), receivable: x.i.total - (x.i.tax.tdsAmount ?? 0), currency: x.i.currency, daysOverdue: x.i.dueAt ? Math.round((Date.now() - x.i.dueAt.getTime()) / 86_400_000) : 0, status: x.i.status })) }, ctx(a));
}

/** Invoice for a commission, if issued. */
export async function invoiceOf(db: DB, tenantId: string, commissionId: string) {
  const [c] = await db.select({ invoiceId: s.commissions.invoiceId }).from(s.commissions).where(and(eq(s.commissions.tenantId, tenantId), eq(s.commissions.id, commissionId)));
  return c?.invoiceId ?? null;
}
