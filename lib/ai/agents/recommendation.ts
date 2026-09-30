import { z } from "zod";
import { defineAgent } from "../define-agent";
import { FIRM_PREAMBLE } from "./_shared";

export const recommendationAgent = defineAgent({
  name: "recommendation",
  description: "generated proactive recommendations",
  inputSchema: z.object({
    clientName: z.string(),
    policy: z.string(),
    holdings: z.array(z.object({ property: z.string(), valueUsd: z.number(), irr: z.number(), status: z.string() })),
    opportunities: z.array(z.object({ id: z.string(), name: z.string(), summary: z.string() })),
  }),
  outputSchema: z.object({
    recommendations: z
      .array(
        z.object({
          type: z.enum(["Rebalance", "New opportunity", "Exit window", "Risk", "Refinance"]),
          message: z.string().describe("One or two sentences, specific and quantified."),
          propertyId: z.string().optional().describe("Opportunity id, if the recommendation refers to one."),
          priority: z.number().int().min(1).max(5),
        }),
      )
      .max(6),
  }),
  effort: "medium",
  system: `${FIRM_PREAMBLE}

You are the Recommendations agent. Suggest the next best actions for the client's portfolio: exits into strength, rebalancing against policy limits, refinancing, and new opportunities that match the mandate. Each recommendation must be justified by the data provided.`,
  prompt: (i) =>
    `Client: ${i.clientName}\nPolicy: ${i.policy}\n\n<holdings>\n${JSON.stringify(i.holdings)}\n</holdings>\n\n<opportunities>\n${JSON.stringify(i.opportunities)}\n</opportunities>\n\nProduce recommendations.`,
});
