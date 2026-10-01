import { z } from "zod";

/** Facts about a mandate that every pipeline agent receives. */
export const mandateContextSchema = z.object({
  mandateId: z.string(),
  client: z.object({ name: z.string(), type: z.string(), domicile: z.string() }),
  objective: z.string(),
  ticketSizeUsd: z.number(),
  horizonYears: z.number(),
  property: z.object({
    name: z.string(),
    market: z.enum(["UAE", "India"]),
    region: z.string(),
    community: z.string(),
    assetClass: z.string(),
    status: z.string(),
    handover: z.string(),
    currency: z.string(),
    priceMin: z.number(),
    priceMax: z.number(),
    units: z.number(),
    grossYield: z.number(),
  }),
  developer: z.object({
    name: z.string(),
    riskScore: z.number(),
    deliveryPct: z.number(),
    litigationCount: z.number(),
    projectsDelivered: z.number(),
    escrowCompliant: z.boolean(),
  }),
});
export type MandateContext = z.infer<typeof mandateContextSchema>;

export const severitySchema = z.enum(["critical", "high", "medium", "low"]);
export const recommendationSchema = z.enum(["Proceed", "Proceed with conditions", "Decline"]);
export const riskRatingSchema = z.enum(["Low", "Moderate", "Elevated", "High"]);

export const citationSchema = z.object({
  id: z.number().int(),
  source: z.string(),
  title: z.string(),
  url: z.string().optional(),
  date: z.string().describe("YYYY-MM or YYYY-MM-DD"),
});

export const researchDossierSchema = z.object({
  summary: z.string().describe("Two to three sentence executive summary."),
  sections: z
    .array(z.object({ heading: z.string(), body: z.string().describe("Paragraphs separated by blank lines. Cite with [n].") }))
    .min(3),
  citations: z.array(citationSchema),
  dataGaps: z.array(z.string()).describe("Material facts that could not be verified."),
});

export const scenarioSchema = z.object({
  label: z.enum(["P10", "P50", "P90"]),
  irr: z.number().describe("Levered equity IRR, percent"),
  npv: z.number().describe("NPV in USD at the mandate's hurdle rate"),
  exitValue: z.number().describe("Gross exit value, USD"),
  equityMultiple: z.number(),
  cashYield: z.number().describe("Average annual cash-on-cash yield, percent"),
});

export const underwritingSchema = z.object({
  scenarios: z.array(scenarioSchema).length(3),
  cashflows: z.array(
    z.object({ year: z.string(), inflow: z.number(), outflow: z.number(), net: z.number(), cumulative: z.number() }),
  ),
  sensitivity: z.array(
    z.object({
      driver: z.string(),
      low: z.number().describe("IRR change in percentage points under the downside case (negative)"),
      high: z.number().describe("IRR change in percentage points under the upside case"),
    }),
  ),
  risk: z.array(z.object({ axis: z.string(), score: z.number().min(0).max(10) })),
  assumptions: z.array(z.object({ label: z.string(), value: z.string() })),
});

export const ddFindingSchema = z.object({
  id: z.string(),
  severity: severitySchema,
  category: z.string(),
  title: z.string(),
  description: z.string(),
  evidence: z.string(),
  action: z.string(),
});

export const debateCaseSchema = z.object({
  thesis: z.string(),
  points: z.array(z.object({ title: z.string(), detail: z.string() })).min(3),
  confidence: z.number().min(0).max(1),
});

export const judgeSchema = z.object({
  recommendation: recommendationSchema,
  riskRating: riskRatingSchema,
  rationale: z.string(),
  conditions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
