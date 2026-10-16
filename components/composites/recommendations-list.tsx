"use client";

import { Photo } from "@/components/media/photo";
import { RelativeTime } from "@/components/ui/relative-time";
import type { PhotoBundle } from "@/lib/media/unsplash";
import { cn } from "@/lib/utils";
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
  /** Client portal: the property's photograph, when the recommendation concerns one. */
  visual?: { seed: string; place: string; ownSrc: string | null; media: PhotoBundle } | null;
}

/** Client portal hue per recommendation type. */
const TYPE_TONE: Record<string, string> = {
  exit_window: "bg-sun-100 text-sun-700",
  new_opportunity: "bg-sea-100 text-sea-700",
  rebalance: "bg-iris-100 text-iris-700",
  refinance: "bg-sky-100 text-sky-700",
  risk: "bg-coral-100 text-coral-700",
};

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
    <ol className={cn("mt-6 flex flex-col gap-4", clientView ? "max-w-[1040px]" : "max-w-[900px]")}>
      {shown.map((r, i) =>
        clientView ? (
          <li key={r.id} className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface md:flex-row">
            {r.visual && (
              <Photo seed={r.visual.seed} scene={r.visual.media.scene} photo={r.visual.media.photo} ownSrc={r.visual.ownSrc} alt={`${r.propertyName ?? r.title}, ${r.visual.place}`} className="aspect-[16/9] shrink-0 md:aspect-auto md:w-[260px]" sizes="(min-width: 768px) 260px, 100vw" />
            )}
            <div className="flex-1 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] leading-none font-medium", TYPE_TONE[r.type] ?? "bg-ink-100 text-ink-700")}>{REC_TYPE_LABEL[r.type] ?? r.type}</span>
                {r.priority <= 1 && <span className="rounded-full bg-coral-500 px-2.5 py-1 text-[11px] leading-none font-medium text-white">Priority</span>}
                <span className="num ms-auto text-axis text-ink-400">
                  <RelativeTime iso={r.createdAt} />
                </span>
              </div>
              <h2 className="mt-3 text-card font-semibold text-ink-900">{r.title}</h2>
              {r.visual && <p className="mt-0.5 text-meta text-ink-500">{r.visual.place}</p>}
              <p className="mt-3 text-ui text-ink-700">{r.message}</p>
              {r.rationale.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {r.rationale.map((x) => (
                    <li key={x} className="flex gap-2 text-meta text-ink-500">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sea-500" aria-hidden />
                      {x}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button onClick={() => act(r.id, "actioned")} className="h-9 rounded-full bg-sea-600 px-4 text-meta font-medium text-white transition-[background-color] duration-150 hover:bg-sea-700">
                  Discuss with my adviser
                </button>
                <Link href={`${assistantHref}?q=${encodeURIComponent(`Explain: ${r.title}`)}`} className="inline-flex h-9 items-center rounded-full border border-hairline px-4 text-meta font-medium text-ink-700 transition-[border-color,color] duration-150 hover:border-ink-300 hover:text-ink-900">
                  Ask the assistant
                </Link>
                <button onClick={() => act(r.id, "dismissed")} className="h-9 px-3 text-meta text-ink-500 transition-colors duration-150 hover:text-ink-900">
                  Not now
                </button>
              </div>
            </div>
          </li>
        ) : (
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
        ),
      )}
    </ol>
  );
}
