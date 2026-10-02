"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { type RealtimeState, type RealtimeTable, useRealtime } from "./use-realtime";

const LABEL: Record<RealtimeState, string> = { connecting: "Connecting", live: "Live", polling: "Auto-refresh" };

/** Small status chip: live through Supabase Realtime, or refreshing on an interval. */
export function RealtimeIndicator({ state, className }: { state: RealtimeState; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-axis uppercase tracking-[0.12em] text-ink-500", className)} aria-live="polite" title={state === "live" ? "Updates stream in as they happen" : state === "polling" ? "Refreshes every twenty seconds" : undefined}>
      <span className={cn("relative size-1.5 rounded-full", state === "live" ? "bg-success" : state === "polling" ? "bg-ink-400" : "bg-ink-200")}>
        {state === "live" && <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />}
      </span>
      {LABEL[state]}
    </span>
  );
}

/** Refreshes the current server-rendered page when subscribed tables change. */
export function LiveRefresh({ name, tables, pollMs, className }: { name: string; tables: RealtimeTable[]; pollMs?: number; className?: string }) {
  const router = useRouter();
  const state = useRealtime(name, tables, () => router.refresh(), pollMs);
  return <RealtimeIndicator state={state} className={className} />;
}
