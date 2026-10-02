import "server-only";
import { desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import type { z } from "zod";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { InsightConfig } from "@/db/schema";
import { payload, runAgent } from "@/lib/ai/agents/_run";
import type { AgentContext } from "@/lib/ai/client";
import { INSIGHT_PROMPT_VERSION, INSIGHT_SYSTEM } from "@/lib/ai/prompts/insight_v1";
import { insightNarrativeOutput, type insightSignal } from "@/lib/ai/schemas";
import { timingScore } from "@/lib/ai/tools/valuation";
import { getTenantById } from "@/lib/tenant";
import { scope } from "@/lib/tenant-db";

export const DEFAULT_INSIGHT_CONFIG: InsightConfig = {
  priceMovementPct: 10,
  developerDistressScore: 40,
  undervaluedDiscountPct: 8,
  exitGainPct: 25,
  notifyClients: true,
};

type Signal = z.infer<typeof insightSignal> & {
  clientId: string | null;
  propertyId: string | null;
  audience: "analyst" | "client" | "both";
  metrics: { label: string; value: string }[];
};

const pct = (v: number, d = 1) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}%`;
const aed = (v: number) => (v >= 1_000_000 ? `AED ${(v / 1_000_000).toFixed(2)}M` : `AED ${Math.round(v).toLocaleString("en-US")}`);

/**
 * Deterministic scanners over the tenant's market data, developers,
 * catalogue and client holdings. They decide what is worth saying; the
 * insight agent only writes the words.
 */
async function detect(db: DB, tenantId: string, cfg: InsightConfig): Promise<Signal[]> {
  const [market, developers, properties, holdings, clients, txs] = await Promise.all([
    db.select().from(s.marketData).where(scope(s.marketData, tenantId)).orderBy(s.marketData.month),
    db.select().from(s.developers).where(scope(s.developers, tenantId)),
    db.select().from(s.properties).where(scope(s.properties, tenantId)),
    db.select().from(s.portfolios).where(scope(s.portfolios, tenantId)),
    db.select({ id: s.clients.id, name: s.clients.name, policy: s.clients.policy }).from(s.clients).where(scope(s.clients, tenantId)),
    db.select({ propertyId: s.transactions.propertyId, community: s.transactions.community, psf: s.transactions.pricePerSqft }).from(s.transactions).where(scope(s.transactions, tenantId)),
  ]);
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const prop = new Map(properties.map((p) => [p.id, p]));
  const dev = new Map(developers.map((d) => [d.id, d]));
  const signals: Signal[] = [];
  const clientAudience = cfg.notifyClients ? ("both" as const) : ("analyst" as const);

  // 1. Price movements above threshold, by region (twelve-month change), per affected client.
  const byRegion = new Map<string, typeof market>();
  for (const m of market) byRegion.set(m.region, [...(byRegion.get(m.region) ?? []), m]);
  const regionSignal = new Map<string, "BUY" | "HOLD" | "SELL">();
  for (const [region, rows] of byRegion) {
    if (rows.length < 4) continue;
    regionSignal.set(region, timingScore(rows).signal);
    const first = rows[0]!;
    const last = rows.at(-1)!;
    const change = (last.medianPriceSqft / first.medianPriceSqft - 1) * 100;
    if (Math.abs(change) < cfg.priceMovementPct) continue;
    const exposed = holdings.filter((h) => prop.get(h.propertyId)?.region === region);
    const byClient = new Map<string, typeof exposed>();
    for (const h of exposed) byClient.set(h.clientId, [...(byClient.get(h.clientId) ?? []), h]);
    const facts = [`${region} median price per sq ft moved ${pct(change)} over ${rows.length} months, from AED ${Math.round(first.medianPriceSqft).toLocaleString("en-US")} to AED ${Math.round(last.medianPriceSqft).toLocaleString("en-US")}.`, `${last.transactions.toLocaleString("en-US")} transactions in the latest month; gross yield ${last.rentalYield.toFixed(1)}%.`];
    signals.push({ key: `price:${region}:${last.month}`, kind: "price_movement", severity: Math.abs(change) >= cfg.priceMovementPct * 1.5 ? "HIGH" : "MEDIUM", subject: region, facts: [...facts, `${byClient.size} clients hold ${exposed.length} assets in ${region}.`], clientName: null, clientId: null, propertyId: null, audience: "analyst", metrics: [{ label: "Change", value: pct(change) }, { label: "Median", value: `AED ${Math.round(last.medianPriceSqft).toLocaleString("en-US")}` }, { label: "Exposed clients", value: String(byClient.size) }] });
    for (const [clientId, hs] of byClient) {
      const value = hs.reduce((a, h) => a + h.currentValueAed, 0);
      signals.push({ key: `price:${region}:${last.month}:${clientId}`, kind: "price_movement", severity: "MEDIUM", subject: region, facts: [...facts, `${clientName.get(clientId)} holds ${hs.length} ${hs.length === 1 ? "asset" : "assets"} there, valued at ${aed(value)}.`], clientName: clientName.get(clientId) ?? null, clientId, propertyId: hs[0]!.propertyId, audience: clientAudience, metrics: [{ label: "Region change", value: pct(change) }, { label: "Your exposure", value: aed(value) }] });
    }
  }

  // 2. Developer distress: risk score at or above threshold with client exposure or live catalogue.
  for (const d of developers) {
    if (d.riskScore < cfg.developerDistressScore) continue;
    const devProps = properties.filter((p) => p.developerId === d.id);
    const exposed = holdings.filter((h) => devProps.some((p) => p.id === h.propertyId));
    const offPlan = devProps.filter((p) => p.status !== "ready").length;
    const facts = [`${d.name} risk score ${d.riskScore.toFixed(1)} of 100 (threshold ${cfg.developerDistressScore}).`, `${d.deliveryPct.toFixed(0)}% of projects delivered on time; ${d.litigationCount} litigation matters.`, `${offPlan} of its ${devProps.length} catalogued projects are not yet complete.`];
    signals.push({ key: `developer:${d.id}`, kind: "developer_distress", severity: d.riskScore >= cfg.developerDistressScore + 15 ? "HIGH" : "MEDIUM", subject: d.name, facts: [...facts, `${exposed.length} client holdings are exposed.`], clientName: null, clientId: null, propertyId: null, audience: "analyst", metrics: [{ label: "Risk score", value: d.riskScore.toFixed(1) }, { label: "On time", value: `${d.deliveryPct.toFixed(0)}%` }, { label: "Exposed holdings", value: String(exposed.length) }] });
    for (const h of exposed) {
      const p = prop.get(h.propertyId)!;
      signals.push({ key: `developer:${d.id}:${h.id}`, kind: "developer_distress", severity: p.status === "ready" ? "LOW" : "HIGH", subject: d.name, facts: [...facts, `${clientName.get(h.clientId)} holds ${h.unitLabel} at ${p.name} (${p.status === "ready" ? "completed" : "not yet handed over"}).`], clientName: clientName.get(h.clientId) ?? null, clientId: h.clientId, propertyId: p.id, audience: p.status === "ready" ? "analyst" : clientAudience, metrics: [{ label: "Developer risk", value: d.riskScore.toFixed(1) }, { label: "Holding", value: h.unitLabel }] });
    }
  }

  // 3. Undervalued opportunities: asking price per sq ft below the community's transaction median.
  const commMedian = new Map<string, number>();
  const byComm = new Map<string, number[]>();
  for (const t of txs) byComm.set(t.community, [...(byComm.get(t.community) ?? []), t.psf]);
  for (const [c, xs] of byComm) {
    const v = [...xs].sort((a, b) => a - b);
    commMedian.set(c, v[Math.floor(v.length / 2)]!);
  }
  for (const p of properties) {
    const med = commMedian.get(p.community);
    if (!med) continue;
    const discount = (1 - p.pricePerSqft / med) * 100;
    if (discount < cfg.undervaluedDiscountPct) continue;
    const fits = clients.filter((c) => c.policy.markets.includes(p.market));
    signals.push({ key: `undervalued:${p.id}`, kind: "undervalued", severity: discount >= cfg.undervaluedDiscountPct * 1.5 ? "HIGH" : "MEDIUM", subject: p.name, facts: [`${p.name} (${p.community}) is offered at ${p.currency} ${Math.round(p.pricePerSqft).toLocaleString("en-US")} per sq ft, ${discount.toFixed(1)}% below the community transaction median of ${p.currency} ${Math.round(med).toLocaleString("en-US")}.`, `Gross yield ${p.grossYield.toFixed(1)}%; developer ${dev.get(p.developerId)?.name ?? "unknown"}.`, `${fits.length} clients' policies admit the ${p.market} market.`], clientName: null, clientId: null, propertyId: p.id, audience: "analyst", metrics: [{ label: "Discount", value: `${discount.toFixed(1)}%` }, { label: "Gross yield", value: `${p.grossYield.toFixed(1)}%` }, { label: "Eligible clients", value: String(fits.length) }] });
  }

  // 4. Exit windows: large unrealised gains where the region signal is not BUY.
  for (const h of holdings) {
    const gain = (h.currentValueAed / h.costAed - 1) * 100;
    if (gain < cfg.exitGainPct) continue;
    const p = prop.get(h.propertyId);
    if (!p) continue;
    const sig = regionSignal.get(p.region) ?? "HOLD";
    if (sig === "BUY") continue;
    signals.push({ key: `exit:${h.id}`, kind: "exit_window", severity: gain >= cfg.exitGainPct * 2 ? "HIGH" : "MEDIUM", subject: `${h.unitLabel}, ${p.name}`, facts: [`${clientName.get(h.clientId)}'s ${h.unitLabel} at ${p.name} is valued at ${aed(h.currentValueAed)}, ${gain.toFixed(1)}% above its cost of ${aed(h.costAed)}.`, `Since-acquisition IRR ${h.irr.toFixed(1)}%; net cash yield ${h.cashYield.toFixed(1)}% on cost.`, `The ${p.region} timing signal is ${sig}.`], clientName: clientName.get(h.clientId) ?? null, clientId: h.clientId, propertyId: p.id, audience: clientAudience, metrics: [{ label: "Gain", value: pct(gain) }, { label: "Value", value: aed(h.currentValueAed) }, { label: "Signal", value: sig }] });
  }
  return signals;
}

