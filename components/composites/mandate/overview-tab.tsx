import { ScenarioComparison } from "@/components/charts/scenario-comparison";
import { LiveDot } from "@/components/primitives/live-dot";
import type { Mandate, MandateAnalysis } from "@/lib/data/types";
import { STAGE_LABEL } from "@/lib/data/types";
import { cn, formatMoney, formatUsdCost } from "@/lib/utils";
import { RiskPill } from "../status";

/**
 * Left: the state machine as a ledger, one row per stage with agent, cost and
 * duration. Right: the committee's answer and the three IRRs on one scale.
 */
export function OverviewTab({ analysis, mandate }: { analysis: MandateAnalysis; mandate: Mandate }) {
  const done = analysis.timeline.filter((t) => t.costUsd !== undefined);
  const totalCost = done.reduce((s, t) => s + (t.costUsd ?? 0), 0);
  const totalMs = done.reduce((s, t) => s + (t.durationMs ?? 0), 0);
  const p50 = analysis.underwriting.scenarios.find((s) => s.label === "P50")!;

  return (
    <div className="grid grid-cols-1 gap-16 xl:grid-cols-12 xl:gap-6">
      <section className="xl:col-span-6">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow">State machine</h2>
          <span className="num text-small text-ink-3">
            {formatUsdCost(totalCost)} · {(totalMs / 60000).toFixed(1)} min
          </span>
        </div>
        <ol className="mt-4 border-t-2 border-ink">
          {analysis.timeline.map((t, i) => (
            <li key={t.stage} className="grid h-14 grid-cols-[32px_1fr_auto_64px] items-center gap-4 border-b border-rule">
              <span className="num text-small text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0">
                <span className={cn("flex items-center gap-2 text-ui", t.status === "pending" ? "text-ink-3" : "text-ink")}>
                  {STAGE_LABEL[t.stage]}
                  {t.status === "running" && <LiveDot label="In progress" />}
                </span>
                <span className="block truncate text-small text-ink-3">{t.agent}</span>
              </span>
              <span className="num text-right text-small text-ink-2">{t.costUsd !== undefined ? formatUsdCost(t.costUsd) : t.status === "running" ? "running" : ""}</span>
              <span className="num text-right text-small text-ink-3">{t.durationMs !== undefined ? `${Math.round(t.durationMs / 1000)}s` : ""}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="xl:col-span-5 xl:col-start-8">
        <h2 className="eyebrow">Committee</h2>
        <p className="mt-6 font-display text-section text-navy">{analysis.recommendation}.</p>
        <div className="mt-4 flex gap-2">
          <RiskPill value={analysis.riskRating} />
        </div>
        <p className="mt-6 text-body text-ink-2">{analysis.judge.rationale}</p>

        <div className="mt-12">
          <h3 className="eyebrow mb-8">Levered IRR by scenario</h3>
          <ScenarioComparison scenarios={analysis.underwriting.scenarios} />
        </div>

        <dl className="mt-10 grid grid-cols-2 border-t border-rule">
          {[
            ["Ticket", formatMoney(mandate.ticketSize, "USD")],
            ["P50 exit value", formatMoney(p50.exitValue, "USD")],
            ["P50 multiple", `${p50.equityMultiple.toFixed(2)}×`],
            ["Hold", `${mandate.horizonYears} years`],
          ].map(([k, v]) => (
            <div key={k} className="border-b border-rule py-3 odd:pr-6 even:border-l even:pl-6">
              <dt className="text-small text-ink-3">{k}</dt>
              <dd className="num mt-1 text-ui text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
