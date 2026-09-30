"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BuildingGlyph } from "@/components/illustrations/building-glyph";
import { StatusPill } from "@/components/primitives/status-pill";
import { cn, formatMoney } from "@/lib/utils";
import { DataTable } from "../data-table";

export interface HoldingRow {
  id: string;
  propertyId: string;
  property: string;
  community: string;
  assetClass: string;
  costUsd: number;
  valueUsd: number;
  irr: number;
  cashYield: number;
  status: string;
}

const columns: ColumnDef<HoldingRow, unknown>[] = [
  {
    accessorKey: "property",
    header: "Holding",
    size: 280,
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <BuildingGlyph seed={row.original.propertyId} assetClass={row.original.assetClass} />
        <div className="min-w-0">
          <div className="truncate text-ui text-ink">{row.original.property}</div>
          <div className="truncate text-small text-ink-3">{row.original.community}</div>
        </div>
      </div>
    ),
  },
  { accessorKey: "costUsd", header: "Cost", size: 120, meta: { numeric: true }, cell: ({ getValue }) => formatMoney(getValue<number>(), "USD") },
  { accessorKey: "valueUsd", header: "Value", size: 120, meta: { numeric: true }, cell: ({ getValue }) => formatMoney(getValue<number>(), "USD") },
  {
    id: "gain",
    accessorFn: (r) => (r.valueUsd - r.costUsd) / r.costUsd,
    header: "Gain",
    size: 100,
    meta: { numeric: true },
    cell: ({ getValue }) => {
      const v = getValue<number>() * 100;
      return <span className={cn(v < 0 ? "text-red" : "text-green")}>{`${v < 0 ? "↓" : "↑"} ${Math.abs(v).toFixed(1)}%`}</span>;
    },
  },
  { accessorKey: "irr", header: "IRR", size: 88, meta: { numeric: true }, cell: ({ getValue }) => `${getValue<number>().toFixed(1)}%` },
  { accessorKey: "cashYield", header: "Yield", size: 88, meta: { numeric: true }, cell: ({ getValue }) => `${getValue<number>().toFixed(1)}%` },
  {
    accessorKey: "status",
    header: "Status",
    size: 200,
    cell: ({ getValue }) => {
      const v = getValue<string>();
      return <StatusPill tone={v === "Performing" ? "complete" : v === "Watch" ? "error" : "progress"}>{v}</StatusPill>;
    },
  },
];

export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  return <DataTable columns={columns} data={rows} initialSorting={[{ id: "valueUsd", desc: true }]} maxHeight="none" />;
}
