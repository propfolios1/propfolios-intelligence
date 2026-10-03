"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { DataTable } from "../data-table";
import { MemoStatusPill, RecommendationPill } from "../status";

export interface MemoRow {
  id: string;
  title: string;
  status: string;
  version: number;
  reference: string;
  clientName: string;
  recommendation: string | null;
  approvedBy: string | null;
  updatedAt: string;
}

const columns: ColumnDef<MemoRow, unknown>[] = [
  { accessorKey: "reference", header: "Ref", size: 100, meta: { id: true } },
  { accessorKey: "title", header: "Memo", size: 340, cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span> },
  { accessorKey: "clientName", header: "Client", size: 180 },
  { accessorKey: "status", header: "Status", size: 120, cell: ({ getValue }) => <MemoStatusPill status={getValue<string>()} /> },
  { accessorKey: "recommendation", header: "Recommendation", size: 180, cell: ({ getValue }) => <RecommendationPill value={getValue<string | null>()} /> },
  { accessorKey: "version", header: "Ver", size: 64, meta: { numeric: true } },
  { accessorKey: "updatedAt", header: "Updated", size: 120, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-700">{formatDate(getValue<string>())}</span> },
];

export function MemosTable({ rows, base = "/analyst/memos" }: { rows: MemoRow[]; base?: string }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={rows}
      initialSorting={[{ id: "updatedAt", desc: true }]}
      onRowClick={(r) => router.push(`${base}/${r.id}`)}
      rowActions={[{ label: "Export PDF", onSelect: (r) => window.open(`/api/memos/${r.id}/export`, "_blank") }]}
      mobileCard={(r) => (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="num text-small text-ink-500">{r.reference}</span>
            <MemoStatusPill status={r.status} />
          </div>
          <div className="mt-1 text-ui font-medium text-ink-900">{r.title}</div>
          <div className="text-small text-ink-500">{r.clientName}</div>
        </div>
      )}
      empty={{ glyph: "documents", headline: "No memos yet", note: "The memo agent writes an Allocation Memo in your house style once a mandate clears research, underwriting, due diligence and debate.", primary: { label: "Create mandate", href: "/analyst/mandates/new" }, secondary: { label: "View mandates", href: "/analyst/mandates" } }}
    />
  );
}
