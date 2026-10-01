"use client";

import type { ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { DataTable } from "@/components/composites/data-table";
import { BuildingGlyph } from "@/components/illustrations/building-glyph";
import { Checkbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/segmented";
import { StatusPill } from "@/components/ui/status-pill";
import { formatMoney } from "@/lib/utils";
import { PropertyMap } from "./property-map";

export interface PropertyRow {
  id: string;
  name: string;
  developer: string;
  region: string;
  community: string;
  market: "UAE" | "India";
  assetClass: string;
  status: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  lat: number;
  lng: number;
  grossYield: number;
}

const columns: ColumnDef<PropertyRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Property",
    size: 300,
    meta: { filterable: true },
    cell: ({ row }) => (
      <div className="flex items-center gap-4">
        <BuildingGlyph seed={row.original.id} assetClass={row.original.assetClass} />
        <div className="min-w-0">
          <div className="truncate text-ui text-ink-900">{row.original.name}</div>
          <div className="truncate text-small text-ink-500">{row.original.community}</div>
        </div>
      </div>
    ),
  },
  { accessorKey: "developer", header: "Developer", size: 190, meta: { filterable: true }, cell: ({ getValue }) => <span className="text-ink-700">{getValue<string>()}</span> },
  { accessorKey: "region", header: "Emirate or state", size: 150, meta: { filterable: true }, cell: ({ getValue }) => <span className="text-ink-700">{getValue<string>()}</span> },
  {
    id: "price",
    accessorFn: (r) => r.priceMin,
    header: "Price range",
    size: 190,
    meta: { numeric: true },
    cell: ({ row }) => `${formatMoney(row.original.priceMin, row.original.currency)}–${formatMoney(row.original.priceMax, row.original.currency).split(" ")[1]}`,
  },
  { accessorKey: "grossYield", header: "Yield", size: 84, meta: { numeric: true }, cell: ({ getValue }) => `${getValue<number>().toFixed(1)}%` },
  {
    accessorKey: "status",
    header: "Status",
    size: 170,
    meta: { filterable: true },
    cell: ({ getValue }) => {
      const v = getValue<string>();
      return <StatusPill tone={v === "Ready" ? "complete" : v === "Off-plan" ? "neutral" : "progress"}>{v}</StatusPill>;
    },
  },
];

function FilterGroup({ title, options, value, onChange }: { title: string; options: [string, number][]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="border-t border-ink-200 pt-4">
      <legend className="eyebrow float-left mb-4 w-full">{title}</legend>
      <div className="clear-both flex flex-col gap-3">
        {options.map(([o, n]) => (
          <label key={o} className="flex cursor-pointer items-center gap-3 text-small text-ink-900">
            <Checkbox checked={value.includes(o)} onCheckedChange={(c) => onChange(c ? [...value, o] : value.filter((x) => x !== o))} />
            <span className="flex-1">{o}</span>
            <span className="num text-axis text-ink-500">{n}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PropertiesView({ rows, focusId }: { rows: PropertyRow[]; focusId?: string }) {
  const [mode, setMode] = React.useState<"map" | "list">("map");
  const [markets, setMarkets] = React.useState<string[]>([]);
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [classes, setClasses] = React.useState<string[]>([]);
  const filtered = rows.filter((r) => (!markets.length || markets.includes(r.market)) && (!statuses.length || statuses.includes(r.status)) && (!classes.length || classes.includes(r.assetClass)));
  const counts = (k: keyof PropertyRow) => [...new Set(rows.map((r) => String(r[k])))].sort().map((v) => [v, rows.filter((r) => String(r[k]) === v).length] as [string, number]);

  return (
    <>
      <div className="mt-10 mb-6 flex items-center justify-between">
        <Segmented
          label="View"
          value={mode}
          onChange={setMode}
          options={[
            { value: "map", label: "Map" },
            { value: "list", label: "List" },
          ]}
        />
        <span className="num text-small text-ink-500">
          {filtered.length}/{rows.length}
        </span>
      </div>

      {mode === "map" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="flex flex-col gap-8 lg:col-span-3 xl:col-span-2">
            <FilterGroup title="Market" options={counts("market")} value={markets} onChange={setMarkets} />
            <FilterGroup title="Status" options={counts("status")} value={statuses} onChange={setStatuses} />
            <FilterGroup title="Asset class" options={counts("assetClass")} value={classes} onChange={setClasses} />
          </aside>
          <div className="relative h-[640px] overflow-hidden border border-ink-200 lg:col-span-9 xl:col-span-10">
            <PropertyMap points={filtered.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, market: r.market, sub: r.community }))} focusId={focusId} />
          </div>
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} initialSorting={[{ id: "name", desc: false }]} empty={{ glyph: "opportunities", headline: "No properties match these filters." }} />
      )}
    </>
  );
}
