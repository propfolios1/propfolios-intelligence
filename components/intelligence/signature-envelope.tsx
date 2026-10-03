"use client";

import { PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import { formatDate } from "@/lib/utils";

export interface EnvelopeView {
  id: string;
  title: string;
  statement: string;
  status: "sent" | "signed" | "voided";
  signerName: string | null;
  signedAt: string | null;
  createdAt: string;
}

/** A signature request in the client portal: read the statement, type your name, sign. */
export function SignatureEnvelopeCard({ envelope, defaultName }: { envelope: EnvelopeView; defaultName: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(defaultName);
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  async function sign() {
    setBusy(true);
    const res = await fetch(`/api/envelopes/${envelope.id}/sign`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signerName: name, agree: true }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Not signed", { description: json.error });
    toast.success("Signed", { description: "Your advisory team has been notified." });
    setOpen(false);
    router.refresh();
  }
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-hairline bg-surface p-5 shadow-card">
      <div className="flex min-w-0 gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-navy-50 text-navy-900">
          <PenLine className="size-4 stroke-[1.5]" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="eyebrow">Signature request</div>
          <div className="mt-1 text-ui font-medium text-ink-900">{envelope.title}</div>
          <div className="mt-0.5 text-small text-ink-500">{envelope.status === "signed" ? `Signed by ${envelope.signerName} on ${formatDate(envelope.signedAt!)}` : envelope.status === "voided" ? "Withdrawn by your advisory team" : `Sent ${formatDate(envelope.createdAt)}`}</div>
        </div>
      </div>
      {envelope.status === "sent" ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          Review and sign
        </Button>
      ) : (
        <StatusPill tone={envelope.status === "signed" ? "complete" : "neutral"}>{envelope.status}</StatusPill>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="font-display text-section text-navy-900">{envelope.title}</DialogTitle>
          <DialogDescription className="mt-3 border-l-2 border-gold-500 pl-4 font-display text-read text-ink-900">{envelope.statement}</DialogDescription>
          <div className="mt-6 grid gap-4">
            <FormField label="Full name" htmlFor="signer">
              <Input id="signer" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </FormField>
            <label className="flex items-start gap-3 text-small text-ink-700">
              <Checkbox checked={agree} onCheckedChange={(v) => setAgree(v === true)} className="mt-0.5" />
              I agree that typing my name and selecting Sign constitutes my electronic signature. The time and source of signing are recorded.
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sign} disabled={busy || !agree || name.trim().length < 3}>
              Sign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
