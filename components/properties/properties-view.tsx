"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Building2, List, Map as MapIcon } from "lucide-react";
import * as React from "react";
import { DataTable } from "@/components/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Pill } from "@/components/ui/pill";
import { cn, formatMoney } from "@/lib/utils";
import { PropertyMap } from "./property-map";
import { PropertyThumb } from "./property-thumb";

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
  hue: number;
  grossYield: number;
}

const columns: ColumnDef<PropertyRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Property",
    size: 300,
    meta: { filterable: true },
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <PropertyThumb name={row.original.name} hue={row.original.hue} />
        <div className="min-w-0">
          <div className="truncate font-medium text-ink-900">{row.original.name}</div>
          <div className="truncate text-xs text-ink-500">{row.original.community}</div>
        </div>
      </div>
    ),
  },
  { accessorKey: "developer", header: "Developer", size: 190, meta: { filterable: true } },
  { accessorKey: "region", header: "Emirate / State", size: 150, meta: { filterable: true } },
  { accessorKey: "assetClass", header: "Asset class", size: 150, meta: { filterable: true } },
  {
    id: "price",
    accessorFn: (r) => r.priceMin,
    header: "Price range",
    size: 200,
    meta: { numeric: true },
    cell: ({ row }) => `${formatMoney(row.original.priceMin, row.original.currency)} – ${formatMoney(row.original.priceMax, row.original.currency).split(" ")[1]}`,
  },
  { accessorKey: "grossYield", header: "Yield", size: 90, meta: { numeric: true }, cell: ({ getValue }) => `${getValue<number>().toFixed(1)}%` },
  {
    accessorKey: "status",
    header: "Status",
    size: 170,
    meta: { filterable: true },
    cell: ({ getValue }) => {
      const v = getValue<string>();
      return <Pill tone={v === "Ready" ? "positive" : v === "Off-plan" ? "gold" : "navy"}>{v}</Pill>;
    },
  },
];

function FilterGroup({ title, options, value, onChange }: { title: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-3">{title}</legend>
      <div className="space-y-2.5">
        {options.map((o) => (
          <label key={o} className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-700">
            <Checkbox checked={value.includes(o)} onCheckedChange={(c) => onChange(c ? [...value, o] : value.filter((x) => x !== o))} />
            {o}
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
  const filtered = rows.filter(
    (r) => (!markets.length || markets.includes(r.market)) && (!statuses.length || statuses.includes(r.status)) && (!classes.length || classes.includes(r.assetClass)),
  );
  const uniq = (k: keyof PropertyRow) => [...new Set(rows.map((r) => String(r[k])))].sort();

  return (
    <>
      <div className="mt-10 mb-4 flex items-center justify-between">
        <div className="flex rounded-control border border-ink-200 bg-surface p-0.5" role="tablist">
          {(
            [
              ["map", "Map", MapIcon],
              ["list", "List", List],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              role="tab"
              aria-selected={mode === k}
              onClick={() => setMode(k)}
              className={cn("flex h-8 items-center gap-2 rounded-[4px] px-3 text-sm transition-colors", mode === k ? "bg-navy-100 text-navy-900" : "text-ink-600 hover:text-ink-900")}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>
        <span className="num text-xs text-ink-500">
          {filtered.length} of {rows.length} properties
        </span>
      </div>

      {mode === "map" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="space-y-8 rounded-card border border-ink-200 bg-surface p-5">
            <FilterGroup title="Market" options={uniq("market")} value={markets} onChange={setMarkets} />
            <FilterGroup title="Status" options={uniq("status")} value={statuses} onChange={setStatuses} />
            <FilterGroup title="Asset class" options={uniq("assetClass")} value={classes} onChange={setClasses} />
          </aside>
          <div className="relative h-[640px] overflow-hidden rounded-card border border-ink-200">
            <PropertyMap points={filtered.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, market: r.market, sub: r.community }))} focusId={focusId} />
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          initialSorting={[{ id: "name", desc: false }]}
          empty={{ icon: Building2, headline: "No properties match", subtext: "Clear a filter to see more." }}
        />
      )}
    </>
  );
}
