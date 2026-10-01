"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/components/ui/live-dot";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { STAGE_LABEL, type MandateStatus } from "@/lib/data/types";
import { formatUsdCost } from "@/lib/utils";

type Line = { stage: MandateStatus; state: "running" | "done" | "error"; cost?: number; ms?: number };

/** Runs the whole agent flow and reports each stage as it lands. */
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
        const err = await res.json().catch(() => ({}));
        setSummary(res.status === 503 ? "Add ANTHROPIC_API_KEY to run agents." : (err.error ?? "Could not start the flow. Retry."));
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
            if (e.stage) upsert({ stage: e.stage, state: "error" });
            setSummary(`Stopped at ${e.stage ? STAGE_LABEL[e.stage as MandateStatus] : "start"}. ${e.message}`);
          }
          if (e.type === "done") setSummary(`Memo ready. Review and send. ${formatUsdCost(e.totalCostUsd)}, ${Math.round(e.durationMs / 1000)}s.`);
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
          {running ? "Running" : "Run full flow"}
        </Button>
      </PopoverAnchor>
      <PopoverContent align="end" className="w-[320px] p-0">
        <div className="border-b border-ink-200 px-5 py-3.5">
          <div className="eyebrow">Agent flow</div>
        </div>
        <ol className="px-5 py-2">
          {lines.length === 0 && !summary && (
            <li className="flex items-center gap-2.5 py-2 text-small text-ink-700">
              <LiveDot /> Starting research
            </li>
          )}
          {lines.map((l) => (
            <li key={l.stage} className="flex items-center justify-between py-2 text-small">
              <span className="flex items-center gap-2.5 text-ink-900">
                {l.state === "running" ? <LiveDot /> : <span className={l.state === "done" ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-danger"} />}
                {STAGE_LABEL[l.stage]}
              </span>
              <span className="num text-ink-500">{l.state === "done" ? `${formatUsdCost(l.cost ?? 0)} · ${Math.round((l.ms ?? 0) / 1000)}s` : l.state === "error" ? "stopped" : ""}</span>
            </li>
          ))}
        </ol>
        {summary && <p className="border-t border-ink-200 px-5 py-3.5 text-small text-ink-700">{summary}</p>}
      </PopoverContent>
    </Popover>
  );
}
