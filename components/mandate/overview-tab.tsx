import { Check, Circle, Loader } from "lucide-react";
import { RecommendationPill, RiskPill } from "@/components/status";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { MandateAnalysis, Mandate } from "@/lib/data/types";
import { STAGE_LABEL } from "@/lib/data/types";
import { cn, formatDate, formatMoney, formatUsdCost } from "@/lib/utils";

export function OverviewTab({ analysis, mandate }: { analysis: MandateAnalysis; mandate: Mandate }) {
  const totalCost = analysis.timeline.reduce((s, t) => s + (t.costUsd ?? 0), 0);
  const totalMs = analysis.timeline.reduce((s, t) => s + (t.durationMs ?? 0), 0);
  const p50 = analysis.underwriting.scenarios.find((s) => s.label === "P50")!;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <Card>
        <CardHeader
          eyebrow="State machine"
          title="Agent timeline"
          actions={
            <span className="num text-xs text-ink-500">
              {formatUsdCost(totalCost)} · {(totalMs / 60000).toFixed(1)} min
            </span>
          }
        />
        <CardBody>
          <ol className="relative">
            {analysis.timeline.map((t, i) => {
              const last = i === analysis.timeline.length - 1;
              return (
                <li key={t.stage} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && <span className={cn("absolute top-7 bottom-0 left-[13px] w-px", t.status === "complete" ? "bg-navy-300" : "bg-ink-200")} />}
                  <span
                    className={cn(
                      "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border",
                      t.status === "complete" && "border-navy-900 bg-navy-900 text-white",
                      t.status === "running" && "border-navy-500 bg-surface text-navy-700",
                      t.status === "pending" && "border-ink-200 bg-surface text-ink-300",
                    )}
                  >
                    {t.status === "complete" ? <Check className="size-3.5" /> : t.status === "running" ? <Loader className="size-3.5" /> : <Circle className="size-2.5" />}
                  </span>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-4 pt-0.5">
                    <div>
                      <div className={cn("text-sm font-medium", t.status === "pending" ? "text-ink-400" : "text-ink-900")}>{STAGE_LABEL[t.stage]}</div>
                      <div className="text-xs text-ink-500">
                        {t.agent} agent
                        {t.startedAt && <> · {formatDate(t.startedAt, "datetime")}</>}
                      </div>
                    </div>
                    <div className="num shrink-0 text-right text-xs">
                      {t.costUsd !== undefined ? (
                        <>
                          <div className="text-ink-900">{formatUsdCost(t.costUsd)}</div>
                          <div className="text-ink-500">{((t.durationMs ?? 0) / 1000).toFixed(0)}s</div>
                        </>
                      ) : (
                        <span className="text-ink-400">{t.status === "running" ? "in progress" : "—"}</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader eyebrow="Committee" title="Recommendation" />
          <CardBody>
            <div className="flex flex-wrap items-center gap-2">
              <RecommendationPill value={analysis.recommendation} />
              <RiskPill value={analysis.riskRating} />
            </div>
            <p className="mt-4 text-secondary text-ink-700">{analysis.judge.rationale}</p>
            {analysis.judge.conditions.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-ink-200 pt-4">
                {analysis.judge.conditions.map((c) => (
                  <li key={c} className="flex gap-2 text-secondary text-ink-700">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-gold-500" />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Underwriting" title="IRR scenarios" />
          <CardBody>
            <div className="grid grid-cols-3 gap-3">
              {analysis.underwriting.scenarios.map((s) => (
                <div key={s.label} className={cn("rounded-control border border-ink-200 p-3", s.label === "P50" && "bg-ink-50")}>
                  <div className="eyebrow">{s.label}</div>
                  <div className="num mt-2 text-xl text-navy-900">{s.irr.toFixed(1)}%</div>
                </div>
              ))}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-ink-500">Ticket size</dt>
              <dd className="num text-right text-ink-900">{formatMoney(mandate.ticketSize, "USD")}</dd>
              <dt className="text-ink-500">P50 exit value</dt>
              <dd className="num text-right text-ink-900">{formatMoney(p50.exitValue, "USD")}</dd>
              <dt className="text-ink-500">P50 equity multiple</dt>
              <dd className="num text-right text-ink-900">{p50.equityMultiple.toFixed(2)}×</dd>
              <dt className="text-ink-500">Hold period</dt>
              <dd className="num text-right text-ink-900">{mandate.horizonYears} yrs</dd>
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
