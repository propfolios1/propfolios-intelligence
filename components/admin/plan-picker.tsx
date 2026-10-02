"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { PLANS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

export function PlanPicker({ current, seatsUsed }: { current: PlanId; seatsUsed: number }) {
  const router = useRouter();
  const [target, setTarget] = React.useState<PlanId | null>(null);
  const [busy, setBusy] = React.useState(false);
  const plan = PLANS.find((p) => p.id === target);

  async function confirm() {
    if (!target) return;
    setBusy(true);
    const res = await fetch("/api/tenants/me/plan", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: target }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setTarget(null);
    if (!res.ok) return void toast.error("Plan not changed", { description: json.error });
    toast.success(`You are now on ${plan?.name}`, { description: "The change is reflected on your next invoice." });
    router.refresh();
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const isCurrent = p.id === current;
          const blocked = p.seats !== null && seatsUsed > p.seats;
          return (
            <li key={p.id} className={cn("flex flex-col rounded-md border bg-surface p-5 shadow-card", isCurrent ? "border-navy-900" : "border-ink-200")}>
              <div className="flex items-baseline justify-between">
                <span className="text-ui font-medium text-ink-900">{p.name}</span>
                {isCurrent && <span className="eyebrow text-gold-600">Current</span>}
              </div>
              <div className="num mt-3 text-card text-navy-900">AED {p.priceAed.toLocaleString("en-US")}</div>
              <div className="text-small text-ink-500">per month · {p.seats === null ? "unlimited seats" : `${p.seats} seats`}</div>
              <p className="mt-3 flex-1 text-small text-ink-700">{p.summary}</p>
              <Button className="mt-4" variant={isCurrent ? "ghost" : "secondary"} disabled={isCurrent || blocked} onClick={() => setTarget(p.id)}>
                {isCurrent ? "Your plan" : blocked ? `${seatsUsed} seats in use` : `Switch to ${p.name}`}
              </Button>
            </li>
          );
        })}
      </ul>
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogTitle className="font-display text-card text-navy-900">Switch to {plan?.name}?</DialogTitle>
          <DialogDescription className="mt-2 text-ui text-ink-700">
            AED {plan?.priceAed.toLocaleString("en-US")} a month plus VAT from today, invoiced in AED. {plan?.seats === null ? "Seats become unlimited." : `The plan includes ${plan?.seats} staff seats.`}
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={busy}>
              {busy ? "Switching" : "Confirm plan change"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
