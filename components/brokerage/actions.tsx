"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { AgentOutput } from "@/components/os/agent-output";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";

type Opt = { id: string; name: string };
type MarketOpt = { code: string; name: string; currency: string; portals: { key: string; name: string; feed: boolean }[] };

function Modal({ trigger, title, description, children, open, setOpen }: { trigger: React.ReactNode; title: string; description: string; children: React.ReactNode; open: boolean; setOpen: (o: boolean) => void }) {
  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[640px]">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          {children}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------- Leads */

export function CreateLead({ markets, sources, listings }: { markets: MarketOpt[]; sources: { key: string; name: string }[]; listings: (Opt & { market: string })[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ name: "", email: "", phone: "", source: "walk_in", market: markets[0]?.code ?? "AE", intent: "buy", timeline: "3_months", listingId: "", message: "", consent: true });
  const [budget, setBudget] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const cur = markets.find((m) => m.code === f.market)?.currency ?? "AED";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true);
    const r = await post("/api/leads", { name: f.name, email: f.email || null, phone: f.phone || null, source: f.source, market: f.market, intent: f.intent, timeline: f.timeline, budgetMax: budget, listingId: f.listingId || null, message: f.message || null, consentMarketing: f.consent }, { fail: "Lead not recorded" });
    setBusy(false);
    if (r) {
      toast.success(`${r.reference} recorded`, { description: "Assigned, scored and added to the board." });
      router.push(`/analyst/leads/${r.id}`);
    }
  };
  return (
    <Modal open={open} setOpen={setOpen} title="Record lead" description="Portal enquiries arrive on their own through the lead endpoint; record calls, walk-ins and WhatsApp enquiries here." trigger={<Button onClick={() => setOpen(true)}>Record lead</Button>}>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Name">
          <Input value={f.name} onChange={set("name")} autoComplete="off" />
        </FormField>
        <FormField label="Source">
          <Select value={f.source} onChange={set("source")}>
            {sources.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Email">
          <Input type="email" value={f.email} onChange={set("email")} />
        </FormField>
        <FormField label="Phone, international format">
          <Input value={f.phone} onChange={set("phone")} placeholder="+971 50 000 0000" />
        </FormField>
        <FormField label="Market">
          <Select value={f.market} onChange={set("market")}>
            {markets.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Intent">
          <Select value={f.intent} onChange={set("intent")}>
            <option value="buy">Buy</option>
            <option value="invest">Invest</option>
            <option value="rent">Rent</option>
            <option value="sell">Sell</option>
            <option value="let">Let</option>
          </Select>
        </FormField>
        <FormField label="Timeline">
          <Select value={f.timeline} onChange={set("timeline")}>
            <option value="immediate">Immediate</option>
            <option value="3_months">Within 3 months</option>
            <option value="6_months">Within 6 months</option>
            <option value="12_months">Within 12 months</option>
            <option value="exploring">Exploring</option>
          </Select>
        </FormField>
        <FormField label="Maximum budget">
          <MoneyInput value={budget} onChange={setBudget} currency={cur} />
        </FormField>
        <FormField label="Listing enquired about" className="sm:col-span-2">
          <Select value={f.listingId} onChange={set("listingId")}>
            <option value="">None</option>
            {listings
              .filter((l) => l.market === f.market)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField label="What they asked" className="sm:col-span-2">
          <Textarea rows={2} value={f.message} onChange={set("message")} />
        </FormField>
        <label className="flex items-center gap-2 text-ui text-ink-700 sm:col-span-2">
          <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
          Consented to marketing
        </label>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={submit} disabled={busy || f.name.trim().length < 2 || (!f.email && !f.phone)}>
          {busy ? "Recording" : "Record lead"}
        </Button>
      </div>
    </Modal>
  );
}

const STAGES = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["viewing", "Viewing"],
  ["offer", "Offer"],
  ["won", "Won"],
  ["lost", "Lost"],
] as const;

export function LeadStage({ leadId, stage }: { leadId: string; stage: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [lost, setLost] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const move = async (to: string, lostReason?: string) => {
    setBusy(true);
    const r = await post(`/api/leads/${leadId}/stage`, { stage: to, lostReason }, { fail: "Stage not changed" });
    setBusy(false);
    if (r) {
      setLost(false);
      router.refresh();
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Lead stage">
        {STAGES.map(([k, l]) => (
          <button
            key={k}
            type="button"
            disabled={busy || k === stage}
            aria-pressed={k === stage}
            onClick={() => (k === "lost" ? setLost(true) : move(k))}
            className={"h-8 rounded-sm border px-3 text-ui transition-colors duration-150 " + (k === stage ? "border-navy-900 bg-navy-900 text-surface" : "border-hairline bg-surface text-ink-700 hover:bg-ink-50")}
          >
            {l}
          </button>
        ))}
      </div>
      {lost && (
        <div className="flex flex-wrap items-end gap-2">
          <FormField label="Why was it lost" className="min-w-[260px] flex-1">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bought through another agency" />
          </FormField>
          <Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => move("lost", reason.trim())}>
            Mark lost
          </Button>
        </div>
      )}
    </div>
  );
}

export function LogActivity({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [type, setType] = React.useState("call");
  const [summary, setSummary] = React.useState("");
  const [nextAction, setNextAction] = React.useState("");
  const [nextAt, setNextAt] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    setBusy(true);
    const r = await post(`/api/leads/${leadId}/activity`, { type, summary, nextAction: nextAction || undefined, nextActionAt: nextAt ? new Date(nextAt).toISOString() : undefined }, { ok: "Activity logged; score updated", fail: "Activity not logged" });
    setBusy(false);
    if (r) {
      setSummary("");
      setNextAction("");
      setNextAt("");
      router.refresh();
    }
  };
  return (
    <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
      <FormField label="Type">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="call">Call</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="viewing">Viewing</option>
          <option value="note">Note</option>
        </Select>
      </FormField>
      <FormField label="What happened">
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Confirmed mortgage pre-approval; wants two viewings on Saturday" />
      </FormField>
      <FormField label="Next action">
        <Input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Viewing" />
      </FormField>
      <FormField label="Due">
        <Input type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
      </FormField>
      <div className="sm:col-span-2">
        <Button onClick={submit} disabled={busy || summary.trim().length < 3}>
          {busy ? "Logging" : "Log activity"}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Listings */

export function CreateListing({ markets }: { markets: MarketOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ title: "", market: markets[0]?.code ?? "AE", city: "", community: "", propertyType: "Apartment", purpose: "sale", bedrooms: "2", bathrooms: "2", area: "", permitNumber: "", features: "" });
  const [price, setPrice] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const cur = markets.find((m) => m.code === f.market)?.currency ?? "AED";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true);
    const r = await post(
      "/api/listings",
      { title: f.title, market: f.market, city: f.city, community: f.community, propertyType: f.propertyType, purpose: f.purpose, price, bedrooms: f.bedrooms === "" ? null : Number(f.bedrooms), bathrooms: f.bathrooms === "" ? null : Number(f.bathrooms), area: Number(f.area), permitNumber: f.permitNumber || null, features: f.features.split(",").map((x) => x.trim()).filter((x) => x.length > 1) },
      { fail: "Listing not created" },
    );
    setBusy(false);
    if (r) {
      toast.success(`${r.reference} created as a draft`);
      router.push(`/analyst/listings/${r.id}`);
    }
  };
  return (
    <Modal open={open} setOpen={setOpen} title="Create listing" description="Listings start as drafts. Add the permit, photographs and copy, then activate and syndicate." trigger={<Button onClick={() => setOpen(true)}>Create listing</Button>}>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Title" className="sm:col-span-2">
          <Input value={f.title} onChange={set("title")} placeholder="Two-bedroom apartment, Marina Gate 2" />
        </FormField>
        <FormField label="Market">
          <Select value={f.market} onChange={set("market")}>
            {markets.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Purpose">
          <Select value={f.purpose} onChange={set("purpose")}>
            <option value="sale">Sale</option>
            <option value="rent">Rent</option>
          </Select>
        </FormField>
        <FormField label="City">
          <Input value={f.city} onChange={set("city")} />
        </FormField>
        <FormField label="Community">
          <Input value={f.community} onChange={set("community")} />
        </FormField>
        <FormField label="Type">
          <Select value={f.propertyType} onChange={set("propertyType")}>
            {["Apartment", "Villa", "Townhouse", "Penthouse", "Office", "Retail", "Land"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={f.purpose === "rent" ? "Rent" : "Price"}>
          <MoneyInput value={price} onChange={setPrice} currency={cur} />
        </FormField>
        <FormField label="Bedrooms">
          <Input type="number" min={0} value={f.bedrooms} onChange={set("bedrooms")} className="num" />
        </FormField>
        <FormField label="Bathrooms">
          <Input type="number" min={0} value={f.bathrooms} onChange={set("bathrooms")} className="num" />
        </FormField>
        <FormField label="Area">
          <Input type="number" min={1} value={f.area} onChange={set("area")} className="num" />
        </FormField>
        <FormField label="Permit or registration number">
          <Input value={f.permitNumber} onChange={set("permitNumber")} />
        </FormField>
        <FormField label="Features, separated by commas" className="sm:col-span-2">
          <Input value={f.features} onChange={set("features")} placeholder="Balcony, covered parking, gym" />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={submit} disabled={busy || f.title.length < 5 || !price || !Number(f.area) || f.city.length < 2 || f.community.length < 2}>
          {busy ? "Creating" : "Create listing"}
        </Button>
      </div>
    </Modal>
  );
}

export function ListingStatusControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Select
      aria-label="Listing status"
      value={status}
      disabled={busy}
      onChange={async (e) => {
        setBusy(true);
        const r = await post(`/api/listings/${id}`, { status: e.target.value }, { method: "PATCH", ok: "Status updated", fail: "Status not updated" });
        setBusy(false);
        if (r) router.refresh();
      }}
      className="w-[160px]"
    >
      {[
        ["draft", "Draft"],
        ["active", "Active"],
        ["under_offer", "Under offer"],
        ["sold", "Sold"],
        ["let", "Let"],
        ["withdrawn", "Withdrawn"],
      ].map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </Select>
  );
}

export function Syndicate({ id, portals, current }: { id: string; portals: { key: string; name: string }[]; current: string[] }) {
  const router = useRouter();
  const [sel, setSel] = React.useState<string[]>(current.length ? current : portals.map((p) => p.key));
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="flex flex-wrap items-center gap-4">
      {portals.map((p) => (
        <label key={p.key} className="flex items-center gap-2 text-ui text-ink-700">
          <input type="checkbox" checked={sel.includes(p.key)} onChange={(e) => setSel(e.target.checked ? [...sel, p.key] : sel.filter((x) => x !== p.key))} />
          {p.name}
        </label>
      ))}
      <Button
        variant="secondary"
        disabled={busy || !sel.length}
        onClick={async () => {
          setBusy(true);
          const r = await post(`/api/listings/${id}/syndicate`, { portals: sel }, { fail: "Not syndicated" });
          setBusy(false);
          if (r) {
            if (r.status === "rejected") toast.error("Held back from the portals", { description: r.issues[0] });
            else toast.success(r.status === "queued" ? "Queued; the portals pick it up on their next feed pull" : "Saved; the listing goes out when it is active");
            router.refresh();
          }
        }}
      >
        {busy ? "Saving" : "Syndicate"}
      </Button>
    </div>
  );
}

type Draft = { output: { headline: string; points: { label: string; detail: string }[]; confidence: number; title?: string; description?: string; features?: string[]; subject?: string; preview?: string; body?: string }; model?: string; costUsd?: number };

export function ListingWriter({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={draft ? "secondary" : "primary"}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await post(`/api/listings/${id}/describe`, {}, { fail: "Listing writer did not complete" });
            setBusy(false);
            if (r) setDraft(r);
          }}
        >
          {busy ? "Writing" : draft ? "Write again" : "Draft copy with the listing writer"}
        </Button>
        {draft && (
          <Button
            onClick={async () => {
              const r = await post(`/api/listings/${id}`, { title: draft.output.title, description: draft.output.description, descriptionSource: "ai", features: draft.output.features }, { method: "PATCH", ok: "Copy applied to the listing", fail: "Copy not applied" });
              if (r) {
                setDraft(null);
                router.refresh();
              }
            }}
          >
            Apply to listing
          </Button>
        )}
      </div>
      {busy && <Skeleton className="h-32 w-full" />}
      {draft && !busy && (
        <AgentOutput agent="Listing writer" output={draft.output} model={draft.model} costUsd={draft.costUsd}>
          <div className="mt-5 border-t border-hairline pt-5">
            <div className="text-ui font-medium text-ink-900">{draft.output.title}</div>
            <p className="mt-2 text-ui whitespace-pre-line text-ink-700">{draft.output.description}</p>
          </div>
        </AgentOutput>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Marketing */

export function CampaignComposer({ segments, listings }: { segments: { key: string; label: string; size: number }[]; listings: Opt[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ name: "", channel: "email", segment: segments[0]?.key ?? "all", listingId: "", brief: "", subject: "", body: "" });
  const [source, setSource] = React.useState<"manual" | "ai">("manual");
  const [busy, setBusy] = React.useState<"draft" | "save" | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const draft = async () => {
    setBusy("draft");
    const r = await post("/api/campaigns/draft", { channel: f.channel, brief: f.brief, segment: f.segment, listingId: f.listingId || null }, { fail: "Campaign writer did not complete" });
    setBusy(null);
    if (r) {
      setF({ ...f, subject: r.output.subject, body: r.output.body, name: f.name || r.output.subject });
      setSource("ai");
    }
  };
  const save = async () => {
    setBusy("save");
    const r = await post("/api/campaigns", { name: f.name, channel: f.channel, segment: f.segment, listingId: f.listingId || null, subject: f.subject || null, body: f.body, bodySource: source }, { ok: "Campaign saved as a draft", fail: "Campaign not saved" });
    setBusy(null);
    if (r) {
      setOpen(false);
      router.refresh();
    }
  };
  return (
    <Modal open={open} setOpen={setOpen} title="New campaign" description="Audiences include only leads who consented to marketing. Email campaigns are sent from the firm's outbox." trigger={<Button onClick={() => setOpen(true)}>New campaign</Button>}>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Channel">
          <Select value={f.channel} onChange={set("channel")}>
            <option value="email">Email</option>
            <option value="social">Social post</option>
            <option value="portal_boost">Portal boost</option>
            <option value="print">Print</option>
          </Select>
        </FormField>
        <FormField label="Audience">
          <Select value={f.segment} onChange={set("segment")}>
            {segments.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label} ({s.size})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Featured listing" className="sm:col-span-2">
          <Select value={f.listingId} onChange={set("listingId")}>
            <option value="">None</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Brief for the campaign writer" className="sm:col-span-2">
          <div className="flex gap-2">
            <Input value={f.brief} onChange={set("brief")} placeholder="Introduce the new listing to qualified buyers" />
            <Button variant="secondary" onClick={draft} disabled={busy !== null || f.brief.trim().length < 5}>
              {busy === "draft" ? "Drafting" : "Draft"}
            </Button>
          </div>
        </FormField>
        <FormField label="Campaign name">
          <Input value={f.name} onChange={set("name")} />
        </FormField>
        <FormField label="Subject">
          <Input value={f.subject} onChange={set("subject")} />
        </FormField>
        <FormField label="Body" className="sm:col-span-2">
          <Textarea rows={7} value={f.body} onChange={(e) => (setF({ ...f, body: e.target.value }), setSource("manual"))} />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={busy !== null || f.name.trim().length < 3}>
          {busy === "save" ? "Saving" : "Save draft"}
        </Button>
      </div>
    </Modal>
  );
}

export function SendCampaign({ id, audience }: { id: string; audience: number }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(`Send this campaign to ${audience} recipients with marketing consent? It cannot be recalled.`)) return;
        setBusy(true);
        const r = await post(`/api/campaigns/${id}/send`, {}, { fail: "Campaign not sent" });
        setBusy(false);
        if (r) {
          toast.success(`Sent to ${r.sent} recipients`, { description: r.skipped ? `${r.skipped} skipped without an email address.` : undefined });
          router.refresh();
        }
      }}
    >
      {busy ? "Sending" : "Send"}
    </Button>
  );
}

