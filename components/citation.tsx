"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";

export interface CitationSource {
  id: number;
  title: string;
  source?: string;
  detail?: string;
  date?: string;
}

/** Numbered citation pill that expands on hover/focus to show its source. */
export function CitationPill({ n, source }: { n: number; source?: CitationSource }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={cn(
            "num mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded-full bg-navy-100 px-1 align-middle text-[10px] leading-none text-navy-800 transition-colors hover:bg-navy-200",
          )}
          aria-label={`Citation ${n}`}
        >
          {n}
        </button>
      </PopoverTrigger>
      {source && (
        <PopoverContent side="top" align="center" className="w-72 p-3" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
          <div className="eyebrow">{source.source ?? `Source ${n}`}</div>
          <div className="mt-1 text-sm font-medium text-ink-900">{source.title}</div>
          {source.detail && <div className="mt-1 text-xs text-ink-600">{source.detail}</div>}
          {source.date && <div className="num mt-2 text-[11px] text-ink-400">{source.date}</div>}
        </PopoverContent>
      )}
    </Popover>
  );
}

/** Renders text containing [n] markers with inline citation pills. */
export function CitedText({ text, sources }: { text: string; sources: CitationSource[] }) {
  const parts = text.split(/(\[\d+(?:,\s*\d+)*\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
        if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
        return m[1]!.split(/,\s*/).map((n) => <CitationPill key={`${i}-${n}`} n={Number(n)} source={sources.find((s) => s.id === Number(n))} />);
      })}
    </>
  );
}
