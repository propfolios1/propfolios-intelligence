"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField, Input, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";

export function InviteDialog({ clients, seats }: { clients: { id: string; name: string }[]; seats: { used: number; limit: number | null } }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<"analyst" | "tenant_admin" | "client">("analyst");
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const full = seats.limit !== null && seats.used >= seats.limit;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name: name || undefined, role, clientId: role === "client" ? clientId : null }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Invitation not sent", { description: json.error ?? "Check the email address." });
    toast.success(`Invitation sent to ${email}`);
    setOpen(false);
    setEmail("");
    setName("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Invite people</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="font-display text-card text-navy-900">Invite to the workspace</DialogTitle>
        <DialogDescription className="mt-1 text-ui text-ink-700">
          {seats.limit === null ? "Unlimited staff seats on your plan." : `${seats.used} of ${seats.limit} staff seats in use. Clients do not use seats.`}
        </DialogDescription>
        <form onSubmit={submit} className="mt-6 grid gap-5">
          <FormField label="Email" htmlFor="invite-email">
            <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@yourfirm.ae" />
          </FormField>
          <FormField label="Name" htmlFor="invite-name" hint="Optional. Taken from their account when they sign up.">
            <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Role" htmlFor="invite-role">
            <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="analyst" disabled={full}>
                Analyst{full ? " (no seats left)" : ""}
              </option>
              <option value="tenant_admin" disabled={full}>
                Administrator{full ? " (no seats left)" : ""}
              </option>
              <option value="client">Client</option>
            </Select>
          </FormField>
          {role === "client" && (
            <FormField label="Client record" htmlFor="invite-client" hint="The client sees only this portfolio.">
              <Select id="invite-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || (full && role !== "client")}>
              {busy ? "Sending" : "Send invitation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
