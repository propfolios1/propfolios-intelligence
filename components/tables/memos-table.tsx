"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table";
import { Pill } from "@/components/ui/pill";
import type { Memo } from "@/lib/data/types";
import { formatDate } from "@/lib/utils";

type Row = Memo & { client: string; property: string };

const TONE = { Draft: "neutral", "In review": "warning", Approved: "navy", Delivered: "positive" } as const;

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "title", header: "Memo", size: 340, meta: { filterable: true }, cell: ({ getValue }) => <span className="font-medium text-ink-900">{getValue<string>()}</span> },
  { accessorKey: "status", header: "Status", size: 130, meta: { filterable: true }, cell: ({ row }) => <Pill tone={TONE[row.original.status]} dot>{row.original.status}</Pill> },
  { accessorKey: "mandateId", header: "Mandate", size: 110, meta: { filterable: true }, cell: ({ getValue }) => <span className="num">{getValue<string>()}</span> },
  { accessorKey: "client", header: "Client", size: 220, meta: { filterable: true } },
  { accessorKey: "lastEditedBy", header: "Edited by", size: 160 },
  { accessorKey: "lastEditedAt", header: "Last edited", size: 150, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-600">{formatDate(getValue<string>(), "datetime")}</span> },
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
      rowActions={[
        { label: "Open in editor", icon: FileText, onSelect: open },
        { label: "Open mandate", icon: ExternalLink, onSelect: (r) => router.push(`/analyst/mandates/${r.mandateId}`) },
      ]}
      empty={{ icon: FileText, headline: "No memos yet", subtext: "Memos appear here once a mandate reaches the memo stage." }}
    />
  );
}
