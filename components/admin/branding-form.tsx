"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import type { TenantConfig } from "@/db/schema";
import { cn } from "@/lib/utils";

/** Edits the workspace brand with a live preview. Plan limits are enforced by the API and explained inline. */
export function BrandingForm({ config, canStyle, canDomain, planName }: { config: TenantConfig; canStyle: boolean; canDomain: boolean; planName: string }) {
  const router = useRouter();
  const [c, setC] = React.useState(config);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/tenants/me/branding/logo", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return void toast.error("Logo not uploaded", { description: json.error });
    set("logo_url", json.logo_url);
    toast.success("Logo uploaded", { description: "Stored privately in your workspace's branding bucket." });
    router.refresh();
  }
  const set = <K extends keyof TenantConfig>(k: K, v: TenantConfig[K]) => setC((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/tenants/me/branding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brand_name: c.brand_name, logo_url: c.logo_url ?? "", primary_color: c.primary_color, accent_color: c.accent_color, font_display: c.font_display, custom_domain: c.custom_domain ?? "", memo_style: c.memo_style }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return void toast.error("Branding not saved", { description: json.error ?? (json.issues ? "Check the highlighted fields." : undefined) });
    toast.success("Branding saved", { description: "Every screen and new memo PDF now uses it." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="flex flex-col gap-6 xl:col-span-7">
        <Card>
          <CardHeader eyebrow="Identity" title="Name and logo" />
          <CardContent className="grid gap-6 md:grid-cols-2">
            <FormField label="Product name" htmlFor="brand_name" hint="Shown in navigation, on sign-in and on every memo." className="md:col-span-2">
              <Input id="brand_name" value={c.brand_name} onChange={(e) => set("brand_name", e.target.value)} />
            </FormField>
            <FormField label="Logo" htmlFor="logo" hint={canStyle ? "Upload an SVG or PNG on a transparent background, up to 1 MB, or paste an image address." : `Available from the Professional plan. You are on ${planName}.`} className="md:col-span-2">
              <div className="flex gap-2">
                <Input id="logo" value={c.logo_url ?? ""} disabled={!canStyle} onChange={(e) => set("logo_url", e.target.value || null)} placeholder="https://" />
                <Button type="button" variant="secondary" disabled={!canStyle || uploading} onClick={() => fileRef.current?.click()}>
                  {uploading ? "Uploading" : "Upload"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </FormField>
          </CardContent>
        </Card>
        <Card>
          <CardHeader eyebrow="Appearance" title="Colours and typography" />
          <CardContent className="grid gap-6 md:grid-cols-3">
            {(["primary_color", "accent_color"] as const).map((k) => (
              <FormField key={k} label={k === "primary_color" ? "Primary" : "Accent"} htmlFor={k}>
                <div className="flex items-center gap-2">
                  <input type="color" value={c[k]} disabled={!canStyle} onChange={(e) => set(k, e.target.value)} aria-label={`${k === "primary_color" ? "Primary" : "Accent"} colour picker`} className="h-9 w-10 rounded-sm border border-hairline bg-surface disabled:opacity-40" />
                  <Input id={k} className="num" value={c[k]} disabled={!canStyle} onChange={(e) => set(k, e.target.value)} />
                </div>
              </FormField>
            ))}
            <FormField label="Display typeface" htmlFor="font">
              <Select id="font" value={c.font_display} disabled={!canStyle} onChange={(e) => set("font_display", e.target.value as TenantConfig["font_display"])}>
                <option value="Playfair Display">Playfair Display</option>
                <option value="Inter">Inter</option>
              </Select>
            </FormField>
            {!canStyle && <p className="text-small text-ink-500 md:col-span-3">Colours, logo and typography are included from the Professional plan. Change plan in Billing.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader eyebrow="Memo house style" title="How your memos read" />
          <CardContent className="grid gap-6">
            <FormField label="Voice" htmlFor="tone" hint="Given to the memo agent as its style instruction.">
              <Textarea id="tone" rows={3} value={c.memo_style.tone} onChange={(e) => set("memo_style", { ...c.memo_style, tone: e.target.value })} />
            </FormField>
            <FormField label="Sign-off" htmlFor="signoff">
              <Input id="signoff" value={c.memo_style.signoff} onChange={(e) => set("memo_style", { ...c.memo_style, signoff: e.target.value })} />
            </FormField>
            <FormField label="Disclaimer" htmlFor="disclaimer" hint="Printed at the foot of every memo PDF.">
              <Textarea id="disclaimer" rows={3} value={c.memo_style.disclaimer} onChange={(e) => set("memo_style", { ...c.memo_style, disclaimer: e.target.value })} />
            </FormField>
          </CardContent>
        </Card>
        <Card>
          <CardHeader eyebrow="White-label" title="Custom domain" />
          <CardContent>
            <FormField label="Domain" htmlFor="domain" hint={canDomain ? "Add a CNAME record pointing to cname.vercel-dns.com, then add the domain to the Vercel project." : "Custom domains are part of the White-label plan."}>
              <Input id="domain" value={c.custom_domain ?? ""} disabled={!canDomain} onChange={(e) => set("custom_domain", e.target.value || null)} placeholder="intelligence.yourfirm.ae" />
            </FormField>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving" : "Save branding"}
            </Button>
          </CardFooter>
        </Card>
      </div>
      <aside className="xl:col-span-5">
        <div className="sticky top-20">
          <div className="eyebrow mb-3">Live preview</div>
          <div className="overflow-hidden rounded-md border border-hairline bg-canvas shadow-float" style={{ ["--navy-900" as string]: c.primary_color, ["--gold-500" as string]: c.accent_color }}>
            <div className="flex h-14 items-center border-b border-hairline bg-surface px-5">
              {c.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logo_url} alt="" className="h-8 max-w-[140px] object-contain" />
              ) : (
                <BrandMark size="sm" name={c.brand_name} />
              )}
            </div>
            <div className="p-6">
              <div className="eyebrow">Allocation Memo</div>
              <div className={cn("mt-2 text-card text-navy-900", c.font_display === "Playfair Display" ? "font-display" : "font-sans font-medium")}>Downtown Dubai Allocation</div>
              <span className="mt-3 block h-0.5 w-8 bg-gold-500" />
              <p className="mt-4 text-small text-ink-700">{c.memo_style.tone}</p>
              <div className="mt-5 inline-flex h-9 items-center rounded-sm bg-navy-900 px-4 text-ui font-medium text-surface">Approve and deliver</div>
              <p className="mt-5 border-t border-hairline pt-3 text-axis text-ink-500">{c.memo_style.signoff}</p>
            </div>
          </div>
        </div>
      </aside>
    </form>
  );
}
