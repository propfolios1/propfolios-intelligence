"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, Input } from "@/components/ui/form";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import { SecretOnce } from "./enterprise";

type Endpoint = { id: string; url: string; description: string; events: string[]; active: boolean; consecutiveFailures: number; lastDeliveryAt: string | null; disabledReason: string | null };
type Delivery = { id: string; endpointId: string; event: string; status: "pending" | "delivered" | "failed"; attempts: number; responseStatus: number | null; responseMs: number | null; error: string | null; createdAt: string; nextAttemptAt: string };

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const TONE = { delivered: "complete", pending: "progress", failed: "error" } as const;

export function WebhooksPanel({ endpoints, deliveries, events }: { endpoints: Endpoint[]; deliveries: Delivery[]; events: { key: string; label: string }[] }) {
  const router = useRouter();
  const [url, setUrl] = React.useState("");
  const [sel, setSel] = React.useState<string[]>(["lead.created", "deal.closed"]);
  const [secret, setSecret] = React.useState<{ id: string; value: string } | null>(null);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await post("/api/admin/webhooks", { url, events: sel }, { fail: "Endpoint not added" });
    if (!r) return;
    setSecret({ id: r.id, value: r.secret });
    setUrl("");
    router.refresh();
  };
  const act = async (id: string, body: Record<string, unknown>, ok: string, method = "POST") => {
    const r = await post(`/api/admin/webhooks/${id}`, body, { method, ok });
    if (r?.secret) setSecret({ id, value: r.secret });
    if (r) router.refresh();
  };
  const host = (u: string) => {
    try {
      return new URL(u).host;
    } catch {
      return u;
    }
  };
  return (
    <div className="grid gap-6">
      <form onSubmit={create} className="grid gap-4 rounded-md border border-hairline bg-surface p-5">
        <FormField label="Endpoint URL" hint="HTTPS, reachable from the internet. Return any 2xx status within ten seconds.">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.yourfirm.com/nakhla" className="num" />
        </FormField>
        <fieldset>
          <legend className="eyebrow mb-2">Events</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {events.map((ev) => (
              <label key={ev.key} className="flex items-start gap-2 text-small text-ink-700">
                <Checkbox checked={sel.includes(ev.key)} onCheckedChange={() => setSel(toggle(sel, ev.key))} className="mt-0.5" />
                <span>
                  <code className="num text-ink-900">{ev.key}</code>
                  <span className="block text-ink-500">{ev.label}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end">
          <Button type="submit" disabled={!url || !sel.length}>
            Add endpoint
          </Button>
        </div>
      </form>
      {secret && <SecretOnce secret={secret.value} label="signing secret" />}
      {endpoints.map((e) => (
        <article key={e.id} className="rounded-md border border-hairline bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <code className="num block truncate text-ui text-ink-900">{e.url}</code>
              <div className="mt-2 flex flex-wrap gap-1">
                {e.events.map((x) => (
                  <code key={x} className="num rounded-full border border-hairline px-2 text-[11px] text-ink-700">
                    {x}
                  </code>
                ))}
              </div>
              {e.disabledReason && <p className="mt-2 text-small text-danger">{e.disabledReason}</p>}
            </div>
            <StatusPill tone={e.active ? (e.consecutiveFailures ? "progress" : "complete") : "error"}>{e.active ? (e.consecutiveFailures ? `${e.consecutiveFailures} failing` : "Active") : "Off"}</StatusPill>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => act(e.id, { action: "test" }, "Test event sent")}>
              Send test event
            </Button>
            <Button size="sm" variant="ghost" onClick={() => act(e.id, { action: "secret" }, "Secret revealed")}>
              Reveal secret
            </Button>
            <Button size="sm" variant="ghost" onClick={() => act(e.id, { active: !e.active }, e.active ? "Endpoint paused" : "Endpoint resumed", "PATCH")}>
              {e.active ? "Pause" : "Resume"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => act(e.id, {}, "Endpoint removed", "DELETE")}>
              Remove
            </Button>
          </div>
        </article>
      ))}
      {deliveries.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
          <table className="w-full min-w-[720px] text-small">
            <thead className="border-b border-hairline text-left">
              <tr className="eyebrow">
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Endpoint</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Attempts</th>
                <th className="px-4 py-3 text-right font-medium">Response</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3">
                    <code className="num text-ink-900">{d.event}</code>
                  </td>
                  <td className="px-4 py-3 text-ink-500">{host(endpoints.find((e) => e.id === d.endpointId)?.url ?? "")}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={TONE[d.status]}>{d.status === "pending" && d.attempts ? "Retrying" : d.status}</StatusPill>
                  </td>
                  <td className="num px-4 py-3 text-right">{d.attempts}</td>
                  <td className={cn("num px-4 py-3 text-right", d.error ? "text-danger" : "text-ink-700")} title={d.error ?? undefined}>
                    {d.responseStatus ?? (d.error ? "Error" : "n/a")}
                    {d.responseMs !== null && <span className="ml-1 text-ink-400">{d.responseMs} ms</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-500">
                    <RelativeTime iso={d.createdAt} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.status !== "delivered" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (await post(`/api/admin/webhooks/deliveries/${d.id}`, {}, { ok: "Redelivered" })) router.refresh();
                        }}
                      >
                        Redeliver
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
