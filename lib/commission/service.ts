import "server-only";
import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { publish } from "@/lib/ai/orchestration/event-bus";
import { DomainError } from "@/lib/errors";
import { formatLocal } from "@/lib/format";
import { systemAudit } from "@/lib/os/audit";
import { notify, sendEmail } from "@/lib/os/notify";
import { scope } from "@/lib/tenant-db";
import { computeCommission, computeSplits, invoiceTax, matchPayments, parseStatementCsv, selectStructure } from "./engine";

export interface Actor {
  tenantId: string;
  name: string;
  id?: string;
}
const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export async function nextInvoiceNumber(db: DB, tenantId: string, at = new Date()) {
  const prefix = `INV-${at.getUTCFullYear()}-`;
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(s.invoices).where(scope(s.invoices, tenantId, like(s.invoices.number, `${prefix}%`)));
  return `${prefix}${String((r?.n ?? 0) + 1).padStart(4, "0")}`;
}

/** The structures a new workspace starts with; editable in Administration → Commissions → Structures. */
export const DEFAULT_STRUCTURES: Omit<typeof s.commissionStructures.$inferInsert, "tenantId">[] = [
  { name: "Standard UAE resale", type: "percentage", ratePct: 2, payer: "buyer", isDefault: true, appliesTo: { jurisdictions: ["dubai", "abu_dhabi"], dealTypes: ["residential_resale", "freehold_villa", "commercial"] }, splits: [{ label: "Lead analyst", role: "analyst", pct: 40 }, { label: "Senior analyst", role: "senior_analyst", pct: 20 }, { label: "House", role: "house", pct: 40 }] },
  { name: "Developer off-plan", type: "percentage", ratePct: 4, payer: "developer", appliesTo: { dealTypes: ["off_plan"] }, splits: [{ label: "Lead analyst", role: "analyst", pct: 35 }, { label: "Senior analyst", role: "senior_analyst", pct: 15 }, { label: "House", role: "house", pct: 50 }] },
  { name: "India advisory (Mumbai and Goa)", type: "percentage", ratePct: 1, payer: "buyer", appliesTo: { jurisdictions: ["mumbai", "goa"] }, splits: [{ label: "Lead analyst", role: "analyst", pct: 40 }, { label: "Senior analyst", role: "senior_analyst", pct: 20 }, { label: "House", role: "house", pct: 40 }] },
  { name: "Prime tiered (AED 10M and above)", type: "tiered", payer: "buyer", appliesTo: { jurisdictions: ["dubai", "abu_dhabi"], minValue: 10_000_000 }, tiers: [{ upTo: 10_000_000, ratePct: 2 }, { upTo: 25_000_000, ratePct: 1.5 }, { upTo: null, ratePct: 1 }], splits: [{ label: "Lead analyst", role: "analyst", pct: 30 }, { label: "Senior analyst", role: "senior_analyst", pct: 20 }, { label: "House", role: "house", pct: 50 }] },
];

export async function ensureDefaultStructures(db: DB, tenantId: string) {
  const existing = await db.select({ id: s.commissionStructures.id }).from(s.commissionStructures).where(scope(s.commissionStructures, tenantId)).limit(1);
  if (existing.length) return false;
  await db.insert(s.commissionStructures).values(DEFAULT_STRUCTURES.map((x) => ({ ...x, tenantId })));
  return true;
}

/**
 * Computes the commission for a closed deal under the applicable structure
 * and writes its splits. Idempotent: a deal has at most one commission.
 */
