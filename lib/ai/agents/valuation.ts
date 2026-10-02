import "server-only";
import type { z } from "zod";
import type { AgentContext } from "../client";
import { VALUATION_PROMPT_VERSION, VALUATION_SYSTEM } from "../prompts/valuation_v1";
import { valuationOutput, type valuationInput } from "../schemas";
import { payload, runAgent } from "./_run";

const KEY = { "Direct comparison": "directComparison", "Income capitalisation": "incomeCapitalisation", "Discounted cash flow": "discountedCashFlow", "Monte Carlo": "monteCarlo" } as const;

/** Replay valuer: the default weights, a conclusion from the 3% band and a dispersion-based confidence. */
function replayValuation(input: z.infer<typeof valuationInput>): z.infer<typeof valuationOutput> {
  const w = input.defaultWeights;
  const weights = { directComparison: w["Direct comparison"] ?? 0, incomeCapitalisation: w["Income capitalisation"] ?? 0, discountedCashFlow: w["Discounted cash flow"] ?? 0, monteCarlo: w["Monte Carlo"] ?? 0 };
  const total = input.methods.reduce((a, m) => a + m.value * (weights[KEY[m.method as keyof typeof KEY]] ?? 0), 0) / Math.max(1e-9, Object.values(weights).reduce((a, b) => a + b, 0));
  const gap = input.property.askingPrice / total - 1;
  const values = input.methods.map((m) => m.value);
  const dispersion = Math.max(...values) / Math.min(...values) - 1;
  const comp = input.methods.find((m) => m.method === "Direct comparison");
  return {
    weights,
    conclusion: Math.abs(gap) <= 0.03 ? "In line with value" : gap > 0 ? "Above value" : "Below value",
    confidence: +Math.max(0.4, Math.min(0.85, 0.85 - dispersion * 1.5 - (comp ? 0 : 0.15))).toFixed(2),
    keyJudgements: [
      comp ? `Direct comparison leads: ${comp.basis}` : "No usable comparable transactions; income methods lead.",
      `Methods disagree by ${(dispersion * 100).toFixed(1)}% from lowest to highest.`,
      /off|construction/i.test(input.property.status) ? "Before handover, income capitalisation carries little weight." : "Let and income-producing: income capitalisation is reliable.",
    ],
    commentary: `The asking price of ${input.property.currency} ${Math.round(input.property.askingPrice).toLocaleString("en-US")} is ${Math.abs(gap * 100).toFixed(1)}% ${gap >= 0 ? "above" : "below"} the reconciled value. ${Math.abs(gap) <= 0.03 ? "It sits within the 3% band we treat as in line with value." : gap > 0 ? "Negotiate toward the reconciled value or accept a lower return." : "The discount to value supports the allocation."}`,
  };
}

/** Reconciles four computed valuations (comparison, income, DCF, Monte Carlo) into a value opinion. */
export function valuation(input: z.infer<typeof valuationInput>, ctx: AgentContext) {
  return runAgent({
    agent: "valuation",
    action: `valuation (${VALUATION_PROMPT_VERSION})`,
    model: "fast",
    system: VALUATION_SYSTEM,
    user: payload("Reconcile these valuations.", input),
    schema: valuationOutput,
    toolName: "submit_valuation",
    toolDescription: "Submit reconciliation weights and the value opinion.",
    ctx,
    replay: () => replayValuation(input),
    replayMs: 900,
  });
}

export const VALUATION_WEIGHT_KEY = KEY;
