"use client";

import * as React from "react";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { Tornado } from "@/components/charts/tornado";
import { ScenarioCards } from "@/components/composites/scenario-cards";
import { SeverityBadge } from "@/components/composites/status";
import { ConfidenceMeter } from "@/components/intelligence/confidence-meter";
import { MonteCarloHistogram } from "@/components/intelligence/monte-carlo-histogram";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FormField, Select } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { formatLocal } from "@/lib/domain";
import { cn } from "@/lib/utils";

interface Asset {
  slug: string;
  name: string;
  community: string;
  city: string;
  market: string;
  status: string;
  currency: string;
  priceMin: number;
  priceMax: number;
  grossYield: number;
}

type Result = {
  asset: { name: string; community: string; city: string; currency: string; status: string; developer: string };
  client: string;
  hurdlePct: number;
  research: { summary: string };
  scenarios: { label: "P10" | "P50" | "P90"; irr: number; npv: number; exitValue: number; equityMultiple: number; cashYield: number; capitalGrowth: number }[];
  distribution: { iterations: number; histogram: { bucket: string; count: number }[]; mean: number; probBelowHurdle: number };
  sensitivity: { driver: string; low: number; high: number }[];
  cashflows: { year: string; net: number; cumulative: number }[];
  valuation: { methods: { method: string; value: number }[]; reconciled: { value: number; low: number; high: number }; askingPrice: number; vsAskingPct: number; currency: string };
  findings: { id: string; severity: string; title: string; category: string }[];
  debate: { bull: { thesis: string; confidence: number }; bear: { thesis: string; confidence: number }; judge: { recommendation: string; rationale: string; confidence: number; conditions: string[] } };
  crossValidation: { role: "deep" | "primary" | "fast"; recommendation: string; confidence: number; keyRisk: string }[];
};

const REC: Record<string, string> = { PROCEED: "Proceed", PROCEED_WITH_CONDITIONS: "Proceed with conditions", DECLINE: "Decline" };
const ROLE: Record<string, string> = { deep: "Deep model", primary: "Primary model", fast: "Fast model" };
const STAGES = ["Research", "Underwriting · 10,000 paths", "Valuation", "Due diligence", "Bull and bear debate", "Cross-validation"];

