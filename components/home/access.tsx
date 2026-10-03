"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PLANS, type PlanId } from "@/lib/plans";

type Ctx = { open: (plan?: PlanId) => void };
const AccessContext = React.createContext<Ctx>({ open: () => {} });
export const useAccess = () => React.useContext(AccessContext);

/** One request-access dialog for the whole landing page; any CTA opens it, optionally on a plan. */
export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = React.useState<PlanId | null>(null);
  const value = React.useMemo<Ctx>(() => ({ open: (p) => setPlan(p ?? "professional") }), []);
  return (
    <AccessContext.Provider value={value}>
      {children}
      <Dialog open={plan !== null} onOpenChange={(o) => !o && setPlan(null)}>
        <DialogContent className="max-w-[520px] p-0">{plan && <AccessForm key={plan} initialPlan={plan} onDone={() => setPlan(null)} />}</DialogContent>
      </Dialog>
    </AccessContext.Provider>
  );
}

function AccessForm({ initialPlan, onDone }: { initialPlan: PlanId; onDone: () => void }) {
  const [plan, setPlan] = React.useState<PlanId>(initialPlan);
  const [state, setState] = React.useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [delivered, setDelivered] = React.useState(false);
  const selected = PLANS.find((p) => p.id === plan)!;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setError(null);
    const res = await fetch("/api/access-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: f.get("name"), email: f.get("email"), firm: f.get("firm"), market: f.get("market"), plan, note: f.get("note") }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { delivered?: boolean; error?: string } | null;
    if (!res?.ok) {
      setState("idle");
      setError(json?.error ?? "The request could not be sent. Check your connection and submit again.");
      return;
    }
    setDelivered(Boolean(json?.delivered));
    setState("sent");
  }

  if (state === "sent")
    return (
      <div className="p-8">
        <span className="home-pop flex size-10 items-center justify-center rounded-full bg-navy-900 text-surface">
          <Check className="size-5 stroke-[1.5]" />
        </span>
        <DialogTitle className="mt-6 font-display text-[24px] leading-tight text-navy-900">Request received</DialogTitle>
        <DialogDescription className="mt-2 text-ui text-ink-700">
          {delivered
            ? "The platform team has your request and replies within one business day with a walkthrough slot and a provisioned workspace."
            : "Your request is recorded in the platform queue. The team replies within one business day with a walkthrough slot and a provisioned workspace."}
        </DialogDescription>
        <Button className="mt-8" onClick={onDone}>
          Close
        </Button>
      </div>
    );

  return (
    <form onSubmit={submit}>
      <div className="border-b border-hairline p-6 pr-14">
        <DialogTitle className="font-display text-[24px] leading-tight text-navy-900">Request access</DialogTitle>
        <DialogDescription className="mt-1 text-ui text-ink-500">
          {selected.name} · <span className="num">AED {selected.priceAed.toLocaleString("en-US")}</span> per month. Workspaces are provisioned after a 30-minute walkthrough.
        </DialogDescription>
      </div>
      <div className="grid gap-4 p-6 sm:grid-cols-2">
        <Field label="Full name">
          <Input name="name" required minLength={2} autoComplete="name" />
        </Field>
        <Field label="Work email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Firm" className="sm:col-span-2">
          <Input name="firm" required minLength={2} autoComplete="organization" />
        </Field>
        <Field label="Markets">
          <Select name="market" defaultValue="UAE">
            <option value="UAE">UAE</option>
            <option value="India">India</option>
            <option value="Both">UAE and India</option>
          </Select>
        </Field>
        <Field label="Plan">
          <Select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mandates per month, markets, current tools" className="sm:col-span-2">
          <Textarea name="note" rows={3} maxLength={1000} />
        </Field>
        {error && (
          <p role="alert" className="text-ui text-danger sm:col-span-2">
            {error}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-hairline px-6 py-4">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending" : "Send request"}
        </Button>
      </div>
    </form>
  );
}
