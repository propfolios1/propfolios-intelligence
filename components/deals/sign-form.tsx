"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/form";

/** Public native signing: confirm the email the request was sent to, type the full name, consent, sign or decline. */
export function SignForm({ token, signerName }: { token: string; signerName: string }) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState(signerName);
  const [consent, setConsent] = React.useState(false);
  const [state, setState] = React.useState<{ busy: boolean; error?: string; done?: "signed" | "declined" }>({ busy: false });
  const go = async (decline: boolean) => {
    setState({ busy: true });
    const res = await fetch(`/api/sign/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name, consent: true, decline }) });
    const json = await res.json().catch(() => ({}));
    setState(res.ok ? { busy: false, done: decline ? "declined" : "signed" } : { busy: false, error: json.error ?? "Not signed." });
  };
  if (state.done)
    return (
      <div className="rounded-md border border-hairline bg-surface p-6 shadow-card">
        <div className="font-display text-section text-navy-900">{state.done === "signed" ? "Signed" : "Declined"}</div>
        <p className="mt-2 text-small text-ink-700">{state.done === "signed" ? "Your signature, the time and your network address have been recorded. Your adviser will send the completed document once every party has signed." : "Your adviser has been told you declined to sign."}</p>
      </div>
    );
  return (
    <div className="space-y-4 rounded-md border border-hairline bg-surface p-6 shadow-card">
      <FormField label="Your email address" hint="Must match the address this request was sent to.">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </FormField>
      <FormField label="Full name, as your signature">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="font-display text-card" />
      </FormField>
      <label className="flex items-start gap-2 text-small text-ink-700">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[var(--navy-900)]" />I have read the document and agree to sign it electronically. I understand that my electronic signature is binding.
      </label>
      {state.error && (
        <p role="alert" className="text-small text-danger">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={state.busy || !email} onClick={() => void go(true)}>
          Decline
        </Button>
        <Button disabled={state.busy || !consent || !email || name.trim().length < 3} onClick={() => void go(false)}>
          {state.busy ? "Signing" : "Sign"}
        </Button>
      </div>
    </div>
  );
}