export async function computeForDeal(db: DB, actor: Actor, dealId: string, opts: { inline?: boolean; at?: Date; issue?: boolean } = {}) {
  const [deal] = await db.select().from(s.deals).where(scope(s.deals, actor.tenantId, eq(s.deals.id, dealId)));
  if (!deal) throw new DomainError("Deal not found.", 404);
  const [existing] = await db.select().from(s.commissions).where(scope(s.commissions, actor.tenantId, eq(s.commissions.dealId, dealId)));
  if (existing) return { commission: existing, created: false };
  await ensureDefaultStructures(db, actor.tenantId);
  const structures = await db.select().from(s.commissionStructures).where(scope(s.commissionStructures, actor.tenantId));
  const st = selectStructure(structures, deal);
  if (!st) throw new DomainError("No commission structure applies. Create a default structure in Administration → Commissions.");
  const at = opts.at ?? new Date();
  // A scenario selected in the deal's live calculator takes precedence: amounts to the cent, splits as modelled.
  const { closingCalculation } = await import("./calc-service");
  const closing = await closingCalculation(db, actor.tenantId, dealId, actor.id ?? null);
  const minor = (x: string) => Number(BigInt(x)) / 100;
  const c = closing
    ? { amount: minor(closing.result.gross), percentage: closing.result.effectivePct, method: `calculator (${closing.scenario.name})`, steps: closing.result.steps }
    : computeCommission(st, deal);
  const payer = closing ? ((p) => (p === "landlord" ? "seller" : p === "tenant" ? "buyer" : p))(closing.result.fees[0]!.payer) as "developer" | "seller" | "buyer" : st.payer;
  const [commission] = await db
    .insert(s.commissions)
    .values({ tenantId: actor.tenantId, dealId, structureId: closing?.scenario.structureId ?? st.id, recipientUserId: deal.ownerUserId, payer, grossDealValue: closing ? Number(closing.scenario.price) : deal.value, amount: c.amount, currency: deal.currency, percentage: c.percentage, status: "expected", expectedDate: isoDay(new Date(at.getTime() + 30 * DAY)), computation: { method: c.method, steps: c.steps }, createdAt: at })
    .returning();
  const staff = await db.select({ id: s.users.id, role: s.users.role, accessRole: s.users.accessRole }).from(s.users).where(scope(s.users, actor.tenantId, inArray(s.users.role, ["tenant_admin", "analyst"])));
  const senior = staff.find((u) => u.accessRole === "senior_analyst" || u.accessRole === "tenant_owner") ?? staff.find((u) => u.role === "tenant_admin");
  const gross = closing ? BigInt(closing.result.gross) : 0n;
  const rows = closing
    ? closing.result.distribution.map((l) => ({ label: l.kind === "deduction" ? `${l.label} (${l.party})` : l.label, userId: l.kind === "agent" ? (l.userId ?? deal.ownerUserId) : null, percentage: gross ? Number((BigInt(l.amount) * 10_000n) / gross) / 100 : 0, amount: minor(l.amount) }))
    : computeSplits(st.splits, c.amount, (r) => (r.role === "analyst" || r.role === "junior_analyst" ? deal.ownerUserId : r.role === "senior_analyst" ? (senior?.id ?? null) : null));
  if (rows.length) await db.insert(s.splits).values(rows.map((r) => ({ tenantId: actor.tenantId, commissionId: commission!.id, userId: r.userId, label: r.label, percentage: r.percentage, amount: r.amount, createdAt: at })));
  await systemAudit(db, { tenantId: actor.tenantId, actor: actor.name, action: "computed commission", entityType: "commission", entityId: commission!.id, after: { structure: st.name, amount: c.amount, currency: deal.currency, splits: rows } });
  if (opts.issue) await issueInvoice(db, actor, commission!.id, { at });
  await publish(db, { type: "commission.computed", tenantId: actor.tenantId, entityType: "commission", entityId: commission!.id, dealId, clientId: deal.clientId, mandateId: deal.mandateId, actor: actor.name, payload: { label: `${deal.reference}: commission ${formatLocal(c.amount, deal.currency)} under ${st.name}`, href: `/admin/commissions?deal=${deal.id}` }, at }, { inline: opts.inline });
  return { commission: commission!, created: true };
}

/** Recipient of a commission invoice: the party the structure says pays. */
async function recipientFor(db: DB, tenantId: string, deal: typeof s.deals.$inferSelect, payer: "developer" | "seller" | "buyer") {
  const [client] = await db.select().from(s.clients).where(eq(s.clients.id, deal.clientId));
  const clientIsPayer = (payer === "buyer" && deal.side === "buy") || (payer === "seller" && deal.side === "sell");
  if (clientIsPayer) {
    const [u] = await db.select({ email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, tenantId), eq(s.users.clientId, deal.clientId), eq(s.users.role, "client"))).limit(1);
    return { name: client!.name, email: u?.email ?? null, clientId: client!.id, kind: "advisory_fee" as const };
  }
  if (payer === "developer") {
    const [p] = await db.select({ dev: s.developers.name }).from(s.properties).innerJoin(s.developers, eq(s.developers.id, s.properties.developerId)).where(eq(s.properties.id, deal.propertyId));
    return { name: p?.dev ?? deal.counterparty, email: null, clientId: null, kind: "commission" as const };
  }
  return { name: deal.counterparty, email: null, clientId: null, kind: "commission" as const };
}

