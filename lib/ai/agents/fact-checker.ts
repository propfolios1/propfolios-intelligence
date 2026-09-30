import { z } from "zod";
import { defineAgent } from "../define-agent";
import { citationSchema } from "../schemas";
import { FIRM_PREAMBLE } from "./_shared";

export const factCheckerAgent = defineAgent({
  name: "fact-checker",
  description: "fact-checked memo",
  inputSchema: z.object({
    memoHtml: z.string(),
    sourceData: z.string().describe("JSON of the research, underwriting and DD outputs the memo was built from."),
    citations: z.array(citationSchema),
  }),
  outputSchema: z.object({
    flags: z.array(
      z.object({
        claim: z.string().describe("The exact sentence or figure being flagged."),
        issue: z.enum(["unsupported", "contradicts_source", "stale", "calculation", "missing_citation"]),
        severity: z.enum(["high", "medium", "low"]),
        suggestion: z.string(),
      }),
    ),
    verifiedClaims: z.number().int(),
    summary: z.string(),
  }),
  effort: "high",
  system: `${FIRM_PREAMBLE}

You are the Fact Checker. Compare every factual and numeric claim in the memo against the source data and citations. Flag anything unsupported, contradicted, stale (older than 12 months), arithmetically wrong, or uncited. Quote the claim exactly so it can be located in the editor. Do not flag matters of opinion that are clearly framed as judgement.`,
  prompt: (i) =>
    `<memo>\n${i.memoHtml}\n</memo>\n\n<source_data>\n${i.sourceData}\n</source_data>\n\n<citations>\n${JSON.stringify(i.citations)}\n</citations>\n\nFact-check the memo.`,
});
