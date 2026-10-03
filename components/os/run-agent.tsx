"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { AgentOutput, type AgentCoreView } from "./agent-output";
import { StructuredDetail } from "./structured-detail";

export interface AgentRunView {
  output: AgentCoreView & Record<string, unknown>;
  model?: string;
  costUsd?: number;
  at?: string;
}

/**
 * Runs an agent through its API route and renders the result inline. Shows
 * the last stored output (from agent memory) until a new run replaces it.
 */
export function RunAgent({ endpoint, body, agentLabel, action = "Run analysis", initial, refresh, detail = true }: { endpoint: string; body: Record<string, unknown>; agentLabel: string; action?: string; initial?: AgentRunView | null; refresh?: boolean; detail?: boolean }) {
  const router = useRouter();
  const [run, setRun] = React.useState<AgentRunView | null>(initial ?? null);
  const [busy, setBusy] = React.useState(false);
  const go = async () => {
    setBusy(true);
    const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error(`${agentLabel} did not complete`, { description: json.error });
    setRun({ output: json.output ?? json.advice, model: json.model, costUsd: json.costUsd, at: new Date().toISOString() });
    if (refresh) router.refresh();
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={go} disabled={busy} variant={run ? "secondary" : "primary"}>
          {busy ? "Running" : run ? `Run again` : action}
        </Button>
        {!run && !busy && <span className="text-small text-ink-500">Runs the {agentLabel.toLowerCase()} agent on the records above.</span>}
      </div>
      {busy && (
        <div className="rounded-md border border-hairline bg-surface p-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-4 h-6 w-3/4" />
          <Skeleton className="mt-6 h-16 w-full" />
        </div>
      )}
      {run && !busy && (
        <AgentOutput agent={agentLabel} output={run.output} model={run.model} costUsd={run.costUsd} at={run.at}>
          {detail && <StructuredDetail output={run.output} />}
        </AgentOutput>
      )}
    </div>
  );
}
