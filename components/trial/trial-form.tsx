"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type Country = { code: string; name: string; flag: string; seeds: string };

const STEPS = ["Creating the workspace", "Adding three agents and their history", "Loading developers, projects and 90 days of market data", "Seeding 30 listings and 50 leads", "Opening 10 deals and one complete journey", "Computing commissions and invoices"];

export function TrialForm({ countries }: { countries: Country[] }) {
  const [country, setCountry] = React.useState<string>("");
  const [f, setF] = React.useState({ firmName: "", name: "", email: "", agentCount: "8" });
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [error, setError] = React.useState<{ text: string; login?: boolean } | null>(null);
  const [emailed, setEmailed] = React.useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const chosen = countries.find((c) => c.code === country);
  const valid = country && f.firmName.trim().length > 1 && f.name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email) && Number(f.agentCount) > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    setStep(0);
    const tick = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    const res = await fetch("/api/trial", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ country, firmName: f.firmName, name: f.name, email: f.email, agentCount: Number(f.agentCount) }) });
    window.clearInterval(tick);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setError({ text: j.error ?? "The workspace could not be created. Retry in a minute.", login: res.status === 409 });
      return;
    }
    setStep(STEPS.length);
    if (j.next) window.location.assign(j.next);
    else {
      setBusy(false);
      setEmailed(f.email);
    }
  };

  if (emailed)
    return (
      <div className="rounded-md border border-hairline bg-surface p-8" role="status">
        <h2 className="font-display text-[28px] text-navy-900">Check your email</h2>
        <p className="mt-3 text-read text-ink-700">
          The sign-in link for {f.firmName} is on its way to <span className="text-ink-900">{emailed}</span>. Your workspace is ready and seeded; the fourteen days start now.
        </p>
      </div>
    );

  return (
    <form onSubmit={submit} className="rounded-md border border-hairline bg-surface p-6 md:p-8" aria-busy={busy}>
      <fieldset>
        <legend className="text-ui font-medium text-ink-900">1. Where does your firm sell?</legend>
        <p className="mt-1 text-ui text-ink-500">The workspace is seeded with that market&apos;s developers, communities, currency and registration numbers.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Country">
          {countries.map((c) => (
            <button
              key={c.code}
              type="button"
              role="radio"
              aria-checked={country === c.code}
              onClick={() => setCountry(c.code)}
              className={cn("flex h-14 items-center gap-2.5 rounded-sm border px-3 text-start text-ui transition-colors duration-150", country === c.code ? "border-navy-900 bg-navy-50 text-ink-900" : "border-hairline text-ink-700 hover:border-navy-300")}
            >
              <span aria-hidden className="text-[18px]">
                {c.flag}
              </span>
              <span className="leading-tight">{c.name}</span>
            </button>
          ))}
        </div>
        {chosen && <p className="mt-3 text-[13px] text-ink-500">{chosen.seeds}</p>}
      </fieldset>
      <fieldset className={cn("mt-8 transition-opacity duration-250", country ? "opacity-100" : "pointer-events-none opacity-40")} disabled={!country}>
        <legend className="text-ui font-medium text-ink-900">2. Your firm</legend>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField label="Firm name" htmlFor="firm">
            <Input id="firm" value={f.firmName} onChange={set("firmName")} autoComplete="organization" required />
          </FormField>
          <FormField label="Number of agents" htmlFor="agents">
            <Input id="agents" type="number" min={1} max={5000} value={f.agentCount} onChange={set("agentCount")} className="num" required />
          </FormField>
          <FormField label="Your name" htmlFor="name">
            <Input id="name" value={f.name} onChange={set("name")} autoComplete="name" required />
          </FormField>
          <FormField label="Work email" htmlFor="email" hint="One trial per address. The sign-in link goes here.">
            <Input id="email" type="email" value={f.email} onChange={set("email")} autoComplete="email" required />
          </FormField>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="mt-6 rounded-sm bg-danger/5 px-4 py-3 text-ui text-ink-900">
          {error.text}{" "}
          {error.login && (
            <Link href="/sign-in" className="text-navy-900 underline underline-offset-4">
              Sign in
            </Link>
          )}
        </p>
      )}
      {busy ? (
        <ol className="mt-8 space-y-2" aria-live="polite">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-3 text-ui transition-colors duration-250", i < step ? "text-ink-900" : i === step ? "text-ink-900" : "text-ink-400")}>
              <span className={cn("flex size-5 items-center justify-center rounded-full border", i < step ? "border-navy-900 bg-navy-900 text-surface" : i === step ? "border-navy-900" : "border-ink-200")}>{i < step ? <Check className="size-3" /> : <span className={cn("size-1.5 rounded-full", i === step ? "home-pulse bg-gold-500" : "bg-transparent")} />}</span>
              {s}
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={!valid}>
            Create my workspace
          </Button>
          <span className="text-[13px] text-ink-500">Fourteen days with every module. No card required.</span>
        </div>
      )}
    </form>
  );
}
