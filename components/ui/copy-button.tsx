"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Copy with a receipt: a 12px gold dot pulses where you clicked, and a small
 * "Copied" fades in beneath, gone after 1.2s.
 */
export function CopyButton({ value, children, className, label = "Copy" }: { value: string; children?: React.ReactNode; className?: string; label?: string }) {
  const [pulse, setPulse] = React.useState<{ x: number; y: number; key: number } | null>(null);
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPulse({ x: e.clientX - r.left, y: e.clientY - r.top, key: Date.now() });
          navigator.clipboard.writeText(value);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1200);
        }}
        className={cn("relative inline-flex items-center gap-2 text-small text-ink-700 transition-[color] duration-120 hover:text-ink-900", className)}
        aria-label={children ? undefined : label}
      >
        {children ?? label}
        {pulse && (
          <span
            key={pulse.key}
            aria-hidden
            className="pointer-events-none absolute size-3 animate-receipt rounded-full bg-gold-500"
            style={{ left: pulse.x, top: pulse.y }}
          />
        )}
      </button>
      <span
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute top-full left-0 mt-1 text-eyebrow tracking-[0.08em] text-ink-500 uppercase transition-opacity",
          copied ? "opacity-100 duration-120" : "opacity-0 duration-300",
        )}
      >
        {copied ? "Copied" : ""}
      </span>
    </span>
  );
}
