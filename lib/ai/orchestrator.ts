import "server-only";
import { getAnalysis, saveAnalysis, saveMemoHtml, setMandateStatus } from "@/lib/data/store";
import type { MandateStatus, StageRun } from "@/lib/data/types";
import {
  bearAgent,
  bullAgent,
  dueDiligenceAgent,
  factCheckerAgent,
  judgeAgent,
  memoWriterAgent,
  researchAgent,
  underwritingAgent,
} from "./agents";
import { buildMandateContext } from "./context";
import type { AgentRunMeta } from "./define-agent";

export type FlowEvent =
  | { type: "stage"; stage: MandateStatus; agent: string; status: "running" }
  | { type: "stage_done"; stage: MandateStatus; agent: string; meta: AgentRunMeta }
  | { type: "done"; totalCostUsd: number; durationMs: number }
  | { type: "error"; stage?: MandateStatus; message: string };

/**
 * Runs the full mandate state machine:
 * research → underwriting → due diligence → debate (bull ∥ bear → judge) → memo → fact-check.
 * Each stage's output is persisted as soon as it lands so the UI can render partial results.
 */
export async function runFullFlow(mandateId: string, triggeredBy: string, emit: (e: FlowEvent) => void, signal?: AbortSignal) {
  const context = buildMandateContext(mandateId);
  if (!context) throw new Error(`Unknown mandate ${mandateId}`);

  const started = Date.now();
  let total = 0;
  const timeline: StageRun[] = (getAnalysis(mandateId)?.timeline ?? []).map((t) => ({ ...t, status: "pending" as const }));
  const ctx = { mandateId, triggeredBy, signal };

  const mark = (stage: MandateStatus, agent: string, meta?: AgentRunMeta) => {
    const idx = timeline.findIndex((t) => t.stage === stage);
    const run: StageRun = meta
      ? { stage, agent, status: "complete", startedAt: new Date(Date.now() - meta.durationMs).toISOString(), durationMs: meta.durationMs, costUsd: meta.costUsd }
      : { stage, agent, status: "running", startedAt: new Date().toISOString() };
    if (idx >= 0) timeline[idx] = run;
    else timeline.push(run);
    saveAnalysis(mandateId, { timeline: [...timeline] });
    if (meta) {
      total += meta.costUsd;
      emit({ type: "stage_done", stage, agent, meta });
    } else {
      setMandateStatus(mandateId, stage);
      emit({ type: "stage", stage, agent, status: "running" });
    }
  };

  let current: MandateStatus = "research";
  try {
    mark("research", "research");
    const research = await researchAgent.runWithMeta({ context }, ctx);
    saveAnalysis(mandateId, { research: research.output });
    mark("research", "research", research.meta);

    current = "underwriting";
    mark("underwriting", "underwriting");
    const uw = await underwritingAgent.runWithMeta({ context, research: research.output }, ctx);
    saveAnalysis(mandateId, { underwriting: uw.output });
    mark("underwriting", "underwriting", uw.meta);

    current = "dd";
    mark("dd", "due-diligence");
    const dd = await dueDiligenceAgent.runWithMeta({ context, research: research.output }, ctx);
    saveAnalysis(mandateId, { dd: dd.output.findings });
    mark("dd", "due-diligence", dd.meta);

    current = "debate";
    mark("debate", "judge");
    const evidence = { context, research: research.output, underwriting: uw.output, findings: dd.output.findings };
    const [bull, bear] = await Promise.all([bullAgent.runWithMeta(evidence, ctx), bearAgent.runWithMeta(evidence, ctx)]);
    const judge = await judgeAgent.runWithMeta({ ...evidence, bull: bull.output, bear: bear.output }, ctx);
    saveAnalysis(mandateId, {
      bull: bull.output,
      bear: bear.output,
      judge: judge.output,
      recommendation: judge.output.recommendation,
      riskRating: judge.output.riskRating,
    });
    mark("debate", "judge", {
      ...judge.meta,
      costUsd: +(bull.meta.costUsd + bear.meta.costUsd + judge.meta.costUsd).toFixed(4),
      durationMs: Math.max(bull.meta.durationMs, bear.meta.durationMs) + judge.meta.durationMs,
    });

    current = "memo";
    mark("memo", "memo-writer");
    const memo = await memoWriterAgent.runWithMeta({ ...evidence, bull: bull.output, bear: bear.output, judge: judge.output }, ctx);
    saveMemoHtml(mandateId, memo.output.html);
    mark("memo", "memo-writer", memo.meta);

    current = "review";
    mark("review", "fact-checker");
    const fc = await factCheckerAgent.runWithMeta(
      { memoHtml: memo.output.html, sourceData: JSON.stringify(evidence), citations: research.output.citations },
      ctx,
    );
    mark("review", "fact-checker", fc.meta);

    emit({ type: "done", totalCostUsd: +total.toFixed(4), durationMs: Date.now() - started });
    return { factCheck: fc.output };
  } catch (err) {
    emit({ type: "error", stage: current, message: (err as Error).message });
    throw err;
  }
}
