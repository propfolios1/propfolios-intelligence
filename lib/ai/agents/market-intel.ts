import { z } from "zod";
import { defineAgent } from "../define-agent";
import { FIRM_PREAMBLE } from "./_shared";

export const marketIntelAgent = defineAgent({
  name: "market-intel",
  description: "summarised market pulse",
  inputSchema: z.object({
    market: z.enum(["UAE", "India"]),
    region: z.string(),
    months: z.array(z.object({ month: z.string(), transactions: z.number(), medianPriceSqft: z.number(), offPlanShare: z.number() })),
    supply: z.array(z.object({ year: z.string(), units: z.number() })),
  }),
  outputSchema: z.object({
    headline: z.string().describe("One sentence, under 20 words."),
    signals: z.array(z.object({ label: z.string(), direction: z.enum(["up", "down", "flat"]), detail: z.string() })).min(3).max(6),
    outlook: z.string(),
    watchlist: z.array(z.string()),
  }),
  effort: "medium",
  system: `${FIRM_PREAMBLE}

You are the Market Intelligence agent. Turn raw transaction and supply series into a concise market pulse for analysts. Quantify every signal from the series provided; do not introduce numbers that are not derivable from the input.`,
  prompt: (i) =>
    `Market: ${i.region} (${i.market})\n\n<monthly_series>\n${JSON.stringify(i.months)}\n</monthly_series>\n\n<supply_pipeline>\n${JSON.stringify(i.supply)}\n</supply_pipeline>\n\nProduce the market pulse.`,
});
