import { z } from "zod";
import { defineAgent } from "../define-agent";
import { ddFindingSchema, mandateContextSchema, researchDossierSchema } from "../legacy-schemas";
import { FIRM_PREAMBLE, describeMandate } from "./_shared";

export const dueDiligenceAgent = defineAgent({
  name: "due-diligence",
  description: "completed due diligence review",
  inputSchema: z.object({
    context: mandateContextSchema,
    research: researchDossierSchema,
    documents: z.array(z.object({ title: z.string(), excerpt: z.string() })).default([]),
  }),
  outputSchema: z.object({ findings: z.array(ddFindingSchema).min(4) }),
  effort: "high",
  system: `${FIRM_PREAMBLE}

You are the Due Diligence agent. Review title, escrow, developer litigation, construction progress, SPA terms, service charges, regulatory approvals and, for India, RERA registration and land title chain.

Each finding needs a severity (critical/high/medium/low), the evidence it rests on, and a concrete recommended action. Record clean checks as low-severity findings so the reader sees what was verified. Never mark a finding critical without specific evidence.`,
  prompt: ({ context, research, documents }) =>
    `${describeMandate(context)}\n\n<research_dossier>\n${JSON.stringify(research)}\n</research_dossier>\n\n<documents>\n${
      documents.length ? documents.map((d) => `## ${d.title}\n${d.excerpt}`).join("\n\n") : "No documents uploaded yet."
    }\n</documents>\n\nProduce the due diligence findings.`,
});
