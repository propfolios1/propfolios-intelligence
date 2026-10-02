import { z } from "zod";

/* ---------------------------------------------------------------- valuation */

export const valuationInput = z.object({
  property: z.object({ name: z.string(), community: z.string(), status: z.string(), currency: z.string(), askingPrice: z.number(), askPerSqft: z.number() }),
  methods: z.array(z.object({ method: z.string(), value: z.number(), low: z.number(), high: z.number(), basis: z.string() })).min(2),
  defaultWeights: z.record(z.string(), z.number()),
  context: z.string().describe("Research and market context in brief"),
});

export const valuationOutput = z.object({
  weights: z
    .object({
      directComparison: z.number().min(0).max(1),
      incomeCapitalisation: z.number().min(0).max(1),
      discountedCashFlow: z.number().min(0).max(1),
      monteCarlo: z.number().min(0).max(1),
    })
    .describe("Reconciliation weights; they are normalised to sum to 1"),
  conclusion: z.enum(["Below value", "In line with value", "Above value"]),
  confidence: z.number().min(0).max(1),
  keyJudgements: z.array(z.string()).min(2).max(5),
  commentary: z.string(),
});

/* --------------------------------------------------------- cross-validation */

export const crossValidationInput = z.object({
  mandate: z.string(),
  objective: z.string(),
  hurdlePct: z.number(),
  scenarios: z.array(z.object({ label: z.string(), irr: z.number(), npv: z.number() })),
  probBelowHurdle: z.number(),
  findings: z.array(z.object({ severity: z.string(), title: z.string() })),
  researchSummary: z.string(),
  valuation: z.string().nullable(),
});

export const crossValidationOutput = z.object({
  recommendation: z.enum(["PROCEED", "PROCEED_WITH_CONDITIONS", "DECLINE"]),
  confidence: z.number().min(0).max(1),
  p50IrrPct: z.number().describe("The P50 IRR you rely on, percent, from the scenarios provided"),
  keyRisk: z.string(),
  rationale: z.string(),
});

/* ------------------------------------------------------------------ actions */

export const actionKind = z.enum(["rent_reminder", "send_memo", "schedule_follow_up", "send_dd_to_lender", "update_crm", "esign_envelope", "escalate"]);

export const actionPlanInput = z.object({
  mandate: z.object({ reference: z.string(), title: z.string(), status: z.string(), objective: z.string(), recommendation: z.string().nullable(), requiresReview: z.boolean() }),
  client: z.object({ name: z.string(), kycStatus: z.string() }),
  memo: z.object({ status: z.string(), shared: z.boolean() }).nullable(),
  findings: z.array(z.object({ severity: z.string(), category: z.string(), title: z.string() })),
  financing: z.boolean().describe("Whether the brief mentions a lender, mortgage or financing"),
  holdings: z.array(z.object({ property: z.string(), rentDueAed: z.number(), daysOverdue: z.number() })),
});

export const actionPlanOutput = z.object({
  actions: z
    .array(
      z.object({
        kind: actionKind,
        title: z.string(),
        rationale: z.string(),
        params: z.object({
          dueInDays: z.number().int().min(0).max(90).optional(),
          recipient: z.string().optional(),
          note: z.string().optional(),
        }),
      }),
    )
    .max(6),
});

/* ----------------------------------------------------------------- insights */

export const insightSignal = z.object({
  key: z.string(),
  kind: z.enum(["price_movement", "developer_distress", "undervalued", "exit_window"]),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  subject: z.string(),
  facts: z.array(z.string()),
  clientName: z.string().nullable(),
});

export const insightNarrativeInput = z.object({ signals: z.array(insightSignal).max(20) });

export const insightNarrativeOutput = z.object({
  insights: z.array(z.object({ key: z.string(), title: z.string(), body: z.string() })),
});
