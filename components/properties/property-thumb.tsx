import { cn, initials } from "@/lib/utils";

/** Typographic thumbnail — no photography, just a monogram on a tinted field. */
export function PropertyThumb({ name, hue, className }: { name: string; hue: number; className?: string }) {
  return (
    <span
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-control font-display text-sm text-white", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 18%), hsl(${hue} 40% 34%))` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
