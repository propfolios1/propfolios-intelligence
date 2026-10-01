import { cn } from "@/lib/utils";

/** Shaped like the content it replaces. A slow sheen travels across; nothing pulses or spins. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span aria-hidden className={cn("skeleton block rounded-xs", className)} {...props} />;
}
