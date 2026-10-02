"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";

interface Result {
  arbitrage?: { uaeTotalReturnPct: number; indiaTotalReturnAedPct: number; spreadPct: number; verdict: string; rationale: string };
  summary: string;
  considerations: { area: string; severity: string; detail: string }[];
  checklist?: { item: string; jurisdiction: string; status: "Required" | "Recommended" | "Not applicable"; reference: string }[];
}

/** Runs the cross-border agent on the tenant's market data for a representative NRI allocation. */
export function ArbitrageCard() {
  const [r, setR] = React.useState<Result | null>(null);
  const [busy, setBusy] = React.useState(false);
  async function run() {
    setBusy(true);
    const res = await fetch("/api/market/arbitrage");
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Arbitrage not assessed", { description: json.error });
    setR(json);
  }
  const a = r?.arbitrage;
  return (
    <div aria-live="polite" aria-busy={busy}>
      {!a ? (
        <div>
          <p className="text-small text-ink-700">Expected annual total return in AED terms for a UAE allocation against an India allocation by a UAE-resident NRI, after costs, currency and frictions.</p>
          <Button className="mt-4" variant="secondary" onClick={run} disabled={busy}>
            {busy ? "Cross-border agent working" : "Assess UAE versus India"}
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <span className="font-display text-card text-navy-900">{a.verdict}</span>
            <StatusPill tone="neutral">{`${a.spreadPct > 0 ? "+" : ""}${a.spreadPct.toFixed(1)} pts`}</StatusPill>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-small text-ink-500">UAE total return</dt>
              <dd className="num text-figure text-navy-900">{a.uaeTotalReturnPct.toFixed(1)}%</dd>
            </div>
            <div>
              <dt className="text-small text-ink-500">India, in AED</dt>
              <dd className="num text-figure text-navy-900">{a.indiaTotalReturnAedPct.toFixed(1)}%</dd>
            </div>
          </dl>
          <p className="mt-4 text-small text-ink-700">{a.rationale}</p>
          <p className="mt-3 text-small text-ink-500">{r?.summary}</p>
          {r?.checklist && r.checklist.length > 0 && (
            <details className="mt-4 border-t border-ink-200 pt-3">
              <summary className="cursor-pointer text-small font-medium text-ink-900">Regulatory checklist ({r.checklist.filter((c) => c.status === "Required").length} required)</summary>
              <ul className="mt-3 space-y-2.5">
                {r.checklist.map((c) => (
                  <li key={c.item} className="grid grid-cols-[88px_1fr] gap-3 text-small">
                    <StatusPill tone={c.status === "Required" ? "progress" : "neutral"}>{c.status === "Not applicable" ? "N/A" : c.status}</StatusPill>
                    <div className={c.status === "Not applicable" ? "text-ink-500" : "text-ink-900"}>
                      {c.item}
                      <div className="text-ink-500">
                        {c.jurisdiction} · {c.reference}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button onClick={run} className="mt-3 text-small text-ink-700 underline decoration-ink-200 underline-offset-4 hover:text-ink-900">
            Run again
          </button>
        </div>
      )}
    </div>
  );
}
