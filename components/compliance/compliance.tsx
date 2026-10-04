"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

type J = "AE" | "IN" | "GB" | "SG";
const J_LABEL: Record<J, string> = { AE: "United Arab Emirates", IN: "India", GB: "United Kingdom", SG: "Singapore" };

export function JurisdictionSelect({ value, onChange, allowed }: { value: J; onChange: (j: J) => void; allowed?: J[] }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as J)}>
      {(allowed?.length ? allowed : (Object.keys(J_LABEL) as J[])).map((j) => (
        <option key={j} value={j}>
          {J_LABEL[j]}
        </option>
      ))}
    </Select>
  );
}

/* --------------------------------------------------------------- screening */

export function ScreenForm({ jurisdictions }: { jurisdictions: J[] }) {
  const router = useRouter();
  const [f, setF] = React.useState({ name: "", entityType: "person", subjectType: "lead", birthDate: "", nationality: "", jurisdiction: jurisdictions[0] ?? "AE" });
  const [busy, setBusy] = React.useState(false);
  return (
    <form
      className="grid gap-4 rounded-md border border-hairline bg-surface p-5 sm:grid-cols-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await post("/api/compliance/screenings", { ...f, birthDate: f.birthDate || null, nationality: f.nationality || null }, { fail: "Not screened" });
        setBusy(false);
        if (r) {
          const st = r.screening.status as string;
          if (st === "clear") toast.success(`${f.name}: clear`, { description: `No matches on ${r.screening.provider}.` });
          else if (st === "error") toast.error("The provider did not respond", { description: "The result is recorded as an error, never as clear. Try again shortly." });
          else toast.warning(`${f.name}: ${st.replace("_", " ")}`, { description: "Review the hits and record a disposition." });
          setF({ ...f, name: "", birthDate: "", nationality: "" });
          router.refresh();
        }
      }}
    >
      <FormField label="Name" className="sm:col-span-2">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />
      </FormField>
      <FormField label="Subject">
        <Select value={f.subjectType} onChange={(e) => setF({ ...f, subjectType: e.target.value })}>
          <option value="lead">Lead or prospect</option>
          <option value="client">Client</option>
          <option value="counterparty">Counterparty</option>
          <option value="beneficial_owner">Beneficial owner</option>
        </Select>
      </FormField>
      <FormField label="Type">
        <Select value={f.entityType} onChange={(e) => setF({ ...f, entityType: e.target.value })}>
          <option value="person">Person</option>
          <option value="company">Company</option>
        </Select>
      </FormField>
      <FormField label={f.entityType === "person" ? "Date of birth" : "Registered"}>
        <Input type="date" value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} />
      </FormField>
      <FormField label="Nationality">
        <Input value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} placeholder="Optional" />
      </FormField>
      <FormField label="Jurisdiction" className="sm:col-span-2">
        <JurisdictionSelect value={f.jurisdiction as J} onChange={(j) => setF({ ...f, jurisdiction: j })} />
      </FormField>
      <div className="flex items-end sm:col-span-4">
        <Button type="submit" disabled={busy || f.name.trim().length < 2}>
          {busy ? "Screening" : "Screen"}
        </Button>
      </div>
    </form>
  );
}

