"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import type { AudienceFilter, SocialNetwork } from "@/db/schema-production";
import { cn } from "@/lib/utils";

const INTENTS = [
  ["buy", "Buyers"],
  ["invest", "Investors"],
  ["rent", "Tenants"],
  ["sell", "Sellers"],
  ["let", "Landlords"],
] as const;
const NETWORK_LABEL: Record<SocialNetwork, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X", tiktok: "TikTok" };
const LIMIT: Record<SocialNetwork, number> = { instagram: 2200, facebook: 63206, linkedin: 3000, x: 280, tiktok: 4000 };
const MERGE = ["{first_name}", "{agent_name}", "{firm}", "{listing_title}", "{listing_price}", "{listing_url}", "{community}"];

const toggle = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);
const n = (v: string) => (v === "" ? null : Number(v));

/* -------------------------------------------------------------- audience */

export function AudienceBuilder({ value, onChange }: { value: AudienceFilter; onChange: (f: AudienceFilter) => void }) {
  const [count, setCount] = React.useState<{ count: { n: number; email: number; phone: number }; sample: { name: string; intent: string; score: number }[] } | null>(null);
  React.useEffect(() => {
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      const r = await fetch("/api/marketing/audiences/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value), signal: ctl.signal }).catch(() => null);
      if (r?.ok) setCount(await r.json());
    }, 300);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [value]);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid gap-4">
        <div>
          <div className="label-caps mb-2">Looking to</div>
          <div className="flex flex-wrap gap-4">
            {INTENTS.map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-ui text-ink-700">
                <Checkbox checked={value.intents?.includes(k) ?? false} onCheckedChange={() => onChange({ ...value, intents: toggle(value.intents, k) })} /> {l}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Budget from">
            <Input type="number" min={0} className="num" value={value.budgetMin ?? ""} onChange={(e) => onChange({ ...value, budgetMin: n(e.target.value) })} />
          </FormField>
          <FormField label="Budget to">
            <Input type="number" min={0} className="num" value={value.budgetMax ?? ""} onChange={(e) => onChange({ ...value, budgetMax: n(e.target.value) })} />
          </FormField>
          <FormField label="Minimum score">
            <Input type="number" min={0} max={100} className="num" value={value.scoreMin ?? ""} onChange={(e) => onChange({ ...value, scoreMin: n(e.target.value) })} />
          </FormField>
          <FormField label="Areas" className="sm:col-span-3" hint="Comma separated, as the leads named them.">
            <Input value={(value.locations ?? []).join(", ")} onChange={(e) => onChange({ ...value, locations: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Dubai Marina, Jumeirah Village Circle" />
          </FormField>
          <FormField label="Arrived within, days">
            <Input type="number" min={1} className="num" value={value.createdWithinDays ?? ""} onChange={(e) => onChange({ ...value, createdWithinDays: n(e.target.value) })} />
          </FormField>
          <FormField label="No contact for, days">
            <Input type="number" min={1} className="num" value={value.noContactForDays ?? ""} onChange={(e) => onChange({ ...value, noContactForDays: n(e.target.value) })} />
          </FormField>
          <div className="flex flex-wrap items-end gap-4 pb-2">
            {(["email", "phone"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 text-ui text-ink-700">
                <Checkbox checked={value.require?.includes(k) ?? false} onCheckedChange={() => onChange({ ...value, require: toggle(value.require, k) })} /> Has {k}
              </label>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-ink-500">Only open leads who consented to marketing are ever included. WhatsApp steps also skip anyone who replied STOP.</p>
      </div>
      <div className="rounded-md border border-hairline bg-surface p-4">
        <div className="label-caps">Audience</div>
        <div className="num mt-1 text-[32px] leading-none text-navy-900">{count?.count.n ?? "…"}</div>
        <div className="num mt-2 text-[12px] text-ink-500">
          {count ? `${count.count.email} with email · ${count.count.phone} with phone` : "Counting"}
        </div>
        <ul className="mt-4 space-y-1 text-[13px]">
          {count?.sample.map((m, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate text-ink-900">{m.name}</span>
              <span className="num shrink-0 text-ink-500">{m.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SaveAudience() {
  const router = useRouter();
  const [f, setF] = React.useState<AudienceFilter>({ intents: ["buy", "invest"] });
  const [name, setName] = React.useState("");
  return (
    <div className="grid gap-4 rounded-md border border-hairline bg-surface p-5">
      <AudienceBuilder value={f} onChange={setF} />
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Name" className="w-72">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Marina buyers, AED 2M to 3M" />
        </FormField>
        <Button
          disabled={name.trim().length < 3}
          onClick={async () => {
            const r = await post("/api/marketing/audiences", { name, filter: f }, { fail: "Not saved" });
            if (r) {
              toast.success(`Saved "${r.audience.name}"`, { description: `${r.audience.lastCount} leads today; the count updates as leads arrive.` });
              setName("");
              router.refresh();
            }
          }}
        >
          Save audience
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- campaign */

type Step = { channel: "email" | "whatsapp"; delayHours: number; subject: string; body: string; whatsappTemplateId: string; whatsappVariables: string[]; stopOnReply: boolean };
const blank = (i: number): Step => ({ channel: "email", delayHours: i === 0 ? 0 : 72, subject: "", body: "", whatsappTemplateId: "", whatsappVariables: [], stopOnReply: true });

export function CampaignBuilder({ audiences, templates, networks }: { audiences: { id: string; name: string; lastCount: number | null }[]; templates: { id: string; name: string; body: string }[]; networks: SocialNetwork[] }) {
  const router = useRouter();
  const [kind, setKind] = React.useState<"one_off" | "sequence" | "auto_promote">("sequence");
  const [name, setName] = React.useState("");
  const [trigger, setTrigger] = React.useState<"manual" | "lead_created">("lead_created");
  const [audienceId, setAudienceId] = React.useState("");
  const [filter, setFilter] = React.useState<AudienceFilter>({ intents: ["buy", "invest"] });
  const [nets, setNets] = React.useState<SocialNetwork[]>([]);
  const [steps, setSteps] = React.useState<Step[]>([
    { ...blank(0), subject: "{first_name}, homes that match your brief", body: "Good afternoon {first_name},\n\nThank you for your enquiry. {agent_name} has prepared a shortlist of homes that match what you told us, and can arrange viewings this week.\n\nKind regards,\n{agent_name}\n{firm}" },
  ]);
  const [busy, setBusy] = React.useState(false);
  const set = (i: number, p: Partial<Step>) => setSteps(steps.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const submit = async (activate: boolean) => {
    setBusy(true);
    const r = await post(
      "/api/marketing/campaigns",
      {
        name,
        kind,
        trigger: kind === "sequence" ? trigger : "manual",
        audienceId: kind === "auto_promote" ? null : audienceId || null,
        audienceFilter: kind === "auto_promote" || audienceId ? null : filter,
        networks: kind === "auto_promote" ? nets : undefined,
        steps: steps.map((s) => ({ channel: s.channel, delayHours: s.delayHours, subject: s.channel === "email" ? s.subject : null, body: s.body, whatsappTemplateId: s.channel === "whatsapp" ? s.whatsappTemplateId || null : null, whatsappVariables: s.whatsappVariables, stopOnReply: s.stopOnReply })),
        activate,
      },
      { fail: "Campaign not saved" },
    );
    setBusy(false);
    if (r) {
      toast.success(activate ? `Active${r.enrolled ? `, ${r.enrolled} leads enrolled` : ""}` : "Saved as a draft");
      router.push(`/admin/marketing/campaigns/${r.campaign.id}`);
    }
  };
  return (
    <div className="grid gap-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Name" className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New buyer welcome" />
        </FormField>
        <FormField label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="sequence">Sequence: several steps over days</option>
            <option value="one_off">One-off send to an audience</option>
            <option value="auto_promote">Auto-promote every new listing</option>
          </Select>
        </FormField>
        {kind === "sequence" && (
          <FormField label="Who enters" className="sm:col-span-3">
            <Select value={trigger} onChange={(e) => setTrigger(e.target.value as typeof trigger)}>
              <option value="lead_created">Each new lead that matches the audience, as it arrives</option>
              <option value="manual">Everyone in the audience today</option>
            </Select>
          </FormField>
        )}
      </div>
      {kind === "auto_promote" ? (
        <div className="grid gap-3 rounded-md border border-hairline bg-surface p-5">
          <p className="text-ui text-ink-700">When a listing goes live, or its price falls by 2% or more, it is sent to open leads with the matching intent whose budget is within 15% of the price, and posted on the networks below.</p>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(NETWORK_LABEL) as SocialNetwork[]).map((nw) => (
              <label key={nw} className={cn("flex items-center gap-2 text-ui", networks.includes(nw) ? "text-ink-700" : "text-ink-400")}>
                <Checkbox disabled={!networks.includes(nw)} checked={nets.includes(nw)} onCheckedChange={() => setNets(toggle(nets, nw))} /> {NETWORK_LABEL[nw]}
                {!networks.includes(nw) && <span className="text-[11px]">(not connected)</span>}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="label-caps">Audience</div>
          <Select className="max-w-md" value={audienceId} onChange={(e) => setAudienceId(e.target.value)}>
            <option value="">Define the audience here</option>
            {audiences.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.lastCount ?? 0})
              </option>
            ))}
          </Select>
          {!audienceId && <AudienceBuilder value={filter} onChange={setFilter} />}
        </div>
      )}
      <div className="grid gap-3">
        <div className="label-caps">Steps</div>
        {steps.map((st, i) => (
          <div key={i} className="relative grid gap-3 rounded-md border border-hairline bg-surface p-4">
            {steps.length > 1 && (
              <button type="button" className="absolute end-3 top-3 text-ink-400 hover:text-ink-900" aria-label="Remove step" onClick={() => setSteps(steps.filter((_, k) => k !== i))}>
                <X className="size-3.5" />
              </button>
            )}
            <div className="grid gap-3 sm:grid-cols-[120px_160px_minmax(0,1fr)]">
              <div className="label-caps pt-8">Step {i + 1}</div>
              <FormField label="Channel">
                <Select value={st.channel} onChange={(e) => set(i, { channel: e.target.value as Step["channel"] })}>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp template</option>
                </Select>
              </FormField>
              <FormField label={i === 0 ? "Send after enrolment, hours" : "Send after the previous step, hours"}>
                <Input type="number" min={0} className="num" value={st.delayHours} onChange={(e) => set(i, { delayHours: Math.max(0, Number(e.target.value) || 0) })} />
              </FormField>
            </div>
            {st.channel === "email" ? (
              <>
                <FormField label="Subject">
                  <Input value={st.subject} onChange={(e) => set(i, { subject: e.target.value })} />
                </FormField>
                <FormField label="Message" hint={`Merge fields: ${MERGE.join(" ")}`}>
                  <Textarea rows={7} value={st.body} onChange={(e) => set(i, { body: e.target.value })} />
                </FormField>
              </>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Approved template">
                  <Select value={st.whatsappTemplateId} onChange={(e) => set(i, { whatsappTemplateId: e.target.value })}>
                    <option value="">{templates.length ? "Choose" : "No approved templates yet"}</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Template values" hint="Comma separated; merge fields allowed.">
                  <Input value={st.whatsappVariables.join(", ")} onChange={(e) => set(i, { whatsappVariables: e.target.value.split(",").map((x) => x.trim()) })} placeholder="{first_name}, {listing_title}" />
                </FormField>
                {st.whatsappTemplateId && <p className="text-[13px] text-ink-700 sm:col-span-2">{templates.find((t) => t.id === st.whatsappTemplateId)?.body}</p>}
              </div>
            )}
            <label className="flex items-center gap-2 text-ui text-ink-700">
              <Checkbox checked={st.stopOnReply} onCheckedChange={(v) => set(i, { stopOnReply: Boolean(v) })} /> Stop if the lead has replied
            </label>
          </div>
        ))}
        {steps.length < 8 && (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSteps([...steps, blank(steps.length)])}>
              <Plus className="size-3.5" /> Add a step
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || name.trim().length < 3} onClick={() => submit(true)}>
          {kind === "one_off" ? "Send now" : "Activate"}
        </Button>
        <Button variant="secondary" disabled={busy || name.trim().length < 3} onClick={() => submit(false)}>
          Save as draft
        </Button>
      </div>
    </div>
  );
}

export function CampaignControls({ id, status, active }: { id: string; status: string; active: boolean }) {
  const router = useRouter();
  const act = async (action: "activate" | "pause" | "resume") => {
    const r = await post(`/api/marketing/campaigns/${id}`, { action }, { fail: "Not updated" });
    if (r) {
      if (action === "activate") toast.success(`Active, ${r.enrolled} leads enrolled`);
      router.refresh();
    }
  };
  if (status === "completed" || status === "sent") return null;
  if (status === "draft") return <Button onClick={() => act("activate")}>Activate</Button>;
  return (
    <Button variant="secondary" onClick={() => act(active ? "pause" : "resume")}>
      {active ? "Pause" : "Resume"}
    </Button>
  );
}

/* ---------------------------------------------------------------- social */

export function ConnectSocial({ network, connected }: { network: SocialNetwork; connected: { mode: string; displayName: string } | null }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ mode: "sandbox", displayName: "", accessToken: "", pageId: "", igUserId: "", orgUrn: "" });
  return (
    <div className="rounded-md border border-hairline bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-ui font-medium text-ink-900">{NETWORK_LABEL[network]}</div>
          <div className="text-[12px] text-ink-500">{connected ? `${connected.displayName} · ${connected.mode === "sandbox" ? "sandbox, nothing is posted" : "live"}` : "Not connected"}</div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>
          {connected ? "Change" : "Connect"}
        </Button>
      </div>
      {open && (
        <div className="mt-4 grid gap-3">
          <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} aria-label="Mode">
            <option value="sandbox">Sandbox: record posts without publishing</option>
            <option value="live">Live: publish with the firm&apos;s access token</option>
          </Select>
          <Input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} placeholder="Account or page name" aria-label="Display name" />
          {f.mode === "live" && (
            <>
              <Input value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} placeholder="Access token" aria-label="Access token" />
              {network === "facebook" && <Input value={f.pageId} onChange={(e) => setF({ ...f, pageId: e.target.value })} placeholder="Facebook Page ID" aria-label="Page ID" />}
              {network === "instagram" && <Input value={f.igUserId} onChange={(e) => setF({ ...f, igUserId: e.target.value })} placeholder="Instagram business account ID" aria-label="Instagram account ID" />}
              {network === "linkedin" && <Input value={f.orgUrn} onChange={(e) => setF({ ...f, orgUrn: e.target.value })} placeholder="urn:li:organization:12345" aria-label="Organisation URN" />}
            </>
          )}
          <div>
            <Button
              size="sm"
              disabled={f.displayName.trim().length < 2}
              onClick={async () => {
                const r = await post("/api/marketing/social", { action: "connect", network, mode: f.mode, displayName: f.displayName, creds: f.mode === "live" ? { accessToken: f.accessToken || undefined, pageId: f.pageId || undefined, igUserId: f.igUserId || undefined, orgUrn: f.orgUrn || undefined } : undefined }, { fail: "Not connected", ok: `${NETWORK_LABEL[network]} connected` });
                if (r) {
                  setOpen(false);
                  router.refresh();
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SocialComposer({ networks, listings }: { networks: SocialNetwork[]; listings: { id: string; title: string; photos: string[]; url: string | null }[] }) {
  const router = useRouter();
  const [nets, setNets] = React.useState<SocialNetwork[]>(networks.slice(0, 2));
  const [caption, setCaption] = React.useState("");
  const [link, setLink] = React.useState("");
  const [listingId, setListingId] = React.useState("");
  const [media, setMedia] = React.useState("");
  const [when, setWhen] = React.useState(() => new Date(Date.now() + 3_600_000).toISOString().slice(0, 16));
  const listing = listings.find((l) => l.id === listingId);
  return (
    <div className="grid gap-4 rounded-md border border-hairline bg-surface p-5">
      <div className="flex flex-wrap gap-4">
        {networks.map((nw) => (
          <label key={nw} className="flex items-center gap-2 text-ui text-ink-700">
            <Checkbox checked={nets.includes(nw)} onCheckedChange={() => setNets(toggle(nets, nw))} /> {NETWORK_LABEL[nw]}
          </label>
        ))}
        {!networks.length && <span className="text-ui text-ink-500">Connect a network first.</span>}
      </div>
      <FormField label="About a listing">
        <Select
          value={listingId}
          onChange={(e) => {
            const l = listings.find((x) => x.id === e.target.value);
            setListingId(e.target.value);
            if (l) {
              setMedia(l.photos.slice(0, 4).join("\n"));
              if (l.url) setLink(l.url);
              if (!caption) setCaption(`${l.title}. Contact us to arrange a viewing.`);
            }
          }}
        >
          <option value="">None</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Caption">
        <Textarea rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} />
      </FormField>
      <div className="flex flex-wrap gap-3 text-[12px]">
        {nets.map((nw) => {
          const used = nw === "x" ? caption.length + (link ? 24 : 0) : caption.length;
          return (
            <span key={nw} className={cn("num", used > LIMIT[nw] ? "text-warning" : "text-ink-500")}>
              {NETWORK_LABEL[nw]} {used}/{LIMIT[nw]}
              {used > LIMIT[nw] ? " (will be shortened)" : ""}
            </span>
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Link">
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
        </FormField>
        <FormField label="Publish at">
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </FormField>
      </div>
      <FormField label="Images" hint="One URL per line. Instagram and TikTok need at least one.">
        <Textarea rows={3} value={media} onChange={(e) => setMedia(e.target.value)} />
      </FormField>
      <div>
        <Button
          disabled={!nets.length || !caption.trim()}
          onClick={async () => {
            const r = await post("/api/marketing/social", { action: "schedule", networks: nets, caption, link: link || null, mediaUrls: media.split("\n").map((x) => x.trim()).filter(Boolean), scheduledAt: new Date(when).toISOString(), listingId: listing?.id ?? null }, { fail: "Not scheduled", ok: "Scheduled" });
            if (r) {
              setCaption("");
              router.refresh();
            }
          }}
        >
          Schedule
        </Button>
      </div>
    </div>
  );
}
