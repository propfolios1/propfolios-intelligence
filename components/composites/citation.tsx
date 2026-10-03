"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface CitationSource {
  id: number;
  title: string;
  source?: string;
  detail?: string;
  date?: string;
  href?: string;
}

/** A gold 12px mono superscript. Hover, focus or a click opens the source in a 320px popover. */
export function CitationPill({ n, source }: { n: number; source?: CitationSource }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="num relative -top-[0.5em] mx-px inline align-baseline text-axis leading-none text-gold-600 transition-colors duration-150 hover:text-navy-900"
          aria-label={`Source ${n}${source ? `: ${source.title}` : ""}`}
        >
          {n}
        </button>
      </PopoverTrigger>
      {source && (
        <PopoverContent side="top" align="center" className="w-[320px]" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="label-caps">{source.source ?? "Source"}</span>
            {source.date && <span className="num text-axis text-ink-500">{source.date}</span>}
          </div>
          <p className="mt-2 text-small font-medium text-ink-900">{source.title}</p>
          {source.detail && <p className="mt-1 text-small text-ink-700">{source.detail}</p>}
          {source.href && (
            <a href={source.href} className="mt-2 inline-block text-small text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
              Open
            </a>
          )}
        </PopoverContent>
      )}
    </Popover>
  );
}

/** Renders text with [n] markers as citation superscripts. */
export function CitedText({ text, sources }: { text: string; sources: CitationSource[] }) {
  const parts = text.split(/(\s?\[\d+(?:,\s*\d+)*\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\s?\[(\d+(?:,\s*\d+)*)\]$/);
        if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
        return m[1]!.split(/,\s*/).map((n) => <CitationPill key={`${i}-${n}`} n={Number(n)} source={sources.find((s) => s.id === Number(n))} />);
      })}
    </>
  );
}
