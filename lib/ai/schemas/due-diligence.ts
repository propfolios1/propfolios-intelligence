import { z } from "zod";
import { mandateContext, severity } from "./common";
import { researchOutput } from "./research";

export const ddInput = z.object({
  context: mandateContext,
  research: researchOutput,
  documents: z.array(z.object({ title: z.string(), excerpt: z.string() })).default([]),
});

export const ddFinding = z.object({
  id: z.string(),
  severity,
  category: z.enum(["Title", "Escrow", "Developer", "Construction", "SPA terms", "Service charges", "Regulatory", "Tax", "Valuation", "Legal"]),
  title: z.string(),
  description: z.string(),
  evidence: z.string(),
  action: z.string(),
});
export type DDFinding = z.infer<typeof ddFinding>;

export const ddOutput = z.object({ findings: z.array(ddFinding).min(4), summary: z.string() });
export type DDOutput = z.infer<typeof ddOutput>;
