"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanCard = { id: "starter" | "professional"; name: string; monthly: number; annualMonthly: number; seats: string; features: string[] };

export function UpgradePlans({ plans, configured }: { plans: PlanCard[]; configured: boolean }) {
  const [interval, setInterval] = React.useState<"month" | "year">("year");
  const [busy, setBusy] = React.useState<string | null>(null);
  const go = async (plan: PlanCard["id"]) => {
    setBusy(plan);
    const r = await post("/api/billing/checkout", { plan, interval }, { fail: "Checkout did not open" });
    if (r?.url) window.location.assign(r.url);
    else setBusy(null);
  };
  return (
    <div>
      <div role="group" aria-label="Billing interval" className="inline-flex rounded-sm border border-hairline bg-canvas p-0.5">
        {(["month", "year"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={interval === k} onClick={() => setInterval(k)} className={cn("h-8 rounded-[4px] px-3 text-[13px] transition-colors duration-150", interval === k ? "bg-navy-900 text-surface" : "text-ink-700 hover:bg-ink-100")}>
            {k === "month" ? "Monthly" : "Annual, 20% less"}
          </button>
        ))}
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {plans.map((p) => (
          <li key={p.id} className={cn("flex flex-col rounded-md border bg-surface p-6", p.id === "professional" ? "border-navy-900" : "border-hairline")}>
            <h3 className="text-[18px] font-medium text-navy-900">{p.name}</h3>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="num text-[34px] leading-none text-navy-900">AED {(interval === "year" ? p.annualMonthly : p.monthly).toLocaleString("en-US")}</span>
              <span className="text-[13px] text-ink-500">per month{interval === "year" ? ", billed annually" : ""}, before VAT</span>
            </div>
            <p className="mt-2 text-[13px] text-ink-500">{p.seats}</p>
            <ul className="mt-5 flex-1 space-y-2 border-t border-hairline pt-5">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-[13px] text-ink-700">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-navy-700" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Button className="mt-6" variant={p.id === "professional" ? "primary" : "secondary"} disabled={!configured || Boolean(busy)} onClick={() => go(p.id)}>
              {busy === p.id ? "Opening checkout" : `Upgrade to ${p.name}`}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
