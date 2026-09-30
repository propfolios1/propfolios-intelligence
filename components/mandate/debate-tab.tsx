import { Gavel, TrendingDown, TrendingUp } from "lucide-react";
import { RecommendationPill } from "@/components/status";
import type { DebateCase, JudgeDecision } from "@/lib/data/types";
import { cn } from "@/lib/utils";

function CaseColumn({ side, c }: { side: "bull" | "bear"; c: DebateCase }) {
  const bull = side === "bull";
  const Icon = bull ? TrendingUp : TrendingDown;
  return (
    <section className="rounded-card border border-ink-200 bg-surface">
      <div className={cn("h-0.5 rounded-t-card", bull ? "bg-positive" : "bg-negative")} aria-hidden />
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div className={cn("flex items-center gap-2 text-sm font-medium", bull ? "text-positive" : "text-negative")}>
            <Icon className="size-4" /> {bull ? "Bull case" : "Bear case"}
          </div>
          <span className="num text-xs text-ink-500">confidence {(c.confidence * 100).toFixed(0)}%</span>
        </div>
        <p className="mt-4 font-display text-[1.25rem] leading-[1.4] text-navy-900">{c.thesis}</p>
        <ol className="mt-6 space-y-5">
          {c.points.map((p, i) => (
            <li key={p.title} className="flex gap-4">
              <span className="num pt-0.5 text-xs text-ink-400">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="text-sm font-medium text-ink-900">{p.title}</div>
                <p className="mt-0.5 text-secondary text-ink-600">{p.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function DebateTab({ bull, bear, judge }: { bull: DebateCase; bear: DebateCase; judge: JudgeDecision }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CaseColumn side="bull" c={bull} />
        <CaseColumn side="bear" c={bear} />
      </div>
      <section className="rounded-card border border-ink-200 bg-surface p-8 md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
            <Gavel className="size-4 text-gold-600" /> Judge’s decision
          </div>
          <div className="flex items-center gap-3">
            <span className="num text-xs text-ink-500">confidence {(judge.confidence * 100).toFixed(0)}%</span>
            <RecommendationPill value={judge.recommendation} />
          </div>
        </div>
        <h3 className="mt-6 font-display text-section font-medium text-navy-900">{judge.recommendation}</h3>
        <p className="mt-4 max-w-3xl text-lead text-ink-700">{judge.rationale}</p>
        {judge.conditions.length > 0 && (
          <div className="mt-8 border-t border-ink-200 pt-6">
            <div className="eyebrow mb-3">Conditions</div>
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {judge.conditions.map((c) => (
                <li key={c} className="rounded-control bg-ink-50 px-4 py-3 text-sm text-ink-800">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
