"use client";

import * as React from "react";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { Input } from "@/components/ui/form";
import { ExportMenu } from "./export-menu";
import { FilterBuilder, type FilterValue } from "./filter-builder";
import { Segmented } from "@/components/ui/segmented";
export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  actorType: "user" | "agent" | "system";
  action: string;
  detail?: string;
  mandateId?: string;
  reference?: string;
  model?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}
import { cn, formatUsdCost } from "@/lib/utils";
import { EmptyState } from "./empty-state";

function stamp(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * A chronological ledger. Time sits in its own mono column on the left; agent
 * runs carry their cost and tokens as a second line.
 */
export function AuditList({ events, showMandate = false, dense = false, advanced = false }: { events: AuditEvent[]; showMandate?: boolean; dense?: boolean; advanced?: boolean }) {
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"all" | AuditEvent["actorType"]>("all");
  const [range, setRange] = React.useState<DateRange>({ from: null, to: null });
  const [filters, setFilters] = React.useState<FilterValue>({});
  const models = [...new Set(events.map((e) => e.model).filter((m): m is string => Boolean(m)))];
  const filtered = events.filter((e) => {
    const day = e.at.slice(0, 10);
    return (
      (type === "all" || e.actorType === type) &&
      (!q || `${e.actor} ${e.action} ${e.detail ?? ""} ${e.reference ?? ""}`.toLowerCase().includes(q.toLowerCase())) &&
      (!range.from || day >= range.from) &&
      (!range.to || day <= range.to) &&
      (!filters.model || e.model === filters.model) &&
      (!filters.actor || e.actor.toLowerCase().includes(filters.actor.toLowerCase())) &&
      (!filters.minCost || (e.costUsd ?? 0) >= Number(filters.minCost)) &&
      (!filters.reference || (e.reference ?? "").toLowerCase().includes(filters.reference.toLowerCase()))
    );
  });
  const cost = filtered.reduce((s, e) => s + (e.costUsd ?? 0), 0);
  const count = (t: AuditEvent["actorType"]) => events.filter((e) => e.actorType === t).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by actor, action or mandate" className="max-w-[320px]" aria-label="Filter events" />
        <Segmented
          label="Actor type"
          value={type}
          onChange={setType}
          options={[
            { value: "all", label: "All", count: events.length },
            { value: "agent", label: "Agents", count: count("agent") },
            { value: "user", label: "People", count: count("user") },
            { value: "system", label: "System", count: count("system") },
          ]}
        />
        {advanced && <DateRangePicker value={range} onChange={setRange} />}
        <span className="num ml-auto text-small text-ink-500">{formatUsdCost(cost)} agent spend</span>
        {advanced && (
          <ExportMenu
            rows={filtered}
            filename="audit-log"
            columns={[
              { key: "at", header: "Time (UTC)", value: (e) => e.at },
              { key: "actor", header: "Actor", value: (e) => e.actor },
              { key: "actorType", header: "Type", value: (e) => e.actorType },
              { key: "action", header: "Action", value: (e) => e.action },
              { key: "reference", header: "Mandate", value: (e) => e.reference },
              { key: "model", header: "Model", value: (e) => e.model },
              { key: "inputTokens", header: "Input tokens", value: (e) => e.inputTokens },
              { key: "outputTokens", header: "Output tokens", value: (e) => e.outputTokens },
              { key: "costUsd", header: "Cost (USD)", value: (e) => e.costUsd },
              { key: "durationMs", header: "Duration (ms)", value: (e) => e.durationMs },
            ]}
          />
        )}
      </div>
      {advanced && (
        <div className="-mt-3 mb-6">
          <FilterBuilder
            value={filters}
            onChange={setFilters}
            fields={[
              { key: "model", label: "Model", type: "select", options: models.map((m) => ({ value: m, label: m === "replay" ? "Replay mode" : m })) },
              { key: "actor", label: "Actor", type: "text" },
              { key: "reference", label: "Mandate", type: "text" },
              { key: "minCost", label: "Cost (USD)", type: "number", op: ">=" },
            ]}
          />
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState glyph="documents" headline="No events match this filter." />
      ) : (
        <ol className="border-t border-hairline">
          {filtered.map((e) => {
            const s = stamp(e.at);
            return (
              <li key={e.id} className={cn("grid grid-cols-[88px_1fr] gap-6 border-b border-hairline transition-[background-color] duration-120 hover:bg-ink-100 md:grid-cols-[120px_1fr_auto]", dense ? "py-3" : "py-4")}>
                <span className="num pl-1 text-small text-ink-500">
                  {s.day} <span className="text-ink-700">{s.time}</span>
                </span>
                <div className="min-w-0 text-ui">
                  <span className={cn("font-medium", e.actorType === "agent" ? "text-navy-900" : "text-ink-900")}>{e.actor}</span> <span className="text-ink-700">{e.action}</span>
                  {e.costUsd !== undefined && (
                    <div className="num mt-1 text-small text-ink-500">
                      {e.model === "replay" ? "replay mode" : e.model} · {formatUsdCost(e.costUsd)} · {(e.inputTokens ?? 0).toLocaleString()} in · {(e.outputTokens ?? 0).toLocaleString()} out
                      {e.durationMs ? ` · ${(e.durationMs / 1000).toFixed(1)}s` : ""}
                    </div>
                  )}
                  {e.costUsd === undefined && e.detail && e.detail !== e.mandateId && <div className="mt-1 text-small text-ink-500">{e.detail}</div>}
                </div>
                {showMandate && e.reference && (
                  <a href={`/analyst/mandates/${e.mandateId}`} className="num hidden pr-1 text-small text-ink-700 hover:text-ink-900 md:block">
                    {e.reference}
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
