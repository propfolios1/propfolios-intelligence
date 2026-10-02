import { z } from "zod";
import { mandateContext } from "./common";
import { researchOutput } from "./research";

export const underwritingInput = z.object({
  context: mandateContext,
  research: researchOutput,
  federatedBaseline: z.string().nullable().optional().describe("Median assumptions from comparable completed deals across advisories (anonymised)"),
});

/** The agent sets assumptions; the financial engine computes every return figure from them. */
export const underwritingOutput = z.object({
  purchasePrice: z.number().positive().describe("Allocation in local currency"),
  paymentPlan: z
    .array(z.object({ year: z.number().int().min(0), pct: z.number().min(0).max(1) }))
    .min(1)
    .describe("Share of price paid by year offset; must sum to 1"),
  handoverYear: z.number().int().min(0).describe("0 for ready assets"),
  holdYears: z.number().int().min(1).max(15),
  grossYield: z.number().min(0).max(0.2).describe("Decimal, on purchase price"),
  rentGrowth: z.number().min(-0.1).max(0.15),
  vacancy: z.number().min(0).max(0.5),
  opexRatio: z.number().min(0).max(0.6).describe("Service charges, management and maintenance as share of gross rent"),
  capitalGrowth: z.number().min(-0.15).max(0.25).describe("Base-case annual appreciation"),
  acquisitionCostPct: z.number().min(0).max(0.15).describe("UAE: 4% DLD + 2% agency + admin. India: stamp duty + registration + GST where applicable"),
  exitCostPct: z.number().min(0).max(0.1),
  discountRate: z.number().min(0.03).max(0.2).describe("Client hurdle rate"),
  volatility: z.object({
    capitalGrowthSd: z.number().min(0).max(0.15),
    rentGrowthSd: z.number().min(0).max(0.1),
    vacancySd: z.number().min(0).max(0.2),
    delayProbability: z.number().min(0).max(1),
  }),
  rationale: z.array(z.object({ assumption: z.string(), basis: z.string() })).min(4),
});
export type UnderwritingOutput = z.infer<typeof underwritingOutput>;
