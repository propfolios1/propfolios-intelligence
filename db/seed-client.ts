import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { runAmlScreener, runClientSuccess, runGoalTracker, runKycAnalyzer, runPrivateBanking, runStatementGenerator } from "@/lib/client/agents";
import { runAmlScreening } from "@/lib/client/aml";
import { ensureKyc, requiredDocuments } from "@/lib/client/kyc";
import { generateClientReport, periodLabel } from "@/lib/client/reports";
import { computeWalletShare, generateTaxDocuments, refreshGoals } from "@/lib/client/servicing";
import { CLIENTS } from "./seed-data";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Client layer: three KYC files in different states (verified and expiring
 * soon, under review with a PEP alert, verified NRI), AML screening for
 * every client, two goals each, three monthly statements, a quarterly
 * report, last year's tax documents and wallet share. Agents write the
 * commentary and assessments exactly as the scheduler would. Idempotent.
 */
export async function seedClientLayer(db: DB, t: { tenantId: string; id: (k: string) => string }) {
  const actor = { tenantId: t.tenantId, name: "Scheduler" };
  const cid = (k: string) => t.id(`client:${k}`);
  const [done] = await db.select({ id: s.statements.id }).from(s.statements).where(and(eq(s.statements.tenantId, t.tenantId), eq(s.statements.clientId, cid("ahmed")))).limit(1);
  if (done) return { client: 0 };
  const now = Date.now();
  const verified = async (key: string, opts: { expiresInDays: number; sof: string; pep?: boolean; status?: "verified" | "in_review" }) => {
    const c = CLIENTS.find((x) => x.key === key)!;
    const k = await ensureKyc(db, t.tenantId, cid(key));
    const docs = requiredDocuments(c).map((type) => ({ type, documentId: null, status: (opts.status === "in_review" && type === "proof_of_address" ? "received" : "verified") as "verified" | "received", expiresAt: type === "passport" ? iso(new Date(now + (opts.expiresInDays + 400) * DAY)) : type === "emirates_id" ? iso(new Date(now + opts.expiresInDays * DAY)) : null }));
    await db.update(s.kycRecords).set({ documents: docs, status: opts.status ?? "verified", pep: opts.pep ?? false, sourceOfFunds: opts.sof, verifiedAt: opts.status === "in_review" ? null : new Date(now - 340 * DAY), verifiedBy: opts.status === "in_review" ? null : "Amol Bandekar", expiresAt: opts.status === "in_review" ? null : new Date(now + opts.expiresInDays * DAY), riskLevel: opts.pep ? "high" : c.aumAed >= 50_000_000 || /nri/i.test(c.residency) ? "medium" : "low" }).where(eq(s.kycRecords.id, k.id));
  };
  await verified("ahmed", { expiresInDays: 30, sof: "Salary and bonuses as a senior executive; disposal of a Dubai villa in 2022 (title deed and bank statements on file)." });
  await verified("khalid", { expiresInDays: 400, sof: "Family business dividends and real estate disposals; audited accounts 2023 to 2025.", status: "in_review" });
  await verified("rajesh", { expiresInDays: 520, sof: "Proceeds from the sale of a manufacturing business in Pune (2021), NRE account statements." });

  for (const c of CLIENTS) {
    await runAmlScreening(db, t.tenantId, cid(c.key), new Date(now - 20 * DAY));
    await runAmlScreener(db, actor, cid(c.key));
    await runKycAnalyzer(db, actor, cid(c.key));
  }

  const goals: Record<string, { goalType: "income" | "growth" | "diversification" | "liquidity" | "legacy"; title: string; target: number; unit: string; by: string }[]> = {
    ahmed: [{ goalType: "income", title: "Net rental income of AED 450,000 a year", target: 450_000, unit: "AED", by: "2027-06-30" }, { goalType: "diversification", title: "Add an Abu Dhabi holding", target: 1, unit: "holding", by: "2027-03-31" }],
    priya: [{ goalType: "income", title: "Rupee income to cover family commitments in Mumbai", target: 220_000, unit: "AED", by: "2027-03-31" }, { goalType: "diversification", title: "India at 40% of the portfolio", target: 40, unit: "% of value", by: "2027-12-31" }],
    khalid: [{ goalType: "liquidity", title: "Ready, income-producing assets at 85% or more", target: 85, unit: "% ready", by: "2026-12-31" }, { goalType: "legacy", title: "Holding structure for the next generation", target: 100, unit: "% complete", by: "2027-06-30" }],
    rajesh: [{ goalType: "growth", title: "Capital growth of 25% on cost", target: 25, unit: "% on cost", by: "2028-12-31" }, { goalType: "income", title: "Net rental income of AED 300,000 a year", target: 300_000, unit: "AED", by: "2027-12-31" }],
    fatima: [{ goalType: "liquidity", title: "Keep off-plan below 20%", target: 80, unit: "% ready", by: "2026-12-31" }, { goalType: "income", title: "Net rental income of AED 1.2M a year", target: 1_200_000, unit: "AED", by: "2027-06-30" }],
  };
  for (const [k, gs] of Object.entries(goals)) {
    await db.insert(s.clientGoals).values(gs.map((g) => ({ tenantId: t.tenantId, clientId: cid(k), goalType: g.goalType, title: g.title, target: { metric: g.goalType, target: g.target, current: g.goalType === "legacy" ? 35 : 0, unit: g.unit, by: g.by }, progressPct: g.goalType === "legacy" ? 35 : 0, createdAt: new Date(now - 300 * DAY) })));
    await refreshGoals(db, t.tenantId, cid(k));
  }

  const months = [3, 2, 1].map((m) => { const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - m, 1)); return d.toISOString().slice(0, 7); });
  const lastQ = periodLabel("quarterly");
  const quarter = `${new Date().getUTCFullYear()}-Q${Math.floor(new Date().getUTCMonth() / 3) + 1}`;
  for (const c of CLIENTS) {
    for (const m of months) await runStatementGenerator(db, actor, cid(c.key), m);
    await generateClientReport(db, t.tenantId, cid(c.key), { type: "quarterly", actor: "Scheduler", period: lastQ });
    await generateTaxDocuments(db, t.tenantId, cid(c.key), new Date().getUTCFullYear() - 1);
    await computeWalletShare(db, t.tenantId, cid(c.key), quarter);
    await runGoalTracker(db, actor, cid(c.key));
    await runClientSuccess(db, actor, cid(c.key));
    if (c.aumAed >= 50_000_000) await runPrivateBanking(db, actor, cid(c.key));
  }
  // Ahmed has read his report; the others have not yet.
  await db.update(s.clientReports).set({ viewedAt: new Date(now - 2 * DAY), deliveredAt: new Date(now - 6 * DAY) }).where(and(eq(s.clientReports.tenantId, t.tenantId), eq(s.clientReports.clientId, cid("ahmed"))));
  return { client: CLIENTS.length };
}