/** Issues and sends the invoice for a commission (tax per jurisdiction); idempotent per commission. */
export async function issueInvoice(db: DB, actor: Actor, commissionId: string, opts: { at?: Date; send?: boolean } = {}) {
  const [c] = await db.select().from(s.commissions).where(scope(s.commissions, actor.tenantId, eq(s.commissions.id, commissionId)));
  if (!c) throw new DomainError("Commission not found.", 404);
  if (c.invoiceId) {
    const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.id, c.invoiceId));
    return inv!;
  }
  const [deal] = await db.select().from(s.deals).where(eq(s.deals.id, c.dealId));
  const [prop] = await db.select({ name: s.properties.name }).from(s.properties).where(eq(s.properties.id, deal!.propertyId));
  const at = opts.at ?? new Date();
  const to = await recipientFor(db, actor.tenantId, deal!, c.payer);
  const tax = invoiceTax(deal!.jurisdiction, c.amount, c.payer);
  const number = await nextInvoiceNumber(db, actor.tenantId, at);
  const [inv] = await db
    .insert(s.invoices)
    .values({
      tenantId: actor.tenantId,
      dealId: deal!.id,
      clientId: to.clientId ?? deal!.clientId,
      number,
      kind: to.kind,
      recipient: to.name,
      recipientEmail: to.email,
      lines: [{ description: `${to.kind === "advisory_fee" ? "Advisory fee" : "Brokerage commission"}: ${prop?.name ?? "property"} (${deal!.reference}), ${c.percentage.toFixed(2)}% of ${formatLocal(c.grossDealValue, c.currency, { compact: false })}`, amount: c.amount }],
      amount: c.amount,
      currency: c.currency,
      tax: { type: tax.type, ratePct: tax.ratePct, amount: tax.amount, ...(tax.tdsPct ? { tdsPct: tax.tdsPct, tdsAmount: tax.tdsAmount } : {}) },
      total: tax.total,
      status: "issued",
      issuedAt: at,
      dueAt: new Date(at.getTime() + 30 * DAY),
      createdAt: at,
    })
    .returning();
  await db.update(s.commissions).set({ status: "invoiced", invoiceId: inv!.id }).where(eq(s.commissions.id, c.id));
  if (opts.send !== false && to.email) await sendEmail(db, { tenantId: actor.tenantId, to: to.email, subject: `Invoice ${number}: ${formatLocal(tax.total, c.currency, { compact: false })}`, text: `${to.name},\n\nPlease find invoice ${number} for ${formatLocal(tax.total, c.currency, { compact: false })} including ${tax.type} of ${formatLocal(tax.amount, c.currency, { compact: false })}, due within 30 days. You can view it in your portal under Invoices.\n` });
  await systemAudit(db, { tenantId: actor.tenantId, actor: actor.name, action: "issued invoice", entityType: "invoice", entityId: inv!.id, after: { number, total: tax.total, currency: c.currency, recipient: to.name, sent: Boolean(to.email) } });
  return inv!;
}

/** Records money received against an invoice; a full payment marks the invoice paid and raises invoice.paid. */
export async function recordPayment(db: DB, actor: Actor, invoiceId: string, p: { amount: number; method: "bank_transfer" | "cheque" | "card" | "cash"; reference: string; receivedAt?: Date; source?: "manual" | "csv" }, opts: { inline?: boolean } = {}) {
  const [inv] = await db.select().from(s.invoices).where(scope(s.invoices, actor.tenantId, eq(s.invoices.id, invoiceId)));
  if (!inv) throw new DomainError("Invoice not found.", 404);
  if (inv.status === "paid" || inv.status === "void") throw new DomainError(`Invoice ${inv.number} is already ${inv.status}.`);
  const at = p.receivedAt ?? new Date();
  await db.insert(s.paymentsReceived).values({ tenantId: actor.tenantId, invoiceId, amount: p.amount, currency: inv.currency, receivedAt: at, method: p.method, reference: p.reference, source: p.source ?? "manual", reconciledBy: actor.name, reconciledAt: new Date(), createdAt: at });
  const [sum] = await db.select({ v: sql<number>`coalesce(sum(${s.paymentsReceived.amount}), 0)::float` }).from(s.paymentsReceived).where(eq(s.paymentsReceived.invoiceId, invoiceId));
  const receivable = inv.total - (inv.tax.tdsAmount ?? 0);
  const paid = (sum?.v ?? 0) >= receivable - 1;
  const [u] = await db.update(s.invoices).set({ status: paid ? "paid" : "partially_paid", paidAt: paid ? at : null }).where(eq(s.invoices.id, invoiceId)).returning();
  if (paid) {
    await db.update(s.commissions).set({ status: "received", receivedDate: isoDay(at) }).where(scope(s.commissions, actor.tenantId, eq(s.commissions.invoiceId, invoiceId)));
    await systemAudit(db, { tenantId: actor.tenantId, actor: actor.name, action: "invoice paid", entityType: "invoice", entityId: invoiceId, before: { status: inv.status }, after: { status: "paid", received: sum?.v } });
    await notify(db, { tenantId: actor.tenantId, roles: ["tenant_admin"], category: "commissions", title: `Invoice ${inv.number} paid`, body: `${formatLocal(sum?.v ?? 0, inv.currency, { compact: false })} received from ${inv.recipient}.`, href: `/admin/invoices/${inv.id}` });
    await publish(db, { type: "invoice.paid", tenantId: actor.tenantId, entityType: "invoice", entityId: invoiceId, dealId: inv.dealId, clientId: inv.clientId, actor: actor.name, payload: { label: `${inv.number} paid by ${inv.recipient}`, href: `/admin/invoices/${inv.id}` }, at }, { inline: opts.inline });
  }
  return { before: inv, after: u! };
}

