"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { FormField, Input, Textarea } from "@/components/ui/form";

export function DocStatus({ clientId, type, status, expiresAt }: { clientId: string; type: string; status: string; expiresAt: string | null }) {
  const router = useRouter();
  const [exp, setExp] = React.useState(expiresAt ?? "");
  const set = async (st: string) => void ((await post(`/api/kyc/${clientId}/document`, { type, status: st, expiresAt: exp || null }, { ok: "Document updated" })) && router.refresh());
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} className="h-8 w-40" aria-label="Expiry date" />
      {status !== "received" && status !== "verified" && (
        <Button size="sm" variant="secondary" onClick={() => void set("received")}>
          Received
        </Button>
      )}
      {status !== "verified" && (
        <Button size="sm" onClick={() => void set("verified")}>
          Verify
        </Button>
      )}
      {status !== "rejected" && status !== "missing" && (
        <Button size="sm" variant="ghost" onClick={() => void set("rejected")}>
          Reject
        </Button>
      )}
    </div>
  );
}

export function KycDecision({ clientId, pep, sourceOfFunds }: { clientId: string; pep: boolean; sourceOfFunds: string | null }) {
  const router = useRouter();
  const [p, setP] = React.useState(pep);
  const [sof, setSof] = React.useState(sourceOfFunds ?? "");
  const [notes, setNotes] = React.useState("");
  const go = async (decision: "verified" | "rejected") => void ((await post(`/api/kyc/${clientId}/decide`, { decision, pep: p, sourceOfFunds: sof || null, notes: notes || undefined }, { ok: decision === "verified" ? "KYC verified" : "KYC rejected", fail: "Decision not recorded" })) && router.refresh());
  return (
    <div className="space-y-4 rounded-md border border-hairline bg-surface p-5 shadow-card">
      <FormField label="Source of funds" hint="What generated the wealth used for property, and the evidence held.">
        <Textarea rows={3} value={sof} onChange={(e) => setSof(e.target.value)} />
      </FormField>
      <label className="flex items-center gap-2 text-small text-ink-900">
        <input type="checkbox" checked={p} onChange={(e) => setP(e.target.checked)} className="accent-[var(--navy-900)]" />
        Politically exposed person (enhanced due diligence and senior approval)
      </label>
      <FormField label="Decision notes">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button variant="destructive" onClick={() => void go("rejected")}>
          Reject
        </Button>
        <Button onClick={() => void go("verified")}>Verify KYC</Button>
      </div>
    </div>
  );
}

export function AmlReview({ clientId, checkId }: { clientId: string; checkId: string }) {
  const router = useRouter();
  const go = async (outcome: "clear" | "confirmed_match") => void ((await post(`/api/kyc/${clientId}/aml-review`, { checkId, outcome }, { ok: outcome === "clear" ? "Alert cleared as a false positive" : "Match confirmed" })) && router.refresh());
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => void go("clear")}>
        False positive
      </Button>
      <Button size="sm" variant="destructive" onClick={() => void go("confirmed_match")}>
        Confirm
      </Button>
    </div>
  );
}

export function ServicingButton({ clientId, action, body, label, ok }: { clientId: string; action: string; body?: Record<string, unknown>; label: string; ok: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await post(`/api/clients/${clientId}/servicing/${action}`, body ?? {}, { ok });
        setBusy(false);
        if (r) router.refresh();
      }}
    >
      {busy ? "Working" : label}
    </Button>
  );
}
