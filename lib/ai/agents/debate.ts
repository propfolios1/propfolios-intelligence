import { z } from "zod";
import { defineAgent } from "../define-agent";
import { ddFindingSchema, debateCaseSchema, judgeSchema, mandateContextSchema, researchDossierSchema, underwritingSchema } from "../legacy-schemas";
import { FIRM_PREAMBLE, describeMandate } from "./_shared";

const evidenceSchema = z.object({
  context: mandateContextSchema,
  research: researchDossierSchema,
  underwriting: underwritingSchema,
  findings: z.array(ddFindingSchema),
});

function evidence(i: z.infer<typeof evidenceSchema>) {
  return `${describeMandate(i.context)}

<research_dossier>
${JSON.stringify(i.research)}
</research_dossier>

<underwriting>
${JSON.stringify(i.underwriting)}
</underwriting>

<due_diligence_findings>
${JSON.stringify(i.findings)}
</due_diligence_findings>`;
}

export const bullAgent = defineAgent({
  name: "bull",
  description: "argued bull case",
  inputSchema: evidenceSchema,
  outputSchema: debateCaseSchema,
  effort: "high",
  system: `${FIRM_PREAMBLE}

You are the Bull advocate in a structured investment debate. Make the strongest honest case FOR the investment using only the evidence provided. Anticipate the bear's best objections and address them. Confidence reflects how strongly the evidence supports your case, not advocacy zeal.`,
  prompt: (i) => `${evidence(i)}\n\nArgue the bull case.`,
});

export const bearAgent = defineAgent({
  name: "bear",
  description: "argued bear case",
  inputSchema: evidenceSchema,
  outputSchema: debateCaseSchema,
  effort: "high",
  system: `${FIRM_PREAMBLE}

You are the Bear advocate in a structured investment debate. Make the strongest honest case AGAINST the investment using only the evidence provided: downside scenarios, supply, counterparty and liquidity risk, and anything the underwriting may be too optimistic about. Confidence reflects how strongly the evidence supports your case.`,
  prompt: (i) => `${evidence(i)}\n\nArgue the bear case.`,
});

export const judgeAgent = defineAgent({
  name: "judge",
  description: "issued debate decision",
  inputSchema: evidenceSchema.extend({ bull: debateCaseSchema, bear: debateCaseSchema }),
  outputSchema: judgeSchema,
  effort: "xhigh",
  system: `${FIRM_PREAMBLE}

You are the Investment Committee judge. Weigh the bull and bear cases against the evidence and the client's stated objective. Decide Proceed, Proceed with conditions, or Decline, and give an overall risk rating. Conditions must be specific and verifiable (e.g. "payments tied to certified construction milestones"). Explain which arguments were decisive and why.`,
  prompt: (i) =>
    `${evidence(i)}\n\n<bull_case>\n${JSON.stringify(i.bull)}\n</bull_case>\n\n<bear_case>\n${JSON.stringify(i.bear)}\n</bear_case>\n\nIssue the committee decision.`,
});
