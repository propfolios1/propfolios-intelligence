import { Check, X } from "lucide-react";
import { LiveDot } from "@/components/ui/live-dot";
import { STAGE_AGENT_LABEL, STAGE_LABEL, type MandateStage, type StageRun } from "@/lib/domain";
import { cn } from "@/lib/utils";

function duration(ms?: number) {
  if (!ms) return null;
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/**
 * Vertical pipeline timeline. Each stage shows its agent, model, duration and
 * cost; the running stage carries the live dot and streamed progress.
 */
export function Timeline({ runs, progress, compact }: { runs: StageRun[]; progress?: Record<string, number>; compact?: boolean }) {
  return (
    <ol className="relative" aria-label="Agent pipeline">
      {runs.map((r, i) => {
        const stage = r.stage as MandateStage;
        const last = i === runs.length - 1;
        return (
          <li key={r.stage} className={cn("relative grid grid-cols-[24px_1fr] gap-x-4", !last && (compact ? "pb-4" : "pb-6"))}>
            {!last && <span aria-hidden className={cn("absolute top-6 bottom-0 left-[11px] w-px", r.status === "complete" ? "bg-navy-900" : "bg-ink-200")} />}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex size-6 items-center justify-center rounded-full border text-surface",
                r.status === "complete" && "border-navy-900 bg-navy-900",
                r.status === "running" && "border-gold-500 bg-surface",
                r.status === "failed" && "border-danger bg-danger",
                r.status === "pending" && "border-hairline bg-surface",
              )}
              aria-hidden
            >
              {r.status === "complete" && <Check className="size-3.5 stroke-[2]" />}
              {r.status === "failed" && <X className="size-3.5 stroke-[2]" />}
              {r.status === "running" && <LiveDot />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className={cn("text-ui font-medium", r.status === "pending" ? "text-ink-500" : "text-ink-900")}>{STAGE_LABEL[stage] ?? r.stage}</span>
                <span className="num text-axis text-ink-500">
                  {[duration(r.durationMs), r.costUsd ? `$${r.costUsd.toFixed(3)}` : null].filter(Boolean).join(" · ")}
                </span>
              </div>
              {!compact && (
                <div className="mt-0.5 text-small text-ink-500">
                  {STAGE_AGENT_LABEL[stage] ?? r.agent}
                  {r.model && r.model !== "human" && r.model !== "system" && <span className="num"> · {r.model === "replay" ? "replay mode" : r.model}</span>}
                </div>
              )}
              {r.status === "running" && (
                <div className="mt-1 text-small text-gold-600" aria-live="polite">
                  {stage === "REVIEW" ? "Awaiting committee approval" : progress?.[r.stage] ? `Writing output, ${Math.round(progress[r.stage]! / 100) / 10}k characters` : "Working"}
                </div>
              )}
              {r.status === "failed" && <div className="mt-1 text-small text-danger">Stage failed. Re-run from this stage.</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
