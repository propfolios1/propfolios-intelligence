import "server-only";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { ReportContent } from "@/db/schema";
import { reportWriter } from "@/lib/ai/os-agents/client";
import { DomainError } from "@/lib/errors";
import { formatMoney } from "@/lib/utils";
import { type PortfolioSnapshot, portfolioSnapshot } from "./snapshot";

export type ReportType = "quarterly" | "annual" | "ad_hoc";

export function periodLabel(type: ReportType, at = new Date()) {
  const y = at.getUTCFullYear();
  if (type === "annual") return `${y - (at.getUTCMonth() < 3 ? 1 : 0)}`;
  if (type === "quarterly") {
    const q = Math.floor(at.getUTCMonth() / 3);
    return q === 0 ? `${y - 1}-Q4` : `${y}-Q${q}`;
  }
  return at.toISOString().slice(0, 10);
}

const aed = (n: number) => formatMoney(n, "AED");

/** Deterministic report body from the snapshot; the report-writer agent refines it when it runs. */
export function composeReport(snap: PortfolioSnapshot, type: ReportType, period: string): { title: string; content: ReportContent } {
  const t = snap.totals;
  const top = snap.holdings[0];
  const title = `${type === "annual" ? "Annual review" : type === "quarterly" ? "Quarterly report" : "Portfolio report"} ${period}: ${snap.client.name}`;
  return {
    title,
    content: {
      headline: `Portfolio value ${aed(t.value)}, ${t.gainPct >= 0 ? "up" : "down"} ${Math.abs(t.gainPct).toFixed(1)}% on cost, with a ${t.cashYield.toFixed(1)}% cash yield and an ${(t.irr * 100).toFixed(1)}% weighted IRR.`,
      sections: [
        { heading: "Performance", body: `The ${snap.holdings.length} holdings are carried at ${aed(t.value)} against a cost of ${aed(t.cost)}. Annual rent of ${aed(t.rent)} gives a cash yield of ${t.cashYield.toFixed(1)}% on cost.` },
        { heading: "Allocation", body: `India represents ${t.indiaPct.toFixed(0)}% of value and off-plan or under-construction assets ${t.offPlanPct.toFixed(0)}%, against the policy maximum of ${snap.client.policy.maxOffPlanPct}%.${top ? ` The largest position is ${top.name} at ${aed(top.valueAed)}.` : ""}` },
        { heading: "Policy", body: `Target net yield ${snap.client.policy.targetNetYield}%, horizon ${snap.client.policy.horizonYears} years, single-asset limit ${snap.client.policy.maxSingleAssetPct}%. ${t.offPlanPct > snap.client.policy.maxOffPlanPct ? "Off-plan exposure is above the policy limit; new off-plan commitments should be deferred." : "The portfolio is within its off-plan limit."}` },
      ],
      metrics: [
        { label: "Value", value: aed(t.value) },
        { label: "Gain on cost", value: `${t.gainPct.toFixed(1)}%` },
        { label: "Cash yield", value: `${t.cashYield.toFixed(1)}%` },
        { label: "Weighted IRR", value: `${(t.irr * 100).toFixed(1)}%` },
        { label: "Off-plan share", value: `${t.offPlanPct.toFixed(0)}%` },
      ],
    },
  };
}

/**
 * Generates (or refreshes) a client report for the current period. One
 * report per client, period and type; a second run updates it in place.
 */
export async function generateClientReport(db: DB, tenantId: string, clientId: string, opts: { type: ReportType; actor: string; period?: string }) {
  const snap = await portfolioSnapshot(db, tenantId, clientId);
  if (!snap) throw new DomainError("Client not found.", 404);
  const period = opts.period ?? periodLabel(opts.type);
  const base = composeReport(snap, opts.type, period);
  const goals = await db.select().from(s.clientGoals).where(and(eq(s.clientGoals.tenantId, tenantId), eq(s.clientGoals.clientId, clientId)));
  const deals = await db.select().from(s.deals).where(and(eq(s.deals.tenantId, tenantId), eq(s.deals.clientId, clientId)));
  const run = await reportWriter.run(
    {
      clientId,
      client: { name: snap.client.name, targetNetYield: snap.client.policy.targetNetYield, maxOffPlanPct: snap.client.policy.maxOffPlanPct },
      type: opts.type,
      period,
      totals: snap.totals,
      holdings: snap.holdings.slice(0, 8).map((h) => ({ name: h.name, valueAed: h.valueAed, market: h.market })),
      goals: goals.map((g) => ({ title: g.title, progressPct: g.progressPct })),
      deals: deals.slice(0, 6).map((d) => ({ reference: d.reference, title: d.title, status: d.status, stage: d.stage })),
    },
    { tenantId, actor: opts.actor },
  );
  const title = run.output.title.includes(snap.client.name) ? run.output.title : `${run.output.title}: ${snap.client.name}`;
  const content: ReportContent = { headline: run.output.headline, sections: run.output.sections, metrics: base.content.metrics };
  const [row] = await db
    .insert(s.clientReports)
    .values({ tenantId, clientId, period, type: opts.type, title, content })
    .onConflictDoUpdate({ target: [s.clientReports.clientId, s.clientReports.period, s.clientReports.type], set: { title, content, generatedAt: new Date() } })
    .returning();
  return row!;
}
