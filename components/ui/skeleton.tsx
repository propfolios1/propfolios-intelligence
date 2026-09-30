import { cn } from "@/lib/utils";

/** Skeleton block. Size it to match the final content exactly. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("animate-skeleton rounded-control bg-ink-100", className)} {...props} />;
}
