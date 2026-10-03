"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { AgentOutput } from "@/components/os/agent-output";
import { StructuredDetail } from "@/components/os/structured-detail";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";

type Out = { headline: string; points: { label: string; detail: string }[]; confidence: number } & Record<string, unknown>;

export function AccessRoleSelect({ userId, value, options, disabled }: { userId: string; value: string; options: { value: string; label: string }[]; disabled?: boolean }) {
  const router = useRouter();
  const [v, setV] = React.useState(value);
  const [busy, setBusy] = React.useState(false);
  return (
    <Select
      value={v}
      disabled={disabled || busy}
      className="w-52"
      aria-label="Access role"
      onChange={async (e) => {
        const next = e.target.value;
        const prev = v;
        setV(next);
        setBusy(true);
        const r = await post("/api/admin/access-roles", { userId, accessRole: next }, { ok: "Access role updated", fail: "Access role not changed" });
        setBusy(false);
        if (r) router.refresh();
        else setV(prev);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/** Runs the permission suggester for one person and shows its recommendation inline. */
export function PermissionSuggester({ users }: { users: { id: string; name: string }[] }) {
  const [userId, setUserId] = React.useState(users[0]?.id ?? "");
  const [busy, setBusy] = React.useState(false);
  const [r, setR] = React.useState<{ output: Out; model: string; costUsd: number } | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-60" aria-label="Team member">
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Button
          disabled={busy || !userId}
          onClick={async () => {
            setBusy(true);
            const res = await post("/api/admin/access-roles/suggest", { userId }, { fail: "Permission suggester did not complete" });
            setBusy(false);
            if (res?.output) setR(res);
          }}
        >
          {busy ? "Reviewing" : "Review access"}
        </Button>
      </div>
      {r && (
        <AgentOutput agent="Permission suggester" output={r.output} model={r.model} costUsd={r.costUsd} at={new Date().toISOString()}>
          <StructuredDetail output={r.output} />
        </AgentOutput>
      )}
    </div>
  );
}
