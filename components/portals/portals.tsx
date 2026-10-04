"use client";

import { ExternalLink, RotateCcw } from "lucide-react";
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

type Cred = { key: string; label: string; secret: boolean; multiline?: boolean; hint?: string };
export type PortalCard = { key: string; name: string; market: string; flag: string; transport: string; credentials: Cred[]; defaultBaseUrl: string | null; access: string; connected: boolean; sandbox: boolean; status: string | null; lastSyncAt: string | null; lastError: string | null; live: number; queued: number; rejected: number };

const TONE: Record<string, "neutral" | "progress" | "complete" | "error"> = { live: "complete", publishing: "progress", queued: "progress", rejected: "error", error: "error", removed: "neutral", connected: "complete", disabled: "neutral", succeeded: "complete", failed: "error", running: "progress" };
export const PortalStatus = ({ status }: { status: string }) => <StatusPill tone={TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</StatusPill>;

export function ConnectPortal({ portal, label = "Connect" }: { portal: PortalCard; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [sandbox, setSandbox] = React.useState(!portal.connected && portal.transport === "rest");
  const [values, setValues] = React.useState<Record<string, string>>({ baseUrl: portal.defaultBaseUrl ?? "" });
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    setBusy(true);
    const config: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    for (const c of portal.credentials) (c.secret ? secrets : config)[c.key] = values[c.key] ?? "";
    const r = await post("/api/portals", { portal: portal.key, sandbox, config, secrets }, { fail: `${portal.name} not connected` });
    setBusy(false);
    if (r) {
      toast.success(`${portal.name} connected`, { description: sandbox ? "Connected to the Nakhla sandbox. Nothing is published to the live portal." : "The test call succeeded; listings can be published." });
      setOpen(false);
      router.refresh();
    }
  };
  return (
    <>
      <Button size="sm" variant={portal.connected ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[620px]">
          <DialogTitle>Connect {portal.name}</DialogTitle>
          <DialogDescription>{portal.access}</DialogDescription>
          {portal.transport === "rest" && (
            <label className="mt-5 flex items-start gap-3 rounded-md border border-hairline p-4">
              <Checkbox checked={sandbox} onCheckedChange={(v) => setSandbox(Boolean(v))} aria-label="Use the Nakhla sandbox" />
              <span className="text-ui text-ink-700">
                <span className="font-medium text-ink-900">Use the Nakhla sandbox.</span> A partner-style API that moderates listings like the portal does, so the team can rehearse publishing before credentials arrive. Nothing reaches the live portal.
              </span>
            </label>
          )}
          {!sandbox && (
            <div className="mt-5 grid gap-4">
              {portal.credentials.map((c) => (
                <FormField key={c.key} label={c.label} hint={c.hint ?? (c.secret && portal.connected ? "Leave blank to keep the stored value." : undefined)}>
                  {c.multiline ? (
                    <Textarea rows={4} className="num text-[12px]" value={values[c.key] ?? ""} onChange={(e) => setValues({ ...values, [c.key]: e.target.value })} />
                  ) : (
                    <Input type={c.secret ? "password" : "text"} autoComplete="off" value={values[c.key] ?? ""} onChange={(e) => setValues({ ...values, [c.key]: e.target.value })} />
                  )}
                </FormField>
              ))}
              {portal.key === "zoopla" && (
                <label className="flex items-center gap-2 text-ui text-ink-700">
                  <Checkbox checked={values.sandbox === "true"} onCheckedChange={(v) => setValues({ ...values, sandbox: v ? "true" : "false" })} /> Use Zoopla&apos;s sandbox host until certification
                </label>
              )}
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Testing the connection" : "Test and connect"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const SOURCES = ["reference", "title", "description", "purpose", "propertyType", "price", "currency", "city", "community", "bedrooms", "bathrooms", "area", "areaSqm", "permitNumber", "photoUrls", "photoObjects", "agentName", "agentEmail", "agentPhone", "rentPeriod", "status", "listedAt", "features", "branchId", "networkId", "const"];
type Rule = { target: string; source: string; value?: string | number | boolean; map?: Record<string, string | number | boolean>; required?: boolean };

export function FieldMapEditor({ portal, rules: initial, custom }: { portal: string; rules: Rule[]; custom: boolean }) {
  const router = useRouter();
  const [rules, setRules] = React.useState<Rule[]>(initial);
  const [busy, setBusy] = React.useState(false);
  const set = (i: number, patch: Partial<Rule>) => setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const save = async (reset = false) => {
    setBusy(true);
    const res = await fetch(`/api/portals/${portal}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ rules: reset ? null : rules }) });
    setBusy(false);
    if (!res.ok) return toast.error("Field map not saved", { description: (await res.json().catch(() => ({}))).error });
    toast.success(reset ? "Default field map restored" : "Field map saved", { description: "Applies to the next publish or update." });
    router.refresh();
  };
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-ui">
          <thead>
            <tr className="h-8 border-b border-hairline">
              <th className="label-caps text-start">Portal field</th>
              <th className="label-caps px-3 text-start">Nakhla field</th>
              <th className="label-caps px-3 text-start">Value map or constant</th>
              <th className="label-caps px-3 text-start">Required</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              <tr key={i} className="border-b border-hairline-row align-top">
                <td className="py-2 pe-3">
                  <Input className="num h-9 text-[12px]" value={r.target} onChange={(e) => set(i, { target: e.target.value })} aria-label="Portal field" />
                </td>
                <td className="px-3 py-2">
                  <Select className="h-9" value={r.source} onChange={(e) => set(i, { source: e.target.value })} aria-label="Nakhla field">
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2">
                  {r.source === "const" ? (
                    <Input className="num h-9 text-[12px]" value={String(r.value ?? "")} onChange={(e) => set(i, { value: e.target.value })} aria-label="Constant value" />
                  ) : (
                    <Input
                      className="num h-9 text-[12px]"
                      placeholder="sale=RS, rent=RR"
                      value={r.map ? Object.entries(r.map).map(([k, v]) => `${k}=${v}`).join(", ") : ""}
                      onChange={(e) => {
                        const pairs = e.target.value.split(",").map((p) => p.split("=").map((x) => x.trim())).filter((p) => p[0] && p[1] !== undefined);
                        set(i, { map: pairs.length ? Object.fromEntries(pairs.map(([k, v]) => [k!, /^\d+$/.test(v!) ? Number(v) : v!])) : undefined });
                      }}
                      aria-label="Value map"
                    />
                  )}
                </td>
                <td className="px-3 py-2 pt-4">
                  <Checkbox checked={Boolean(r.required)} onCheckedChange={(v) => set(i, { required: Boolean(v) })} aria-label="Required" />
                </td>
                <td className="py-2 ps-3 text-end">
                  <Button size="sm" variant="ghost" onClick={() => setRules(rules.filter((_, k) => k !== i))}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => setRules([...rules, { target: "", source: "reference" }])}>
          Add field
        </Button>
        <span className="flex-1" />
        {custom && (
          <Button variant="ghost" onClick={() => save(true)} disabled={busy}>
            Restore default
          </Button>
        )}
        <Button onClick={() => save()} disabled={busy || rules.some((r) => !r.target.trim())}>
          {busy ? "Saving" : "Save field map"}
        </Button>
      </div>
    </div>
  );
}

export function RetryJob({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await post(`/api/portals/jobs/${id}`, {}, { fail: "Retry did not run" });
        setBusy(false);
        if (r) {
          toast[r.job?.status === "succeeded" ? "success" : "error"](r.job?.status === "succeeded" ? "Published" : "Still failing", { description: r.job?.errors?.at(-1)?.message });
          router.refresh();
        }
      }}
    >
      <RotateCcw className="size-3.5" aria-hidden /> Retry
    </Button>
  );
}

export type PublishRow = { portal: string; name: string; connected: boolean; status: string | null; externalId: string | null; externalUrl: string | null; lastError: string | null; publishedAt: string | null };

/** Listing page: one click per portal, with each portal's live state. */
export function PublishPanel({ listingId, rows, issues }: { listingId: string; rows: PublishRow[]; issues: string[] }) {
  const router = useRouter();
  const connected = rows.filter((r) => r.connected);
  const [chosen, setChosen] = React.useState<string[]>(connected.filter((r) => !r.status || r.status === "removed").map((r) => r.portal));
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = async (portals: string[], action: "publish" | "unpublish") => {
    setBusy(action);
    const r = await post(`/api/listings/${listingId}/publish`, { portals, action }, { fail: action === "publish" ? "Not published" : "Not removed" });
    setBusy(null);
    if (r) {
      const bad = (r.results as { portal: string; status: string; error: string | null }[]).filter((x) => x.error);
      if (bad.length) toast.error(`${bad.length} ${bad.length === 1 ? "portal" : "portals"} reported a problem`, { description: bad.map((b) => `${b.portal}: ${b.error}`).join(" ") });
      else toast.success(action === "publish" ? `Sent to ${portals.length} ${portals.length === 1 ? "portal" : "portals"}` : "Removed", { description: "Statuses update as each portal moderates the listing." });
      router.refresh();
    }
  };
  return (
    <div className="rounded-md border border-hairline bg-surface">
      {issues.length > 0 && <p className="border-b border-hairline px-5 py-3 text-ui text-warning">{issues.join(" ")}</p>}
      <ul className="divide-y divide-hairline-row">
        {rows.map((r) => (
          <li key={r.portal} className="flex flex-wrap items-center gap-3 px-5 py-3">
            {r.connected ? <Checkbox checked={chosen.includes(r.portal)} onCheckedChange={(v) => setChosen(v ? [...chosen, r.portal] : chosen.filter((x) => x !== r.portal))} aria-label={`Select ${r.name}`} /> : <span className="size-4" />}
            <span className={cn("w-36 text-ui", r.connected ? "text-ink-900" : "text-ink-400")}>{r.name}</span>
            {r.status ? <PortalStatus status={r.status} /> : <span className="text-[12px] text-ink-500">{r.connected ? "Not published" : "Not connected"}</span>}
            {r.externalUrl && (
              <a href={r.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-navy-900 hover:underline">
                {r.externalId} <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
            {r.lastError && <span className="min-w-0 flex-1 truncate text-[12px] text-danger" title={r.lastError}>{r.lastError}</span>}
            {r.status && r.status !== "removed" && r.connected && (
              <Button size="sm" variant="ghost" className="ms-auto" disabled={Boolean(busy)} onClick={() => run([r.portal], "unpublish")}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3">
        <span className="text-[12px] text-ink-500">{connected.length ? `${connected.length} connected ${connected.length === 1 ? "portal" : "portals"}` : "Connect portals in Administration to publish from here."}</span>
        <Button size="sm" disabled={!chosen.length || Boolean(busy)} onClick={() => run(chosen, "publish")}>
          {busy === "publish" ? "Publishing" : `Publish to ${chosen.length || ""} ${chosen.length === 1 ? "portal" : "portals"}`.replace("  ", " ")}
        </Button>
      </div>
    </div>
  );
}
