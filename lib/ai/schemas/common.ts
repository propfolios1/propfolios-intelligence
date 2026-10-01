import { z } from "zod";

export const severity = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export type Severity = z.infer<typeof severity>;

export const recommendation = z.enum(["Proceed", "Proceed with conditions", "Decline"]);
export const riskRating = z.enum(["Low", "Moderate", "Elevated", "High"]);

export const citation = z.object({
  id: z.number().int().describe("Sequential number referenced inline as [n]"),
  source: z.string().describe("Publisher, e.g. Dubai Land Department"),
  title: z.string(),
  url: z.string().describe("Full URL of the source"),
  accessed: z.string().describe("Access date, YYYY-MM-DD"),
});
export type Citation = z.infer<typeof citation>;

/** Facts about a mandate every pipeline agent receives. */
export const mandateContext = z.object({
  mandateId: z.string(),
  reference: z.string(),
  title: z.string(),
  objective: z.string(),
  brief: z.string(),
  ticketSizeAed: z.number(),
  horizonYears: z.number().int(),
  client: z.object({ name: z.string(), type: z.string(), nationality: z.string(), residency: z.string(), riskProfile: z.string() }),
  property: z.object({
    name: z.string(),
    market: z.enum(["UAE", "India"]),
    city: z.string(),
    region: z.string(),
    community: z.string(),
    assetClass: z.string(),
    status: z.string(),
    handover: z.string(),
    currency: z.string(),
    priceMin: z.number(),
    priceMax: z.number(),
    pricePerSqft: z.number(),
    units: z.number(),
    grossYield: z.number(),
    reraNumber: z.string(),
    paymentPlan: z.string().nullable(),
  }),
  developer: z.object({
    name: z.string(),
    deliveryPct: z.number(),
    financialHealth: z.number(),
    litigationCount: z.number(),
    riskScore: z.number(),
    escrowCompliant: z.boolean(),
  }),
});
export type MandateContext = z.infer<typeof mandateContext>;
