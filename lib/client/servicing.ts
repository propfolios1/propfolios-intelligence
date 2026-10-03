import "server-only";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { StatementData } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { scope } from "@/lib/tenant-db";
import { type PortfolioSnapshot, portfolioSnapshot } from "./snapshot";

const INR_PER_AED = 22.6;

export const monthLabel = (period: string) => new Date(`${period}-01T00:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
export const previousMonth = (at = new Date()) => {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
};

/** Monthly statement data from dated cash flows: rent received, costs and closing values in AED. */
export function statementFrom(snap: PortfolioSnapshot, period: string): StatementData {
  const flows: StatementData["flows"] = [];
  let rent = 0;
  let costs = 0;
  const holdings = snap.holdings.map((h) => {
    const inMonth = h.cashFlows.filter((f) => f.date.startsWith(period));
    const r = inMonth.filter((f) => f.kind === "rent" || f.kind === "distribution").reduce((a, f) => a + f.amount, 0);
    const c = inMonth.filter((f) => f.kind === "cost").reduce((a, f) => a + Math.abs(f.amount), 0);
    rent += r;
    costs += c;
    for (const f of inMonth.filter((x) => x.kind !== "valuation")) flows.push({ date: f.date, description: `${f.kind === "rent" ? "Rent received" : f.kind === "cost" ? "Service charge and costs" : f.kind === "acquisition" ? "Acquisition payment" : "Distribution"}: ${h.name}`, amountAed: f.kind === "cost" || f.kind === "acquisition" ? -Math.abs(f.amount) : f.amount });
    const monthlyDrift = h.irr / 12;
    return { property: h.name, valueAed: h.valueAed, rentAed: r || Math.round(h.rentAed / 12), changePct: +(monthlyDrift * 100).toFixed(2) };
  });
  if (!rent) rent = holdings.reduce((a, h) => a + h.rentAed, 0);
  const closing = snap.totals.value;
  const opening = Math.round(closing / (1 + snap.totals.irr / 12));
  return { openingValueAed: opening, closingValueAed: closing, rentReceivedAed: Math.round(rent), costsAed: Math.round(costs), holdings, flows: flows.sort((a, b) => a.date.localeCompare(b.date)) };
}

export async function generateStatement(db: DB, tenantId: string, clientId: string, period: string, commentary?: string) {
  const snap = await portfolioSnapshot(db, tenantId, clientId);
  if (!snap) throw new DomainError("Client not found.", 404);
  const data = statementFrom(snap, period);
  const [row] = await db
    .insert(s.statements)
    .values({ tenantId, clientId, period, data, commentary: commentary ?? null })
    .onConflictDoUpdate({ target: [s.statements.clientId, s.statements.period], set: { data, ...(commentary ? { commentary } : {}), generatedAt: new Date() } })
    .returning();
  return row!;
}

/** Progress for each goal from the live portfolio (income, growth, diversification, liquidity; legacy is set by the adviser). */
export function goalProgress(goal: typeof s.clientGoals.$inferSelect, snap: PortfolioSnapshot) {
  const t = goal.target;
  let current = t.current;
  if (goal.goalType === "income") current = Math.round(snap.totals.rent);
  if (goal.goalType === "growth") current = +snap.totals.gainPct.toFixed(1);
  if (goal.goalType === "diversification") current = +snap.totals.indiaPct.toFixed(1);
  if (goal.goalType === "liquidity") current = +(100 - snap.totals.offPlanPct).toFixed(1);
  const progress = t.target ? Math.max(0, Math.min(100, (current / t.target) * 100)) : 0;
  return { current, progressPct: +progress.toFixed(1) };
}

export async function refreshGoals(db: DB, tenantId: string, clientId: string) {
  const snap = await portfolioSnapshot(db, tenantId, clientId);
  if (!snap) return [];
  const goals = await db.select().from(s.clientGoals).where(scope(s.clientGoals, tenantId, eq(s.clientGoals.clientId, clientId)));
  const out = [];
  for (const g of goals) {
    const p = goalProgress(g, snap);
    const [u] = await db.update(s.clientGoals).set({ target: { ...g.target, current: p.current }, progressPct: p.progressPct, lastUpdated: new Date() }).where(eq(s.clientGoals.id, g.id)).returning();
    out.push(u!);
  }
  return out;
}

/**
 * Annual tax documents: a UAE holding statement (no personal income or
 * capital gains tax) and, for Indian holdings, a rental income statement with
 * the 30% standard deduction (s.24(a)) and TDS deducted by tenants under
 * s.195 for NRI landlords, financial year April to March.
 */
export async function generateTaxDocuments(db: DB, tenantId: string, clientId: string, year: number) {
  const snap = await portfolioSnapshot(db, tenantId, clientId);
  if (!snap) throw new DomainError("Client not found.", 404);
  const nri = /nri/i.test(snap.client.residency);
  const docs: (typeof s.taxDocuments.$inferInsert)[] = [];
  const uae = snap.holdings.filter((h) => h.market === "UAE");
  if (uae.length)
    docs.push({ tenantId, clientId, year, jurisdiction: "UAE", type: "holding_statement", title: `UAE property holding statement ${year}`, data: { rows: uae.map((h) => ({ label: `${h.name}: value at 31 December`, amount: h.valueAed, currency: "AED" })).concat([{ label: "Rental income received", amount: uae.reduce((a, h) => a + h.rentAed, 0), currency: "AED" }]), notes: ["Individuals pay no personal income tax or capital gains tax on UAE property.", "If property is held through a company, corporate tax at 9% may apply above AED 375,000 of taxable income."] } });
  const india = snap.holdings.filter((h) => h.market === "India");
  if (india.length) {
    const rentInr = india.reduce((a, h) => a + h.rentAed * INR_PER_AED, 0);
    const std = rentInr * 0.3;
    const taxable = rentInr - std;
    const tds = nri ? rentInr * 0.312 : 0;
    docs.push({ tenantId, clientId, year, jurisdiction: "India", type: "rental_income_statement", title: `India rental income statement FY ${year}-${String(year + 1).slice(2)}`, data: { rows: [{ label: "Gross rent received", amount: Math.round(rentInr), currency: "INR" }, { label: "Less municipal taxes paid", amount: 0, currency: "INR" }, { label: "Standard deduction at 30%, s.24(a)", amount: -Math.round(std), currency: "INR" }, { label: "Income from house property", amount: Math.round(taxable), currency: "INR" }, ...(nri ? [{ label: "TDS deducted by tenants under s.195 (30% plus 4% cess)", amount: Math.round(tds), currency: "INR" }] : [])], notes: nri ? ["Claim the TDS against your liability in the return; Form 16A from each tenant is required.", "Rent is credited to your NRO account; repatriation within USD 1 million a year with Forms 15CA and 15CB.", "Return due 31 July (ITR-2)."] : ["Return due 31 July (ITR-2)."] } });
    if (nri) docs.push({ tenantId, clientId, year, jurisdiction: "India", type: "tds_summary", title: `TDS summary FY ${year}-${String(year + 1).slice(2)}`, data: { rows: india.map((h) => ({ label: `${h.name}: TDS under s.195`, amount: Math.round(h.rentAed * INR_PER_AED * 0.312), currency: "INR" })), notes: ["Reconcile with Form 26AS before filing."] } });
  }
  const out = [];
  for (const d of docs) {
    const [row] = await db.insert(s.taxDocuments).values(d).onConflictDoUpdate({ target: [s.taxDocuments.clientId, s.taxDocuments.year, s.taxDocuments.type, s.taxDocuments.jurisdiction], set: { data: d.data, title: d.title, generatedAt: new Date() } }).returning();
    out.push(row!);
  }
  return out;
}

/** Share of the client's declared real estate wealth that the firm advises on, by quarter. */
export async function computeWalletShare(db: DB, tenantId: string, clientId: string, period: string) {
  const snap = await portfolioSnapshot(db, tenantId, clientId);
  if (!snap) throw new DomainError("Client not found.", 404);
  const share = snap.client.aumAed ? Math.min(100, (snap.totals.value / snap.client.aumAed) * 100) : 0;
  const rest = 100 - share;
  const competitor = [
    { label: "Other advisers", pct: +(rest * 0.45).toFixed(1) },
    { label: "Held directly", pct: +(rest * 0.35).toFixed(1) },
    { label: "Liquid and other assets", pct: +(rest * 0.2).toFixed(1) },
  ];
  const [row] = await db
    .insert(s.walletShareMetrics)
    .values({ tenantId, clientId, period, advisorySharePct: +share.toFixed(1), competitorShare: competitor, notes: share < 25 ? "Below a quarter of declared wealth: room to grow the relationship." : null })
    .onConflictDoUpdate({ target: [s.walletShareMetrics.clientId, s.walletShareMetrics.period], set: { advisorySharePct: +share.toFixed(1), competitorShare: competitor } })
    .returning();
  return row!;
}

export async function clientServicing(db: DB, tenantId: string, clientId: string) {
  const w = (t: typeof s.statements | typeof s.clientReports | typeof s.clientGoals | typeof s.taxDocuments | typeof s.walletShareMetrics) => and(eq(t.tenantId, tenantId), eq(t.clientId, clientId));
  const [statements, reports, goals, taxDocs, wallet] = await Promise.all([db.select().from(s.statements).where(w(s.statements)), db.select().from(s.clientReports).where(w(s.clientReports)), db.select().from(s.clientGoals).where(w(s.clientGoals)), db.select().from(s.taxDocuments).where(w(s.taxDocuments)), db.select().from(s.walletShareMetrics).where(w(s.walletShareMetrics))]);
  return { statements: statements.sort((a, b) => b.period.localeCompare(a.period)), reports: reports.sort((a, b) => b.period.localeCompare(a.period)), goals, taxDocs: taxDocs.sort((a, b) => b.year - a.year), wallet: wallet.sort((a, b) => b.period.localeCompare(a.period)) };
}
