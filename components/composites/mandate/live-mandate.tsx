"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Timeline } from "@/components/composites/timeline";
import { toast } from "@/components/ui/toaster";
import { AUTOMATED_STAGES, STAGE_LABEL, type MandateStage, type StageRun } from "@/lib/domain";

interface LiveState {
  status: MandateStage;
  timeline: StageRun[];
  running: boolean;
  totalCostUsd: number;
  progress: Record<string, number>;
  /** Starts or resumes the pipeline; `from` re-runs from a stage. */
  run: (from?: MandateStage) => Promise<void>;
}

const LiveContext = React.createContext<LiveState | null>(null);
export const useLive = () => {
  const v = React.useContext(LiveContext);
  if (!v) throw new Error("useLive outside LiveMandate");
  return v;
};

/**
 * Subscribes to the mandate's SSE stream while agents work. Snapshots update
 * the timeline in place; a status change refreshes server-rendered tabs; a
 * "paused" event (time budget reached) resumes the run automatically.
 */
export function LiveMandate({
  mandateId,
  initial,
  children,
}: {
  mandateId: string;
  initial: { status: MandateStage; timeline: StageRun[]; running: boolean; totalCostUsd: number };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState(initial.status);
  const [timeline, setTimeline] = React.useState(initial.timeline);
  const [running, setRunning] = React.useState(initial.running);
  const [totalCostUsd, setCost] = React.useState(initial.totalCostUsd);
  const [progress, setProgress] = React.useState<Record<string, number>>({});
  const [listening, setListening] = React.useState(initial.running);
  const [attempt, setAttempt] = React.useState(0);
  const statusRef = React.useRef(status);

  React.useEffect(() => {
    setStatus(initial.status);
    setTimeline(initial.timeline);
    setRunning(initial.running);
    setCost(initial.totalCostUsd);
    statusRef.current = initial.status;
  }, [initial.status, initial.timeline, initial.running, initial.totalCostUsd]);

  const run = React.useCallback(
    async (from?: MandateStage) => {
      const res = await fetch(`/api/mandates/${mandateId}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(from ? { from } : {}) });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error("Pipeline not started", { description: json.error ?? "Retry." });
        return;
      }
      setRunning(true);
      setListening(true);
      if (from) router.refresh();
    },
    [mandateId, router],
  );

  React.useEffect(() => {
    if (!listening) return;
    const es = new EventSource(`/api/mandates/${mandateId}/stream`);
    let idle = 0;
    es.addEventListener("snapshot", (ev) => {
      const s = JSON.parse((ev as MessageEvent).data) as { status: MandateStage; timeline: StageRun[]; running: boolean; totalCostUsd: number };
      setTimeline(s.timeline);
      setRunning(s.running);
      setCost(s.totalCostUsd);
      if (s.status !== statusRef.current) {
        const done = statusRef.current;
        statusRef.current = s.status;
        setStatus(s.status);
        setProgress({});
        if (AUTOMATED_STAGES.includes(done)) toast.success(`${STAGE_LABEL[done]} complete`);
        if (s.status === "REVIEW") toast.success("Memo drafted", { description: "The mandate is ready for committee review." });
        router.refresh();
      }
      const failed = s.timeline.find((t) => t.status === "failed");
      if (failed && !s.running) {
        toast.error(`${STAGE_LABEL[failed.stage as MandateStage]} failed`, { description: "Re-run the stage from the controls above." });
        setListening(false);
      }
      // stop listening once nothing is running and the pipeline is not in an automated stage
      if (!s.running && !AUTOMATED_STAGES.includes(s.status)) setListening(false);
      if (!s.running && AUTOMATED_STAGES.includes(s.status) && ++idle > 8) setListening(false);
    });
    es.addEventListener("progress", (ev) => {
      const p = JSON.parse((ev as MessageEvent).data) as { stage: string; chars: number };
      setProgress((prev) => ({ ...prev, [p.stage]: p.chars }));
    });
    es.addEventListener("paused", () => void run());
    es.addEventListener("end", () => {
      es.close();
      setAttempt((a) => a + 1);
    });
    es.onerror = () => {
      es.close();
      window.setTimeout(() => setAttempt((a) => a + 1), 2000);
    };
    return () => es.close();
  }, [listening, attempt, mandateId, router, run]);

  return <LiveContext.Provider value={{ status, timeline, running, totalCostUsd, progress, run }}>{children}</LiveContext.Provider>;
}

export function LiveTimeline({ compact }: { compact?: boolean }) {
  const { timeline, progress } = useLive();
  return <Timeline runs={timeline} progress={progress} compact={compact} />;
}

/** One-line live status for the header; announced to screen readers. */
export function LiveStatusLine() {
  const { status, running, totalCostUsd } = useLive();
  return (
    <span aria-live="polite" className="text-small text-ink-500">
      {running ? <span className="text-gold-600">{STAGE_LABEL[status]} agent working</span> : `Stage: ${STAGE_LABEL[status]}`}
      <span className="num"> · agent cost ${totalCostUsd.toFixed(3)}</span>
    </span>
  );
}