/* ----------------------------------------------------------------- Rentals */

export function CreateTenancy({ markets, landlords, listings }: { markets: MarketOpt[]; landlords: Opt[]; listings: (Opt & { market: string })[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = React.useState({ unit: "", market: markets[0]?.code ?? "AE", listingId: "", landlordClientId: landlords[0]?.id ?? "", landlordName: landlords[0]?.name ?? "", occupantName: "", occupantEmail: "", startDate: today, endDate: "", frequency: "annual", instalments: "4", registrationNumber: "" });
  const [rent, setRent] = React.useState<number | null>(null);
  const [deposit, setDeposit] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const cur = markets.find((m) => m.code === f.market)?.currency ?? "AED";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true);
    const r = await post("/api/rentals", { unit: f.unit, market: f.market, listingId: f.listingId || null, landlordClientId: f.landlordClientId || null, landlordName: f.landlordName, occupantName: f.occupantName, occupantEmail: f.occupantEmail || null, startDate: f.startDate, endDate: f.endDate, rent, frequency: f.frequency, instalments: Number(f.instalments), deposit: deposit ?? 0, registrationNumber: f.registrationNumber || null }, { fail: "Tenancy not created" });
    setBusy(false);
    if (r) {
      toast.success(`${r.reference} created with its rent schedule`);
      setOpen(false);
      router.refresh();
    }
  };
  return (
    <Modal open={open} setOpen={setOpen} title="New tenancy" description="The rent schedule is generated from the rent, frequency and number of instalments (cheques in the UAE)." trigger={<Button onClick={() => setOpen(true)}>New tenancy</Button>}>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Unit" className="sm:col-span-2">
          <Input value={f.unit} onChange={set("unit")} placeholder="Marina Gate 1, 2207" />
        </FormField>
        <FormField label="Market">
          <Select value={f.market} onChange={set("market")}>
            {markets.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Listing">
          <Select value={f.listingId} onChange={set("listingId")}>
            <option value="">None</option>
            {listings
              .filter((l) => l.market === f.market)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField label="Landlord">
          <Select
            value={f.landlordClientId}
            onChange={(e) => {
              const c = landlords.find((x) => x.id === e.target.value);
              setF({ ...f, landlordClientId: e.target.value, landlordName: c?.name ?? f.landlordName });
            }}
          >
            <option value="">Not a client</option>
            {landlords.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Landlord name">
          <Input value={f.landlordName} onChange={set("landlordName")} />
        </FormField>
        <FormField label="Occupant">
          <Input value={f.occupantName} onChange={set("occupantName")} />
        </FormField>
        <FormField label="Occupant email">
          <Input type="email" value={f.occupantEmail} onChange={set("occupantEmail")} />
        </FormField>
        <FormField label="Start">
          <Input type="date" value={f.startDate} onChange={set("startDate")} />
        </FormField>
        <FormField label="End">
          <Input type="date" value={f.endDate} onChange={set("endDate")} />
        </FormField>
        <FormField label="Rent">
          <MoneyInput value={rent} onChange={setRent} currency={cur} />
        </FormField>
        <FormField label="Per">
          <Select value={f.frequency} onChange={set("frequency")}>
            <option value="annual">Year</option>
            <option value="quarterly">Quarter</option>
            <option value="monthly">Month</option>
          </Select>
        </FormField>
        <FormField label="Instalments a year">
          <Select value={f.instalments} onChange={set("instalments")}>
            {[1, 2, 4, 6, 12].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Deposit">
          <MoneyInput value={deposit} onChange={setDeposit} currency={cur} />
        </FormField>
        <FormField label="Registration (Ejari, Tawtheeq, leave and licence)" className="sm:col-span-2">
          <Input value={f.registrationNumber} onChange={set("registrationNumber")} />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={submit} disabled={busy || f.unit.length < 3 || f.occupantName.length < 2 || f.landlordName.length < 2 || !rent || !f.endDate}>
          {busy ? "Creating" : "Create tenancy"}
        </Button>
      </div>
    </Modal>
  );
}

export function RentAction({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const act = async (status: "paid" | "late" | "returned") => {
    setBusy(true);
    const r = await post(`/api/rentals/payments/${id}`, { status }, { method: "PATCH", ok: status === "paid" ? "Rent recorded as received" : status === "returned" ? "Recorded as returned" : "Marked late", fail: "Not recorded" });
    setBusy(false);
    if (r) router.refresh();
  };
  return (
    <span className="inline-flex gap-1">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("paid")}>
        Received
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("returned")}>
        Returned
      </Button>
    </span>
  );
}

export function MaintenanceStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  return (
    <Select
      aria-label="Request status"
      value={status}
      onChange={async (e) => {
        const r = await post(`/api/rentals/maintenance/${id}`, { status: e.target.value }, { method: "PATCH", fail: "Not updated" });
        if (r) router.refresh();
      }}
      className="h-8 w-[140px]"
    >
      <option value="open">Open</option>
      <option value="scheduled">Scheduled</option>
      <option value="in_progress">In progress</option>
      <option value="resolved">Resolved</option>
    </Select>
  );
}

export function AddMaintenance({ tenancies }: { tenancies: Opt[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ tenancyId: tenancies[0]?.id ?? "", title: "", category: "Plumbing", priority: "normal", vendor: "" });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} setOpen={setOpen} title="Log maintenance request" description="Requests are visible to the landlord in their client portal." trigger={<Button variant="secondary" onClick={() => setOpen(true)}>Log request</Button>}>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Tenancy" className="sm:col-span-2">
          <Select value={f.tenancyId} onChange={set("tenancyId")}>
            {tenancies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="What needs doing" className="sm:col-span-2">
          <Input value={f.title} onChange={set("title")} />
        </FormField>
        <FormField label="Category">
          <Select value={f.category} onChange={set("category")}>
            {["Plumbing", "HVAC", "Electrical", "Appliances", "Pest control", "General"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Priority">
          <Select value={f.priority} onChange={set("priority")}>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </Select>
        </FormField>
        <FormField label="Vendor" className="sm:col-span-2">
          <Input value={f.vendor} onChange={set("vendor")} />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end">
        <Button
          disabled={busy || f.title.length < 3 || !f.tenancyId}
          onClick={async () => {
            setBusy(true);
            const r = await post(`/api/rentals/${f.tenancyId}/maintenance`, { title: f.title, category: f.category, priority: f.priority, vendor: f.vendor || null }, { ok: "Request logged", fail: "Request not logged" });
            setBusy(false);
            if (r) {
              setOpen(false);
              router.refresh();
            }
          }}
        >
          {busy ? "Logging" : "Log request"}
        </Button>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------- Team, referrals */

export function RecruitStage({ id, stage }: { id: string; stage: string }) {
  const router = useRouter();
  return (
    <Select
      aria-label="Candidate stage"
      value={stage}
      onChange={async (e) => {
        const r = await post(`/api/team/recruits/${id}`, { stage: e.target.value }, { method: "PATCH", fail: "Not updated" });
        if (r) router.refresh();
      }}
      className="h-8 w-[140px]"
    >
      {["sourced", "screening", "interview", "offer", "hired", "declined"].map((s) => (
        <option key={s} value={s}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </Select>
  );
}

export function AddRecruit({ offices }: { offices: Opt[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ name: "", email: "", role: "Broker", officeId: offices[0]?.id ?? "", source: "Referral from a current broker", experienceYears: "" });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} setOpen={setOpen} title="Add candidate" description="Candidates move through screening, interview and offer; hiring starts the onboarding checklist." trigger={<Button variant="secondary" onClick={() => setOpen(true)}>Add candidate</Button>}>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Name">
          <Input value={f.name} onChange={set("name")} />
        </FormField>
        <FormField label="Email">
          <Input type="email" value={f.email} onChange={set("email")} />
        </FormField>
        <FormField label="Role">
          <Select value={f.role} onChange={set("role")}>
            {["Broker", "Senior broker", "Leasing consultant", "Marketing executive", "Operations"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Office">
          <Select value={f.officeId} onChange={set("officeId")}>
            {offices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Source">
          <Input value={f.source} onChange={set("source")} />
        </FormField>
        <FormField label="Years of experience">
          <Input type="number" min={0} value={f.experienceYears} onChange={set("experienceYears")} className="num" />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end">
        <Button
          disabled={busy || f.name.length < 2}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/team/recruits", { name: f.name, email: f.email || null, role: f.role, officeId: f.officeId || null, source: f.source, experienceYears: f.experienceYears ? Number(f.experienceYears) : null }, { ok: "Candidate added", fail: "Candidate not added" });
            setBusy(false);
            if (r) {
              setOpen(false);
              router.refresh();
            }
          }}
        >
          {busy ? "Adding" : "Add candidate"}
        </Button>
      </div>
    </Modal>
  );
}

export function CreateReferral({ clients, markets }: { clients: Opt[]; markets: MarketOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ referrerClientId: clients[0]?.id ?? "", referredName: "", referredEmail: "", referredPhone: "", market: markets[0]?.code ?? "AE", intent: "buy", notes: "" });
  const [busy, setBusy] = React.useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal open={open} setOpen={setOpen} title="Record referral" description="The referred person becomes a lead from the referral source, assigned and scored." trigger={<Button onClick={() => setOpen(true)}>Record referral</Button>}>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Referred by" className="sm:col-span-2">
          <Select value={f.referrerClientId} onChange={set("referrerClientId")}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Name">
          <Input value={f.referredName} onChange={set("referredName")} />
        </FormField>
        <FormField label="Intent">
          <Select value={f.intent} onChange={set("intent")}>
            <option value="buy">Buy</option>
            <option value="invest">Invest</option>
            <option value="rent">Rent</option>
            <option value="sell">Sell</option>
            <option value="let">Let</option>
          </Select>
        </FormField>
        <FormField label="Email">
          <Input type="email" value={f.referredEmail} onChange={set("referredEmail")} />
        </FormField>
        <FormField label="Phone">
          <Input value={f.referredPhone} onChange={set("referredPhone")} />
        </FormField>
        <FormField label="Market">
          <Select value={f.market} onChange={set("market")}>
            {markets.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Notes">
          <Input value={f.notes} onChange={set("notes")} />
        </FormField>
      </div>
      <div className="mt-6 flex justify-end">
        <Button
          disabled={busy || f.referredName.length < 2 || (!f.referredEmail && !f.referredPhone)}
          onClick={async () => {
            setBusy(true);
            const c = clients.find((x) => x.id === f.referrerClientId);
            const r = await post("/api/referrals", { referrerClientId: f.referrerClientId || null, referrerName: c?.name ?? "Client", referredName: f.referredName, referredEmail: f.referredEmail || null, referredPhone: f.referredPhone || null, market: f.market, intent: f.intent, notes: f.notes || null }, { fail: "Referral not recorded" });
            setBusy(false);
            if (r) {
              toast.success("Referral recorded and opened as a lead");
              router.push(`/analyst/leads/${r.leadId}`);
            }
          }}
        >
          {busy ? "Recording" : "Record referral"}
        </Button>
      </div>
    </Modal>
  );
}
