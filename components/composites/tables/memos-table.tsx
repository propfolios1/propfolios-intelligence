"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import type { Memo } from "@/lib/data/types";
import { formatDate } from "@/lib/utils";
import { DataTable } from "../data-table";

type Row = Memo & { client: string; property: string };
const TONE: Record<Memo["status"], PillTone> = { Draft: "neutral", "In review": "progress", Approved: "progress", Delivered: "complete" };

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "mandateId", header: "Mandate", size: 110, meta: { id: true, filterable: true } },
  { accessorKey: "property", header: "Memo", size: 280, meta: { filterable: true }, cell: ({ row }) => <span className="font-display text-body text-navy-900">{row.original.property}</span> },
  { accessorKey: "status", header: "Status", size: 120, meta: { filterable: true }, cell: ({ row }) => <StatusPill tone={TONE[row.original.status]}>{row.original.status}</StatusPill> },
  { accessorKey: "client", header: "Client", size: 220, meta: { filterable: true }, cell: ({ getValue }) => <span className="text-ink-700">{getValue<string>()}</span> },
  { accessorKey: "lastEditedBy", header: "Last edit", size: 150, cell: ({ getValue }) => <span className="text-ink-700">{getValue<string>()}</span> },
  { accessorKey: "lastEditedAt", header: "Edited", size: 150, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-700">{formatDate(getValue<string>(), "datetime")}</span> },
];

export function MemosTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const open = (r: Row) => router.push(`/analyst/mandates/${r.mandateId}?tab=memo`);
  return (
    <DataTable
      columns={columns}
      data={rows}
      initialSorting={[{ id: "lastEditedAt", desc: true }]}
      onRowClick={open}
      rowActions={[{ label: "Open mandate", onSelect: (r) => router.push(`/analyst/mandates/${r.mandateId}`) }]}
      empty={{ glyph: "documents", headline: "No memos yet." }}
    />
  );
}
