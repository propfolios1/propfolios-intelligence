import { z } from "zod";
import { defineAgent } from "../define-agent";
import { FIRM_PREAMBLE } from "./_shared";

export const memoAssistAgent = defineAgent({
  name: "memo-assist",
  description: "suggested memo edits",
  inputSchema: z.object({
    memoHtml: z.string(),
    selection: z.string().optional(),
    instruction: z.string().optional(),
  }),
  outputSchema: z.object({
    suggestions: z
      .array(
        z.object({
          kind: z.enum(["rewrite", "tighten", "add_evidence", "tone", "structure"]),
          target: z.string().describe("Exact text the suggestion applies to."),
          replacement: z.string(),
          reason: z.string(),
        }),
      )
      .max(8),
  }),
  effort: "medium",
  system: `${FIRM_PREAMBLE}

You are the Memo Editor. Suggest precise, surgical edits that improve clarity, concision and evidentiary support. Preserve every figure unless it is demonstrably wrong. Prefer fewer, higher-value suggestions.`,
  prompt: (i) =>
    `<memo>\n${i.memoHtml}\n</memo>${i.selection ? `\n\n<selection>\n${i.selection}\n</selection>` : ""}\n\n${
      i.instruction ?? "Suggest the most valuable edits."
    }`,
});
