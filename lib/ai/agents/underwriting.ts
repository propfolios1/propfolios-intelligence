import { z } from "zod";
import { defineAgent } from "../define-agent";
import { mandateContextSchema, researchDossierSchema, underwritingSchema } from "../legacy-schemas";
import { FIRM_PREAMBLE, describeMandate } from "./_shared";

export const underwritingAgent = defineAgent({
  name: "underwriting",
  description: "underwrote P10/P50/P90 scenarios",
  inputSchema: z.object({ context: mandateContextSchema, research: researchDossierSchema }),
  outputSchema: underwritingSchema,
  effort: "xhigh",
  system: `${FIRM_PREAMBLE}

You are the Underwriting agent. Build a probabilistic underwriting for the mandate:
- Three scenarios labelled P10 (downside), P50 (base), P90 (upside), in that order.
- Annual cash flows from Y0 (acquisition, negative) to the exit year, in USD. cumulative is the running sum of net.
- For off-plan assets, no rental income before handover; model the payment plan as outflows.
- A sensitivity table of 5–7 drivers ranked by IRR impact.
- A risk radar with six axes: Developer, Market, Liquidity, Regulatory, Currency, Construction (0–10, higher is riskier).
- State every material assumption.
Keep arithmetic internally consistent: equity multiple, IRR and cash flows must reconcile.`,
  prompt: ({ context, research }) =>
    `${describeMandate(context)}\n\n<research_dossier>\n${JSON.stringify(research)}\n</research_dossier>\n\nProduce the underwriting.`,
});
