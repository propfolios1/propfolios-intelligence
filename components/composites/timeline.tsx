import { Circle, CircleCheck, CircleX } from "lucide-react";
import { LiveDot } from "@/components/ui/live-dot";
import { STAGE_AGENT_LABEL, STAGE_LABEL, type MandateStage, type StageRun } from "@/lib/domain";
import { cn } from "@/lib/utils";

function duration(ms?: number) {
  if (!ms) return null;
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/**
 * Vertical pipeline: 32px steps. A 16px state icon on the left (green check
 * done, gold dot running, ink-300 circle pending, red cross failed), the
 * stage in 14px Inter, its agent or progress in ink-500, and duration and
 * cost right-aligned in 12px mono ink-400.
 */
export function Timeline({ runs, progress, compact }: { runs: StageRun[]; progress?: Record<string, number>; compact?: boolean }) {
  return (
    <ol className="divide-y divide-hairline-row" aria-label="Agent pipeline">
      {runs.map((r) => {
        const stage = r.stage as MandateStage;
        const note =
          r.status === "running"
            ? stage === "REVIEW"
              ? "Awaiting committee approval"
              : progress?.[r.stage]
                ? `Writing, ${Math.round(progress[r.stage]! / 100) / 10}k characters`
                : "Working"
            : r.status === "failed"
              ? "Failed. Re-run from this stage."
              : compact
                ? null
                : `${STAGE_AGENT_LABEL[stage] ?? r.agent}${r.model && r.model !== "human" && r.model !== "system" ? ` · ${r.model === "replay" ? "replay" : r.model}` : ""}`;
        return (
          <li key={r.stage} className="flex h-8 items-center gap-3">
            <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
              {r.status === "complete" && <CircleCheck className="size-4 stroke-[1.5] text-success" />}
              {r.status === "running" && <LiveDot />}
              {r.status === "failed" && <CircleX className="size-4 stroke-[1.5] text-danger" />}
              {r.status === "pending" && <Circle className="size-4 stroke-[1.5] text-ink-300" />}
            </span>
            <span className={cn("shrink-0 text-ui", r.status === "pending" ? "text-ink-500" : "text-ink-900")}>{STAGE_LABEL[stage] ?? r.stage}</span>
            {note && <span className={cn("min-w-0 flex-1 truncate text-meta", r.status === "running" ? "text-gold-600" : r.status === "failed" ? "text-danger" : "text-ink-500")} aria-live={r.status === "running" ? "polite" : undefined}>{note}</span>}
            <span className="num ms-auto shrink-0 text-axis text-ink-400">{[duration(r.durationMs), r.costUsd ? `$${r.costUsd.toFixed(3)}` : null].filter(Boolean).join(" · ")}</span>
          </li>
        );
      })}
    </ol>
  );
}
