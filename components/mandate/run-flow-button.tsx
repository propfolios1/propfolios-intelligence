"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { STAGE_LABEL, type MandateStatus } from "@/lib/data/types";
import { cn, formatUsdCost } from "@/lib/utils";

type Line = { stage: MandateStatus; state: "running" | "done" | "error"; cost?: number; ms?: number; message?: string };

/** Triggers the full agent flow and shows live per-stage progress. */
export function RunFlowButton({ mandateId }: { mandateId: string }) {
  const router = useRouter();
  const [lines, setLines] = React.useState<Line[]>([]);
  const [running, setRunning] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [summary, setSummary] = React.useState<string>();

  const upsert = (l: Line) => setLines((ls) => [...ls.filter((x) => x.stage !== l.stage), l]);

  async function run() {
    setLines([]);
    setSummary(undefined);
    setOpen(true);
    setRunning(true);
    try {
      const res = await fetch(`/api/mandates/${mandateId}/run`, { method: "POST" });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Run failed." }));
        setSummary(err.error);
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          if (!p.trim()) continue;
          const e = JSON.parse(p);
          if (e.type === "stage") upsert({ stage: e.stage, state: "running" });
          if (e.type === "stage_done") {
            upsert({ stage: e.stage, state: "done", cost: e.meta.costUsd, ms: e.meta.durationMs });
            router.refresh();
          }
          if (e.type === "error") {
            if (e.stage) upsert({ stage: e.stage, state: "error", message: e.message });
            setSummary(e.message);
          }
          if (e.type === "done") setSummary(`Complete · ${formatUsdCost(e.totalCostUsd)} · ${(e.durationMs / 1000).toFixed(0)}s`);
        }
      }
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Button onClick={run} disabled={running}>
          <Play /> {running ? "Running…" : "Run Full Flow"}
        </Button>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-ink-200 px-4 py-3">
          <div className="text-sm font-medium">Agent flow</div>
          <div className="text-xs text-ink-500">research → underwriting → DD → debate → memo → review</div>
        </div>
        <ul className="px-4 py-2">
          {lines.length === 0 && !summary && <li className="py-2 text-xs text-ink-500">Starting…</li>}
          {lines.map((l) => (
            <li key={l.stage} className="flex items-center justify-between py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    l.state === "done" ? "bg-positive" : l.state === "error" ? "bg-negative" : "animate-skeleton bg-navy-500",
                  )}
                />
                {STAGE_LABEL[l.stage]}
              </span>
              <span className="num text-xs text-ink-500">{l.state === "done" ? `${formatUsdCost(l.cost ?? 0)} · ${((l.ms ?? 0) / 1000).toFixed(0)}s` : l.state === "error" ? "failed" : "running"}</span>
            </li>
          ))}
        </ul>
        {summary && <div className="border-t border-ink-200 px-4 py-3 text-xs text-ink-600">{summary}</div>}
      </PopoverContent>
    </Popover>
  );
}
