import { z } from "zod";
import { mandateContext, recommendation, riskRating } from "./common";
import { ddFinding } from "./due-diligence";
import { researchOutput } from "./research";

export const scenarioRow = z.object({ label: z.enum(["P10", "P50", "P90"]), irr: z.number(), npv: z.number(), exitValue: z.number(), equityMultiple: z.number(), cashYield: z.number() });

export const debateEvidence = z.object({
  context: mandateContext,
  research: researchOutput,
  scenarios: z.array(scenarioRow),
  findings: z.array(ddFinding),
});

export const debateCase = z.object({
  thesis: z.string(),
  points: z.array(z.object({ title: z.string(), detail: z.string(), evidence: z.string() })).min(3).max(6),
  rebuttal: z.string().describe("Strongest answer to the other side's best argument"),
  confidence: z.number().min(0).max(1),
});
export type DebateCase = z.infer<typeof debateCase>;

export const judgeDecision = z.object({
  recommendation,
  riskRating,
  rationale: z.string(),
  decisiveArguments: z.array(z.string()).min(1),
  conditions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type JudgeDecision = z.infer<typeof judgeDecision>;

export const debateOutput = z.object({ bull: debateCase, bear: debateCase, judge: judgeDecision });
export type DebateOutput = z.infer<typeof debateOutput>;
