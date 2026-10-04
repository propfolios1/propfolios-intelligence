"use client";

import { Paperclip, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export type Msg = { id: string; direction: "inbound" | "outbound"; type: string; content: { text?: string; caption?: string; filename?: string; template?: string }; mediaUrl: string | null; status: string; sentBy: string | null; createdAt: string; error: string | null };
export type Conv = { id: string; contactName: string | null; contactPhone: string; lastMessageAt: string | null; lastInboundAt: string | null; unread: number; mode: "assistant" | "human"; optedOutAt: string | null; leadId: string | null };
export type Tpl = { id: string; name: string; body: string; status: string; category: string };

const TICK: Record<string, string> = { queued: "Queued", sent: "Sent", delivered: "Delivered", read: "Read", failed: "Failed", received: "" };

export function ConnectWhatsapp({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ provider: "sandbox", phoneNumber: "", displayName: "", accountRef: "", authToken: "", apiKey: "" });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Button variant={connected ? "secondary" : "primary"} onClick={() => setOpen(true)}>
        {connected ? "Change number" : "Connect WhatsApp"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogTitle>Connect a WhatsApp Business number</DialogTitle>
          <DialogDescription>Through Twilio or 360dialog, each with a number Meta has approved for the WhatsApp Business Platform. The sandbox records messages without sending them, for rehearsal.</DialogDescription>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField label="Provider">
              <Select value={f.provider} onChange={set("provider")}>
                <option value="sandbox">Nakhla sandbox</option>
                <option value="twilio">Twilio</option>
                <option value="360dialog">360dialog</option>
              </Select>
            </FormField>
            <FormField label="Business number">
              <Input value={f.phoneNumber} onChange={set("phoneNumber")} placeholder="+971 4 555 0000" />
            </FormField>
            <FormField label="Display name" className="sm:col-span-2">
              <Input value={f.displayName} onChange={set("displayName")} />
            </FormField>
            {f.provider === "twilio" && (
              <>
                <FormField label="Account SID">
                  <Input value={f.accountRef} onChange={set("accountRef")} />
                </FormField>
                <FormField label="Auth token">
                  <Input type="password" value={f.authToken} onChange={set("authToken")} autoComplete="off" />
                </FormField>
              </>
            )}
            {f.provider === "360dialog" && (
              <FormField label="Channel API key" className="sm:col-span-2" hint="From the 360dialog hub, under API keys for the channel. The webhook is registered automatically.">
                <Input type="password" value={f.apiKey} onChange={set("apiKey")} autoComplete="off" />
              </FormField>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || f.phoneNumber.length < 6}
              onClick={async () => {
                setBusy(true);
                const r = await post("/api/whatsapp", { action: "connect", provider: f.provider, phoneNumber: f.phoneNumber, displayName: f.displayName || undefined, accountRef: f.accountRef || undefined, authToken: f.authToken || undefined, apiKey: f.apiKey || undefined }, { fail: "Not connected" });
                setBusy(false);
                if (r) {
                  toast.success("WhatsApp connected", { description: f.provider === "twilio" ? "Set the webhook URL shown on this page as the number's incoming message URL in Twilio." : undefined });
                  setOpen(false);
                  router.refresh();
                }
              }}
            >
              {busy ? "Checking the credentials" : "Connect"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Settings = { welcome: string | null; awayMessage: string | null; hours: { start: string; end: string; days: number[]; timezone: string } | null; throttlePerMinute: number; autoQualify: boolean };

export function WhatsappSettingsForm({ settings, webhook }: { settings: Settings; webhook: string }) {
  const router = useRouter();
  const [f, setF] = React.useState(settings);
  const [busy, setBusy] = React.useState(false);
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3 rounded-sm bg-ink-50 px-3 py-2">
        <span className="label-caps shrink-0">Webhook</span>
        <code className="num min-w-0 flex-1 truncate text-[12px] text-ink-700">{webhook}</code>
        <CopyButton value={webhook} label="Copy" />
      </div>
      <FormField label="First reply" hint="Sent once, to a contact's first message, while the assistant handles the conversation.">
        <Textarea rows={2} value={f.welcome ?? ""} onChange={(e) => setF({ ...f, welcome: e.target.value || null })} />
      </FormField>
      <FormField label="Out-of-hours reply">
        <Textarea rows={2} value={f.awayMessage ?? ""} onChange={(e) => setF({ ...f, awayMessage: e.target.value || null })} />
      </FormField>
      {f.hours && (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Opens">
            <Input type="time" value={f.hours.start} onChange={(e) => setF({ ...f, hours: { ...f.hours!, start: e.target.value } })} />
          </FormField>
          <FormField label="Closes">
            <Input type="time" value={f.hours.end} onChange={(e) => setF({ ...f, hours: { ...f.hours!, end: e.target.value } })} />
          </FormField>
          <FormField label="Time zone">
            <Input value={f.hours.timezone} onChange={(e) => setF({ ...f, hours: { ...f.hours!, timezone: e.target.value } })} />
          </FormField>
          <div className="flex flex-wrap gap-1 sm:col-span-3" role="group" aria-label="Working days">
            {DAYS.map((d, i) => (
              <button key={d} type="button" aria-pressed={f.hours!.days.includes(i)} onClick={() => setF({ ...f, hours: { ...f.hours!, days: f.hours!.days.includes(i) ? f.hours!.days.filter((x) => x !== i) : [...f.hours!.days, i].sort() } })} className={cn("h-8 w-12 rounded-sm border text-[12px]", f.hours!.days.includes(i) ? "border-navy-900 bg-navy-900 text-surface" : "border-hairline text-ink-700")}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Broadcast throttle, messages per minute" hint="Keeps sending within the number's messaging tier.">
          <Input type="number" min={1} max={1000} className="num" value={f.throttlePerMinute} onChange={(e) => setF({ ...f, throttlePerMinute: Math.max(1, Number(e.target.value) || 1) })} />
        </FormField>
        <label className="flex items-center gap-2 pt-7 text-ui text-ink-700">
          <Checkbox checked={f.autoQualify} onCheckedChange={(v) => setF({ ...f, autoQualify: Boolean(v) })} /> Lead response assistant qualifies new contacts
        </label>
      </div>
      <div>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/whatsapp", { action: "settings", ...f }, { fail: "Not saved" });
            setBusy(false);
            if (r) {
              toast.success("WhatsApp settings saved");
              router.refresh();
            }
          }}
        >
          {busy ? "Saving" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

/** A conversation thread with composer, 24-hour window notice, template picker and hand-off control. */
export function Thread({ conversation, templates, initial }: { conversation: Conv; templates: Tpl[]; initial?: Msg[] }) {
  const [msgs, setMsgs] = React.useState<Msg[]>(initial ?? []);
  const [text, setText] = React.useState("");
  const [mode, setMode] = React.useState(conversation.mode);
  const [tpl, setTpl] = React.useState<string>("");
  const [vars, setVars] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const end = React.useRef<HTMLDivElement>(null);
  const load = React.useCallback(async () => {
    const r = await fetch(`/api/whatsapp/conversations/${conversation.id}`);
    if (r.ok) setMsgs((await r.json()).messages);
  }, [conversation.id]);
  React.useEffect(() => {
    void load();
    const t = window.setInterval(load, 8000);
    return () => window.clearInterval(t);
  }, [load]);
  React.useEffect(() => end.current?.scrollIntoView({ block: "nearest" }), [msgs.length]);
  const lastIn = [...msgs].reverse().find((m) => m.direction === "inbound");
  const open = lastIn ? Date.now() - new Date(lastIn.createdAt).getTime() < 86_400_000 : false;
  const approved = templates.filter((t) => t.status === "approved");
  const chosen = approved.find((t) => t.id === tpl);
  const need = chosen ? Math.max(0, ...[...chosen.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))) : 0;
  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await post(`/api/whatsapp/conversations/${conversation.id}`, body, { fail: "Not sent" });
    setBusy(false);
    if (r) {
      setText("");
      setTpl("");
      await load();
      if (r.message.status === "failed") toast.error("The provider refused the message", { description: r.message.error });
    }
  };
  return (
    <div className="flex h-[620px] flex-col rounded-md border border-hairline bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-ui font-medium text-ink-900">{conversation.contactName ?? conversation.contactPhone}</div>
          <div className="num text-[12px] text-ink-500">
            {conversation.contactPhone}
            {conversation.optedOutAt ? " · opted out of marketing" : ""}
          </div>
        </div>
        <Button
          size="sm"
          variant={mode === "human" ? "secondary" : "primary"}
          onClick={async () => {
            const next = mode === "human" ? "assistant" : "human";
            const res = await fetch(`/api/whatsapp/conversations/${conversation.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: next }) });
            if (res.ok) {
              setMode(next);
              toast.success(next === "human" ? "You have taken over" : "Returned to the assistant", { description: next === "human" ? "Automatic replies stop for this contact." : "Automatic replies resume." });
            }
          }}
        >
          {mode === "human" ? "Return to assistant" : "Take over"}
        </Button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto bg-canvas px-4 py-4">
        {msgs.map((m) => (
          <div key={m.id} className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[78%] rounded-md px-3 py-2 text-[14px] leading-[1.5]", m.direction === "outbound" ? "bg-navy-900 text-surface" : "border border-hairline bg-surface text-ink-900")}>
              {m.type === "template" && <div className={cn("mb-1 text-[11px] tracking-[0.06em] uppercase", m.direction === "outbound" ? "text-navy-300" : "text-ink-500")}>Template {m.content.template}</div>}
              {m.mediaUrl && (
                <a href={`/api/whatsapp/media/${m.id}`} target="_blank" rel="noreferrer" className="mb-1 inline-flex items-center gap-1 text-[13px] underline underline-offset-4">
                  <Paperclip className="size-3" aria-hidden /> {m.content.filename ?? m.type}
                </a>
              )}
              <div className="whitespace-pre-wrap">{m.content.text ?? m.content.caption ?? ""}</div>
              <div className={cn("mt-1 text-end text-[10px]", m.direction === "outbound" ? "text-navy-300" : "text-ink-400")}>
                {m.sentBy && m.direction === "outbound" ? `${m.sentBy} · ` : ""}
                {new Date(m.createdAt).toISOString().slice(11, 16)} {TICK[m.status]}
                {m.error ? ` · ${m.error}` : ""}
              </div>
            </div>
          </div>
        ))}
        {!msgs.length && <p className="text-center text-[13px] text-ink-500">No messages yet. Start with an approved template.</p>}
        <div ref={end} />
      </div>
      <div className="border-t border-hairline p-3">
        {open ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void send({ text });
            }}
          >
            <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply" className="flex-1" />
            <Button type="submit" disabled={busy || !text.trim()} aria-label="Send">
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
        ) : (
          <p className="mb-2 text-[12px] text-ink-500">The 24-hour window is closed: only an approved template can be sent until the contact replies.</p>
        )}
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Select className="h-9 min-w-[200px] flex-1" value={tpl} onChange={(e) => (setTpl(e.target.value), setVars([]))} aria-label="Template">
            <option value="">Send a template</option>
            {approved.map((t) => (
              <option key={t.id} value={t.id} disabled={Boolean(conversation.optedOutAt) && t.category === "MARKETING"}>
                {t.name}
              </option>
            ))}
          </Select>
          {Array.from({ length: need }, (_, i) => (
            <Input key={i} className="h-9 w-36" placeholder={`Value ${i + 1}`} value={vars[i] ?? ""} onChange={(e) => setVars(Object.assign([...vars], { [i]: e.target.value }))} />
          ))}
          {chosen && (
            <Button size="sm" disabled={busy || vars.filter(Boolean).length < need} onClick={() => send({ templateId: chosen.id, variables: vars })}>
              Send template
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Inbox({ conversations, templates, sandbox }: { conversations: Conv[]; templates: Tpl[]; sandbox: boolean }) {
  const router = useRouter();
  const [sel, setSel] = React.useState<string | null>(conversations[0]?.id ?? null);
  const [sim, setSim] = React.useState({ from: "+971 50 000 0000", name: "", text: "" });
  const c = conversations.find((x) => x.id === sel) ?? null;
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="rounded-md border border-hairline bg-surface">
        <ul className="max-h-[620px] divide-y divide-hairline-row overflow-y-auto">
          {conversations.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => setSel(x.id)} className={cn("flex w-full items-center justify-between gap-2 px-4 py-3 text-start transition-colors duration-150", sel === x.id ? "bg-navy-50" : "hover:bg-ink-50")}>
                <span className="min-w-0">
                  <span className="block truncate text-ui text-ink-900">{x.contactName ?? x.contactPhone}</span>
                  <span className="text-[12px] text-ink-500">{x.mode === "human" ? "Agent" : "Assistant"} · {x.lastMessageAt ? new Date(x.lastMessageAt).toISOString().slice(0, 16).replace("T", " ") : "No messages"}</span>
                </span>
                {x.unread > 0 && <span className="num rounded-full bg-navy-900 px-2 text-[11px] text-surface">{x.unread}</span>}
              </button>
            </li>
          ))}
          {!conversations.length && <li className="px-4 py-6 text-ui text-ink-500">Conversations appear here as contacts write in.</li>}
        </ul>
        {sandbox && (
          <form
            className="grid gap-2 border-t border-hairline p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await post("/api/whatsapp", { action: "simulate", from: sim.from, name: sim.name || undefined, text: sim.text }, { fail: "Not simulated" });
              if (r) {
                setSim({ ...sim, text: "" });
                router.refresh();
              }
            }}
          >
            <div className="label-caps">Simulate an inbound message (sandbox)</div>
            <div className="grid grid-cols-2 gap-2">
              <Input className="h-9" value={sim.from} onChange={(e) => setSim({ ...sim, from: e.target.value })} aria-label="From number" />
              <Input className="h-9" value={sim.name} onChange={(e) => setSim({ ...sim, name: e.target.value })} placeholder="Name" aria-label="Contact name" />
            </div>
            <Input className="h-9" value={sim.text} onChange={(e) => setSim({ ...sim, text: e.target.value })} placeholder="Message" aria-label="Message" />
            <Button size="sm" variant="secondary" type="submit" disabled={!sim.text}>
              Receive
            </Button>
          </form>
        )}
      </div>
      {c ? <Thread key={c.id} conversation={c} templates={templates} /> : <div className="flex h-[620px] items-center justify-center rounded-md border border-hairline bg-surface text-ui text-ink-500">Choose a conversation.</div>}
    </div>
  );
}

export function TemplateManager({ templates }: { templates: (Tpl & { language: string; rejectionReason: string | null })[] }) {
  const router = useRouter();
  const [f, setF] = React.useState({ name: "", category: "UTILITY", language: "en", body: "", variables: "" });
  const [busy, setBusy] = React.useState(false);
  const count = Math.max(0, ...[...f.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="rounded-md border border-hairline bg-surface">
        <table className="w-full text-ui">
          <thead>
            <tr className="h-8 border-b border-hairline">
              <th className="label-caps px-4 text-start">Template</th>
              <th className="label-caps px-3 text-start">Category</th>
              <th className="label-caps px-3 text-start">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-hairline-row align-top">
                <td className="px-4 py-3">
                  <div className="num text-ink-900">
                    {t.name} <span className="text-ink-500">· {t.language}</span>
                  </div>
                  <div className="mt-1 max-w-[52ch] text-[12px] text-ink-700">{t.body}</div>
                  {t.rejectionReason && <div className="mt-1 text-[12px] text-danger">{t.rejectionReason}</div>}
                </td>
                <td className="px-3 py-3 text-ink-700">{t.category.toLowerCase()}</td>
                <td className="px-3 py-3">
                  <StatusPill tone={t.status === "approved" ? "complete" : t.status === "rejected" ? "error" : t.status === "submitted" ? "progress" : "neutral"}>{t.status}</StatusPill>
                </td>
                <td className="px-3 py-3 text-end">
                  {(t.status === "draft" || t.status === "rejected") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const r = await post(`/api/whatsapp/templates/${t.id}`, {}, { fail: "Not submitted" });
                        if (r) {
                          toast.success(r.template.status === "approved" ? "Approved" : "Submitted to Meta", { description: r.template.status === "approved" ? undefined : "Review usually takes minutes to a day." });
                          router.refresh();
                        }
                      }}
                    >
                      Submit
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!templates.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-ink-500">
                  No templates yet. Templates start conversations and carry broadcasts once Meta approves them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="grid content-start gap-4 rounded-md border border-hairline bg-surface p-5">
        <h3 className="text-[16px] font-medium text-navy-900">New template</h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Name">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="viewing_reminder" />
          </FormField>
          <FormField label="Category">
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              <option value="UTILITY">Utility</option>
              <option value="MARKETING">Marketing</option>
              <option value="AUTHENTICATION">Authentication</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Language">
          <Select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value })}>
            <option value="en">English</option>
            <option value="ar">Arabic</option>
            <option value="hi">Hindi</option>
          </Select>
        </FormField>
        <FormField label="Body" hint="Use {{1}}, {{2}} for values filled in when sending.">
          <Textarea rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Hello {{1}}, your viewing of {{2}} is confirmed." />
        </FormField>
        {count > 0 && (
          <FormField label={`Example values, ${count}`} hint="Comma separated. Meta reviews the template with these.">
            <Input value={f.variables} onChange={(e) => setF({ ...f, variables: e.target.value })} placeholder="Sarah, Marina Gate 2" />
          </FormField>
        )}
        <Button
          disabled={busy || !f.name || f.body.length < 5}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/whatsapp/templates", { ...f, variables: f.variables.split(",").map((v) => v.trim()).filter(Boolean) }, { fail: "Template not created" });
            setBusy(false);
            if (r) {
              setF({ name: "", category: "UTILITY", language: "en", body: "", variables: "" });
              router.refresh();
            }
          }}
        >
          Create draft
        </Button>
      </div>
    </div>
  );
}

export function BroadcastForm({ templates, segments }: { templates: Tpl[]; segments: Record<string, string> }) {
  const router = useRouter();
  const [f, setF] = React.useState({ name: "", templateId: "", segment: "all_consented", variables: [] as string[] });
  const [busy, setBusy] = React.useState(false);
  const approved = templates.filter((t) => t.status === "approved");
  const chosen = approved.find((t) => t.id === f.templateId);
  const need = chosen ? Math.max(0, ...[...chosen.body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))) : 0;
  return (
    <div className="grid gap-4 rounded-md border border-hairline bg-surface p-5">
      <h3 className="text-[16px] font-medium text-navy-900">New broadcast</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Marina Gate launch" />
        </FormField>
        <FormField label="Audience" hint="Only contacts who consented to marketing and have not replied STOP.">
          <Select value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })}>
            {Object.entries(segments).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Approved template" className="sm:col-span-2">
          <Select value={f.templateId} onChange={(e) => setF({ ...f, templateId: e.target.value, variables: [] })}>
            <option value="">Choose</option>
            {approved.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
        {chosen && <p className="text-[13px] text-ink-700 sm:col-span-2">{chosen.body}</p>}
        {Array.from({ length: need }, (_, i) => (
          <FormField key={i} label={`Value ${i + 1}`} hint={i === 0 ? "{first_name}, {name} and {agent_name} are filled per contact." : undefined}>
            <Input value={f.variables[i] ?? ""} onChange={(e) => setF({ ...f, variables: Object.assign([...f.variables], { [i]: e.target.value }) })} />
          </FormField>
        ))}
      </div>
      <div>
        <Button
          disabled={busy || !f.name || !chosen || f.variables.filter(Boolean).length < need}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/whatsapp/broadcasts", f, { fail: "Broadcast not started" });
            setBusy(false);
            if (r) {
              toast.success(`Sending to ${r.broadcast.totals.queued} contacts`, { description: `${r.broadcast.totals.excluded} excluded for consent or opt-out. Sending continues every minute within the throttle.` });
              router.refresh();
            }
          }}
        >
          {busy ? "Starting" : "Start broadcast"}
        </Button>
      </div>
    </div>
  );
}
