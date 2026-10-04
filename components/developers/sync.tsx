"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";

type Run = { ok: boolean; units: number; added: number; priceChanges: number; statusChanges: number; removed: number; error: string | null };
const summary = (r: Run) => (r.ok ? `${r.units} units: ${r.added} new, ${r.priceChanges} price changes, ${r.statusChanges} status changes, ${r.removed} withdrawn.` : (r.error ?? "Sync failed."));

export function ConnectDeveloper({ developerKey, current }: { developerKey: string; current: { mode: string; url: string | null; format: string | null } | null }) {
  const router = useRouter();
  const [f, setF] = React.useState({ mode: current?.mode ?? "sandbox", url: current?.url ?? "", format: current?.format ?? "csv", authHeader: "", unitRef: "", price: "", status: "" });
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Source">
          <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
            <option value="feed_url">Feed URL (CSV, JSON or XML)</option>
            <option value="json_api">Authenticated JSON endpoint</option>
            <option value="upload">Uploaded price list</option>
            <option value="sandbox">Sandbox inventory, for rehearsal</option>
          </Select>
        </FormField>
        {(f.mode === "feed_url" || f.mode === "json_api") && (
          <>
            <FormField label="Address" className="sm:col-span-2">
              <Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" />
            </FormField>
            {f.mode === "feed_url" && (
              <FormField label="Format">
                <Select value={f.format} onChange={(e) => setF({ ...f, format: e.target.value })}>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="xml">XML</option>
                </Select>
              </FormField>
            )}
            <FormField label="Authorization header" className="sm:col-span-2" hint="Stored encrypted. For example: Bearer followed by the token the developer issued.">
              <Input value={f.authHeader} onChange={(e) => setF({ ...f, authHeader: e.target.value })} placeholder={current ? "Unchanged unless entered" : "Optional"} />
            </FormField>
          </>
        )}
      </div>
      {f.mode !== "sandbox" && (
        <details className="text-ui">
          <summary className="cursor-pointer text-ink-700">Column names, if the feed uses unusual ones</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <FormField label="Unit number column">
              <Input value={f.unitRef} onChange={(e) => setF({ ...f, unitRef: e.target.value })} placeholder="Detected automatically" />
            </FormField>
            <FormField label="Price column">
              <Input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="Detected automatically" />
            </FormField>
            <FormField label="Status column">
              <Input value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} placeholder="Detected automatically" />
            </FormField>
          </div>
        </details>
      )}
      <div>
        <Button
          disabled={busy || ((f.mode === "feed_url" || f.mode === "json_api") && !f.url)}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/developers/connections", { developerKey, mode: f.mode, url: f.url || null, format: f.mode === "feed_url" ? f.format : null, authHeader: f.authHeader || null, mapping: { unitRef: f.unitRef || undefined, price: f.price || undefined, status: f.status || undefined } }, { fail: "Not connected" });
            setBusy(false);
            if (r) {
              if (r.run) (r.run.ok ? toast.success : toast.error)(r.run.ok ? "Connected and synced" : "Connected, but the first sync failed", { description: summary(r.run) });
              else toast.success("Connected", { description: "Upload the latest price list to load the inventory." });
              router.refresh();
            }
          }}
        >
          {busy ? "Connecting" : current ? "Save and sync" : "Connect"}
        </Button>
      </div>
    </div>
  );
}

export function SyncNow({ connectionId, upload }: { connectionId: string; upload: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const run = async (file?: File) => {
    setBusy(true);
    let res: Response;
    if (file) {
      const fd = new FormData();
      fd.set("file", file);
      res = await fetch(`/api/developers/connections/${connectionId}/sync`, { method: "POST", body: fd });
    } else res = await fetch(`/api/developers/connections/${connectionId}/sync`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (j.run) (j.run.ok ? toast.success : toast.error)(j.run.ok ? "Synced" : "Sync failed", { description: summary(j.run) });
    else toast.error("Sync failed", { description: j.error });
    router.refresh();
  };
  return upload ? (
    <>
      <input ref={input} type="file" accept=".csv,.json,.xml,.txt" className="sr-only" onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
      <Button disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Reading" : "Upload price list"}
      </Button>
    </>
  ) : (
    <Button variant="secondary" disabled={busy} onClick={() => run()}>
      {busy ? "Syncing" : "Sync now"}
    </Button>
  );
}

export function SyncAll() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await post("/api/developers/sync", {}, { fail: "Not synced" });
        setBusy(false);
        if (r) {
          toast.success(`${r.ok} of ${r.connections} synced`, { description: r.failed ? `${r.failed} failed; see the history below.` : undefined });
          router.refresh();
        }
      }}
    >
      {busy ? "Syncing" : "Sync every connection"}
    </Button>
  );
}
