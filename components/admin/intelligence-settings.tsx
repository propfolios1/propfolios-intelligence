"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, Input, Textarea } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import type { InsightConfig } from "@/db/schema";

/** Opt in or out of the federation. */
export function FederationConsent({ consent, contributed, delivered }: { consent: boolean; contributed: number; delivered: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function set(next: boolean) {
    setBusy(true);
    const res = await fetch("/api/tenants/me/federation-consent", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent: next }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Not changed", { description: json.error });
    toast.success(next ? "Contributing to the federation" : "Contributions withdrawn", { description: next ? `${json.contributed} delivered mandates contributed as anonymised learnings.` : `${json.withdrawn} learnings removed; baselines refresh tonight.` });
    router.refresh();
  }
  return (
    <Card>
      <CardHeader eyebrow="Layer 6" title="Federated intelligence" actions={<StatusPill tone={consent ? "complete" : "neutral"}>{consent ? "Contributing" : "Not contributing"}</StatusPill>} />
      <CardContent className="max-w-[72ch] space-y-3 text-small text-ink-700">
        <p>When a mandate is delivered, the platform can contribute an anonymised learning: segment, ticket band, assumptions, simulated returns, the committee&apos;s verdict and the categories of serious findings. Property, developer, mandate and firm are replaced by salted one-way hashes. No client, price, name or text leaves your workspace.</p>
        <p>
          Baselines are published only when they cover at least three deals from two firms. Your firm has <span className="num text-ink-900">{contributed}</span> learnings in the pool from <span className="num text-ink-900">{delivered}</span> delivered mandates. Withdrawing removes them at once.
        </p>
      </CardContent>
      <CardFooter className="justify-end">
        {consent ? (
          <Button variant="secondary" onClick={() => set(false)} disabled={busy}>
            Withdraw and stop contributing
          </Button>
        ) : (
          <Button onClick={() => set(true)} disabled={busy}>
            Contribute anonymised learnings
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/** Thresholds for the insight agent and the payment instructions used in rent reminders. */
export function InsightSettingsForm({ config, payments }: { config: InsightConfig; payments: { link: string | null; instructions: string | null } }) {
  const router = useRouter();
  const [c, setC] = React.useState(config);
  const [link, setLink] = React.useState(payments.link ?? "");
  const [instructions, setInstructions] = React.useState(payments.instructions ?? "");
  const [busy, setBusy] = React.useState(false);
  const num = (k: keyof Omit<InsightConfig, "notifyClients">) => ({
    value: String(c[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value) || 0 }),
    inputMode: "decimal" as const,
    className: "num text-right",
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/tenants/me/insights-config", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...c, payments: { link, instructions } }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Settings not saved", { description: json.error ?? "Check the values are within range." });
    toast.success("Settings saved", { description: "The next scan uses the new thresholds." });
    router.refresh();
  }
  return (
    <form onSubmit={save}>
      <Card>
        <CardHeader eyebrow="Layer 4" title="Proactive insight thresholds" />
        <CardContent className="grid gap-6 md:grid-cols-2">
          <FormField label="Price movement (%)" htmlFor="pm" hint="Twelve-month change in a region's median price per sq ft.">
            <Input id="pm" {...num("priceMovementPct")} />
          </FormField>
          <FormField label="Developer distress (risk score)" htmlFor="dd" hint="0 to 100; higher is riskier.">
            <Input id="dd" {...num("developerDistressScore")} />
          </FormField>
          <FormField label="Undervalued (% below comparables)" htmlFor="uv" hint="Asking price per sq ft below the community transaction median.">
            <Input id="uv" {...num("undervaluedDiscountPct")} />
          </FormField>
          <FormField label="Exit window (% gain on cost)" htmlFor="ex" hint="Unrealised gain on a holding where the market signal is not BUY.">
            <Input id="ex" {...num("exitGainPct")} />
          </FormField>
          <label className="flex items-start gap-3 text-small text-ink-700 md:col-span-2">
            <Checkbox checked={c.notifyClients} onCheckedChange={(v) => setC({ ...c, notifyClients: v === true })} className="mt-0.5" />
            Show client-relevant insights in the client portal as they are identified. When off, insights reach your team only.
          </label>
        </CardContent>
        <CardHeader eyebrow="Rent reminders" title="Payment instructions" className="border-t border-ink-200" />
        <CardContent className="grid gap-6 md:grid-cols-2">
          <FormField label="Payment link" htmlFor="link" hint="Included in rent reminders when set.">
            <Input id="link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </FormField>
          <FormField label="Bank transfer instructions" htmlFor="instr" hint="Used when there is no payment link.">
            <Textarea id="instr" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </FormField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={busy}>
            Save settings
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
