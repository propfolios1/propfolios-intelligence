"use client";

import { toast } from "@/components/ui/toaster";

/** JSON request with toast on failure; returns the parsed body or null. */
export async function post(url: string, body: unknown, opts: { method?: string; ok?: string; fail?: string } = {}) {
  const res = await fetch(url, { method: opts.method ?? "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast.error(opts.fail ?? "Not completed", { description: json.error ?? (json.issues ? "Check the highlighted fields." : undefined) });
    return null;
  }
  if (opts.ok) toast.success(opts.ok);
  return json;
}
