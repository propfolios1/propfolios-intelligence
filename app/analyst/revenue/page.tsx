import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { FanChart, OutcomeHistogram, StageFunnel } from "@/components/revenue/charts";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/deals/domain";
import type { ActionKind } from "@/lib/revenue/actions";
import { revenueCockpit } from "@/lib/revenue/service";
import { cn, formatMoney } from "@/lib/utils";

export const metadata = { title: "Revenue" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<ActionKind, string> = { stalled_deal: "Stalled deal", closing: "Completion", hot_lead: "Lead", reprice: "Pricing", signature: "Signature", collect: "Collection" };
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default async function RevenuePage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const { forecast: f, queue, medianRate, typicalCommissionAed } = await revenueCockpit(db, user.tenantId);
  const [h30, h60, h90] = f.horizons;
  const stalled = f.deals.filter((d) => d.stalled);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Commission forecast"
        title="Revenue"
        subtitle={`${f.deals.length} open deals simulated ${f.simulations.toLocaleString("en-US")} times. Conversion and time to close are learned from ${f.learnedFrom} closed ${f.learnedFrom === 1 ? "deal" : "deals"}, weighted against market priors where the history is thin.`}
      />

      <section className="stat-row" aria-label="Forecast figures">
        <StatCard label="Next 90 days, median" value={formatMoney(h90!.p50)} note={`P10 ${formatMoney(h90!.p10)} · P90 ${formatMoney(h90!.p90)}`} />
        <StatCard label="Next 30 days, median" value={formatMoney(h30!.p50)} note={`60 days: ${formatMoney(h60!.p50)}`} />
        <StatCard label="Weighted pipeline" value={formatMoney(f.weightedPipeline)} note={`of ${formatMoney(f.unweightedPipeline)} if every deal closed`} />
        <StatCard label="Stalled" value={formatMoney(f.stalledAed)} note={`${stalled.length} ${stalled.length === 1 ? "deal" : "deals"} past their usual stage time`} />
      </section>

      <div className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader eyebrow="Six months" title="Commission by month" actions={<span className="text-meta text-ink-500">Band: P10 to P90 · Line: median</span>} />
          <CardContent>
            <FanChart months={f.months} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader eyebrow="All deals, open and closed" title="Stage funnel" actions={<span className="text-meta text-ink-500">Share that moved on</span>} />
          <CardContent>
            <StageFunnel rows={f.funnel} labels={STAGE_LABEL} />
          </CardContent>
        </Card>
      </div>

      <section className="mt-10" aria-labelledby="queue-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="queue-title" className="font-display text-section text-navy-900">
            Next best actions
          </h2>
          <span className="text-meta text-ink-500">Ranked by the commission each action is expected to recover or protect</span>
        </div>
        {queue.length === 0 ? (
          <p className="text-small text-ink-500">Nothing is stalled, overdue or waiting on a signature.</p>
        ) : (
          <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {queue.map((q, i) => (
              <li key={q.id}>
                <Link href={q.href} className="group grid h-full grid-cols-[28px_1fr_auto] gap-3 rounded-md border border-hairline bg-surface p-4 transition-[border-color] duration-150 hover:border-ink-300">
                  <span className="num pt-0.5 text-axis text-ink-400">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0">
                    <span className="eyebrow">
                      {KIND_LABEL[q.kind]}
                      {q.owner ? ` · ${q.owner}` : ""}
                    </span>
                    <span className="mt-1 block text-small font-medium text-ink-900">{q.title}</span>
                    <span className="mt-1 block text-meta text-ink-500">{q.reason}</span>
                  </span>
                  <span className="text-right">
                    <span className="num block text-small text-ink-900">{formatMoney(q.evAed)}</span>
                    <span className="num block text-axis text-ink-400">of {formatMoney(q.atStakeAed)}</span>
                    <ArrowUpRight className="ms-auto mt-1 size-3.5 text-ink-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-10" aria-labelledby="deals-title">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="deals-title" className="font-display text-section text-navy-900">
            Open deals
          </h2>
          <span className="text-meta text-ink-500">Model probability blends the learned stage rate (65%) with the owner&apos;s own estimate (35%).</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-separate border-spacing-0 text-small">
            <thead>
              <tr>
                {["Deal", "Stage", "In stage", "Owner's view", "Model", "Expected close", "Commission", "Expected value"].map((h, i) => (
                  <th key={h} className={cn("eyebrow h-10 border-b border-hairline px-3 font-medium first:ps-0", i >= 3 ? "text-right" : "text-left")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {f.deals.map((d) => (
                <tr key={d.id} className="transition-colors duration-150 hover:bg-ink-50">
                  <td className="border-b border-hairline-row py-2.5 pe-3">
                    <Link href={d.href} className="num text-ink-900 hover:underline">
                      {d.reference}
                    </Link>
                    <div className="max-w-[300px] truncate text-meta text-ink-500">{d.title}</div>
                  </td>
                  <td className="border-b border-hairline-row px-3">{STAGE_LABEL[d.stage]}</td>
                  <td className="border-b border-hairline-row px-3">
                    <span className="num">{d.daysInStage}d</span> {d.stalled && <StatusPill tone="error">Stalled</StatusPill>}
                  </td>
                  <td className="num border-b border-hairline-row px-3 text-right text-ink-500">{d.stated === null ? "–" : pct(d.stated)}</td>
                  <td className="num border-b border-hairline-row px-3 text-right text-ink-900">{pct(d.probability)}</td>
                  <td className="num border-b border-hairline-row px-3 text-right">{d.closeP50}</td>
                  <td className="num border-b border-hairline-row px-3 text-right">{formatMoney(d.commissionAed)}</td>
                  <td className="num border-b border-hairline-row ps-3 text-right text-ink-900">{formatMoney(d.expectedAed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader eyebrow="Ninety days" title="Range of outcomes" actions={<span className="num text-meta text-ink-500">Mean {formatMoney(h90!.mean)}</span>} />
          <CardContent>
            <OutcomeHistogram bins={f.histogram} p10={h90!.p10} p50={h90!.p50} p90={h90!.p90} />
            <p className="mt-3 text-meta text-ink-500">
              {pct(f.concentration)} of the 90-day expectation rests on the three largest deals.{" "}
              {f.concentration > 0.6 ? "The forecast is concentrated: one slipped completion moves it materially." : "The forecast is spread across the pipeline."}
            </p>
          </CardContent>
        </Card>
        <Card className="xl:col-span-7">
          <CardHeader eyebrow="What the model learned" title="Stage conversion and time to close" />
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-separate border-spacing-0 text-small">
                <thead>
                  <tr>
                    {["Stage", "Closed through it", "Won", "Converts", "Days to close", "Usual dwell"].map((h, i) => (
                      <th key={h} className={cn("eyebrow h-9 border-b border-hairline px-2 font-medium first:ps-0", i ? "text-right" : "text-left")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {f.stages.map((m) => (
                    <tr key={m.stage}>
                      <td className="border-b border-hairline-row py-2 pe-2">{STAGE_LABEL[m.stage]}</td>
                      <td className="num border-b border-hairline-row px-2 text-right">{m.n}</td>
                      <td className="num border-b border-hairline-row px-2 text-right">{m.won}</td>
                      <td className="num border-b border-hairline-row px-2 text-right text-ink-900">{pct(m.win)}</td>
                      <td className="num border-b border-hairline-row px-2 text-right">{Math.round(m.medianDays)}</td>
                      <td className="num border-b border-hairline-row ps-2 text-right">up to {Math.round(m.dwellP75)}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-meta text-ink-500">
              {f.brier === null
                ? "Calibration is reported once five deals have closed."
                : `Calibration on the firm's own closed deals, leave-one-out: Brier score ${f.brier.toFixed(3)} (0 is perfect, 0.25 is a coin toss).`}{" "}
              Commission on deals without a computed commission uses the firm&apos;s median rate of {(medianRate * 100).toFixed(2)}%; a typical closed commission is {formatMoney(typicalCommissionAed)}.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
