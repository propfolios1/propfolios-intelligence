"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusPill } from "@/components/ui/status-pill";
import type { Developer } from "@/lib/data/types";
import { cn, relativeTime } from "@/lib/utils";
import { DataTable } from "../data-table";

function band(v: number) {
  return v > 60 ? "High" : v > 38 ? "Elevated" : v > 22 ? "Moderate" : "Low";
}

/**
 * The risk score is a 120px rule with a tick at the score, over a faint
 * scale. Red past 60, ink below. No logos: developers are named, not branded.
 */
const columns: ColumnDef<Developer, unknown>[] = [
  {
    accessorKey: "name",
    header: "Developer",
    size: 240,
    meta: { filterable: true },
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate text-ui text-ink-900">{row.original.name}</div>
        <div className="truncate text-small text-ink-500">
          {row.original.hq}, {row.original.market}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "riskScore",
    header: "Risk score",
    size: 260,
    cell: ({ getValue }) => {
      const v = getValue<number>();
      return (
        <div className="flex items-center gap-4">
          <span className={cn("num w-7 text-right text-ui", v > 60 ? "text-danger" : "text-ink-900")}>{v}</span>
          <span className="relative h-3 w-[120px]" role="img" aria-label={`${v} of 100`}>
            <span className="absolute top-1/2 left-0 h-px w-full bg-ink-200" />
            {[25, 50, 75].map((t) => (
              <span key={t} className="absolute top-0.5 h-2 w-px bg-ink-200" style={{ left: `${t}%` }} />
            ))}
            <span className={cn("absolute top-1/2 left-0 h-[3px] -translate-y-1/2", v > 60 ? "bg-danger" : "bg-navy-900")} style={{ width: `${v}%` }} />
          </span>
          <span className="text-small text-ink-500">{band(v)}</span>
        </div>
      );
    },
  },
  { accessorKey: "deliveryPct", header: "On time", size: 100, meta: { numeric: true }, cell: ({ getValue }) => `${getValue<number>()}%` },
  { accessorKey: "projectsDelivered", header: "Delivered", size: 104, meta: { numeric: true } },
  {
    accessorKey: "litigationCount",
    header: "Litigation",
    size: 104,
    meta: { numeric: true },
    cell: ({ getValue }) => <span className={getValue<number>() >= 10 ? "text-danger" : undefined}>{getValue<number>()}</span>,
  },
  { accessorKey: "escrowCompliant", header: "Escrow", size: 120, cell: ({ getValue }) => (getValue<boolean>() ? <StatusPill tone="complete">Verified</StatusPill> : <StatusPill tone="error">Unverified</StatusPill>) },
  { accessorKey: "updatedAt", header: "Scored", size: 104, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-500">{relativeTime(getValue<string>())}</span> },
];

export function DevelopersTable({ rows }: { rows: Developer[] }) {
  return <DataTable columns={columns} data={rows} initialSorting={[{ id: "riskScore", desc: true }]} rowActions={[{ label: "Rescore", onSelect: () => {} }]} />;
}
