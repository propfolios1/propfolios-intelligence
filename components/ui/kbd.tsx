import { cn } from "@/lib/utils";

/** Keyboard hint chip: 10px mono, ink-400, hairline, 4px radius. */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <kbd className={cn("num inline-flex h-4 min-w-4 items-center justify-center rounded-xs border border-hairline bg-surface px-1 text-hint text-ink-400", className)} {...props} />;
}