const KIND_TITLE: Record<Signal["kind"], (sg: Signal) => string> = {
  price_movement: (sg) => `${sg.subject} prices ${sg.metrics[0]?.value.startsWith("-") ? "down" : "up"} ${sg.metrics[0]?.value.replace(/^[+-]/, "")} in a year`,
  developer_distress: (sg) => `Developer risk elevated: ${sg.subject}`,
  undervalued: (sg) => `${sg.subject} priced below comparable evidence`,
  exit_window: (sg) => `Exit window on ${sg.subject}`,
};

const NEXT_STEP: Record<Signal["kind"], string> = {
  price_movement: "Review exposure against each client's policy limits and refresh valuations.",
  developer_distress: "Confirm escrow status and construction progress before the next instalment.",
  undervalued: "Open a research mandate to verify the discount before presenting it to eligible clients.",
  exit_window: "Consider whether crystallising the gain now serves the client's objectives better than holding.",
};

function replayNarrative(signals: Signal[]) {
  return { insights: signals.map((sg) => ({ key: sg.key, title: KIND_TITLE[sg.kind](sg), body: `${sg.facts.join(" ")} ${NEXT_STEP[sg.kind]}` })) };
}

/**
 * Layer 4: scans one tenant, writes new insights and refreshes open ones
 * (one per signal, by dedupe key). Dismissed insights stay dismissed.
 */