export function Disposition({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const decide = async (outcome: "false_positive" | "confirmed_match") => {
    setBusy(true);
    const r = await post(`/api/compliance/screenings/${id}`, { outcome, note }, { fail: "Not recorded" });
    setBusy(false);
    if (r) {
      setOpen(false);
      router.refresh();
    }
  };
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Disposition
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[560px]">
          <DialogTitle>Disposition: {name}</DialogTitle>
          <DialogDescription>Record why the hit is or is not the subject: date of birth, nationality, middle names, photographs or other identifiers compared. The note is kept for seven years.</DialogDescription>
          <FormField label="Reasoning" className="mt-4">
            <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Listed person born 1961 in Moscow; our client born 1984 in Dubai, Emirati passport. Not the same person." />
          </FormField>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button disabled={busy || note.trim().length < 10} onClick={() => decide("false_positive")}>
              False positive
            </Button>
            <Button variant="secondary" disabled={busy || note.trim().length < 10} onClick={() => decide("confirmed_match")}>
              Confirmed match
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* --------------------------------------------------------------------- KYC */

export function StartKyc({ clients, jurisdictions }: { clients: { id: string; name: string }[]; jurisdictions: J[] }) {
  const router = useRouter();
  const [f, setF] = React.useState({ clientId: "", name: "", entityType: "person", jurisdiction: jurisdictions[0] ?? "AE", level: "standard", subjectType: "counterparty" });
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="grid gap-4 rounded-md border border-hairline bg-surface p-5 sm:grid-cols-6">
      <FormField label="Client" className="sm:col-span-2">
        <Select value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}>
          <option value="">Not a client: name below</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </FormField>
      {!f.clientId && (
        <FormField label="Name" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </FormField>
      )}
      <FormField label="Type">
        <Select value={f.entityType} onChange={(e) => setF({ ...f, entityType: e.target.value })}>
          <option value="person">Person</option>
          <option value="company">Company</option>
        </Select>
      </FormField>
      <FormField label="Level">
        <Select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
          <option value="simplified">Simplified</option>
          <option value="standard">Standard</option>
          <option value="enhanced">Enhanced</option>
        </Select>
      </FormField>
      <FormField label="Jurisdiction" className="sm:col-span-2">
        <JurisdictionSelect value={f.jurisdiction as J} onChange={(j) => setF({ ...f, jurisdiction: j })} />
      </FormField>
      <div className="flex items-end sm:col-span-4">
        <Button
          disabled={busy || (!f.clientId && f.name.trim().length < 2)}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/compliance/kyc", { ...f, clientId: f.clientId || null, name: f.name || undefined }, { fail: "Not started" });
            setBusy(false);
            if (r) router.push(`/admin/compliance/kyc?id=${r.verification.id}`);
          }}
        >
          Start due diligence
        </Button>
      </div>
    </div>
  );
}

type Doc = { type: string; label: string; documentId: string | null; status: "missing" | "uploaded" | "verified" | "rejected"; expiresAt: string | null; note?: string | null };
type Kyc = { id: string; name: string; status: string; level: "simplified" | "standard" | "enhanced"; documents: Doc[]; sourceOfFunds: string | null; sourceOfWealth: string | null; pepDeclared: boolean; beneficialOwners: { name: string; pct: number; nationality: string | null; pep: boolean }[]; entityType: "person" | "company"; riskRating: string; riskFactors: string[] };
const DOC_TONE = { missing: "neutral", uploaded: "progress", verified: "complete", rejected: "error" } as const;

