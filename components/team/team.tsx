"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/form";

export function PeriodPicker({ periods, value, base }: { periods: string[]; value: string; base: string }) {
  const router = useRouter();
  const label = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <Select className="h-9 w-48" value={value} onChange={(e) => router.push(`${base}?period=${e.target.value}`)} aria-label="Period">
      {periods.map((p) => (
        <option key={p} value={p}>
          {label(p)}
        </option>
      ))}
    </Select>
  );
}

export function Recompute({ period }: { period: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await post("/api/team/refresh", { period }, { fail: "Not recomputed", ok: "Recomputed from the records" });
        setBusy(false);
        if (r) router.refresh();
      }}
    >
      {busy ? "Recomputing" : "Recompute"}
    </Button>
  );
}

export function CoachingNote({ userId, period, flags }: { userId: string; period: string; flags: { key: string; title: string }[] }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [flag, setFlag] = React.useState("");
  return (
    <div className="grid gap-2">
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="What was agreed, and by when." aria-label="Coaching note" />
      <div className="flex flex-wrap gap-2">
        {flags.length > 0 && (
          <Select className="h-9 w-56" value={flag} onChange={(e) => setFlag(e.target.value)} aria-label="About">
            <option value="">General</option>
            {flags.map((f) => (
              <option key={f.key} value={f.key}>
                {f.title}
              </option>
            ))}
          </Select>
        )}
        <Button
          size="sm"
          disabled={text.trim().length < 5}
          onClick={async () => {
            const r = await post("/api/team/notes", { userId, period, text, flag: flag || null }, { fail: "Not saved", ok: "Note recorded" });
            if (r) {
              setText("");
              router.refresh();
            }
          }}
        >
          Record note
        </Button>
      </div>
    </div>
  );
}
