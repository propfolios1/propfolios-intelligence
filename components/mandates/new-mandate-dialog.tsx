"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";

export function NewMandateDialog({
  open,
  onOpenChange,
  clients,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <div className="eyebrow">New mandate</div>
        <DialogTitle className="mt-2 font-display text-card font-medium text-navy-900">Start a mandate</DialogTitle>
        <DialogDescription className="mt-1 text-secondary text-ink-500">
          Paste the client brief. The research agent will pick it up once the mandate is created.
        </DialogDescription>
        <form
          className="mt-6 space-y-4"
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
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-800">Client</span>
            <select required className="h-9 w-full rounded-control border border-ink-200 bg-surface px-3 text-sm focus:border-navy-500 focus:outline-none">
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-800">Ticket size (USD)</span>
              <Input type="number" min={100000} step={50000} placeholder="5,000,000" className="num" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink-800">Hold period (years)</span>
              <Input type="number" min={1} max={20} defaultValue={5} className="num" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-ink-800">Brief</span>
            <Textarea rows={5} required placeholder="Family office seeking 6–8% net yield in prime Dubai residential, Golden Visa-qualifying, 5-year hold…" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create mandate"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
