"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/primitives/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/primitives/dialog";
import { Field, Input, Select, Textarea } from "@/components/primitives/field";

export function NewMandateDialog({ open, onOpenChange, clients }: { open: boolean; onOpenChange: (o: boolean) => void; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px]">
        <div className="eyebrow">New mandate</div>
        <DialogTitle className="mt-4 font-display text-section text-navy">Open a mandate</DialogTitle>
        <DialogDescription className="mt-2 text-ui text-ink-2">Paste the client brief. Research starts when the mandate is created.</DialogDescription>
        <form
          className="mt-8 flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            setSaving(true);
            setTimeout(() => {
              setSaving(false);
              onOpenChange(false);
              router.push("/analyst/dashboard");
            }, 400);
          }}
        >
          <Field label="Client">
            <Select required defaultValue={clients[0]?.id}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-6">
            <Field label="Ticket, USD">
              <Input type="number" min={100000} step={50000} placeholder="5000000" className="num" />
            </Field>
            <Field label="Hold, years">
              <Input type="number" min={1} max={20} defaultValue={5} className="num" />
            </Field>
          </div>
          <Field label="Brief">
            <Textarea rows={5} required placeholder="6 to 8% net yield in prime Dubai residential. Golden Visa eligible. 5 year hold." />
          </Field>
          <div className="flex justify-end gap-3 border-t border-rule pt-6">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Opening" : "Open mandate"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
