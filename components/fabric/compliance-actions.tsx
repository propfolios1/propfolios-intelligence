"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";

type Retention = { uaeYears: number; indiaYears: number; euYears: number; auditYears: number };

/** Retention periods by jurisdiction; the minimums follow the AML statutes. */
export function RetentionForm({ initial }: { initial: Retention }) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const fields: [keyof Retention, string, string, number][] = [
    ["uaeYears", "UAE client records", "Federal Decree-Law 20 of 2018: minimum five years", 5],
    ["indiaYears", "India client records", "PMLA 2002 s.12: minimum five years", 5],
    ["euYears", "EU residents", "GDPR storage limitation; tax records commonly six", 1],
    ["auditYears", "Audit trail", "Firm policy: minimum five years", 5],
  ];
  return (
    <form
      className="rounded-md border border-hairline bg-surface p-6 shadow-card"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await post("/api/compliance/retention", v, { ok: "Retention policy saved", fail: "Retention policy not saved" });
        setBusy(false);
        if (r) router.refresh();
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([k, label, hint, min]) => (
          <Field key={k} label={label} hint={hint}>
            <Input type="number" min={min} max={15} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} className="num" aria-label={`${label}, years`} />
          </Field>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving" : "Save retention policy"}
        </Button>
      </div>
    </form>
  );
}

/** Logs a data subject request; the statutory due date is set from the regime. */
export function DataRequestForm({ clients }: { clients: { id: string; name: string; email: string | null }[] }) {
  const router = useRouter();
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [email, setEmail] = React.useState(clients[0]?.email ?? "");
  const [type, setType] = React.useState("access");
  const [regime, setRegime] = React.useState("UAE PDPL");
  const [busy, setBusy] = React.useState(false);
  return (
    <form
      className="grid gap-4 rounded-md border border-hairline bg-surface p-6 shadow-card sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await post("/api/compliance/request", { clientId: clientId || null, subjectEmail: email, type, regime }, { ok: "Request logged", fail: "Request not logged" });
        setBusy(false);
        if (r) router.refresh();
      }}
    >
      <Field label="Client">
        <Select
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            const c = clients.find((x) => x.id === e.target.value);
            if (c?.email) setEmail(c.email);
          }}
        >
          <option value="">Not a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Data subject email">
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Request">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="access">Access</option>
          <option value="portability">Portability</option>
          <option value="rectification">Rectification</option>
          <option value="deletion">Deletion</option>
        </Select>
      </Field>
      <Field label="Regime">
        <Select value={regime} onChange={(e) => setRegime(e.target.value)}>
          <option>UAE PDPL</option>
          <option>DPDP</option>
          <option>GDPR</option>
        </Select>
      </Field>
      <Button type="submit" disabled={busy || !email}>
        {busy ? "Logging" : "Log request"}
      </Button>
    </form>
  );
}

export function StepButton({ requestId, index, label, destructive }: { requestId: string; index: number; label: string; destructive?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant={destructive ? "destructive" : "secondary"}
      disabled={busy}
      onClick={async () => {
        if (destructive && !window.confirm("Erase this client's personal data? Records required under AML and tax law are kept in pseudonymised form. This cannot be undone.")) return;
        setBusy(true);
        const r = await post("/api/compliance/step", { requestId, index }, { ok: destructive ? "Personal data erased" : "Step completed", fail: "Step not completed" });
        setBusy(false);
        if (r) router.refresh();
      }}
    >
      {busy ? "Working" : label}
    </Button>
  );
}

export function ExportButton({ clientId }: { clientId: string }) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/compliance/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId }) });
        setBusy(false);
        if (!res.ok) return void toast.error("Export not generated");
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `data-export-${clientId.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Export downloaded");
      }}
    >
      {busy ? "Exporting" : "Export data"}
    </Button>
  );
}

export function ConsentToggle({ clientId, purpose, granted, jurisdiction }: { clientId: string; purpose: string; granted: boolean | null; jurisdiction: "UAE" | "India" | "EU" }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={granted === true}
      onClick={async () => {
        setBusy(true);
        const r = await post("/api/compliance/consent", { clientId, purpose, granted: !granted, jurisdiction }, { ok: granted ? "Consent withdrawn" : "Consent recorded" });
        setBusy(false);
        if (r) router.refresh();
      }}
      className="inline-flex h-6 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2 text-axis text-ink-700 transition-colors duration-150 hover:bg-ink-50 disabled:opacity-60"
    >
      <span className={"size-1.5 rounded-full " + (granted ? "bg-success" : granted === false ? "bg-danger" : "bg-ink-400")} aria-hidden />
      {granted ? "Granted" : granted === false ? "Withdrawn" : "Not asked"}
    </button>
  );
}