/** Matches a bank statement CSV against open invoices and records the matched payments. */
export async function reconcileCsv(db: DB, actor: Actor, csv: string, apply = true) {
  const lines = parseStatementCsv(csv);
  if (!lines.length) throw new DomainError("No rows with a date and an amount were found. Columns: date, amount, reference.");
  const open = await db.select().from(s.invoices).where(scope(s.invoices, actor.tenantId, inArray(s.invoices.status, ["issued", "partially_paid", "overdue"])));
  const matches = matchPayments(lines, open.map((i) => ({ id: i.id, number: i.number, receivable: i.total - (i.tax.tdsAmount ?? 0) })));
  const results = [];
  for (const m of matches) {
    if (m.invoice && apply) await recordPayment(db, actor, m.invoice.id, { amount: m.line.amount, method: "bank_transfer", reference: m.line.reference.slice(0, 120) || `Statement line ${m.line.line}`, receivedAt: new Date(`${m.line.date}T09:00:00Z`), source: "csv" });
    results.push({ line: m.line.line, date: m.line.date, amount: m.line.amount, reference: m.line.reference, invoice: m.invoice?.number ?? null, rule: m.rule });
  }
  return { matched: results.filter((r) => r.invoice).length, unmatched: results.filter((r) => !r.invoice).length, rows: results };
}

/** VAT (UAE), GST and TDS under s.194H (India) for a period "YYYY-MM" or "YYYY-Qn", from issued invoices. */
export async function generateTaxReport(db: DB, tenantId: string, period: string, type: "uae_vat" | "india_gst" | "india_tds_194h") {
  const [y, rest] = period.split("-");
  const q = /^Q\d$/.test(rest ?? "") ? Number(rest!.slice(1)) : null;
  const from = q ? new Date(Date.UTC(Number(y), (q - 1) * 3, 1)) : new Date(`${period}-01T00:00:00Z`);
  const to = q ? new Date(Date.UTC(Number(y), q * 3, 1)) : new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  const invs = (await db.select().from(s.invoices).where(scope(s.invoices, tenantId))).filter((i) => i.issuedAt && i.issuedAt >= from && i.issuedAt < to && i.status !== "void" && (type === "uae_vat" ? i.tax.type === "UAE VAT" : i.tax.type === "India GST"));
  const currency = type === "uae_vat" ? "AED" : "INR";
  const taxable = invs.reduce((a, i) => a + i.amount, 0);
  const tax = invs.reduce((a, i) => a + i.tax.amount, 0);
  const tds = invs.reduce((a, i) => a + (i.tax.tdsAmount ?? 0), 0);
  const data: { rows: { label: string; amount: number }[]; totals: Record<string, number>; currency: string; invoices: number } =
    type === "uae_vat"
      ? { rows: [{ label: "Box 1: standard-rated supplies (taxable value)", amount: taxable }, { label: "Box 1: output VAT at 5%", amount: tax }, { label: "Box 8: total value of due tax", amount: tax }], totals: { taxable, vat: tax }, currency, invoices: invs.length }
      : type === "india_gst"
        ? { rows: [{ label: "GSTR-1 Table 4A: taxable value (SAC 997222)", amount: taxable }, { label: "IGST / CGST + SGST at 18%", amount: tax }, { label: "GSTR-3B 3.1(a): outward taxable supplies", amount: taxable }], totals: { taxable, gst: tax }, currency, invoices: invs.length }
        : { rows: [{ label: "Commission subject to s.194H", amount: invs.filter((i) => i.tax.tdsAmount).reduce((a, i) => a + i.amount, 0) }, { label: "TDS deducted by payers at 2% (claim in ITR; reconcile with Form 26AS)", amount: tds }], totals: { base: taxable, tds }, currency, invoices: invs.filter((i) => i.tax.tdsAmount).length };
  const [row] = await db
    .insert(s.taxReports)
    .values({ tenantId, period, jurisdiction: type === "uae_vat" ? "UAE" : "India", type, data })
    .onConflictDoUpdate({ target: [s.taxReports.tenantId, s.taxReports.period, s.taxReports.type], set: { data, generatedAt: new Date() } })
    .returning();
  return row!;
}