/** The public demonstration: choose an asset and ticket, watch the committee pack assemble. */
export function DemoConsole({ assets }: { assets: Asset[] }) {
  const [slug, setSlug] = React.useState(assets[0]!.slug);
  const [ticket, setTicket] = React.useState<number | null>(3_500_000);
  const [hold, setHold] = React.useState(5);
  const [result, setResult] = React.useState<Result | null>(null);
  const [stage, setStage] = React.useState(-1);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setResult(null);
    setStage(0);
    const timer = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 380);
    const res = await fetch("/api/demo/underwrite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, ticketAed: ticket, holdYears: hold }) });
    const json = await res.json().catch(() => ({}));
    await new Promise((r) => setTimeout(r, Math.max(0, STAGES.length * 380 - 200)));
    clearInterval(timer);
    setStage(-1);
    if (!res.ok) return void toast.error("The demonstration could not run", { description: json.error });
    setResult(json);
  }

  const asset = assets.find((a) => a.slug === slug)!;
  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
      <form onSubmit={run} className="flex flex-col gap-5 xl:col-span-4">
        <Card>
          <CardHeader eyebrow="Your allocation" title="Create Mandate" />
          <CardContent className="grid gap-5">
            <FormField label="Asset" htmlFor="asset">
              <Select id="asset" value={slug} onChange={(e) => setSlug(e.target.value)}>
                {assets.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.name}, {a.community}
                  </option>
                ))}
              </Select>
            </FormField>
            <p className="-mt-2 text-small text-ink-500">
              {asset.city} · {asset.status.replace("_", " ")} · {asset.grossYield.toFixed(1)}% gross yield · {formatLocal(asset.priceMin, asset.currency)} to {formatLocal(asset.priceMax, asset.currency)}
            </p>
            <FormField label="Ticket (AED)" htmlFor="ticket">
              <MoneyInput id="ticket" value={ticket} onChange={setTicket} />
            </FormField>
            <FormField label="Hold period" htmlFor="hold">
              <div id="hold" className="flex gap-1" role="radiogroup">
                {[3, 5, 7, 10].map((y) => (
                  <button key={y} type="button" role="radio" aria-checked={hold === y} onClick={() => setHold(y)} className={cn("num h-9 flex-1 rounded-sm border text-ui transition-colors duration-150", hold === y ? "border-navy-900 bg-navy-900 text-surface" : "border-hairline bg-surface text-ink-700 hover:border-ink-400")}>
                    {y} years
                  </button>
                ))}
              </div>
            </FormField>
            <Button type="submit" size="lg" disabled={stage >= 0 || !ticket}>
              {stage >= 0 ? "Agents working" : "Run the committee"}
            </Button>
          </CardContent>
        </Card>
        <ol className="space-y-2" aria-live="polite">
          {STAGES.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-small">
              <span className={cn("size-1.5 rounded-full transition-colors duration-250", stage === i ? "bg-gold-500" : stage > i || result ? "bg-navy-900" : "bg-ink-200")} />
              <span className={stage === i ? "text-ink-900" : "text-ink-500"}>{s}</span>
            </li>
          ))}
        </ol>
        <p className="text-small text-ink-500">Demonstration agents run deterministically on sample data; the financial engine, Monte Carlo and valuation are the production code. Nothing you enter is stored.</p>
      </form>

      <div className="xl:col-span-8" aria-busy={stage >= 0}>
        {stage >= 0 && (
          <div className="grid gap-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
        )}
        {!result && stage < 0 && (
          <div className="flex h-full min-h-80 items-center justify-center rounded-md border border-dashed border-hairline p-10 text-center">
            <p className="max-w-[44ch] text-body text-ink-500">Choose an asset and a ticket. Twelve agents assemble the committee pack: research, three return scenarios from 10,000 simulated paths, four valuation methods, due diligence, a bull and bear debate and an independent three-model review.</p>
          </div>
        )}
        {result && (
          <div className="flex flex-col gap-6">
            <div>
              <div className="eyebrow">
                {result.asset.community}, {result.asset.city} · {result.asset.developer}
              </div>
              <h2 className="mt-2 font-display text-section text-navy-900">{result.asset.name}</h2>
              <p className="mt-2 max-w-[72ch] text-body text-ink-700">{result.research.summary}</p>
            </div>
            <Card>
              <CardHeader eyebrow="Judge" title={result.debate.judge.recommendation} actions={<ConfidenceMeter value={result.debate.judge.confidence} />} />
              <CardContent>
                <p className="text-small text-ink-700">{result.debate.judge.rationale}</p>
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="border-l-2 border-navy-900 pl-4">
                    <div className="eyebrow">Bull case</div>
                    <p className="mt-1 text-small text-ink-900">{result.debate.bull.thesis}</p>
                  </div>
                  <div className="border-l-2 border-ink-400 pl-4">
                    <div className="eyebrow">Bear case</div>
                    <p className="mt-1 text-small text-ink-900">{result.debate.bear.thesis}</p>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {result.crossValidation.map((v) => (
                    <div key={v.role} className="rounded-sm border border-hairline p-3">
                      <div className="text-axis uppercase tracking-[0.12em] text-ink-500">{ROLE[v.role]}</div>
                      <div className="mt-1 text-ui font-medium text-ink-900">{REC[v.recommendation]}</div>
                      <ConfidenceMeter value={v.confidence} className="mt-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <ScenarioCards scenarios={result.scenarios} currency={result.asset.currency} hurdlePct={result.hurdlePct} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader eyebrow="Monte Carlo" title="IRR distribution" />
                <CardContent>
                  <MonteCarloHistogram distribution={result.distribution} hurdlePct={result.hurdlePct} height={200} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader eyebrow="IRR change, percentage points" title="Sensitivity" />
                <CardContent>
                  <Tornado data={result.sensitivity} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader eyebrow="Base case" title="Cash flows" />
                <CardContent>
                  <CashFlowChart id="demo" data={result.cashflows.map((c) => ({ label: c.year, net: c.net, cumulative: c.cumulative }))} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader eyebrow={`Asking ${formatLocal(result.valuation.askingPrice, result.valuation.currency)}`} title={`Valued at ${formatLocal(result.valuation.reconciled.value, result.valuation.currency)}`} />
                <CardContent>
                  <ul className="divide-y divide-hairline border-y border-hairline">
                    {result.valuation.methods.map((m) => (
                      <li key={m.method} className="flex justify-between py-2 text-small">
                        <span className="text-ink-700">{m.method}</span>
                        <span className="num text-ink-900">{formatLocal(m.value, result.valuation.currency)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="eyebrow mt-5">Due Diligence Findings</div>
                  <ul className="mt-2 space-y-2">
                    {result.findings.map((f) => (
                      <li key={f.id} className="flex items-start gap-2 text-small">
                        <SeverityBadge severity={f.severity} />
                        <span className="text-ink-900">{f.title}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
