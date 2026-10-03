"use client";

import * as React from "react";
import { AgentOutput } from "@/components/os/agent-output";
import { Button } from "@/components/ui/button";
import { FormField, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";

type Step = { step: string; owner: string; documents: string[]; dayOffset: number; reference: string };
type Out = { headline: string; points: { label: string; detail: string }[]; confidence: number; steps: Step[]; repatriation: { eligible: boolean; annualLimitUsd: number; forms: string[]; note: string }; poaRequired: boolean };

/** NRI purchase or sale planner: runs the NRI workflow agent and lays the plan out as a dated sequence. */
export function NriPlanner({ properties, clientId, initial }: { properties: { id: string; name: string; place: string }[]; clientId?: string; initial?: { output: Out; model: string; costUsd: number; at: string } | null }) {
  const [propertyId, setPropertyId] = React.useState(properties[0]?.id ?? "");
  const [side, setSide] = React.useState<"buy" | "sell">("buy");
  const [canTravel, setCanTravel] = React.useState(false);
  const [fundedFrom, setFundedFrom] = React.useState("nre");
  const [busy, setBusy] = React.useState(false);
  const [run, setRun] = React.useState(initial ?? null);
  const go = async () => {
    setBusy(true);
    const res = await fetch("/api/india/agents/nri-workflow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ propertyId, side, canTravel, fundedFrom, clientId }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Plan not prepared", { description: json.error });
    setRun({ output: json.output, model: json.model, costUsd: json.costUsd, at: new Date().toISOString() });
  };
  const o = run?.output;
  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <div className="h-fit space-y-4 rounded-md border border-ink-200 bg-surface p-5 shadow-card">
        <FormField label="Property">
          <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.place})
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Transaction">
          <Select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")}>
            <option value="buy">Purchase</option>
            <option value="sell">Sale</option>
          </Select>
        </FormField>
        <FormField label="Funds from">
          <Select value={fundedFrom} onChange={(e) => setFundedFrom(e.target.value)}>
            <option value="nre">NRE account</option>
            <option value="nro">NRO account</option>
            <option value="fcnr">FCNR(B) deposit</option>
            <option value="inward_remittance">Inward remittance from the UAE</option>
          </Select>
        </FormField>
        <label className="flex items-center gap-2 text-small text-ink-900">
          <input type="checkbox" checked={canTravel} onChange={(e) => setCanTravel(e.target.checked)} className="size-4 accent-[var(--navy-900)]" />I can travel to India for registration
        </label>
        <Button onClick={go} disabled={busy || !propertyId} className="w-full">
          {busy ? "Preparing" : "Prepare the plan"}
        </Button>
      </div>
      <div className="min-w-0">
        {!o && !busy && <p className="text-small text-ink-500">Choose a property and the plan sets out each step with its owner, documents and day.</p>}
        {o && run && (
          <AgentOutput agent="NRI workflow" output={o} model={run.model} costUsd={run.costUsd} at={run.at}>
            <ol className="relative space-y-5 border-l border-ink-200 pl-6">
              {o.steps.map((s, i) => (
                <li key={i}>
                  <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border border-navy-900 bg-surface" />
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="num text-axis text-ink-500">Day {s.dayOffset}</span>
                    <span className="text-small font-medium text-ink-900">{s.step}</span>
                  </div>
                  <div className="mt-1 text-small text-ink-700">
                    {s.owner}
                    {s.documents.length > 0 && ` · ${s.documents.join(", ")}`}
                  </div>
                  <div className="text-axis text-ink-500">{s.reference}</div>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-sm bg-navy-50 p-4 text-small text-ink-700">
              <span className="font-medium text-ink-900">Repatriation.</span> {o.repatriation.note} Forms: {o.repatriation.forms.join(", ")}. {o.poaRequired ? "A specific power of attorney is required." : "No power of attorney is needed."}
            </div>
          </AgentOutput>
        )}
      </div>
    </div>
  );
}
