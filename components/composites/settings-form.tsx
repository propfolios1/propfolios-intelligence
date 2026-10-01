"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { FormField, Input, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";

type Prefs = { digest: "daily" | "weekly" | "off"; alerts: boolean; currency: "AED" | "USD" | "INR" };

export function SettingsForm({ name, email, role, title: initialTitle, preferences }: { name: string; email: string; role: string; title: string | null; preferences: Prefs | null }) {
  const [title, setTitle] = React.useState(initialTitle ?? "");
  const [prefs, setPrefs] = React.useState<Prefs>(preferences ?? { digest: "weekly", alerts: true, currency: "AED" });
  const [saving, setSaving] = React.useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, preferences: prefs }) });
    setSaving(false);
    if (res.ok) toast.success("Settings saved");
    else toast.error("Settings not saved. Retry.");
  }
  return (
    <form onSubmit={save}>
      <Card>
        <CardHeader eyebrow="Account" title="Profile and notifications" />
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField label="Name" hint="Managed by your sign-in provider.">
            <Input value={name} disabled />
          </FormField>
          <FormField label="Email">
            <Input value={email} disabled />
          </FormField>
          <FormField label="Role">
            <Input value={role} disabled className="capitalize" />
          </FormField>
          <FormField label="Title" htmlFor="title">
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Email digest" htmlFor="digest">
            <Select id="digest" value={prefs.digest} onChange={(e) => setPrefs({ ...prefs, digest: e.target.value as Prefs["digest"] })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="off">Off</option>
            </Select>
          </FormField>
          <FormField label="Reporting currency" htmlFor="currency">
            <Select id="currency" value={prefs.currency} onChange={(e) => setPrefs({ ...prefs, currency: e.target.value as Prefs["currency"] })}>
              <option value="AED">AED</option>
              <option value="USD">USD</option>
              <option value="INR">INR</option>
            </Select>
          </FormField>
          <label className="flex items-center gap-3 text-ui text-ink-900 md:col-span-2">
            <input type="checkbox" checked={prefs.alerts} onChange={(e) => setPrefs({ ...prefs, alerts: e.target.checked })} className="size-4 accent-[var(--navy-900)]" />
            Email me when a high or critical alert is raised
          </label>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving" : "Save settings"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
