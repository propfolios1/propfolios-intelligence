"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import { relativeTime } from "@/lib/utils";
import { DataTable } from "../data-table";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  title: string | null;
  role: "admin" | "analyst" | "client";
  clientId: string | null;
  clientName: string | null;
  lastActiveAt: string | null;
  linked: boolean;
}

export function UsersTable({ rows, selfId }: { rows: UserRow[]; selfId: string }) {
  const router = useRouter();
  async function setRole(u: UserRow, role: UserRow["role"]) {
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: u.id, role, clientId: u.clientId }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return void toast.error("Role not changed", { description: json.error });
    toast.success(`${u.name} is now ${role === "admin" ? "an administrator" : `an ${role}`}`.replace("an client", "a client"));
    router.refresh();
  }
  const columns: ColumnDef<UserRow, unknown>[] = [
    { accessorKey: "name", header: "Name", size: 220, cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "email", header: "Email", size: 260, meta: { id: true } },
    { accessorKey: "title", header: "Title or client", size: 240, cell: ({ row }) => <span className="text-ink-700">{row.original.clientName ?? row.original.title ?? ""}</span> },
    { accessorKey: "role", header: "Role", size: 110, cell: ({ getValue }) => <StatusPill tone={getValue<string>() === "admin" ? "progress" : "neutral"}>{getValue<string>()}</StatusPill> },
    { accessorKey: "linked", header: "Sign-in", size: 110, cell: ({ getValue }) => <span className="text-small text-ink-500">{getValue<boolean>() ? "Clerk linked" : "Invited"}</span> },
    { accessorKey: "lastActiveAt", header: "Last active", size: 120, meta: { numeric: true }, cell: ({ getValue }) => <span className="text-ink-500">{getValue<string | null>() ? relativeTime(getValue<string>()) : "Never"}</span> },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      rowActions={[
        { label: "Make administrator", onSelect: (u) => void setRole(u, "admin") },
        { label: "Make analyst", onSelect: (u) => (u.id === selfId ? toast.error("You cannot remove your own administrator role.") : void setRole(u, "analyst")) },
        { label: "Make client", onSelect: (u) => (u.clientId ? void setRole(u, "client") : toast.error("Link a client record first. Clients are linked automatically when they sign up with the email on file.")) },
      ]}
      mobileCard={(u) => (
        <div>
          <div className="flex justify-between">
            <span className="text-ui font-medium">{u.name}</span>
            <StatusPill>{u.role}</StatusPill>
          </div>
          <div className="text-small text-ink-500">{u.email}</div>
        </div>
      )}
    />
  );
}
