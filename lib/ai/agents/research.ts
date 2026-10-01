import { z } from "zod";
import { defineAgent } from "../define-agent";
import { mandateContextSchema, researchDossierSchema } from "../legacy-schemas";
import { FIRM_PREAMBLE, describeMandate } from "./_shared";

export const researchAgent = defineAgent({
  name: "research",
  description: "compiled research dossier",
  inputSchema: z.object({ context: mandateContextSchema, marketNotes: z.string().optional() }),
  outputSchema: researchDossierSchema,
  effort: "high",
  system: `${FIRM_PREAMBLE}

You are the Research agent. Produce the research dossier that every downstream agent (underwriting, due diligence, debate, memo) relies on.

Cover, in this order: market context, the asset, the developer, comparable transactions, and demand drivers. Cite sources inline with [n] markers that map to the citations array. Put every unverifiable but material fact into dataGaps.`,
  prompt: ({ context, marketNotes }) =>
    `${describeMandate(context)}${marketNotes ? `\n\n<market_notes>\n${marketNotes}\n</market_notes>` : ""}\n\nWrite the research dossier.`,
});
