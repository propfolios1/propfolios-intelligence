"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

type Input = { path: string; label: string; type: "text" | "number" | "date" | "boolean"; default?: string | number | boolean };
type Preview = { error: string | null; html: string; missing: string[]; variables: string[] };

function usePreview(body: string, dealId: string | null, values: Record<string, unknown>) {
  const [p, setP] = React.useState<Preview | null>(null);
  const key = JSON.stringify([body, dealId, values]);
  React.useEffect(() => {
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      const res = await fetch("/api/contracts/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body, dealId, values }), signal: ctl.signal }).catch(() => null);
      if (res?.ok) setP(await res.json());
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return p;
}

export function ContractHtml({ html, className }: { html: string; className?: string }) {
  return <div className={cn("prose-pf text-small", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

function InputsForm({ inputs, values, onChange }: { inputs: Input[]; values: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  if (!inputs.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {inputs.map((i) =>
        i.type === "boolean" ? (
          <label key={i.path} className="flex items-center gap-2 pt-6 text-ui text-ink-700">
            <Checkbox checked={Boolean(values[i.path] ?? i.default)} onCheckedChange={(v) => onChange({ ...values, [i.path]: Boolean(v) })} /> {i.label}
          </label>
        ) : (
          <FormField key={i.path} label={i.label}>
            <Input type={i.type === "number" ? "number" : i.type === "date" ? "date" : "text"} className={i.type === "number" ? "num" : undefined} value={String(values[i.path] ?? i.default ?? "")} onChange={(e) => onChange({ ...values, [i.path]: i.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value })} />
          </FormField>
        ),
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- editor */

export function TemplateEditor({ t, deals, readOnly }: { t: { id: string; name: string; description: string; body: string; inputs: Input[]; status: string; version: number; officialNote: string }; deals: { id: string; label: string }[]; readOnly: boolean }) {
  const router = useRouter();
  const [name, setName] = React.useState(t.name);
  const [body, setBody] = React.useState(t.body);
  const [inputs, setInputs] = React.useState<Input[]>(t.inputs);
  const [dealId, setDealId] = React.useState<string>(deals[0]?.id ?? "");
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [note, setNote] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const preview = usePreview(body, dealId || null, { ...Object.fromEntries(inputs.filter((i) => i.default !== undefined).map((i) => [i.path, i.default])), ...values });
  const dirty = name !== t.name || body !== t.body || JSON.stringify(inputs) !== JSON.stringify(t.inputs);
  const save = async () => {
    setBusy(true);
    const r = await post(`/api/contracts/templates/${t.id}`, { name, body, inputs }, { method: "PATCH", fail: "Not saved" });
    setBusy(false);
    if (r) {
      toast.success(t.status === "draft" ? "Draft saved" : `Draft version ${r.template.version} opened`, { description: t.status === "draft" ? undefined : "The published version stays in use until you publish this one." });
      if (r.template.id !== t.id) router.push(`/admin/contracts/templates/${r.template.id}`);
      else router.refresh();
    }
  };
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="grid content-start gap-4">
        <FormField label="Name">
          <Input value={name} disabled={readOnly} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Template" hint="{{buyer.name}} inserts a value; {{price | money}} formats it; {{#if buyer.isNri}} ... {{/if}} adds a clause on a condition; {{#each conditions}} ... {{/each}} repeats.">
          <Textarea rows={26} spellCheck={false} disabled={readOnly} className="num text-[12.5px] leading-[1.55]" value={body} onChange={(e) => setBody(e.target.value)} />
        </FormField>
        <div className="grid gap-2">
          <div className="label-caps">Values entered when drafting</div>
          {inputs.map((i, k) => (
            <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_110px_minmax(0,1fr)_28px] items-center gap-2">
              <Input className="num h-9" value={i.path} disabled={readOnly} onChange={(e) => setInputs(inputs.map((x, j) => (j === k ? { ...x, path: e.target.value } : x)))} aria-label="Variable" />
              <Input className="h-9" value={i.label} disabled={readOnly} onChange={(e) => setInputs(inputs.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)))} aria-label="Label" />
              <Select className="h-9" value={i.type} disabled={readOnly} onChange={(e) => setInputs(inputs.map((x, j) => (j === k ? { ...x, type: e.target.value as Input["type"] } : x)))} aria-label="Type">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="boolean">Yes or no</option>
              </Select>
              <Input className="h-9" value={String(i.default ?? "")} disabled={readOnly} placeholder="Default" onChange={(e) => setInputs(inputs.map((x, j) => (j === k ? { ...x, default: x.type === "number" ? Number(e.target.value) : x.type === "boolean" ? e.target.value === "true" : e.target.value } : x)))} aria-label="Default" />
              <button type="button" disabled={readOnly} className="text-ink-400 hover:text-ink-900" aria-label="Remove" onClick={() => setInputs(inputs.filter((_, j) => j !== k))}>
                ×
              </button>
            </div>
          ))}
          {!readOnly && (
            <div>
              <Button size="sm" variant="ghost" onClick={() => setInputs([...inputs, { path: "custom.value", label: "Value", type: "text" }])}>
                Add an entered value
              </Button>
            </div>
          )}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy || !dirty || !!preview?.error} onClick={save}>
              {t.status === "draft" ? "Save draft" : "Edit as a new version"}
            </Button>
            {t.status === "draft" && (
              <Button disabled={busy || dirty || !!preview?.error} onClick={() => setOpen(true)}>
                Publish version {t.version}
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="grid content-start gap-3 xl:sticky xl:top-20">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <FormField label="Preview against">
            <Select value={dealId} onChange={(e) => setDealId(e.target.value)}>
              <option value="">The firm&apos;s values only</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <InputsForm inputs={inputs} values={values} onChange={setValues} />
        {preview?.error ? (
          <p className="rounded-md border border-danger/40 bg-surface p-4 text-ui text-danger">{preview.error}</p>
        ) : (
          <>
            {preview && preview.missing.length > 0 && <p className="text-[12px] text-warning">Not yet filled: {preview.missing.join(", ")}</p>}
            <div className="max-h-[78vh] overflow-y-auto rounded-md border border-hairline bg-surface p-8">{preview ? <ContractHtml html={preview.html} /> : <div className="h-40 animate-pulse rounded-sm bg-ink-100" />}</div>
          </>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogTitle>Publish version {t.version}</DialogTitle>
          <DialogDescription>New contracts are drafted from this version. Contracts already drafted keep the version they were drafted from.</DialogDescription>
          <FormField label="What changed" className="mt-4">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Updated the default clause to the 2026 DLD fee schedule; reviewed by counsel." />
          </FormField>
          <div className="mt-5">
            <Button
              disabled={note.trim().length < 5}
              onClick={async () => {
                const r = await post(`/api/contracts/templates/${t.id}`, { note }, { fail: "Not published", ok: `Version ${t.version} published` });
                if (r) {
                  setOpen(false);
                  router.refresh();
                }
              }}
            >
              Publish
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NewTemplate({ templates }: { templates: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ name: "", jurisdiction: "AE", fromId: "" });
  return (
    <>
      <Button onClick={() => setOpen(true)}>New template</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[520px]">
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>Start blank or from one of the firm&apos;s templates. It opens as a draft.</DialogDescription>
          <div className="mt-4 grid gap-4">
            <FormField label="Name">
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Tenancy contract addendum" />
            </FormField>
            <FormField label="Jurisdiction">
              <Select value={f.jurisdiction} onChange={(e) => setF({ ...f, jurisdiction: e.target.value })}>
                <option value="AE">United Arab Emirates</option>
                <option value="IN">India</option>
                <option value="GB">United Kingdom</option>
                <option value="SG">Singapore</option>
                <option value="ANY">Any jurisdiction</option>
              </Select>
            </FormField>
            <FormField label="Start from">
              <Select value={f.fromId} onChange={(e) => setF({ ...f, fromId: e.target.value })}>
                <option value="">A blank agreement</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <div>
              <Button
                disabled={f.name.trim().length < 3}
                onClick={async () => {
                  const r = await post("/api/contracts/templates", { ...f, fromId: f.fromId || null }, { fail: "Not created" });
                  if (r) router.push(`/admin/contracts/templates/${r.template.id}`);
                }}
              >
                Create draft
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function FirmVariables({ variables }: { variables: { path: string; label: string; value: string }[] }) {
  const router = useRouter();
  const SUGGESTED = [
    { path: "firm.orn", label: "Office registration number (RERA ORN)" },
    { path: "firm.licence", label: "Trade or agency licence number" },
    { path: "firm.address", label: "Registered address" },
    { path: "agent.brn", label: "Default broker registration number" },
  ];
  const rows = [...variables, ...SUGGESTED.filter((s) => !variables.some((v) => v.path === s.path)).map((s) => ({ ...s, value: "" }))];
  const [vals, setVals] = React.useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.path, r.value])));
  const [extra, setExtra] = React.useState({ path: "", label: "", value: "" });
  const save = async (path: string, label: string, value: string) => {
    const r = await post("/api/contracts/variables", { path, label, value }, { method: "PUT", fail: "Not saved", ok: `${label} saved` });
    if (r) router.refresh();
  };
  return (
    <div className="grid gap-2">
      {rows.map((r) => (
        <div key={r.path} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="text-ui">
            <div className="text-ink-900">{r.label}</div>
            <div className="num text-[12px] text-ink-500">{`{{${r.path}}}`}</div>
          </div>
          <Input className="h-9" value={vals[r.path] ?? ""} onChange={(e) => setVals({ ...vals, [r.path]: e.target.value })} aria-label={r.label} />
          <Button size="sm" variant="secondary" disabled={(vals[r.path] ?? "") === r.value} onClick={() => save(r.path, r.label, vals[r.path] ?? "")}>
            Save
          </Button>
        </div>
      ))}
      <div className="mt-2 grid items-end gap-2 border-t border-hairline pt-3 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Input className="num h-9" value={extra.path} placeholder="firm.vatNumber" onChange={(e) => setExtra({ ...extra, path: e.target.value })} aria-label="New variable name" />
        <Input className="h-9" value={extra.label} placeholder="Label" onChange={(e) => setExtra({ ...extra, label: e.target.value })} aria-label="New variable label" />
        <Input className="h-9" value={extra.value} placeholder="Value" onChange={(e) => setExtra({ ...extra, value: e.target.value })} aria-label="New variable value" />
        <Button size="sm" variant="secondary" disabled={!extra.path || extra.label.length < 2} onClick={() => save(extra.path, extra.label, extra.value).then(() => setExtra({ path: "", label: "", value: "" }))}>
          Add
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- deal */

export function DraftFromTemplate({ dealId, templates }: { dealId: string; templates: { id: string; publishedId: string | null; name: string; jurisdiction: string; inputs: Input[]; body: string }[] }) {
  const router = useRouter();
  const usable = templates.filter((t) => t.publishedId);
  const [id, setId] = React.useState(usable[0]?.publishedId ?? "");
  const t = usable.find((x) => x.publishedId === id);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [busy, setBusy] = React.useState(false);
  const preview = usePreview(t?.body ?? "", dealId, { ...Object.fromEntries((t?.inputs ?? []).filter((i) => i.default !== undefined).map((i) => [i.path, i.default])), ...values });
  return (
    <div className="grid gap-4">
      <FormField label="Template">
        <Select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setValues({});
          }}
        >
          {usable.map((x) => (
            <option key={x.publishedId!} value={x.publishedId!}>
              {x.name} ({x.jurisdiction})
            </option>
          ))}
        </Select>
      </FormField>
      {t && <InputsForm inputs={t.inputs} values={values} onChange={setValues} />}
      {preview && !preview.error && (
        <>
          {preview.missing.length > 0 && <p className="text-[12px] text-warning">To complete before signature: {preview.missing.join(", ")}. Add them above or as firm variables.</p>}
          <details className="rounded-md border border-hairline bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-ui text-ink-900">Preview</summary>
            <div className="max-h-[60vh] overflow-y-auto border-t border-hairline p-6">
              <ContractHtml html={preview.html} />
            </div>
          </details>
        </>
      )}
      <div>
        <Button
          disabled={busy || !t}
          onClick={async () => {
            setBusy(true);
            const r = await post(`/api/deals/${dealId}/contract-template`, { templateId: id, values }, { fail: "Not drafted" });
            setBusy(false);
            if (r) {
              toast.success(`Drafted version ${r.contract.version}`, { description: r.missing.length ? `${r.missing.length} values still to complete before signature.` : "Ready to send for signature." });
              router.refresh();
            }
          }}
        >
          {busy ? "Drafting" : "Draft contract"}
        </Button>
      </div>
    </div>
  );
}
