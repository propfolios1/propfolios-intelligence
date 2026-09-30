"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Mail, UserX } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Avatar } from "@/components/shell/sidebar-nav";
import { Pill } from "@/components/ui/pill";
import type { User } from "@/lib/data/types";
import { relativeTime } from "@/lib/utils";

const columns: ColumnDef<User, unknown>[] = [
  {
    accessorKey: "name",
    header: "Name",
    size: 260,
    meta: { filterable: true },
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={row.original.name} size={24} />
        <span className="truncate text-ink-900">{row.original.name}</span>
      </div>
    ),
  },
  { accessorKey: "email", header: "Email", size: 260, meta: { filterable: true } },
  {
    accessorKey: "role",
    header: "Role",
    size: 110,
    meta: { filterable: true },
    cell: ({ getValue }) => {
      const v = getValue<string>();
      return <Pill tone={v === "admin" ? "gold" : v === "analyst" ? "navy" : "neutral"} className="capitalize">{v}</Pill>;
    },
  },
  { accessorKey: "lastActive", header: "Last active", size: 120, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-500">{relativeTime(getValue<string>())}</span> },
];

export function UsersTable({ rows }: { rows: User[] }) {
  return (
    <DataTable
      dense
      columns={columns}
      data={rows}
      rowActions={[
        { label: "Resend invite", icon: Mail, onSelect: () => {} },
        { label: "Deactivate", icon: UserX, onSelect: () => {}, destructive: true },
      ]}
    />
  );
}
