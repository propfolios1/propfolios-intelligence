"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";

export type Pref = { category: "deals" | "commissions" | "kyc" | "insights" | "mentions" | "system" | "reports"; label: string; note: string; inApp: boolean; email: boolean; digest: "off" | "daily" | "weekly" };

export function MarkRead({ ids, label = "Mark as read", variant = "ghost" }: { ids: string[] | "all"; label?: string; variant?: "ghost" | "secondary" }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={busy || (Array.isArray(ids) && ids.length === 0)}
      onClick={async () => {
        setBusy(true);
        const r = await post("/api/notifications", { read: ids });
        setBusy(false);
        if (r) router.refresh();
      }}
    >
      {label}
    </Button>
  );
}

/** Per-category channels: in-app, email immediately, or an email digest. */
export function PreferencesForm({ initial }: { initial: Pref[] }) {
  const router = useRouter();
  const [prefs, setPrefs] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const set = (i: number, patch: Partial<Pref>) => setPrefs(prefs.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="rounded-md border border-hairline bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-small">
          <thead className="border-b border-hairline bg-navy-50 text-left">
            <tr>
              {["Category", "In app", "Email", "Delivery"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-axis font-medium tracking-[0.06em] text-ink-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prefs.map((p, i) => (
              <tr key={p.category} className="border-t border-hairline first:border-t-0">
                <td className="px-4 py-3">
                  <div className="text-ink-900">{p.label}</div>
                  <div className="text-axis text-ink-500">{p.note}</div>
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" className="size-4 accent-[var(--navy-900)]" checked={p.inApp} onChange={(e) => set(i, { inApp: e.target.checked })} aria-label={`${p.label} in app`} />
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" className="size-4 accent-[var(--navy-900)]" checked={p.email} onChange={(e) => set(i, { email: e.target.checked })} aria-label={`${p.label} by email`} />
                </td>
                <td className="px-4 py-3">
                  <Select value={p.digest} disabled={!p.email} onChange={(e) => set(i, { digest: e.target.value as Pref["digest"] })} className="w-40" aria-label={`${p.label} delivery`}>
                    <option value="off">Immediately</option>
                    <option value="daily">Daily digest</option>
                    <option value="weekly">Weekly digest</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-hairline px-4 py-3">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await post("/api/notifications", { preferences: prefs.map(({ category, inApp, email, digest }) => ({ category, inApp, email, digest })) }, { ok: "Preferences saved", fail: "Preferences not saved" });
            setBusy(false);
            if (r) router.refresh();
          }}
        >
          {busy ? "Saving" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
