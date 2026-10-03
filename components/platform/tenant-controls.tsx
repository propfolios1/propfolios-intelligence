"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { PLANS } from "@/lib/plans";

type Features = { assistant: boolean; clientPortal: boolean; marketTiming: boolean; crossBorder: boolean };

const FEATURE_LABEL: Record<keyof Features, [string, string]> = {
  assistant: ["Assistant", "Natural-language assistant for staff and clients"],
  clientPortal: ["Client portal", "Clients can sign in to view portfolios and documents"],
  marketTiming: ["Market timing agent", "BUY, HOLD and SELL signals per emirate"],
  crossBorder: ["Cross-border agent", "UAE and India arbitrage and structuring"],
};

/** Platform controls for one tenant: plan, status, feature flags and support access. */
export function TenantControls({ tenantId, plan, status, features }: { tenantId: string; plan: string; status: string; features: Features }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [flags, setFlags] = React.useState(features);

  async function patch(body: object, _ok: string) {
    void _ok;
    setBusy(true);
    const res = await fetch(`/api/platform/tenants/${tenantId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Not updated", { description: json.error });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-ui font-medium text-ink-900">Plan</span>
          <Select value={plan} disabled={busy} onChange={(e) => patch({ plan: e.target.value }, "Plan updated")}>
            {PLANS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}, AED {p.priceAed.toLocaleString("en-US")}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-ui font-medium text-ink-900">Status</span>
          <Select value={status} disabled={busy} onChange={(e) => patch({ status: e.target.value }, "Status updated")}>
            <option value="trial">Trial</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </label>
      </div>
      <fieldset>
        <legend className="text-ui font-medium text-ink-900">Feature flags</legend>
        <ul className="mt-2 divide-y divide-hairline border-y border-hairline">
          {(Object.keys(FEATURE_LABEL) as (keyof Features)[]).map((k) => (
            <li key={k} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span className="block text-ui text-ink-900">{FEATURE_LABEL[k][0]}</span>
                <span className="block text-small text-ink-500">{FEATURE_LABEL[k][1]}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={flags[k]}
                aria-label={FEATURE_LABEL[k][0]}
                disabled={busy}
                onClick={() => {
                  const next = { ...flags, [k]: !flags[k] };
                  setFlags(next);
                  void patch({ features: next }, `${FEATURE_LABEL[k][0]} ${next[k] ? "enabled" : "disabled"}`);
                }}
                className="relative h-5 w-9 shrink-0 rounded-full border border-hairline transition-colors duration-150 aria-checked:border-navy-900 aria-checked:bg-navy-900"
              >
                <span className={`absolute top-0.5 left-0.5 size-3.5 rounded-full bg-surface shadow-card transition-transform duration-150 ${flags[k] ? "translate-x-4" : "bg-ink-400"}`} />
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      <Button asChild variant="secondary">
        <a href={`/api/platform/impersonate?tenant=${tenantId}`}>Open as administrator</a>
      </Button>
    </div>
  );
}
