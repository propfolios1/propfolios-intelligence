"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";
import { DataTable } from "@/components/composites/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/form";
import { Segmented } from "@/components/ui/segmented";
import { StatusPill } from "@/components/ui/status-pill";
import { formatLocal, PROPERTY_STATUS_LABEL } from "@/lib/domain";
import { useUi } from "@/lib/store";
import { PropertyMap } from "./property-map";

export interface PropertyRow {
  id: string;
  slug: string;
  name: string;
  developerName: string;
  region: string;
  city: string;
  community: string;
  market: "UAE" | "India";
  assetClass: string;
  status: string;
  priceMin: number;
  priceMax: number;
  pricePerSqft: number;
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
    cell: ({ row }) => (
      <div className="truncate text-ui">
        <span className="text-ink-900">{row.original.name}</span>
        <span className="text-ink-500">
          {" · "}
          {row.original.community}, {row.original.city}
        </span>
      </div>
    ),
  },
  { accessorKey: "developerName", header: "Developer", size: 190, cell: ({ getValue }) => <span className="text-ink-700">{getValue<string>()}</span> },
  { id: "price", accessorFn: (r) => r.priceMin, header: "From", size: 130, meta: { numeric: true }, cell: ({ row }) => formatLocal(row.original.priceMin, row.original.currency) },
  { accessorKey: "pricePerSqft", header: "Per sq ft", size: 110, meta: { numeric: true }, cell: ({ getValue }) => Math.round(getValue<number>()).toLocaleString("en-US") },
  { accessorKey: "grossYield", header: "Yield", size: 84, meta: { numeric: true }, cell: ({ getValue }) => `${getValue<number>().toFixed(1)}%` },
  {
    accessorKey: "status",
    header: "Status",
    size: 170,
    cell: ({ getValue }) => {
      const v = getValue<string>();
      return <StatusPill tone={v === "ready" ? "complete" : v === "off_plan" ? "neutral" : "progress"}>{PROPERTY_STATUS_LABEL[v] ?? v}</StatusPill>;
    },
  },
];

function FilterGroup({ title, options, value, onChange, labels = {} }: { title: string; options: [string, number][]; value: string[]; onChange: (v: string[]) => void; labels?: Record<string, string> }) {
  return (
    <fieldset className="border-t border-hairline pt-4">
      <legend className="eyebrow float-left mb-4 w-full">{title}</legend>
      <div className="clear-both flex flex-col gap-3">
        {options.map(([o, n]) => (
          <label key={o} className="flex cursor-pointer items-center gap-3 text-small text-ink-900">
            <Checkbox checked={value.includes(o)} onCheckedChange={(c) => onChange(c ? [...value, o] : value.filter((x) => x !== o))} />
            <span className="flex-1">{labels[o] ?? o}</span>
            <span className="num text-axis text-ink-500">{n}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PropertiesView({ rows, basePath = "/analyst/properties" }: { rows: PropertyRow[]; basePath?: string }) {
  const router = useRouter();
  const { propertyView: mode, setPropertyView: setMode } = useUi();
  const [q, setQ] = React.useState("");
  const [markets, setMarkets] = React.useState<string[]>([]);
  const [statuses, setStatuses] = React.useState<string[]>([]);
  const [classes, setClasses] = React.useState<string[]>([]);
  const filtered = rows.filter(
    (r) =>
      (!markets.length || markets.includes(r.market)) &&
      (!statuses.length || statuses.includes(r.status)) &&
      (!classes.length || classes.includes(r.assetClass)) &&
      (!q || `${r.name} ${r.community} ${r.city} ${r.developerName}`.toLowerCase().includes(q.toLowerCase())),
  );
  const counts = (k: keyof PropertyRow) => [...new Set(rows.map((r) => String(r[k])))].sort().map((v) => [v, rows.filter((r) => String(r[k]) === v).length] as [string, number]);

  return (
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
      <aside className="flex flex-col gap-6 lg:col-span-3 xl:col-span-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search properties" />
        <FilterGroup title="Market" options={counts("market")} value={markets} onChange={setMarkets} />
        <FilterGroup title="Status" options={counts("status")} value={statuses} onChange={setStatuses} labels={PROPERTY_STATUS_LABEL} />
        <FilterGroup title="Asset class" options={counts("assetClass")} value={classes} onChange={setClasses} />
      </aside>
      <div className="min-w-0 lg:col-span-9 xl:col-span-10">
        <div className="mb-4 flex items-center justify-between">
          <Segmented
            label="View"
            value={mode}
            onChange={setMode}
            options={[
              { value: "list", label: "List" },
              { value: "map", label: "Map" },
            ]}
          />
          <span className="num text-small text-ink-500">
            {filtered.length} of {rows.length}
          </span>
        </div>
        {mode === "map" ? (
          <div className="relative h-[620px] overflow-hidden rounded-md border border-hairline">
            <PropertyMap points={filtered.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, market: r.market, sub: r.community, href: `${basePath}/${r.slug}` }))} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            initialSorting={[{ id: "grossYield", desc: true }]}
            onRowClick={(r) => router.push(`${basePath}/${r.slug}`)}
            mobileCard={(r) => (
              <div>
                <div className="text-ui font-medium text-ink-900">{r.name}</div>
                <div className="text-small text-ink-500">
                  {r.community}, {r.city} · {r.developerName}
                </div>
                <div className="num mt-2 flex justify-between text-small text-ink-700">
                  <span>{formatLocal(r.priceMin, r.currency)}</span>
                  <span>{r.grossYield.toFixed(1)}% gross</span>
                </div>
              </div>
            )}
            empty={{ glyph: "opportunities", headline: "No properties match these filters", note: "Widen the price band or clear the market filter. Fifty-five projects across Dubai, Abu Dhabi, Mumbai and Goa are on file.", primary: { label: "Clear filters", href: "/analyst/properties" }, secondary: { label: "Open the India desk", href: "/analyst/india" } }}
          />
        )}
      </div>
    </div>
  );
}
