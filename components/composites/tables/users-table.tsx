"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/form";
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

export function UsersTable({
  rows,
  selfId,
  clients,
}: {
  rows: UserRow[];
  selfId: string;
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [linking, setLinking] = React.useState<UserRow | null>(null);
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  async function setRole(u: UserRow, role: UserRow["role"], linkTo?: string) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: u.id, role, clientId: linkTo ?? u.clientId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok)
      return void toast.error("Role not changed", { description: json.error });
    toast.success(
      `${u.name} is now ${role === "admin" ? "an administrator" : `an ${role}`}`.replace(
        "an client",
        "a client",
      ),
    );
    router.refresh();
  }
  const columns: ColumnDef<UserRow, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      size: 220,
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    { accessorKey: "email", header: "Email", size: 260, meta: { id: true } },
    {
      accessorKey: "title",
      header: "Title or client",
      size: 240,
      cell: ({ row }) => (
        <span className="text-ink-700">
          {row.original.clientName ?? row.original.title ?? ""}
        </span>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      size: 110,
      cell: ({ getValue }) => (
        <StatusPill
          tone={getValue<string>() === "admin" ? "progress" : "neutral"}
        >
          {getValue<string>()}
        </StatusPill>
      ),
    },
    {
      accessorKey: "linked",
      header: "Sign-in",
      size: 110,
      cell: ({ getValue }) => (
        <span className="text-small text-ink-500">
          {getValue<boolean>() ? "Clerk linked" : "Invited"}
        </span>
      ),
    },
    {
      accessorKey: "lastActiveAt",
      header: "Last active",
      size: 120,
      meta: { numeric: true },
      cell: ({ getValue }) => (
        <span className="text-ink-500">
          {getValue<string | null>()
            ? relativeTime(getValue<string>())
            : "Never"}
        </span>
      ),
    },
  ];
  return (
    <>
      <Dialog open={!!linking} onOpenChange={(o) => !o && setLinking(null)}>
        <DialogContent>
          <DialogTitle className="font-display text-card text-navy-900">
            Link {linking?.name} to a client
          </DialogTitle>
          <DialogDescription className="mt-2 text-ui text-ink-700">
            The account becomes a client account and sees only this client&apos;s
            portfolio, documents and messages.
          </DialogDescription>
          <label className="mt-6 flex flex-col gap-1.5">
            <span className="text-ui font-medium text-ink-900">Client</span>
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setLinking(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (linking) await setRole(linking, "client", clientId);
                setLinking(null);
              }}
            >
              Link account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <DataTable
        columns={columns}
        data={rows}
        rowActions={[
          {
            label: "Make administrator",
            onSelect: (u) => void setRole(u, "admin"),
          },
          {
            label: "Make analyst",
            onSelect: (u) =>
              u.id === selfId
                ? toast.error("You cannot remove your own administrator role.")
                : void setRole(u, "analyst"),
          },
          {
            label: "Link to client record",
            onSelect: (u) =>
              u.id === selfId
                ? toast.error("You cannot remove your own administrator role.")
                : setLinking(u),
          },
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
    </>
  );
}
