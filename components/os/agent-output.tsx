import { ConfidenceMeter } from "@/components/intelligence/confidence-meter";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn, formatUsdCost } from "@/lib/utils";

export interface AgentCoreView {
  headline: string;
  points: { label: string; detail: string }[];
  confidence: number;
}

/**
 * Inline rendering of any OS agent's output: the headline in display type,
 * labelled points, confidence, and the run's provenance (agent, model, cost).
 */
export function AgentOutput({ agent, output, model, costUsd, at, className, children }: { agent: string; output: AgentCoreView; model?: string; costUsd?: number; at?: string; className?: string; children?: React.ReactNode }) {
  return (
    <section className={cn("rounded-md border border-ink-200 bg-surface shadow-card", className)} aria-label={`${agent} output`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-3">
        <div className="eyebrow">{agent}</div>
        <div className="flex flex-wrap items-center gap-4 text-small text-ink-500">
          {model && <span className="num">{model}</span>}
          {costUsd !== undefined && <span className="num">{formatUsdCost(costUsd)}</span>}
          {at && <RelativeTime iso={at} />}
        </div>
      </div>
      <div className="px-5 py-5">
        <p className="font-display text-[20px] leading-snug text-navy-900">{output.headline}</p>
        <dl className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
          {output.points.map((p, i) => (
            <div key={i} className="min-w-0">
              <dt className="text-small font-medium text-ink-900">{p.label}</dt>
              <dd className="mt-1 text-small text-ink-700">{p.detail}</dd>
            </div>
          ))}
        </dl>
        {children && <div className="mt-6">{children}</div>}
        <ConfidenceMeter value={output.confidence} className="mt-6" />
      </div>
    </section>
  );
}
