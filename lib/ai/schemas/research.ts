import { z } from "zod";
import { citation, mandateContext, severity } from "./common";

export const researchInput = z.object({ context: mandateContext, comparablesSummary: z.string().optional(), marketSummary: z.string().optional() });

export const researchOutput = z.object({
  summary: z.string().describe("Three sentences for the investment committee."),
  sections: z
    .array(z.object({ heading: z.string(), body: z.string().describe("Paragraphs separated by blank lines. Cite with [n].") }))
    .min(4)
    .describe("Market context, asset, developer, comparables, demand drivers, regulatory context"),
  risks: z.array(z.object({ severity, title: z.string(), detail: z.string() })).min(2),
  dataGaps: z.array(z.string()).describe('Each item formatted "DATA_GAP: <field>: <why>"'),
  citations: z.array(citation).min(2),
});
export type ResearchOutput = z.infer<typeof researchOutput>;
