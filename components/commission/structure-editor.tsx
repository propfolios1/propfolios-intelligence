"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input, Select } from "@/components/ui/form";
import { post } from "./post";

type Split = { label: string; role?: "senior_analyst" | "analyst" | "junior_analyst" | "house"; pct: number };
type Tier = { upTo: number | null; ratePct: number };
export interface StructureView {
  id?: string;
  name: string;
  type: "percentage" | "fixed" | "tiered";
  ratePct: number | null;
  fixedAmount: number | null;
  currency: "AED" | "INR" | "USD" | null;
  tiers: Tier[];
  splits: Split[];
  appliesTo: { jurisdictions?: string[]; dealTypes?: string[]; minValue?: number };
  payer: "developer" | "seller" | "buyer";
  isDefault: boolean;
  active: boolean;
}

const JUR = [["dubai", "Dubai"], ["abu_dhabi", "Abu Dhabi"], ["mumbai", "Mumbai"], ["goa", "Goa"]] as const;
const TYPES = [["residential_resale", "Resale"], ["off_plan", "Off-plan"], ["co_op_resale", "Co-op resale"], ["freehold_villa", "Villa"], ["commercial", "Commercial"]] as const;
const EMPTY: StructureView = { name: "", type: "percentage", ratePct: 2, fixedAmount: null, currency: null, tiers: [], splits: [{ label: "Lead analyst", role: "analyst", pct: 40 }, { label: "Senior analyst", role: "senior_analyst", pct: 20 }, { label: "House", role: "house", pct: 40 }], appliesTo: {}, payer: "buyer", isDefault: false, active: true };

