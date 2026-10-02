"use client";

import { ArrowDownRight, Building2, CalendarClock, Gem, TrendingUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { SeverityBadge } from "@/components/composites/status";
import { LiveRefresh } from "@/components/realtime/realtime-indicator";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn } from "@/lib/utils";

export interface InsightView {
  id: string;
  kind: "price_movement" | "developer_distress" | "undervalued" | "exit_window" | "follow_up";
  severity: string;
  audience: string;
  title: string;
  body: string;
  metrics: { label: string; value: string }[];
  status: "new" | "read" | "dismissed";
  dueAt: string | null;
  createdAt: string;
}

const KIND: Record<InsightView["kind"], { label: string; icon: typeof TrendingUp }> = {
  price_movement: { label: "Price movement", icon: TrendingUp },
  developer_distress: { label: "Developer distress", icon: Building2 },
  undervalued: { label: "Undervalued opportunity", icon: Gem },
  exit_window: { label: "Exit window", icon: ArrowDownRight },
  follow_up: { label: "Follow-up", icon: CalendarClock },
};

/** One proactive insight: what the platform noticed, why it matters and the figures behind it. */
export function InsightCard({ insight, onChanged, compact }: { insight: InsightView; onChanged?: () => void; compact?: boolean }) {
  const k = KIND[insight.kind];
  const Icon = k.icon;
  const [hidden, setHidden] = React.useState(false);
  async function update(status: "read" | "dismissed") {
    if (status === "dismissed") setHidden(true);
    const res = await fetch("/api/insights", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: insight.id, status }) });
    if (!res.ok) {
      setHidden(false);
      return void toast.error("Not updated");
    }
    onChanged?.();
  }
  if (hidden) return null;
  return (
    <article className={cn("group relative border-b border-ink-200 py-4 last:border-b-0", insight.status === "new" && "pl-3")} onMouseEnter={() => insight.status === "new" && void update("read")}>
      {insight.status === "new" && <span className="absolute top-5 left-0 size-1.5 rounded-full bg-gold-500" aria-label="New" />}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm bg-navy-50 text-navy-900">
          <Icon className="size-3.5 stroke-[1.5]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-axis uppercase tracking-[0.12em] text-ink-500">{k.label}</span>
            <SeverityBadge severity={insight.severity} />
            <span className="ml-auto text-small text-ink-500">{insight.dueAt ? `Due ${new Date(insight.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : <RelativeTime iso={insight.createdAt} />}</span>
          </div>
          <h4 className="mt-1.5 text-ui font-medium text-ink-900">{insight.title}</h4>
          {!compact && <p className="mt-1 text-small text-ink-700">{insight.body}</p>}
          {!compact && insight.metrics.length > 0 && (
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              {insight.metrics.map((m) => (
                <div key={m.label} className="flex items-baseline gap-2">
                  <dt className="text-small text-ink-500">{m.label}</dt>
                  <dd className="num text-small text-ink-900">{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss insight" className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => void update("dismissed")}>
          <X />
        </Button>
      </div>
    </article>
  );
}

/** The feed: newest first, live through Supabase Realtime (or refreshing), with an on-demand rescan for staff. */
export function InsightsFeed({ insights, staff, compact, limit, emptyText = "Nothing needs attention. The insight agent scans every six hours and whenever new market data arrives." }: { insights: InsightView[]; staff?: boolean; compact?: boolean; limit?: number; emptyText?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function rescan() {
    setBusy(true);
    const res = await fetch("/api/insights", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Scan failed", { description: json.error });
    toast.success(`Scanned ${json.signals} signals`, { description: `${json.written} insights written or refreshed.` });
    router.refresh();
  }
  const items = limit ? insights.slice(0, limit) : insights;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <LiveRefresh name="insights" tables={[{ table: "insights" }]} />
        {staff && (
          <Button variant="ghost" size="sm" onClick={rescan} disabled={busy}>
            {busy ? "Scanning" : "Scan now"}
          </Button>
        )}
      </div>
      {items.length ? items.map((i) => <InsightCard key={i.id} insight={i} compact={compact} onChanged={() => router.refresh()} />) : <p className="py-6 text-small text-ink-500">{emptyText}</p>}
    </div>
  );
}
