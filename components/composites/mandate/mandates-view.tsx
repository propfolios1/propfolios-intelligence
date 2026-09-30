"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/field";
import type { MandateRow } from "@/lib/data/store";
import { MANDATE_STAGES, STAGE_LABEL } from "@/lib/data/types";
import { formatDate, formatMoney } from "@/lib/utils";
import { DataTable } from "../data-table";
import { MultiSelect } from "../multi-select";
import { StatusPillFor } from "../status";
import { NewMandateDialog } from "./new-mandate-dialog";

const columns: ColumnDef<MandateRow, unknown>[] = [
  { accessorKey: "id", header: "ID", size: 104, meta: { id: true, filterable: true } },
  { accessorKey: "client", header: "Client", size: 200, meta: { filterable: true }, cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
  {
    accessorKey: "property",
    header: "Property",
    size: 220,
    meta: { filterable: true },
    cell: ({ row }) => (
      <span className="block truncate">
        {row.original.property}
        <span className="ml-2 text-small text-ink-3">{row.original.community}</span>
      </span>
    ),
  },
  { accessorKey: "status", header: "Stage", size: 128, meta: { filterable: true }, cell: ({ row }) => <StatusPillFor status={row.original.status} /> },
  { accessorKey: "analyst", header: "Analyst", size: 140, meta: { filterable: true }, cell: ({ getValue }) => <span className="text-ink-2">{getValue<string>()}</span> },
  { accessorKey: "ticketSize", header: "Ticket", size: 116, meta: { numeric: true }, cell: ({ getValue }) => formatMoney(getValue<number>(), "USD") },
  { accessorKey: "createdAt", header: "Opened", size: 140, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-2">{formatDate(getValue<string>())}</span> },
];

export function MandatesView({ rows, clients }: { rows: MandateRow[]; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = React.useState("");
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [clientIds, setClientIds] = React.useState<string[]>(() => (params.get("client") ? [params.get("client")!] : []));
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState(false);
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
      <div className="mt-10 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, client or property" className="w-full sm:w-72" aria-label="Search mandates" />
        <MultiSelect label="Stage" options={MANDATE_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} value={statuses} onChange={setStatuses} />
        <MultiSelect label="Client" options={clients.map((c) => ({ value: c.id, label: c.name }))} value={clientIds} onChange={setClientIds} />
        <div className="flex h-10 items-baseline gap-2 text-small">
          <span className="eyebrow">Opened</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Opened from" className="num w-[124px] bg-transparent text-small text-ink outline-none" />
          <span className="text-ink-3">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Opened to" className="num w-[124px] bg-transparent text-small text-ink outline-none" />
        </div>
        <div className="ml-auto flex items-baseline gap-6">
          {anyFilter ? (
            <button
              className="text-small text-ink-2 transition-[color] duration-120 hover:text-ink"
              onClick={() => {
                setQuery("");
                setStatuses([]);
                setClientIds([]);
                setFrom("");
                setTo("");
              }}
            >
              Clear
            </button>
          ) : null}
          <button onClick={() => setColumnFilters((s) => !s)} className="text-small text-ink-2 transition-[color] duration-120 hover:text-ink" aria-pressed={columnFilters}>
            {columnFilters ? "Hide column filters" : "Column filters"}
          </button>
          <span className="num text-small text-ink-3">
            {filtered.length}/{rows.length}
          </span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        globalFilter={query}
        showFilters={columnFilters}
        initialSorting={[{ id: "createdAt", desc: true }]}
        onRowClick={(r) => router.push(`/analyst/mandates/${r.id}`)}
        rowActions={[
          { label: "Open memo", onSelect: (r) => router.push(`/analyst/mandates/${r.id}?tab=memo`) },
          { label: "Copy ID", onSelect: (r) => navigator.clipboard.writeText(r.id) },
        ]}
        empty={{ glyph: "mandates", headline: rows.length ? "No mandates match these filters." : "No mandates yet.", action: <Button onClick={() => setCreating(true)}>New mandate</Button> }}
      />

      <NewMandateDialog open={creating} onOpenChange={setCreating} clients={clients} />
    </>
  );
}
