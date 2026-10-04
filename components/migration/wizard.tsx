"use client";

import { Check, CircleAlert, FileUp, Link2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input, Select } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import type { FieldTransform, MigrationTotals } from "@/db/schema-production";
import { valueOptions } from "@/lib/migration/fields";
import { cn } from "@/lib/utils";

type SourceOpt = { key: string; name: string; auth: "oauth2" | "api_key" | "file"; entities: ("leads" | "listings")[]; guide: string; configured: boolean };
type Rule = { sourceField: string; targetField: string; transform: FieldTransform; valueMap?: Record<string, string> };

export type WizardData = {
  job: { id: string; reference: string; source: string; entity: "leads" | "listings"; status: string; account: string | null; connected: boolean; extracted: boolean; fileName: string | null; sourceFields: string[]; totals: MigrationTotals; dryRunTotals: MigrationTotals | null; error: string | null; rollbackUntil: string | null; finishedAt: string | null; defaultMarket: string };
  source: { name: string; auth: "oauth2" | "api_key" | "file"; guide: string; configured: boolean; env: string[] };
  targets: { key: string; label: string; required: boolean; transform: FieldTransform; hint: string | null }[];
  rules: Rule[];
  values: Record<string, { value: string; n: number }[]>;
  preview: { rowNumber: number; ok: boolean; record: Record<string, unknown> | null; errors: string[]; warnings: string[] }[];
  logs: { id: string; level: string; phase: string; rowNumber: number | null; message: string; at: string }[];
  error: string | null;
};

/* ------------------------------------------------------------- new import */

