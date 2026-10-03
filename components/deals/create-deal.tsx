"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toaster";

export function CreateDeal({ clients, properties }: { clients: { id: string; name: string }[]; properties: { id: string; name: string; city: string; currency: string; priceMin: number }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [clientId, setClientId] = React.useState(clients[0]?.id ?? "");
  const [propertyId, setPropertyId] = React.useState(properties[0]?.id ?? "");
  const prop = properties.find((p) => p.id === propertyId);
  const [value, setValue] = React.useState<number | null>(prop?.priceMin ?? null);
  const [side, setSide] = React.useState<"buy" | "sell">("buy");
  const [counterparty, setCounterparty] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setValue(prop?.priceMin ?? null), [prop?.priceMin]);
  const submit = async () => {
    setBusy(true);
    const res = await fetch("/api/deals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, propertyId, side, value, counterparty, notes: notes || undefined }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Deal not opened", { description: json.error });
    toast.success(`${json.reference} opened`, { description: "The forecast, offer strategy and closing plan are being prepared." });
    router.push(`/analyst/deals/${json.id}`);
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open deal</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Open deal</DialogTitle>
          <DialogDescription>The jurisdiction&apos;s closing checklist is attached automatically from the rules engine.</DialogDescription>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Client">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Side">
              <Select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")}>
                <option value="buy">Acquisition</option>
                <option value="sell">Disposal</option>
              </Select>
            </FormField>
            <FormField label="Property" className="sm:col-span-2">
              <Select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.city})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Indicative value">
              <MoneyInput value={value} onChange={setValue} currency={prop?.currency ?? "AED"} />
            </FormField>
            <FormField label="Counterparty">
              <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder={side === "buy" ? "Vendor's name" : "Purchaser's name"} />
            </FormField>
            <FormField label="Counterparty's position" hint="Used by the offer strategist." className="sm:col-span-2">
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Seller relocating; wants completion within 60 days." />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={submit} disabled={busy || !value || counterparty.trim().length < 2}>
              {busy ? "Opening" : "Open deal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
