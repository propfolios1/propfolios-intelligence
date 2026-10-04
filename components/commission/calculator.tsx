"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import { type CalcConfigInput, type CalcResult, calculate, formatMinor, PRESETS, toMinor } from "@/lib/commission/calculator";
import { cn } from "@/lib/utils";

type Fee = CalcConfigInput["fees"][number];
type Deduction = NonNullable<CalcConfigInput["deductions"]>[number];
type Member = NonNullable<CalcConfigInput["team"]>[number];
export type ScenarioView = { id: string; name: string; price: string; selected: boolean; gross: string; config: CalcConfigInput; structureId: string | null };

const PAYERS = ["seller", "buyer", "developer", "landlord", "tenant"] as const;
const METHODS: [Fee["method"], string][] = [
  ["percentage", "Percentage of price"],
  ["fixed", "Fixed fee"],
  ["tiered_marginal", "Tiered, marginal"],
  ["tiered_bracket", "Tiered, whole price"],
];
const KINDS: [Deduction["kind"], string][] = [
  ["referral", "Referral"],
  ["co_broke", "Co-broke"],
  ["royalty", "Franchise royalty"],
  ["marketing", "Marketing"],
  ["other", "Other"],
];

const num = (v: string, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};

function Row({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div className="relative grid gap-3 rounded-md border border-hairline bg-surface p-3 sm:grid-cols-6">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="absolute end-2 top-2 rounded-sm p-1 text-ink-400 transition-colors duration-150 hover:text-ink-900">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function Num({ label, value, onChange, step, suffix, className }: { label: string; value: number | undefined | null; onChange: (n: number) => void; step?: number; suffix?: string; className?: string }) {
  return (
    <FormField label={suffix ? `${label}, ${suffix}` : label} className={className}>
      <Input type="number" inputMode="decimal" min={0} step={step ?? "any"} className="num" value={value ?? ""} onChange={(e) => onChange(num(e.target.value))} />
    </FormField>
  );
}

/** Editor and live result. Every keystroke recomputes in the browser with the same fixed-point engine the server uses. */
export function CommissionCalculator(props: {
  mode: "deal" | "structure";
  currency: string;
  initialPrice: string;
  initialConfig: CalcConfigInput;
  dealId?: string;
  structureId?: string | null;
  structureName?: string;
  structures?: { id: string; name: string; config: CalcConfigInput }[];
  people: { id: string; name: string }[];
  scenarios?: ScenarioView[];
}) {
  const router = useRouter();
  const [price, setPrice] = React.useState(props.initialPrice);
  const [c, setC] = React.useState<CalcConfigInput>(props.initialConfig);
  const [structureId, setStructureId] = React.useState<string | null>(props.structureId ?? null);
  const [name, setName] = React.useState(props.mode === "structure" ? (props.structureName ?? "") : "");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const cur = props.currency;
  const fmt = (m: string | bigint) => formatMinor(m, cur);

  const out = React.useMemo((): { r: CalcResult | null; error: string | null } => {
    try {
      if (!/^\d{1,13}(\.\d{1,2})?$/.test(price.replace(/,/g, ""))) return { r: null, error: "Enter the price as a number with at most two decimals." };
      return { r: calculate(price.replace(/,/g, ""), { ...c, currency: cur }), error: null };
    } catch (e) {
      const msg = (e as { issues?: { path: (string | number)[]; message: string }[] }).issues?.[0];
      return { r: null, error: msg ? `${msg.path.join(" ")}: ${msg.message}` : (e as Error).message };
    }
  }, [price, c, cur]);
  const r = out.r;

  const setFee = (i: number, f: Partial<Fee>) => setC({ ...c, fees: c.fees.map((x, k) => (k === i ? { ...x, ...f } : x)) });
  const deductions = c.deductions ?? [];
  const team = c.team ?? [];
  const installments = c.installments ?? [];
  const teamTotal = team.reduce((a, m) => a + m.pct, 0);
  const instTotal = installments.reduce((a, m) => a + m.pct, 0);

  const save = async (select: boolean) => {
    if (!props.dealId) return;
    setBusy(true);
    const res = await post(`/api/deals/${props.dealId}/calculator`, { action: "save", id: editing ?? undefined, name: name || "Scenario", price: price.replace(/,/g, ""), config: { ...c, currency: cur }, structureId, select }, { fail: "Scenario not saved" });
    setBusy(false);
    if (res) {
      toast.success(select ? "Saved and selected for closing" : "Scenario saved", { description: select ? "The commission is computed from this scenario when the deal closes." : undefined });
      setEditing(res.scenario.id);
      router.refresh();
    }
  };
  const saveStructure = async () => {
    if (!props.structureId) return;
    setBusy(true);
    const res = await post(`/api/commissions/structures/${props.structureId}/calculator`, { name: name || undefined, config: { ...c, currency: cur } }, { method: "PUT", fail: "Structure not saved", ok: "Structure saved" });
    setBusy(false);
    if (res) router.refresh();
  };

  const total = r ? BigInt(r.gross) : 0n;
  const share = (x: string) => (total > 0n ? Number((BigInt(x) * 10_000n) / total) / 100 : 0);
  const bar = r
    ? [
        ...r.deductions.map((d) => ({ label: d.label, amount: d.amount, tone: "bg-ink-400" })),
        { label: "Firm", amount: r.firm, tone: "bg-navy-900" },
        ...r.team.map((t, i) => ({ label: t.label, amount: t.amount, tone: ["bg-gold-500", "bg-navy-700", "bg-gold-600", "bg-navy-300"][i % 4]! })),
      ]
    : [];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="grid content-start gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label={props.mode === "structure" ? `Sample price, ${cur}` : `Price, ${cur}`}>
            <Input inputMode="decimal" className="num text-[18px]" value={price} onChange={(e) => setPrice(e.target.value)} />
          </FormField>
          {props.mode === "deal" ? (
            <FormField label="Start from">
              <Select
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  const st = props.structures?.find((x) => x.id === v);
                  const pr = PRESETS.find((p) => `preset:${p.key}` === v);
                  const sc = props.scenarios?.find((x) => `scenario:${x.id}` === v);
                  if (st) {
                    setC(st.config);
                    setStructureId(st.id);
                  } else if (pr) {
                    setC(pr.config(cur));
                    setStructureId(null);
                  } else if (sc) {
                    setC(sc.config);
                    setPrice(sc.price);
                    setName(sc.name);
                    setEditing(sc.id);
                    setStructureId(sc.structureId);
                  }
                }}
              >
                <option value="">Choose a structure, preset or scenario</option>
                {props.structures?.length ? (
                  <optgroup label="Firm structures">
                    {props.structures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {props.scenarios?.length ? (
                  <optgroup label="Saved scenarios">
                    {props.scenarios.map((s) => (
                      <option key={s.id} value={`scenario:${s.id}`}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label="Presets">
                  {PRESETS.map((p) => (
                    <option key={p.key} value={`preset:${p.key}`}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </FormField>
          ) : (
            <FormField label="Structure name" className="sm:col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
          )}
        </div>

        <fieldset className="grid gap-3">
          <legend className="label-caps mb-2">Fees{c.fees.length > 1 ? ", dual agency" : ""}</legend>
          {c.fees.map((f, i) => (
            <Row key={i} onRemove={c.fees.length > 1 ? () => setC({ ...c, fees: c.fees.filter((_, k) => k !== i) }) : undefined}>
              <FormField label="Label" className="sm:col-span-2">
                <Input value={f.label} onChange={(e) => setFee(i, { label: e.target.value })} />
              </FormField>
              <FormField label="Paid by" className="sm:col-span-2">
                <Select value={f.payer} onChange={(e) => setFee(i, { payer: e.target.value as Fee["payer"] })}>
                  {PAYERS.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Method" className="sm:col-span-2">
                <Select value={f.method} onChange={(e) => setFee(i, { method: e.target.value as Fee["method"], tiers: e.target.value.startsWith("tiered") ? (f.tiers?.length ? f.tiers : [{ upTo: 1_000_000, ratePct: 3 }, { upTo: null, ratePct: 2 }]) : f.tiers })}>
                  {METHODS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </FormField>
              {f.method === "percentage" && <Num label="Rate" suffix="%" step={0.05} value={f.ratePct} onChange={(n) => setFee(i, { ratePct: n })} className="sm:col-span-2" />}
              {f.method === "fixed" && <Num label="Fee" suffix={cur} value={f.fixedAmount} onChange={(n) => setFee(i, { fixedAmount: n })} className="sm:col-span-2" />}
              {f.method.startsWith("tiered") && (
                <div className="grid gap-2 sm:col-span-6">
                  {(f.tiers ?? []).map((t, k) => (
                    <div key={k} className="grid grid-cols-[minmax(0,1fr)_120px_28px] items-end gap-2">
                      <FormField label={k === 0 ? `Up to, ${cur} (blank for above)` : "Up to"}>
                        <Input type="number" min={0} className="num" value={t.upTo ?? ""} placeholder="And above" onChange={(e) => setFee(i, { tiers: f.tiers!.map((x, j) => (j === k ? { ...x, upTo: e.target.value === "" ? null : num(e.target.value) } : x)) })} />
                      </FormField>
                      <FormField label={k === 0 ? "Rate, %" : "Rate"}>
                        <Input type="number" min={0} step={0.05} className="num" value={t.ratePct} onChange={(e) => setFee(i, { tiers: f.tiers!.map((x, j) => (j === k ? { ...x, ratePct: num(e.target.value) } : x)) })} />
                      </FormField>
                      <button type="button" aria-label="Remove tier" className="mb-2 text-ink-400 hover:text-ink-900" onClick={() => setFee(i, { tiers: f.tiers!.filter((_, j) => j !== k) })}>
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <div>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setFee(i, { tiers: [...(f.tiers ?? []), { upTo: null, ratePct: 1 }] })}>
                      <Plus className="size-3.5" /> Tier
                    </Button>
                  </div>
                </div>
              )}
              <Num label="Minimum" suffix={cur} value={f.minimum} onChange={(n) => setFee(i, { minimum: n || undefined })} className="sm:col-span-2" />
              {f.payer === "developer" && <Num label="Bonus" suffix="%" step={0.25} value={f.bonusPct} onChange={(n) => setFee(i, { bonusPct: n || undefined })} className="sm:col-span-2" />}
            </Row>
          ))}
          {c.fees.length < 4 && (
            <div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setC({ ...c, fees: [...c.fees, { label: c.fees.some((f) => f.payer === "buyer") ? "Additional fee" : "Buyer's fee", payer: c.fees.some((f) => f.payer === "buyer") ? "seller" : "buyer", method: "percentage", ratePct: 1 }] })}>
                <Plus className="size-3.5" /> Fee from another party
              </Button>
            </div>
          )}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="label-caps mb-2">Off the top</legend>
          {deductions.map((d, i) => (
            <Row key={i} onRemove={() => setC({ ...c, deductions: deductions.filter((_, k) => k !== i) })}>
              <FormField label="Type" className="sm:col-span-2">
                <Select value={d.kind} onChange={(e) => setC({ ...c, deductions: deductions.map((x, k) => (k === i ? { ...x, kind: e.target.value as Deduction["kind"], label: KINDS.find(([kk]) => kk === e.target.value)![1] + (e.target.value === "co_broke" ? " share" : " fee") } : x)) })}>
                  {KINDS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Paid to" className="sm:col-span-2">
                <Input value={d.party ?? ""} placeholder="Firm or person" onChange={(e) => setC({ ...c, deductions: deductions.map((x, k) => (k === i ? { ...x, party: e.target.value } : x)) })} />
              </FormField>
              <FormField label="Basis">
                <Select value={d.basis} onChange={(e) => setC({ ...c, deductions: deductions.map((x, k) => (k === i ? { ...x, basis: e.target.value as Deduction["basis"] } : x)) })}>
                  <option value="percent_of_gross">% of gross</option>
                  <option value="fixed">Fixed</option>
                </Select>
              </FormField>
              <Num label={d.basis === "fixed" ? cur : "%"} value={d.value} onChange={(n) => setC({ ...c, deductions: deductions.map((x, k) => (k === i ? { ...x, value: n } : x)) })} />
            </Row>
          ))}
          {deductions.length < 6 && (
            <div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setC({ ...c, deductions: [...deductions, { label: "Referral fee", kind: "referral", basis: "percent_of_gross", value: 25 }] })}>
                <Plus className="size-3.5" /> Referral, co-broke or royalty
              </Button>
            </div>
          )}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="label-caps mb-2">Firm and agents</legend>
          <div className="grid gap-4 rounded-md border border-hairline bg-surface p-4 sm:grid-cols-3">
            <FormField label={`Agents' share, ${c.agentSplitPct}%`} className="sm:col-span-3">
              <input type="range" min={0} max={100} step={1} value={c.agentSplitPct} onChange={(e) => setC({ ...c, agentSplitPct: Number(e.target.value) })} className="w-full accent-[var(--navy-900)]" aria-label="Agents' share" />
            </FormField>
            <Num label="Cap remaining" suffix={cur} value={c.capRemaining ?? null} onChange={(n) => setC({ ...c, capRemaining: n })} />
            <Num label="Transaction fee" suffix={cur} value={c.transactionFee} onChange={(n) => setC({ ...c, transactionFee: n })} />
            <div className="flex items-end">
              {c.capRemaining !== null && c.capRemaining !== undefined && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setC({ ...c, capRemaining: null })}>
                  No cap
                </Button>
              )}
            </div>
          </div>
          {team.map((m, i) => (
            <Row key={i} onRemove={() => setC({ ...c, team: team.filter((_, k) => k !== i) })}>
              <FormField label="Role" className="sm:col-span-2">
                <Input value={m.label} onChange={(e) => setC({ ...c, team: team.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              </FormField>
              <FormField label="Person" className="sm:col-span-2">
                <Select value={m.userId ?? ""} onChange={(e) => setC({ ...c, team: team.map((x, k) => (k === i ? { ...x, userId: e.target.value || null } : x)) })}>
                  <option value="">Unassigned</option>
                  {props.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <Num label="Share of agents" suffix="%" value={m.pct} onChange={(n) => setC({ ...c, team: team.map((x, k) => (k === i ? { ...x, pct: n } : x)) })} className="sm:col-span-2" />
            </Row>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            {team.length < 8 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setC({ ...c, team: [...team, { label: team.length ? "Co-agent" : "Listing agent", pct: team.length ? 0 : 100, userId: null } as Member] })}>
                <Plus className="size-3.5" /> Team member
              </Button>
            )}
            {team.length > 0 && Math.abs(teamTotal - 100) > 0.0001 && <span className="text-[12px] text-warning">Team shares add to {teamTotal}%; they are applied in proportion.</span>}
          </div>
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="label-caps mb-2">Tax and milestones</legend>
          <div className="grid gap-4 rounded-md border border-hairline bg-surface p-4 sm:grid-cols-4">
            <FormField label="Tax">
              <Input value={c.tax.name} onChange={(e) => setC({ ...c, tax: { ...c.tax, name: e.target.value } })} />
            </FormField>
            <Num label="Rate" suffix="%" value={c.tax.ratePct} onChange={(n) => setC({ ...c, tax: { ...c.tax, ratePct: n } })} />
            <FormField label="Withholding">
              <Input value={c.tax.withholdingName ?? ""} placeholder="None" onChange={(e) => setC({ ...c, tax: { ...c.tax, withholdingName: e.target.value || undefined } })} />
            </FormField>
            <Num label="Withholding" suffix="%" value={c.tax.withholdingPct} onChange={(n) => setC({ ...c, tax: { ...c.tax, withholdingPct: n || undefined } })} />
          </div>
          {installments.map((m, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_120px_28px] items-end gap-2">
              <FormField label={i === 0 ? "Milestone" : ""}>
                <Input value={m.label} onChange={(e) => setC({ ...c, installments: installments.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              </FormField>
              <FormField label={i === 0 ? "Share, %" : ""}>
                <Input type="number" min={0} className="num" value={m.pct} onChange={(e) => setC({ ...c, installments: installments.map((x, k) => (k === i ? { ...x, pct: num(e.target.value) } : x)) })} />
              </FormField>
              <button type="button" aria-label="Remove milestone" className="mb-2 text-ink-400 hover:text-ink-900" onClick={() => setC({ ...c, installments: installments.filter((_, k) => k !== i) })}>
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            {installments.length < 8 && (
              <Button type="button" size="sm" variant="ghost" onClick={() => setC({ ...c, installments: [...installments, { label: installments.length ? "Next milestone" : "On signing", pct: installments.length ? 0 : 100 }] })}>
                <Plus className="size-3.5" /> Payment milestone
              </Button>
            )}
            {installments.length > 0 && Math.abs(instTotal - 100) > 0.0001 && <span className="text-[12px] text-warning">Milestones add to {instTotal}%; they are applied in proportion.</span>}
          </div>
        </fieldset>
      </div>

      <aside className="xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-md border border-hairline bg-surface">
          {r ? (
            <>
              <div className="border-b border-hairline p-5">
                <div className="label-caps">Gross commission</div>
                <div className="num mt-1 text-[32px] leading-none text-navy-900" aria-live="polite">
                  {fmt(r.gross)}
                </div>
                <div className="num mt-2 text-[12px] text-ink-500">
                  {r.effectivePct.toFixed(4)}% of {fmt(r.price)}
                  {r.capApplied ? " · cap reached" : ""}
                </div>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-ink-100" role="img" aria-label="Distribution">
                  {bar.map((b, i) => (
                    <div key={i} className={cn("h-2 transition-[width] duration-250", b.tone)} style={{ width: `${share(b.amount)}%` }} title={`${b.label} ${fmt(b.amount)}`} />
                  ))}
                </div>
              </div>
              <table className="w-full text-ui">
                <tbody className="divide-y divide-hairline-row">
                  {r.distribution.map((l, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2.5">
                        <span className={cn(l.kind === "firm" ? "text-navy-900" : "text-ink-900")}>{l.label}</span>
                        {l.kind === "deduction" && l.party !== l.label && <span className="block text-[12px] text-ink-500">{l.party}</span>}
                        {l.kind === "agent" && l.userId && <span className="block text-[12px] text-ink-500">{props.people.find((p) => p.id === l.userId)?.name}</span>}
                      </td>
                      <td className="num px-2 py-2.5 text-end text-[12px] text-ink-500">{share(l.amount).toFixed(2)}%</td>
                      <td className="num px-5 py-2.5 text-end text-ink-900">{fmt(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-hairline p-5">
                <div className="label-caps mb-2">{r.fees.length > 1 ? "Invoices" : "Invoice"}</div>
                {r.fees.map((f, i) => (
                  <dl key={i} className="num grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-[13px] [&:not(:first-of-type)]:mt-3">
                    <dt className="font-sans text-ink-700">
                      {f.label} <span className="text-ink-500">({f.payer})</span>
                    </dt>
                    <dd className="text-end">{fmt(f.total)}</dd>
                    {r.tax.name && BigInt(f.tax) > 0n && (
                      <>
                        <dt className="font-sans text-ink-500">{r.tax.name}</dt>
                        <dd className="text-end text-ink-700">{fmt(f.tax)}</dd>
                      </>
                    )}
                    <dt className="font-sans text-ink-900">Invoice total</dt>
                    <dd className="text-end text-ink-900">{fmt(f.invoiceTotal)}</dd>
                    {BigInt(f.withholding) > 0n && (
                      <>
                        <dt className="font-sans text-ink-500">Less {r.tax.withholdingName ?? "withholding"}</dt>
                        <dd className="text-end text-ink-700">−{fmt(f.withholding)}</dd>
                        <dt className="font-sans text-ink-900">Receivable</dt>
                        <dd className="text-end text-ink-900">{fmt(f.receivable)}</dd>
                      </>
                    )}
                  </dl>
                ))}
              </div>
              {r.installments.length > 0 && (
                <div className="border-t border-hairline p-5">
                  <div className="label-caps mb-2">Milestones</div>
                  <dl className="num grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-[13px]">
                    {r.installments.map((m, i) => (
                      <React.Fragment key={i}>
                        <dt className="font-sans text-ink-700">{m.label}</dt>
                        <dd className="text-end">{fmt(m.amount)}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                </div>
              )}
              <details className="border-t border-hairline p-5 text-[13px] text-ink-700">
                <summary className="cursor-pointer text-ink-900">How this was calculated</summary>
                <ol className="mt-3 list-decimal space-y-1 ps-5">
                  {r.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </details>
              <div className="flex items-center justify-between border-t border-hairline px-5 py-3 text-[12px] text-ink-500">
                <StatusPill tone={r.balanced ? "complete" : "error"}>{r.balanced ? "Balanced to the cent" : "Does not balance"}</StatusPill>
                <span className="num">{r.engine}</span>
              </div>
            </>
          ) : (
            <p className="p-5 text-ui text-danger">{out.error}</p>
          )}
        </div>
        {props.mode === "deal" ? (
          <div className="mt-4 grid gap-3 rounded-md border border-hairline bg-surface p-4">
            <FormField label={editing ? "Scenario name (editing)" : "Scenario name"}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, with 25% referral" />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !r} onClick={() => save(true)}>
                Save and use for closing
              </Button>
              <Button variant="secondary" disabled={busy || !r} onClick={() => save(false)}>
                Save scenario
              </Button>
              {editing && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(null);
                    setName("");
                  }}
                >
                  New scenario
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <Button disabled={busy || !r} onClick={saveStructure}>
              {busy ? "Saving" : "Save structure"}
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}

export function ScenarioList({ dealId, currency, scenarios }: { dealId: string; currency: string; scenarios: ScenarioView[] }) {
  const router = useRouter();
  if (!scenarios.length) return <p className="text-ui text-ink-500">No saved scenarios. Model the deal above and save it; the selected scenario sets the commission when the deal closes.</p>;
  const act = async (body: Record<string, unknown>) => {
    const r = await post(`/api/deals/${dealId}/calculator`, body, { fail: "Not updated" });
    if (r) router.refresh();
  };
  return (
    <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
      {scenarios.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-ui text-ink-900">
              {s.name} {s.selected && <StatusPill tone="complete">Used for closing</StatusPill>}
            </div>
            <div className="num text-[12px] text-ink-500">
              {formatMinor(s.gross, currency)} on {formatMinor(toMinor(s.price), currency)}
            </div>
          </div>
          <div className="flex gap-2">
            {!s.selected && (
              <Button size="sm" variant="secondary" onClick={() => act({ action: "select", scenarioId: s.id })}>
                Use for closing
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => act({ action: "delete", scenarioId: s.id })}>
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PresetGallery({ currency }: { currency: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {PRESETS.map((p) => (
        <li key={p.key} className="flex flex-col rounded-md border border-hairline bg-surface p-4">
          <div className="text-ui font-medium text-ink-900">{p.name}</div>
          <p className="mt-1 flex-1 text-[13px] text-ink-700">{p.description}</p>
          <div className="mt-3">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              onClick={async () => {
                setBusy(p.key);
                const r = await post("/api/commissions/structures/presets", { preset: p.key, currency }, { fail: "Not created" });
                setBusy(null);
                if (r) router.push(`/admin/commission-structures/${r.structure.id}`);
              }}
            >
              {busy === p.key ? "Creating" : "Start from this"}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
