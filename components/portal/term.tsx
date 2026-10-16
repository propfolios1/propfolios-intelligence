"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GLOSSARY, type GlossaryKey } from "@/lib/client/glossary";
import { cn } from "@/lib/utils";

/**
 * A financial term with its definition one tap away: a dotted underline on
 * the term, and a card with the plain meaning and how it is calculated.
 * A popover rather than a hover tooltip, so it works on a phone.
 */
export function Term({ k, children, className }: { k: GlossaryKey; children?: React.ReactNode; className?: string }) {
  const g = GLOSSARY[k];
  return (
    <Popover>
      <PopoverTrigger className={cn("cursor-help rounded-xs underline decoration-current/35 decoration-dotted underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-current", className)} aria-label={`What is ${g.term}?`}>
        {children ?? g.term}
      </PopoverTrigger>
      <PopoverContent className="w-[300px]" align="start">
        <div className="text-meta font-semibold text-ink-900">{g.term}</div>
        <p className="mt-1 text-small text-ink-900">{g.plain}</p>
        <p className="mt-2 text-meta text-ink-500">{g.how}</p>
      </PopoverContent>
    </Popover>
  );
}