/** Create or edit a commission structure: rate or tiers, scope, payer and splits (must total 100%). */
export function StructureEditor({ initial, trigger }: { initial?: StructureView; trigger: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState<StructureView>(initial ?? EMPTY);
  const set = <K extends keyof StructureView>(k: K, x: StructureView[K]) => setV((p) => ({ ...p, [k]: x }));
  const total = v.splits.reduce((a, x) => a + x.pct, 0);
  const toggle = (k: "jurisdictions" | "dealTypes", x: string) => set("appliesTo", { ...v.appliesTo, [k]: (v.appliesTo[k] ?? []).includes(x) ? (v.appliesTo[k] ?? []).filter((y) => y !== x) : [...(v.appliesTo[k] ?? []), x] });
  const save = async () => {
    const { id, ...body } = v;
    const r = await post(id ? `/api/commissions/structures/${id}` : "/api/commissions/structures", body, { method: id ? "PATCH" : "POST", ok: id ? "Structure updated" : "Structure created", fail: "Structure not saved" });
    if (r) {
      setOpen(false);
      router.refresh();
    }
  };
  return (
    <>
      <Button variant={initial ? "secondary" : "primary"} size={initial ? "sm" : "md"} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[720px]">
          <DialogTitle>{initial ? "Edit structure" : "New commission structure"}</DialogTitle>
          <DialogDescription>The most specific active structure that matches a deal applies when it closes.</DialogDescription>
          <div className="mt-4 grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
            <FormField label="Name" className="sm:col-span-2">
              <Input value={v.name} onChange={(e) => set("name", e.target.value)} />
            </FormField>
            <FormField label="Method">
              <Select value={v.type} onChange={(e) => set("type", e.target.value as StructureView["type"])}>
                <option value="percentage">Percentage of value</option>
                <option value="fixed">Fixed fee</option>
                <option value="tiered">Tiered (marginal)</option>
              </Select>
            </FormField>
            <FormField label="Paid by">
              <Select value={v.payer} onChange={(e) => set("payer", e.target.value as StructureView["payer"])}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="developer">Developer</option>
              </Select>
            </FormField>
            {v.type === "percentage" && (
              <FormField label="Rate (%)">
                <Input type="number" step="0.05" value={v.ratePct ?? ""} onChange={(e) => set("ratePct", e.target.value === "" ? null : Number(e.target.value))} className="num" />
              </FormField>
            )}
            {v.type === "fixed" && (
              <>
                <FormField label="Fixed fee">
                  <Input type="number" value={v.fixedAmount ?? ""} onChange={(e) => set("fixedAmount", e.target.value === "" ? null : Number(e.target.value))} className="num" />
                </FormField>
                <FormField label="Currency">
                  <Select value={v.currency ?? "AED"} onChange={(e) => set("currency", e.target.value as "AED")}>
                    <option>AED</option>
                    <option>INR</option>
                    <option>USD</option>
                  </Select>
                </FormField>
              </>
            )}
            {v.type === "tiered" && (
              <div className="space-y-2 sm:col-span-2">
                <div className="text-ui font-medium text-ink-900">Tiers</div>
                {v.tiers.map((t, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                    <Input type="number" placeholder="Up to (blank for above)" value={t.upTo ?? ""} onChange={(e) => set("tiers", v.tiers.map((x, j) => (j === i ? { ...x, upTo: e.target.value === "" ? null : Number(e.target.value) } : x)))} className="num" />
                    <Input type="number" step="0.05" value={t.ratePct} onChange={(e) => set("tiers", v.tiers.map((x, j) => (j === i ? { ...x, ratePct: Number(e.target.value) } : x)))} className="num" />
                    <Button variant="ghost" size="sm" onClick={() => set("tiers", v.tiers.filter((_, j) => j !== i))}>
                      Remove
                    </Button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => set("tiers", [...v.tiers, { upTo: null, ratePct: 1 }])}>
                  Add tier
                </Button>
              </div>
            )}
            <div className="sm:col-span-2">
              <div className="text-ui font-medium text-ink-900">Applies to</div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-small">
                {JUR.map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="checkbox" checked={(v.appliesTo.jurisdictions ?? []).includes(k)} onChange={() => toggle("jurisdictions", k)} className="accent-[var(--navy-900)]" />
                    {l}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-small">
                {TYPES.map(([k, l]) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="checkbox" checked={(v.appliesTo.dealTypes ?? []).includes(k)} onChange={() => toggle("dealTypes", k)} className="accent-[var(--navy-900)]" />
                    {l}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-axis text-ink-500">None ticked means all.</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-baseline justify-between">
                <span className="text-ui font-medium text-ink-900">Splits</span>
                <span className={`num text-small ${Math.abs(total - 100) < 0.01 ? "text-success" : "text-danger"}`}>{total}%</span>
              </div>
              {v.splits.map((x, i) => (
                <div key={i} className="grid grid-cols-[1fr_150px_90px_auto] gap-2">
                  <Input value={x.label} onChange={(e) => set("splits", v.splits.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
                  <Select value={x.role ?? "house"} onChange={(e) => set("splits", v.splits.map((y, j) => (j === i ? { ...y, role: e.target.value as Split["role"] } : y)))}>
                    <option value="analyst">Deal owner</option>
                    <option value="senior_analyst">Senior analyst</option>
                    <option value="junior_analyst">Junior analyst</option>
                    <option value="house">Firm</option>
                  </Select>
                  <Input type="number" value={x.pct} onChange={(e) => set("splits", v.splits.map((y, j) => (j === i ? { ...y, pct: Number(e.target.value) } : y)))} className="num" />
                  <Button variant="ghost" size="sm" onClick={() => set("splits", v.splits.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => set("splits", [...v.splits, { label: "Introducer", role: "house", pct: 0 }])}>
                Add split
              </Button>
            </div>
            <label className="flex items-center gap-2 text-small sm:col-span-2">
              <input type="checkbox" checked={v.isDefault} onChange={(e) => set("isDefault", e.target.checked)} className="accent-[var(--navy-900)]" />
              Default when no other structure matches
            </label>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={save} disabled={v.name.trim().length < 3 || Math.abs(total - 100) >= 0.01}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeactivateStructure({ id }: { id: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        if (await post(`/api/commissions/structures/${id}`, {}, { method: "DELETE" })) router.refresh();
      }}
    >
      Deactivate
    </Button>
  );
}
