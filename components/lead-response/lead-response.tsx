"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import type { LrChannel, LrSettings } from "@/db/schema-production";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CHANNEL_LABEL: Record<LrChannel, string> = { whatsapp: "WhatsApp", email: "Email replies", website: "Website enquiries", portal: "Portal enquiries" };

export function LeadResponseSettings({ settings }: { settings: LrSettings }) {
  const router = useRouter();
  const [f, setF] = React.useState(settings);
  const [busy, setBusy] = React.useState(false);
  const toggle = (c: LrChannel) => setF({ ...f, channels: f.channels.includes(c) ? f.channels.filter((x) => x !== c) : [...f.channels, c] });
  return (
    <div className="grid gap-5">
      <label className="flex items-center gap-2 text-ui text-ink-900">
        <Checkbox checked={f.enabled} onCheckedChange={(v) => setF({ ...f, enabled: Boolean(v) })} /> The assistant replies to new enquiries
      </label>
      <div>
        <div className="label-caps mb-2">Channels</div>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(CHANNEL_LABEL) as LrChannel[]).map((c) => (
            <label key={c} className="flex items-center gap-2 text-ui text-ink-700">
              <Checkbox checked={f.channels.includes(c)} onCheckedChange={() => toggle(c)} /> {CHANNEL_LABEL[c]}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Viewings open">
          <Input type="time" value={f.hours.start} onChange={(e) => setF({ ...f, hours: { ...f.hours, start: e.target.value } })} />
        </FormField>
        <FormField label="Viewings close">
          <Input type="time" value={f.hours.end} onChange={(e) => setF({ ...f, hours: { ...f.hours, end: e.target.value } })} />
        </FormField>
        <FormField label="Time zone">
          <Input value={f.hours.timezone} onChange={(e) => setF({ ...f, hours: { ...f.hours, timezone: e.target.value } })} />
        </FormField>
        <div className="flex flex-wrap gap-1 sm:col-span-3" role="group" aria-label="Viewing days">
          {DAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={f.hours.days.includes(i)} onClick={() => setF({ ...f, hours: { ...f.hours, days: f.hours.days.includes(i) ? f.hours.days.filter((x) => x !== i) : [...f.hours.days, i].sort() } })} className={cn("h-8 w-12 rounded-sm border text-[12px] transition-colors duration-150", f.hours.days.includes(i) ? "border-navy-900 bg-navy-900 text-surface" : "border-hairline text-ink-700")}>
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Viewing length, minutes">
          <Input type="number" min={15} max={180} step={15} className="num" value={f.viewingMinutes} onChange={(e) => setF({ ...f, viewingMinutes: Number(e.target.value) || 45 })} />
        </FormField>
        <FormField label="Hand-off SLA, minutes" hint="An agent should pick up within this time.">
          <Input type="number" min={5} max={1440} className="num" value={f.handoffSlaMinutes} onChange={(e) => setF({ ...f, handoffSlaMinutes: Number(e.target.value) || 30 })} />
        </FormField>
        <FormField label="High-value threshold, AED" hint="Budgets at or above go straight to an agent.">
          <Input type="number" min={100000} step={500000} className="num" value={f.highValueAed} onChange={(e) => setF({ ...f, highValueAed: Number(e.target.value) || 10_000_000 })} />
        </FormField>
      </div>
      <FormField label="Signature" hint="Added to every reply, for example the firm's name and licence number.">
        <Input value={f.signature} maxLength={200} onChange={(e) => setF({ ...f, signature: e.target.value })} placeholder="Nakhla Demo Brokerage, ORN 12345" />
      </FormField>
      <div>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/lead-response", f, { method: "PATCH", fail: "Not saved", ok: "Settings saved" });
            setBusy(false);
            if (r) router.refresh();
          }}
        >
          {busy ? "Saving" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

type Preview = { reply: string; completeness: number; decision: { kind: string; field?: string; reason?: string }; extraction: Record<string, unknown> & { intents: Record<string, unknown> } };
const FIELD_ROWS: [string, string][] = [
  ["budget", "Budget"],
  ["timeline", "Timeline"],
  ["areas", "Areas"],
  ["bedrooms", "Bedrooms"],
  ["motivation", "Motivation"],
  ["financing", "Financing"],
];

function show(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const o = v as Record<string, unknown>;
  if ("max" in o || "min" in o) return [o.min ? `from ${Number(o.min).toLocaleString("en-US")}` : null, o.max ? `up to ${Number(o.max).toLocaleString("en-US")}` : null, o.currency].filter(Boolean).join(" ");
  const value = o.value;
  return Array.isArray(value) ? value.join(", ") : String(value).replace(/_/g, " ");
}

/** A dry run of the assistant on any message: what it reads, what it decides, what it would send. Nothing is stored or sent. */
export function PreviewConsole({ listings }: { listings: { id: string; title: string; purpose: string }[] }) {
  const [text, setText] = React.useState("Good afternoon, we are relocating from London and looking for a 3 bed in Dubai Marina, budget around 3.5m, ideally within 2 months. Mortgage pre-approved.");
  const [listing, setListing] = React.useState("");
  const [r, setR] = React.useState<Preview | null>(null);
  const [busy, setBusy] = React.useState(false);
  const chosen = listings.find((l) => l.id === listing);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid content-start gap-3">
        <FormField label="Enquiry">
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        </FormField>
        <FormField label="About a listing">
          <Select value={listing} onChange={(e) => setListing(e.target.value)}>
            <option value="">No listing, a general enquiry</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </Select>
        </FormField>
        <div>
          <Button
            variant="secondary"
            disabled={busy || !text.trim()}
            onClick={async () => {
              setBusy(true);
              const res = await post("/api/lead-response", { text, intent: chosen?.purpose === "rent" ? "rent" : "buy", listingId: listing || null }, { fail: "Preview failed" });
              setBusy(false);
              if (res) setR(res);
            }}
          >
            {busy ? "Reading" : "Preview the reply"}
          </Button>
        </div>
      </div>
      <div className="rounded-md border border-hairline bg-surface">
        {r ? (
          <>
            <dl className="divide-y divide-hairline-row text-ui">
              {FIELD_ROWS.map(([k, label]) => {
                const v = r.extraction[k] as { evidence?: string } | null;
                return (
                  <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-2.5">
                    <dt className="text-ink-500">{label}</dt>
                    <dd className={v ? "text-ink-900" : "text-ink-400"}>
                      {v ? show(v) : "Not stated"}
                      {v?.evidence && <span className="mt-0.5 block truncate text-[12px] text-ink-500">&ldquo;{v.evidence}&rdquo;</span>}
                    </dd>
                  </div>
                );
              })}
              <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 px-4 py-2.5">
                <dt className="text-ink-500">Decision</dt>
                <dd className="text-ink-900">
                  {r.decision.kind.replace(/_/g, " ")}
                  {r.decision.field ? `: ${r.decision.field}` : r.decision.reason ? `: ${r.decision.reason.replace(/_/g, " ")}` : ""} <span className="num text-ink-500">· {r.completeness}% qualified</span>
                </dd>
              </div>
            </dl>
            <div className="border-t border-hairline bg-canvas p-4">
              <div className="label-caps mb-2">Reply</div>
              <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-ink-900">{r.reply}</p>
            </div>
          </>
        ) : (
          <p className="p-6 text-ui text-ink-500">Write or paste an enquiry to see what the assistant reads from it, what it decides, and the reply it would send. Nothing is stored or sent.</p>
        )}
      </div>
    </div>
  );
}

export function HandoffButtons({ id, status }: { id: string; status: "open" | "accepted" | "resolved" }) {
  const router = useRouter();
  if (status === "resolved") return null;
  return (
    <Button
      size="sm"
      variant={status === "open" ? "primary" : "secondary"}
      onClick={async () => {
        const r = await post(`/api/lead-response/handoffs/${id}`, { action: status === "open" ? "accept" : "resolve" }, { fail: "Not updated" });
        if (r) router.refresh();
      }}
    >
      {status === "open" ? "Accept" : "Mark resolved"}
    </Button>
  );
}

export function ResumeAssistant({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        const r = await post(`/api/lead-response/conversations/${conversationId}`, { action: "resume" }, { fail: "Not updated" });
        if (r) {
          toast.success("Returned to the assistant", { description: "It will reply to the lead's next message." });
          router.refresh();
        }
      }}
    >
      Return to assistant
    </Button>
  );
}

export function EmailReply({ conversationId, to }: { conversationId: string; to: string }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await post(`/api/lead-response/conversations/${conversationId}`, { action: "reply", text }, { fail: "Not sent" });
        setBusy(false);
        if (r) {
          setText("");
          toast.success(r.delivered ? `Sent to ${to}` : "Recorded", { description: r.delivered ? undefined : "Email sending is not configured; the message is in the outbox." });
          router.refresh();
        }
      }}
    >
      <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Reply to ${to}`} aria-label="Email reply" />
      <div>
        <Button type="submit" size="sm" disabled={busy || text.trim().length < 2}>
          {busy ? "Sending" : "Send email"}
        </Button>
      </div>
    </form>
  );
}
