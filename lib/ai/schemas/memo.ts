import { z } from "zod";
import { mandateContext } from "./common";
import { debateOutput, scenarioRow } from "./debate";
import { ddFinding } from "./due-diligence";
import { researchOutput } from "./research";

export const memoInput = z.object({
  context: mandateContext,
  research: researchOutput,
  scenarios: z.array(scenarioRow),
  findings: z.array(ddFinding),
  debate: debateOutput,
});

export const memoOutput = z.object({
  title: z.string(),
  html: z.string().describe("Semantic HTML: h2, h3, p, ul, ol, li, strong, em, blockquote only"),
  keyMetrics: z.array(z.object({ label: z.string(), value: z.string() })).min(4).max(8),
});
export type MemoOutput = z.infer<typeof memoOutput>;
