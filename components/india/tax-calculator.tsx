"use client";

import * as React from "react";
import { AgentOutput } from "@/components/os/agent-output";
import { Severity } from "@/components/os/badges";
import { StructuredDetail } from "@/components/os/structured-detail";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toaster";
import { formatLocal } from "@/lib/format";

type Line = { label: string; payer: "buyer" | "seller"; ratePct?: number; base?: number; amount: number; reference: string; note?: string };
type Item = { item: string; authority: string; reference: string; severity: string; stage: string };
type Quote = {
  plugin: { name: string; ratesAsOf: string; sources: string[] };
  stampDuty: number;
  breakdown: { currency: string; lines: Line[]; buyerTotal: number; sellerTotal: number; buyerCostPct: number; notes: string[] };
  validation: { valid: boolean; errors: { code: string; message: string; reference?: string }[]; warnings: { code: string; message: string; reference?: string }[] };
  registration: Item[];
  checklist: Item[];
};

const J = [
  ["mumbai", "Mumbai"],
  ["maharashtra", "Maharashtra (other)"],
  ["goa", "Goa"],
  ["dubai", "Dubai"],
  ["abu_dhabi", "Abu Dhabi"],
] as const;

/** Transaction cost calculator over the rules engine, with the India tax advisor's explanation on request. */
export function TaxCalculator({ defaults, compact }: { defaults?: { jurisdiction?: string; value?: number }; compact?: boolean }) {
  const [j, setJ] = React.useState(defaults?.jurisdiction && J.some(([k]) => k === defaults.jurisdiction) ? defaults.jurisdiction : "mumbai");
  const india = j === "mumbai" || j === "maharashtra" || j === "goa";
  const currency = india ? "INR" : "AED";
  const [value, setValue] = React.useState<number | null>(defaults?.value ?? 50_000_000);
  const [gov, setGov] = React.useState<number | null>(null);
  const [type, setType] = React.useState("residential");
  const [uc, setUc] = React.useState(false);
  const [gender, setGender] = React.useState("male");
  const [residency, setResidency] = React.useState("nri");
  const [hasSeller, setHasSeller] = React.useState(false);
  const [sellerRes, setSellerRes] = React.useState("resident");
  const [holding, setHolding] = React.useState(36);
  const [purchase, setPurchase] = React.useState<number | null>(null);
  const [landUse, setLandUse] = React.useState("");
  const [crz, setCrz] = React.useState("");
  const [mundkar, setMundkar] = React.useState("");
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [advice, setAdvice] = React.useState<{ output: Record<string, unknown> & { headline: string; points: { label: string; detail: string }[]; confidence: number }; model: string; costUsd: number } | null>(null);
  const [busy, setBusy] = React.useState<"" | "quote" | "explain">("");

  const body = (explain: boolean) => ({
    jurisdiction: j,
    value: value ?? 0,
    governmentValue: gov ?? undefined,
    propertyType: type,
    underConstruction: uc,
    buyer: { gender, residency },
    seller: hasSeller ? { residency: sellerRes, holdingMonths: holding, purchasePrice: purchase ?? undefined } : undefined,
    landUse: j === "goa" && landUse ? landUse : undefined,
    crzZone: j === "goa" && crz ? crz : undefined,
    mundkarStatus: j === "goa" && mundkar ? mundkar : undefined,
    explain,
  });
  const run = async (explain: boolean) => {
    if (!value) return;
    setBusy(explain ? "explain" : "quote");
    const res = await fetch("/api/india/tax", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body(explain)) });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) return void toast.error("Quote not computed", { description: json.error });
    setQuote(json.quote);
    setAdvice(json.advice ? { output: json.advice, model: json.model, costUsd: json.costUsd } : null);
  };
  React.useEffect(() => {
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(false);
        }}
        className="h-fit space-y-4 rounded-md border border-ink-200 bg-surface p-5 shadow-card"
      >
        <FormField label="Jurisdiction">
          <Select value={j} onChange={(e) => setJ(e.target.value)}>
            {J.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Agreement value">
          <MoneyInput value={value} onChange={setValue} currency={currency} />
        </FormField>
        {india && (
          <FormField label={j === "goa" ? "Collector's minimum value" : "Ready Reckoner value"} hint="Duty is charged on the higher of the two.">
            <MoneyInput value={gov} onChange={setGov} currency="INR" />
          </FormField>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Property">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="land">Land</option>
            </Select>
          </FormField>
          <FormField label="Status">
            <Select value={uc ? "uc" : "ready"} onChange={(e) => setUc(e.target.value === "uc")}>
              <option value="ready">Completed</option>
              <option value="uc">Under construction</option>
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Buyer">
            <Select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="male">Man</option>
              <option value="female">Woman (sole)</option>
              <option value="joint_with_female">Joint</option>
              <option value="company">Company</option>
            </Select>
          </FormField>
          <FormField label="Residency">
            <Select value={residency} onChange={(e) => setResidency(e.target.value)}>
              <option value="resident_indian">Resident Indian</option>
              <option value="nri">NRI</option>
              <option value="oci">OCI</option>
              <option value="uae_resident">UAE resident</option>
              <option value="foreign_national">Foreign national</option>
              <option value="company">Company</option>
            </Select>
          </FormField>
        </div>
        {j === "goa" && (
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Land use">
              <Select value={landUse} onChange={(e) => setLandUse(e.target.value)}>
                <option value="">Settlement</option>
                <option value="orchard">Orchard</option>
                <option value="agricultural">Agricultural</option>
              </Select>
            </FormField>
            <FormField label="CRZ">
              <Select value={crz} onChange={(e) => setCrz(e.target.value)}>
                <option value="">None</option>
                <option value="CRZ-II">CRZ-II</option>
                <option value="CRZ-III">CRZ-III</option>
                <option value="CRZ-I">CRZ-I</option>
              </Select>
            </FormField>
            <FormField label="Mundkar">
              <Select value={mundkar} onChange={(e) => setMundkar(e.target.value)}>
                <option value="">None</option>
                <option value="claimed">Claimed</option>
                <option value="settled">Settled</option>
              </Select>
            </FormField>
          </div>
        )}
        {india && !compact && (
          <label className="flex items-center gap-2 text-small text-ink-900">
            <input type="checkbox" checked={hasSeller} onChange={(e) => setHasSeller(e.target.checked)} className="size-4 accent-[var(--navy-900)]" />
            Include the seller&apos;s taxes
          </label>
        )}
        {hasSeller && india && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Seller">
              <Select value={sellerRes} onChange={(e) => setSellerRes(e.target.value)}>
                <option value="resident">Resident</option>
                <option value="nri">NRI</option>
              </Select>
            </FormField>
            <FormField label="Held (months)">
              <Input type="number" min={0} value={holding} onChange={(e) => setHolding(Number(e.target.value))} className="num" />
            </FormField>
            <FormField label="Purchase price" className="col-span-2">
              <MoneyInput value={purchase} onChange={setPurchase} currency="INR" />
            </FormField>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={!!busy}>
            {busy === "quote" ? "Computing" : "Compute"}
          </Button>
          {india && (
            <Button type="button" variant="secondary" disabled={!!busy} onClick={() => void run(true)}>
              {busy === "explain" ? "Advising" : "Explain with the tax advisor"}
            </Button>
          )}
        </div>
      </form>

      <div className="min-w-0 space-y-6">
        {quote && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ["Stamp duty", formatLocal(quote.stampDuty, quote.breakdown.currency, { compact: false })],
                ["Buyer total", formatLocal(quote.breakdown.buyerTotal, quote.breakdown.currency, { compact: false })],
                ["Buyer cost", `${quote.breakdown.buyerCostPct.toFixed(2)}%`],
                ["Seller total", formatLocal(quote.breakdown.sellerTotal, quote.breakdown.currency, { compact: false })],
              ].map(([l, v]) => (
                <div key={l} className="rounded-md border border-ink-200 bg-surface p-4 shadow-card">
                  <div className="eyebrow">{l}</div>
                  <div className="num mt-2 text-[20px] text-navy-900">{v}</div>
                </div>
              ))}
            </div>
            {(quote.validation.errors.length > 0 || quote.validation.warnings.length > 0) && (
              <div className="space-y-2 rounded-md border border-ink-200 bg-surface p-4 shadow-card">
                {quote.validation.errors.map((e) => (
                  <p key={e.code} className="text-small text-danger">
                    {e.message} <span className="text-ink-500">({e.reference})</span>
                  </p>
                ))}
                {quote.validation.warnings.map((w) => (
                  <p key={w.code} className="text-small text-warning">
                    {w.message} <span className="text-ink-500">({w.reference})</span>
                  </p>
                ))}
              </div>
            )}
            <div className="overflow-x-auto rounded-md border border-ink-200 bg-surface shadow-card">
              <table className="w-full min-w-[620px] text-small">
                <thead className="bg-navy-50 text-left text-axis tracking-[0.06em] text-ink-500 uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Item</th>
                    <th className="px-4 py-2.5 font-medium">Payer</th>
                    <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.breakdown.lines.map((l, i) => (
                    <tr key={i} className="border-t border-ink-200 align-top">
                      <td className="px-4 py-3 text-ink-900">
                        {l.label}
                        {l.note && <div className="mt-1 text-ink-500">{l.note}</div>}
                      </td>
                      <td className="px-4 py-3 text-ink-700">{l.payer}</td>
                      <td className="num px-4 py-3 text-right text-ink-900">{formatLocal(l.amount, quote.breakdown.currency, { compact: false })}</td>
                      <td className="px-4 py-3 text-ink-700">{l.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {quote.breakdown.notes.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-small text-ink-700">
                {quote.breakdown.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            {advice && (
              <AgentOutput agent="India tax advisor" output={advice.output} model={advice.model} costUsd={advice.costUsd}>
                <StructuredDetail output={advice.output} />
              </AgentOutput>
            )}
            {!compact && (
              <div className="grid gap-6 xl:grid-cols-2">
                {[
                  ["Registration requirements", quote.registration],
                  ["Compliance checklist", quote.checklist],
                ].map(([title, items]) => (
                  <div key={title as string} className="rounded-md border border-ink-200 bg-surface p-5 shadow-card">
                    <div className="eyebrow mb-3">{title as string}</div>
                    <ul className="space-y-3">
                      {(items as Item[]).map((it, i) => (
                        <li key={i} className="flex gap-3 text-small">
                          <Severity level={it.severity} />
                          <span className="text-ink-900">
                            {it.item}
                            <span className="block text-ink-500">
                              {it.authority} · {it.reference}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <p className="text-axis text-ink-500">
              {quote.plugin.name}: rates as of {quote.plugin.ratesAsOf}. Sources: {quote.plugin.sources.join("; ")}. Confirm current rates with the Sub-Registrar and a chartered accountant before execution.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
