"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Input } from "@/components/ui/form";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toaster";
import { formatAed, MANDATE_STAGES, STAGE_LABEL, type MandateStage } from "@/lib/domain";
import { useUi } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { DataTable } from "../data-table";
import { KanbanBoard } from "../kanban-board";
import { MultiSelect } from "../multi-select";
import { RecommendationPill, StagePill } from "../status";

export interface MandateRowView {
  id: string;
  reference: string;
  title: string;
  status: MandateStage;
  priority: string;
  deadline: string | null;
  ticketSizeAed: number;
  recommendation: string | null;
  createdAt: string;
  updatedAt: string;
  running: boolean;
  clientId: string;
  clientName: string;
  propertyName: string;
  community: string;
  analystName: string | null;
}

const columns: ColumnDef<MandateRowView, unknown>[] = [
  { accessorKey: "reference", header: "Ref", size: 104, meta: { id: true, filterable: true } },
  {
    accessorKey: "title",
    header: "Mandate",
    size: 240,
    meta: { filterable: true },
    cell: ({ row }) => (
      <span className="block truncate">
        <span className="font-medium">{row.original.title}</span>
        <span className="ml-2 text-small text-ink-500">{row.original.propertyName}</span>
      </span>
    ),
  },
  { accessorKey: "clientName", header: "Client", size: 180, meta: { filterable: true } },
  { accessorKey: "status", header: "Stage", size: 140, cell: ({ row }) => <StagePill status={row.original.status} /> },
  { accessorKey: "recommendation", header: "Recommendation", size: 180, cell: ({ row }) => <RecommendationPill value={row.original.recommendation} /> },
  { accessorKey: "ticketSizeAed", header: "Ticket", size: 116, meta: { numeric: true }, cell: ({ getValue }) => formatAed(getValue<number>()) },
  { accessorKey: "analystName", header: "Analyst", size: 140, cell: ({ getValue }) => <span className="text-ink-700">{getValue<string>() ?? "Unassigned"}</span> },
  { accessorKey: "createdAt", header: "Opened", size: 120, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-700">{formatDate(getValue<string>())}</span> },
];

export function MandatesView({ rows, clients }: { rows: MandateRowView[]; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { mandateView, setMandateView } = useUi();
  const [query, setQuery] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>(() => (params.get("status") ? [params.get("status")!] : []));
  const [clientIds, setClientIds] = React.useState<string[]>(() => (params.get("client") ? [params.get("client")!] : []));

  const filtered = React.useMemo(() => {
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        (!statuses.length || statuses.includes(r.status)) &&
        (!clientIds.length || clientIds.includes(r.clientId)) &&
        (!q || [r.reference, r.title, r.clientName, r.propertyName].some((v) => v.toLowerCase().includes(q))),
    );
  }, [rows, statuses, clientIds, query]);
  const anyFilter = query || statuses.length || clientIds.length;

  return (
    <>
      <div className="mt-8 mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, client or property" className="w-full sm:w-72" aria-label="Search mandates" />
        <MultiSelect label="Stage" options={MANDATE_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} value={statuses} onChange={setStatuses} />
        <MultiSelect label="Client" options={clients.map((c) => ({ value: c.id, label: c.name }))} value={clientIds} onChange={setClientIds} />
        {anyFilter ? (
          <button
            className="text-small text-ink-700 hover:text-ink-900"
            onClick={() => {
              setQuery("");
              setStatuses([]);
              setClientIds([]);
            }}
          >
            Clear filters
          </button>
        ) : null}
        <div className="ml-auto flex items-center gap-4">
          <span className="num text-small text-ink-500">
            {filtered.length} of {rows.length}
          </span>
          <Segmented
            value={mandateView}
            onChange={(v) => setMandateView(v as "board" | "table")}
            options={[
              { value: "board", label: "Board" },
              { value: "table", label: "Table" },
            ]}
            label="View"
          />
        </div>
      </div>

      {mandateView === "board" ? (
        <KanbanBoard
          key={filtered.map((r) => r.id).join()}
          cards={filtered.map((r) => ({ id: r.id, reference: r.reference, status: r.status, client: r.clientName, property: r.propertyName, deadline: r.deadline, updatedAt: r.updatedAt, running: r.running, priority: r.priority as "standard" | "priority" }))}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          initialSorting={[{ id: "createdAt", desc: true }]}
          onRowClick={(r) => router.push(`/analyst/mandates/${r.id}`)}
          rowActions={[
            { label: "Open memo", onSelect: (r) => router.push(`/analyst/mandates/${r.id}?tab=memo`) },
            {
              label: "Copy reference",
              onSelect: (r) => {
                navigator.clipboard.writeText(r.reference);
                toast.success(`${r.reference} copied`);
              },
            },
          ]}
          mobileCard={(r) => (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="num text-small text-ink-500">{r.reference}</span>
                <StagePill status={r.status} />
              </div>
              <div className="mt-1 text-ui font-medium text-ink-900">{r.title}</div>
              <div className="text-small text-ink-500">
                {r.clientName} · {r.propertyName}
              </div>
            </div>
          )}
          empty={{
            glyph: "mandates",
            headline: rows.length ? "No mandates match these filters" : "No mandates yet",
            note: rows.length
              ? "Clear a filter to see every mandate in the pipeline."
              : "Create your first mandate and Nakhla produces research, underwriting, due diligence, a bull and bear debate and a client-ready memo in under fifteen minutes.",
            primary: { label: "Create mandate", href: "/analyst/mandates/new" },
            secondary: { label: "Browse properties", href: "/analyst/properties" },
          }}
        />
      )}
    </>
  );
}
