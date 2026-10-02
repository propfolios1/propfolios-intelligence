import "server-only";
import { desc, eq } from "drizzle-orm";
import type { z } from "zod";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { CrossValidationResult } from "@/db/schema";
import { scope } from "@/lib/tenant-db";
import { payload, runAgent } from "./agents/_run";
import { type AgentContext, isAiConfigured, MODELS, type ModelTier } from "./client";
import { CROSS_VALIDATION_PROMPT_VERSION, CROSS_VALIDATION_SYSTEM } from "./prompts/cross-validation_v1";
import { crossValidationOutput, type crossValidationInput } from "./schemas";

type Input = z.infer<typeof crossValidationInput>;
type Verdict = z.infer<typeof crossValidationOutput>;

const PANEL: { role: CrossValidationResult["role"]; tier: ModelTier }[] = [
  { role: "deep", tier: "deep" },
  { role: "primary", tier: "primary" },
  { role: "fast", tier: "fast" },
];

/**
 * Replay reviewers. Each applies the committee rules with its own threshold,
 * as models of different depth do: the deep reviewer wants a margin over the
 * hurdle, the fast one accepts any positive margin.
 */
function replayVerdict(input: Input, role: CrossValidationResult["role"]): Verdict {
  const p50 = input.scenarios.find((x) => x.label === "P50")?.irr ?? 0;
  const margin = p50 - input.hurdlePct;
  const critical = input.findings.filter((f) => f.severity === "CRITICAL").length;
  const high = input.findings.filter((f) => f.severity === "HIGH").length;
  const need = role === "deep" ? 0.5 : role === "primary" ? 0 : -0.25;
  const pathLimit = role === "deep" ? 0.4 : role === "primary" ? 0.45 : 0.5;
  let recommendation: Verdict["recommendation"];
  if (critical > (role === "fast" ? 1 : 0) || margin < (role === "deep" ? -0.5 : -1)) recommendation = "DECLINE";
  else if (margin >= need && high === 0 && input.probBelowHurdle <= pathLimit) recommendation = "PROCEED";
  else recommendation = "PROCEED_WITH_CONDITIONS";
  const confidence = +Math.max(0.45, Math.min(0.9, 0.62 + Math.min(Math.abs(margin), 3) * 0.06 - high * 0.04 - (role === "fast" ? 0.04 : 0))).toFixed(2);
  const keyRisk = critical ? input.findings.find((f) => f.severity === "CRITICAL")!.title : high ? input.findings.find((f) => f.severity === "HIGH")!.title : margin < 0.5 ? "Thin margin over the hurdle" : "Exit liquidity";
  return {
    recommendation,
    confidence,
    p50IrrPct: p50,
    keyRisk,
    rationale: `P50 ${p50.toFixed(1)}% against a ${input.hurdlePct.toFixed(1)}% hurdle (${margin >= 0 ? "+" : ""}${margin.toFixed(1)} points); ${Math.round(input.probBelowHurdle * 100)}% of paths below; ${critical} critical and ${high} high findings.`,
  };
}

function agreementOf(recs: Verdict["recommendation"][]) {
  const counts = recs.reduce<Record<string, number>>((a, r) => ({ ...a, [r]: (a[r] ?? 0) + 1 }), {});
  const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]!;
  const agreement: "unanimous" | "majority" | "split" = n === recs.length ? "unanimous" : n >= 2 ? "majority" : "split";
  return { agreement, consensus: agreement === "split" ? "NO_CONSENSUS" : top };
}

/**
 * Runs the same independent review on three models (deep, primary, fast).
 * Any disagreement flags the mandate for human review; the stored record
 * shows each model's verdict, confidence and cost.
 */
export async function crossValidate(db: DB, opts: { tenantId: string; mandateId: string; input: Input; ctx: AgentContext; task?: string }) {
  const live = isAiConfigured();
  const runs = await Promise.all(
    PANEL.map(async (m) => {
      const run = await runAgent({
        agent: `cross-validation:${m.role}`,
        action: `independent review (${CROSS_VALIDATION_PROMPT_VERSION})`,
        model: m.tier,
        system: CROSS_VALIDATION_SYSTEM,
        user: payload("Review this allocation independently.", opts.input),
        schema: crossValidationOutput,
        toolName: "submit_verdict",
        toolDescription: "Submit your independent verdict.",
        ctx: opts.ctx,
        replay: () => replayVerdict(opts.input, m.role),
        replayMs: 700,
      });
      const result: CrossValidationResult = { model: live ? run.model : `${MODELS[m.tier]} (replay)`, role: m.role, ...run.output, costUsd: run.costUsd, replay: run.replay };
      return { result, costUsd: run.costUsd, durationMs: run.durationMs };
    }),
  );
  const results = runs.map((r) => r.result);
  const { agreement, consensus } = agreementOf(results.map((r) => r.recommendation));
  const factor = agreement === "unanimous" ? 1 : agreement === "majority" ? 0.75 : 0.5;
  const confidence = +((results.reduce((a, r) => a + r.confidence, 0) / results.length) * factor).toFixed(2);
  const flagged = agreement !== "unanimous";
  const [row] = await db
    .insert(s.crossValidations)
    .values({ tenantId: opts.tenantId, mandateId: opts.mandateId, task: opts.task ?? "Allocation recommendation", results, agreement, consensus, confidence, flagged })
    .returning();
  if (flagged) await db.update(s.mandates).set({ requiresReview: true }).where(scope(s.mandates, opts.tenantId, eq(s.mandates.id, opts.mandateId)));
  return { row: row!, costUsd: runs.reduce((a, r) => a + r.costUsd, 0), durationMs: Math.max(...runs.map((r) => r.durationMs)) };
}

export async function latestCrossValidation(db: DB, tenantId: string, mandateId: string) {
  const [row] = await db.select().from(s.crossValidations).where(scope(s.crossValidations, tenantId, eq(s.crossValidations.mandateId, mandateId))).orderBy(desc(s.crossValidations.createdAt)).limit(1);
  return row ?? null;
}

/** Builds the reviewer input from a mandate's stored evidence. */
export function crossValidationInputFrom(args: {
  title: string;
  objective: string;
  hurdlePct: number;
  scenarios: { label: string; irr: number; npv: number }[];
  probBelowHurdle: number;
  findings: { severity: string; title: string }[];
  researchSummary: string;
  valuation: { conclusion: string; vsAskingPct: number } | null;
}): Input {
  return {
    mandate: args.title,
    objective: args.objective,
    hurdlePct: args.hurdlePct,
    scenarios: args.scenarios.map((x) => ({ label: x.label, irr: x.irr, npv: x.npv })),
    probBelowHurdle: args.probBelowHurdle,
    findings: args.findings.map((f) => ({ severity: f.severity, title: f.title })),
    researchSummary: args.researchSummary.slice(0, 1500),
    valuation: args.valuation ? `${args.valuation.conclusion}; asking price ${args.valuation.vsAskingPct >= 0 ? "+" : ""}${args.valuation.vsAskingPct}% versus reconciled value` : null,
  };
}
