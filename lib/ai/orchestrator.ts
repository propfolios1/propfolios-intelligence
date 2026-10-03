import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDb, type DB } from "@/db";
import * as s from "@/db/schema";
import { debate, dueDiligence, memo, research, underwriting } from "./agents";
import { valuation as valuationAgent } from "./agents/valuation";
import { describeBaseline, federatedBaselineFor } from "@/lib/federation";
import { defaultWeights, reconcile, valuationMethods, type MethodValue } from "./tools/valuation";
import { REPLAY_MODEL } from "./agents/_run";
import { isAiConfigured, MODELS, recordAgentRun, type AgentContext } from "./client";
import { loadComparables, loadMandateBundle, loadMarketSeries, summariseComparables, summariseMarket, toMandateContext, type MandateBundle } from "./context";
import { emit } from "./events";
import { getTenantById } from "@/lib/tenant";
import { proposeActions } from "@/lib/actions";
import { learnHouseStyle } from "./house-style";
import { similarProperties } from "./similar";
import { crossValidate, crossValidationInputFrom } from "./cross-validation";
import { scope } from "@/lib/tenant-db";
import { INR_PER_AED } from "./replay";
import type { DDFinding, DebateOutput, ResearchOutput, UnderwritingOutput } from "./schemas";
import { defaultDrivers, monteCarlo, scenarioTable, sensitivity, underwrite, type UnderwritingParams } from "./tools/financial";

export type MandateStage = (typeof s.mandateStatusEnum.enumValues)[number];

export const PIPELINE: { stage: MandateStage; agent: string; label: string; automated: boolean }[] = [
  { stage: "INTAKE", agent: "intake", label: "Intake", automated: true },
  { stage: "RESEARCH", agent: "research", label: "Research", automated: true },
  { stage: "UNDERWRITING", agent: "underwriting", label: "Underwriting", automated: true },
  { stage: "DUE_DILIGENCE", agent: "due-diligence", label: "Due diligence", automated: true },
  { stage: "DEBATE", agent: "debate", label: "Debate", automated: true },
  { stage: "MEMO", agent: "memo", label: "Memo", automated: true },
  { stage: "REVIEW", agent: "review", label: "Review", automated: false },
  { stage: "DELIVERED", agent: "delivery", label: "Delivered", automated: false },
];

export const STAGE_LABEL = Object.fromEntries(PIPELINE.map((p) => [p.stage, p.label])) as Record<MandateStage, string>;
const AUTOMATED = PIPELINE.filter((p) => p.automated).map((p) => p.stage);
const nextStage = (st: MandateStage) => PIPELINE[PIPELINE.findIndex((p) => p.stage === st) + 1]?.stage ?? st;

/** A stale lock (crashed function) is reclaimable after this long. */
const LOCK_TTL_MS = 6 * 60_000;
/** Do not start a stage with less than this left in the invocation budget. */
const stageReserveMs = () => (isAiConfigured() ? 150_000 : 20_000);

export function initialTimeline(): s.StageRun[] {
  return PIPELINE.map((p) => ({ stage: p.stage, agent: p.agent, status: "pending" as const }));
}

