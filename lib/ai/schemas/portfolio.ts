import { z } from "zod";
import { severity } from "./common";

export const holdingFacts = z.object({
  holdingId: z.string(),
  property: z.string(),
  community: z.string(),
  developer: z.string(),
  status: z.string(),
  costAed: z.number(),
  valueAed: z.number(),
  irr: z.number().describe("Since-acquisition IRR, percent"),
  cashYield: z.number().describe("Net cash yield on cost, percent"),
});

export const portfolioMonitorInput = z.object({
  client: z.object({ name: z.string(), policy: z.string() }),
  holdings: z.array(holdingFacts),
  events: z.array(z.string()).describe("Market and developer events since the last scan"),
});
export const portfolioMonitorOutput = z.object({
  alerts: z.array(z.object({ severity, title: z.string(), detail: z.string(), holdingId: z.string().nullable() })),
  summary: z.string(),
  digest: z.string().describe("Weekly client digest: three to five sentences, plain prose, addressed to the client"),
});
export type PortfolioMonitorOutput = z.infer<typeof portfolioMonitorOutput>;

export const recommenderInput = z.object({
  client: z.object({ name: z.string(), policy: z.string(), residency: z.string() }),
  holdings: z.array(holdingFacts),
  opportunities: z.array(z.object({ propertyId: z.string(), name: z.string(), summary: z.string() })),
});
export const recommenderOutput = z.object({
  recommendations: z
    .array(
      z.object({
        type: z.enum(["exit_window", "new_opportunity", "rebalance", "refinance", "risk"]),
        title: z.string(),
        message: z.string(),
        rationale: z.array(z.string()).min(1),
        propertyId: z.string().nullable(),
        priority: z.number().int().min(1).max(5),
      }),
    )
    .max(6),
});
export type RecommenderOutput = z.infer<typeof recommenderOutput>;