export async function scanTenant(db: DB, tenantId: string, ctx?: Partial<AgentContext>) {
  const tenant = await getTenantById(tenantId);
  const cfg = { ...DEFAULT_INSIGHT_CONFIG, ...(tenant?.configJson.insights ?? {}) };
  const signals = await detect(db, tenantId, cfg);
  const existing = await db.select({ key: s.insights.dedupeKey, status: s.insights.status }).from(s.insights).where(scope(s.insights, tenantId, ne(s.insights.kind, "follow_up")));
  const status = new Map(existing.map((e) => [e.key, e.status]));
  const fresh = signals.filter((sg) => status.get(sg.key) !== "dismissed");
  let written = 0;
  if (fresh.length) {
    const narrative = new Map<string, { title: string; body: string }>();
    for (let i = 0; i < fresh.length; i += 20) {
      const batch = fresh.slice(i, i + 20);
      const run = await runAgent({
        agent: "insight",
        action: `insight narrative (${INSIGHT_PROMPT_VERSION})`,
        model: "fast",
        system: INSIGHT_SYSTEM,
        user: payload("Write one insight per signal.", { signals: batch.map(({ key, kind, severity, subject, facts, clientName }) => ({ key, kind, severity, subject, facts, clientName })) }),
        schema: insightNarrativeOutput,
        toolName: "submit_insights",
        toolDescription: "Submit the insight titles and bodies.",
        ctx: { tenantId, actor: ctx?.actor ?? "Insight agent", signal: ctx?.signal },
        replay: () => replayNarrative(batch),
        replayMs: 300,
      });
      for (const n of run.output.insights) narrative.set(n.key, n);
    }
    for (const sg of fresh) {
      const n = narrative.get(sg.key) ?? replayNarrative([sg]).insights[0]!;
      const values = { kind: sg.kind, severity: sg.severity, audience: sg.audience, clientId: sg.clientId, propertyId: sg.propertyId, title: n.title, body: n.body, metrics: sg.metrics };
      await db
        .insert(s.insights)
        .values({ tenantId, dedupeKey: sg.key, ...values })
        .onConflictDoUpdate({ target: [s.insights.tenantId, s.insights.dedupeKey], set: values });
      written++;
    }
  }
  await db.update(s.tenants).set({ insightsStaleAt: null }).where(eq(s.tenants.id, tenantId));
  return { signals: signals.length, written };
}

