"use client";

import Link from "next/link";
import * as React from "react";
import type { ClientRecommendation } from "@/lib/data/types";
import { relativeTime } from "@/lib/utils";
import { EmptyState } from "./empty-state";

/**
 * Set like a briefing: numbered, a type label, the recommendation in serif,
 * two quiet actions. Dismissed items leave the list.
 */
export function RecommendationsList({ items }: { items: (ClientRecommendation & { propertyName?: string })[] }) {
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const shown = items.filter((i) => !dismissed.includes(i.id));
  if (!shown.length) return <EmptyState className="mt-8" glyph="opportunities" headline="No open recommendations." />;
  return (
    <ol className="mt-4 max-w-[880px]">
      {shown.map((r, i) => (
        <li key={r.id} className="grid grid-cols-[48px_1fr] gap-x-6 border-b border-ink-200 py-10 md:grid-cols-[64px_1fr_120px]">
          <span className="num pt-1 text-small text-ink-500">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <div className="eyebrow">{r.type}</div>
            <p className="mt-3 font-display text-card leading-[1.35] text-navy-900 md:text-[1.625rem]">{r.message}</p>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-small">
              {r.propertyId && (
                <Link href={`/client/opportunities#${r.propertyId}`} className="font-medium text-ink-900 underline decoration-ink-200 underline-offset-4 transition-[text-decoration-color] duration-120 hover:decoration-ink-900">
                  View property
                </Link>
              )}
              <Link href={`/client/assistant?q=${encodeURIComponent(r.message)}`} className="text-ink-700 transition-[color] duration-120 hover:text-ink-900">
                Ask about this
              </Link>
              <button onClick={() => setDismissed((d) => [...d, r.id])} className="text-ink-700 transition-[color] duration-120 hover:text-ink-900">
                Dismiss
              </button>
            </div>
          </div>
          <span className="num hidden pt-1 text-right text-small text-ink-500 md:block">{relativeTime(r.at)}</span>
        </li>
      ))}
    </ol>
  );
}