export function NewImport({ sources, markets }: { sources: SourceOpt[]; markets: { code: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState("csv");
  const [entity, setEntity] = React.useState<"leads" | "listings">("leads");
  const [market, setMarket] = React.useState(markets[0]?.code ?? "AE");
  const [busy, setBusy] = React.useState(false);
  const s = sources.find((x) => x.key === source)!;
  const create = async () => {
    setBusy(true);
    const r = await post("/api/migrate/jobs", { source, entity: s.entities.includes(entity) ? entity : "leads", defaultMarket: market }, { fail: "Import not started" });
    setBusy(false);
    if (r) {
      setOpen(false);
      router.push(`/admin/migrate?job=${r.id}`);
    }
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>New import</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[720px]">
          <DialogTitle>New import</DialogTitle>
          <DialogDescription>Choose where the records come from. Nothing is written to your workspace until you have reviewed the mapping and the dry run.</DialogDescription>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Source">
            {sources.map((x) => (
              <button
                key={x.key}
                type="button"
                role="radio"
                aria-checked={source === x.key}
                onClick={() => setSource(x.key)}
                className={cn("flex h-[76px] flex-col items-start justify-between rounded-md border p-3 text-start transition-colors duration-150", source === x.key ? "border-navy-900 bg-navy-50" : "border-hairline hover:border-navy-300")}
              >
                <span className="text-ui font-medium text-ink-900">{x.name}</span>
                <span className="text-[11px] text-ink-500">{x.auth === "file" ? "Upload" : x.auth === "api_key" ? "API key" : x.configured ? "Sign in" : "Sign-in not configured"}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-ui text-ink-700">{s.guide}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <FormField label="Records">
              <Select value={entity} onChange={(e) => setEntity(e.target.value as "leads" | "listings")}>
                <option value="leads">Leads and contacts</option>
                <option value="listings" disabled={!s.entities.includes("listings")}>
                  Listings{s.entities.includes("listings") ? "" : " (not available from this source)"}
                </option>
              </Select>
            </FormField>
            <FormField label="Default market" hint="Used for phone numbers and currency when a record does not name its country.">
              <Select value={market} onChange={(e) => setMarket(e.target.value)}>
                {markets.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy}>
              {busy ? "Starting" : "Start import"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ----------------------------------------------------------------- wizard */

const STEPS = ["Connect", "Map fields", "Dry run", "Load", "Review"] as const;

function stepOf(status: string, extracted: boolean) {
  if (!extracted) return 0;
  if (status === "mapping") return 1;
  if (status === "ready") return 2;
  if (status === "running") return 3;
  return 4;
}

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Import progress">
      {STEPS.map((s, i) => (
        <li key={s} className={cn("flex items-center gap-2 text-ui", i === current ? "text-ink-900" : i < current ? "text-ink-700" : "text-ink-400")} aria-current={i === current ? "step" : undefined}>
          <span className={cn("num flex size-5 items-center justify-center rounded-full border text-[11px]", i < current ? "border-navy-900 bg-navy-900 text-surface" : i === current ? "border-navy-900 text-navy-900" : "border-ink-200")}>{i < current ? <Check className="size-3" /> : i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function Totals({ t, label }: { t: MigrationTotals; label: string }) {
  const cells: [string, number, string][] = [
    ["Records staged", t.staged, "text-ink-900"],
    [label, t.created, "text-success"],
    ["Duplicates skipped", t.skipped, "text-ink-700"],
    ["Rejected", t.failed, t.failed ? "text-danger" : "text-ink-700"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-4">
      {cells.map(([k, v, c]) => (
        <div key={k} className="bg-surface p-4">
          <dt className="label-caps">{k}</dt>
          <dd className={cn("num mt-2 text-[24px] leading-none tabular-nums", c)}>{v.toLocaleString("en-US")}</dd>
        </div>
      ))}
    </dl>
  );
}

const fmt = (v: unknown) => (v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 10) : typeof v === "number" ? v.toLocaleString("en-US") : String(v));

export function MigrationWizard({ data }: { data: WizardData }) {
  const router = useRouter();
  const { job, source } = data;
  const step = stepOf(job.status, job.extracted);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [apiKey, setApiKey] = React.useState("");
  const [rules, setRules] = React.useState<Rule[]>(data.rules);
  const [preview, setPreview] = React.useState(data.preview);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const call = (body: Record<string, unknown>, fail: string) => post(`/api/migrate/jobs/${job.id}`, body, { fail });

  React.useEffect(() => {
    if (data.error) toast.error("Connection not completed", { description: data.error });
  }, [data.error]);
  React.useEffect(() => setRules(data.rules), [data.rules]);
  React.useEffect(() => setPreview(data.preview), [data.preview]);

  /** Repeats a stepwise action until the server reports it done, updating progress as it goes. */
  const loop = async (action: "extract" | "load", label: string) => {
    setBusy(label);
    for (let i = 0; i < 2000; i++) {
      const r = await call({ action }, `${label} stopped`);
      if (!r) break;
      if (action === "load") setProgress(job.totals.staged ? Math.min(100, Math.round(((r.totals.processed as number) / job.totals.staged) * 100)) : 100);
      else setProgress(r.staged as number);
      if (r.done) break;
    }
    setBusy(null);
    setProgress(null);
    router.refresh();
  };

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) return toast.error("File too large", { description: "Files up to 20 MB are accepted; split larger exports." });
    setBusy("Reading file");
    const text = await file.text();
    const r = await call({ action: "upload", fileName: file.name, text }, "File not read");
    setBusy(null);
    if (r) router.refresh();
  };

  const connectKey = async () => {
    setBusy("Connecting");
    const r = await call({ action: "connect", apiKey }, "Not connected");
    setBusy(null);
    setApiKey("");
    if (r) {
      if (r.done) router.refresh();
      else await loop("extract", "Reading records");
    }
  };

  const setRule = (target: string, patch: Partial<Rule> | null) => {
    const t = data.targets.find((x) => x.key === target)!;
    setRules((prev) => {
      const rest = prev.filter((r) => r.targetField !== target);
      if (patch === null) return rest;
      const cur = prev.find((r) => r.targetField === target) ?? { sourceField: "", targetField: target, transform: t.transform };
      return [...rest, { ...cur, ...patch }];
    });
  };

  const saveMapping = async () => {
    setBusy("Saving mapping");
    const res = await fetch(`/api/migrate/jobs/${job.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ rules: rules.filter((r) => r.sourceField) }) });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error("Mapping not saved", { description: j.error });
    setPreview(j.preview.map((p: { rowNumber: number; result: { ok: boolean; record?: Record<string, unknown>; errors?: string[]; warnings: string[] } }) => ({ rowNumber: p.rowNumber, ok: p.result.ok, record: p.result.record ?? null, errors: p.result.errors ?? [], warnings: p.result.warnings })));
    toast.success("Mapping saved", { description: "The preview below reflects it." });
    router.refresh();
  };

  const dry = async () => {
    setBusy("Running dry run");
    const r = await call({ action: "dry_run" }, "Dry run not completed");
    setBusy(null);
    if (r) router.refresh();
  };

  const undo = async () => {
    if (!window.confirm(`Delete the ${job.totals.created.toLocaleString("en-US")} records this import created, including any changes made to them since? This cannot be reversed.`)) return;
    setBusy("Rolling back");
    const r = await call({ action: "rollback" }, "Rollback not completed");
    setBusy(null);
    if (r) {
      toast.success(`${r.deleted.toLocaleString("en-US")} records removed`);
      router.refresh();
    }
  };

  const mapped = new Map(rules.map((r) => [r.targetField, r]));
  const previewCols = data.targets.filter((t) => mapped.get(t.key)?.sourceField).slice(0, 7);
  const rollbackOpen = job.status === "completed" && job.rollbackUntil && new Date(job.rollbackUntil).getTime() > Date.now();

  return (
    <div className="my-8 space-y-8">
      <div className="flex flex-col gap-4 rounded-md border border-hairline bg-surface p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="label-caps">{job.reference}</div>
          <h2 className="mt-1 font-display text-section text-navy-900">
            {source.name}, {job.entity === "listings" ? "listings" : "leads"}
            {job.fileName ? <span className="text-ink-500"> · {job.fileName}</span> : job.account ? <span className="text-ink-500"> · {job.account}</span> : null}
          </h2>
        </div>
        <Steps current={step} />
      </div>

      {job.error && job.status === "failed" && (
        <div role="alert" className="flex gap-3 rounded-md border border-danger/30 bg-danger/5 p-4 text-ui text-ink-900">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            {job.error} <span className="text-ink-500">Reconnect to resume from the last page read.</span>
          </div>
        </div>
      )}

      {step === 0 && (
        <section className="rounded-md border border-hairline bg-surface p-6">
          <h3 className="text-[16px] font-medium text-ink-900">{source.auth === "file" ? "Upload the export" : `Connect ${source.name}`}</h3>
          <p className="mt-2 max-w-[72ch] text-ui text-ink-700">{source.guide}</p>
          {source.auth === "file" && (
            <div
              className="mt-5 flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-ink-200 px-6 py-10 text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) void upload(f);
              }}
            >
              <FileUp className="size-5 text-ink-500" aria-hidden />
              <p className="text-ui text-ink-700">Drop a CSV file here, or choose one. Up to 20 MB and 50,000 rows.</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
                {busy ?? "Choose file"}
              </Button>
            </div>
          )}
          {source.auth === "api_key" && (
            <div className="mt-5 flex max-w-[560px] flex-col gap-3 sm:flex-row sm:items-end">
              <FormField label="API key" className="flex-1">
                <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" placeholder="Paste the key" />
              </FormField>
              <Button onClick={connectKey} disabled={apiKey.length < 8 || Boolean(busy)}>
                {busy ?? "Connect and read"}
              </Button>
            </div>
          )}
          {source.auth === "oauth2" &&
            (source.configured ? (
              job.connected ? (
                <Button className="mt-5" onClick={() => loop("extract", "Reading records")} disabled={Boolean(busy)}>
                  {busy ?? "Read records"}
                </Button>
              ) : (
                <a href={`/api/migrate/oauth/start?job=${job.id}`} className="mt-5 inline-flex h-9 items-center gap-2 rounded-sm bg-navy-900 px-4 text-ui text-surface transition-colors duration-150 hover:bg-navy-800">
                  <Link2 className="size-4" aria-hidden /> Sign in to {source.name}
                </a>
              )
            ) : (
              <p className="mt-5 rounded-md bg-ink-50 p-4 text-ui text-ink-700">
                Sign-in to {source.name} needs an app registered by the platform operator. Set <code className="num">{source.env[0]}</code> and <code className="num">{source.env[1]}</code> in the deployment&apos;s environment variables; until then, export from {source.name} as CSV and use the CSV import.
              </p>
            ))}
          {job.connected && job.source !== "csv" && job.totals.staged > 0 && !job.extracted && (
            <div className="mt-5 flex items-center gap-4">
              <span className="num text-ui text-ink-700">{job.totals.staged.toLocaleString("en-US")} records read so far.</span>
              <Button variant="secondary" onClick={() => loop("extract", "Reading records")} disabled={Boolean(busy)}>
                {busy ?? "Continue reading"}
              </Button>
            </div>
          )}
          {busy && progress !== null && <p className="num mt-4 text-ui text-ink-700">{progress.toLocaleString("en-US")} records read</p>}
        </section>
      )}

      {job.extracted && (
        <section className="rounded-md border border-hairline bg-surface p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-[16px] font-medium text-ink-900">Field mapping</h3>
              <p className="mt-1 max-w-[72ch] text-ui text-ink-700">
                {job.sourceFields.length} source fields and {job.totals.staged.toLocaleString("en-US")} records. Nakhla proposed a mapping from the column names; adjust it, then save to refresh the preview.
              </p>
            </div>
            {step <= 2 && (
              <Button variant="secondary" onClick={saveMapping} disabled={Boolean(busy)}>
                {busy === "Saving mapping" ? busy : "Save mapping"}
              </Button>
            )}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-ui">
              <thead>
                <tr className="h-8 border-b border-hairline text-start">
                  <th className="label-caps text-start">Nakhla field</th>
                  <th className="label-caps px-3 text-start">Source field</th>
                  <th className="label-caps px-3 text-start">Value mapping</th>
                </tr>
              </thead>
              <tbody>
                {data.targets.map((t) => {
                  const r = mapped.get(t.key);
                  const opts = valueOptions(t.key);
                  const vals = r?.sourceField ? data.values[r.sourceField] : undefined;
                  return (
                    <tr key={t.key} className="border-b border-hairline-row align-top">
                      <td className="py-2.5 pe-3">
                        <div className="text-ink-900">
                          {t.label}
                          {t.required && <span className="text-ink-500"> · required</span>}
                        </div>
                        {t.hint && <div className="text-[12px] text-ink-500">{t.hint}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <Select value={r?.sourceField ?? ""} disabled={step > 2} onChange={(e) => (e.target.value ? setRule(t.key, { sourceField: e.target.value }) : setRule(t.key, null))} aria-label={`Source field for ${t.label}`}>
                          <option value="">Not imported</option>
                          {job.sourceFields.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        {t.transform === "value_map" && r?.sourceField ? (
                          vals?.length ? (
                            <div className="grid gap-1.5">
                              {vals.slice(0, 8).map((v) => (
                                <div key={v.value} className="flex items-center gap-2">
                                  <span className="num w-40 truncate text-[12px] text-ink-700" title={v.value}>
                                    {v.value} <span className="text-ink-400">({v.n})</span>
                                  </span>
                                  <Select
                                    className="h-8 flex-1 text-[12px]"
                                    disabled={step > 2}
                                    value={r.valueMap?.[v.value] ?? ""}
                                    onChange={(e) => {
                                      const vm = { ...(r.valueMap ?? {}) };
                                      if (e.target.value) vm[v.value] = e.target.value;
                                      else delete vm[v.value];
                                      setRule(t.key, { valueMap: vm });
                                    }}
                                    aria-label={`Map ${v.value}`}
                                  >
                                    <option value="">Automatic</option>
                                    {opts.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[12px] text-ink-500">Save the mapping to list this field&apos;s values.</span>
                          )
                        ) : (
                          <span className="text-[12px] text-ink-500">{r?.sourceField ? { phone: "International format, with the market's dialling code where missing", number: "Reads 1.2M, 8.6 Cr, 50 L and thousands separators", date: "ISO, day-first or epoch dates", split_list: "Splits on commas and semicolons", titlecase: "Capitalised", lowercase: "Lower case", trim: "Whitespace removed", none: "Unchanged", value_map: "" }[r.transform] : ""}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h4 className="mt-8 text-ui font-medium text-ink-900">Preview of the first {preview.length} records</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[860px] text-ui">
              <thead>
                <tr className="h-8 border-b border-hairline">
                  <th className="label-caps text-start">Row</th>
                  <th className="label-caps px-3 text-start">Result</th>
                  {previewCols.map((c) => (
                    <th key={c.key} className="label-caps px-3 text-start whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.rowNumber} className="h-10 border-b border-hairline-row">
                    <td className="num text-ink-500">{p.rowNumber}</td>
                    <td className="px-3">{p.ok ? <span title={p.warnings.join("; ") || undefined}><StatusPill tone={p.warnings.length ? "progress" : "complete"}>{p.warnings.length ? "With warnings" : "Valid"}</StatusPill></span> : <StatusPill tone="error">Rejected</StatusPill>}</td>
                    {!p.ok && (
                      <td colSpan={Math.max(previewCols.length, 1)} className="px-3 text-ink-500">
                        {p.errors.join(" ")}
                      </td>
                    )}
                    {p.ok && previewCols.map((c) => {
                      const key = { first_name: "name", last_name: "name", location: "locations", budget_max: "budgetMax", budget_min: "budgetMin", property_type: "propertyType", created_at: "createdAt", external_id: "externalId", consent_marketing: "consentMarketing" }[c.key] ?? c.key;
                      return (
                        <td key={c.key} className="max-w-[16rem] truncate px-3 text-ink-700">
                          {fmt(p.record?.[key])}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {job.extracted && step >= 1 && (
        <section className="rounded-md border border-hairline bg-surface p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[16px] font-medium text-ink-900">Dry run and load</h3>
              <p className="mt-1 max-w-[72ch] text-ui text-ink-700">The dry run reads every record through the mapping and checks it against your existing {job.entity}, writing nothing. Loading then runs in batches of 250; leave this page open while it runs.</p>
            </div>
            <div className="flex gap-2">
              {step <= 2 && (
                <Button variant="secondary" onClick={dry} disabled={Boolean(busy)}>
                  {busy === "Running dry run" ? busy : job.dryRunTotals ? "Run again" : "Run dry run"}
                </Button>
              )}
              {(job.status === "ready" || job.status === "running") && (
                <Button onClick={() => loop("load", "Loading")} disabled={Boolean(busy)}>
                  {busy === "Loading" ? "Loading" : job.status === "running" ? "Resume loading" : `Load ${job.dryRunTotals?.created.toLocaleString("en-US") ?? ""} records`}
                </Button>
              )}
              {rollbackOpen && (
                <Button variant="secondary" onClick={undo} disabled={Boolean(busy)}>
                  <RotateCcw className="size-4" aria-hidden /> Roll back
                </Button>
              )}
            </div>
          </div>
          {busy === "Loading" && progress !== null && (
            <div className="mt-5">
              <Progress value={progress} />
              <p className="num mt-2 text-ui text-ink-700">{progress}% processed</p>
            </div>
          )}
          {(job.status === "completed" || job.status === "running" || job.status === "rolled_back") && (
            <div className="mt-5">
              <Totals t={job.totals} label={job.status === "rolled_back" ? "Created, then removed" : "Created"} />
              {job.status === "completed" && job.rollbackUntil && <p className="mt-3 text-ui text-ink-500">{rollbackOpen ? `Rollback is available until ${new Date(job.rollbackUntil).toUTCString().slice(5, 22)} UTC.` : "The rollback window has closed."}</p>}
            </div>
          )}
          {job.dryRunTotals && job.status !== "completed" && job.status !== "rolled_back" && job.status !== "running" && (
            <div className="mt-5">
              <Totals t={job.dryRunTotals} label="Would be created" />
            </div>
          )}
        </section>
      )}

      <section className="rounded-md border border-hairline bg-surface p-6">
        <h3 className="text-[16px] font-medium text-ink-900">Log</h3>
        <ul className="mt-4 max-h-[360px] divide-y divide-hairline-row overflow-y-auto">
          {data.logs.length === 0 && <li className="py-3 text-ui text-ink-500">Nothing logged yet.</li>}
          {data.logs.map((l) => (
            <li key={l.id} className="flex gap-3 py-2.5 text-ui">
              <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", l.level === "error" ? "bg-danger" : l.level === "warning" ? "bg-warning" : "bg-ink-300")} aria-label={l.level} />
              <span className="num w-[132px] shrink-0 text-[12px] text-ink-500">{l.at.slice(0, 16).replace("T", " ")}</span>
              <span className="text-ink-900">
                {l.rowNumber !== null && <span className="num text-ink-500">Row {l.rowNumber}. </span>}
                {l.message}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
