"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Briefcase, Copy, ExternalLink, FileText, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { DataTable } from "@/components/data-table";
import { MultiSelect } from "@/components/filter-select";
import { StatusPill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MandateRow } from "@/lib/data/store";
import { MANDATE_STAGES, STAGE_LABEL } from "@/lib/data/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { NewMandateDialog } from "./new-mandate-dialog";

const columns: ColumnDef<MandateRow, unknown>[] = [
  { accessorKey: "id", header: "ID", size: 100, cell: ({ getValue }) => <span className="num text-ink-900">{getValue<string>()}</span>, meta: { filterable: true } },
  {
    accessorKey: "client",
    header: "Client",
    size: 180,
    meta: { filterable: true },
    cell: ({ row }) => <span className="font-medium text-ink-900">{row.original.client}</span>,
  },
  {
    accessorKey: "property",
    header: "Property",
    size: 210,
    meta: { filterable: true },
    cell: ({ row }) => (
      <div className="truncate">
        {row.original.property}
        <span className="ml-2 text-ink-500">{row.original.community}</span>
      </div>
    ),
  },
  { accessorKey: "status", header: "Status", size: 130, cell: ({ row }) => <StatusPill status={row.original.status} />, meta: { filterable: true } },
  { accessorKey: "analyst", header: "Analyst", size: 140, meta: { filterable: true } },
  {
    accessorKey: "ticketSize",
    header: "Ticket",
    size: 120,
    meta: { numeric: true },
    cell: ({ getValue }) => formatMoney(getValue<number>(), "USD"),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    size: 120,
    meta: { numeric: true },
    cell: ({ getValue }) => <span className="text-ink-600">{formatDate(getValue<string>())}</span>,
  },
];

export function MandatesView({ rows, clients }: { rows: MandateRow[]; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [clientIds, setClientIds] = React.useState<string[]>(() => (params.get("client") ? [params.get("client")!] : []));
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [creating, setCreating] = React.useState(params.get("new") === "1");
  React.useEffect(() => {
    if (params.get("new") === "1") setCreating(true);
  }, [params]);

  const filtered = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          (!statuses.length || statuses.includes(r.status)) &&
          (!clientIds.length || clientIds.includes(r.clientId)) &&
          (!from || r.createdAt.slice(0, 10) >= from) &&
          (!to || r.createdAt.slice(0, 10) <= to),
      ),
    [rows, statuses, clientIds, from, to],
  );

  const anyFilter = query || statuses.length || clientIds.length || from || to;

  return (
    <>
      <div className="mt-10 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mandates…" className="pl-9" />
        </div>
        <MultiSelect label="Status" options={MANDATE_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} value={statuses} onChange={setStatuses} />
        <MultiSelect label="Client" options={clients.map((c) => ({ value: c.id, label: c.name }))} value={clientIds} onChange={setClientIds} />
        <div className="flex h-9 items-center gap-1 rounded-control border border-ink-200 bg-surface px-3 text-sm">
          <span className="text-ink-500">Created</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="num bg-transparent text-xs text-ink-900 outline-none" />
          <span className="text-ink-400">–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="num bg-transparent text-xs text-ink-900 outline-none" />
        </div>
        {anyFilter ? (
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              setStatuses([]);
              setClientIds([]);
              setFrom("");
              setTo("");
            }}
          >
            Reset
          </Button>
        ) : null}
        <span className="num ml-auto text-xs text-ink-500">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        globalFilter={query}
        initialSorting={[{ id: "createdAt", desc: true }]}
        onRowClick={(r) => router.push(`/analyst/mandates/${r.id}`)}
        rowActions={[
          { label: "Open", icon: ExternalLink, onSelect: (r) => router.push(`/analyst/mandates/${r.id}`) },
          { label: "Open memo", icon: FileText, onSelect: (r) => router.push(`/analyst/mandates/${r.id}?tab=memo`) },
          { label: "Copy ID", icon: Copy, onSelect: (r) => navigator.clipboard.writeText(r.id) },
        ]}
        empty={{
          icon: Briefcase,
          headline: "No mandates match",
          subtext: "Adjust the filters or start a new mandate.",
          action: <Button onClick={() => setCreating(true)}>New Mandate</Button>,
        }}
      />

      <NewMandateDialog open={creating} onOpenChange={setCreating} clients={clients} />
    </>
  );
}
