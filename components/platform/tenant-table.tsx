"use client";

import { RelativeTime } from "@/components/ui/relative-time";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/composites/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { formatAed } from "@/lib/domain";

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  brand: string;
  primary: string;
  plan: string;
  status: string;
  mrrAed: number;
  staff: number;
  seatLimit: number | null;
  clients: number;
  mandates: number;
  aiCost30: number;
  createdAt: string;
}

const PLAN_LABEL: Record<string, string> = { starter: "Starter", professional: "Professional", enterprise: "Enterprise", white_label: "White-label" };

export function TenantStatus({ status }: { status: string }) {
  return <StatusPill tone={status === "active" ? "complete" : status === "trial" ? "progress" : status === "suspended" ? "error" : "neutral"}>{status}</StatusPill>;
}

const columns: ColumnDef<TenantRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Tenant",
    size: 260,
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ background: row.original.primary }} aria-hidden />
        <span className="truncate">
          <span className="font-medium text-ink-900">{row.original.name}</span>
          <span className="num text-mono text-ink-500"> · {row.original.slug}</span>
        </span>
      </span>
    ),
  },
  { accessorKey: "plan", header: "Plan", size: 130, cell: ({ getValue }) => PLAN_LABEL[getValue<string>()] ?? getValue<string>() },
  { accessorKey: "status", header: "Status", size: 110, cell: ({ getValue }) => <TenantStatus status={getValue<string>()} /> },
  { accessorKey: "mrrAed", header: "MRR", size: 120, meta: { numeric: true }, cell: ({ getValue }) => (getValue<number>() ? formatAed(getValue<number>()) : "—") },
  { id: "seats", accessorFn: (r) => r.staff, header: "Seats", size: 100, meta: { numeric: true }, cell: ({ row }) => `${row.original.staff} / ${row.original.seatLimit ?? "∞"}` },
  { accessorKey: "clients", header: "Clients", size: 90, meta: { numeric: true } },
  { accessorKey: "mandates", header: "Mandates", size: 100, meta: { numeric: true } },
  { accessorKey: "aiCost30", header: "AI cost, 30d", size: 120, meta: { numeric: true }, cell: ({ getValue }) => `$${getValue<number>().toFixed(2)}` },
  { accessorKey: "createdAt", header: "Since", size: 110, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-500"><RelativeTime iso={getValue<string>()} /></span> },
];

export function TenantTable({ rows }: { rows: TenantRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={rows}
      initialSorting={[{ id: "mrrAed", desc: true }]}
      onRowClick={(r) => router.push(`/platform/tenants/${r.id}`)}
      rowActions={[{ label: "Open as administrator", onSelect: (r) => (window.location.href = `/api/platform/impersonate?tenant=${r.id}`) }]}
      mobileCard={(r) => (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-ui font-medium text-ink-900">{r.name}</span>
            <TenantStatus status={r.status} />
          </div>
          <div className="text-small text-ink-500">
            {PLAN_LABEL[r.plan]} · {r.mrrAed ? formatAed(r.mrrAed) : "No revenue"} · {r.staff} seats
          </div>
        </div>
      )}
      empty={{ glyph: "mandates", headline: "No firms on the platform yet", note: "Firms join through self-serve sign-up, or you can create one with its plan, branding and administrator.", primary: { label: "Create tenant", href: "/platform/tenants/new" }, secondary: { label: "View pricing", href: "/pricing" } }}
    />
  );
}
