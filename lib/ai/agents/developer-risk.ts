import { z } from "zod";
import { defineAgent } from "../define-agent";
import { FIRM_PREAMBLE } from "./_shared";

export const developerRiskAgent = defineAgent({
  name: "developer-risk",
  description: "refreshed developer risk score",
  inputSchema: z.object({
    developer: z.object({
      name: z.string(),
      market: z.enum(["UAE", "India"]),
      deliveryPct: z.number(),
      litigationCount: z.number(),
      projectsDelivered: z.number(),
      escrowCompliant: z.boolean(),
    }),
    recentNews: z.array(z.string()).default([]),
  }),
  outputSchema: z.object({
    riskScore: z.number().int().min(0).max(100).describe("0 = lowest risk, 100 = highest"),
    band: z.enum(["Low", "Moderate", "Elevated", "High"]),
    drivers: z.array(z.object({ factor: z.string(), impact: z.number().describe("Points added (+) or removed (-)"), note: z.string() })),
    summary: z.string(),
  }),
  effort: "medium",
  system: `${FIRM_PREAMBLE}

You are the Developer Risk agent. Score developer counterparty risk from 0 (lowest) to 100 (highest) using delivery record, litigation, scale, escrow compliance and recent news. Weight on-time delivery and escrow compliance most heavily. The drivers' impacts should approximately explain the final score relative to a neutral baseline of 30.`,
  prompt: ({ developer, recentNews }) =>
    `<developer>\n${JSON.stringify(developer, null, 2)}\n</developer>\n\n<recent_news>\n${recentNews.length ? recentNews.map((n) => `- ${n}`).join("\n") : "None supplied."}\n</recent_news>\n\nScore this developer.`,
});
