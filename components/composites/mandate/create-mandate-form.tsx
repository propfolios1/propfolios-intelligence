"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { formatLocal } from "@/lib/domain";

interface ClientOpt {
  id: string;
  name: string;
  riskProfile: string;
  residency: string;
  markets: string[];
  horizonYears: number;
}
interface PropertyOpt {
  id: string;
  name: string;
  community: string;
  city: string;
  market: string;
  status: string;
  currency: string;
  priceMin: number;
  priceMax: number;
  grossYield: number;
  developerName: string;
}

type Errors = Partial<Record<string, string>>;

/**
 * Create mandate. On submit the mandate is created, the agent pipeline is
 * started and the analyst lands on the live timeline.
 */
export function CreateMandateForm({ clients, properties, defaultClientId, defaultPropertyId }: { clients: ClientOpt[]; properties: PropertyOpt[]; defaultClientId?: string; defaultPropertyId?: string }) {
  const router = useRouter();
  const [clientId, setClientId] = React.useState(defaultClientId ?? clients[0]?.id ?? "");
  const client = clients.find((c) => c.id === clientId);
  const eligible = properties.filter((p) => !client || client.markets.includes(p.market));
  const [propertyId, setPropertyId] = React.useState(defaultPropertyId ?? eligible[0]?.id ?? "");
  const property = properties.find((p) => p.id === propertyId);
  const [title, setTitle] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [ticket, setTicket] = React.useState("5000000");
  const [horizon, setHorizon] = React.useState(String(client?.horizonYears ?? 5));
  const [priority, setPriority] = React.useState("standard");
  const [deadline, setDeadline] = React.useState("");
  const [errors, setErrors] = React.useState<Errors>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (property && !eligible.some((p) => p.id === property.id)) setPropertyId(eligible[0]?.id ?? "");
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedTitle = property ? `${property.name} ${property.status === "ready" ? "Allocation" : "Off-plan Allocation"}` : "";

  function validate() {
    const e: Errors = {};
    if (!clientId) e.clientId = "Choose a client.";
    if (!propertyId) e.propertyId = "Choose a property.";
    if ((title || suggestedTitle).trim().length < 3) e.title = "Give the mandate a title.";
    if (objective.trim().length < 3) e.objective = "State the objective in a phrase.";
    if (brief.trim().length < 20) e.brief = "The brief needs at least 20 characters for the research agent.";
    const t = Number(ticket.replace(/,/g, ""));
    if (!Number.isFinite(t) || t <= 0) e.ticket = "Enter a ticket size in AED.";
    const h = Number(horizon);
    if (!Number.isInteger(h) || h < 1 || h > 15) e.horizon = "Horizon is 1 to 15 years.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/mandates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          propertyId,
          title: (title || suggestedTitle).trim(),
          objective: objective.trim(),
          brief: brief.trim(),
          ticketSizeAed: Number(ticket.replace(/,/g, "")),
          horizonYears: Number(horizon),
          priority,
          ...(deadline && { deadline }),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "The mandate could not be created.");
      await fetch(`/api/mandates/${json.id}/run`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      toast.success(`${json.reference} created`, { description: "Agents are researching the mandate." });
      router.push(`/analyst/mandates/${json.id}`);
    } catch (err) {
      toast.error("Mandate not created", { description: (err as Error).message });
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" noValidate>
      <Card className="p-6 md:p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField label="Client" htmlFor="client" error={errors.clientId} hint={client ? `${client.riskProfile} profile · ${client.residency}` : undefined}>
            <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Property" htmlFor="property" error={errors.propertyId} hint={property ? `${property.developerName} · ${property.community}` : undefined}>
            <Select id="property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              {(["UAE", "India"] as const).map((m) => {
                const list = eligible.filter((p) => p.market === m);
                return list.length ? (
                  <optgroup key={m} label={m}>
                    {list.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}, {p.city}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </Select>
          </FormField>
          <FormField label="Title" htmlFor="title" error={errors.title} className="md:col-span-2">
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggestedTitle || "Downtown Dubai Allocation"} />
          </FormField>
          <FormField label="Objective" htmlFor="objective" error={errors.objective} className="md:col-span-2" hint="One phrase, for example: prime income asset with resale liquidity.">
            <Input id="objective" value={objective} onChange={(e) => setObjective(e.target.value)} />
          </FormField>
          <FormField label="Brief" htmlFor="brief" error={errors.brief} className="md:col-span-2" hint="What the client wants, constraints, and anything the agents must consider.">
            <Textarea id="brief" rows={5} value={brief} onChange={(e) => setBrief(e.target.value)} />
          </FormField>
          <FormField label="Ticket size (AED)" htmlFor="ticket" error={errors.ticket}>
            <Input id="ticket" inputMode="numeric" className="num" value={ticket} onChange={(e) => setTicket(e.target.value)} />
          </FormField>
          <FormField label="Horizon (years)" htmlFor="horizon" error={errors.horizon}>
            <Input id="horizon" inputMode="numeric" className="num" value={horizon} onChange={(e) => setHorizon(e.target.value)} />
          </FormField>
          <FormField label="Priority" htmlFor="priority">
            <Select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="standard">Standard</option>
              <option value="priority">Priority</option>
            </Select>
          </FormField>
          <FormField label="Committee deadline" htmlFor="deadline" hint="Optional">
            <Input id="deadline" type="date" className="num" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </FormField>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-hairline pt-6">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Creating mandate" : "Create mandate and run agents"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </Card>
      <aside className="flex flex-col gap-4">
        {property && (
          <Card className="p-5">
            <div className="eyebrow">Selected property</div>
            <p className="mt-2 font-display text-read text-navy-900">{property.name}</p>
            <p className="text-small text-ink-500">
              {property.community}, {property.city}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline pt-4 text-small">
              <dt className="text-ink-500">Price range</dt>
              <dd className="num text-right text-ink-900">
                {formatLocal(property.priceMin, property.currency)} to {formatLocal(property.priceMax, property.currency)}
              </dd>
              <dt className="text-ink-500">Gross yield</dt>
              <dd className="num text-right text-ink-900">{property.grossYield.toFixed(1)}%</dd>
            </dl>
          </Card>
        )}
        <Card className="p-5">
          <div className="eyebrow">What happens next</div>
          <ol className="mt-3 flex flex-col gap-2 text-small text-ink-700">
            <li>1. Intake checks the brief against the client policy.</li>
            <li>2. Research, underwriting and due diligence agents run in sequence.</li>
            <li>3. Bull and bear agents debate; a judge recommends.</li>
            <li>4. The memo agent drafts the Allocation Memo for committee review.</li>
          </ol>
        </Card>
      </aside>
    </form>
  );
}
