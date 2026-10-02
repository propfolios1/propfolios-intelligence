"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { PLANS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

const STEPS = ["Firm", "Brand", "Plan", "Team", "Review"] as const;
const SWATCHES = [
  ["#0A1F44", "#C9A961"],
  ["#13392F", "#B08D57"],
  ["#2B2A4C", "#C2A15A"],
  ["#3A1F2B", "#C49A6C"],
  ["#1F2933", "#7FA7C9"],
] as const;

interface Invite {
  email: string;
  role: "tenant_admin" | "analyst";
}

/**
 * Five steps: firm and administrator, brand (with a live preview), plan,
 * team invitations (checked against the plan's seats) and review. Submitting
 * creates the workspace and signs the administrator in.
 */
export function OnboardingWizard({ askAdmin, defaultName, defaultEmail, defaultPlan }: { askAdmin: boolean; defaultName: string; defaultEmail: string; defaultPlan: PlanId }) {
  const [step, setStep] = React.useState(0);
  const [firm, setFirm] = React.useState("");
  const [adminName, setAdminName] = React.useState(defaultName);
  const [adminEmail, setAdminEmail] = React.useState(defaultEmail);
  const [brandName, setBrandName] = React.useState("");
  const [primary, setPrimary] = React.useState("#0A1F44");
  const [accent, setAccent] = React.useState("#C9A961");
  const [font, setFont] = React.useState<"Playfair Display" | "Inter">("Playfair Display");
  const [logo, setLogo] = React.useState("");
  const [plan, setPlan] = React.useState<PlanId>(defaultPlan);
  const [domain, setDomain] = React.useState("");
  const [invites, setInvites] = React.useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<Invite["role"]>("analyst");
  const [seed, setSeed] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);

  const planDef = PLANS.find((p) => p.id === plan)!;
  const seatsUsed = 1 + invites.length;
  const displayBrand = brandName.trim() || (firm.trim() ? `${firm.trim()} Intelligence` : "Your Firm Intelligence");

  function validate(i: number) {
    if (i === 0) {
      if (firm.trim().length < 2) return "Enter your firm's name.";
      if (askAdmin && adminName.trim().length < 2) return "Enter the administrator's name.";
      if (askAdmin && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) return "Enter the administrator's email.";
    }
    if (i === 1 && !/^#[0-9a-fA-F]{6}$/.test(primary + "") ) return "Primary colour must be a hex value such as #0A1F44.";
    if (i === 1 && !/^#[0-9a-fA-F]{6}$/.test(accent)) return "Accent colour must be a hex value such as #C9A961.";
    if (i === 2 && planDef.customDomain && domain && !/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) return "Enter a domain such as intelligence.yourfirm.ae.";
    if (i === 3 && planDef.seats !== null && seatsUsed > planDef.seats) return `The ${planDef.name} plan includes ${planDef.seats} staff seats. Remove an invitation or choose a larger plan.`;
    return undefined;
  }

  function next() {
    const e = validate(step);
    setError(e);
    if (!e) setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function addInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("Enter a valid email to invite.");
    if (invites.some((i) => i.email === email) || email === adminEmail.toLowerCase()) return setError("That person is already on the list.");
    setError(undefined);
    setInvites((l) => [...l, { email, role: inviteRole }]);
    setInviteEmail("");
  }

  async function submit() {
    for (let i = 0; i < 4; i++) {
      const e = validate(i);
      if (e) {
        setStep(i);
        return setError(e);
      }
    }
    setBusy(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: firm.trim(),
        brand: { brand_name: displayBrand, primary_color: primary, accent_color: accent, font_display: font, logo_url: logo || null, custom_domain: planDef.customDomain && domain ? domain : null },
        plan,
        admin: askAdmin ? { name: adminName.trim(), email: adminEmail.trim() } : { name: adminName.trim() || defaultName, email: defaultEmail },
        invites,
        seedDemo: seed,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError(json.error ?? "The workspace could not be created.");
      return void toast.error("Workspace not created", { description: json.error });
    }
    toast.success(`${firm.trim()} is ready`, { description: seed ? "Demonstration data has been loaded." : undefined });
    window.location.href = json.redirect;
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <ol className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn("flex items-center gap-2 text-small", i === step ? "font-medium text-ink-900" : i < step ? "text-ink-700 hover:text-ink-900" : "text-ink-400")}
              >
                <span className={cn("flex size-5 items-center justify-center rounded-full border text-[0.6875rem]", i < step ? "border-navy-900 bg-navy-900 text-surface" : i === step ? "border-navy-900 text-navy-900" : "border-ink-200")}>
                  {i < step ? <Check className="size-3 stroke-[2.5]" /> : i + 1}
                </span>
                {s}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-md border border-ink-200 bg-surface p-6 shadow-card md:p-8">
          {step === 0 && (
            <div className="grid gap-6">
              <FormField label="Firm name" htmlFor="firm" hint="As it appears on your trade licence.">
                <Input id="firm" value={firm} onChange={(e) => setFirm(e.target.value)} placeholder="Gulf Crest Capital" autoFocus />
              </FormField>
              {askAdmin && (
                <div className="grid gap-6 md:grid-cols-2">
                  <FormField label="Administrator" htmlFor="admin-name">
                    <Input id="admin-name" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                  </FormField>
                  <FormField label="Administrator email" htmlFor="admin-email">
                    <Input id="admin-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                  </FormField>
                </div>
              )}
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-6">
              <FormField label="Product name" htmlFor="brand" hint="Shown in navigation, on sign-in and on every memo.">
                <Input id="brand" value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder={displayBrand} />
              </FormField>
              <div>
                <div className="text-ui font-medium text-ink-900">Colours</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SWATCHES.map(([p, a]) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPrimary(p);
                        setAccent(a);
                      }}
                      aria-label={`Use ${p} with ${a}`}
                      aria-pressed={primary === p && accent === a}
                      className={cn("flex h-9 w-16 overflow-hidden rounded-sm border", primary === p && accent === a ? "border-ink-900" : "border-ink-200")}
                    >
                      <span className="flex-[3]" style={{ background: p }} />
                      <span className="flex-1" style={{ background: a }} />
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField label="Primary" htmlFor="primary">
                    <div className="flex items-center gap-2">
                      <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} aria-label="Primary colour picker" className="h-9 w-10 rounded-sm border border-ink-200 bg-surface" />
                      <Input id="primary" className="num" value={primary} onChange={(e) => setPrimary(e.target.value)} />
                    </div>
                  </FormField>
                  <FormField label="Accent" htmlFor="accent" hint="Used sparingly: active states and rules.">
                    <div className="flex items-center gap-2">
                      <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} aria-label="Accent colour picker" className="h-9 w-10 rounded-sm border border-ink-200 bg-surface" />
                      <Input id="accent" className="num" value={accent} onChange={(e) => setAccent(e.target.value)} />
                    </div>
                  </FormField>
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField label="Display typeface" htmlFor="font">
                  <Select id="font" value={font} onChange={(e) => setFont(e.target.value as typeof font)}>
                    <option value="Playfair Display">Playfair Display (serif)</option>
                    <option value="Inter">Inter (sans-serif)</option>
                  </Select>
                </FormField>
                <FormField label="Logo URL" htmlFor="logo" hint="Optional. SVG or PNG, transparent background.">
                  <Input id="logo" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://" />
                </FormField>
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <div className="grid gap-3 md:grid-cols-2">
                {PLANS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlan(p.id)}
                    aria-pressed={plan === p.id}
                    className={cn("rounded-md border p-4 text-left transition-colors duration-150", plan === p.id ? "border-navy-900 bg-navy-50" : "border-ink-200 hover:border-ink-400")}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-ui font-medium text-ink-900">{p.name}</span>
                      <span className="num text-small text-ink-700">AED {p.priceAed.toLocaleString("en-US")}</span>
                    </div>
                    <p className="mt-1 text-small text-ink-500">{p.seats === null ? "Unlimited seats" : `${p.seats} staff seats`}. {p.summary}</p>
                  </button>
                ))}
              </div>
              {planDef.customDomain && (
                <FormField label="Custom domain" htmlFor="domain" hint="Point a CNAME to cname.vercel-dns.com, then add the domain in your Vercel project." className="mt-6">
                  <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="intelligence.yourfirm.ae" />
                </FormField>
              )}
              <p className="mt-6 text-small text-ink-500">Every plan starts with a 14-day trial. Billing is by AED invoice; nothing is charged today.</p>
            </div>
          )}
          {step === 3 && (
            <div>
              <div className="flex items-baseline justify-between">
                <div className="text-ui font-medium text-ink-900">Invite your team</div>
                <span className="num text-small text-ink-500">
                  {seatsUsed} of {planDef.seats ?? "unlimited"} seats
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInvite())} placeholder="colleague@yourfirm.ae" aria-label="Email to invite" className="min-w-0 flex-1" />
                <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Invite["role"])} aria-label="Role" className="w-40">
                  <option value="analyst">Analyst</option>
                  <option value="tenant_admin">Administrator</option>
                </Select>
                <Button type="button" variant="secondary" onClick={addInvite}>
                  Add
                </Button>
              </div>
              <ul className="mt-4 divide-y divide-ink-200 border-y border-ink-200">
                <li className="flex items-center justify-between py-2.5 text-small">
                  <span className="text-ink-900">{askAdmin ? adminEmail || "Administrator" : defaultEmail}</span>
                  <span className="text-ink-500">Administrator, you</span>
                </li>
                {invites.map((i) => (
                  <li key={i.email} className="flex items-center justify-between py-2.5 text-small">
                    <span className="text-ink-900">{i.email}</span>
                    <span className="flex items-center gap-4">
                      <span className="text-ink-500">{i.role === "tenant_admin" ? "Administrator" : "Analyst"}</span>
                      <button type="button" onClick={() => setInvites((l) => l.filter((x) => x.email !== i.email))} className="text-ink-500 hover:text-danger">
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-small text-ink-500">Clients are invited later from each client&apos;s record and do not use seats.</p>
            </div>
          )}
          {step === 4 && (
            <div>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 text-ui md:grid-cols-2">
                <div>
                  <dt className="eyebrow">Firm</dt>
                  <dd className="mt-1 text-ink-900">{firm}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Product name</dt>
                  <dd className="mt-1 text-ink-900">{displayBrand}</dd>
                </div>
                <div>
                  <dt className="eyebrow">Plan</dt>
                  <dd className="mt-1 text-ink-900">
                    {planDef.name}, AED {planDef.priceAed.toLocaleString("en-US")} a month after the trial
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Team</dt>
                  <dd className="mt-1 text-ink-900">{seatsUsed === 1 ? "You" : `You and ${invites.length} invited`}</dd>
                </div>
              </dl>
              <label className="mt-6 flex items-start gap-3 rounded-md border border-ink-200 p-4">
                <input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} className="mt-0.5 size-4 accent-[var(--navy-900)]" />
                <span>
                  <span className="block text-ui font-medium text-ink-900">Load the demonstration dataset</span>
                  <span className="block text-small text-ink-500">Five clients, thirty UAE and India projects, eighteen developers, market data and three mandates, so your team can explore immediately. Remove it later in Administration.</span>
                </span>
              </label>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-6 text-ui text-danger">
              {error}
            </p>
          )}
          <div className="mt-8 flex items-center justify-between border-t border-ink-200 pt-6">
            <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next}>
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={submit} disabled={busy}>
                {busy ? "Creating workspace" : "Create workspace"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="lg:col-span-5" aria-label="Brand preview">
        <div className="eyebrow mb-3">Preview</div>
        <div
          className="overflow-hidden rounded-lg border border-ink-200 bg-canvas shadow-float"
          style={{ ["--navy-900" as string]: primary, ["--gold-500" as string]: accent, ["--navy-50" as string]: `color-mix(in oklab, ${primary} 5%, white)` }}
        >
          <div className="flex h-14 items-center border-b border-ink-200 bg-surface px-5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-8 max-w-[140px] object-contain" />
            ) : (
              <BrandMark size="sm" name={displayBrand} />
            )}
          </div>
          <div className="p-6">
            <div className="eyebrow">Allocation Memo</div>
            <div className={cn("mt-2 text-card text-navy-900", font === "Playfair Display" ? "font-display" : "font-sans font-medium")}>Downtown Dubai Allocation</div>
            <span className="mt-3 block h-0.5 w-8" style={{ background: accent }} />
            <div className="mt-5 grid grid-cols-3 gap-3">
              {[
                ["P50 IRR", "8.3%"],
                ["Multiple", "1.45x"],
                ["Risk", "Low"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-md border border-ink-200 bg-surface p-3">
                  <div className="text-[0.6875rem] text-ink-500 uppercase">{l}</div>
                  <div className="num mt-1 text-ui text-navy-900">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 inline-flex h-9 items-center rounded-sm px-4 text-ui font-medium text-surface" style={{ background: primary }}>
              Approve and deliver
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