export function KycReview({ k, canDecide }: { k: Kyc; canDecide: boolean }) {
  const router = useRouter();
  const [docs, setDocs] = React.useState(k.documents);
  const [f, setF] = React.useState({ sourceOfFunds: k.sourceOfFunds ?? "", sourceOfWealth: k.sourceOfWealth ?? "", pepDeclared: k.pepDeclared, level: k.level });
  const [owners, setOwners] = React.useState(k.beneficialOwners);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const locked = k.status === "approved" || k.status === "rejected";
  const save = async () => {
    setBusy(true);
    const r = await post(`/api/compliance/kyc/${k.id}`, { documents: docs.map((d) => ({ type: d.type, status: d.status, expiresAt: d.expiresAt })), sourceOfFunds: f.sourceOfFunds || null, sourceOfWealth: f.sourceOfWealth || null, pepDeclared: f.pepDeclared, level: f.level, beneficialOwners: owners }, { method: "PATCH", fail: "Not saved", ok: "Saved" });
    setBusy(false);
    if (r) {
      setDocs(r.verification.documents);
      router.refresh();
    }
  };
  return (
    <div className="grid gap-6">
      <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
        <table className="w-full min-w-[640px] text-ui">
          <thead>
            <tr className="border-b border-hairline label-caps">
              <th className="px-4 py-3 text-start font-medium">Document</th>
              <th className="px-3 py-3 text-start font-medium">File</th>
              <th className="px-3 py-3 text-start font-medium">Expires</th>
              <th className="px-4 py-3 text-start font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline-row">
            {docs.map((d, i) => (
              <tr key={d.type}>
                <td className="px-4 py-3 text-ink-900">{d.label}</td>
                <td className="px-3 py-3">
                  {d.documentId ? (
                    <a className="text-ink-700 underline underline-offset-4" href={`/api/documents/${d.documentId}`} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : (
                    <span className="text-ink-400">Not uploaded</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Input type="date" className="h-8 w-40" disabled={locked} value={d.expiresAt ?? ""} onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, expiresAt: e.target.value || null } : x)))} aria-label={`${d.label} expiry`} />
                </td>
                <td className="px-4 py-3">
                  {locked ? (
                    <StatusPill tone={DOC_TONE[d.status]}>{d.status}</StatusPill>
                  ) : (
                    <Select className="h-8 w-36" value={d.status} onChange={(e) => setDocs(docs.map((x, j) => (j === i ? { ...x, status: e.target.value as Doc["status"] } : x)))} aria-label={`${d.label} status`}>
                      <option value="missing">Missing</option>
                      <option value="uploaded">Received</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                    </Select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Source of funds" hint="Where the money for this transaction comes from, with the evidence seen.">
          <Textarea rows={3} disabled={locked} value={f.sourceOfFunds} onChange={(e) => setF({ ...f, sourceOfFunds: e.target.value })} />
        </FormField>
        <FormField label="Source of wealth" hint="How the subject's overall wealth was accumulated. Required for enhanced due diligence.">
          <Textarea rows={3} disabled={locked} value={f.sourceOfWealth} onChange={(e) => setF({ ...f, sourceOfWealth: e.target.value })} />
        </FormField>
        <FormField label="Due diligence level">
          <Select disabled={locked} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as Kyc["level"] })}>
            <option value="simplified">Simplified</option>
            <option value="standard">Standard</option>
            <option value="enhanced">Enhanced</option>
          </Select>
        </FormField>
        <label className="flex items-center gap-2 pt-7 text-ui text-ink-700">
          <Checkbox disabled={locked} checked={f.pepDeclared} onCheckedChange={(v) => setF({ ...f, pepDeclared: Boolean(v) })} /> Politically exposed person, family member or close associate
        </label>
      </div>
      {k.entityType === "company" && (
        <div className="grid gap-2">
          <div className="label-caps">Beneficial owners</div>
          {owners.map((o, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_90px_160px_auto_28px] items-center gap-2">
              <Input value={o.name} disabled={locked} onChange={(e) => setOwners(owners.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Owner name" />
              <Input type="number" className="num" disabled={locked} value={o.pct} onChange={(e) => setOwners(owners.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) || 0 } : x)))} aria-label="Ownership %" />
              <Input value={o.nationality ?? ""} disabled={locked} placeholder="Nationality" onChange={(e) => setOwners(owners.map((x, j) => (j === i ? { ...x, nationality: e.target.value || null } : x)))} aria-label="Nationality" />
              <label className="flex items-center gap-1.5 text-[12px] text-ink-700">
                <Checkbox disabled={locked} checked={o.pep} onCheckedChange={(v) => setOwners(owners.map((x, j) => (j === i ? { ...x, pep: Boolean(v) } : x)))} /> PEP
              </label>
              <button type="button" disabled={locked} className="text-ink-400 hover:text-ink-900" aria-label="Remove owner" onClick={() => setOwners(owners.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
          {!locked && (
            <div>
              <Button size="sm" variant="ghost" onClick={() => setOwners([...owners, { name: "", pct: 25, nationality: null, pep: false }])}>
                Add beneficial owner
              </Button>
            </div>
          )}
        </div>
      )}
      {!locked && (
        <div>
          <Button variant="secondary" disabled={busy} onClick={save}>
            Save
          </Button>
        </div>
      )}
      {canDecide && !locked && (
        <div className="grid gap-3 rounded-md border border-hairline bg-surface p-5">
          <div className="label-caps">Decision</div>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The basis for the decision: documents certified, screening outcome, source of funds evidence reviewed." aria-label="Decision note" />
          <div className="flex flex-wrap gap-2">
            {(["approved", "rejected"] as const).map((d) => (
              <Button
                key={d}
                variant={d === "approved" ? "primary" : "secondary"}
                disabled={busy || note.trim().length < 5}
                onClick={async () => {
                  setBusy(true);
                  await post(`/api/compliance/kyc/${k.id}`, { documents: docs.map((x) => ({ type: x.type, status: x.status, expiresAt: x.expiresAt })), sourceOfFunds: f.sourceOfFunds || null, sourceOfWealth: f.sourceOfWealth || null, pepDeclared: f.pepDeclared, level: f.level, beneficialOwners: owners }, { method: "PATCH", fail: "Not saved" });
                  const r = await post(`/api/compliance/kyc/${k.id}`, { decision: d, note }, { fail: d === "approved" ? "Not approved" : "Not rejected" });
                  setBusy(false);
                  if (r) {
                    toast.success(d === "approved" ? `Approved, ${r.verification.riskRating} risk` : "Rejected");
                    router.refresh();
                  }
                }}
              >
                {d === "approved" ? "Approve" : "Reject"}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- reports */

const REPORT_TYPES: Record<J, [string, string][]> = {
  AE: [
    ["str", "Suspicious Transaction Report (goAML)"],
    ["rear", "Real Estate Activity Report (goAML)"],
    ["kyc_register", "Customer due diligence register"],
  ],
  IN: [
    ["str", "Suspicious Transaction Report (FINnet)"],
    ["ctr", "Cash Transaction Report, monthly (FINnet)"],
    ["kyc_register", "Client due diligence register"],
  ],
  GB: [
    ["sar", "Suspicious Activity Report (NCA SAR Portal)"],
    ["kyc_register", "Customer due diligence register"],
  ],
  SG: [
    ["str", "Suspicious Transaction Report (STRO SONAR)"],
    ["kyc_register", "Customer due diligence register"],
  ],
};

export function ReportForm({ jurisdictions, deals }: { jurisdictions: J[]; deals: { id: string; label: string }[] }) {
  const router = useRouter();
  const [f, setF] = React.useState({ jurisdiction: (jurisdictions[0] ?? "AE") as J, type: "str", dealId: "", period: new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 7), reason: "", indicators: "", action: "" });
  const [busy, setBusy] = React.useState(false);
  const suspicion = f.type === "str" || f.type === "sar";
  const needsDeal = f.type === "str" || f.type === "sar" || f.type === "rear";
  return (
    <div className="grid gap-4 rounded-md border border-hairline bg-surface p-5 sm:grid-cols-6">
      <FormField label="Jurisdiction" className="sm:col-span-2">
        <JurisdictionSelect value={f.jurisdiction} onChange={(j) => setF({ ...f, jurisdiction: j, type: REPORT_TYPES[j][0]![0] })} />
      </FormField>
      <FormField label="Report" className="sm:col-span-4">
        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {REPORT_TYPES[f.jurisdiction].map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Select>
      </FormField>
      {needsDeal && (
        <FormField label="Deal" className="sm:col-span-3">
          <Select value={f.dealId} onChange={(e) => setF({ ...f, dealId: e.target.value })}>
            <option value="">Choose the deal</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </Select>
        </FormField>
      )}
      {f.type === "ctr" && (
        <FormField label="Month" className="sm:col-span-2">
          <Input type="month" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} />
        </FormField>
      )}
      {suspicion && (
        <>
          <FormField label="Grounds for suspicion" className="sm:col-span-6" hint="What was seen, when, and why it is suspicious. Facts, not conclusions.">
            <Textarea rows={4} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </FormField>
          <FormField label="Indicators" className="sm:col-span-3" hint="One per line.">
            <Textarea rows={3} value={f.indicators} onChange={(e) => setF({ ...f, indicators: e.target.value })} placeholder={"Third-party payment from an unrelated company\nReluctance to provide source of funds"} />
          </FormField>
          <FormField label="Action taken" className="sm:col-span-3">
            <Textarea rows={3} value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} placeholder="Transaction paused; no further funds accepted." />
          </FormField>
        </>
      )}
      <div className="sm:col-span-6">
        <Button
          disabled={busy || (needsDeal && !f.dealId) || (suspicion && f.reason.trim().length < 20)}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/compliance/reports", { jurisdiction: f.jurisdiction, type: f.type, dealId: needsDeal ? f.dealId : null, period: f.type === "ctr" ? f.period : null, reason: suspicion ? f.reason : null, indicators: f.indicators.split("\n").map((x) => x.trim()).filter((x) => x.length >= 3), action: f.action || null }, { fail: "Not prepared" });
            setBusy(false);
            if (r) {
              toast.success("Report prepared", { description: "Download it, file it with the FIU, then record the reference." });
              router.refresh();
            }
          }}
        >
          {busy ? "Preparing" : "Prepare report"}
        </Button>
      </div>
    </div>
  );
}

export function ReportActions({ id, status, needsReference }: { id: string; status: string; needsReference: boolean }) {
  const router = useRouter();
  const [ref, setRef] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const set = async (s: "ready" | "filed" | "withdrawn") => {
    const r = await post(`/api/compliance/reports/${id}`, { status: s, reference: ref || null }, { method: "PATCH", fail: "Not updated" });
    if (r) {
      setOpen(false);
      router.refresh();
    }
  };
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button asChild size="sm" variant="ghost">
        <a href={`/api/compliance/reports/${id}`}>Download</a>
      </Button>
      {status !== "filed" && status !== "withdrawn" && (
        <>
          <Button size="sm" variant="secondary" onClick={() => (needsReference ? setOpen(true) : set("filed"))}>
            {needsReference ? "Record filing" : "Mark complete"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => set("withdrawn")}>
            Withdraw
          </Button>
        </>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogTitle>Record the filing</DialogTitle>
          <DialogDescription>Enter the reference the FIU issued on submission. A filed report is locked.</DialogDescription>
          <FormField label="Filing reference" className="mt-4">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="For example, the goAML report ID" />
          </FormField>
          <div className="mt-5">
            <Button disabled={!ref.trim()} onClick={() => set("filed")}>
              Record as filed
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ComplianceSettings({ settings }: { settings: { goamlEntityId: string | null; mlroName: string | null; mlroEmail: string | null; highRiskCountries: string[]; jurisdictions: J[] } }) {
  const router = useRouter();
  const [f, setF] = React.useState({ ...settings, highRisk: settings.highRiskCountries.join("\n") });
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Money Laundering Reporting Officer">
        <Input value={f.mlroName ?? ""} onChange={(e) => setF({ ...f, mlroName: e.target.value })} />
      </FormField>
      <FormField label="MLRO email">
        <Input type="email" value={f.mlroEmail ?? ""} onChange={(e) => setF({ ...f, mlroEmail: e.target.value })} />
      </FormField>
      <FormField label="goAML reporting entity ID" hint="Issued by the UAE FIU on registration.">
        <Input className="num" value={f.goamlEntityId ?? ""} onChange={(e) => setF({ ...f, goamlEntityId: e.target.value })} />
      </FormField>
      <div>
        <div className="label-caps mb-2">Jurisdictions the firm operates in</div>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(J_LABEL) as J[]).map((j) => (
            <label key={j} className="flex items-center gap-2 text-ui text-ink-700">
              <Checkbox checked={f.jurisdictions.includes(j)} onCheckedChange={(v) => setF({ ...f, jurisdictions: v ? [...f.jurisdictions, j] : f.jurisdictions.filter((x) => x !== j) })} /> {J_LABEL[j]}
            </label>
          ))}
        </div>
      </div>
      <FormField label="High-risk countries" hint="One per line. Review after each FATF plenary (February, June and October)." className="sm:col-span-2">
        <Textarea rows={4} value={f.highRisk} onChange={(e) => setF({ ...f, highRisk: e.target.value })} />
      </FormField>
      <div>
        <Button
          disabled={busy || !f.jurisdictions.length}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/compliance", { goamlEntityId: f.goamlEntityId || null, mlroName: f.mlroName || null, mlroEmail: f.mlroEmail || null, jurisdictions: f.jurisdictions, highRiskCountries: f.highRisk.split("\n").map((x) => x.trim()).filter((x) => x.length >= 2) }, { method: "PATCH", fail: "Not saved", ok: "Settings saved" });
            setBusy(false);
            if (r) router.refresh();
          }}
        >
          Save settings
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- deal */

type Check = { id: string; rule: string; title: string; status: "pass" | "action_required" | "fail" | "waived"; detail: string; basis: string; waiverReason: string | null };
type Pay = { id: string; milestone: string; amount: number; method: string | null; cashAmount: number | null };
const CHECK_TONE = { pass: "complete", action_required: "progress", fail: "error", waived: "neutral" } as const;

export function DealCompliance({ dealId, checks, payments, currency, canWaive }: { dealId: string; checks: Check[]; payments: Pay[]; currency: string; canWaive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const act = async (body: Record<string, unknown>, ok?: string) => {
    setBusy(true);
    const r = await post(`/api/compliance/deals/${dealId}`, body, { fail: "Not updated", ok });
    setBusy(false);
    if (r) router.refresh();
  };
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={busy} onClick={() => act({ action: "evaluate" }, "Checks evaluated")}>
          {checks.length ? "Re-evaluate" : "Evaluate AML checks"}
        </Button>
        {!checks.length && <span className="text-ui text-ink-500">Checks customer due diligence, screening of both parties, enhanced due diligence triggers, cash thresholds and open reports.</span>}
      </div>
      {checks.length > 0 && (
        <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
          {checks.map((c) => (
            <li key={c.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-ui text-ink-900">
                  {c.title} <StatusPill tone={CHECK_TONE[c.status]}>{c.status.replace("_", " ")}</StatusPill>
                  <span className="text-[11px] tracking-[0.06em] text-ink-500 uppercase">{c.basis === "statutory" ? "Statutory" : "Firm policy"}</span>
                </div>
                <p className="mt-1 text-[13px] text-ink-700">{c.detail}</p>
                {c.waiverReason && <p className="mt-1 text-[12px] text-ink-500">Waived: {c.waiverReason}</p>}
              </div>
              {canWaive && c.status === "action_required" && <WaiveButton onWaive={(reason) => act({ action: "waive", checkId: c.id, reason })} />}
            </li>
          ))}
        </ul>
      )}
      {payments.length > 0 && (
        <div>
          <div className="label-caps mb-2">How each payment was made</div>
          <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
            {payments.map((p) => (
              <PaymentMethodRow key={p.id} p={p} currency={currency} onSave={(method, cashAmount) => act({ action: "payment_method", paymentId: p.id, method, cashAmount })} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function WaiveButton({ onWaive }: { onWaive: (reason: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Waive
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[480px]">
          <DialogTitle>Waive this check</DialogTitle>
          <DialogDescription>Waivers are recorded against your name and kept for seven years. A failed statutory check cannot be waived.</DialogDescription>
          <FormField label="Reason" className="mt-4">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </FormField>
          <div className="mt-5">
            <Button
              disabled={reason.trim().length < 10}
              onClick={() => {
                onWaive(reason);
                setOpen(false);
              }}
            >
              Record waiver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PaymentMethodRow({ p, currency, onSave }: { p: Pay; currency: string; onSave: (method: string, cash: number | null) => void }) {
  const [method, setMethod] = React.useState(p.method ?? "");
  const [cash, setCash] = React.useState(p.cashAmount ? String(p.cashAmount) : "");
  const dirty = method !== (p.method ?? "") || cash !== (p.cashAmount ? String(p.cashAmount) : "");
  return (
    <li className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_170px_150px_auto]">
      <div className="text-ui text-ink-900">
        {p.milestone} <span className="num text-[12px] text-ink-500">{currency} {p.amount.toLocaleString("en-US")}</span>
      </div>
      <Select className="h-9" value={method} onChange={(e) => setMethod(e.target.value)} aria-label={`${p.milestone} payment method`}>
        <option value="">Not recorded</option>
        <option value="bank_transfer">Bank transfer</option>
        <option value="cheque">Cheque</option>
        <option value="cash">Cash</option>
        <option value="mixed">Part cash</option>
        <option value="virtual_asset">Virtual asset</option>
      </Select>
      <Input className={cn("num h-9", method !== "mixed" && method !== "cash" && "invisible")} type="number" min={0} value={cash} placeholder="Cash amount" onChange={(e) => setCash(e.target.value)} aria-label="Cash amount" />
      <Button size="sm" variant="secondary" disabled={!dirty || !method} onClick={() => onSave(method, cash ? Number(cash) : null)}>
        Save
      </Button>
    </li>
  );
}

/* ------------------------------------------------------------------ client */

export function ClientKyc({ initial }: { initial: Kyc & { status: string; decisionNote: string | null } }) {
  const router = useRouter();
  const [k, setK] = React.useState(initial);
  const [f, setF] = React.useState({ sourceOfFunds: k.sourceOfFunds ?? "", sourceOfWealth: k.sourceOfWealth ?? "", pepDeclared: k.pepDeclared });
  const [busy, setBusy] = React.useState<string | null>(null);
  const editable = k.status === "draft" || k.status === "rejected";
  const upload = async (type: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) return void toast.error("Files must be 10 MB or smaller.");
    setBusy(type);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("type", "kyc");
    fd.set("title", `${k.documents.find((d) => d.type === type)?.label ?? "KYC document"}`);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(null);
      return void toast.error("Upload failed", { description: json.error });
    }
    const r = await post("/api/client/kyc", { documents: [{ type, documentId: json.id }] }, { method: "PATCH", fail: "Not attached" });
    setBusy(null);
    if (r) setK(r.verification);
  };
  const done = k.documents.filter((d) => d.status !== "missing").length;
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill tone={k.status === "approved" ? "complete" : k.status === "rejected" || k.status === "expired" ? "error" : k.status === "draft" ? "neutral" : "progress"}>{k.status === "draft" ? "To complete" : k.status === "submitted" || k.status === "in_review" ? "With your adviser" : k.status}</StatusPill>
        <span className="num text-ui text-ink-700">
          {done} of {k.documents.length} documents
        </span>
      </div>
      {k.status === "rejected" && k.decisionNote && <p className="rounded-md border border-hairline bg-surface p-4 text-ui text-ink-900">Your adviser asked for changes: {k.decisionNote}</p>}
      <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
        {k.documents.map((d) => (
          <li key={d.type} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="text-ui text-ink-900">{d.label}</div>
              <div className="text-[12px] text-ink-500">{d.status === "missing" ? "Not provided" : d.status === "verified" ? "Verified by your adviser" : d.status === "rejected" ? "Please provide a clearer or current copy" : "Received"}</div>
            </div>
            {editable && (
              <label className={cn("inline-flex h-9 cursor-pointer items-center rounded-sm border border-hairline px-3 text-ui text-ink-900 transition-colors duration-150 hover:bg-ink-50", busy === d.type && "opacity-60")}>
                {busy === d.type ? "Uploading" : d.status === "missing" ? "Upload" : "Replace"}
                <input type="file" accept="application/pdf,image/*" className="sr-only" disabled={busy !== null} onChange={(e) => e.target.files?.[0] && upload(d.type, e.target.files[0])} />
              </label>
            )}
          </li>
        ))}
      </ul>
      <div className="grid gap-4">
        <FormField label="Source of funds" hint="Where the money for this purchase comes from: for example, savings from salary, the sale of another property, or a mortgage from a named bank.">
          <Textarea rows={3} disabled={!editable} value={f.sourceOfFunds} onChange={(e) => setF({ ...f, sourceOfFunds: e.target.value })} />
        </FormField>
        <FormField label="Source of wealth" hint="How your wealth was built over time. Your adviser may ask for this.">
          <Textarea rows={3} disabled={!editable} value={f.sourceOfWealth} onChange={(e) => setF({ ...f, sourceOfWealth: e.target.value })} />
        </FormField>
        <label className="flex items-start gap-2 text-ui text-ink-700">
          <Checkbox className="mt-1" disabled={!editable} checked={f.pepDeclared} onCheckedChange={(v) => setF({ ...f, pepDeclared: Boolean(v) })} />
          I hold, or have held in the last twelve months, a prominent public function, or am a family member or close associate of someone who does.
        </label>
      </div>
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("save");
              const r = await post("/api/client/kyc", { sourceOfFunds: f.sourceOfFunds || null, sourceOfWealth: f.sourceOfWealth || null, pepDeclared: f.pepDeclared }, { method: "PATCH", fail: "Not saved", ok: "Saved" });
              setBusy(null);
              if (r) setK(r.verification);
            }}
          >
            Save
          </Button>
          <Button
            disabled={busy !== null || done < k.documents.length || !f.sourceOfFunds.trim()}
            onClick={async () => {
              setBusy("submit");
              await post("/api/client/kyc", { sourceOfFunds: f.sourceOfFunds || null, sourceOfWealth: f.sourceOfWealth || null, pepDeclared: f.pepDeclared }, { method: "PATCH", fail: "Not saved" });
              const r = await post("/api/client/kyc", {}, { fail: "Not submitted" });
              setBusy(null);
              if (r) {
                setK(r.verification);
                toast.success("Submitted to your adviser", { description: "You will be notified when the review is complete." });
                router.refresh();
              }
            }}
          >
            Submit for review
          </Button>
        </div>
      )}
    </div>
  );
}
