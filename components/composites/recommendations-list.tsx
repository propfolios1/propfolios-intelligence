"use client";

import { RelativeTime } from "@/components/ui/relative-time";
import Link from "next/link";
import * as React from "react";
import { toast } from "@/components/ui/toaster";
import { REC_TYPE_LABEL } from "@/lib/domain";
import { EmptyState } from "./empty-state";

export interface RecommendationView {
  id: string;
  type: string;
  title: string;
  message: string;
  rationale: string[];
  priority: number;
  createdAt: string;
  propertyName: string | null;
  clientName?: string;
}

/**
 * A numbered briefing. "Discuss with my advisor" actions the item and opens a
 * thread; "Dismiss" removes it. Both update optimistically.
 */
export function RecommendationsList({ items, assistantHref = "/client/assistant", clientView = true }: { items: RecommendationView[]; assistantHref?: string; clientView?: boolean }) {
  const [hidden, setHidden] = React.useState<string[]>([]);
  const shown = items.filter((i) => !hidden.includes(i.id));

  async function act(id: string, status: "dismissed" | "actioned") {
    setHidden((h) => [...h, id]);
    const res = await fetch("/api/recommendations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (!res.ok) {
      setHidden((h) => h.filter((x) => x !== id));
      return void toast.error("Not updated. Retry.");
    }
    toast.success(status === "actioned" ? "Your advisor has been notified" : "Recommendation dismissed", {
      action: { label: "Undo", onClick: () => void fetch("/api/recommendations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status: "open" }) }).then(() => setHidden((h) => h.filter((x) => x !== id))) },
    });
  }

  if (!shown.length) return <EmptyState glyph="opportunities" headline="No open recommendations" note="New recommendations appear when your advisory team or the recommender agent identifies an action." primary={{ label: "View portfolio", href: "/client/portfolio" }} secondary={{ label: "View opportunities", href: "/client/opportunities" }} />;
  return (
    <ol className="mt-6 flex max-w-[900px] flex-col gap-4">
      {shown.map((r, i) => (
        <li key={r.id} className="grid grid-cols-[40px_1fr] gap-x-5 rounded-md border border-hairline bg-surface p-6 shadow-card md:grid-cols-[48px_1fr_100px]">
          <span className="num pt-1 text-small text-ink-500">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <div className="eyebrow">
              {REC_TYPE_LABEL[r.type] ?? r.type}
              {r.clientName && ` · ${r.clientName}`}
            </div>
            <h2 className="mt-2 font-display text-read text-navy-900">{r.title}</h2>
            <p className="mt-2 text-body text-ink-700">{r.message}</p>
            {r.rationale.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1">
                {r.rationale.map((x) => (
                  <li key={x} className="text-small text-ink-500">
                    <span className="mr-2 text-gold-600">—</span>
                    {x}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-small">
              {clientView && (
                <button onClick={() => act(r.id, "actioned")} className="font-medium text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
                  Discuss with my advisor
                </button>
              )}
              <Link href={`${assistantHref}?q=${encodeURIComponent(`Explain: ${r.title}`)}`} className="text-ink-700 hover:text-ink-900">
                Ask the assistant
              </Link>
              <button onClick={() => act(r.id, "dismissed")} className="text-ink-700 hover:text-ink-900">
                Dismiss
              </button>
            </div>
          </div>
          <span className="num hidden pt-1 text-right text-small text-ink-500 md:block"><RelativeTime iso={r.createdAt} /></span>
        </li>
      ))}
    </ol>
  );
}
