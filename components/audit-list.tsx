"use client";

import { Bot, Search, Server, User } from "lucide-react";
import * as React from "react";
import { EmptyState } from "./empty-state";
import { Input } from "./ui/input";
import type { AuditEvent } from "@/lib/data/types";
import { cn, formatDate, formatUsdCost } from "@/lib/utils";

const ICON = { agent: Bot, user: User, system: Server } as const;

export function AuditList({ events, showMandate = false, dense = false }: { events: AuditEvent[]; showMandate?: boolean; dense?: boolean }) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"all" | AuditEvent["actorType"]>("all");
  const filtered = events.filter(
    (e) =>
      (type === "all" || e.actorType === type) &&
      (!q || `${e.actor} ${e.action} ${e.detail ?? ""} ${e.mandateId ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const totalCost = filtered.reduce((s, e) => s + (e.costUsd ?? 0), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter events…" className="pl-9" />
        </div>
        <div className="flex rounded-control border border-ink-200 bg-surface p-0.5">
          {(["all", "agent", "user", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn("h-8 rounded-[4px] px-3 text-sm capitalize transition-colors", type === t ? "bg-navy-100 text-navy-900" : "text-ink-600 hover:text-ink-900")}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="num ml-auto text-xs text-ink-500">
          {filtered.length} events · {formatUsdCost(totalCost)} agent spend
        </span>
      </div>
      <div className="overflow-hidden rounded-card border border-ink-200 bg-surface">
        {filtered.length === 0 ? (
          <EmptyState icon={Search} headline="No events match" subtext="Try a different filter." />
        ) : (
          <ol className="divide-y divide-ink-200">
            {filtered.map((e) => {
              const Icon = ICON[e.actorType];
              return (
                <li key={e.id} className={cn("grid grid-cols-[28px_1fr_auto] items-start gap-4 px-5 transition-colors hover:bg-ink-50", dense ? "py-2.5" : "py-4")}>
                  <span className="mt-0.5 flex size-7 items-center justify-center rounded-full border border-ink-200">
                    <Icon className="size-3.5 text-ink-500" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 text-sm">
                    <div>
                      <span className="font-medium text-ink-900">{e.actor}</span> <span className="text-ink-600">{e.action}</span>
                      {showMandate && e.mandateId && <span className="num ml-2 text-xs text-navy-700">{e.mandateId}</span>}
                    </div>
                    {(e.detail || e.costUsd !== undefined) && (
                      <div className="num mt-0.5 truncate text-[11px] text-ink-500">
                        {e.costUsd !== undefined && (
                          <>
                            {formatUsdCost(e.costUsd)} · {(e.inputTokens ?? 0).toLocaleString()} in / {(e.outputTokens ?? 0).toLocaleString()} out
                            {e.durationMs ? ` · ${(e.durationMs / 1000).toFixed(1)}s` : ""}
                          </>
                        )}
                        {e.detail && e.costUsd === undefined && e.detail}
                      </div>
                    )}
                  </div>
                  <time className="num text-[11px] whitespace-nowrap text-ink-400">{formatDate(e.at, "datetime")}</time>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
