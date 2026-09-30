"use client";

import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { EmptyState } from "./empty-state";
import { Button } from "./ui/button";
import { Pill } from "./ui/pill";
import type { ClientRecommendation } from "@/lib/data/types";
import { relativeTime } from "@/lib/utils";

const TONE = { "Exit window": "positive", "New opportunity": "navy", Risk: "negative", Refinance: "gold", Rebalance: "warning" } as const;

export function RecommendationsList({ items }: { items: (ClientRecommendation & { propertyName?: string })[] }) {
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const shown = items.filter((i) => !dismissed.includes(i.id));
  if (!shown.length) return <EmptyState className="mt-12" icon={Check} headline="You’re all caught up" subtext="New recommendations appear as markets and your portfolio move." />;
  return (
    <ul className="mt-12 max-w-3xl space-y-4">
      {shown.map((r) => (
        <li key={r.id} className="rounded-card border border-ink-200 bg-surface p-6 animate-fade-in">
          <div className="flex items-center justify-between gap-3">
            <Pill tone={TONE[r.type]}>{r.type}</Pill>
            <time className="num text-[11px] text-ink-400">{relativeTime(r.at)}</time>
          </div>
          <p className="mt-4 text-body text-ink-800">{r.message}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {r.propertyId && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/client/opportunities#${r.propertyId}`}>
                  View Property <ArrowRight />
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/client/assistant?q=${encodeURIComponent(r.message)}`}>
                <Sparkles /> Ask assistant
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="ml-auto text-ink-500" onClick={() => setDismissed((d) => [...d, r.id])}>
              <X /> Dismiss
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
