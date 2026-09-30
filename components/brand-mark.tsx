import { cn } from "@/lib/utils";

/**
 * PROPFOLIOS over INTELLIGENCE with a hairline gold rule between them.
 * Set in Geist; the rule is one of the five places gold is allowed.
 */
export function BrandMark({ className, inverted = false, size = "md" }: { className?: string; inverted?: boolean; size?: "sm" | "md" }) {
  const sm = size === "sm";
  return (
    <span className={cn("inline-flex flex-col select-none", className)} aria-label="PropFolios Intelligence" role="img">
      <span className={cn("font-sans font-semibold leading-none tracking-[0.22em]", sm ? "text-small" : "text-ui", inverted ? "text-paper" : "text-navy")} aria-hidden>
        PROPFOLIOS
      </span>
      <span className={cn("block h-px bg-gold", sm ? "my-[5px]" : "my-1.5")} aria-hidden />
      <span className={cn("font-sans leading-none tracking-[0.42em] text-[0.5625rem]", inverted ? "text-paper" : "text-ink-2")} aria-hidden>
        INTELLIGENCE
      </span>
    </span>
  );
}
