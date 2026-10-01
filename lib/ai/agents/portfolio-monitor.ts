import { z } from "zod";
import { defineAgent } from "../define-agent";
import { severitySchema } from "../legacy-schemas";
import { FIRM_PREAMBLE } from "./_shared";

export const portfolioMonitorAgent = defineAgent({
  name: "portfolio-monitor",
  description: "scanned portfolio for alerts",
  inputSchema: z.object({
    clientName: z.string(),
    policy: z.string().describe("Client investment policy constraints."),
    holdings: z.array(
      z.object({ property: z.string(), developer: z.string(), status: z.string(), costUsd: z.number(), valueUsd: z.number(), irr: z.number(), cashYield: z.number() }),
    ),
    events: z.array(z.string()).describe("Market and developer events since the last scan."),
  }),
  outputSchema: z.object({
    alerts: z.array(z.object({ severity: severitySchema, title: z.string(), detail: z.string(), holding: z.string().optional() })),
  }),
  effort: "medium",
  system: `${FIRM_PREAMBLE}

You are the Portfolio Monitor. Detect events and drifts that a client needs to know about: handover delays, escrow or litigation issues, valuation moves over 5%, yield compression, policy-limit breaches and concentration. Alert only on material, actionable items; one alert per issue.`,
  prompt: (i) =>
    `Client: ${i.clientName}\nPolicy: ${i.policy}\n\n<holdings>\n${JSON.stringify(i.holdings)}\n</holdings>\n\n<events>\n${i.events.map((e) => `- ${e}`).join("\n")}\n</events>\n\nProduce alerts.`,
});