/** Rescans a tenant whose data changed since the last scan (flag set by a database trigger). */
export async function refreshIfStale(db: DB, tenantId: string) {
  const [t] = await db.select({ stale: s.tenants.insightsStaleAt }).from(s.tenants).where(eq(s.tenants.id, tenantId)).limit(1);
  if (!t?.stale) return null;
  return scanTenant(db, tenantId);
}

/** Every six hours (cron): scans active and trial tenants. */
export async function scanAllTenants(db: DB) {
  const tenants = await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants).where(inArray(s.tenants.status, ["active", "trial"]));
  const results: { tenantId: string; signals: number; written: number }[] = [];
  for (const t of tenants) {
    if (t.cfg.platform) continue;
    results.push({ tenantId: t.id, ...(await scanTenant(db, t.id, { actor: "Scheduler" })) });
  }
  return results;
}

export type InsightRow = typeof s.insights.$inferSelect;

/** Feed for a user: analysts see everything open; clients see their own client-facing insights. */
export async function listInsights(db: DB, user: { tenantId: string; role: string; clientId: string | null }, opts: { limit?: number; includeDismissed?: boolean } = {}) {
  const conds = [opts.includeDismissed ? undefined : ne(s.insights.status, "dismissed")];
  if (user.role === "client") {
    conds.push(eq(s.insights.clientId, user.clientId ?? "00000000-0000-0000-0000-000000000000"), ne(s.insights.audience, "analyst"));
  }
  return db
    .select()
    .from(s.insights)
    .where(scope(s.insights, user.tenantId, ...conds))
    .orderBy(desc(s.insights.createdAt))
    .limit(opts.limit ?? 50);
}

/** Open follow-ups due for the analyst feed. */
export async function dueFollowUps(db: DB, tenantId: string) {
  return db
    .select()
    .from(s.insights)
    .where(scope(s.insights, tenantId, eq(s.insights.kind, "follow_up"), ne(s.insights.status, "dismissed"), isNotNull(s.insights.dueAt)))
    .orderBy(s.insights.dueAt)
    .limit(20);
}

