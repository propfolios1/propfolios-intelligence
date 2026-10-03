"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { AgentOutput } from "@/components/os/agent-output";
import { StructuredDetail } from "@/components/os/structured-detail";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";

type Out = { headline: string; points: { label: string; detail: string }[]; confidence: number } & Record<string, unknown>;

/** Runs one BI job and shows the agent's output inline. */
export function BiJob({ job, label, agent, body = {}, regions }: { job: string; label: string; agent: string; body?: Record<string, unknown>; regions?: string[] }) {
  const router = useRouter();
  const [region, setRegion] = React.useState(regions?.[0] ?? "");
  const [busy, setBusy] = React.useState(false);
  const [r, setR] = React.useState<{ output: Out; model: string; costUsd: number } | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {regions && (
          <Select value={region} onChange={(e) => setRegion(e.target.value)} className="w-44" aria-label="Market">
            {regions.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        )}
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await post("/api/bi/run", { job, ...body, ...(regions ? { region } : {}) }, { fail: `${agent} did not complete` });
            setBusy(false);
            if (res?.output) {
              setR(res);
              router.refresh();
            }
          }}
        >
          {busy ? "Running" : label}
        </Button>
      </div>
      {r && (
        <AgentOutput agent={agent} output={r.output} model={r.model} costUsd={r.costUsd} at={new Date().toISOString()}>
          <StructuredDetail output={r.output} />
        </AgentOutput>
      )}
    </div>
  );
}

export function SubscribeButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  return (
    <Button variant={active ? "secondary" : "primary"} onClick={async () => void ((await post(`/api/bi/products/${id}`, { active: !active }, { ok: active ? "Subscription cancelled" : "Subscribed" })) && router.refresh())}>
      {active ? "Cancel subscription" : "Subscribe"}
    </Button>
  );
}