/** Marks issued invoices past their due date as overdue (daily cron). */
export async function markOverdue(db: DB, tenantId: string) {
  const r = await db.update(s.invoices).set({ status: "overdue" }).where(and(scope(s.invoices, tenantId, inArray(s.invoices.status, ["issued", "partially_paid"])), sql`${s.invoices.dueAt} < now()`)).returning({ id: s.invoices.id });
  return r.length;
}

/* ----------------------------------------------------------------- reads */

export async function listCommissions(db: DB, tenantId: string, f: { userId?: string } = {}) {
  const rows = await db
    .select({ commission: s.commissions, deal: s.deals, structure: s.commissionStructures.name, invoice: s.invoices, client: s.clients.name })
    .from(s.commissions)
    .innerJoin(s.deals, eq(s.deals.id, s.commissions.dealId))
    .innerJoin(s.clients, eq(s.clients.id, s.deals.clientId))
    .leftJoin(s.commissionStructures, eq(s.commissionStructures.id, s.commissions.structureId))
    .leftJoin(s.invoices, eq(s.invoices.id, s.commissions.invoiceId))
    .where(scope(s.commissions, tenantId))
    .orderBy(desc(s.commissions.createdAt));
  const sp = rows.length ? await db.select({ split: s.splits, user: s.users.name }).from(s.splits).leftJoin(s.users, eq(s.users.id, s.splits.userId)).where(scope(s.splits, tenantId, inArray(s.splits.commissionId, rows.map((r) => r.commission.id)))).orderBy(asc(s.splits.createdAt)) : [];
  const out = rows.map((r) => ({ ...r, splits: sp.filter((x) => x.split.commissionId === r.commission.id) }));
  return f.userId ? out.filter((r) => r.splits.some((x) => x.split.userId === f.userId)) : out;
}

export async function listInvoices(db: DB, tenantId: string, f: { clientId?: string; kind?: "commission" | "advisory_fee" } = {}) {
  return db
    .select({ invoice: s.invoices, deal: s.deals.reference })
    .from(s.invoices)
    .leftJoin(s.deals, eq(s.deals.id, s.invoices.dealId))
    .where(scope(s.invoices, tenantId, f.clientId ? eq(s.invoices.clientId, f.clientId) : undefined, f.kind ? eq(s.invoices.kind, f.kind) : undefined))
    .orderBy(desc(s.invoices.createdAt));
}

export async function getInvoice(db: DB, tenantId: string, id: string) {
  const [inv] = await db.select().from(s.invoices).where(scope(s.invoices, tenantId, eq(s.invoices.id, id)));
  if (!inv) return null;
  const payments = await db.select().from(s.paymentsReceived).where(scope(s.paymentsReceived, tenantId, eq(s.paymentsReceived.invoiceId, id))).orderBy(asc(s.paymentsReceived.receivedAt));
  const [deal] = inv.dealId ? await db.select().from(s.deals).where(eq(s.deals.id, inv.dealId)) : [];
  const [commission] = await db.select().from(s.commissions).where(scope(s.commissions, tenantId, eq(s.commissions.invoiceId, id)));
  const [tenant] = await db.select({ name: s.tenants.name, config: s.tenants.configJson }).from(s.tenants).where(eq(s.tenants.id, tenantId));
  return { invoice: inv, payments, deal: deal ?? null, commission: commission ?? null, tenant: tenant! };
}
