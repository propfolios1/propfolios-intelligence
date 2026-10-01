"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { BuildingGlyph } from "@/components/illustrations/building-glyph";
import { StatusPill } from "@/components/ui/status-pill";
import { cn, formatMoney } from "@/lib/utils";
import { DataTable } from "../data-table";

export interface HoldingRow {
  id: string;
  propertyId: string;
  property: string;
  community: string;
  assetClass: string;
  costAed: number;
  valueAed: number;
  irr: number;
  cashYield: number;
  status: string;
  unit?: string;
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
          <div className="truncate text-ui text-ink-900">{row.original.property}</div>
          <div className="truncate text-small text-ink-500">{row.original.community}</div>
        </div>
      </div>
    ),
  },
  { accessorKey: "costAed", header: "Cost", size: 120, meta: { numeric: true }, cell: ({ getValue }) => formatMoney(getValue<number>(), "AED") },
  { accessorKey: "valueAed", header: "Value", size: 120, meta: { numeric: true }, cell: ({ getValue }) => formatMoney(getValue<number>(), "AED") },
  {
    id: "gain",
    accessorFn: (r) => (r.valueAed - r.costAed) / r.costAed,
    header: "Gain",
    size: 100,
    meta: { numeric: true },
    cell: ({ getValue }) => {
      const v = getValue<number>() * 100;
      return <span className={cn(v < 0 ? "text-danger" : "text-success")}>{`${v < 0 ? "↓" : "↑"} ${Math.abs(v).toFixed(1)}%`}</span>;
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
      return <StatusPill tone={v === "performing" ? "complete" : v === "watch" ? "error" : "progress"}>{v.replace("_", " ")}</StatusPill>;
    },
  },
];

export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      initialSorting={[{ id: "valueAed", desc: true }]}
      maxHeight="none"
      mobileCard={(r) => (
        <div>
          <div className="text-ui font-medium text-ink-900">{r.property}</div>
          <div className="text-small text-ink-500">{r.community}</div>
          <div className="num mt-2 flex justify-between text-small">
            <span>{formatMoney(r.valueAed, "AED")}</span>
            <span>IRR {r.irr.toFixed(1)}%</span>
          </div>
        </div>
      )}
    />
  );
}
