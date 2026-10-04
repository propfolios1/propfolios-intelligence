"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/ui/copy-button";
import { FormField, Input, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export function ThemePicker({ current, themes }: { current: string; themes: { key: string; name: string; description: string; vars: Record<string, string>; display: string; radius: number }[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {themes.map((t) => (
        <li key={t.key}>
          <button
            type="button"
            aria-pressed={current === t.key}
            disabled={Boolean(busy)}
            onClick={async () => {
              setBusy(t.key);
              const r = await post("/api/website", { action: "theme", theme: t.key }, { fail: "Theme not changed" });
              setBusy(null);
              if (r) {
                toast.success(`${t.name} theme applied`, { description: "Visible on the live site at once." });
                router.refresh();
              }
            }}
            className={cn("w-full overflow-hidden rounded-md border text-start transition-colors duration-150", current === t.key ? "border-navy-900" : "border-hairline hover:border-navy-300")}
          >
            <div className="p-5" style={{ background: t.vars["--site-bg"], color: t.vars["--site-ink"] }}>
              <div className="h-16 p-3" style={{ background: "var(--brand-primary, #0A1F44)", borderRadius: t.radius, color: t.vars["--site-hero-ink"] }}>
                <span className={t.display === "serif" ? "font-display text-[18px]" : "text-[16px] font-medium"}>Homes worth moving for.</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 border" style={{ background: t.vars["--site-surface"], borderColor: t.vars["--site-line"], borderRadius: t.radius }} />
                ))}
              </div>
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-hairline bg-surface p-4">
              <div>
                <div className="text-ui font-medium text-ink-900">{t.name}</div>
                <div className="mt-1 text-[12px] text-ink-500">{t.description}</div>
              </div>
              {current === t.key && <Check className="size-4 text-navy-900" aria-label="Current theme" />}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function DomainSettings({ domain, token, target, sub, check, verified }: { domain: string | null; token: string; target: string; sub: string; check: { at: string; txt: boolean; cname: boolean; detail: string } | null; verified: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState(domain ?? "");
  const [busy, setBusy] = React.useState<string | null>(null);
  const save = async (d: string | null) => {
    setBusy("save");
    const r = await post("/api/website", { action: "domain", domain: d }, { fail: "Domain not saved" });
    setBusy(null);
    if (r) router.refresh();
  };
  const verify = async () => {
    setBusy("verify");
    const r = await post("/api/website", { action: "verify" }, { fail: "Verification did not run" });
    setBusy(null);
    if (r) {
      (r.check.txt && r.check.cname ? toast.success : toast.error)(r.check.txt && r.check.cname ? "Domain verified" : "Not verified yet", { description: r.check.detail });
      router.refresh();
    }
  };
  const records = domain
    ? [
        ["CNAME", domain, target],
        ["TXT", `_nakhla.${domain}`, token],
      ]
    : [];
  return (
    <div className="space-y-8">
      <section className="rounded-md border border-hairline bg-surface p-6">
        <h2 className="text-[16px] font-medium text-navy-900">Nakhla address</h2>
        <p className="mt-2 text-ui text-ink-700">
          Always available at <span className="num text-ink-900">{sub}</span>, with HTTPS.
        </p>
      </section>
      <section className="rounded-md border border-hairline bg-surface p-6">
        <h2 className="text-[16px] font-medium text-navy-900">Your own domain</h2>
        <div className="mt-4 flex max-w-[560px] flex-col gap-3 sm:flex-row sm:items-end">
          <FormField label="Domain" className="flex-1" hint="Usually www.yourfirm.com. Root domains need an ALIAS or ANAME record at your DNS provider.">
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="www.yourfirm.com" />
          </FormField>
          <Button variant="secondary" onClick={() => save(value || null)} disabled={Boolean(busy)}>
            Save
          </Button>
        </div>
        {domain && (
          <>
            <p className="mt-6 text-ui text-ink-700">Add these two records at your DNS provider, then verify. Changes usually take minutes and can take up to an hour.</p>
            <table className="mt-4 w-full min-w-[560px] text-ui">
              <thead>
                <tr className="h-8 border-b border-hairline">
                  <th className="label-caps text-start">Type</th>
                  <th className="label-caps px-3 text-start">Name</th>
                  <th className="label-caps px-3 text-start">Value</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map(([type, name, val]) => (
                  <tr key={type} className="h-10 border-b border-hairline-row">
                    <td className="num">{type}</td>
                    <td className="num px-3">{name}</td>
                    <td className="num max-w-[22rem] truncate px-3">{val}</td>
                    <td className="text-end">
                      <CopyButton value={val!} label="Copy" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={verify} disabled={Boolean(busy)}>
                {busy === "verify" ? "Checking DNS" : verified ? "Check again" : "Verify domain"}
              </Button>
              {check && (
                <span className={cn("text-ui", verified ? "text-success" : "text-ink-700")}>
                  {verified ? "Verified" : check.detail} <span className="num text-[12px] text-ink-500">({check.at.slice(0, 16).replace("T", " ")} UTC)</span>
                </span>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

type Seo = { title: string; description: string; ogImage: string | null; keywords: string[]; index: boolean };
type Contact = { email: string | null; phone: string | null; whatsapp: string | null; address: string | null };

export function SeoSettings({ seo, contact, base }: { seo: Seo; contact: Contact; base: string }) {
  const router = useRouter();
  const [f, setF] = React.useState({ ...seo, keywords: seo.keywords.join(", ") });
  const [c, setC] = React.useState(contact);
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <div className="grid gap-5 rounded-md border border-hairline bg-surface p-6">
        <FormField label="Page title" hint={`${f.title.length} of 70 characters; search engines show about 60.`}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={70} />
        </FormField>
        <FormField label="Description" hint={`${f.description.length} of 170 characters.`}>
          <Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={170} />
        </FormField>
        <FormField label="Sharing image URL" hint="Shown when a link is shared on WhatsApp, LinkedIn or X. 1200 by 630 pixels.">
          <Input value={f.ogImage ?? ""} onChange={(e) => setF({ ...f, ogImage: e.target.value || null })} />
        </FormField>
        <FormField label="Keywords" hint="Comma separated.">
          <Input value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} />
        </FormField>
        <label className="flex items-center gap-2 text-ui text-ink-700">
          <Checkbox checked={f.index} onCheckedChange={(v) => setF({ ...f, index: Boolean(v) })} /> Allow search engines to index the site
        </label>
        <h3 className="mt-2 label-caps">Contact details on the site</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email">
            <Input value={c.email ?? ""} onChange={(e) => setC({ ...c, email: e.target.value || null })} />
          </FormField>
          <FormField label="Telephone">
            <Input value={c.phone ?? ""} onChange={(e) => setC({ ...c, phone: e.target.value || null })} />
          </FormField>
          <FormField label="WhatsApp">
            <Input value={c.whatsapp ?? ""} onChange={(e) => setC({ ...c, whatsapp: e.target.value || null })} />
          </FormField>
          <FormField label="Office address">
            <Input value={c.address ?? ""} onChange={(e) => setC({ ...c, address: e.target.value || null })} />
          </FormField>
        </div>
        <div>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await post("/api/website", { action: "seo", seo: { ...f, keywords: f.keywords.split(",").map((k) => k.trim()).filter(Boolean) }, contact: c }, { fail: "Not saved" });
              setBusy(false);
              if (r) {
                toast.success("Search settings saved");
                router.refresh();
              }
            }}
          >
            {busy ? "Saving" : "Save"}
          </Button>
        </div>
      </div>
      <aside className="space-y-6">
        <div className="rounded-md border border-hairline bg-surface p-5">
          <div className="label-caps">Search result preview</div>
          <p className="mt-3 truncate text-[18px] text-[#1a0dab]">{f.title}</p>
          <p className="num truncate text-[12px] text-[#006621]">{base}</p>
          <p className="mt-1 line-clamp-2 text-[13px] text-ink-700">{f.description}</p>
        </div>
        <div className="rounded-md border border-hairline bg-surface p-5 text-ui text-ink-700">
          <div className="label-caps">Generated for every site</div>
          <ul className="mt-3 space-y-1.5">
            <li>
              <span className="num text-ink-900">/sitemap.xml</span> with every page and live listing
            </li>
            <li>
              <span className="num text-ink-900">/robots.txt</span> following the indexing setting
            </li>
            <li>schema.org RealEstateAgent and RealEstateListing data</li>
            <li>OpenGraph and canonical tags on every page</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
