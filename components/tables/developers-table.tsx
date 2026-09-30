"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Pill } from "@/components/ui/pill";
import type { Developer } from "@/lib/data/types";
import { cn, initials, relativeTime } from "@/lib/utils";

function band(score: number) {
  return score > 60 ? "High" : score > 38 ? "Elevated" : score > 22 ? "Moderate" : "Low";
}

const columns: ColumnDef<Developer, unknown>[] = [
  {
    accessorKey: "name",
    header: "Developer",
    size: 280,
    meta: { filterable: true },
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-control text-[11px] font-semibold tracking-wider text-white" style={{ background: row.original.brandColor }} aria-hidden>
          {initials(row.original.name)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium text-ink-900">{row.original.name}</div>
          <div className="truncate text-xs text-ink-500">
            {row.original.hq} · {row.original.market}
          </div>
        </div>
      </div>
    ),
  },
  {
    accessorKey: "riskScore",
    header: "Risk score",
    size: 240,
    cell: ({ getValue }) => {
      const v = getValue<number>();
      const tone = v > 60 ? "bg-negative" : v > 38 ? "bg-warning" : v > 22 ? "bg-navy-500" : "bg-positive";
      return (
        <div className="flex items-center gap-3">
          <span className="num w-7 text-right text-ink-900">{v}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
            <div className={cn("h-full rounded-full", tone)} style={{ width: `${v}%` }} />
          </div>
          <span className="w-16 text-xs text-ink-500">{band(v)}</span>
        </div>
      );
    },
  },
  { accessorKey: "deliveryPct", header: "On-time delivery", size: 150, meta: { numeric: true }, cell: ({ getValue }) => `${getValue<number>()}%` },
  { accessorKey: "projectsDelivered", header: "Delivered", size: 110, meta: { numeric: true } },
  {
    accessorKey: "litigationCount",
    header: "Litigation",
    size: 110,
    meta: { numeric: true },
    cell: ({ getValue }) => {
      const v = getValue<number>();
      return <span className={v >= 10 ? "text-negative" : undefined}>{v}</span>;
    },
  },
  {
    accessorKey: "escrowCompliant",
    header: "Escrow",
    size: 120,
    cell: ({ getValue }) => (getValue<boolean>() ? <Pill tone="positive">Verified</Pill> : <Pill tone="negative">Unverified</Pill>),
  },
  { accessorKey: "updatedAt", header: "Updated", size: 120, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-500">{relativeTime(getValue<string>())}</span> },
];

export function DevelopersTable({ rows }: { rows: Developer[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      initialSorting={[{ id: "riskScore", desc: true }]}
      rowActions={[
        { label: "Refresh risk score", icon: RefreshCw, onSelect: () => {} },
        { label: "View projects", icon: ShieldAlert, onSelect: () => {} },
      ]}
    />
  );
}
