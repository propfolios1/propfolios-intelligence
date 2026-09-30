"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { PropertyThumb } from "@/components/properties/property-thumb";
import { Pill } from "@/components/ui/pill";
import { cn, formatMoney } from "@/lib/utils";

export interface HoldingRow {
  id: string;
  property: string;
  community: string;
  hue: number;
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
      <div className="flex items-center gap-3">
        <PropertyThumb name={row.original.property} hue={row.original.hue} />
        <div className="min-w-0">
          <div className="truncate font-medium text-ink-900">{row.original.property}</div>
          <div className="truncate text-xs text-ink-500">{row.original.community}</div>
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
      return <span className={cn(v < 0 ? "text-negative" : "text-positive")}>{`${v > 0 ? "+" : ""}${v.toFixed(1)}%`}</span>;
    },
  },
  { accessorKey: "irr", header: "IRR", size: 90, meta: { numeric: true }, cell: ({ getValue }) => `${getValue<number>().toFixed(1)}%` },
  { accessorKey: "cashYield", header: "Yield", size: 90, meta: { numeric: true }, cell: ({ getValue }) => `${getValue<number>().toFixed(1)}%` },
  {
    accessorKey: "status",
    header: "Status",
    size: 170,
    cell: ({ getValue }) => {
      const v = getValue<string>();
      return <Pill tone={v === "Performing" ? "positive" : v === "Watch" ? "warning" : "navy"} dot>{v}</Pill>;
    },
  },
];

export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  return <DataTable columns={columns} data={rows} initialSorting={[{ id: "valueUsd", desc: true }]} />;
}