function hashSeed(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/* --------------------------------------------------------------- stages */

interface StageResult {
  model: string;
  costUsd: number;
  durationMs: number;
}

type StageFn = (db: DB, b: MandateBundle, ctx: AgentContext) => Promise<StageResult>;

const intake: StageFn = async (db, b, ctx) => {
  const started = Date.now();
  const problems: string[] = [];
  if (b.mandate.brief.trim().length < 20) problems.push("Brief is too short to research.");
  if (b.mandate.ticketSizeAed <= 0) problems.push("Ticket size must be positive.");
  if (!b.client.policy.markets.includes(b.property.market)) problems.push(`Client policy does not include the ${b.property.market} market.`);
  if (problems.length) throw new Error(problems.join(" "));
  await new Promise((r) => setTimeout(r, isAiConfigured() ? 300 : 900));
  const run = { model: "system", costUsd: 0, durationMs: Date.now() - started, usage: { input_tokens: 0, output_tokens: 0 } };
  await recordAgentRun(ctx, "intake", "intake checks passed", run, { checks: ["brief", "ticket", "policy market"] });
  void db;
  return run;
};

const researchStage: StageFn = async (db, b, ctx) => {
  const [comps, market, peers] = await Promise.all([loadComparables(db, b), loadMarketSeries(db, b.mandate.tenantId, b.property.region), similarProperties(db, b.mandate.tenantId, b.property.id, 10)]);
  const peerNote = peers.length ? ` Nearest projects by profile similarity: ${peers.slice(0, 5).map((p) => `${p.name} (${p.community}, ${p.currency} ${Math.round(p.pricePerSqft).toLocaleString("en-US")} per sq ft, ${p.grossYield.toFixed(1)}% gross)`).join("; ")}.` : "";
  const run = await research({ context: toMandateContext(b), comparablesSummary: summariseComparables(comps, b.property.currency) + peerNote, marketSummary: summariseMarket(market) }, ctx);
  await db.update(s.mandates).set({ research: run.output }).where(eq(s.mandates.id, b.mandate.id));
  return run;
};

function riskRadar(b: MandateBundle) {
  const clamp = (v: number) => Math.max(1, Math.min(10, Math.round(v)));
  const offPlan = b.property.status !== "ready";
  const india = b.property.market === "India";
  const nri = /indian/i.test(b.client.nationality) && !/india/i.test(b.client.residency);
  return [
    { axis: "Developer", score: clamp(b.developer.riskScore / 5) },
    { axis: "Market", score: india ? 5 : 4 },
    { axis: "Liquidity", score: clamp((offPlan ? 5 : 2) + (india ? 1 : 0)) },
    { axis: "Regulatory", score: india ? (nri ? 4 : 3) : 2 },
    { axis: "Construction", score: offPlan ? clamp(1 + (100 - b.developer.deliveryPct) / 4) : 1 },
  ];
}

export function simulate(assumptions: UnderwritingOutput, seed: number) {
  const { volatility, ...rest } = assumptions;
  const base: UnderwritingParams = {
    purchasePrice: rest.purchasePrice,
    paymentPlan: rest.paymentPlan,
    handoverYear: rest.handoverYear,
    holdYears: rest.holdYears,
    grossYield: rest.grossYield,
    rentGrowth: rest.rentGrowth,
    vacancy: rest.vacancy,
    opexRatio: rest.opexRatio,
    capitalGrowth: rest.capitalGrowth,
    acquisitionCostPct: rest.acquisitionCostPct,
    exitCostPct: rest.exitCostPct,
    discountRate: rest.discountRate,
  };
  const dist = monteCarlo(base, { iterations: 10_000, seed, ...volatility });
  return { base, dist, scenarios: scenarioTable(base, dist), sens: sensitivity(base, defaultDrivers(base)), baseCase: underwrite(base) };
}

const underwritingStage: StageFn = async (db, b, ctx) => {
  const researchOut = b.mandate.research as ResearchOutput | null;
  if (!researchOut) throw new Error("Research dossier missing; re-run research.");
  const baseline = await federatedBaselineFor(db, b.property).catch(() => null);
  const run = await underwriting({ context: toMandateContext(b), research: researchOut, federatedBaseline: describeBaseline(baseline) }, ctx);
  const sim = simulate(run.output, hashSeed(b.mandate.id));
  const top = sim.sens[0];
  const p50 = sim.scenarios.find((x) => x.label === "P50")!;
  const values = {
    assumptions: { ...sim.base, rationale: run.output.rationale, volatility: run.output.volatility },
    scenarios: sim.scenarios,
    cashflows: sim.baseCase.cashflows,
    sensitivity: sim.sens,
    risk: riskRadar(b),
    distribution: sim.dist,
    commentary: `P50 IRR of ${p50.irr.toFixed(1)}% against a ${(run.output.discountRate * 100).toFixed(1)}% hurdle; ${(sim.dist.probBelowHurdle * 100).toFixed(0)}% of simulated paths fall below it.${top ? ` ${top.driver.replace(/ [±0-9].*$/, "")} is the largest driver of returns.` : ""}`,
  };
  const val = await valueAsset(db, b, sim, run.output, ctx).catch((e: Error) => {
    console.error("valuation failed", e);
    return null;
  });
  const full = { ...values, valuation: val?.valuation ?? null, baseline };
  await db.insert(s.simulations).values({ tenantId: b.mandate.tenantId, mandateId: b.mandate.id, ...full }).onConflictDoUpdate({ target: s.simulations.mandateId, set: full });
  return { model: run.model, costUsd: run.costUsd + (val?.costUsd ?? 0), durationMs: run.durationMs + (val?.durationMs ?? 0) };
};

export type StoredValuation = {
  methods: MethodValue[];
  reconciled: { value: number; low: number; high: number; weights: Record<string, number>; dispersionPct: number };
  askingPrice: number;
  vsAskingPct: number;
  currency: string;
  conclusion: string;
  confidence: number;
  keyJudgements: string[];
  commentary: string;
};

/** Four computed valuations reconciled by the valuation agent. */
async function valueAsset(db: DB, b: MandateBundle, sim: ReturnType<typeof simulate>, uw: UnderwritingOutput, ctx: AgentContext) {
  const [comps, market] = await Promise.all([loadComparables(db, b), loadMarketSeries(db, b.mandate.tenantId, b.property.region)]);
  const psf = comps.map((r) => r.pricePerSqft).sort((a, z) => a - z);
  const q = (p: number) => psf[Math.min(psf.length - 1, Math.max(0, Math.round(p * (psf.length - 1))))]!;
  const growthOf = (label: string) => (sim.scenarios.find((x) => x.label === label)?.capitalGrowth ?? uw.capitalGrowth * 100) / 100;
  const methods = valuationMethods({
    params: sim.base,
    askPerSqft: b.property.pricePerSqft,
    comps: psf.length >= 3 ? { low: q(0.25), mid: q(0.5), high: q(0.75), count: psf.length, source: `registered ${comps[0]!.source} transactions` } : null,
    marketYieldPct: market.at(-1)?.rentalYield ?? b.property.grossYield,
    scenarioGrowth: { p10: growthOf("P10"), p50: growthOf("P50"), p90: growthOf("P90") },
  });
  const offPlan = b.property.status !== "ready";
  const defaults = defaultWeights(methods, offPlan);
  const run = await valuationAgent(
    {
      property: { name: b.property.name, community: b.property.community, status: b.property.status, currency: b.property.currency, askingPrice: sim.base.purchasePrice, askPerSqft: b.property.pricePerSqft },
      methods,
      defaultWeights: defaults,
      context: `${summariseComparables(comps, b.property.currency)} ${summariseMarket(market)}`,
    },
    ctx,
  );
  const w = run.output.weights;
  const reconciled = reconcile(methods, { "Direct comparison": w.directComparison, "Income capitalisation": w.incomeCapitalisation, "Discounted cash flow": w.discountedCashFlow, "Monte Carlo": w.monteCarlo });
  const valuation: StoredValuation = {
    methods,
    reconciled,
    askingPrice: sim.base.purchasePrice,
    vsAskingPct: +((sim.base.purchasePrice / reconciled.value - 1) * 100).toFixed(1),
    currency: b.property.currency,
    conclusion: run.output.conclusion,
    confidence: run.output.confidence,
    keyJudgements: run.output.keyJudgements,
    commentary: run.output.commentary,
  };
  return { valuation, costUsd: run.costUsd, durationMs: run.durationMs };
}

const ddStage: StageFn = async (db, b, ctx) => {
  const researchOut = b.mandate.research as ResearchOutput | null;
  if (!researchOut) throw new Error("Research dossier missing; re-run research.");
  const docs = await db.select({ title: s.documents.title, content: s.documents.contentText }).from(s.documents).where(scope(s.documents, b.mandate.tenantId, eq(s.documents.mandateId, b.mandate.id))).limit(6);
  const run = await dueDiligence({ context: toMandateContext(b), research: researchOut, documents: docs.map((d) => ({ title: d.title, excerpt: d.content.slice(0, 1500) })) }, ctx);
  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
  const findings = [...run.output.findings].sort((a, z) => order[a.severity] - order[z.severity]);
  await db.update(s.mandates).set({ ddFindings: findings }).where(eq(s.mandates.id, b.mandate.id));
  return run;
};

async function loadSimulation(db: DB, tenantId: string, mandateId: string) {
  const [sim] = await db.select().from(s.simulations).where(scope(s.simulations, tenantId, eq(s.simulations.mandateId, mandateId))).limit(1);
  if (!sim) throw new Error("Simulation missing; re-run underwriting.");
  return {
    scenarios: sim.scenarios as ReturnType<typeof scenarioTable>,
    assumptions: sim.assumptions as UnderwritingParams & { rationale?: { assumption: string; basis: string }[] },
    sensitivity: sim.sensitivity as { driver: string; low: number; high: number }[],
  };
}

const debateStage: StageFn = async (db, b, ctx) => {
  const { scenarios, assumptions } = await loadSimulation(db, b.mandate.tenantId, b.mandate.id);
  const run = await debate(
    { context: toMandateContext(b), research: b.mandate.research as ResearchOutput, scenarios, findings: (b.mandate.ddFindings ?? []) as DDFinding[], hurdlePct: assumptions.discountRate * 100 },
    ctx,
  );
  const values = { bull: run.output.bull, bear: run.output.bear, judge: run.output.judge };
  await db.insert(s.debates).values({ tenantId: b.mandate.tenantId, mandateId: b.mandate.id, ...values }).onConflictDoUpdate({ target: s.debates.mandateId, set: values });
  await db.update(s.mandates).set({ recommendation: run.output.judge.recommendation, riskRating: run.output.judge.riskRating }).where(eq(s.mandates.id, b.mandate.id));
  // Layer 3: the same decision, reviewed independently by three models.
  const cv = await runCrossValidation(db, b, ctx).catch((e: Error) => {
    console.error("cross-validation failed", e);
    return null;
  });
  return { model: run.model, costUsd: run.costUsd + (cv?.costUsd ?? 0), durationMs: run.durationMs + (cv?.durationMs ?? 0) };
};

/** Runs multi-model cross-validation on a mandate's stored evidence. */
export async function runCrossValidation(db: DB, b: MandateBundle, ctx: AgentContext) {
  const [sim] = await db.select().from(s.simulations).where(scope(s.simulations, b.mandate.tenantId, eq(s.simulations.mandateId, b.mandate.id))).limit(1);
  if (!sim) throw new Error("Simulation missing; run underwriting first.");
  const research = b.mandate.research as ResearchOutput | null;
  const val = sim.valuation as StoredValuation | null;
  const input = crossValidationInputFrom({
    title: b.mandate.title,
    objective: b.mandate.objective,
    hurdlePct: (sim.assumptions as UnderwritingParams).discountRate * 100,
    scenarios: sim.scenarios as { label: string; irr: number; npv: number }[],
    probBelowHurdle: (sim.distribution as { probBelowHurdle: number }).probBelowHurdle,
    findings: (b.mandate.ddFindings ?? []) as DDFinding[],
    researchSummary: research?.summary ?? "",
    valuation: val ? { conclusion: val.conclusion, vsAskingPct: val.vsAskingPct } : null,
  });
  return crossValidate(db, { tenantId: b.mandate.tenantId, mandateId: b.mandate.id, input, ctx });
}

const memoStage: StageFn = async (db, b, ctx) => {
  const { scenarios, assumptions, sensitivity } = await loadSimulation(db, b.mandate.tenantId, b.mandate.id);
  const tenant = await getTenantById(b.mandate.tenantId);
  const cfg = tenant?.configJson;
  const [deb] = await db.select().from(s.debates).where(scope(s.debates, b.mandate.tenantId, eq(s.debates.mandateId, b.mandate.id))).limit(1);
  if (!deb) throw new Error("Debate missing; re-run the debate.");
  const debateOut = { bull: deb.bull, bear: deb.bear, judge: deb.judge } as DebateOutput;
  const learned = await learnHouseStyle(db, b.mandate.tenantId, b.mandate.id);
  const run = await memo(
    {
      context: toMandateContext(b),
      research: b.mandate.research as ResearchOutput,
      scenarios,
      findings: (b.mandate.ddFindings ?? []) as DDFinding[],
      debate: debateOut,
      allocationLocal: assumptions.purchasePrice ?? (b.property.currency === "INR" ? b.mandate.ticketSizeAed * INR_PER_AED : b.mandate.ticketSizeAed),
      houseStyle: cfg ? { brandName: cfg.brand_name, tone: cfg.memo_style.tone, signoff: cfg.memo_style.signoff, learned } : undefined,
      sensitivity,
      assumptions: assumptions.rationale,
    },
    ctx,
  );
  await db
    .insert(s.memos)
    .values({ tenantId: b.mandate.tenantId, mandateId: b.mandate.id, title: run.output.title, contentHtml: run.output.html, keyMetrics: run.output.keyMetrics, status: "in_review", lastEditedBy: "Memo agent" })
    .onConflictDoUpdate({
      target: s.memos.mandateId,
      set: { title: run.output.title, contentHtml: run.output.html, keyMetrics: run.output.keyMetrics, status: "in_review", lastEditedBy: "Memo agent", version: sql`${s.memos.version} + 1`, approvedAt: null, approvedBy: null, sharedAt: null },
    });
  // Layer 5: propose the follow-up actions for review (the mandate moves to REVIEW next).
  await proposeActions(db, b.mandate.tenantId, b.mandate.id, ctx, "REVIEW").catch((e: Error) => console.error("action proposals failed", e));
  return run;
};

const STAGE_FN: Partial<Record<MandateStage, StageFn>> = {
  INTAKE: intake,
  RESEARCH: researchStage,
  UNDERWRITING: underwritingStage,
  DUE_DILIGENCE: ddStage,
  DEBATE: debateStage,
  MEMO: memoStage,
};

/* ------------------------------------------------------------ the machine */

async function patchTimeline(db: DB, mandateId: string, stage: MandateStage, patch: Partial<s.StageRun>) {
  const [m] = await db.select({ timeline: s.mandates.timeline }).from(s.mandates).where(eq(s.mandates.id, mandateId));
  const tl = m?.timeline?.length ? m.timeline : initialTimeline();
  const next = tl.map((r) => (r.stage === stage ? { ...r, ...patch } : r));
  await db.update(s.mandates).set({ timeline: next }).where(eq(s.mandates.id, mandateId));
  return next;
}

async function acquireLock(db: DB, mandateId: string, tenantId: string) {
  const stale = new Date(Date.now() - LOCK_TTL_MS);
  const rows = await db
    .update(s.mandates)
    .set({ runningSince: new Date() })
    .where(and(eq(s.mandates.id, mandateId), eq(s.mandates.tenantId, tenantId), inArray(s.mandates.status, AUTOMATED), or(isNull(s.mandates.runningSince), lt(s.mandates.runningSince, stale))))
    .returning({ id: s.mandates.id });
  return rows.length > 0;
}

export type AdvanceResult = { ran: MandateStage[]; status: MandateStage; outcome: "review" | "paused" | "failed" | "locked" | "idle"; error?: string };

/**
 * Advances a mandate through its automated stages until it reaches REVIEW,
 * the invocation's time budget runs low (it then pauses; the client resumes
 * with another POST /run), or a stage fails. State is persisted after every
 * stage, so any instance can resume. A row-level lock (running_since)
 * prevents two invocations from running the same mandate.
 */
export async function advanceMandate(mandateId: string, opts: { tenantId: string; actor: string; budgetMs?: number; until?: MandateStage }): Promise<AdvanceResult> {
  const db = await getDb();
  const deadline = Date.now() + (opts.budgetMs ?? 270_000);
  if (!(await acquireLock(db, mandateId, opts.tenantId))) {
    const [m] = await db.select({ status: s.mandates.status }).from(s.mandates).where(eq(s.mandates.id, mandateId));
    return { ran: [], status: m?.status ?? "INTAKE", outcome: m && AUTOMATED.includes(m.status) ? "locked" : "idle" };
  }
  const ran: MandateStage[] = [];
  let status: MandateStage = "INTAKE";
  try {
    for (;;) {
      const b = await loadMandateBundle(db, mandateId, opts.tenantId);
      if (!b) throw new Error("Mandate not found.");
      status = b.mandate.status;
      const fn = STAGE_FN[status];
      if (opts.until && status === opts.until && ran.length > 0) {
        emit({ type: "paused", mandateId, nextStage: status });
        return { ran, status, outcome: "paused" };
      }
      if (!fn) {
        emit({ type: "done", mandateId, status, totalCostUsd: b.mandate.totalCostUsd });
        return { ran, status, outcome: "review" };
      }
      if (deadline - Date.now() < stageReserveMs() && ran.length > 0) {
        emit({ type: "paused", mandateId, nextStage: status });
        return { ran, status, outcome: "paused" };
      }
      const agent = PIPELINE.find((p) => p.stage === status)!.agent;
      const model = status === "INTAKE" ? "system" : isAiConfigured() ? MODELS.primary : REPLAY_MODEL;
      const startedAt = new Date().toISOString();
      await patchTimeline(db, mandateId, status, { status: "running", startedAt, completedAt: undefined, model, costUsd: undefined, durationMs: undefined });
      await db.update(s.mandates).set({ runningSince: new Date() }).where(eq(s.mandates.id, mandateId));
      emit({ type: "stage", mandateId, stage: status, agent, status: "running" });

      const stage = status;
      let lastProgress = 0;
      const ctx: AgentContext = {
        tenantId: opts.tenantId,
        mandateId,
        actor: opts.actor,
        onProgress: (chars) => {
          if (chars - lastProgress < 200) return;
          lastProgress = chars;
          emit({ type: "progress", mandateId, stage, agent, chars });
        },
      };
      try {
        const r = await fn(db, b, ctx);
        const to = nextStage(stage);
        await patchTimeline(db, mandateId, stage, { status: "complete", completedAt: new Date().toISOString(), costUsd: +r.costUsd.toFixed(4), durationMs: r.durationMs, model: r.model });
        await db
          .update(s.mandates)
          .set({ status: to, totalCostUsd: sql`${s.mandates.totalCostUsd} + ${r.costUsd}` })
          .where(eq(s.mandates.id, mandateId));
        ran.push(stage);
        emit({ type: "stage", mandateId, stage, agent, status: "complete", costUsd: r.costUsd, durationMs: r.durationMs });
        emit({ type: "status", mandateId, status: to });
        if (stage === "RESEARCH") {
          const { publish } = await import("./orchestration/event-bus");
          await publish(db, { type: "mandate.researched", tenantId: opts.tenantId, entityType: "mandate", entityId: mandateId, mandateId, clientId: b.mandate.clientId, actor: opts.actor, payload: { label: `${b.mandate.reference}: research complete`, href: `/analyst/mandates/${mandateId}?tab=research` } });
        }
        if (to === "REVIEW") await patchTimeline(db, mandateId, "REVIEW", { status: "running", startedAt: new Date().toISOString(), model: "human" });
      } catch (err) {
        const message = (err as Error).message;
        await patchTimeline(db, mandateId, stage, { status: "failed", completedAt: new Date().toISOString() });
        await db.insert(s.auditLogs).values({ tenantId: opts.tenantId, actorName: `${agent} agent`, actorType: "agent", action: "stage failed", entityType: "mandate", entityId: mandateId, mandateId, detail: { stage, error: message } });
        emit({ type: "stage", mandateId, stage, agent, status: "failed", message });
        emit({ type: "error", mandateId, stage, message });
        return { ran, status: stage, outcome: "failed", error: message };
      }
    }
  } finally {
    await db.update(s.mandates).set({ runningSince: null }).where(eq(s.mandates.id, mandateId));
  }
}

/** Resets a mandate to re-run from a stage (all later stages return to pending). */
export async function rerunFrom(mandateId: string, tenantId: string, stage: MandateStage) {
  const db = await getDb();
  const idx = PIPELINE.findIndex((p) => p.stage === stage);
  const [m] = await db.select({ timeline: s.mandates.timeline }).from(s.mandates).where(and(eq(s.mandates.id, mandateId), eq(s.mandates.tenantId, tenantId)));
  if (!m) return false;
  const tl = (m.timeline?.length ? m.timeline : initialTimeline()).map((r, i) => (i >= idx ? { stage: r.stage, agent: r.agent, status: "pending" as const } : r));
  await db.update(s.mandates).set({ status: stage, timeline: tl, runningSince: null, deliveredAt: null }).where(eq(s.mandates.id, mandateId));
  return true;
}

/** Human approval: REVIEW → DELIVERED. */
export async function markDelivered(db: DB, mandateId: string, approver: string) {
  const now = new Date().toISOString();
  await patchTimeline(db, mandateId, "REVIEW", { status: "complete", completedAt: now, model: "human" });
  await patchTimeline(db, mandateId, "DELIVERED", { status: "complete", startedAt: now, completedAt: now, model: "human" });
  const [m] = await db.update(s.mandates).set({ status: "DELIVERED", deliveredAt: new Date() }).where(eq(s.mandates.id, mandateId)).returning();
  emit({ type: "status", mandateId, status: "DELIVERED" });
  if (m) {
    const { publish } = await import("./orchestration/event-bus");
    await publish(db, { type: "mandate.approved", tenantId: m.tenantId, entityType: "mandate", entityId: mandateId, mandateId, clientId: m.clientId, actor: approver, payload: { label: `${m.reference}: memo approved and delivered`, href: `/analyst/mandates/${mandateId}/journey` } });
  }
}
