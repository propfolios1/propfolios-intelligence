import { z } from "zod";

export const developerRiskInput = z.object({
  developer: z.object({
    name: z.string(),
    market: z.enum(["UAE", "India"]),
    deliveryPct: z.number(),
    financialHealth: z.number(),
    litigationCount: z.number(),
    projectsDelivered: z.number(),
    escrowCompliant: z.boolean(),
    listed: z.string().nullable(),
  }),
  recentNews: z.array(z.string()).default([]),
});
export const developerRiskOutput = z.object({
  riskScore: z.number().min(0).max(100),
  breakdown: z.object({ delivery: z.number(), financial: z.number(), litigation: z.number(), sentiment: z.number(), escrow: z.number() }),
  sentimentScore: z.number().min(0).max(100),
  drivers: z.array(z.object({ factor: z.string(), impact: z.number(), note: z.string() })).min(3),
  summary: z.string(),
});
export type DeveloperRiskOutput = z.infer<typeof developerRiskOutput>;

export const comparablesInput = z.object({
  subject: z.object({ name: z.string(), community: z.string(), assetClass: z.string(), pricePerSqft: z.number(), currency: z.string() }),
  /** Up to ten nearest projects by pgvector similarity of their profiles. */
  peers: z
    .array(z.object({ propertyId: z.string(), name: z.string(), community: z.string(), city: z.string(), status: z.string(), pricePerSqftAed: z.number(), grossYield: z.number(), similarity: z.number() }))
    .default([]),
  transactions: z.array(z.object({ id: z.string(), date: z.string(), community: z.string(), assetType: z.string(), bedrooms: z.number().nullable(), areaSqft: z.number(), pricePerSqft: z.number(), kind: z.string() })),
});
export const comparablesOutput = z.object({
  peers: z.array(z.object({ propertyId: z.string(), rank: z.number().int(), relevance: z.string(), adjustmentPct: z.number() })).max(10).default([]),
  selected: z.array(z.object({ id: z.string(), weight: z.number().min(0).max(1), adjustmentPct: z.number(), reason: z.string() })).min(3),
  valuePerSqft: z.object({ low: z.number(), mid: z.number(), high: z.number() }),
  premiumToCompsPct: z.number().describe("Subject asking price vs mid comparable value, percent"),
  radiusNote: z.string(),
  commentary: z.string(),
});
export type ComparablesOutput = z.infer<typeof comparablesOutput>;

export const marketTimingInput = z.object({
  region: z.string(),
  months: z.array(z.object({ month: z.string(), transactions: z.number(), medianPriceSqft: z.number(), offPlanShare: z.number(), rentalYield: z.number(), supplyUnits: z.number(), absorptionRate: z.number() })),
});
export const marketTimingOutput = z.object({
  signal: z.enum(["BUY", "HOLD", "SELL"]),
  confidence: z.number().min(0).max(1),
  indicators: z.array(z.object({ name: z.string(), reading: z.string(), direction: z.enum(["supportive", "neutral", "adverse"]) })).min(3),
  commentary: z.string(),
});
export type MarketTimingOutput = z.infer<typeof marketTimingOutput>;

export const marketYields = z.object({
  uaeGrossYieldPct: z.number(),
  uaePriceGrowthPct: z.number().describe("Trailing 12 months"),
  indiaGrossYieldPct: z.number(),
  indiaPriceGrowthPct: z.number().describe("Expected annual, from the catalogue and city indices"),
  inrDepreciationPct: z.number().describe("Expected annual INR depreciation against AED"),
});

export const crossBorderInput = z.object({
  client: z.object({ name: z.string(), nationality: z.string(), residency: z.string() }),
  markets: marketYields.optional(),
  property: z.object({ name: z.string(), market: z.enum(["UAE", "India"]), region: z.string(), priceLocal: z.number(), currency: z.string() }),
  structure: z.string().describe("Proposed holding structure"),
});
export const crossBorderOutput = z.object({
  considerations: z.array(
    z.object({
      area: z.enum(["FEMA", "Repatriation", "Tax residency", "Stamp duty", "GST", "Capital gains", "Inheritance", "UAE ownership", "Golden Visa", "Banking"]),
      severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
      detail: z.string(),
      action: z.string(),
    }),
  ),
  structuringOptions: z.array(z.object({ option: z.string(), pros: z.string(), cons: z.string() })),
  arbitrage: z
    .object({
      uaeTotalReturnPct: z.number(),
      indiaTotalReturnAedPct: z.number().describe("India total return translated to AED after expected INR depreciation and frictions"),
      spreadPct: z.number().describe("UAE minus India, percentage points"),
      verdict: z.enum(["Favour UAE", "Favour India", "Balanced"]),
      rationale: z.string(),
    })
    .optional(),
  summary: z.string(),
});
export type CrossBorderOutput = z.infer<typeof crossBorderOutput>;
