"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { StatusPill } from "@/components/ui/status-pill";
import type { User } from "@/lib/data/types";
import { relativeTime } from "@/lib/utils";
import { DataTable } from "../data-table";

const columns: ColumnDef<User, unknown>[] = [
  { accessorKey: "name", header: "Name", size: 240, meta: { filterable: true } },
  { accessorKey: "email", header: "Email", size: 260, meta: { filterable: true, id: true } },
  { accessorKey: "role", header: "Role", size: 110, meta: { filterable: true }, cell: ({ getValue }) => <StatusPill tone={getValue<string>() === "admin" ? "progress" : "neutral"}>{getValue<string>()}</StatusPill> },
  { accessorKey: "lastActive", header: "Last active", size: 120, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-500">{relativeTime(getValue<string>())}</span> },
];

export function UsersTable({ rows }: { rows: User[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      showFilters
      rowActions={[
        { label: "Resend invitation", onSelect: () => {} },
        { label: "Deactivate", onSelect: () => {}, destructive: true },
      ]}
    />
  );
}
