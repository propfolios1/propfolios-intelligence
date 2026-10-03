"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import type { CrossValidationResult } from "@/db/schema";
import { cn } from "@/lib/utils";
import { ConfidenceMeter } from "./confidence-meter";

const REC: Record<string, string> = { PROCEED: "Proceed", PROCEED_WITH_CONDITIONS: "Proceed with conditions", DECLINE: "Decline", NO_CONSENSUS: "No consensus" };
const ROLE: Record<CrossValidationResult["role"], string> = { deep: "Deep reviewer", primary: "Primary reviewer", fast: "Fast reviewer" };

export interface CrossValidationView {
  id: string;
  agreement: "unanimous" | "majority" | "split";
  consensus: string;
  confidence: number;
  flagged: boolean;
  results: CrossValidationResult[];
  resolvedBy: string | null;
  resolution: string | null;
  createdAt: string;
}

/** Compact verdict chip: agreement and consensus. */
export function CrossValidationBadge({ agreement, consensus, flagged }: { agreement: string; consensus: string; flagged: boolean }) {
  return (
    <StatusPill tone={flagged ? "error" : "complete"} className="h-auto min-h-5 max-w-full shrink py-0.5 whitespace-normal">
      {flagged ? <ShieldAlert className="mr-1 size-3" aria-hidden /> : <ShieldCheck className="mr-1 size-3" aria-hidden />}
      {agreement === "unanimous" ? "Models agree" : agreement === "majority" ? "Models split 2:1" : "Models disagree"} · {REC[consensus] ?? consensus}
    </StatusPill>
  );
}

/** Three independent verdicts side by side; a disagreement asks a person to resolve it. */
export function CrossValidationPanel({ mandateId, cv }: { mandateId: string; cv: CrossValidationView | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState("");

  async function run() {
    setBusy(true);
    const res = await fetch(`/api/mandates/${mandateId}/cross-validate`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Cross-validation not run", { description: json.error });
    toast.success(json.flagged ? "The models disagree" : "The models agree", { description: json.flagged ? "The mandate is flagged for human review." : undefined });
    router.refresh();
  }

  async function resolve() {
    setBusy(true);
    const res = await fetch(`/api/mandates/${mandateId}/cross-validate`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ resolution: note }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Not resolved", { description: json.error });
    toast.success("Disagreement resolved", { description: "Recorded in the audit log." });
    setNote("");
    router.refresh();
  }

  return (
    <section className="rounded-md border border-hairline bg-surface p-6 shadow-card" aria-labelledby="cv-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Layer 3 · multi-model cross-validation</div>
          <h3 id="cv-title" className="mt-1 text-card font-medium text-ink-900">
            Independent review by three models
          </h3>
          <p className="mt-1 max-w-[62ch] text-small text-ink-500">The committee decision is re-run without the debate transcript on a deep, a primary and a fast model. Any disagreement flags the mandate for a person to decide.</p>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
          {cv && <CrossValidationBadge agreement={cv.agreement} consensus={cv.consensus} flagged={cv.flagged && !cv.resolvedBy} />}
          <Button variant="secondary" size="sm" onClick={run} disabled={busy}>
            {cv ? "Run again" : "Run cross-validation"}
          </Button>
        </div>
      </div>
      {cv ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {cv.results.map((r) => (
              <div key={r.role} className={cn("rounded-sm border p-4", r.recommendation === cv.consensus ? "border-hairline" : "border-danger/40 bg-danger-soft/40")}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-axis uppercase tracking-[0.12em] text-ink-500">{ROLE[r.role]}</span>
                  <span className="num truncate text-axis text-ink-500" title={r.model}>
                    {r.model}
                  </span>
                </div>
                <div className="mt-2 text-ui font-medium text-ink-900">{REC[r.recommendation]}</div>
                <ConfidenceMeter value={r.confidence} className="mt-2" />
                <dl className="mt-3 space-y-1 text-small">
                  <div className="flex justify-between">
                    <dt className="text-ink-500">P50 IRR relied on</dt>
                    <dd className="num text-ink-900">{r.p50IrrPct.toFixed(1)}%</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-ink-500">Key risk</dt>
                    <dd className="text-right text-ink-900">{r.keyRisk}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-small text-ink-700">{r.rationale}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-small text-ink-500">
            <ConfidenceMeter value={cv.confidence} label="Panel confidence" />
            <span>
              Cost <span className="num">${cv.results.reduce((a, r) => a + r.costUsd, 0).toFixed(3)}</span>
            </span>
          </div>
          {cv.flagged && !cv.resolvedBy && (
            <div className="mt-6 border-t border-hairline pt-5">
              <label htmlFor="cv-note" className="text-ui font-medium text-ink-900">
                Resolve the disagreement
              </label>
              <p className="mt-1 text-small text-ink-500">State which view the committee adopts and why. This clears the review flag.</p>
              <Textarea id="cv-note" className="mt-3" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The committee adopts the conditional view: the HIGH concentration finding is addressed by selling the Marina unit within six months." />
              <div className="mt-3 flex justify-end">
                <Button onClick={resolve} disabled={busy || note.trim().length < 10}>
                  Record decision
                </Button>
              </div>
            </div>
          )}
          {cv.resolvedBy && (
            <p className="mt-6 border-t border-hairline pt-4 text-small text-ink-700">
              <span className="font-medium text-ink-900">Resolved by {cv.resolvedBy}.</span> {cv.resolution}
            </p>
          )}
        </>
      ) : (
        <p className="mt-6 text-small text-ink-500">Cross-validation runs automatically after the debate.</p>
      )}
    </section>
  );
}
