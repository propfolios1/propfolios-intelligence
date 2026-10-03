"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatDate } from "@/lib/utils";

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdBy: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** Issue and revoke keys for the MCP server. A new key's secret is shown once. */
export function ApiKeysManager({ keys }: { keys: ApiKeyRow[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [secret, setSecret] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/api-keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Key not created", { description: json.error });
    setSecret(json.key);
    setName("");
    router.refresh();
  }
  async function revoke(id: string) {
    const res = await fetch(`/api/admin/api-keys?id=${id}`, { method: "DELETE" });
    if (!res.ok) return void toast.error("Key not revoked", { description: "The key still works. Retry, or remove it from the integration first if the request timed out." });
    router.refresh();
  }
  return (
    <div>
      <form onSubmit={create} className="flex max-w-lg gap-2">
        <Input aria-label="Key name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, for example Portfolio reporting" />
        <Button type="submit" disabled={busy || name.trim().length < 2}>
          Create key
        </Button>
      </form>
      {secret && (
        <div className="mt-4 rounded-md border border-hairline border-l-2 border-l-gold-500 bg-surface p-4">
          <p className="text-small font-medium text-ink-900">Copy this key now. It is not shown again.</p>
          <div className="mt-2 flex items-center gap-2 rounded-sm bg-surface px-3 py-2 shadow-card">
            <code className="num min-w-0 flex-1 truncate text-small text-ink-900">{secret}</code>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Copy key"
              onClick={() => {
                void navigator.clipboard.writeText(secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      )}
      <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
        {keys.length === 0 && <li className="py-4 text-small text-ink-500">No keys yet.</li>}
        {keys.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <div className="text-ui text-ink-900">{k.name}</div>
              <div className="text-small text-ink-500">
                <code className="num">{k.prefix}…</code> · created by {k.createdBy} on {formatDate(k.createdAt)} · {k.lastUsedAt ? (
                  <>
                    last used <RelativeTime iso={k.lastUsedAt} />
                  </>
                ) : (
                  "never used"
                )}
              </div>
            </div>
            {k.revokedAt ? (
              <StatusPill>Revoked</StatusPill>
            ) : (
              <Button size="sm" variant="destructive" onClick={() => void revoke(k.id)}>
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
