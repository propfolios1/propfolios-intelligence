"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, Input, Select } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/status-pill";
import type { SubscriptionFilters } from "@/db/schema-production";
import { cn } from "@/lib/utils";

type Sub = { id: string; name: string; filters: SubscriptionFilters; frequency: "weekly" | "fortnightly" | "monthly"; channels: ("portal" | "email")[]; includeInventory: boolean; active: boolean; lastSentAt: string | null; nextDueAt: string };
type Options = { markets: { code: string; name: string; flag: string; currency: string }[]; areas: Record<string, string[]>; propertyTypes: string[] };

const FREQ = [
  ["weekly", "Weekly"],
  ["fortnightly", "Every two weeks"],
  ["monthly", "Monthly"],
] as const;
const BEDS = [0, 1, 2, 3, 4, 5];
const bedLabel = (b: number) => (b === 0 ? "Studio" : b === 5 ? "5+" : String(b));
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const n = (v: string) => (v === "" ? null : Number(v));

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("h-8 rounded-full border px-3 text-ui transition-colors duration-150", on ? "border-navy-900 bg-navy-900 text-surface" : "border-hairline bg-surface text-ink-700 hover:border-ink-400")}>
      {children}
    </button>
  );
}

export function SubscriptionForm({ options, initial, onDone }: { options: Options; initial?: Sub; onDone?: () => void }) {
  const router = useRouter();
  const first = options.markets[0];
  const [name, setName] = React.useState(initial?.name ?? "");
  const [f, setF] = React.useState<SubscriptionFilters>(initial?.filters ?? { markets: first ? [first.code] : [], areas: [], propertyTypes: [], bedrooms: [], budgetMin: null, budgetMax: null, currency: first?.currency ?? "AED", purpose: "sale" });
  const [frequency, setFrequency] = React.useState<Sub["frequency"]>(initial?.frequency ?? "weekly");
  const [channels, setChannels] = React.useState<Sub["channels"]>(initial?.channels ?? ["portal", "email"]);
  const [inventory, setInventory] = React.useState(initial?.includeInventory ?? true);
  const [busy, setBusy] = React.useState(false);
  const areas = f.markets.flatMap((m) => options.areas[m] ?? []);

  const setMarkets = (markets: string[]) => {
    const cur = options.markets.find((m) => m.code === markets[0])?.currency ?? f.currency;
    setF({ ...f, markets, currency: cur, areas: f.areas.filter((a) => markets.some((m) => options.areas[m]?.includes(a))) });
  };

  const save = async () => {
    setBusy(true);
    const body = { name: name || `${f.areas.slice(0, 2).join(" and ") || options.markets.find((m) => m.code === f.markets[0])?.name || "Market"} brief`, filters: f, frequency, channels, includeInventory: inventory };
    const r = await post(initial ? `/api/client/subscriptions/${initial.id}` : "/api/client/subscriptions", body, { method: initial ? "PATCH" : "POST", ok: initial ? "Subscription updated" : "Subscribed. Your first brief is ready." });
    setBusy(false);
    if (!r) return;
    onDone?.();
    if (!initial && r.reportId) router.push(`/client/reports/${r.reportId}`);
    else router.refresh();
  };

  return (
    <div className="grid gap-6">
      <FormField label="Name" hint="How the brief is titled in your inbox.">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dubai Marina two-bedrooms" maxLength={80} />
      </FormField>
      <div>
        <div className="label-caps mb-2">Markets</div>
        <div className="flex flex-wrap gap-2">
          {options.markets.map((m) => (
            <Chip key={m.code} on={f.markets.includes(m.code)} onClick={() => setMarkets(toggle(f.markets, m.code))}>
              <span aria-hidden>{m.flag}</span> {m.name}
            </Chip>
          ))}
        </div>
      </div>
      {areas.length > 0 && (
        <div>
          <div className="label-caps mb-2">Areas {f.areas.length ? <span className="num text-ink-500">({f.areas.length})</span> : <span className="normal-case tracking-normal text-ink-500">· all areas when none selected</span>}</div>
          <div className="flex flex-wrap gap-2">
            {areas.map((a) => (
              <Chip key={a} on={f.areas.includes(a)} onClick={() => setF({ ...f, areas: toggle(f.areas, a) })}>
                {a}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="label-caps mb-2">Property type</div>
          <div className="flex flex-wrap gap-2">
            {options.propertyTypes.map((t) => (
              <Chip key={t} on={f.propertyTypes.includes(t)} onClick={() => setF({ ...f, propertyTypes: toggle(f.propertyTypes, t) })}>
                {t}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="label-caps mb-2">Bedrooms</div>
          <div className="flex flex-wrap gap-2">
            {BEDS.map((b) => (
              <Chip key={b} on={f.bedrooms.includes(b)} onClick={() => setF({ ...f, bedrooms: toggle(f.bedrooms, b) })}>
                {bedLabel(b)}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <FormField label="Buying or renting">
          <Select value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value as "sale" | "rent" })}>
            <option value="sale">Buying</option>
            <option value="rent">Renting</option>
          </Select>
        </FormField>
        <FormField label={`Budget from, ${f.currency}`}>
          <Input type="number" min={0} className="num" value={f.budgetMin ?? ""} onChange={(e) => setF({ ...f, budgetMin: n(e.target.value) })} />
        </FormField>
        <FormField label={`Budget to, ${f.currency}`}>
          <Input type="number" min={0} className="num" value={f.budgetMax ?? ""} onChange={(e) => setF({ ...f, budgetMax: n(e.target.value) })} />
        </FormField>
        <FormField label="Frequency">
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value as Sub["frequency"])}>
            {FREQ.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-ui text-ink-700">
          <Checkbox checked={channels.includes("portal")} onCheckedChange={() => setChannels(toggle(channels, "portal"))} /> In the portal
        </label>
        <label className="flex items-center gap-2 text-ui text-ink-700">
          <Checkbox checked={channels.includes("email")} onCheckedChange={() => setChannels(toggle(channels, "email"))} /> By email
        </label>
        <label className="flex items-center gap-2 text-ui text-ink-700">
          <Checkbox checked={inventory} onCheckedChange={() => setInventory(!inventory)} /> Include developer releases and price changes
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t border-hairline pt-4">
        {onDone && (
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
        <Button onClick={save} disabled={busy || !f.markets.length || !channels.length}>
          {initial ? "Save changes" : "Subscribe"}
        </Button>
      </div>
    </div>
  );
}

const FREQ_LABEL = { weekly: "Weekly", fortnightly: "Every two weeks", monthly: "Monthly" };

export function SubscriptionCard({ sub, options, summary }: { sub: Sub; options: Options; summary: string }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const act = async (kind: "send" | "pause" | "delete") => {
    setBusy(kind);
    const r =
      kind === "send"
        ? await post(`/api/client/subscriptions/${sub.id}`, {}, { ok: "Brief written" })
        : kind === "pause"
          ? await post(`/api/client/subscriptions/${sub.id}`, { active: !sub.active }, { method: "PATCH", ok: sub.active ? "Paused" : "Resumed" })
          : await post(`/api/client/subscriptions/${sub.id}`, {}, { method: "DELETE", ok: "Subscription removed" });
    setBusy(null);
    if (r && kind === "send" && r.reportId) router.push(`/client/reports/${r.reportId}`);
    else if (r) router.refresh();
  };
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Dubai" });
  return (
    <article className="rounded-md border border-hairline bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[20px] text-navy-900">{sub.name}</h3>
          <p className="mt-1 text-small text-ink-700">{summary}</p>
        </div>
        <StatusPill tone={sub.active ? "complete" : "neutral"}>{sub.active ? FREQ_LABEL[sub.frequency] : "Paused"}</StatusPill>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-4 text-small sm:grid-cols-3">
        <div>
          <dt className="eyebrow">Last brief</dt>
          <dd className="num mt-1 text-ink-900">{sub.lastSentAt ? fmt(sub.lastSentAt) : "Not yet"}</dd>
        </div>
        <div>
          <dt className="eyebrow">Next brief</dt>
          <dd className="num mt-1 text-ink-900">{sub.active ? fmt(sub.nextDueAt) : "Paused"}</dd>
        </div>
        <div>
          <dt className="eyebrow">Delivery</dt>
          <dd className="mt-1 text-ink-900">{sub.channels.map((c) => (c === "portal" ? "Portal" : "Email")).join(" and ")}</dd>
        </div>
      </dl>
      {editing ? (
        <div className="mt-6 border-t border-hairline pt-6">
          <SubscriptionForm options={options} initial={sub} onDone={() => setEditing(false)} />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => act("send")} disabled={!!busy}>
            Write brief now
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => act("pause")} disabled={!!busy}>
            {sub.active ? "Pause" : "Resume"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => act("delete")} disabled={!!busy}>
            Remove
          </Button>
        </div>
      )}
    </article>
  );
}

export function NewSubscription({ options }: { options: Options }) {
  const [open, setOpen] = React.useState(false);
  if (!open) return <Button onClick={() => setOpen(true)}>Follow a market</Button>;
  return (
    <div className="rounded-md border border-hairline bg-surface p-6">
      <h3 className="mb-4 font-display text-[20px] text-navy-900">New market brief</h3>
      <SubscriptionForm options={options} onDone={() => setOpen(false)} />
    </div>
  );
}
