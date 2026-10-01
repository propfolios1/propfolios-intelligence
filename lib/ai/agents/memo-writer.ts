import { z } from "zod";
import { defineAgent } from "../define-agent";
import { ddFindingSchema, debateCaseSchema, judgeSchema, mandateContextSchema, researchDossierSchema, underwritingSchema } from "../legacy-schemas";
import { FIRM_PREAMBLE, describeMandate } from "./_shared";

export const memoWriterAgent = defineAgent({
  name: "memo-writer",
  description: "drafted investment memo",
  inputSchema: z.object({
    context: mandateContextSchema,
    research: researchDossierSchema,
    underwriting: underwritingSchema,
    findings: z.array(ddFindingSchema),
    bull: debateCaseSchema,
    bear: debateCaseSchema,
    judge: judgeSchema,
  }),
  outputSchema: z.object({
    title: z.string(),
    html: z
      .string()
      .describe("Memo body as semantic HTML using only h2, h3, p, ul, ol, li, strong, em, blockquote. No inline styles."),
    keyMetrics: z.array(z.object({ label: z.string(), value: z.string() })),
  }),
  effort: "high",
  maxTokens: 48_000,
  system: `${FIRM_PREAMBLE}

You are the Memo Writer. Draft a client-ready investment memo with sections: Recommendation, Investment Thesis, The Asset, Market, Developer, Returns (P10/P50/P90), Key Risks & Mitigants, Due Diligence Summary, Conditions, and Next Steps.

Lead with the recommendation. Write in calm, confident prose; use lists only for conditions and risks. Every figure must come from the inputs. Keep citation markers [n] from the research dossier where claims rely on them.`,
  prompt: (i) =>
    `${describeMandate(i.context)}\n\n<inputs>\n${JSON.stringify({
      research: i.research,
      underwriting: i.underwriting,
      findings: i.findings,
      bull: i.bull,
      bear: i.bear,
      judge: i.judge,
    })}\n</inputs>\n\nDraft the memo.`,
});
